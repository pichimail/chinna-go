/* ═══════════════════════════════════════════════════════════════════
   CHINNA COMPANION — sidepanel logic
   Backend: local Chinna-Go dashboard on :7777
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const API = 'http://localhost:7777';
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let state = {
  contextMode: 'this-tab',     // this-tab | all-tabs | selected
  selectedTabIds: [],
  chatId: null,
  history: [],                  // current chat messages
  online: false,
  chatxUsers: [],
};

// ── Utilities ────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const r = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
function esc(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

// ── Connection status ──────────────────────────────────────────────────
async function checkConn() {
  try {
    await fetch(API + '/api/stats', { signal: AbortSignal.timeout(2500) });
    state.online = true;
    $('#connDot').classList.add('online');
    $('#connDot').title = 'Chinna-Go connected';
  } catch {
    state.online = false;
    $('#connDot').classList.remove('online');
    $('#connDot').title = 'Chinna-Go offline — run `chinna dashboard`';
  }
}

// ── Messages UI ────────────────────────────────────────────────────────
function addMsg(who, text, isHTML) {
  const w = $('#welcome'); if (w) w.style.display = 'none';
  const m = document.createElement('div');
  m.className = 'msg ' + who;
  const label = who === 'user' ? 'You' : 'Chinna';
  m.innerHTML = `<div class="who">${label}</div><div class="bubble">${isHTML ? text : esc(text)}</div>`;
  $('#messages').appendChild(m);
  $('#messages').scrollTop = $('#messages').scrollHeight;
  return m.querySelector('.bubble');
}
function addTyping() {
  const m = document.createElement('div');
  m.className = 'msg ai'; m.id = 'typingMsg';
  m.innerHTML = `<div class="who">Chinna</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
  $('#messages').appendChild(m);
  $('#messages').scrollTop = $('#messages').scrollHeight;
}
function rmTyping(){ const t = $('#typingMsg'); if (t) t.remove(); }

// ── Tab context ────────────────────────────────────────────────────────
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
async function scrapeTab(tabId) {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        title: document.title,
        url: location.href,
        text: document.body ? document.body.innerText.slice(0, 8000) : '',
        links: [...document.querySelectorAll('a[href]')].slice(0, 40).map(a => ({ t: a.innerText.trim().slice(0, 60), h: a.href })),
      }),
    });
    return res.result;
  } catch (e) { return { title: '', url: '', text: '', links: [] }; }
}
async function buildContext() {
  if (state.contextMode === 'this-tab') {
    const tab = await getActiveTab();
    const d = await scrapeTab(tab.id);
    return `[Current tab: ${d.title} — ${d.url}]\n${d.text}`;
  }
  if (state.contextMode === 'all-tabs') {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    let ctx = '[All open tabs]\n';
    for (const t of tabs.slice(0, 8)) ctx += `• ${t.title} — ${t.url}\n`;
    return ctx;
  }
  if (state.contextMode === 'selected' && state.selectedTabIds.length) {
    let ctx = '[Selected tabs]\n';
    for (const id of state.selectedTabIds.slice(0, 5)) {
      const d = await scrapeTab(id);
      ctx += `\n### ${d.title} (${d.url})\n${d.text.slice(0, 2500)}\n`;
    }
    return ctx;
  }
  return '';
}
function updateCtxBar() {
  const labels = { 'this-tab': 'This tab', 'all-tabs': 'All tabs', 'selected': `${state.selectedTabIds.length} tabs` };
  const ics = { 'this-tab': '◰', 'all-tabs': '◳', 'selected': '☰' };
  $('#ctxLabel').textContent = labels[state.contextMode] || 'This tab';
  $('#ctxChip').querySelector('.ctx-ic').textContent = ics[state.contextMode] || '◰';
  getActiveTab().then(t => { if (t) $('#ctxTabTitle').textContent = t.title || ''; });
}

// ── AI chat (routes through local dashboard's /api/ai) ────────────────
async function sendMessage(text) {
  if (!text.trim()) return;
  addMsg('user', text);
  state.history.push({ role: 'user', content: text });
  $('#input').value = '';
  $('#input').style.height = 'auto';
  addTyping();

  try {
    const context = await buildContext();
    const payload = {
      message: text,
      context: context,
      history: state.history.slice(-10),
    };
    // Try local dashboard AI first
    let reply = '';
    try {
      const r = await api('/api/ai', { method: 'POST', body: JSON.stringify(payload) });
      reply = r.reply || r.response || r.text || JSON.stringify(r);
    } catch {
      // Fallback: direct call instructions
      reply = "I couldn't reach your local Chinna-Go AI. Make sure the dashboard is running (`chinna dashboard`) and you've set an API key in Settings.";
    }
    rmTyping();
    addMsg('ai', reply);
    state.history.push({ role: 'assistant', content: reply });
    saveChat();
  } catch (e) {
    rmTyping();
    addMsg('ai', 'Error: ' + e.message);
  }
}

// ── Chat history (chrome.storage.local) ────────────────────────────────
async function saveChat() {
  if (!state.history.length) return;
  if (!state.chatId) state.chatId = 'chat_' + Date.now();
  const all = (await chrome.storage.local.get('chats')).chats || {};
  const firstUser = state.history.find(m => m.role === 'user');
  all[state.chatId] = {
    id: state.chatId,
    title: firstUser ? firstUser.content.slice(0, 50) : 'New chat',
    updated: Date.now(),
    messages: state.history,
  };
  await chrome.storage.local.set({ chats: all });
}
async function loadHistory() {
  const all = (await chrome.storage.local.get('chats')).chats || {};
  const list = Object.values(all).sort((a, b) => b.updated - a.updated);
  const el = $('#historyList');
  el.innerHTML = list.length ? '' : '<div style="text-align:center;color:var(--t3);padding:30px;font-size:12px">No chats yet</div>';
  list.forEach(c => {
    const item = document.createElement('div');
    item.className = 'history-item';
    const d = new Date(c.updated);
    item.innerHTML = `<div class="hi-title">${esc(c.title)}</div><div class="hi-meta">${c.messages.length} messages · ${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>`;
    item.onclick = () => { loadChat(c); closePanel('historyPanel'); };
    el.appendChild(item);
  });
}
function loadChat(c) {
  state.chatId = c.id;
  state.history = c.messages.slice();
  $('#messages').innerHTML = '';
  c.messages.forEach(m => addMsg(m.role === 'user' ? 'user' : 'ai', m.content));
}
function newChat() {
  state.chatId = null;
  state.history = [];
  $('#messages').innerHTML = `
    <div class="welcome" id="welcome">
      <div class="welcome-mark">C</div>
      <div class="welcome-title">New chat</div>
      <div class="welcome-sub">Ask about this page, run commands, control music, or autofill forms.</div>
    </div>`;
}

// ── Terminal ───────────────────────────────────────────────────────────
async function runTerminal(cmd) {
  const out = $('#termOut');
  out.innerHTML += `<div class="cmd">$ ${esc(cmd)}</div>`;
  out.scrollTop = out.scrollHeight;
  try {
    const r = await api('/api/ext/shell', { method: 'POST', body: JSON.stringify({ code: cmd, lang: 'bash' }) });
    if (r.error) out.innerHTML += `<div class="err">${esc(r.error)}</div>`;
    else out.innerHTML += `<div>${esc(r.result || '(no output)')}</div>`;
  } catch (e) {
    out.innerHTML += `<div class="err">Offline — start Chinna-Go dashboard</div>`;
  }
  out.scrollTop = out.scrollHeight;
}

// ── Music control ──────────────────────────────────────────────────────
async function musicControl(action) {
  try {
    const r = await api('/api/ext/music', { method: 'POST', body: JSON.stringify({ action }) });
    $('#musicPlayer').style.display = 'flex';
    if (r.title) { $('#mpTitle').textContent = r.title; $('#mpArtist').textContent = r.artist || ''; }
    else if (r.now_playing) { $('#mpTitle').textContent = r.now_playing; }
    return r;
  } catch (e) {
    toast('Music control needs Chinna-Go running');
  }
}

// ── Generate music ─────────────────────────────────────────────────────
async function generateMusic() {
  const prompt = $('#musicPrompt').value.trim();
  if (!prompt) { $('#mgStatus').textContent = 'Enter a prompt first.'; return; }
  $('#mgStatus').textContent = 'Checking API key…';
  try {
    const key = await api('/api/ext/key?name=ACCOUSTICA_API_KEY');
    if (!key.present) { $('#mgStatus').textContent = '⚠ No key. Set ACCOUSTICA_API_KEY (or KIE_API_KEY) in dashboard Settings.'; return; }
    $('#mgStatus').textContent = 'Generating… this can take ~1 min.';
    const r = await api('/api/ext/generate-music', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        instrumental: $('#mgInstrumental').checked,
        model: $('#mgModel').value,
        customMode: false,
      }),
    });
    if (r.error) $('#mgStatus').textContent = '✗ ' + r.error;
    else $('#mgStatus').textContent = '✓ Generation queued! Check Accoustica / your KIE dashboard.';
  } catch (e) {
    $('#mgStatus').textContent = '✗ ' + e.message;
  }
}

// ── Screenshot ─────────────────────────────────────────────────────────
async function screenshot() {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
    const tab = await getActiveTab();
    const name = 'chinna-' + (tab.title || 'page').replace(/[^a-z0-9]/gi, '-').slice(0, 30) + '.png';
    await chrome.downloads.download({ url: dataUrl, filename: name });
    toast('Screenshot saved');
  } catch (e) { toast('Screenshot failed'); }
}

// ── Clone page ─────────────────────────────────────────────────────────
async function clonePage() {
  const tab = await getActiveTab();
  addMsg('user', 'Clone this page into a single HTML file');
  addTyping();
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.outerHTML,
    });
    const html = res.result;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({ url, filename: 'chinna-clone-' + Date.now() + '.html' });
    rmTyping();
    addMsg('ai', '✓ Cloned the page HTML and downloaded it. Note: external CSS/JS still reference original URLs.');
  } catch (e) {
    rmTyping(); addMsg('ai', 'Clone failed: ' + e.message);
  }
}

// ── Form autofill (delegates to content.js) ────────────────────────────
async function autofillForm() {
  const tab = await getActiveTab();
  addMsg('user', 'Fill the form on this page');
  addTyping();
  try {
    // Get form fields from content script
    const fields = await chrome.tabs.sendMessage(tab.id, { type: 'GET_FORM_FIELDS' });
    if (!fields || !fields.length) { rmTyping(); addMsg('ai', 'No form fields found on this page.'); return; }
    // Ask AI to generate values
    const prompt = `Fill these form fields with realistic sample values. Return ONLY JSON {fieldName: value}. Fields: ${JSON.stringify(fields)}`;
    let values = {};
    try {
      const r = await api('/api/ai', { method: 'POST', body: JSON.stringify({ message: prompt }) });
      const txt = (r.reply || r.response || '').replace(/```json|```/g, '').trim();
      values = JSON.parse(txt);
    } catch {
      // fallback: sample values
      fields.forEach(f => { values[f.name] = f.type === 'email' ? 'test@example.com' : f.type === 'tel' ? '+1234567890' : 'Sample ' + f.name; });
    }
    await chrome.tabs.sendMessage(tab.id, { type: 'FILL_FORM', values });
    rmTyping();
    addMsg('ai', `✓ Filled ${Object.keys(values).length} fields. Review before submitting.`);
  } catch (e) {
    rmTyping(); addMsg('ai', 'Autofill needs the page to allow content scripts. Try reloading the page.');
  }
}

// ── Panels ─────────────────────────────────────────────────────────────
function openPanel(id) { $$('.panel').forEach(p => p.classList.remove('open')); $('#' + id).classList.add('open'); }
function closePanel(id) { $('#' + id).classList.remove('open'); }

async function openTabsPicker() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const el = $('#tabsList'); el.innerHTML = '';
  tabs.forEach(t => {
    const item = document.createElement('div');
    item.className = 'tab-item';
    item.innerHTML = `<input type="checkbox" value="${t.id}"><img class="ti-fav" src="${t.favIconUrl || ''}" onerror="this.style.display='none'"><span class="ti-title">${esc(t.title)}</span>`;
    item.querySelector('input').onchange = (e) => item.classList.toggle('sel', e.target.checked);
    el.appendChild(item);
  });
  openPanel('tabsPanel');
}

// ── Secure Chat (live Chinna users) ───────────────────────────────────
async function refreshChatxUsers() {
  const el = $('#chatxUsers');
  if (!state.online) {
    if (el) el.innerHTML = '<div class="chatx-empty">Chinna offline</div>';
    $('#chatxLiveDot')?.classList.remove('on');
    return;
  }
  try {
    const d = await api('/api/chat/users');
    state.chatxUsers = d.users || [];
    const online = state.chatxUsers.filter(u => u.online).length;
    $('#chatxLiveDot')?.classList.toggle('on', online > 0);
    if (!el) return;
    if (!state.chatxUsers.length) {
      el.innerHTML = '<div class="chatx-empty">No users on relay</div>';
      return;
    }
    el.innerHTML = state.chatxUsers.slice(0, 8).map(u => `
      <div class="chatx-user-row">
        <div class="chatx-user-meta">
          <div class="chatx-user-name">${esc(u.display_name || u.id)}</div>
          <div class="chatx-user-id">${esc(u.id)}</div>
        </div>
        <div class="chatx-user-acts">
          <button class="chatx-act" data-chatx-call="${String(u.id).replace(/"/g,'')}" data-mode="voice">☎</button>
          <button class="chatx-act" data-chatx-call="${String(u.id).replace(/"/g,'')}" data-mode="video">▣</button>
        </div>
      </div>`).join('');
    el.querySelectorAll('[data-chatx-call]').forEach(btn => {
      btn.addEventListener('click', () => extCallUser(btn.dataset.chatxCall, btn.dataset.mode));
    });
  } catch {
    if (el) el.innerHTML = '<div class="chatx-empty">Relay unavailable</div>';
  }
}

function extCallUser(userId, mode = 'voice') {
  if (!userId) return;
  const url = `${API}/?chatx_call=${encodeURIComponent(userId)}&chatx_mode=${encodeURIComponent(mode)}#chatx`;
  chrome.tabs.create({ url });
  toast(`${mode === 'video' ? 'Video' : 'Voice'} call opening in dashboard`);
}

function openSecureChatDashboard() {
  chrome.tabs.create({ url: API + '/#chatx' });
}

// ── Toast ──────────────────────────────────────────────────────────────
function toast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--s2);border:1px solid var(--line3);color:var(--t1);padding:8px 14px;border-radius:8px;font-size:12px;z-index:200;box-shadow:0 6px 20px rgba(0,0,0,.5)';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ── Menu actions ───────────────────────────────────────────────────────
// ── Explain the user's current text selection on the page ──────────────
async function explainSelection() {
  const tab = await getActiveTab();
  let sel = '';
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => (window.getSelection ? String(window.getSelection()) : ''),
    });
    sel = (res.result || '').trim();
  } catch (e) { /* ignore */ }
  if (!sel) { toast('Select some text on the page first'); return; }
  sendMessage(`Explain this clearly and concisely:\n\n"${sel.slice(0, 4000)}"`);
}

// ── Copy the current page as clean Markdown ────────────────────────────
async function copyPageMarkdown() {
  const tab = await getActiveTab();
  let md = '';
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const title = document.title || '';
        const url = location.href;
        const main = document.querySelector('main, article') || document.body;
        const parts = [`# ${title}`, `<${url}>`, ''];
        main.querySelectorAll('h1,h2,h3,p,li').forEach(el => {
          const t = el.innerText.trim();
          if (!t) return;
          const tag = el.tagName.toLowerCase();
          if (tag === 'h1') parts.push(`\n# ${t}`);
          else if (tag === 'h2') parts.push(`\n## ${t}`);
          else if (tag === 'h3') parts.push(`\n### ${t}`);
          else if (tag === 'li') parts.push(`- ${t}`);
          else parts.push(`\n${t}`);
        });
        return parts.join('\n').slice(0, 12000);
      },
    });
    md = res.result || '';
  } catch (e) { md = ''; }
  if (!md) { toast('Could not read page'); return; }
  try { await navigator.clipboard.writeText(md); toast('Page copied as Markdown'); }
  catch (e) { toast('Clipboard blocked — opening preview'); addMsg('chinna', md); }
}

function handleAction(act) {
  $('#menu').classList.remove('open');
  switch (act) {
    case 'new': newChat(); break;
    case 'history': loadHistory(); openPanel('historyPanel'); break;
    case 'this-tab': state.contextMode = 'this-tab'; state.selectedTabIds = []; updateCtxBar(); break;
    case 'all-tabs': state.contextMode = 'all-tabs'; updateCtxBar(); break;
    case 'select-tabs': openTabsPicker(); break;
    case 'terminal': case 'terminal-quick': openPanel('terminalPanel'); $('#termInput').focus(); break;
    case 'music': case 'music-quick': musicControl('playpause'); break;
    case 'generate-music': openPanel('musicGenPanel'); break;
    case 'autofill': autofillForm(); break;
    case 'screenshot': screenshot(); break;
    case 'clone': clonePage(); break;
    case 'selection': explainSelection(); break;
    case 'markdown': copyPageMarkdown(); break;
    case 'secure-chat': openSecureChatDashboard(); break;
    case 'settings': chrome.tabs.create({ url: API }); break;
  }
}

// ── Wire up events ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkConn().then(() => refreshChatxUsers());
  setInterval(checkConn, 8000);
  setInterval(refreshChatxUsers, 10000);
  updateCtxBar();
  $('#chatxRefreshBtn')?.addEventListener('click', refreshChatxUsers);
  $('#chatxOpenBtn')?.addEventListener('click', openSecureChatDashboard);

  // Send
  const input = $('#input');
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input.value); } });
  $('#sendBtn').addEventListener('click', () => sendMessage(input.value));

  // New chat
  $('#newChatBtn').addEventListener('click', newChat);

  // Menu
  $('#menuBtn').addEventListener('click', (e) => { e.stopPropagation(); $('#menu').classList.toggle('open'); });
  document.addEventListener('click', () => $('#menu').classList.remove('open'));
  $('#menu').addEventListener('click', (e) => { e.stopPropagation(); const it = e.target.closest('.menu-item'); if (!it) return; if (it.dataset.act) handleAction(it.dataset.act); else if (it.dataset.prompt) { $('#menu').classList.remove('open'); sendMessage(it.dataset.prompt); } });

  // Suggest chips + tool chips
  $$('.suggest, .tool-chip').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.act) handleAction(b.dataset.act);
    else if (b.dataset.prompt) sendMessage(b.dataset.prompt);
  }));

  // Panel close buttons
  $$('[data-close]').forEach(b => b.addEventListener('click', () => closePanel(b.dataset.close)));

  // Terminal
  $('#termRun').addEventListener('click', () => { const c = $('#termInput').value.trim(); if (c) { runTerminal(c); $('#termInput').value = ''; } });
  $('#termInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const c = e.target.value.trim(); if (c) { runTerminal(c); e.target.value = ''; } } });

  // Music
  $$('[data-music]').forEach(b => b.addEventListener('click', () => musicControl(b.dataset.music)));

  // Generate music
  $('#mgGenerate').addEventListener('click', generateMusic);

  // Tabs picker apply
  $('#tabsApply').addEventListener('click', () => {
    state.selectedTabIds = [...$$('#tabsList input:checked')].map(i => parseInt(i.value));
    state.contextMode = 'selected';
    updateCtxBar(); closePanel('tabsPanel');
  });

  // Listen for new-chat command from background
  chrome.runtime.onMessage.addListener((msg) => { if (msg.type === 'NEW_CHAT') newChat(); });
});
