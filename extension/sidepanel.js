// Chinna Tab Assistant — side panel logic
const CHINNA = 'http://localhost:7777';
let currentTab = { url: '', title: '' };
let history = [];

const $ = (id) => document.getElementById(id);
const msgs = $('msgs'), input = $('input'), sendBtn = $('sendBtn');

// ---------- Tab awareness ----------
async function refreshTab() {
  const t = await send({ type: 'get-active-tab' });
  currentTab = { url: t.url || '', title: t.title || '', id: t.id };
  const host = safeHost(currentTab.url);
  $('ctxTitle').textContent = currentTab.title ? `${currentTab.title} · ${host}` : 'No active tab';
  renderSuggestions();
}
function safeHost(u){ try { return new URL(u).hostname.replace('www.',''); } catch(e){ return ''; } }

// ---------- Contextual suggestions (max 3, auto-switch) ----------
function renderSuggestions() {
  const host = safeHost(currentTab.url);
  const url = currentTab.url || '';
  let s = [];
  if (/youtube\.com|vimeo/.test(url)) s = ['Summarize this video page', 'Key points & timestamps', 'Clone this page'];
  else if (/github\.com/.test(url)) s = ['Explain this repo', 'Summarize the README', 'List open issues'];
  else if (/news|medium|blog|article|\/20\d\d\//.test(url)) s = ['Summarize this article', 'TL;DR in 3 bullets', 'Extract key quotes'];
  else if (/amazon|flipkart|shop|product|store/.test(url)) s = ['Compare specs', 'Scrape price & reviews', 'Pros & cons'];
  else if (/docs\.|documentation|developer\./.test(url)) s = ['Explain this doc simply', 'Give me a quick example', 'Scrape the API table'];
  else if (/stackoverflow|reddit|forum/.test(url)) s = ['Summarize the discussion', 'Best answer only', 'Extract the solution'];
  else if (host) s = [`What is ${host} about?`, 'Summarize this page', 'Scrape main content'];
  else s = ['Summarize this page', 'Scrape main content', 'Clone this page'];
  const wrap = $('suggs');
  wrap.innerHTML = '';
  s.slice(0, 3).forEach(text => {
    const b = document.createElement('button');
    b.className = 'sugg'; b.textContent = text;
    b.onclick = () => { input.value = text; doSend(); };
    wrap.appendChild(b);
  });
}

// ---------- Messaging helpers ----------
function send(msg) { return new Promise(res => chrome.runtime.sendMessage(msg, res)); }

function addMsg(who, text, cls) {
  const w = $('msgs').querySelector('.welcome'); if (w) w.remove();
  const d = document.createElement('div');
  d.className = 'msg ' + cls;
  d.innerHTML = `<div class="who">${who}</div><div class="bubble"></div>`;
  d.querySelector('.bubble').textContent = text;
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
  return d;
}
function addTyping() {
  const d = document.createElement('div');
  d.className = 'msg ai'; d.id = 'typing';
  d.innerHTML = `<div class="who">Chinna</div><div class="bubble"><div class="typing"><i></i><i></i><i></i></div></div>`;
  msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
}
function rmTyping() { const t = $('typing'); if (t) t.remove(); }

// ---------- Artifact (cloned HTML / scraped data) ----------
function addArtifact(opts) {
  const w = $('msgs').querySelector('.welcome'); if (w) w.remove();
  const wrap = document.createElement('div');
  wrap.className = 'msg ai';
  const preview = (opts.preview || '').slice(0, 4000);
  wrap.innerHTML = `
    <div class="who">Chinna</div>
    <div class="bubble">${opts.note || 'Done.'}</div>
    <div class="artifact">
      <div class="artifact-h">
        <div class="nm"><span class="badge">${opts.badge || 'FILE'}</span><span>${opts.name}</span></div>
        <div class="artifact-acts">
          <button class="a-btn ghost copyBtn">Copy</button>
          <button class="a-btn dlBtn">Download</button>
        </div>
      </div>
      <div class="artifact-body">${escapeHtml(preview)}${(opts.preview||'').length>4000?'\n\n…(truncated preview)':''}</div>
    </div>`;
  msgs.appendChild(wrap);
  wrap.querySelector('.dlBtn').onclick = () => downloadFile(opts.name, opts.content, opts.mime || 'text/html');
  wrap.querySelector('.copyBtn').onclick = () => { navigator.clipboard.writeText(opts.content); toast('Copied'); };
  msgs.scrollTop = msgs.scrollHeight;
}
function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename: name, saveAs: false }, () => {
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Saved to Downloads');
  });
}

// ---------- AI chat (through local Chinna server) ----------
async function askAI(question, context) {
  const sys = context ? `You are Chinna, a friendly assistant embedded in the user's browser. The user is viewing this page:\nTitle: ${context.title}\nURL: ${context.url}\nContent:\n${context.text}\n\nAnswer conversationally and concisely.` : 'You are Chinna, a friendly browser assistant. Be concise and natural.';
  try {
    const r = await fetch(`${CHINNA}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: question, system: sys })
    });
    const d = await r.json();
    return d.reply || d.error || 'No response.';
  } catch (e) {
    return 'Could not reach Chinna (is the dashboard running on localhost:7777?). Start it with: chinna dashboard';
  }
}

async function getPageContext() {
  const res = await send({ type: 'run-in-tab', func: 'scrape', options: {} });
  if (!res.ok) return null;
  const r = res.result;
  const text = [r.metaDesc, ...(r.headings||[]), ...(r.paras||[])].join('\n').slice(0, 6000);
  return { title: r.title, url: r.url, text, raw: r };
}

// ---------- Main send ----------
async function doSend() {
  const q = input.value.trim();
  if (!q) return;
  addMsg('You', q, 'me');
  input.value = ''; autoGrow();
  addTyping();
  const ctx = await getPageContext();
  const ans = await askAI(q, ctx);
  rmTyping();
  addMsg('Chinna', ans, 'ai');
}

// ---------- Tool actions ----------
async function doAction(act) {
  $('tray').hidden = true;
  if (act === 'screenshot') {
    const r = await send({ type: 'capture-screenshot' });
    if (r.ok) {
      addArtifact({ badge:'PNG', name:`screenshot-${Date.now()}.png`, note:'Screenshot captured.', preview:'(image)', content:r.dataUrl, mime:'image/png' });
      // download directly too
      chrome.downloads.download({ url: r.dataUrl, filename:`chinna-shot-${Date.now()}.png` });
      toast('Screenshot saved');
    } else toast('Screenshot failed');
  }
  else if (act === 'record') { startRecording(); }
  else if (act === 'summarize') {
    addMsg('You', 'Summarize this page', 'me'); addTyping();
    const ctx = await getPageContext();
    const ans = await askAI('Summarize this page in 4-5 concise bullet points.', ctx);
    rmTyping(); addMsg('Chinna', ans, 'ai');
  }
  else if (act === 'scrape') {
    const res = await send({ type: 'run-in-tab', func: 'scrape', options: {} });
    if (res.ok) {
      const r = res.result;
      const data = JSON.stringify({ title:r.title, url:r.url, headings:r.headings, paragraphs:r.paras, tables:r.tables }, null, 2);
      addArtifact({ badge:'JSON', name:`scrape-${safeHost(r.url)}-${Date.now()}.json`, note:`Scraped ${r.headings.length} headings, ${r.paras.length} text blocks, ${r.tables.length} tables.`, preview:data, content:data, mime:'application/json' });
    } else toast('Scrape failed');
  }
  else if (act === 'links') {
    const res = await send({ type: 'run-in-tab', func: 'scrape', options: {} });
    if (res.ok) {
      const links = res.result.links || [];
      const txt = links.map(l => `${l.t}\t${l.href}`).join('\n');
      addArtifact({ badge:'LINKS', name:`links-${Date.now()}.txt`, note:`Extracted ${links.length} links.`, preview:txt, content:txt, mime:'text/plain' });
    } else toast('No links');
  }
  else if (act === 'clone') {
    toast('Cloning page…');
    const res = await send({ type: 'run-in-tab', func: 'clone', options: {} });
    if (res.ok) {
      const r = res.result;
      const name = `${safeHost(r.url)||'page'}-clone.html`;
      addArtifact({ badge:'HTML', name, note:`Cloned into one responsive HTML file (${Math.round(r.bytes/1024)}KB) — images inlined, CSS bundled, hover & transitions preserved.`, preview:r.html, content:r.html, mime:'text/html' });
    } else toast('Clone failed: ' + (res.error||''));
  }
}

// ---------- Recording (offscreen MediaRecorder) ----------
let recorder = null, chunks = [];
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
    chunks = [];
    recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({ url, filename: `chinna-recording-${Date.now()}.webm` });
      toast('Recording saved');
      stream.getTracks().forEach(t => t.stop());
    };
    recorder.start();
    toast('Recording… click Record again to stop');
    stream.getVideoTracks()[0].onended = () => { if (recorder && recorder.state !== 'inactive') recorder.stop(); };
  } catch (e) { toast('Recording cancelled'); }
}

// ---------- Toast ----------
let toastEl;
function toast(msg) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'toast'; document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastEl._t); toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

// ---------- UI wiring ----------
function autoGrow(){ input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; }
input.addEventListener('input', autoGrow);
input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } });
sendBtn.onclick = doSend;
$('menuBtn').onclick = () => { $('tray').hidden = !$('tray').hidden; };
document.querySelectorAll('.tool').forEach(b => b.onclick = () => doAction(b.dataset.act));

// React to tab changes -> auto switch suggestions
chrome.runtime.onMessage.addListener((m) => {
  if (m.type === 'tab-changed') {
    currentTab = { url: m.url, title: m.title };
    $('ctxTitle').textContent = m.title ? `${m.title} · ${safeHost(m.url)}` : 'No active tab';
    renderSuggestions();
  }
});

refreshTab();
