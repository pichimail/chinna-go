/* ═══════════════════════════════════════════════════════════════════
   CHINNA COMPANION — sidepanel logic (Enhanced v2)
   Dynamic Browser Automation + Accessibility + Futuristic UX
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const API = 'http://localhost:7777';
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let state = {
  contextMode: 'this-tab',
  selectedTabIds: [],
  chatId: null,
  history: [],
  online: false,
  recording: false,
  recordedActions: [],
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
function esc(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&','<':'<','>':'>','"':'"'}[c]));}

function toast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--s2);border:1px solid var(--line3);color:var(--t1);padding:8px 14px;border-radius:8px;font-size:12px;z-index:200;box-shadow:0 6px 20px rgba(0,0,0,.5)';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

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

// ── AI chat ────────────────────────────────────────────────────────────
async function sendMessage(text) {
  if (!text.trim()) return;
  addMsg('user', text);
  state.history.push({ role: 'user', content: text });
  $('#input').value = '';
  $('#input').style.height = 'auto';
  addTyping();

  try {
    const context = await buildContext();
    const payload = { message: text, context, history: state.history.slice(-10) };
    let reply = '';
    try {
      const r = await api('/api/chat', { method: 'POST', body: JSON.stringify({ ...payload, system: context }) });
      reply = r.reply || r.response || r.text || JSON.stringify(r);
    } catch {
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

// ── Chat history ───────────────────────────────────────────────────────
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
  $('#messages').innerHTML = `<div class="welcome" id="welcome"><div class="welcome-mark">C</div><div class="welcome-title">New chat</div><div class="welcome-sub">Ask about this page, run commands, control music, or autofill forms.</div></div>`;
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

// ── Music & Generate ───────────────────────────────────────────────────
async function musicControl(action) {
  try {
    const r = await api('/api/ext/music', { method: 'POST', body: JSON.stringify({ action }) });
    $('#musicPlayer').style.display = 'flex';
    if (r.title) { $('#mpTitle').textContent = r.title; $('#mpArtist').textContent = r.artist || ''; }
    else if (r.now_playing) { $('#mpTitle').textContent = r.now_playing; }
    return r;
  } catch (e) { toast('Music control needs Chinna-Go running'); }
}

async function generateMusic() {
  const prompt = $('#musicPrompt').value.trim();
  if (!prompt) { $('#mgStatus').textContent = 'Enter a prompt first.'; return; }
  $('#mgStatus').textContent = 'Checking API key…';
  try {
    const key = await api('/api/ext/key?name=ACCOUSTICA_API_KEY');
    if (!key.present) { $('#mgStatus').textContent = '⚠ No key. Set ACCOUSTICA_API_KEY in dashboard Settings.'; return; }
    $('#mgStatus').textContent = 'Generating… this can take ~1 min.';
    const r = await api('/api/ext/generate-music', { method: 'POST', body: JSON.stringify({ prompt, instrumental: $('#mgInstrumental').checked, model: $('#mgModel').value, customMode: false }) });
    $('#mgStatus').textContent = r.error ? '✗ ' + r.error : '✓ Generation queued! Check Accoustica / your KIE dashboard.';
  } catch (e) { $('#mgStatus').textContent = '✗ ' + e.message; }
}

// ── Screenshot & Clone ─────────────────────────────────────────────────
async function screenshot() {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
    const tab = await getActiveTab();
    const name = 'chinna-' + (tab.title || 'page').replace(/[^a-z0-9]/gi, '-').slice(0, 30) + '.png';
    await chrome.downloads.download({ url: dataUrl, filename: name });
    toast('Screenshot saved');
  } catch (e) { toast('Screenshot failed'); }
}

async function clonePage() {
  const tab = await getActiveTab();
  addMsg('user', 'Clone this page into a single HTML file');
  addTyping();
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => document.documentElement.outerHTML });
    const blob = new Blob([res.result], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({ url, filename: 'chinna-clone-' + Date.now() + '.html' });
    rmTyping();
    addMsg('ai', '✓ Cloned the page HTML and downloaded it.');
  } catch (e) { rmTyping(); addMsg('ai', 'Clone failed: ' + e.message); }
}

// ── NEW: Element Inspector + Accessibility ─────────────────────────────
async function inspectElement() {
  const tab = await getActiveTab();
  addMsg('user', 'Inspect element on this page (click any element)');
  
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        if (window.__chinnaInspector) { window.__chinnaInspector.disconnect(); }
        
        const overlay = document.createElement('div');
        overlay.id = '__chinnaOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
        document.body.appendChild(overlay);

        const infoBox = document.createElement('div');
        infoBox.style.cssText = 'position:fixed;bottom:20px;left:20px;background:rgba(0,0,0,0.9);color:#0f0;border:1px solid #0f0;padding:12px 16px;border-radius:8px;font-family:monospace;font-size:12px;max-width:420px;z-index:2147483648;';
        document.body.appendChild(infoBox);

        function updateInfo(el) {
          const role = el.getAttribute('role') || el.tagName.toLowerCase();
          const label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.innerText?.slice(0,80) || '';
          const rect = el.getBoundingClientRect();
          infoBox.innerHTML = `
            <div style="color:#0f0;margin-bottom:6px">🔍 CHINNA INSPECTOR</div>
            <div><b>Tag:</b> ${el.tagName.toLowerCase()}</div>
            <div><b>Role:</b> ${role}</div>
            <div><b>Label:</b> ${label || '(none)'}</div>
            <div><b>Classes:</b> ${el.className || '(none)'}</div>
            <div style="margin-top:6px;color:#888;font-size:11px">Click element to copy selector • ESC to exit</div>
          `;
          infoBox.style.left = Math.min(rect.left, window.innerWidth - 440) + 'px';
          infoBox.style.top = (rect.bottom + 10) + 'px';
        }

        const observer = new MutationObserver(() => {});
        observer.observe(document.body, { childList: true, subtree: true });

        document.addEventListener('mousemove', (e) => {
          const el = document.elementFromPoint(e.clientX, e.clientY);
          if (el && el !== overlay && el !== infoBox) updateInfo(el);
        }, { capture: true });

        document.addEventListener('click', (e) => {
          const el = document.elementFromPoint(e.clientX, e.clientY);
          if (el) {
            const selector = el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase();
            navigator.clipboard.writeText(selector);
            infoBox.innerHTML += `<div style="color:#0f0;margin-top:8px">✓ Copied selector: ${selector}</div>`;
            setTimeout(() => { overlay.remove(); infoBox.remove(); observer.disconnect(); }, 800);
          }
          e.preventDefault();
          e.stopImmediatePropagation();
        }, { capture: true, once: true });

        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') { overlay.remove(); infoBox.remove(); observer.disconnect(); }
        }, { once: true });

        window.__chinnaInspector = { disconnect: () => { overlay.remove(); infoBox.remove(); observer.disconnect(); } };
      }
    });
    toast('Inspector active — move mouse and click element');
  } catch (e) {
    toast('Inspector failed. Reload the page.');
  }
}

// ── NEW: Quick Accessibility Audit ─────────────────────────────────────
async function runAccessibilityAudit() {
  const tab = await getActiveTab();
  addMsg('user', 'Run accessibility audit on this page');
  addTyping();
  
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const issues = [];
        document.querySelectorAll('img:not([alt])').forEach((img, i) => { if (i < 5) issues.push(`Missing alt on image: ${img.src?.slice(0,60) || 'unknown'}`); });
        document.querySelectorAll('button, a, input').forEach(el => {
          const style = window.getComputedStyle(el);
          if (parseFloat(style.fontSize) < 12) issues.push(`Small text on interactive element: ${el.innerText?.slice(0,30) || el.tagName}`);
        });
        document.querySelectorAll('input:not([aria-label]):not([placeholder])').forEach((inp, i) => { if (i < 3 && !inp.labels?.length) issues.push(`Input missing label: ${inp.name || inp.type}`); });
        return { issues: issues.slice(0, 12), score: Math.max(60, 100 - issues.length * 8) };
      }
    });
    rmTyping();
    const result = res.result;
    let msg = `Accessibility Score: ${result.score}/100\n`;
    if (result.issues.length) { msg += 'Issues found:\n' + result.issues.map(i => '• ' + i).join('\n'); }
    else { msg += 'No major issues detected.'; }
    addMsg('ai', msg);
  } catch (e) { rmTyping(); addMsg('ai', 'Accessibility audit failed. Reload the page.'); }
}

// ── NEW: Dynamic Script Runner from Sidepanel ──────────────────────────
async function runDynamicScript() {
  const code = prompt('Enter JavaScript to run on current page:');
  if (!code) return;
  const tab = await getActiveTab();
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (script) => { try { return eval(script); } catch(e) { return 'Error: ' + e.message; } }, args: [code] });
    addMsg('ai', 'Script result: ' + JSON.stringify(res.result).slice(0, 500));
  } catch (e) { addMsg('ai', 'Script execution failed: ' + e.message); }
}

// ── Automation Panel Actions ───────────────────────────────────────────
async function runBrowserAutomation(action, value = '') {
  const out = $('#browserOut');
  const tab = await getActiveTab();
  if (out) out.textContent = 'Running...';
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'BROWSER_AUTOMATION', action, value });
    const text = res?.summary || res?.result || JSON.stringify(res || {});
    if (out) out.textContent = text;
    if (action === 'extract') addMsg('ai', text);
    else toast(text);
  } catch (e) { if (out) out.textContent = 'Automation failed. Reload the page.'; toast('Automation failed'); }
}

// ── Record Automation (simple) ─────────────────────────────────────────
function toggleRecording() {
  state.recording = !state.recording;
  const btn = $('#recordBtn');
  if (state.recording) {
    state.recordedActions = [];
    btn.textContent = '⏹ Stop Recording';
    btn.style.background = '#f55';
    toast('Recording started — perform actions on the page');
  } else {
    btn.textContent = '⏺ Record Automation';
    btn.style.background = '';
    if (state.recordedActions.length) {
      const script = state.recordedActions.join('\n');
      addMsg('ai', 'Recorded script:\n```js\n' + script + '\n```');
    }
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

// ── Menu actions ───────────────────────────────────────────────────────
function handleAction(act) {
  $('#menu').classList.remove('open');
  switch (act) {
    case 'new': newChat(); break;
    case 'history': loadHistory(); openPanel('historyPanel'); break;
    case 'this-tab': state.contextMode = 'this-tab'; state.selectedTabIds = []; updateCtxBar(); break;
    case 'all-tabs': state.contextMode = 'all-tabs'; updateCtxBar(); break;
    case 'select-tabs': openTabsPicker(); break;
    case 'terminal': openPanel('terminalPanel'); $('#termInput').focus(); break;
    case 'music': musicControl('playpause'); break;
    case 'generate-music': openPanel('musicGenPanel'); break;
    case 'autofill': autofillForm(); break;
    case 'browser-tools': openPanel('browserPanel'); break;
    case 'screenshot': screenshot(); break;
    case 'clone': clonePage(); break;
    case 'inspect': inspectElement(); break;
    case 'a11y-audit': runAccessibilityAudit(); break;
    case 'run-script': runDynamicScript(); break;
    case 'record-auto': toggleRecording(); break;
    case 'settings': chrome.tabs.create({ url: API }); break;
  }
}

// ── Wire up events ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkConn();
  setInterval(checkConn, 8000);
  updateCtxBar();

  const input = $('#input');
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input.value); } });
  $('#sendBtn').addEventListener('click', () => sendMessage(input.value));

  $('#newChatBtn').addEventListener('click', newChat);

  $('#menuBtn').addEventListener('click', (e) => { e.stopPropagation(); $('#menu').classList.toggle('open'); });
  document.addEventListener('click', () => $('#menu').classList.remove('open'));
  $('#menu').addEventListener('click', (e) => { e.stopPropagation(); const it = e.target.closest('.menu-item'); if (it) handleAction(it.dataset.act); });

  $$('.suggest, .tool-chip').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.act) handleAction(b.dataset.act);
    else if (b.dataset.prompt) sendMessage(b.dataset.prompt);
  }));

  $$('[data-close]').forEach(b => b.addEventListener('click', () => closePanel(b.dataset.close)));

  $('#termRun').addEventListener('click', () => { const c = $('#termInput').value.trim(); if (c) { runTerminal(c); $('#termInput').value = ''; } });
  $('#termInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const c = e.target.value.trim(); if (c) { runTerminal(c); e.target.value = ''; } } });

  $$('[data-music]').forEach(b => b.addEventListener('click', () => musicControl(b.dataset.music)));
  $('#mgGenerate').addEventListener('click', generateMusic);

  $('#tabsApply').addEventListener('click', () => {
    state.selectedTabIds = [...$$('#tabsList input:checked')].map(i => parseInt(i.value));
    state.contextMode = 'selected';
    updateCtxBar(); closePanel('tabsPanel');
  });

  $$('[data-browser-act]').forEach(b => b.addEventListener('click', () => runBrowserAutomation(b.dataset.browserAct)));
  $('#browserClickRun').addEventListener('click', () => {
    const value = $('#browserClickText').value.trim();
    if (value) runBrowserAutomation(/^\d+$/.test(value) ? 'click-index' : 'click-text', value);
  });

  // New advanced buttons
  const recordBtn = document.createElement('button');
  recordBtn.id = 'recordBtn';
  recordBtn.textContent = '⏺ Record Automation';
  recordBtn.style.cssText = 'margin:8px 0;padding:6px 12px;background:var(--s2);border:1px solid var(--line3);color:var(--t1);border-radius:6px;cursor:pointer;font-size:12px';
  recordBtn.onclick = () => handleAction('record-auto');
  const browserPanel = $('#browserPanel .panel-body');
  if (browserPanel) browserPanel.appendChild(recordBtn);

  chrome.runtime.onMessage.addListener((msg) => { if (msg.type === 'NEW_CHAT') newChat(); });
});
