// Chinna Tab Assistant — side panel logic
const CHINNA = 'http://localhost:7777';
let currentTab = { url: '', title: '' };
let history = [];
let lastAccousticaTaskId = localStorage.getItem('lastAccousticaTaskId') || '';

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

// ---------- Contextual suggestions ----------
function renderSuggestions() {
  const host = safeHost(currentTab.url);
  const url = currentTab.url || '';
  let s = [];
  if (/youtube\.com|youtu\.be|vimeo|music|spotify|soundcloud/.test(url)) s = ['Summarize this video', 'Make Accoustica prompt', 'Generate with Accoustica', 'Check Accoustica task'];
  else if (/github\.com/.test(url)) s = ['Explain this repo', 'Summarize the README', 'List open issues'];
  else if (/news|medium|blog|article|\/20\d\d\//.test(url)) s = ['Summarize this article', 'TL;DR in 3 bullets', 'Extract key quotes'];
  else if (/amazon|flipkart|shop|product|store/.test(url)) s = ['Compare specs', 'Scrape price & reviews', 'Pros & cons'];
  else if (/docs\.|documentation|developer\./.test(url)) s = ['Explain this doc simply', 'Give me a quick example', 'Scrape the API table'];
  else if (/stackoverflow|reddit|forum/.test(url)) s = ['Summarize the discussion', 'Best answer only', 'Extract the solution'];
  else if (host) s = [`What is ${host} about?`, 'Summarize this page', 'Scrape main content'];
  else s = ['Summarize this page', 'Scrape main content', 'Clone this page'];
  const wrap = $('suggs');
  wrap.innerHTML = '';
  s.slice(0, 4).forEach(text => {
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
function addHtmlMsg(who, html, cls) {
  const w = $('msgs').querySelector('.welcome'); if (w) w.remove();
  const d = document.createElement('div');
  d.className = 'msg ' + cls;
  d.innerHTML = `<div class="who">${who}</div><div class="bubble rich"></div>`;
  d.querySelector('.bubble').innerHTML = html;
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
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function attr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }

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
  const sys = context ? `You are Chinna, a friendly assistant embedded in the user's browser. The user is viewing this page:\nTitle: ${context.title}\nURL: ${context.url}\nContent:\n${context.text}\n\nAnswer conversationally and concisely. If this is a video or music page, use the live page metadata before asking for uploads.` : 'You are Chinna, a friendly browser assistant. Be concise and natural.';
  try {
    const r = await fetch(`${CHINNA}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: question, system: sys, page_context: context?.raw || null, source: 'extension' })
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
  const yt = r.youtube || {};
  const text = [
    `URL: ${r.url || ''}`,
    `Title: ${yt.title || r.title || ''}`,
    yt.videoId ? `Video ID: ${yt.videoId}` : '',
    yt.channel ? `Channel: ${yt.channel}` : '',
    yt.description ? `Video description: ${yt.description}` : '',
    yt.hashtags?.length ? `Tags: ${yt.hashtags.join(', ')}` : '',
    r.metaDesc,
    ...(r.headings||[]),
    ...(r.paras||[]),
    r.visibleText || ''
  ].filter(Boolean).join('\n').slice(0, 9000);
  return { title: r.title, url: r.url, text, raw: r };
}

async function apiJson(path, body) {
  const r = await fetch(`${CHINNA}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
  return d;
}

function renderAccousticaCard(taskId, initial) {
  const html = `
    <div class="acc-card" data-task="${attr(taskId)}">
      <div class="acc-top">
        <div>
          <div class="acc-kicker">ACCOUSTICA</div>
          <div class="acc-title">${attr(initial?.title || 'Generating audio')}</div>
        </div>
        <span class="acc-status">${attr(initial?.status || 'PENDING')}</span>
      </div>
      <div class="acc-body">Task ${attr(taskId)} is queued.</div>
      <div class="acc-player"></div>
      <div class="acc-actions">
        <button class="a-btn ghost refreshTask">Refresh</button>
        <button class="a-btn ghost copyTask">Copy ID</button>
      </div>
    </div>`;
  const node = addHtmlMsg('Chinna', html, 'ai').querySelector('.acc-card');
  node.querySelector('.copyTask').onclick = () => { navigator.clipboard.writeText(taskId); toast('Copied task ID'); };
  node.querySelector('.refreshTask').onclick = () => pollAccousticaOnce(taskId, node);
  return node;
}

function updateAccousticaCard(card, data) {
  if (!card || !data) return;
  card.querySelector('.acc-status').textContent = data.status || 'PENDING';
  const tracks = data.tracks || [];
  const track = tracks.find(t => t.audioUrl || t.streamAudioUrl) || tracks[0] || {};
  const playable = data.playableUrl || track.audioUrl || track.streamAudioUrl || '';
  const title = track.title || card.querySelector('.acc-title').textContent || 'Audio ready';
  card.querySelector('.acc-title').textContent = title;
  const body = card.querySelector('.acc-body');
  body.textContent = playable ? 'Audio ready. Final render may keep improving until SUCCESS.' : (data.failed ? 'Generation failed. Review the task status.' : 'Still processing...');
  if (playable && !card.dataset.readyUrl) {
    card.dataset.readyUrl = playable;
    const cover = track.imageUrl ? `<img class="acc-cover" src="${attr(track.imageUrl)}" alt="">` : '';
    card.querySelector('.acc-player').innerHTML = `
      ${cover}
      <audio controls src="${attr(playable)}"></audio>
      <div class="acc-actions">
        <a class="a-btn" href="${attr(playable)}" target="_blank" rel="noreferrer">Open</a>
        <a class="a-btn ghost" href="${attr(playable)}" download>Download</a>
        <button class="a-btn ghost playNow">Play</button>
      </div>`;
    const audio = card.querySelector('audio');
    const playButton = card.querySelector('.playNow');
    playButton.onclick = () => audio.play().catch(() => toast('Press Play in the audio player'));
    audio.play().then(() => toast('Audio ready')).catch(() => toast('Audio ready'));
  }
}

async function pollAccousticaOnce(taskId, card) {
  try {
    const r = await fetch(`${CHINNA}/api/music/accoustica/task?taskId=${encodeURIComponent(taskId)}`);
    const data = await r.json();
    updateAccousticaCard(card, data);
    return data;
  } catch (e) {
    toast('Could not check task');
    return { ok: false, error: String(e) };
  }
}

function scheduleAccousticaPolling(taskId, card) {
  setTimeout(() => {
    const started = Date.now();
    const timer = setInterval(async () => {
      const data = await pollAccousticaOnce(taskId, card);
      if (data.done || data.failed || Date.now() - started > 600000) {
        clearInterval(timer);
        if (!data.done && !data.failed) toast('Still processing. Use Refresh to check again.');
      }
    }, 1000);
  }, 5000);
}

async function handleAccousticaCommand(q, ctx) {
  if (!/accoustica/i.test(q)) return false;
  if (/check/i.test(q)) {
    const taskId = (q.match(/[a-zA-Z0-9_-]{8,}/)?.[0]) || lastAccousticaTaskId;
    if (!taskId) { addMsg('Chinna', 'No Accoustica task ID yet.', 'ai'); return true; }
    const card = renderAccousticaCard(taskId, { status: 'CHECKING' });
    await pollAccousticaOnce(taskId, card);
    return true;
  }
  if (/generate/i.test(q)) {
    const data = await apiJson('/api/music/accoustica/generate', { page_context: ctx?.raw || {}, message: q });
    lastAccousticaTaskId = data.taskId;
    localStorage.setItem('lastAccousticaTaskId', data.taskId);
    const card = renderAccousticaCard(data.taskId, data);
    scheduleAccousticaPolling(data.taskId, card);
    return true;
  }
  const prompt = await apiJson('/api/music/accoustica/prompt-from-page', { page_context: ctx?.raw || {}, message: q });
  addArtifact({
    badge: 'PROMPT',
    name: 'accoustica-prompt.txt',
    note: 'Accoustica prompt ready.',
    preview: prompt.prompt,
    content: prompt.prompt,
    mime: 'text/plain'
  });
  return true;
}

// ---------- Main send ----------
async function doSend() {
  const q = input.value.trim();
  if (!q) return;
  addMsg('You', q, 'me');
  input.value = ''; autoGrow();
  addTyping();
  const ctx = await getPageContext();
  try {
    if (await handleAccousticaCommand(q, ctx)) {
      rmTyping();
      return;
    }
  } catch (e) {
    rmTyping();
    addMsg('Chinna', e.message || 'Accoustica request failed.', 'ai');
    return;
  }
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
