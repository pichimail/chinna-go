#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const pino = require('pino');
const {
  default: makeWASocket,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} = require('@whiskeysockets/baileys');

const CHINNA_HOME = process.env.CHINNA_HOME || path.join(process.env.HOME || '.', '.chinna');
const PORT = Number(process.env.PORT || 7858);
const HOST = process.env.HOST || '127.0.0.1';
const WA_DIR = path.join(CHINNA_HOME, 'whatsapp');
const AUTH_DIR = path.join(WA_DIR, 'auth');

fs.mkdirSync(WA_DIR, { recursive: true });
fs.mkdirSync(AUTH_DIR, { recursive: true });

const logger = pino({ level: process.env.CHINNA_WA_LOG_LEVEL || 'silent' });
let sock = null;
let saveCreds = null;
let starting = null;
let qr = '';
let connected = false;
let lastError = '';
let me = null;
let lastConnectionAt = 0;
const chats = new Map();
const messages = new Map();
const calls = [];

function json(res, body, code = 200) {
  const raw = Buffer.from(JSON.stringify(body));
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': raw.length,
  });
  res.end(raw);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
  });
}

function jidFrom(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  if (input.includes('@')) return input;
  const digits = input.replace(/\D/g, '');
  return digits ? `${digits}@s.whatsapp.net` : '';
}

function chatName(jid) {
  const c = chats.get(jid) || {};
  return c.name || c.subject || c.notify || c.pushName || jid.split('@')[0];
}

function upsertChat(jid, patch = {}) {
  if (!jid) return;
  const prev = chats.get(jid) || { jid, name: jid.split('@')[0], unread: 0, timestamp: 0 };
  chats.set(jid, { ...prev, ...patch, jid });
}

function unwrapMessage(message = {}) {
  return message.ephemeralMessage?.message
    || message.viewOnceMessage?.message
    || message.viewOnceMessageV2?.message
    || message.documentWithCaptionMessage?.message
    || message;
}

function contentType(message = {}) {
  const msg = unwrapMessage(message);
  return Object.keys(msg || {})[0] || 'unknown';
}

function msgText(m) {
  const msg = unwrapMessage(m.message || {});
  return msg.conversation
    || msg.extendedTextMessage?.text
    || msg.imageMessage?.caption
    || msg.videoMessage?.caption
    || msg.documentMessage?.caption
    || msg.buttonsResponseMessage?.selectedDisplayText
    || msg.listResponseMessage?.title
    || '';
}

function mediaSummary(m) {
  const msg = unwrapMessage(m.message || {});
  if (msg.imageMessage) return { kind: 'image', label: 'Image', mime: msg.imageMessage.mimetype || 'image/jpeg', caption: msg.imageMessage.caption || '' };
  if (msg.videoMessage) return { kind: 'video', label: 'Video', mime: msg.videoMessage.mimetype || 'video/mp4', caption: msg.videoMessage.caption || '' };
  if (msg.audioMessage) return { kind: 'audio', label: msg.audioMessage.ptt ? 'Voice note' : 'Audio', mime: msg.audioMessage.mimetype || 'audio/ogg', caption: '' };
  if (msg.documentMessage) return {
    kind: 'document',
    label: msg.documentMessage.fileName || 'Document',
    mime: msg.documentMessage.mimetype || 'application/octet-stream',
    caption: msg.documentMessage.caption || '',
    fileName: msg.documentMessage.fileName || 'file',
    size: Number(msg.documentMessage.fileLength || 0),
  };
  if (msg.stickerMessage) return { kind: 'sticker', label: 'Sticker', mime: msg.stickerMessage.mimetype || 'image/webp', caption: '' };
  return null;
}

async function mediaPreview(m, summary) {
  if (!summary || !sock) return summary;
  const preview = { ...summary };
  try {
    const buffer = await downloadMediaMessage(
      m,
      'buffer',
      {},
      { logger, reuploadRequest: sock.updateMediaMessage }
    );
    const maxInline = Number(process.env.CHINNA_WA_INLINE_MEDIA_LIMIT || 2_250_000);
    preview.size = buffer.length;
    preview.name = preview.fileName || `${preview.kind || 'media'}-${m.key?.id || Date.now()}`;
    if (buffer.length <= maxInline) {
      preview.data_b64 = buffer.toString('base64');
    } else {
      preview.too_large = true;
    }
  } catch (e) {
    preview.error = e?.message || String(e);
  }
  return preview;
}

function friendlyLast(text, media) {
  if (text) return text;
  if (!media) return '';
  if (media.caption) return `${media.label}: ${media.caption}`;
  return media.label || 'Media';
}

async function storeMessage(m) {
  const jid = m.key?.remoteJid;
  if (!jid || jid === 'status@broadcast') return;
  const text = msgText(m);
  const media = await mediaPreview(m, mediaSummary(m));
  upsertChat(jid, {
    name: m.pushName || chatName(jid),
    timestamp: Number(m.messageTimestamp || Math.floor(Date.now() / 1000)),
    last: friendlyLast(text, media),
  });
  const arr = messages.get(jid) || [];
  const id = m.key?.id || `${Date.now()}-${arr.length}`;
  if (!arr.some((x) => x.id === id)) {
    arr.push({
      id,
      jid,
      fromMe: !!m.key?.fromMe,
      participant: m.key?.participant || '',
      pushName: m.pushName || '',
      timestamp: Number(m.messageTimestamp || Math.floor(Date.now() / 1000)),
      text,
      media,
      type: media?.kind || contentType(m.message || {}),
    });
  }
  messages.set(jid, arr.slice(-300));
}

async function startSocket(force = false) {
  if (starting) return starting;
  if (sock && !force) return sock;
  starting = (async () => {
    const auth = await useMultiFileAuthState(AUTH_DIR);
    saveCreds = auth.saveCreds;
    const { version } = await fetchLatestBaileysVersion();
    sock = makeWASocket({
      version,
      auth: auth.state,
      logger,
      printQRInTerminal: false,
      browser: ['Chinna', 'Chrome', '6.0'],
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
      if (update.qr) qr = update.qr;
      const { connection, lastDisconnect } = update;
      if (connection === 'open') {
        connected = true;
        qr = '';
        lastError = '';
        me = sock.user || null;
        lastConnectionAt = Date.now();
      }
      if (connection === 'close') {
        connected = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        lastError = lastDisconnect?.error?.message || '';
        sock = null;
        if (code !== DisconnectReason.loggedOut) {
          setTimeout(() => startSocket(true).catch((e) => { lastError = e.message; }), 1200);
        }
      }
    });
    sock.ev.on('chats.upsert', (items) => {
      for (const c of items || []) upsertChat(c.id, { name: c.name, unread: c.unreadCount || 0, timestamp: Number(c.conversationTimestamp || 0) });
    });
    sock.ev.on('chats.update', (items) => {
      for (const c of items || []) upsertChat(c.id, { name: c.name, unread: c.unreadCount, timestamp: Number(c.conversationTimestamp || 0) });
    });
    sock.ev.on('contacts.update', (items) => {
      for (const c of items || []) upsertChat(c.id, { name: c.notify || c.name || c.verifiedName });
    });
    sock.ev.on('messages.upsert', ({ messages: batch }) => {
      (async () => {
        for (const m of batch || []) await storeMessage(m);
      })().catch((e) => { lastError = e.message; });
    });
    sock.ev.on('messaging-history.set', ({ chats: cs, messages: ms }) => {
      (async () => {
        for (const c of cs || []) upsertChat(c.id, { name: c.name, unread: c.unreadCount || 0, timestamp: Number(c.conversationTimestamp || 0) });
        for (const m of ms || []) await storeMessage(m);
      })().catch((e) => { lastError = e.message; });
    });
    sock.ev.on('call', (items) => {
      for (const c of items || []) calls.unshift({ ...c, at: Date.now() });
      calls.splice(30);
    });
    return sock;
  })().finally(() => { starting = null; });
  return starting;
}

function status() {
  return {
    ok: true,
    connected,
    qr,
    has_qr: !!qr,
    me,
    last_error: lastError,
    last_connection_at: lastConnectionAt,
    bridge_port: PORT,
    chats: chats.size,
    calls: calls.slice(0, 10),
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, { ok: true });
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  try {
    if (url.pathname === '/health') return json(res, { ok: true });
    await startSocket(false);

    if (req.method === 'GET' && url.pathname === '/status') return json(res, status());
    if (req.method === 'GET' && url.pathname === '/qr') return json(res, { ok: true, qr, connected });
    if (req.method === 'GET' && url.pathname === '/chats') {
      const out = [...chats.values()].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
      return json(res, { ok: true, chats: out.slice(0, 100) });
    }
    if (req.method === 'GET' && url.pathname === '/messages') {
      const jid = jidFrom(url.searchParams.get('chat') || '');
      return json(res, { ok: true, jid, messages: messages.get(jid) || [] });
    }
    if (req.method === 'POST' && url.pathname === '/send') {
      const body = await readBody(req);
      const jid = jidFrom(body.jid || body.number);
      if (!jid) return json(res, { ok: false, error: 'valid WhatsApp number or jid required' }, 400);
      const text = String(body.text || body.message || '').trim();
      if (!text && !body.file_b64) return json(res, { ok: false, error: 'message text or file required' }, 400);
      let sent;
      if (body.file_b64) {
        const buffer = Buffer.from(String(body.file_b64), 'base64');
        const mime = body.mime || 'application/octet-stream';
        const name = body.name || 'file';
        if (mime.startsWith('image/')) {
          sent = await sock.sendMessage(jid, { image: buffer, mimetype: mime, caption: text || undefined });
        } else if (mime.startsWith('video/')) {
          sent = await sock.sendMessage(jid, { video: buffer, mimetype: mime, caption: text || undefined });
        } else if (mime.startsWith('audio/')) {
          sent = await sock.sendMessage(jid, { audio: buffer, mimetype: mime, ptt: false });
        } else {
          sent = await sock.sendMessage(jid, { document: buffer, mimetype: mime, fileName: name, caption: text || undefined });
        }
      } else {
        sent = await sock.sendMessage(jid, { text });
      }
      upsertChat(jid, { last: text || body.name || 'File sent', timestamp: Math.floor(Date.now() / 1000) });
      return json(res, { ok: true, jid, id: sent?.key?.id || '' });
    }
    if (req.method === 'POST' && url.pathname === '/reconnect') {
      await startSocket(true);
      return json(res, status());
    }
    if (req.method === 'POST' && url.pathname === '/logout') {
      try { await sock?.logout?.(); } catch {}
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      fs.mkdirSync(AUTH_DIR, { recursive: true });
      sock = null; connected = false; qr = ''; me = null; chats.clear(); messages.clear();
      await startSocket(true);
      return json(res, { ok: true, logged_out: true });
    }
    if (req.method === 'POST' && url.pathname === '/handoff') {
      const body = await readBody(req);
      const jid = jidFrom(body.jid || body.number);
      const digits = jid.split('@')[0];
      const link = digits ? `https://wa.me/${digits}` : 'https://web.whatsapp.com';
      return json(res, {
        ok: true,
        url: link,
        note: 'WhatsApp call media is handled by WhatsApp. Chinna can open the chat, while Secure Chat provides in-dashboard calls.',
      });
    }
    return json(res, { ok: false, error: `unknown ${url.pathname}` }, 404);
  } catch (e) {
    lastError = e && e.message ? e.message : String(e);
    return json(res, { ok: false, error: lastError }, 500);
  }
});

startSocket(false).catch((e) => { lastError = e.message; });
server.listen(PORT, HOST, () => {
  console.log(`Chinna WhatsApp bridge listening on http://${HOST}:${PORT}`);
});
