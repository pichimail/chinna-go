/**
 * LID / PN Resolution Helper for Baileys v7+
 * 
 * Advanced helper for Phone Number <-> LID resolution + chat/message enrichment.
 * Fully compatible with Baileys v7 LID system.
 * 
 * Usage:
 *   import { enrichChat, enrichMessage, resolveJid, getDisplayName } from './lid-helper.js';
 */

export async function getLID(sock, pnJid) {
  if (!sock?.signalRepository?.lidMapping) return null;
  try {
    return await sock.signalRepository.lidMapping.getLIDForPN(pnJid);
  } catch (e) {
    return null;
  }
}

export async function getPN(sock, lidJid) {
  if (!sock?.signalRepository?.lidMapping) return null;
  try {
    return sock.signalRepository.lidMapping.getPNForLID(lidJid);
  } catch (e) {
    return null;
  }
}

/**
 * Batch resolve multiple JIDs at once (much more efficient)
 */
export async function batchResolveJids(sock, jids = []) {
  if (!sock?.signalRepository?.lidMapping || !jids.length) return {};
  
  const result = {};
  const toResolve = jids.filter(j => j && !j.includes('@lid'));
  
  if (toResolve.length === 0) {
    jids.forEach(j => { if (j) result[j] = j; });
    return result;
  }

  try {
    const mappings = await sock.signalRepository.lidMapping.getLIDsForPNs(toResolve);
    if (mappings) {
      mappings.forEach(m => {
        if (m?.pn && m?.lid) result[m.pn] = m.lid;
      });
    }
  } catch (e) {}

  // Fill in unresolved ones
  jids.forEach(j => {
    if (j && !result[j]) result[j] = j;
  });

  return result;
}

/**
 * Resolves a JID to the best displayable form.
 * In v7, prefers LID for internal use but can return PN for display.
 */
export async function resolveJid(sock, jid) {
  if (!jid) return jid;
  if (jid.includes('@lid')) return jid;
  
  const lid = await getLID(sock, jid);
  return lid || jid;
}

/**
 * Gets the best human-readable identifier (prefers phone number for display)
 */
export async function getDisplayJid(sock, jid) {
  if (!jid) return jid;
  if (jid.includes('@lid')) {
    const pn = await getPN(sock, jid);
    return pn || jid;
  }
  return jid;
}

/**
 * Tries to get a nice display name for a JID (from chat store or resolved)
 */
export async function getDisplayName(sock, jid, chatsMap = null) {
  if (!jid) return 'Unknown';
  
  // Try from provided chats map first
  if (chatsMap && chatsMap.has(jid)) {
    const chat = chatsMap.get(jid);
    if (chat?.name) return chat.name;
  }
  
  // Fallback to number
  return jid.split('@')[0] || jid;
}

/**
 * Enriches a chat object with both id and resolved display info
 */
export async function enrichChat(sock, chat) {
  if (!chat) return chat;
  
  const id = chat.id || chat.jid || chat.remoteJid;
  if (!id) return chat;

  const displayJid = await getDisplayJid(sock, id);
  
  return {
    ...chat,
    id,
    jid: id,
    displayJid,
    _resolved: true,
    _isLid: id.includes('@lid'),
  };
}

/**
 * Enriches an array of chats
 */
export async function enrichChats(sock, chats = []) {
  if (!Array.isArray(chats)) return chats;
  return Promise.all(chats.map(c => enrichChat(sock, c)));
}

/**
 * Enriches a message with resolved participant info
 */
export async function enrichMessage(sock, message) {
  if (!message) return message;
  
  const jid = message.key?.remoteJid;
  if (!jid) return message;

  const displayJid = await getDisplayJid(sock, jid);
  const participant = message.key?.participant;
  const displayParticipant = participant ? await getDisplayJid(sock, participant) : null;

  return {
    ...message,
    _displayJid: displayJid,
    _displayParticipant: displayParticipant,
    _isLid: jid.includes('@lid'),
  };
}

/**
 * Normalizes chat/contact objects to v7 style (prefers .id)
 */
export function normalizeChat(chat) {
  if (!chat) return chat;
  const id = chat.id || chat.jid || chat.remoteJid;
  return {
    ...chat,
    id,
    jid: id,
  };
}

export function normalizeChats(chats = []) {
  return chats.map(normalizeChat);
}
