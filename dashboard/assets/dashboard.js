/* suppress sandboxed-iframe errors + backend warnings */
(function(){
  try{var rs=history.replaceState.bind(history),ps=history.pushState.bind(history);
    history.replaceState=function(){try{rs.apply(history,arguments);}catch(e){}};
    history.pushState=function(){try{ps.apply(history,arguments);}catch(e){}};}catch(e){}
  function aa(a){return [].slice.call(a).map(function(x){return String(x||'');}).join(' ');}
  var ow=console.warn,oe=console.error;
  var B=['dashboard backend unreachable','backend unreachable','Failed to load projects','chinna dashboard'];
  function bl(a){var s=aa(a);return B.some(function(k){return s.indexOf(k)>-1;});}
  console.warn=function(){if(!bl(arguments))ow.apply(console,arguments);};
  console.error=function(){if(!bl(arguments))oe.apply(console,arguments);};
})();

"use strict";
const $ = id => document.getElementById(id);
const api = (p,opt) => fetch('/api/'+p,opt).then(r=>r.json());
const THEME_KEY = 'chinna_theme';
const ONBOARDING_KEY = 'chinna_macos_onboarded';
const MODEL_KEY = 'chinna_active_model';
const KEY_STORAGE = {
  openrouter: 'chinna_openrouter_key',
  openai: 'chinna_openai_key',
  telegram: 'chinna_telegram_token',
};
const DEFAULT_OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
let HOME_PATH = '~';
let allFiles=[], curTab='large', allApps=[], dupeSel=new Set(), allDupes=[];
let storStack=[], storState={path:'~', items:[], offset:0, hasMore:false, limit:40};
let chatHistory = [];   // full conversation memory for Chinna AI (sent to backend)
let aiAttachments = []; // current files staged for next message {name, mime, size, data_b64}
let deepCleanItems = [];
let deepCleanSelected = new Set();
let deepCleanVolume = null;
let deepCleanForce = false;
let chinnaPlugins = [];
let deepCleanForceRequired = new Set();
let keyStatus = { chinna_ai_set: false, openai_set: false };
let updateState = { latest: '', current: '', update_available: false, should_prompt: false, snoozed_until: 0, install_url: '', fresh_install_command: '', update_command: '', alerted_version: '', dismissed_version: '' };
let updatePollTimer = null;
let agentFiles = []; // Agent file uploads {name, mime, size, data}
let aiFiles = []; // AI chat file uploads {name, mime, size, data}
let chatxIdentity = null;
let chatxContacts = [];
let chatxPeer = null;
let chatxMessages = [];
let chatxPollTimer = null;
let chatxLastId = 0;
let chatxRelayLastIds = {};
let chatxPreview = { messageId: null, zoom: 1 };
let chatxSeenIncoming = new Set();
let chatxNotificationAsked = false;
let chatxCall = null;
let chatxPC = null;
let chatxLocalStream = null;
let chatxRemoteStream = null;
let chatxSignalQueue = [];
let chatxCallTick = null;
let chatxSpeakerMuted = false;
let chatxSignalSeen = new Set();
let chatxIncomingOffer = null;
let chatxRingtoneCtx = null;
let chatxRingtoneTimer = null;
let chatxQualityTimer = null;
let chatxLastStats = { at: 0, bytesSent: 0, bytesRecv: 0 };
let chatxRtcConfig = { turnEnabled: false, turnUrls: '', turnUsername: '', turnCredential: '' };
let chatxDevicePrefs = { micId: '', camId: '' };
let chatxCallLog = [];
let chatxInvitePayload = null;
let chatxRelayConfig = { url: '', defaultUrl: '' };
let waPollTimer = null;
let waSelectedJid = '';
let waChats = [];
let waMessages = [];
let currentModel = localStorage.getItem(MODEL_KEY) || DEFAULT_OPENROUTER_MODEL;

function safeStorageGet(key){
  try{ return localStorage.getItem(key) || ''; }catch(e){ return ''; }
}

function safeStorageSet(key, value){
  try{
    if(value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  }catch(e){}
}

function hydrateSavedKeyInputs(){
  const orKey = safeStorageGet(KEY_STORAGE.openrouter);
  const oaKey = safeStorageGet(KEY_STORAGE.openai);
  const tgKey = safeStorageGet(KEY_STORAGE.telegram);
  if($('onboard-or') && orKey && !$('onboard-or').value) $('onboard-or').value = orKey;
  if($('set-or') && orKey && !$('set-or').value) $('set-or').value = orKey;
  if($('onboard-oa') && oaKey && !$('onboard-oa').value) $('onboard-oa').value = oaKey;
  if($('set-oa') && oaKey && !$('set-oa').value) $('set-oa').value = oaKey;
  if($('tg-token') && tgKey && !$('tg-token').value) $('tg-token').value = tgKey;
}

function rememberSavedKeys(keys){
  if(keys.openrouter) safeStorageSet(KEY_STORAGE.openrouter, keys.openrouter);
  if(keys.openai) safeStorageSet(KEY_STORAGE.openai, keys.openai);
  if(keys.telegram) safeStorageSet(KEY_STORAGE.telegram, keys.telegram);
}

function setCurrentModel(model, persist=true){
  currentModel = model || DEFAULT_OPENROUTER_MODEL;
  if(persist) safeStorageSet(MODEL_KEY, currentModel);
  const act = $('model-active');
  if(act) act.textContent = currentModel;
  const pill = $('sidebarModelName');
  if(pill) pill.textContent = currentModel;
}

const MODEL_UI_GROUPS = [
  { title: 'chinna/auto', keys: ['auto'], order: ['auto'] },
  { title: 'chinna/free', keys: ['free_router', 'free', 'kimi26', 'qwen3coder_free', 'deepseek_r1_free', 'llama70'], order: ['free_router', 'kimi26', 'qwen3coder_free', 'deepseek_r1_free', 'llama70', 'free'] },
  { title: 'chinna/coding(free)', keys: ['qwen3coder_free', 'deepseek_v4_flash', 'qwen3coder'], order: ['deepseek_v4_flash', 'qwen3coder_free', 'qwen3coder'] },
  { title: 'chinna/reasoning', keys: ['reasoning', 'deepseek_r1', 'deepseek_v4_pro', 'claude_sonnet_latest', 'claude_haiku_latest', 'sonnet4', 'opus4', 'haiku4'], order: ['deepseek_v4_pro', 'claude_sonnet_latest', 'sonnet4', 'opus4', 'deepseek_r1', 'deepseek_r1_free', 'claude_haiku_latest', 'haiku4'] },
  { title: 'chinna/all-rounder', keys: ['small', 'gpt54mini', 'gemma'], order: ['gpt54mini', 'small', 'gemma'] },
];

const MODEL_UI_LABELS = {
  auto: 'Auto router',
  free_router: 'OpenRouter Free',
  free: 'Llama Free',
  kimi26: 'Kimi 2.6 Free',
  qwen3coder_free: 'Qwen3 Coder Free',
  deepseek_r1_free: 'DeepSeek R1 Free',
  llama70: 'Llama 3.3 Free',
  qwen3coder: 'Qwen3 Coder',
  deepseek_v4_flash: 'DeepSeek V4 Flash',
  reasoning: 'Claude 3.5 Sonnet',
  deepseek_r1: 'DeepSeek R1',
  deepseek_v4_pro: 'DeepSeek V4 Pro',
  claude_sonnet_latest: 'Claude Sonnet Latest',
  claude_haiku_latest: 'Claude Haiku Latest',
  sonnet4: 'Claude Sonnet 4',
  opus4: 'Claude Opus 4',
  haiku4: 'Claude Haiku 4',
  small: 'GPT-4o Mini',
  gpt54mini: 'GPT-5.4 Mini',
  gemma: 'Gemma 2 9B',
};

function renderModelPresetGroups(pres, presets){
  if(!pres) return;
  const used = new Set();
  const sections = [];
  const mkBtn = (key) => {
    used.add(key);
    const label = MODEL_UI_LABELS[key] || key;
    return `<button type="button" class="bigbtn" style="font-size:11px" onclick="setModelPreset('${key}')">${label}</button>`;
  };
  for(const group of MODEL_UI_GROUPS){
    const ordered = (group.order || group.keys).filter(k => presets[k] && group.keys.includes(k));
    const buttons = ordered.map(mkBtn);
    if(buttons.length){
      sections.push(`
        <section class="model-group">
          <div class="model-group-title">${group.title}</div>
          <div class="model-group-grid">${buttons.join('')}</div>
        </section>
      `);
    }
  }
  const rest = Object.keys(presets).filter(k => !used.has(k));
  if(rest.length){
    sections.push(`
      <section class="model-group">
        <div class="model-group-title">chinna/other</div>
        <div class="model-group-grid">${rest.map(mkBtn).join('')}</div>
      </section>
    `);
  }
  pres.innerHTML = sections.join('');
}

function applyTheme(theme, persist=true){
  const __alias = {dark:'obsidian', light:'solaris', macos:'aurora', oled:'obsidian'};
  let safe = __alias[theme] || theme;
  if(!['aurora','obsidian','nebula','solaris','synth'].includes(safe)) safe = 'aurora';
  document.documentElement.dataset.theme = safe;
  document.querySelectorAll('#themes button').forEach(b=>b.classList.toggle('on',b.dataset.t===safe));
  if(persist) localStorage.setItem(THEME_KEY, safe);
  setVoiceButton();
  updateThemeToggle();
}

function updateThemeToggle(){
  const btn = $('themeToggle');
  if(!btn) return;
  const dark = document.documentElement.dataset.theme === 'obsidian';
  btn.textContent = dark ? '☀' : '◐';
  btn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
}

function toggleDashboardTheme(){
  const dark = document.documentElement.dataset.theme === 'obsidian';
  applyTheme(dark ? 'solaris' : 'obsidian');
}

function showLaunchSplash(){
  const splash = $('launch-splash');
  if(!splash) return;
  splash.classList.add('on');
  window.setTimeout(()=>splash.classList.remove('on'), 1100);
}

function completeMacOnboarding(){
  localStorage.setItem(ONBOARDING_KEY, '1');
  go('overview');
}

function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;$('toasts').appendChild(t);setTimeout(()=>t.remove(),3500);}
function setUpdateOverlayVisible(on){
  const el = $('update-overlay');
  if(!el) return;
  el.style.display = on ? 'flex' : 'none';
}
function dismissUpdateOverlay(markSeen=true){
  setUpdateOverlayVisible(false);
  if(markSeen && updateState.latest) updateState.dismissed_version = updateState.latest;
}
function renderUpdateOverlay(info){
  updateState = Object.assign(updateState, info || {});
  const title = $('release-title');
  const subtitle = $('release-subtitle');
  const notes = $('release-notes');
  const fresh = $('release-fresh');
  const meta = $('release-meta');
  if(title) title.textContent = info.release_title || `Chinna v${info.latest || '—'} is available`;
  if(subtitle) subtitle.textContent = info.release_message || 'Your data, config, and API keys stay intact.';
  if(notes){
    const versionLine = info.current && info.latest ? `Current v${info.current} → latest v${info.latest}` : 'A newer version is ready.';
    notes.innerHTML = `
      <div>${escHtml(versionLine)}</div>
      <div class="meta-row">
        <span class="chip">Dashboard prompt</span>
        <span class="chip">Daemon toast</span>
        <span class="chip">Keys preserved</span>
      </div>
    `;
  }
  if(fresh) fresh.textContent = info.fresh_install_command || 'Fresh reinstall command will appear here.';
  if(meta){
    meta.innerHTML = `
      <span class="chip">Current: ${escHtml(info.current || '—')}</span>
      <span class="chip">Latest: ${escHtml(info.latest || '—')}</span>
      <span class="chip">${info.update_available ? 'Update available' : 'Up to date'}</span>
    `;
  }
}
async function loadUpdateState(forceToast=false){
  const info = await api('check-update').catch(()=>null);
  if(!info || !info.latest){
    setUpdateOverlayVisible(false);
    return null;
  }
  updateState = Object.assign(updateState, info);
  const shouldShow = !!info.update_available && !!info.should_prompt && updateState.dismissed_version !== info.latest;
  if(shouldShow){
    renderUpdateOverlay(info);
    setUpdateOverlayVisible(true);
    if(updateState.alerted_version !== info.latest || forceToast){
      toast(`${info.release_title || `Chinna v${info.latest}`} is ready`);
      updateState.alerted_version = info.latest;
    }
  }else if(!info.update_available){
    setUpdateOverlayVisible(false);
  }
  return info;
}
async function updateNow(fresh=false){
  const d = await api('update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:fresh?'fresh':'update',fresh})}).catch(()=>({error:'failed'}));
  if(d.error){ toast('Update failed: '+d.error); return; }
  toast(d.fresh ? 'Fresh reinstall started' : 'Update started');
  dismissUpdateOverlay();
}
async function laterUpdate(){
  const d = await api('update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'later',minutes:180})}).catch(()=>({error:'failed'}));
  if(d.error){ toast('Could not snooze update: '+d.error); return; }
  toast('Update snoozed for later');
  dismissUpdateOverlay();
}
async function copyFreshReinstallCommand(){
  const cmd = updateState.fresh_install_command || `curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | bash -s -- --fresh`;
  try{
    await navigator.clipboard.writeText(cmd);
    toast('Fresh reinstall command copied');
  }catch(e){
    toast('Copy failed: '+(e?.message||'clipboard unavailable'));
  }
}
function ficon(k){return {PDF:'📕',Video:'🎬',Audio:'🎵',Archive:'🗜',App:'📦','Disk Image':'💿',Installer:'📦',Code:'⌨',Data:'🗃',Image:'🖼',Doc:'📄',Sheet:'📊',Slides:'📽',Text:'📝'}[k]||'📄';}
function color(p){return p>85?'var(--red)':p>65?'var(--amber)':'var(--acc)';}
function fmtBytes(n){const x=Number(n||0);if(x>=1073741824)return (x/1073741824).toFixed(2)+' GB';if(x>=1048576)return (x/1048576).toFixed(1)+' MB';if(x>=1024)return Math.round(x/1024)+' KB';return x+' B';}
function escHtml(s){return String(s||'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}

// ═══════════════════════════════════════════════════════════════
// FILE UPLOAD HANDLERS for Agent & AI Chat
// ═══════════════════════════════════════════════════════════════
function agentHandleFiles(fileList) {
  const preview = $('agent-file-previews');
  Array.from(fileList).forEach(file => {
    if (file.size > 50 * 1024 * 1024) {
      toast('File too large: ' + file.name + ' (max 50MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      agentFiles.push({ name: file.name, mime: file.type, size: file.size, data: e.target.result });
      const chip = document.createElement('div');
      chip.className = 'agent-file-chip';
      chip.innerHTML = `<span>${escHtml(file.name)} (${fmtBytes(file.size)})</span><button onclick="agentRemoveFile('${escHtml(file.name)}')">\u00d7</button>`;
      preview.appendChild(chip);
    };
    reader.readAsDataURL(file);
  });
  $('agent-file-input').value = '';
}

function agentRemoveFile(name) {
  agentFiles = agentFiles.filter(f => f.name !== name);
  const preview = $('agent-file-previews');
  preview.innerHTML = '';
  agentFiles.forEach(f => {
    const chip = document.createElement('div');
    chip.className = 'agent-file-chip';
    chip.innerHTML = `<span>${escHtml(f.name)} (${fmtBytes(f.size)})</span><button onclick="agentRemoveFile('${escHtml(f.name)}')">\u00d7</button>`;
    preview.appendChild(chip);
  });
}

function aiHandleFiles(fileList) {
  const preview = $('ai-file-previews');
  Array.from(fileList).forEach(file => {
    if (file.size > 50 * 1024 * 1024) {
      toast('File too large: ' + file.name + ' (max 50MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      aiFiles.push({ name: file.name, mime: file.type, size: file.size, data: e.target.result });
      const chip = document.createElement('div');
      chip.className = 'agent-file-chip';
      chip.innerHTML = `<span>${escHtml(file.name)} (${fmtBytes(file.size)})</span><button onclick="aiRemoveFile('${escHtml(file.name)}')">\u00d7</button>`;
      preview.appendChild(chip);
    };
    reader.readAsDataURL(file);
  });
  $('ai-file-input').value = '';
}

function aiRemoveFile(name) {
  aiFiles = aiFiles.filter(f => f.name !== name);
  const preview = $('ai-file-previews');
  preview.innerHTML = '';
  aiFiles.forEach(f => {
    const chip = document.createElement('div');
    chip.className = 'agent-file-chip';
    chip.innerHTML = `<span>${escHtml(f.name)} (${fmtBytes(f.size)})</span><button onclick="aiRemoveFile('${escHtml(f.name)}')">\u00d7</button>`;
    preview.appendChild(chip);
  });
}

// ═══════════════════════════════════════════════════════════════
// ADVANCED CHINNA AI VOICE — full state machine + waveform + interrupt + continuous
// ═══════════════════════════════════════════════════════════════
let voiceEnabled=false, voiceState='idle', voiceRecognizer=null, voiceRecorder=null, voiceStream=null,
    voiceChunks=[], voiceTranscript='', voiceShouldSubmit=false, voiceLastSpace=0, voiceMode='speech',
    voiceContinuous=false, voiceAudioCtx=null, voiceAnalyser=null, voiceWaveRaf=null, voiceSpeakingUtterance=null,
    voiceListening=false; // legacy shim for any remaining references

function isTypingTarget(el){return !!el&&(el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.isContentEditable);}

function setVoiceButton(){
  const btn=$('voice-btn'); if(!btn) return;
  const oled = document.documentElement.dataset.theme==='oled';
  if(!voiceEnabled){
    btn.textContent='🎙 Voice Off';
    btn.classList.remove('on'); btn.style.cssText='';
    destroyVoiceUI();
    return;
  }
  btn.textContent = voiceState==='listening' ? '🎙 Listening' : 
                    voiceState==='speaking'  ? '🗣 Speaking' : 
                    voiceState==='thinking'  ? '🧠 Thinking' : '🎙 Voice On';
  btn.classList.add('on');
  if (oled){
    btn.style.background='transparent';
    btn.style.color='var(--acc)';
    btn.style.borderColor='rgba(var(--accr),.28)';
  } else {
    btn.style.background='rgba(var(--accr),.16)';
    btn.style.color='var(--acc)';
  }
}

function toggleVoiceMode(force){
  voiceEnabled = force === undefined ? !voiceEnabled : !!force;
  if (!voiceEnabled) {
    speechSynthesis.cancel();
    stopVoiceCaptureAdvanced(false);
    setVoiceState('idle');
    destroyVoiceUI();
    setVoiceButton();
    return;
  }
  ensureVoiceUI();
  setVoiceState('idle');
  setVoiceButton();
}

function ensureVoiceUI(){
  let ui = $('voice-ui');
  if (ui) return ui;

  const aiView = $('view-ai');
  const vbody = aiView.querySelector('.vbody');
  ui = document.createElement('div');
  ui.id = 'voice-ui';
  ui.innerHTML = `
    <div class="voice-orb" id="voice-orb"><div class="mic">🎙</div></div>
    <div class="voice-wave" id="voice-wave"></div>
    <div class="voice-state" id="voice-state">IDLE</div>
    <div class="voice-controls">
      <button type="button" class="bigbtn" id="voice-ptt" style="padding:8px 16px">Hold to Talk</button>
      <button type="button" class="bigbtn solid" id="voice-continuous">Continuous: Off</button>
      <button type="button" class="bigbtn danger" id="voice-interrupt" style="display:none">⏹ Interrupt</button>
    </div>
  `;
  vbody.insertBefore(ui, vbody.firstChild);

  // Wire controls
  const orb = $('voice-orb');
  const ptt = $('voice-ptt');
  const cont = $('voice-continuous');
  const intr = $('voice-interrupt');

  orb.onclick = () => {
    if (voiceState === 'speaking') interruptVoice();
    else if (voiceState === 'listening') stopVoiceCaptureAdvanced(true);
    else startVoiceCaptureAdvanced();
  };

  ptt.onmousedown = () => startVoiceCaptureAdvanced(true);
  ptt.onmouseup = ptt.onmouseleave = () => stopVoiceCaptureAdvanced(true);

  cont.onclick = () => {
    voiceContinuous = !voiceContinuous;
    cont.textContent = 'Continuous: ' + (voiceContinuous ? 'On' : 'Off');
    cont.style.background = voiceContinuous ? 'rgba(var(--accr),.22)' : '';
    if (voiceContinuous && voiceState === 'idle') startVoiceCaptureAdvanced();
  };

  intr.onclick = () => interruptVoice();

  // Create waveform bars
  const wave = $('voice-wave');
  wave.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
  return ui;
}

function destroyVoiceUI(){
  const ui=$('voice-ui'); if(ui) ui.remove();
  stopWaveform();
}

function setVoiceState(state, extraText=''){
  voiceState = state;
  const orb = $('voice-orb');
  const st  = $('voice-state');
  const intr = $('voice-interrupt');
  if (!orb || !st) return;

  orb.classList.remove('listening','speaking');
  if (state==='listening') orb.classList.add('listening');
  if (state==='speaking') orb.classList.add('speaking');

  st.textContent = state.toUpperCase() + (extraText ? ' · '+extraText : '');
  intr.style.display = (state==='speaking' || state==='listening') ? 'inline-block' : 'none';

  setVoiceButton();
}

function startWaveform(){
  stopWaveform();
  const wave = $('voice-wave'); if(!wave) return;
  const bars = wave.querySelectorAll('i');

  try{
    voiceAudioCtx = voiceAudioCtx || new (window.AudioContext||window.webkitAudioContext)();
    if (!voiceAnalyser){
      voiceAnalyser = voiceAudioCtx.createAnalyser();
      voiceAnalyser.fftSize = 64;
    }
    if (voiceStream){
      const src = voiceAudioCtx.createMediaStreamSource(voiceStream);
      src.connect(voiceAnalyser);
    }
  }catch(e){}

  const data = new Uint8Array(voiceAnalyser ? voiceAnalyser.frequencyBinCount : 16);

  function draw(){
    if (!voiceAnalyser) { 
      bars.forEach(b => b.style.height = (12 + Math.random()*22)+'px');
    } else {
      voiceAnalyser.getByteFrequencyData(data);
      bars.forEach((b,i) => {
        const v = data[i*2] || 12;
        b.style.height = Math.max(6, (v/255)*42) + 'px';
      });
    }
    voiceWaveRaf = requestAnimationFrame(draw);
  }
  wave.classList.add('listening');
  draw();
}

function stopWaveform(){
  if (voiceWaveRaf) cancelAnimationFrame(voiceWaveRaf);
  voiceWaveRaf = null;
  const wave = $('voice-wave');
  if (wave) wave.classList.remove('listening');
}

async function startVoiceCaptureAdvanced(manualHold=false){
  if (!voiceEnabled) { voiceEnabled=true; setVoiceButton(); }
  if (voiceState==='listening' || voiceState==='thinking') return;

  speechSynthesis.cancel(); // stop any previous speaking
  voiceTranscript = '';
  voiceShouldSubmit = false;
  setVoiceState('listening');

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SR) {
    voiceMode = 'speech';
    const rec = ensureVoiceRecognitionAdvanced();
    try { rec.start(); } catch(e){}
    startWaveform();
    return;
  }

  // Fallback to MediaRecorder + Whisper
  voiceMode = 'media';
  try{
    if (!voiceStream) voiceStream = await navigator.mediaDevices.getUserMedia({audio:true});
    voiceChunks = [];
    voiceRecorder = new MediaRecorder(voiceStream, {mimeType:'audio/webm'});
    voiceRecorder.ondataavailable = e => { if (e.data?.size) voiceChunks.push(e.data); };
    voiceRecorder.onstop = () => finishRecordedVoiceAdvanced();
    voiceRecorder.start();
    startWaveform();
  }catch(e){
    setVoiceState('idle');
    toast('Mic access failed');
  }
}

function stopVoiceCaptureAdvanced(shouldSubmit=false){
  voiceShouldSubmit = !!shouldSubmit;
  if (voiceRecognizer) { try{voiceRecognizer.stop();}catch(e){} }
  if (voiceRecorder && voiceRecorder.state !== 'inactive') { try{voiceRecorder.stop();}catch(e){} }
  stopWaveform();
  if (shouldSubmit) setVoiceState('thinking');
}

function ensureVoiceRecognitionAdvanced(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  if (voiceRecognizer) return voiceRecognizer;

  voiceRecognizer = new SR();
  voiceRecognizer.continuous = true;
  voiceRecognizer.interimResults = true;
  voiceRecognizer.lang = 'en-US';

  voiceRecognizer.onresult = ev => {
    let finalText = '';
    for (let i=ev.resultIndex; i<ev.results.length; i++){
      finalText += ev.results[i][0].transcript;
    }
    voiceTranscript = finalText.trim();
  };

  voiceRecognizer.onerror = () => {
    stopVoiceCaptureAdvanced(false);
    setVoiceState('idle');
  };

  voiceRecognizer.onend = () => {
    const text = voiceTranscript.trim();
    stopWaveform();
    if (voiceShouldSubmit && text){
      sendAI(text, true).then(() => {
        if (voiceContinuous && voiceEnabled) {
          setTimeout(() => startVoiceCaptureAdvanced(), 650);
        } else {
          setVoiceState('idle');
        }
      });
    } else {
      setVoiceState('idle');
    }
    voiceTranscript = '';
    voiceShouldSubmit = false;
  };
  return voiceRecognizer;
}

async function finishRecordedVoiceAdvanced(){
  stopWaveform();
  const submit = voiceShouldSubmit;
  voiceShouldSubmit = false;
  if (!submit) { setVoiceState('idle'); return; }

  setVoiceState('thinking');
  if (!voiceChunks.length){ setVoiceState('idle'); return; }

  const blob = new Blob(voiceChunks, {type:'audio/webm'});
  const audio = await blobToBase64(blob);

  try{
    const d = await api('voice/transcribe', {method:'POST', body:JSON.stringify({audio_b64:audio, mime_type:blob.type})});
    const text = (d.text||'').trim();
    if (text){
      await sendAI(text, true);
      if (voiceContinuous && voiceEnabled) {
        setTimeout(()=> startVoiceCaptureAdvanced(), 700);
      } else {
        setVoiceState('idle');
      }
    } else {
      setVoiceState('idle');
    }
  }catch(e){
    setVoiceState('idle');
    toast('Transcription failed');
  }
}

function interruptVoice(){
  speechSynthesis.cancel();
  if (voiceSpeakingUtterance) voiceSpeakingUtterance = null;
  stopWaveform();
  if (voiceState === 'speaking' || voiceState === 'listening'){
    setVoiceState('idle');
    // Immediately start listening again for natural flow
    setTimeout(() => startVoiceCaptureAdvanced(), 120);
  }
}

function blobToBase64(blob){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');
    r.onerror=()=>reject(r.error);
    r.readAsDataURL(blob);
  });
}
function appendChat(role,text){
  const row=document.createElement('div');
  row.className='row';
  row.style.gap = '10px';
  if(role==='user'){
    row.style.justifyContent='flex-end';
    const info=document.createElement('div');
    info.className='info';
    info.style.textAlign='right';
    const nm=document.createElement('div');
    nm.className='nm';
    nm.style.whiteSpace='pre-wrap';
    nm.textContent=text;
    info.appendChild(nm);
    row.appendChild(info);
    return row;
  }
  const fic=document.createElement('div');
  fic.className='fic';
  fic.textContent='✦';
  fic.style.background = 'rgba(var(--accr),.16)';
  const info=document.createElement('div');
  info.className='info';
  const nm=document.createElement('div');
  nm.className='nm';
  nm.style.whiteSpace='pre-wrap';
  nm.textContent=text;
  info.appendChild(nm);
  row.appendChild(fic);
  row.appendChild(info);
  return row;
}

async function clearAIHistory(){
  chatHistory = [];
  $('ai-msgs').innerHTML = '';
  try{ await api('chat/clear'); }catch(e){}
  toast('Conversation memory cleared');
}

/* ========== ATTACHMENTS (any file type) ========== */
function renderAttachments(){
  const container = $('ai-attachments');
  if(!container) return;
  container.innerHTML = '';
  aiAttachments.forEach((att, idx) => {
    const chip = document.createElement('div');
    chip.className = 'attachment-chip';
    chip.innerHTML = `
      <span>${att.mime?.startsWith('image/') ? '🖼' : att.name.endsWith('.pdf') ? '📕' : '📄'}</span>
      <span class="name" title="${att.name}">${att.name}</span>
      <span class="remove" onclick="removeAttachment(${idx})">×</span>
    `;
    container.appendChild(chip);
  });
}

function removeAttachment(index){
  aiAttachments.splice(index, 1);
  renderAttachments();
}

async function handleFiles(files){
  const list = Array.from(files);
  for(const file of list){
    if(file.size > 25 * 1024 * 1024){ // 25MB limit
      toast(`File too large: ${file.name}`);
      continue;
    }
    const data_b64 = await fileToBase64(file);
    aiAttachments.push({
      name: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      data_b64
    });
  }
  renderAttachments();
}

function fileToBase64(file){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function setupAttachmentUI(){
  const btn = $('ai-attach-btn');
  const input = $('ai-file-input');
  const msgs = $('ai-msgs');

  if(btn && input){
    btn.onclick = () => input.click();
    input.onchange = (e) => {
      handleFiles(e.target.files);
      input.value = '';
    };
  }

  // Drag & drop on chat area
  if(msgs){
    msgs.ondragover = e => { e.preventDefault(); msgs.style.outline='2px dashed var(--acc)'; };
    msgs.ondragleave = () => msgs.style.outline='';
    msgs.ondrop = e => {
      e.preventDefault();
      msgs.style.outline='';
      handleFiles(e.dataTransfer.files);
    };
  }
}
document.addEventListener('keydown',e=>{
  if(e.code==='Escape' && voiceEnabled){
    toggleVoiceMode(false);
    return;
  }
  if(e.code!=='Space' || e.repeat) return;
  if(isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
  const now=Date.now();
  if(voiceEnabled){
    e.preventDefault();
    if(voiceState !== 'listening') startVoiceCaptureAdvanced();
    return;
  }
  if(now-voiceLastSpace<350){
    e.preventDefault();
    voiceLastSpace=0;
    toggleVoiceMode(true);
  }else{
    voiceLastSpace=now;
  }
});
document.addEventListener('keyup',e=>{
  if(e.code!=='Space') return;
  if(voiceEnabled && (voiceState==='listening' || voiceState==='speaking') && !isTypingTarget(e.target)){
    e.preventDefault();
    stopVoiceCaptureAdvanced(true);
  }
});

/* nav */
function go(v){
  if(!$('view-'+v)) v='overview';
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('on'));
  $('view-'+v).classList.add('on');
  document.querySelectorAll('.navitem').forEach(x=>x.classList.toggle('on',x.dataset.v===v));
  if(v==='files')loadFiles();
  if(v==='dupes'&&!allDupes.length){}
  if(v==='apps')loadApps();
  if(v==='battery')loadBattery();
  if(v==='doctor')loadDoctor();
  if(v==='network')loadNet();
  if(v==='storage')loadStorage(HOME_PATH,false);
  if(v==='ai'){ loadAIStatus(); if(voiceEnabled) ensureVoiceUI(); setupAttachmentUI(); }
  if(v==='chatx'){ chatxInit(); }
  if(v==='whatsapp'){ waInit(); }
  if(v==='plugins'){ loadPlugins(); }
  if(v==='settings'){ loadTelegramStatus(); loadKeySettings(); }
  if(v==='onboarding'){ loadKeySettings(); }
  if(v==='projects') loadProjectsView();
  if(location.hash !== '#'+v) history.replaceState(null,'','#'+v);
}

/* themes */
$('themes').addEventListener('click',e=>{
  if(e.target.dataset.t){
    applyTheme(e.target.dataset.t);
  }
});

/* stats poll — resilient to backend restarts / downtime */
let pollTimer=null, pollDelay=2500, fails=0, lastWarn=0, wasOffline=false;
function scheduleNextPoll(){ if(pollTimer) clearTimeout(pollTimer); pollTimer=setTimeout(doPoll, pollDelay); }
async function doPoll(){
  try{
    const s=await api('stats');
    fails=0; pollDelay=2500;
    if(!s||!s.cpu){ scheduleNextPoll(); return; }
    HOME_PATH = s.home || HOME_PATH;
    $('v-cpu').textContent=(s.cpu.pct||0)+'%';
    $('v-ram').textContent=(s.memory?.pct||0)+'%';
    $('v-disk').textContent=(s.disk?.pct||0)+'%';
    $('v-batt').textContent=(s.battery?.pct||0)+'%';
    $('ov-host').textContent=`${s.os?.hostname||'Mac'} · macOS ${s.os?.version||''} · ${s.os?.arch||''}`;
    renderGauges(s); renderOvInfo(s); renderProc(s); renderRailProc(s); renderRailDisk(s); renderRailProjects();
    if(wasOffline){ document.body.classList.remove('offline'); wasOffline=false; }
  }catch(e){
    fails++;
    if(fails===1 || Date.now()-lastWarn>30000){
      console.warn('[chinna] dashboard backend unreachable on :7777 — run `chinna dashboard`');
      lastWarn=Date.now();
    }
    // exponential backoff up to 30s so we don't spam connection errors
    pollDelay = Math.min(30000, 2500 * Math.pow(2, Math.min(fails-1,5)));
    if(!wasOffline && fails>1){ document.body.classList.add('offline'); wasOffline=true; }
    // show placeholder in vitals after a few failures
    if(fails>2){
      $('v-cpu').textContent='—'; $('v-ram').textContent='—';
      $('v-disk').textContent='—'; $('v-batt').textContent='—';
    }
  }
  scheduleNextPoll();
}
function startStatsPoll(){ doPoll(); }
function gaugeSVG(pct,c){const r=36,C=2*Math.PI*r,off=C*(1-pct/100);
  return `<svg width="84" height="84"><circle cx="42" cy="42" r="${r}" stroke="rgba(255,255,255,.08)" stroke-width="7" fill="none"/><circle cx="42" cy="42" r="${r}" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}"/></svg>`;}
function renderGauges(s){
  const g=[['CPU',s.cpu?.pct||0,`${s.cpu?.cores||0} cores`],['RAM',s.memory?.pct||0,`${s.memory?.used||0}/${s.memory?.total||0} GB`],['DISK',s.disk?.pct||0,`${s.disk?.free||'?'} free`],['BATT',s.battery?.pct||0,s.battery?.charging?'charging':'on battery']];
  $('gauges').innerHTML=g.map(([l,p,m])=>`<div class="gauge"><div class="ring">${gaugeSVG(p,color(p))}<div class="num" style="color:${color(p)}">${p}</div></div><div class="lbl">${l}</div><div class="meta">${m}</div></div>`).join('');
}
function renderOvInfo(s){
  const i=[['Host',s.os?.hostname||'—'],['Uptime',s.uptime||'—'],['Chip',(s.os?.chip||'—').replace('Apple ','')],['IP',s.network?.ip||'—']];
  $('ov-info').innerHTML=i.map(([k,v])=>`<div class="infocard"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
  renderOverviewWidgets(s);
}
function renderOverviewWidgets(s){
  const deck = $('overview-widget-deck');
  if(!deck) return;
  const cpu = s.cpu?.pct || 0;
  const ram = s.memory?.pct || 0;
  const disk = s.disk?.pct || 0;
  const batt = s.battery?.pct || 0;
  const aiReady = keyStatus.chinna_ai_set || keyStatus.openai_set;
  deck.innerHTML = [
    ['Neural Core', aiReady ? 'Online' : 'Needs key', aiReady ? 'Agent, chat, extension ready' : 'Add OpenRouter or OpenAI', aiReady ? 'var(--green)' : 'var(--amber)', 'go("settings")'],
    ['Thermals', cpu + '%', `${s.cpu?.cores||0} cores active`, color(cpu), 'go("processes")'],
    ['Memory Field', ram + '%', `${s.memory?.used||0}/${s.memory?.total||0} GB`, color(ram), 'confirmAction("purge")'],
    ['Storage Mass', disk + '%', `${s.disk?.free||'?'} free`, color(disk), 'go("storage")'],
    ['Power Cell', batt + '%', s.battery?.charging ? 'charging' : 'on battery', color(100-batt), 'go("battery")']
  ].map(([name,value,meta,accent,action])=>`
    <button type="button" class="liquid-widget" onclick="${action}" style="--widget-accent:${accent}">
      <span class="lw-orbit"></span>
      <span class="lw-name">${name}</span>
      <span class="lw-value">${value}</span>
      <span class="lw-meta">${meta}</span>
    </button>
  `).join('');
}
function renderProc(s){
  $('proc-list').innerHTML=(s.processes||[]).map(p=>`<div class="row"><div class="fic">⚙</div><div class="info"><div class="nm">${(p.name.split('/').pop())}</div><div class="mt">PID ${p.pid} · CPU ${p.cpu.toFixed(1)}%</div></div><div class="sz" style="color:${color(p.mem)}">${p.mem.toFixed(1)}%</div><div class="acts"><button type="button" class="miniA danger" onclick="confirmKill(${p.pid},'${(p.name.split('/').pop()).replace(/'/g,'')}')">Kill</button></div></div>`).join('');
}
function renderRailProc(s){
  $('rail-proc').innerHTML=(s.processes||[]).slice(0,5).map(p=>`<div class="proc"><div class="pn">${p.name.split('/').pop()}</div><div class="pm" style="color:${color(p.mem)}">${p.mem.toFixed(1)}%</div></div>`).join('');
}
function renderRailDisk(s){
  $('rail-disk').innerHTML=(s.disk_breakdown||[]).slice(0,6).map(d=>`<div class="proc"><div class="pn">${d.path}</div><div class="pm">${d.size}</div></div>`).join('')||'<div style="font-size:11px;color:var(--t3);padding:6px">—</div>';
}

async function renderRailProjects(){
  try {
    const res = await api('projects');
    const projects = res.projects || [];
    const el = $('rail-projects');
    if (!el) return;

    if (!projects.length) {
      el.innerHTML = '<div style="font-size:10px;color:var(--t3);padding:6px 4px">No projects tracked yet.<br>Run projects with <code>chinna run</code></div>';
      return;
    }

    el.innerHTML = projects.slice(0, 7).map(p => {
      const isRunning = p.status === 'running';
      const statusColor = isRunning ? 'var(--green)' : 'var(--t3)';
      const shortPath = p.short_path || p.path;
      const hasUrl = p.url ? true : false;

      return `
        <div class="proj-card" style="padding:8px 10px;margin-bottom:5px;border:1px solid rgba(255,255,255,.07);border-radius:10px;cursor:pointer;transition:.1s;background:rgba(255,255,255,.02);position:relative"
             onclick="openProjectFolder('${p.path.replace(/'/g, "\\'")}')">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">
              <span style="color:${statusColor}">●</span> ${p.stack}
            </div>
            <div style="font-size:10px;opacity:.6">${p.port || ''}</div>
          </div>
          <div style="font-size:10px;opacity:.55;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${shortPath}
          </div>
          ${hasUrl ? `<div onclick="event.stopImmediatePropagation(); openProjectUrl('${p.url.replace(/'/g, "\\'")}');" style="position:absolute;top:6px;right:6px;font-size:10px;opacity:.7;background:rgba(0,0,0,.3);padding:1px 5px;border-radius:4px">URL</div>` : ''}
        </div>
      `;
    }).join('');

    // Also update the mini overview projects section
    renderOverviewProjects(projects);
  } catch(e) {
    console.warn('Failed to load projects for rail');
  }
}

function renderOverviewProjects(projects) {
  const el = $('overview-projects');
  if (!el) return;

  if (!projects || !projects.length) {
    el.innerHTML = '<div style="font-size:10px;color:var(--t3);padding:4px">No tracked projects yet</div>';
    return;
  }

  el.innerHTML = projects.slice(0, 4).map(p => {
    const short = p.short_path || p.path;
    const isRunning = p.status === 'running';
    return `
      <div onclick="openProjectActions('${p.path.replace(/'/g, "\\'")}', '${(p.url||'').replace(/'/g, "\\'")}', event)"
           style="padding:6px 8px;background:rgba(255,255,255,.03);border-radius:6px;border:1px solid rgba(255,255,255,.05);cursor:pointer">
        <div style="display:flex;justify-content:space-between;font-size:11px">
          <span style="color:${isRunning ? 'var(--green)' : 'var(--t3)'}">●</span>
          <span style="font-weight:600;opacity:.9">${p.stack}</span>
          <span style="opacity:.5">${p.port || ''}</span>
        </div>
        <div style="font-size:10px;opacity:.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">${short}</div>
      </div>
    `;
  }).join('');
}

let projectMenu = null;

async function openProjectActions(path, url, ev) {
  ev.stopPropagation();

  if (projectMenu) projectMenu.remove();

  projectMenu = document.createElement('div');
  projectMenu.style.cssText = `position:fixed;left:${ev.clientX}px;top:${ev.clientY}px;background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.4);z-index:999;padding:4px 0;font-size:12px;min-width:160px`;

  const items = [];

  if (path) {
    items.push({ text: '📁 Reveal in Finder', action: async () => {
      await api(`project/open-folder?path=${encodeURIComponent(path)}`);
    }});
  }
  if (url) {
    items.push({ text: '🌐 Open in Browser', action: async () => {
      await api(`project/open-url?url=${encodeURIComponent(url)}`);
    }});
  }

  items.push({ text: '────────────', action: null });

  items.push({ text: '🗑 Remove from Registry', action: async () => {
    if (confirm('Remove this project from registry?')) {
      await api('project', { method:'POST', body: JSON.stringify({path, action:'delete'}) });
      renderRailProjects();
      if ($('view-projects').classList.contains('on')) loadProjectsView();
    }
  }});

  items.push({ text: '📋 Copy Path', action: () => {
    navigator.clipboard.writeText(path).then(() => toast('Path copied'));
  }});

  if (url) {
    items.push({ text: '📋 Copy URL', action: () => {
      navigator.clipboard.writeText(url).then(() => toast('URL copied'));
    }});
  }

  projectMenu.innerHTML = items.map(item => {
    if (item.text.startsWith('─')) {
      return `<div style="height:1px;background:var(--line);margin:4px 0"></div>`;
    }
    return `<div class="proj-menu-item" style="padding:6px 14px;cursor:pointer;white-space:nowrap" data-action="true">${item.text}</div>`;
  }).join('');

  document.body.appendChild(projectMenu);

  // Attach click handlers
  Array.from(projectMenu.children).forEach((child, i) => {
    if (child.dataset.action) {
      child.onclick = async () => {
        projectMenu.remove();
        projectMenu = null;
        await items[i].action?.();
        renderRailProjects(); // refresh
      };
      child.onmouseenter = () => child.style.background = 'rgba(255,255,255,.08)';
      child.onmouseleave = () => child.style.background = '';
    }
  });

  // Close on outside click
  const closeHandler = (e) => {
    if (!projectMenu.contains(e.target)) {
      projectMenu?.remove();
      document.removeEventListener('click', closeHandler, true);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler, true), 10);
}

async function openProjectFolder(path) {
  if (!path) return;
  await api(`project/open-folder?path=${encodeURIComponent(path)}`);
}

async function openProjectUrl(url) {
  if (!url) return;
  await api(`project/open-url?url=${encodeURIComponent(url)}`);
}

/* ===== Full Projects View (Rich) ===== */
let allProjectsCache = [];
let projectsSort = { column: 'updated', dir: 'desc' }; // column + dir
let selectedProjects = new Set();
let projectsAgeFilter = 'all'; // all | 24h | 7d | older

// Restore sort from localStorage
try {
  const saved = localStorage.getItem('chinna_projects_sort');
  if (saved) projectsSort = JSON.parse(saved);
} catch(e){}

async function loadProjectsView() {
  const container = $('projects-list');
  if (!container) return;

  container.innerHTML = '<div class="spin"></div>';
  selectedProjects.clear();

  try {
    const res = await api('projects');
    allProjectsCache = (res.projects || []).map(p => {
      // Compute human duration since last run
      const ageSec = p.updated ? Math.floor(Date.now()/1000 - p.updated) : null;
      p.lastRunAge = ageSec ? formatDuration(ageSec) : '—';
      return p;
    });
    updateAgeFilterButtons();
    renderProjectsView();
  } catch(e) {
    container.innerHTML = '<div class="empty">Failed to load projects</div>';
  }
}

function formatDuration(seconds) {
  if (seconds < 60) return seconds + 's ago';
  if (seconds < 3600) return Math.floor(seconds/60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds/3600) + 'h ago';
  return Math.floor(seconds/86400) + 'd ago';
}

function setAgeFilter(filter) {
  projectsAgeFilter = filter;
  updateAgeFilterButtons();
  renderProjectsView();
}

function updateAgeFilterButtons() {
  ['all','24h','7d','older'].forEach(f => {
    const btn = $(`age-${f}`);
    if (btn) btn.style.background = (f === projectsAgeFilter) ? 'rgba(var(--accr),.2)' : '';
  });
}

function renderProjectsView() {
  const container = $('projects-list');
  const q = ($('proj-q')?.value || '').toLowerCase();

  if (!container) return;

  const now = Math.floor(Date.now()/1000);

  let filtered = allProjectsCache.filter(p => {
    if (!q) return true;
    const hay = (p.path + ' ' + p.stack + ' ' + (p.notes||'') + ' ' + (p.tags||[]).join(' ')).toLowerCase();
    return hay.includes(q);
  });

  // Age filtering
  if (projectsAgeFilter !== 'all') {
    filtered = filtered.filter(p => {
      if (!p.updated) return projectsAgeFilter === 'older';
      const age = now - p.updated;
      if (projectsAgeFilter === '24h') return age < 86400;
      if (projectsAgeFilter === '7d') return age < 86400*7;
      if (projectsAgeFilter === 'older') return age >= 86400*7;
      return true;
    });
  }

  // Sorting
  const {column, dir} = projectsSort;
  filtered.sort((a, b) => {
    let va = a[column], vb = b[column];
    if (column === 'updated') { va = a.updated || 0; vb = b.updated || 0; }
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });

  // Bulk action bar
  let html = `
    <div style="display:flex;gap:8px;align-items:center;padding:8px 12px;background:rgba(255,255,255,.03);border-radius:8px;margin-bottom:8px">
      <label style="display:flex;align-items:center;gap:6px;font-size:12px">
        <input type="checkbox" id="proj-select-all" onchange="toggleSelectAllProjects(this.checked)">
        Select all
      </label>
      <button type="button" class="miniA danger" onclick="bulkDeleteProjects()" style="display:${selectedProjects.size ? 'inline-block' : 'none'}">Delete Selected (${selectedProjects.size})</button>
      <button type="button" class="miniA" onclick="bulkAddTagPrompt()" style="display:${selectedProjects.size ? 'inline-block' : 'none'}">Add Tag to Selected</button>
      <button type="button" class="miniA" onclick="exportProjectsPDF()" style="margin-left:auto">Export PDF</button>
    </div>
  `;

  if (!filtered.length) {
    container.innerHTML = html + '<div class="empty"><div class="big">📁</div>No projects match</div>';
    return;
  }

  html += `<table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead>
      <tr style="border-bottom:1px solid var(--line)">
        <th style="width:28px"></th>
        <th onclick="sortProjectsBy('short_path')" style="cursor:pointer;text-align:left;padding:6px">Path ${projectsSort.column==='short_path' ? (projectsSort.dir==='asc'?'↑':'↓') : ''}</th>
        <th onclick="sortProjectsBy('stack')" style="cursor:pointer;text-align:left;padding:6px">Stack ${projectsSort.column==='stack' ? (projectsSort.dir==='asc'?'↑':'↓') : ''}</th>
        <th onclick="sortProjectsBy('port')" style="cursor:pointer;text-align:left;padding:6px">Port</th>
        <th onclick="sortProjectsBy('status')" style="cursor:pointer;text-align:left;padding:6px">Status</th>
        <th onclick="sortProjectsBy('updated')" style="cursor:pointer;text-align:left;padding:6px">Last Run ${projectsSort.column==='updated' ? (projectsSort.dir==='asc'?'↑':'↓') : ''}</th>
        <th style="text-align:left;padding:6px">Notes / Tags</th>
        <th style="width:160px"></th>
      </tr>
    </thead>
    <tbody>`;

  filtered.forEach(p => {
    const checked = selectedProjects.has(p.path) ? 'checked' : '';
    const tagsHtml = (p.tags || []).map(t => `<span class="chip" style="font-size:10px;padding:1px 5px;margin-right:3px" onclick="event.stopImmediatePropagation(); editProjectTags('${p.path.replace(/'/g, "\\'")}', event)">${t}</span>`).join('');
    const notesShort = p.notes ? (p.notes.length > 80 ? p.notes.slice(0,80)+'…' : p.notes) : '';
    const history = p.history || [];
    const historyHtml = history.length > 0 ? `
      <details style="margin-top:4px;font-size:10px">
        <summary style="cursor:pointer;opacity:.6">History (${history.length})</summary>
        ${history.map(h => `<div style="padding-left:8px;opacity:.6">${new Date(h.timestamp*1000).toLocaleString().slice(0,16)} — port ${h.port} — ${h.status}</div>`).join('')}
      </details>` : '';

    html += `
      <tr style="border-bottom:1px solid rgba(255,255,255,.04)">
        <td><input type="checkbox" ${checked} onchange="toggleProjectSelection('${p.path.replace(/'/g, "\\'")}', this.checked)"></td>
        <td style="padding:8px 6px;font-family:monospace;font-size:11px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.path}">${p.short_path}</td>
        <td style="padding:8px 6px">${p.stack}</td>
        <td style="padding:8px 6px">${p.port || '—'}</td>
        <td style="padding:8px 6px"><span style="color:${p.status==='running'?'var(--green)':'var(--t3)'}">●</span> ${p.status}</td>
        <td style="padding:8px 6px;white-space:nowrap">${p.lastRunAge || '—'}</td>
        <td style="padding:8px 6px">
          ${notesShort ? `<div style="opacity:.75;font-size:11px;margin-bottom:2px">${notesShort}</div>` : ''}
          <span onclick="editProjectTags('${p.path.replace(/'/g, "\\'")}', event)" style="cursor:pointer">
            ${tagsHtml || '<span style="opacity:.4">+ tags</span>'}
          </span>
          ${historyHtml}
        </td>
        <td style="padding:6px;text-align:right">
          <button type="button" class="miniA" onclick="openProjectActionsFromView('${p.path.replace(/'/g, "\\'")}', '${(p.url||'').replace(/'/g, "\\'")}')">Open</button>
          <button type="button" class="miniA" onclick="editProjectNote('${p.path.replace(/'/g, "\\'")}', '${(p.notes||'').replace(/'/g, "\\'")}')">Note</button>
          <button type="button" class="miniA danger" onclick="deleteProjectFromView('${p.path.replace(/'/g, "\\'")}', this)">×</button>
        </td>
      </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function sortProjectsBy(column) {
  if (projectsSort.column === column) {
    projectsSort.dir = projectsSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    projectsSort.column = column;
    projectsSort.dir = 'desc';
  }
  try {
    localStorage.setItem('chinna_projects_sort', JSON.stringify(projectsSort));
  } catch(e){}
  renderProjectsView();
}

function toggleProjectSelection(path, checked) {
  if (checked) selectedProjects.add(path);
  else selectedProjects.delete(path);
  // Re-render to update bulk bar visibility
  renderProjectsView();
}

function toggleSelectAllProjects(checked) {
  const q = ($('proj-q')?.value || '').toLowerCase();
  let visible = allProjectsCache;
  if (q) visible = visible.filter(p => (p.path + ' ' + p.stack).toLowerCase().includes(q));

  if (checked) {
    visible.forEach(p => selectedProjects.add(p.path));
  } else {
    visible.forEach(p => selectedProjects.delete(p.path));
  }
  renderProjectsView();
}

async function bulkDeleteProjects() {
  if (!selectedProjects.size) return;
  const deleteCount = selectedProjects.size;
  if (!confirm(`Delete ${selectedProjects.size} projects from registry?`)) return;

  const alsoClean = confirm('Also run clean_project on all selected folders?');

  for (const path of selectedProjects) {
    try {
      await api('project', { method:'POST', body: JSON.stringify({path, action:'delete'}) });
      if (alsoClean) {
        await api('clean', {method:'POST', body: JSON.stringify({path})}).catch(()=>{});
      }
    } catch(e){}
  }
  selectedProjects.clear();
  toast(`Deleted ${deleteCount} projects`);
  loadProjectsView();
  renderRailProjects();
}

async function bulkAddTagPrompt() {
  if (!selectedProjects.size) return;
  const tag = prompt('Tag to add to selected projects:');
  if (!tag) return;

  for (const path of selectedProjects) {
    try {
      const current = allProjectsCache.find(p => p.path === path);
      const tags = new Set(current?.tags || []);
      tags.add(tag.trim());
      await api('project', {
        method:'POST',
        body: JSON.stringify({ path, action:'update', tags: Array.from(tags) })
      });
    } catch(e){}
  }
  toast('Tags added');
  loadProjectsView();
  renderRailProjects();
}

async function addManualProject() {
  const path = $('manual-path')?.value?.trim();
  if (!path) { toast('Path is required'); return; }

  const payload = {
    path,
    action: 'update',
    stack: $('manual-stack')?.value?.trim() || 'unknown',
    port: $('manual-port')?.value?.trim() || null,
    url: $('manual-url')?.value?.trim() || null
  };

  try {
    await api('project', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    toast('Project added to registry');
    // Clear form
    ['manual-path','manual-stack','manual-port','manual-url'].forEach(id => { const el = $(id); if(el) el.value=''; });
    loadProjectsView();
    renderRailProjects();
  } catch(e) {
    toast('Failed to add project');
  }
}

function exportProjectsPDF() {
  const win = window.open('', '_blank');
  if (!win) { toast('Popup blocked'); return; }

  let content = `<h1>Chinna Projects Export</h1><p>${new Date().toLocaleString()}</p><table border="1" cellpadding="6" style="border-collapse:collapse">`;
  content += `<tr><th>Path</th><th>Stack</th><th>Port</th><th>Status</th><th>Last Active</th><th>Notes</th><th>Tags</th></tr>`;

  allProjectsCache.forEach(p => {
    const date = p.updated ? new Date(p.updated*1000).toLocaleString() : '';
    const tags = (p.tags||[]).join(', ');
    content += `<tr>
      <td>${p.short_path}</td>
      <td>${p.stack}</td>
      <td>${p.port||''}</td>
      <td>${p.status}</td>
      <td>${date}</td>
      <td>${(p.notes||'').replace(/</g,'&lt;')}</td>
      <td>${tags}</td>
    </tr>`;
  });

  content += `</table><p>Generated by Chinna V5</p>`;

  win.document.write(`
    <html><head><title>Chinna Projects</title>
    <style>body{font-family:-apple-system,sans-serif;padding:20px} table{width:100%} th{background:#f0f0f0}</style>
    </head><body>${content}</body></html>
  `);
  win.document.close();
  setTimeout(() => win.print(), 300);
}

async function editProjectTags(path, ev) {
  ev.stopPropagation();

  const current = allProjectsCache.find(p => p.path === path);
  const currentTags = (current?.tags || []).join(', ');

  const newTagsStr = prompt('Edit tags (comma separated):', currentTags);
  if (newTagsStr === null) return;

  const tags = newTagsStr.split(',').map(t => t.trim()).filter(Boolean);

  try {
    await api('project', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ path, action: 'update', tags })
    });
    toast('Tags updated');
    loadProjectsView();
    renderRailProjects();
  } catch(e) {
    toast('Failed to update tags');
  }
}

async function openProjectActionsFromView(path, url) {
  if (path) await api(`project/open-folder?path=${encodeURIComponent(path)}`);
  if (url && confirm('Open URL in browser too?')) {
    await api(`project/open-url?url=${encodeURIComponent(url)}`);
  }
}

async function editProjectNote(path, currentNote) {
  const newNote = prompt('Project notes:', currentNote || '');
  if (newNote === null) return;

  try {
    await api('project', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ path, action: 'update', notes: newNote })
    });
    toast('Note saved');
    loadProjectsView();
    renderRailProjects();
  } catch(e) {
    toast('Failed to save note');
  }
}

async function deleteProjectFromView(path, btnEl) {
  if (!confirm('Remove this project from registry?')) return;

  const alsoClean = confirm('Also run "clean project" on this folder? (recommended)');

  try {
    await api('project', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ path, action: 'delete' })
    });

    if (alsoClean) {
      // Trigger clean via existing mechanism (best effort)
      try {
        await api('clean', { method: 'POST', body: JSON.stringify({ path }) });
      } catch {}
    }

    toast('Project removed from registry');
    loadProjectsView();
    renderRailProjects();
  } catch(e) {
    toast('Delete failed');
  }
}

// Note: The main go() function already exists earlier. We just added the hook inside it above (in a previous edit).
// If the hook is missing, make sure this line exists inside the original go():
// if (v === 'projects') loadProjectsView();

/* files */
async function loadFiles(){
  const L=$('file-list');
  showProgressMessage(L, 'Scanning files…', curTab === 'large' ? 'Looking for files larger than 10MB' : 'Loading recent downloads');
  const sort=$('file-sort').value;
  const d=await api(`files?tab=${curTab}&sort=${sort}`);
  allFiles=d.files||[];$('file-count').textContent=`${d.count} files`;
  clearProgressMessage(L);
  renderFiles();
}
function filesTab(t,el){curTab=t;document.querySelectorAll('#file-tabs button').forEach(b=>b.classList.toggle('on',b===el));loadFiles();}
function renderFiles(){
  const q=($('file-q').value||'').toLowerCase();
  const f=allFiles.filter(x=>!q||x.name.toLowerCase().includes(q));
  const L=$('file-list');
  if(!f.length){L.innerHTML='<div class="empty"><div class="big">📂</div>No files found</div>';return;}
  L.innerHTML=f.map(x=>fileRow(x)).join('');
}
function fileRow(x){
  return `<div class="row"><div class="fic">${ficon(x.kind)}</div><div class="info"><div class="nm">${x.name}</div><div class="mt">${x.path}</div></div><span class="kindtag">${x.kind}</span><div class="sz">${x.size}</div><div class="acts"><button type="button" class="miniA" onclick="reveal('${esc(x.path)}')">Reveal</button><button type="button" class="miniA danger" onclick="confirmTrash('${esc(x.path)}','${esc(x.name)}')">Trash</button></div></div>`;
}
function esc(s){return (s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");}

/* dupes */
async function loadDupes(){
  const L=$('dupe-list'); 
  showProgressMessage(L, 'Finding duplicates…', 'Scanning by size then hashing content — this can take a while');
  dupeSel.clear();
  const d=await api('files?tab=dupes');allDupes=d.files||[];
  $('dupe-count').textContent=`${allDupes.length} duplicate files`;
  clearProgressMessage(L);
  if(!allDupes.length){L.innerHTML='<div class="empty"><div class="big">✓</div>No duplicates found</div>';$('dupe-del').style.display='none';return;}
  $('dupe-del').style.display='';
  let html='',lastG='';
  allDupes.forEach((x,i)=>{
    if(x.dupe_group!==lastG){lastG=x.dupe_group;html+=`<div class="rlabel" style="margin-top:8px">Group · ${x.size}</div>`;}
    html+=`<div class="row"><input type="checkbox" onchange="toggleDupe('${esc(x.path)}',this.checked)" style="width:18px;height:18px;accent-color:var(--acc)"><div class="fic">${ficon(x.kind)}</div><div class="info"><div class="nm">${x.name}</div><div class="mt">${x.path}</div></div><div class="sz">${x.size}</div><div class="acts"><button type="button" class="miniA" onclick="reveal('${esc(x.path)}')">Reveal</button></div></div>`;
  });
  L.innerHTML=html;
}
function toggleDupe(p,on){on?dupeSel.add(p):dupeSel.delete(p);$('dupe-del').textContent=`Delete selected (${dupeSel.size})`;}

/* apps */
async function loadApps(){
  const L=$('app-list');L.innerHTML='<div class="spin"></div>';
  const d=await api('apps');allApps=d.apps||[];$('app-count').textContent=`${allApps.length} apps`;renderApps();
}
function renderApps(){
  const q=($('app-q').value||'').toLowerCase();
  const a=allApps.filter(x=>!q||x.name.toLowerCase().includes(q));
  const L=$('app-list');
  if(!a.length){L.innerHTML='<div class="empty"><div class="big">📦</div>No apps</div>';return;}
  L.innerHTML=a.map(x=>`<div class="row"><div class="fic">📦</div><div class="info"><div class="nm">${x.name}</div><div class="mt">${x.path}</div></div><div class="sz">${x.size}</div><div class="acts"><button type="button" class="miniA danger" onclick="confirmUninstall('${esc(x.path)}','${esc(x.name)}')">Uninstall</button></div></div>`).join('');
}

/* battery / doctor / network */
async function loadBattery(){
  const d=await api('batteryhealth');
  $('batt-info').innerHTML=[['Cycle Count',d.cycles],['Condition',d.condition],['Max Capacity',d.max_capacity],['Charging',d.charging]].map(([k,v])=>`<div class="infocard"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
}
async function loadDoctor(){$('doc-out').textContent='Loading…';const d=await api('doctor');$('doc-out').textContent=d.result;}
async function genReport(){const d=await api('sysreport');$('doc-out').textContent=d.result+(d.saved?`\n\n✅ Saved to: ${d.saved}`:'');toast(d.saved?'Report saved to Desktop':'Report generated');}
async function loadNet(){$('net-out').textContent='Loading…';const d=await api('ports');$('net-out').textContent=d.result;}

/* storage explorer */
async function loadStorage(path,push=true,offset=0,append=false){
  const L=$('stor-list');
  if(!append) showProgressMessage(L, 'Exploring folder…', 'Reading directory contents');
  const target=path||HOME_PATH;
  const d=await api(`storage?path=${encodeURIComponent(target)}&limit=${storState.limit||40}&offset=${offset||0}`);
  const nextPath=d.path||target||HOME_PATH;
  if(push){
    if(!storStack.length || storStack[storStack.length-1]!==nextPath) storStack.push(nextPath);
  }else if(!storStack.length){
    storStack.push(nextPath);
  }
  HOME_PATH=nextPath||HOME_PATH;
  storState={path:nextPath,items:append?(storState.items||[]).concat(d.items||[]):(d.items||[]),offset:d.next_offset||0,hasMore:!!d.has_more,limit:d.limit||storState.limit||40};
  $('stor-path').textContent=nextPath;
  $('stor-count').textContent=`${d.count||storState.items.length} items`;
  $('stor-more').style.display=storState.hasMore?'':'none';
  clearProgressMessage(L);
  renderStorageList();
}
function renderStorageList(){
  const L=$('stor-list');
  const items=storState.items||[];
  if(!items.length){
    L.innerHTML='<div class="empty"><div class="big">▦</div>Empty</div>';
    $('stor-more').style.display='none';
    return;
  }
  const more=storState.hasMore?`<div class="loadmore"></div>`:'';
  L.innerHTML=items.map(x=>`<div class="row" ${x.is_dir?`onclick="loadStorage('${esc(x.path)}')" style="cursor:pointer"`:''}><div class="fic">${x.is_dir?'📁':'📄'}</div><div class="info"><div class="nm">${x.name}</div><div class="mt">${x.path}</div></div><div class="sz">${x.size}</div></div>`).join('')+more;
}
function loadMoreStorage(){if(storState.hasMore) loadStorage(storState.path,false,storState.offset,true);}
function storUp(){if(storStack.length>1){storStack.pop();loadStorage(storStack[storStack.length-1],false);}}

/* AI */
async function loadAIStatus(){
  const k=await api('get_keys');
  keyStatus = { chinna_ai_set: !!k.chinna_ai_set, openai_set: !!k.openai_set };
  $('ai-status').textContent=(k.chinna_ai_set||k.openai_set)?'Ready':'Add a key in Settings';
  setVoiceButton();
}
async function loadKeySettings(){
  const k = await api('get_keys').catch(()=>null);
  if(!k) return;
  keyStatus = { chinna_ai_set: !!k.chinna_ai_set, openai_set: !!k.openai_set };
  const statusText = k.chinna_ai_set && k.openai_set ? 'OpenRouter and OpenAI saved.' :
    k.chinna_ai_set ? 'OpenRouter saved. AI ready.' :
    k.openai_set ? 'OpenAI saved. AI ready.' :
    'No AI key saved yet.';
  if($('settings-ai-status')) $('settings-ai-status').textContent = statusText;
  if($('onboard-ai-status')) $('onboard-ai-status').textContent = statusText;
  if($('set-turn-enabled')) $('set-turn-enabled').checked = !!k.turn_enabled;
  if($('set-turn-urls')) $('set-turn-urls').value = k.turn_urls || '';
  if($('set-turn-user')) $('set-turn-user').value = k.turn_username || '';
  if($('set-turn-cred')) $('set-turn-cred').value = k.turn_credential || '';
  if($('set-chat-relay')) $('set-chat-relay').value = k.chat_relay_url || '';
  chatxRelayConfig = { url: k.chat_relay_url || '', defaultUrl: k.chat_default_relay_url || location.origin };
  if($('turn-test-status')) $('turn-test-status').textContent = (k.turn_enabled && (k.turn_urls||'').trim()) ? 'TURN ready. Run test.' : 'TURN not tested yet.';
  hydrateSavedKeyInputs();
}
async function loadTelegramStatus(){
  const d=await api('telegram/status');
  $('tg-bot').textContent=`Bot: ${d.bot_username?('@'+d.bot_username):'—'}`;
  $('tg-state').textContent=`State: ${d.paired?'paired':'not paired'}`;
  $('tg-link').innerHTML=d.pair_url?`Pair link: <span class="muted">${d.pair_url}</span>`:'Pair link appears after you generate a code.';
  if(d.qr_url){ $('tg-qr').src=d.qr_url; } else { $('tg-qr').removeAttribute('src'); }
  hydrateSavedKeyInputs();
}

// ===== SECURE CHAT (client-side E2E) =====
const CHATX_KEYS = {
  id: 'chinna_chatx_id',
  name: 'chinna_chatx_name',
  priv: 'chinna_chatx_priv_jwk',
  pub: 'chinna_chatx_pub_jwk',
  invite: 'chinna_chatx_invite_token',
  contacts: 'chinna_chatx_contacts',
  mediaPrefs: 'chinna_chatx_media_prefs',
  callLog: 'chinna_chatx_call_log'
};

function chatxUuid(){
  return 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
function chatxHash(str){
  let h=2166136261;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h,16777619);
  }
  return h>>>0;
}
function chatxRandomId(){
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return 'u' + Array.from(bytes, b => (b % 36).toString(36)).join('');
}
function chatxRandomToken(){
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, c=>({'+':'-','/':'_','=':''}[c]));
}
async function chatxSha256Hex(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text||'')));
  return Array.from(new Uint8Array(buf), b=>b.toString(16).padStart(2,'0')).join('');
}
function chatxRelayBase(){
  return (chatxRelayConfig.url || chatxRelayConfig.defaultUrl || location.origin).replace(/\/+$/,'');
}
function chatxRelayApi(path, opt){
  const base = chatxRelayBase();
  return chatxApiAt(base, path, opt);
}
function chatxApiAt(base, path, opt){
  const url = `${base}/api/${path.replace(/^\/+/,'')}`;
  return fetch(url, opt).then(r=>r.json());
}
function chatxEncodeInvite(payload){
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/[+/=]/g, c=>({'+':'-','/':'_','=':''}[c]));
}
function chatxDecodeInvite(raw){
  const value = String(raw||'').trim();
  if(!value) return null;
  if(value.startsWith('chinna://chat-invite?')){
    return Object.fromEntries(new URLSearchParams(value.split('?')[1]));
  }
  if(/^https?:\/\//i.test(value) && value.includes('chat_invite=')){
    const u = new URL(value);
    return chatxDecodeInvite(u.searchParams.get('chat_invite'));
  }
  if(value.startsWith('{')){
    return JSON.parse(value);
  }
  if(value.startsWith('chx1.')){
    const b64 = value.slice(5).replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  }
  return null;
}
function chatxQrUrl(data, size=220){
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;
}
function chatxAvatarData(id,size=64){
  const c=document.createElement('canvas');
  c.width=size; c.height=size;
  const x=c.getContext('2d');
  const h=chatxHash(id);
  const h1=h%360, h2=(h1+96)%360;
  const g=x.createLinearGradient(0,0,size,size);
  g.addColorStop(0,`hsl(${h1} 88% 58%)`);
  g.addColorStop(1,`hsl(${h2} 85% 40%)`);
  x.fillStyle='#0c1016';
  x.fillRect(0,0,size,size);
  const n=8, w=size/n;
  for(let r=0;r<n;r++){
    for(let c1=0;c1<n/2;c1++){
      const bit=((chatxHash(id+':'+r+':'+c1)>>((r+c1)%16))&1)===1;
      if(!bit) continue;
      x.fillStyle=g;
      x.fillRect(c1*w,r*w,w,w);
      x.fillRect((n-c1-1)*w,r*w,w,w);
      x.strokeStyle='rgba(255,255,255,.08)';
      x.strokeRect(c1*w+.5,r*w+.5,w-1,w-1);
      x.strokeRect((n-c1-1)*w+.5,r*w+.5,w-1,w-1);
    }
  }
  return c.toDataURL('image/png');
}

async function chatxEnsureIdentity(){
  if(chatxIdentity) return chatxIdentity;
  let id = localStorage.getItem(CHATX_KEYS.id);
  let name = localStorage.getItem(CHATX_KEYS.name);
  let priv = localStorage.getItem(CHATX_KEYS.priv);
  let pub = localStorage.getItem(CHATX_KEYS.pub);
  if(!id){
    id = chatxRandomId();
    localStorage.setItem(CHATX_KEYS.id,id);
  }
  if(!name){
    name = 'User-' + id.slice(-4);
    localStorage.setItem(CHATX_KEYS.name,name);
  }
  if(!priv || !pub){
    const kp = await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'}, true, ['deriveKey']);
    const privJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    const pubJwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
    priv = JSON.stringify(privJwk);
    pub = JSON.stringify(pubJwk);
    localStorage.setItem(CHATX_KEYS.priv, priv);
    localStorage.setItem(CHATX_KEYS.pub, pub);
  }
  let invite = localStorage.getItem(CHATX_KEYS.invite);
  if(!invite){
    invite = chatxRandomToken();
    localStorage.setItem(CHATX_KEYS.invite, invite);
  }
  chatxIdentity = { id, name, privJwk: JSON.parse(priv), pubJwk: JSON.parse(pub), invite };
  await chatxPublishInvite();
  return chatxIdentity;
}

async function chatxPublishInvite(){
  if(!chatxIdentity) return;
  const pubRaw = JSON.stringify(chatxIdentity.pubJwk);
  const fingerprint = (await chatxSha256Hex(pubRaw)).slice(0, 32);
  const inviteHash = await chatxSha256Hex(chatxIdentity.invite);
  chatxIdentity.fingerprint = fingerprint;
  chatxInvitePayload = {
    v: 1,
    type: 'chinna_secure_chat_invite',
    user_id: chatxIdentity.id,
    display_name: chatxIdentity.name,
    token: chatxIdentity.invite,
    relay_url: chatxRelayBase(),
    fingerprint
  };
  await chatxRelayApi('chat/register',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      user_id:chatxIdentity.id,
      display_name:chatxIdentity.name,
      public_key_jwk:chatxIdentity.pubJwk,
      invite_token_hash:inviteHash,
      relay_url:chatxRelayBase(),
      fingerprint
    })
  }).catch(()=>{});
  chatxRenderInviteCard();
}

function chatxLoadContacts(){
  try{ chatxContacts = JSON.parse(localStorage.getItem(CHATX_KEYS.contacts)||'[]'); }
  catch{ chatxContacts = []; }
}
function chatxSaveContacts(){
  localStorage.setItem(CHATX_KEYS.contacts, JSON.stringify(chatxContacts));
}
function chatxFmtSize(n){
  const x=Number(n||0);
  if(x>=1073741824) return (x/1073741824).toFixed(2)+' GB';
  if(x>=1048576) return (x/1048576).toFixed(2)+' MB';
  if(x>=1024) return Math.round(x/1024)+' KB';
  return x+' B';
}

function chatxLoadDevicePrefs(){
  try{
    const raw = JSON.parse(localStorage.getItem(CHATX_KEYS.mediaPrefs)||'{}');
    chatxDevicePrefs = {
      micId: String(raw.micId||''),
      camId: String(raw.camId||''),
    };
  }catch{
    chatxDevicePrefs = { micId:'', camId:'' };
  }
}

function chatxSaveDevicePrefs(){
  localStorage.setItem(CHATX_KEYS.mediaPrefs, JSON.stringify(chatxDevicePrefs));
}

function chatxLoadCallLog(){
  try{
    const arr = JSON.parse(localStorage.getItem(CHATX_KEYS.callLog)||'[]');
    chatxCallLog = Array.isArray(arr) ? arr : [];
  }catch{
    chatxCallLog = [];
  }
}

function chatxSaveCallLog(){
  localStorage.setItem(CHATX_KEYS.callLog, JSON.stringify(chatxCallLog.slice(0,20)));
}

function chatxLogCall(status, peerId, mode='voice', direction='incoming'){
  const item = {
    status: String(status||'missed'),
    peerId: String(peerId||''),
    mode: mode==='video' ? 'video' : 'voice',
    direction: direction==='outgoing' ? 'outgoing' : 'incoming',
    ts: Date.now(),
  };
  chatxCallLog.unshift(item);
  chatxCallLog = chatxCallLog.slice(0,20);
  chatxSaveCallLog();
  chatxRenderCallLog();
}

function chatxRenderCallLog(){
  const el = $('chatx-call-log');
  if(!el) return;
  if(!chatxCallLog.length){
    el.innerHTML = '<div style="font-size:10px;color:var(--t3);padding:4px">No call events yet.</div>';
    return;
  }
  el.innerHTML = chatxCallLog.slice(0,8).map(item=>{
    const name = chatxCallPeerName(item.peerId);
    const when = new Date(item.ts||Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const st = String(item.status||'missed');
    const tone = st==='answered' ? 'var(--green)' : (st==='declined' ? 'var(--amber)' : 'var(--red)');
    return `<div class="chatx-call-log-item"><strong>${escHtml(name)}</strong> · <span style="color:${tone}">${escHtml(st)}</span><br>${escHtml(item.mode||'voice')} · ${escHtml(item.direction||'incoming')} · ${escHtml(when)}</div>`;
  }).join('');
}

async function chatxRefreshMediaDevices(){
  const micSel = $('chatx-mic-select');
  const camSel = $('chatx-cam-select');
  if(!micSel || !camSel || !navigator.mediaDevices?.enumerateDevices) return;
  const devices = await navigator.mediaDevices.enumerateDevices().catch(()=>[]);
  const mics = devices.filter(d=>d.kind==='audioinput');
  const cams = devices.filter(d=>d.kind==='videoinput');
  micSel.innerHTML = `<option value="">Preferred microphone (default)</option>` + mics.map(d=>`<option value="${escHtml(d.deviceId)}">${escHtml(d.label||('Microphone '+d.deviceId.slice(0,6)))}</option>`).join('');
  camSel.innerHTML = `<option value="">Preferred camera (default)</option>` + cams.map(d=>`<option value="${escHtml(d.deviceId)}">${escHtml(d.label||('Camera '+d.deviceId.slice(0,6)))}</option>`).join('');
  micSel.value = mics.some(d=>d.deviceId===chatxDevicePrefs.micId) ? chatxDevicePrefs.micId : '';
  camSel.value = cams.some(d=>d.deviceId===chatxDevicePrefs.camId) ? chatxDevicePrefs.camId : '';
}

async function chatxApplyPreferredTrack(kind, deviceId){
  if(!chatxPC || !chatxLocalStream || !deviceId) return;
  const isAudio = kind==='audio';
  const sender = chatxPC.getSenders().find(s=>s.track && s.track.kind===kind);
  if(!sender) return;
  try{
    const stream = await navigator.mediaDevices.getUserMedia(isAudio ? {audio:{deviceId:{exact:deviceId}},video:false} : {audio:false,video:{deviceId:{exact:deviceId}}});
    const track = isAudio ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];
    if(!track) return;
    const old = isAudio ? chatxLocalStream.getAudioTracks()[0] : chatxLocalStream.getVideoTracks()[0];
    await sender.replaceTrack(track);
    if(old){
      chatxLocalStream.removeTrack(old);
      old.stop();
    }
    chatxLocalStream.addTrack(track);
    chatxAttachStreams();
    chatxSyncCallButtons();
  }catch(e){
    toast(`Unable to switch ${isAudio?'microphone':'camera'}: ${e?.message||'permission/device error'}`);
  }
}

function chatxChangePreferredMic(){
  chatxDevicePrefs.micId = String($('chatx-mic-select')?.value||'');
  chatxSaveDevicePrefs();
  if(chatxCall) chatxApplyPreferredTrack('audio', chatxDevicePrefs.micId);
}

function chatxChangePreferredCam(){
  chatxDevicePrefs.camId = String($('chatx-cam-select')?.value||'');
  chatxSaveDevicePrefs();
  if(chatxCall && chatxCall.mode==='video') chatxApplyPreferredTrack('video', chatxDevicePrefs.camId);
}

async function testTurnConnectivity(){
  if(typeof RTCPeerConnection === 'undefined'){
    toast('WebRTC is unavailable in this browser');
    return;
  }
  const btn = $('turn-test-btn');
  const out = $('turn-test-status');
  const enabled = !!$('set-turn-enabled')?.checked;
  const urls = chatxParseTurnUrls(($('set-turn-urls')?.value||'').trim());
  if(!enabled || !urls.length){
    if(out) out.textContent = 'Turn on TURN and add a URL.';
    return;
  }
  const username = ($('set-turn-user')?.value||'').trim();
  const credential = $('set-turn-cred')?.value || '';
  if(btn) btn.disabled = true;
  if(out) out.textContent = 'Testing TURN...';
  let pc = null;
  try{
    pc = new RTCPeerConnection({iceServers:[{urls, username, credential}], iceTransportPolicy:'relay'});
    pc.createDataChannel('turn-probe');
    let relayFound = false;
    let candidateSeen = false;
    pc.onicecandidate = ev => {
      if(!ev.candidate) return;
      candidateSeen = true;
      const line = String(ev.candidate.candidate||'');
      if(/ typ relay /i.test(line)) relayFound = true;
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await new Promise(r=>setTimeout(r, 6500));
    if(relayFound){
      if(out) out.textContent = 'TURN test passed.';
      toast('TURN relay reachable');
    }else if(candidateSeen){
      if(out) out.textContent = 'TURN test failed: no relay candidate.';
      toast('TURN relay unavailable');
    }else{
      if(out) out.textContent = 'TURN test failed: no candidates.';
      toast('TURN test failed: no candidates');
    }
  }catch(e){
    if(out) out.textContent = `TURN error: ${e?.message||'unknown error'}`;
    toast('TURN test failed');
  }finally{
    if(pc){
      try{ pc.close(); }catch{}
    }
    if(btn) btn.disabled = false;
  }
}

async function generateTurnCredentials(){
  const btn = $('turn-gen-btn');
  const out = $('turn-test-status');
  const turnUrls = ($('set-turn-urls')?.value||'').trim();
  if(btn) btn.disabled = true;
  if(out) out.textContent = 'Generating TURN creds...';
  try{
    const d = await api('turn/generate', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({turn_urls: turnUrls})
    });
    if(d.error) throw new Error(String(d.error));
    if($('set-turn-enabled')) $('set-turn-enabled').checked = true;
    if($('set-turn-user')) $('set-turn-user').value = d.turn_username || '';
    if($('set-turn-cred')) $('set-turn-cred').value = d.turn_credential || '';
    if($('set-turn-urls') && d.turn_urls) $('set-turn-urls').value = d.turn_urls;
    if(out) out.textContent = 'TURN creds ready.';
    toast(d.result || 'TURN credentials generated');
    await chatxLoadRtcConfig().catch(()=>{});
  }catch(e){
    if(out) out.textContent = `TURN creds failed: ${e?.message||'unknown error'}`;
    toast('TURN credential generation failed');
  }finally{
    if(btn) btn.disabled = false;
  }
}

function chatxCanNotify(){
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

function chatxRequestNotifications(){
  if(chatxNotificationAsked) return;
  chatxNotificationAsked = true;
  if(typeof Notification === 'undefined') return;
  if(Notification.permission !== 'default') return;
  Notification.requestPermission().catch(()=>{});
}

function chatxNotifyIncoming(m){
  const mid = Number(m?.id||0);
  if(!mid || chatxSeenIncoming.has(mid)) return;
  chatxSeenIncoming.add(mid);

  const sender = chatxContacts.find(c=>c.id===m.from_id)?.name || m.from_id || 'Unknown';
  const isActiveThread = chatxPeer===m.from_id && !document.hidden;
  if(isActiveThread) return;

  toast(`New message from ${sender}`);
  if(chatxCanNotify()){
    try{
      new Notification(`New Secure Chat message`, {
        body: `From ${sender}`,
        tag: `chatx-${mid}`,
        renotify: true
      });
    }catch{}
  }
}

function chatxParseTurnUrls(raw){
  const parts = String(raw||'').split(/[\n,\s]+/).map(x=>x.trim()).filter(Boolean);
  return parts.map(v => /^(turn:|turns:)/i.test(v) ? v : `turn:${v}`);
}

function chatxBuildIceServers(){
  const servers = [{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}];
  if(!chatxRtcConfig.turnEnabled) return servers;
  const urls = chatxParseTurnUrls(chatxRtcConfig.turnUrls);
  if(!urls.length) return servers;
  const turn = { urls };
  if(chatxRtcConfig.turnUsername) turn.username = chatxRtcConfig.turnUsername;
  if(chatxRtcConfig.turnCredential) turn.credential = chatxRtcConfig.turnCredential;
  servers.push(turn);
  return servers;
}

async function chatxLoadRtcConfig(){
  const k = await api('get_keys').catch(()=>null);
  chatxRtcConfig = {
    turnEnabled: !!k?.turn_enabled,
    turnUrls: String(k?.turn_urls||''),
    turnUsername: String(k?.turn_username||''),
    turnCredential: String(k?.turn_credential||''),
  };
}

function chatxSetIncomingModal(on, fromId='', mode='voice'){
  const box = $('chatx-incoming');
  if(!box) return;
  box.classList.toggle('on', !!on);
  if(on){
    $('chatx-incoming-head').textContent = `Incoming ${mode==='video'?'video':'voice'} call`;
    $('chatx-incoming-sub').textContent = `${chatxCallPeerName(fromId)} is calling you.`;
  }
  chatxSyncCallButtons();
}

function chatxRingPulse(){
  if(!chatxRingtoneCtx) return;
  const now = chatxRingtoneCtx.currentTime;
  const seq = [720, 960, 720];
  seq.forEach((freq, idx)=>{
    const osc = chatxRingtoneCtx.createOscillator();
    const gain = chatxRingtoneCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + idx * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.07, now + idx * 0.2 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.2 + 0.16);
    osc.connect(gain).connect(chatxRingtoneCtx.destination);
    osc.start(now + idx * 0.2);
    osc.stop(now + idx * 0.2 + 0.17);
  });
}

function chatxStartRingtone(){
  if(chatxRingtoneTimer) return;
  try{
    if(!chatxRingtoneCtx) chatxRingtoneCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(chatxRingtoneCtx.state === 'suspended') chatxRingtoneCtx.resume().catch(()=>{});
    chatxRingPulse();
    chatxRingtoneTimer = setInterval(chatxRingPulse, 1400);
  }catch{}
}

function chatxStopRingtone(){
  if(chatxRingtoneTimer){
    clearInterval(chatxRingtoneTimer);
    chatxRingtoneTimer = null;
  }
}

function chatxSetQualityText(text){
  const el = $('chatx-call-quality');
  if(el) el.textContent = text;
}

function chatxResetQuality(){
  if(chatxQualityTimer){
    clearInterval(chatxQualityTimer);
    chatxQualityTimer = null;
  }
  chatxLastStats = { at: 0, bytesSent: 0, bytesRecv: 0 };
  chatxSetQualityText('State: idle · Up: 0 kbps · Down: 0 kbps · Loss: 0.0% · RTT: —');
}

async function chatxUpdateQuality(){
  if(!chatxPC) return;
  const state = chatxPC.connectionState || 'new';
  let bytesSent = 0;
  let bytesRecv = 0;
  let lost = 0;
  let recv = 0;
  let rttMs = null;
  const stats = await chatxPC.getStats().catch(()=>null);
  if(stats){
    stats.forEach(rep=>{
      if(rep.type === 'outbound-rtp' && !rep.isRemote){
        bytesSent += Number(rep.bytesSent||0);
      }
      if(rep.type === 'inbound-rtp' && !rep.isRemote){
        bytesRecv += Number(rep.bytesReceived||0);
        lost += Number(rep.packetsLost||0);
        recv += Number(rep.packetsReceived||0);
      }
      if(rep.type === 'candidate-pair' && rep.state === 'succeeded' && rep.currentRoundTripTime != null){
        rttMs = Math.round(Number(rep.currentRoundTripTime) * 1000);
      }
    });
  }
  const now = Date.now();
  const dt = Math.max(0.001, (now - (chatxLastStats.at||now)) / 1000);
  const upKbps = chatxLastStats.at ? Math.max(0, ((bytesSent - chatxLastStats.bytesSent) * 8) / dt / 1000) : 0;
  const downKbps = chatxLastStats.at ? Math.max(0, ((bytesRecv - chatxLastStats.bytesRecv) * 8) / dt / 1000) : 0;
  chatxLastStats = { at: now, bytesSent, bytesRecv };
  const lossPct = (recv + lost) > 0 ? (lost * 100 / (recv + lost)) : 0;
  chatxSetQualityText(`State: ${state} · Up: ${Math.round(upKbps)} kbps · Down: ${Math.round(downKbps)} kbps · Loss: ${lossPct.toFixed(1)}% · RTT: ${rttMs==null?'—':(rttMs+' ms')}`);
}

function chatxStartQualityMonitor(){
  chatxResetQuality();
  chatxQualityTimer = setInterval(()=>{ chatxUpdateQuality().catch(()=>{}); }, 2000);
}

function chatxAcceptIncoming(){
  if(!chatxIncomingOffer) return;
  const pending = chatxIncomingOffer;
  chatxIncomingOffer = null;
  chatxStopRingtone();
  chatxSetIncomingModal(false);
  chatxAcceptOffer(pending.fromId, pending.payload);
}

function chatxRejectIncoming(){
  if(!chatxIncomingOffer) return;
  const pending = chatxIncomingOffer;
  chatxLogCall('declined', pending.fromId, pending.payload?.mode||'voice', 'incoming');
  chatxIncomingOffer = null;
  chatxStopRingtone();
  chatxSetIncomingModal(false);
  chatxSendSignal(pending.fromId,{t:'reject',call_id:pending.payload.call_id}).catch(()=>{});
}

function chatxCallPeerName(peerId){
  const peer = chatxContacts.find(c=>c.id===peerId);
  return peer?.name || peerId || 'Unknown';
}

function chatxFmtCallTime(sec){
  const s = Math.max(0, Number(sec||0));
  const mm = String(Math.floor(s/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return `${mm}:${ss}`;
}

function chatxResetTimer(){
  if(chatxCallTick){
    clearInterval(chatxCallTick);
    chatxCallTick = null;
  }
  const el = $('chatx-call-timer');
  if(el) el.textContent = '00:00';
}

function chatxStartTimer(){
  chatxResetTimer();
  chatxCallTick = setInterval(()=>{
    if(!chatxCall?.startedAt) return;
    const elapsed = Math.floor((Date.now()-chatxCall.startedAt)/1000);
    const el = $('chatx-call-timer');
    if(el) el.textContent = chatxFmtCallTime(elapsed);
  },1000);
}

function chatxCallStatus(text){
  const el = $('chatx-call-status');
  if(el) el.textContent = text;
}

function chatxSyncCallButtons(){
  const hasPeer = !!chatxPeer;
  const active = !!chatxCall;
  const pendingIncoming = !!chatxIncomingOffer;
  const voice = $('chatx-call-voice');
  const video = $('chatx-call-video');
  if(voice) voice.disabled = !hasPeer || active || pendingIncoming;
  if(video) video.disabled = !hasPeer || active || pendingIncoming;
  const mic = $('chatx-btn-mic');
  const cam = $('chatx-btn-cam');
  const spk = $('chatx-btn-spk');
  const share = $('chatx-btn-share');
  const end = $('chatx-btn-end');
  if(mic) mic.disabled = !active;
  if(cam) cam.disabled = !active;
  if(spk) spk.disabled = !active;
  if(share) share.disabled = !active;
  if(end) end.disabled = !active;

  const audioTrack = chatxLocalStream?.getAudioTracks?.()[0];
  const videoTrack = chatxLocalStream?.getVideoTracks?.()[0];
  if(mic) mic.textContent = audioTrack && audioTrack.enabled ? 'Mute Mic' : 'Unmute Mic';
  if(cam) cam.textContent = videoTrack && videoTrack.enabled ? 'Camera Off' : 'Camera On';
  if(spk) spk.textContent = chatxSpeakerMuted ? 'Unmute Speaker' : 'Mute Speaker';
}

function chatxSetCallPanel(on){
  const wrap = $('chatx-call-wrap');
  if(!wrap) return;
  wrap.classList.toggle('on', !!on);
  const ph = $('chatx-remote-placeholder');
  if(ph) ph.style.display = on ? 'none' : 'grid';
}

function chatxAttachStreams(){
  const lv = $('chatx-local-video');
  const rv = $('chatx-remote-video');
  if(lv) lv.srcObject = chatxLocalStream || null;
  if(rv){
    rv.srcObject = chatxRemoteStream || null;
    rv.muted = !!chatxSpeakerMuted;
  }
}

function chatxStopMedia(){
  if(chatxLocalStream){
    for(const t of chatxLocalStream.getTracks()) t.stop();
  }
  chatxLocalStream = null;
  chatxRemoteStream = null;
  chatxAttachStreams();
}

async function chatxPrepareLocalStream(mode){
  if(!navigator.mediaDevices?.getUserMedia){
    throw new Error('Media devices are unavailable in this browser.');
  }
  chatxStopMedia();
  const audioPref = chatxDevicePrefs.micId ? {deviceId:{exact:chatxDevicePrefs.micId}} : true;
  const videoPref = mode==='video'
    ? (chatxDevicePrefs.camId ? {deviceId:{exact:chatxDevicePrefs.camId}} : true)
    : false;
  try{
    chatxLocalStream = await navigator.mediaDevices.getUserMedia({audio:audioPref, video:videoPref});
  }catch(e){
    chatxLocalStream = await navigator.mediaDevices.getUserMedia({audio:true, video: mode==='video'});
    if(chatxDevicePrefs.micId || chatxDevicePrefs.camId){
      toast('Preferred media device unavailable, using system default');
    }
  }
  chatxAttachStreams();
  await chatxRefreshMediaDevices();
}

async function chatxSendSignal(peerId, signal){
  const me = await chatxEnsureIdentity();
  const peer = chatxContacts.find(x=>x.id===peerId);
  if(!peer?.pub) return;
  const payload = {
    __chatx_call:true,
    ...signal,
    sender: me.name,
    ts: Date.now()
  };
  const enc = await chatxEncrypt(peer.pub, payload);
  await chatxApiAt(peer.relay_url || chatxRelayBase(), 'chat/send',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      from_id:me.id,
      to_id:peer.id,
      iv_b64:enc.iv_b64,
      cipher_b64:enc.cipher_b64,
      meta:{call_signal:true,signal_type:signal.t||''}
    })
  }).catch(()=>{});
}

function chatxCreatePc(){
  if(chatxPC){
    try{ chatxPC.close(); }catch{}
  }
  chatxSignalQueue = [];
  chatxRemoteStream = new MediaStream();
  const pc = new RTCPeerConnection({iceServers: chatxBuildIceServers()});
  chatxStartQualityMonitor();
  if(chatxLocalStream){
    for(const t of chatxLocalStream.getTracks()) pc.addTrack(t, chatxLocalStream);
  }
  pc.ontrack = ev => {
    const stream = ev.streams?.[0];
    if(stream){
      chatxRemoteStream = stream;
    }else{
      for(const tr of ev.track ? [ev.track] : []) chatxRemoteStream.addTrack(tr);
    }
    chatxAttachStreams();
  };
  pc.onicecandidate = ev => {
    if(ev.candidate && chatxCall?.peerId){
      chatxSendSignal(chatxCall.peerId,{t:'ice',call_id:chatxCall.id,candidate:ev.candidate.toJSON?.()||ev.candidate}).catch(()=>{});
    }
  };
  pc.onconnectionstatechange = () => {
    const st = pc.connectionState;
    if(st==='connected'){
      if(chatxCall && !chatxCall.startedAt) chatxCall.startedAt = Date.now();
      if(chatxCall && !chatxCall.loggedAnswered){
        chatxCall.loggedAnswered = true;
        chatxLogCall('answered', chatxCall.peerId, chatxCall.mode||'voice', chatxCall.direction||'incoming');
      }
      chatxStartTimer();
      chatxUpdateQuality().catch(()=>{});
      chatxCallStatus(`In call with ${chatxCallPeerName(chatxCall?.peerId)}`);
      chatxSetCallPanel(true);
    }else if((st==='failed' || st==='disconnected') && chatxCall){
      chatxEndCall(false,false);
      toast('Call ended');
    }
  };
  chatxPC = pc;
  chatxAttachStreams();
  return pc;
}

async function chatxStartCall(mode){
  if(chatxCall){
    toast('A call is already active');
    return;
  }
  if(chatxIncomingOffer){
    toast('Please accept or reject the incoming call first');
    return;
  }
  if(typeof RTCPeerConnection === 'undefined'){
    toast('WebRTC calling is not supported in this browser');
    return;
  }
  if(!chatxPeer){
    toast('Select a contact first');
    return;
  }
  try{
    await chatxPrepareLocalStream(mode);
    const pc = chatxCreatePc();
    const callId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    chatxCall = {id:callId,peerId:chatxPeer,mode,status:'calling',startedAt:0,direction:'outgoing',loggedAnswered:false};
    chatxCallStatus(`Calling ${chatxCallPeerName(chatxPeer)}...`);
    chatxSetCallPanel(true);
    chatxSyncCallButtons();
    const offer = await pc.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:true});
    await pc.setLocalDescription(offer);
    await chatxSendSignal(chatxPeer,{t:'offer',call_id:callId,mode,sdp:offer.sdp});
  }catch(err){
    chatxStopMedia();
    chatxCall = null;
    chatxSyncCallButtons();
    toast(err?.message || 'Unable to start call');
  }
}

function chatxStartVoiceCall(){
  chatxStartCall('voice');
}

function chatxStartVideoCall(){
  chatxStartCall('video');
}

async function chatxAcceptOffer(fromId, payload){
  if(typeof RTCPeerConnection === 'undefined'){
    await chatxSendSignal(fromId,{t:'reject',call_id:payload.call_id});
    return;
  }
  if(chatxCall && chatxCall.id!==payload.call_id){
    await chatxSendSignal(fromId,{t:'busy',call_id:payload.call_id});
    return;
  }
  const contact = chatxContacts.find(c=>c.id===fromId);
  if(!contact) return;
  const mode = payload.mode==='video' ? 'video' : 'voice';
  chatxSelectPeer(fromId);
  try{
    await chatxPrepareLocalStream(mode);
    const pc = chatxCreatePc();
    chatxCall = {id:payload.call_id,peerId:fromId,mode,status:'connecting',startedAt:0,direction:'incoming',loggedAnswered:false};
    chatxCallStatus(`Connecting with ${chatxCallPeerName(fromId)}...`);
    chatxSetCallPanel(true);
    chatxSyncCallButtons();
    await pc.setRemoteDescription({type:'offer',sdp:payload.sdp});
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    for(const cand of chatxSignalQueue.splice(0)){
      try{ await pc.addIceCandidate(cand); }catch{}
    }
    await chatxSendSignal(fromId,{t:'answer',call_id:payload.call_id,sdp:answer.sdp});
  }catch(err){
    chatxEndCall(false,false);
    toast(err?.message || 'Unable to answer call');
  }
}

async function chatxHandleCallSignal(fromId, payload){
  if(!payload?.t) return;
  if(payload.t==='offer'){
    if(chatxCall && chatxCall.id!==payload.call_id){
      await chatxSendSignal(fromId,{t:'busy',call_id:payload.call_id});
      return;
    }
    if(chatxIncomingOffer && chatxIncomingOffer.payload?.call_id !== payload.call_id){
      await chatxSendSignal(fromId,{t:'busy',call_id:payload.call_id});
      return;
    }
    chatxIncomingOffer = { fromId, payload };
    chatxSetIncomingModal(true, fromId, payload.mode||'voice');
    chatxStartRingtone();
    return;
  }
  if(payload.t==='hangup' && chatxIncomingOffer?.payload?.call_id === payload.call_id){
    chatxLogCall('missed', fromId, payload.mode||chatxIncomingOffer?.payload?.mode||'voice', 'incoming');
    chatxIncomingOffer = null;
    chatxSetIncomingModal(false);
    chatxStopRingtone();
    return;
  }
  if(!chatxCall || chatxCall.id!==payload.call_id) return;
  if(payload.t==='answer'){
    if(chatxPC){
      await chatxPC.setRemoteDescription({type:'answer',sdp:payload.sdp});
      for(const cand of chatxSignalQueue.splice(0)){
        try{ await chatxPC.addIceCandidate(cand); }catch{}
      }
      chatxCallStatus(`Connecting with ${chatxCallPeerName(fromId)}...`);
    }
    return;
  }
  if(payload.t==='ice'){
    if(!payload.candidate) return;
    const cand = new RTCIceCandidate(payload.candidate);
    if(chatxPC?.remoteDescription){
      try{ await chatxPC.addIceCandidate(cand); }catch{}
    }else{
      chatxSignalQueue.push(cand);
    }
    return;
  }
  if(payload.t==='reject'){
    chatxIncomingOffer = null;
    chatxSetIncomingModal(false);
    chatxStopRingtone();
    chatxLogCall('declined', fromId, chatxCall?.mode||'voice', 'outgoing');
    toast(`${chatxCallPeerName(fromId)} declined the call`);
    chatxEndCall(false,false);
    return;
  }
  if(payload.t==='busy'){
    chatxIncomingOffer = null;
    chatxSetIncomingModal(false);
    chatxStopRingtone();
    chatxLogCall('declined', fromId, chatxCall?.mode||'voice', 'outgoing');
    toast(`${chatxCallPeerName(fromId)} is busy`);
    chatxEndCall(false,false);
    return;
  }
  if(payload.t==='hangup'){
    chatxEndCall(false,false);
    toast('Call ended');
  }
}

async function chatxToggleMic(){
  const tr = chatxLocalStream?.getAudioTracks?.()[0];
  if(!tr) return;
  tr.enabled = !tr.enabled;
  chatxSyncCallButtons();
}

async function chatxToggleCamera(){
  const tr = chatxLocalStream?.getVideoTracks?.()[0];
  if(!tr){
    toast('Camera is unavailable in this call mode');
    return;
  }
  tr.enabled = !tr.enabled;
  chatxSyncCallButtons();
}

function chatxToggleSpeaker(){
  chatxSpeakerMuted = !chatxSpeakerMuted;
  const rv = $('chatx-remote-video');
  if(rv) rv.muted = chatxSpeakerMuted;
  chatxSyncCallButtons();
}

async function chatxToggleScreenShare(){
  if(!chatxPC) return;
  const sender = chatxPC.getSenders().find(s=>s.track && s.track.kind==='video');
  if(!sender){
    toast('Enable video call to share screen');
    return;
  }
  try{
    const ds = await navigator.mediaDevices.getDisplayMedia({video:true});
    const track = ds.getVideoTracks()[0];
    if(!track) return;
    track.onended = async () => {
      const cam = chatxLocalStream?.getVideoTracks?.()[0];
      if(cam){
        try{ await sender.replaceTrack(cam); }catch{}
      }
      chatxSyncCallButtons();
    };
    await sender.replaceTrack(track);
    chatxSyncCallButtons();
  }catch{}
}

function chatxFullscreenRemote(){
  const stage = $('chatx-call-stage');
  if(stage?.requestFullscreen) stage.requestFullscreen().catch(()=>{});
}

async function chatxEndCall(notifyPeer=true, toastDone=true){
  const prev = chatxCall;
  chatxCall = null;
  chatxIncomingOffer = null;
  chatxSetIncomingModal(false);
  chatxStopRingtone();
  chatxResetTimer();
  chatxResetQuality();
  if(notifyPeer && prev?.peerId && prev?.id){
    await chatxSendSignal(prev.peerId,{t:'hangup',call_id:prev.id});
  }
  if(chatxPC){
    try{ chatxPC.close(); }catch{}
  }
  chatxPC = null;
  chatxSignalQueue = [];
  chatxStopMedia();
  chatxSetCallPanel(false);
  chatxCallStatus('Call idle');
  chatxSyncCallButtons();
  if(toastDone && prev) toast('Call ended');
}

async function chatxInit(){
  await loadKeySettings().catch(()=>{});
  const me = await chatxEnsureIdentity();
  await chatxLoadRtcConfig();
  chatxLoadDevicePrefs();
  chatxLoadCallLog();
  chatxLoadContacts();
  chatxRequestNotifications();
  $('chatx-name').textContent = me.name;
  $('chatx-id').textContent = me.id;
  const img=chatxAvatarData(me.id);
  const ctx=$('chatx-avatar').getContext('2d');
  const i=new Image();
  i.onload=()=>ctx.drawImage(i,0,0,44,44);
  i.src=img;
  renderChatxContacts();
  chatxRenderCallLog();
  chatxIncomingOffer = null;
  chatxSetIncomingModal(false);
  chatxStopRingtone();
  chatxSetCallPanel(false);
  chatxSyncCallButtons();
  await chatxRefreshMediaDevices();
  if(navigator.mediaDevices && !chatxInit._deviceHooked){
    navigator.mediaDevices.addEventListener('devicechange', ()=>{ chatxRefreshMediaDevices().catch(()=>{}); });
    chatxInit._deviceHooked = true;
  }
  if(!chatxPollTimer){
    chatxPollTimer = setInterval(chatxPoll, 1200);
  }
  const fi=$('chatx-file');
  if(fi){ fi.onchange=()=>toast(fi.files?.[0]?`Attached ${fi.files[0].name}`:''); }
}

function chatxInviteString(){
  if(!chatxInvitePayload) return '';
  return 'chx1.' + chatxEncodeInvite(chatxInvitePayload);
}

function chatxRenderInviteCard(){
  if(!chatxInvitePayload) return;
  const invite = chatxInviteString();
  const qr = $('chatx-invite-qr');
  if(qr) qr.src = chatxQrUrl(invite, 240);
  if($('chatx-fingerprint')) $('chatx-fingerprint').textContent = `Key ${chatxInvitePayload.fingerprint}`;
  if($('chatx-relay-label')) $('chatx-relay-label').textContent = `Relay: ${chatxInvitePayload.relay_url || 'this Mac'}`;
}

function renderChatxContacts(){
  const el=$('chatx-contacts');
  if(!el) return;
  if(!chatxContacts.length){
    el.innerHTML='<div style="font-size:11px;color:var(--t3);padding:8px">No contacts yet.</div>';
    return;
  }
  el.innerHTML = chatxContacts.map(c=>`
    <div onclick="chatxSelectPeer('${esc(c.id)}')" style="display:flex;gap:8px;align-items:center;padding:7px;border-radius:8px;cursor:pointer;background:${chatxPeer===c.id?'rgba(var(--accr),.16)':'transparent'};margin-bottom:4px">
      <img src="${chatxAvatarData(c.id,40)}" style="width:28px;height:28px;border-radius:7px;border:1px solid var(--line)">
      <div style="min-width:0"><div style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.name||c.id)}</div><div style="font-size:10px;color:var(--t3)">${escHtml(c.id)}</div></div>
    </div>
  `).join('');
}

async function chatxAddContact(){
  const me = await chatxEnsureIdentity();
  const raw = ($('chatx-add-id').value||'').trim();
  if(!raw){
    toast('Paste an invite or friend ID');
    return;
  }
  let invite = null;
  try{ invite = chatxDecodeInvite(raw); }catch{}
  const pid = invite?.user_id || raw;
  const relay = (invite?.relay_url || chatxRelayBase()).replace(/\/+$/,'');
  const token = invite?.token || '';
  const d = await chatxApiAt(relay, `chat/user?id=${encodeURIComponent(pid)}&token=${encodeURIComponent(token)}`).catch(()=>({error:'User not found'}));
  if(d.error){
    const err = String(d.error).toLowerCase();
    if(err.includes('invite token')){
      toast('Invite token required. Ask your contact to share their Secure Chat QR/link.');
    }else if(err.includes('user not found')){
      toast('User not found on this relay. Ask your contact to open Secure Chat and share the invite QR/link.');
    }else{
      toast(d.error);
    }
    return;
  }
  if(!chatxContacts.find(x=>x.id===d.id)){
    chatxContacts.push({id:d.id,name:d.display_name||d.id,pub:d.public_key_jwk,relay_url:relay,fingerprint:d.fingerprint||invite?.fingerprint||''});
    chatxSaveContacts();
  }
  const myPubRaw = JSON.stringify(me.pubJwk);
  await chatxApiAt(relay, 'chat/register',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      user_id:me.id,
      display_name:me.name,
      public_key_jwk:me.pubJwk,
      invite_token_hash:await chatxSha256Hex(me.invite),
      relay_url:chatxRelayBase(),
      fingerprint:(await chatxSha256Hex(myPubRaw)).slice(0,32)
    })
  }).catch(()=>{});
  await chatxApiAt(relay, 'chat/add-contact',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({user_id:me.id,peer_id:d.id})
  }).catch(()=>{});
  $('chatx-add-id').value='';
  renderChatxContacts();
  chatxSelectPeer(d.id);
}

function chatxSelectPeer(id){
  if(chatxCall && chatxCall.peerId!==id){
    toast('Finish the active call before switching contact');
    return;
  }
  chatxPeer=id;
  renderChatxContacts();
  const c=chatxContacts.find(x=>x.id===id);
  $('chatx-peer-title').textContent=c?`Chat with ${c.name}`:'Chat';
  chatxSyncCallButtons();
  chatxLoadHistory();
}

async function chatxDeriveAes(peerPubJwk){
  const me = await chatxEnsureIdentity();
  const priv = await crypto.subtle.importKey('jwk', me.privJwk, {name:'ECDH',namedCurve:'P-256'}, false, ['deriveKey']);
  const pub = await crypto.subtle.importKey('jwk', peerPubJwk, {name:'ECDH',namedCurve:'P-256'}, false, []);
  return crypto.subtle.deriveKey({name:'ECDH',public:pub}, priv, {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
}
function b64FromBuf(buf){
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function bufFromB64(b64){
  const s=atob(b64);
  const a=new Uint8Array(s.length);
  for(let i=0;i<s.length;i++) a[i]=s.charCodeAt(i);
  return a.buffer;
}

async function chatxEncrypt(peerPubJwk, payload){
  const key = await chatxDeriveAes(peerPubJwk);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, data);
  return { iv_b64:b64FromBuf(iv), cipher_b64:b64FromBuf(cipher) };
}

async function chatxDecrypt(peerPubJwk, iv_b64, cipher_b64){
  const key = await chatxDeriveAes(peerPubJwk);
  const plain = await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(bufFromB64(iv_b64))}, key, bufFromB64(cipher_b64));
  return JSON.parse(new TextDecoder().decode(plain));
}

async function chatxSend(){
  const me = await chatxEnsureIdentity();
  const peer = chatxContacts.find(x=>x.id===chatxPeer);
  if(!peer){
    toast('Select a contact');
    return;
  }
  const text = ($('chatx-input').value||'').trim();
  const f = $('chatx-file').files?.[0];
  if(!text && !f) return;

  let file=null;
  if(f){
    file = await new Promise((res,rej)=>{
      const r=new FileReader();
      r.onload=()=>res({name:f.name,mime:f.type||'application/octet-stream',size:f.size,data_b64:String(r.result).split(',')[1]});
      r.onerror=rej;
      r.readAsDataURL(f);
    });
  }

  const payload = { text, file, sender: me.name, ts: Date.now() };
  const enc = await chatxEncrypt(peer.pub, payload);
  const s = await chatxApiAt(peer.relay_url || chatxRelayBase(), 'chat/send',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({from_id:me.id,to_id:peer.id,iv_b64:enc.iv_b64,cipher_b64:enc.cipher_b64,meta:{has_file:!!file,file_name:file?.name||''}})
  });
  if(!s.error){
    $('chatx-input').value='';
    $('chatx-file').value='';
    await chatxLoadHistory();
  }
}

async function chatxPoll(){
  if(!chatxIdentity) return;
  const relays = [...new Set([chatxRelayBase(), ...chatxContacts.map(c=>c.relay_url).filter(Boolean).map(x=>x.replace(/\/+$/,''))])];
  let plainIncoming = [];
  let notifyIncoming = [];
  for(const relay of relays){
    const prevLastId = Number(chatxRelayLastIds[relay] || 0);
    const d = await chatxApiAt(relay, `chat/poll?user_id=${encodeURIComponent(chatxIdentity.id)}&since_id=${prevLastId}`).catch(()=>null);
    if(!d || d.error) continue;

    const incoming = (d.messages||[]).filter(m=>{
      const mid = Number(m?.id||0);
      return mid > prevLastId && m.to_id===chatxIdentity.id && m.from_id!==chatxIdentity.id;
    });
    chatxRelayLastIds[relay] = Math.max(prevLastId, Number(d.last_id||0));
    chatxLastId = Math.max(chatxLastId, chatxRelayLastIds[relay]);

    for(const m of incoming){
      const mid = Number(m?.id||0);
      const signalKey = `${relay}:${mid}`;
      if(!mid || chatxSignalSeen.has(signalKey)) continue;
      chatxSignalSeen.add(signalKey);
      const peer = chatxContacts.find(c=>c.id===m.from_id);
      if(!peer?.pub){
        plainIncoming.push(m);
        if(prevLastId > 0) notifyIncoming.push(m);
        continue;
      }
      let payload = null;
      try{ payload = await chatxDecrypt(peer.pub, m.iv_b64, m.cipher_b64); }catch{}
      if(payload?.__chatx_call){
        await chatxHandleCallSignal(m.from_id, payload);
      }else{
        plainIncoming.push(m);
        if(prevLastId > 0) notifyIncoming.push(m);
      }
    }
  }

  if(notifyIncoming.length){
    notifyIncoming.slice(-6).forEach(chatxNotifyIncoming);
  }
  if(chatxPeer) await chatxLoadHistory();
}

async function chatxLoadHistory(){
  if(!chatxPeer || !chatxIdentity) return;
  const peer = chatxContacts.find(x=>x.id===chatxPeer);
  if(!peer) return;
  const d = await chatxApiAt(peer.relay_url || chatxRelayBase(), `chat/history?user_id=${encodeURIComponent(chatxIdentity.id)}&peer_id=${encodeURIComponent(chatxPeer)}&limit=240`).catch(()=>({messages:[]}));
  const msgs=[];
  for(const m of (d.messages||[])){
    try{
      const payload = await chatxDecrypt(peer.pub, m.iv_b64, m.cipher_b64);
      if(payload?.__chatx_call) continue;
      msgs.push({...m,payload});
    }catch{}
  }
  chatxMessages = msgs;
  renderChatxThread();
}

function chatxRenderFile(f,msg){
  if(!f) return '';
  const chips = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><span class="chatx-meta-chip">${escHtml(f.mime||'application/octet-stream')}</span><span class="chatx-meta-chip">${escHtml(chatxFmtSize(f.size||0))}</span></div>`;
  const actions = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button type="button" class="miniA" onclick="chatxOpenPreview('${esc(msg.id)}')">Preview</button><button type="button" class="miniA" onclick="chatxOpenFileInTab('${esc(msg.id)}')">Open</button><button type="button" class="miniA" onclick="chatxDownloadFile('${esc(msg.id)}')">Download</button></div>`;
  if((f.mime||'').startsWith('image/')){
    return `<div class="chatx-preview-file">${chips}<img src="data:${f.mime};base64,${f.data_b64}" style="max-width:220px;border-radius:10px;border:1px solid var(--line)">${actions}</div>`;
  }
  if((f.mime||'').includes('pdf')){
    return `<div class="chatx-preview-file">${chips}<embed src="data:${f.mime};base64,${f.data_b64}" type="application/pdf" width="220" height="130">${actions}</div>`;
  }
  if((f.mime||'').startsWith('text/')||/\.(txt|md|json|js|ts|py|log)$/i.test(f.name||'')){
    const txt=atob(f.data_b64||'').slice(0,350).replace(/[<>&]/g,'');
    return `<div class="chatx-preview-file">${chips}<pre style="max-height:110px;overflow:auto;background:rgba(0,0,0,.25);padding:6px;border-radius:8px">${txt}</pre>${actions}</div>`;
  }
  return `<div class="chatx-preview-file">${chips}<div style="font-size:11px">📎 ${escHtml(f.name||'file')}</div>${actions}</div>`;
}

function renderChatxThread(){
  const el=$('chatx-thread');
  if(!el) return;
  if(!chatxMessages.length){
    el.innerHTML='<div style="font-size:12px;color:var(--t3)">No messages yet.</div>';
    return;
  }
  el.innerHTML = chatxMessages.map(m=>{
    const mine = m.from_id===chatxIdentity.id;
    const p = m.payload||{};
    return `<div style="align-self:${mine?'flex-end':'flex-start'};max-width:78%;background:${mine?'rgba(var(--accr),.18)':'rgba(255,255,255,.06)'};border:1px solid var(--line);border-radius:12px;padding:8px 10px">
      <div style="font-size:11px;color:var(--t3)">${escHtml(p.sender||m.from_id)} · ${new Date((m.created||0)*1000).toLocaleTimeString()}</div>
      <div style="white-space:pre-wrap;margin-top:2px">${escHtml(p.text||'')}</div>
      ${chatxRenderFile(p.file,m)}
      <div style="margin-top:6px;display:flex;gap:6px;justify-content:flex-end">
        <button type="button" class="miniA" onclick="chatxForward('${esc(m.id)}')">Forward</button>
      </div>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function chatxCopyId(){
  if(!chatxIdentity) return;
  navigator.clipboard.writeText(chatxIdentity.id).then(()=>toast('Chat ID copied'));
}

function chatxCopyInvite(){
  const invite = chatxInviteString();
  if(!invite) return;
  navigator.clipboard.writeText(invite).then(()=>toast('Secure Chat invite copied'));
}

async function chatxForward(mid){
  const m = chatxMessages.find(x=>String(x.id)===String(mid));
  if(!m) return;
  const choices = chatxContacts.filter(c=>c.id!==chatxPeer);
  if(!choices.length){
    toast('No other contacts to forward');
    return;
  }
  const target = prompt('Forward to contact ID:', choices[0].id);
  if(!target) return;
  const peer = chatxContacts.find(c=>c.id===target.trim());
  if(!peer){
    toast('Contact not found');
    return;
  }
  const payload = m.payload||{};
  const enc = await chatxEncrypt(peer.pub, payload);
  await chatxApiAt(peer.relay_url || chatxRelayBase(), 'chat/send',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({from_id:chatxIdentity.id,to_id:peer.id,iv_b64:enc.iv_b64,cipher_b64:enc.cipher_b64,meta:{forwarded:true,has_file:!!payload.file}})
  });
  toast('Forwarded');
}

function chatxDownloadFile(mid){
  const m = chatxMessages.find(x=>String(x.id)===String(mid));
  const f=m?.payload?.file;
  if(!f) return;
  const a=document.createElement('a');
  a.href=`data:${f.mime||'application/octet-stream'};base64,${f.data_b64||''}`;
  a.download=f.name||'file';
  a.click();
}

function chatxFindMessage(mid){
  return chatxMessages.find(x=>String(x.id)===String(mid));
}

function chatxOpenFileInTab(mid){
  const m = chatxFindMessage(mid);
  const f = m?.payload?.file;
  if(!f) return;
  const bytes = Uint8Array.from(atob(f.data_b64||''), ch => ch.charCodeAt(0));
  const blob = new Blob([bytes], {type:f.mime||'application/octet-stream'});
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(()=>URL.revokeObjectURL(url), 45000);
}

function chatxOpenPreview(mid){
  const m = chatxFindMessage(mid);
  const f = m?.payload?.file;
  if(!f) return;
  chatxPreview = { messageId: String(mid), zoom: 1 };
  $('chatx-preview-title').textContent = `${f.name||'file'} · ${chatxFmtSize(f.size||0)}`;
  const body = $('chatx-preview-body');
  if((f.mime||'').startsWith('image/')){
    body.innerHTML = `<img class="pv-img" id="chatx-preview-img" src="data:${f.mime};base64,${f.data_b64}" alt="preview">`;
  }else if((f.mime||'').includes('pdf')){
    body.innerHTML = `<embed src="data:${f.mime};base64,${f.data_b64}" type="application/pdf" width="100%" height="100%">`;
  }else if((f.mime||'').startsWith('text/')||/\.(txt|md|json|js|ts|py|log)$/i.test(f.name||'')){
    const txt = atob(f.data_b64||'').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
    body.innerHTML = `<pre class="pv-text">${txt}</pre>`;
  }else{
    body.innerHTML = `<div class="pv-bin">Binary file preview not available.<br>${escHtml(f.mime||'application/octet-stream')}</div>`;
  }
  $('chatx-preview').classList.add('on');
}

function chatxPreviewZoom(kind){
  const img = $('chatx-preview-img');
  if(!img) return;
  if(kind==='in') chatxPreview.zoom = Math.min(4, chatxPreview.zoom + 0.2);
  else chatxPreview.zoom = Math.max(0.4, chatxPreview.zoom - 0.2);
  img.style.transform = `scale(${chatxPreview.zoom})`;
}

function chatxClosePreview(){
  $('chatx-preview').classList.remove('on');
}

function chatxOpenPreviewInTab(){
  if(!chatxPreview.messageId) return;
  chatxOpenFileInTab(chatxPreview.messageId);
}

function chatxPreviewDownload(){
  if(!chatxPreview.messageId) return;
  chatxDownloadFile(chatxPreview.messageId);
}

document.addEventListener('keydown', e=>{
  if(e.key==='Escape' && $('chatx-preview')?.classList.contains('on')){
    chatxClosePreview();
  }
});

function chatxExportCurrent(){
  if(!chatxMessages.length){
    toast('No messages to export');
    return;
  }
  const blob = new Blob([JSON.stringify(chatxMessages,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`chinna-chat-${chatxPeer||'thread'}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function chatxRefresh(){
  await chatxLoadHistory();
}

async function loadPlugins(){
  const grid=$('plugin-grid'), count=$('plugin-count');
  if(!grid) return;
  grid.innerHTML='<div class="empty"><div class="spin"></div>Loading plugins…</div>';
  const d=await api('plugins').catch(e=>({error:e?.message||'failed'}));
  if(d.error){
    grid.innerHTML='<div class="empty"><div class="big">🧩</div>Plugin backend unavailable</div>';
    if(count) count.textContent='error';
    return;
  }
  chinnaPlugins=d.plugins||[];
  if(count) count.textContent=`${chinnaPlugins.length} plugins`;
  renderPlugins();
}

function renderPlugins(){
  const grid=$('plugin-grid');
  if(!grid) return;
  if(!chinnaPlugins.length){
    grid.innerHTML='<div class="empty"><div class="big">🧩</div>No plugins found</div>';
    return;
  }
  grid.innerHTML=chinnaPlugins.map(p=>{
    const actions=(p.actions||[]).map(a=>renderPluginAction(p,a)).join('');
    return `<div class="plugin-card">
      <div class="plugin-head">
        <div class="plugin-icon">${escHtml(p.icon||'◇')}</div>
        <div class="info">
          <div class="plugin-category">${escHtml(p.category||'General')}</div>
          <div class="plugin-title">${escHtml(p.name||p.id)}</div>
          <div class="plugin-desc">${escHtml(p.description||'Chinna plugin')}</div>
        </div>
      </div>
      <div class="plugin-actions">${actions||'<span class="muted">No actions</span>'}</div>
    </div>`;
  }).join('');
}

function renderPluginAction(p,a){
  const pid=esc(p.id), aid=esc(a.id);
  if(a.kind==='form'){
    const fields=(a.fields||[]).map(f=>{
      const id=`plug-${p.id}-${a.id}-${f.name}`.replace(/[^a-zA-Z0-9_-]/g,'-');
      return `<input class="field" id="${id}" data-plugin-input="${escHtml(f.name)}" placeholder="${escHtml(f.placeholder||f.label||f.name)}" type="${escHtml(f.type||'text')}" ${f.required?'required':''}>`;
    }).join('');
    return `<div class="plugin-form"><div class="plugin-form-row">${fields}<button type="button" class="bigbtn" onclick="runPluginAction('${pid}','${aid}',this)">${escHtml(a.name||a.id)}</button></div></div>`;
  }
  const cls=a.style==='solid'?'bigbtn solid':'bigbtn';
  return `<button type="button" class="${cls}" onclick="runPluginAction('${pid}','${aid}',this)">${escHtml(a.name||a.id)}</button>`;
}

async function runPluginAction(plugin, action, btn){
  const p=chinnaPlugins.find(x=>x.id===plugin);
  const a=(p?.actions||[]).find(x=>x.id===action);
  if(a?.confirm && !confirm(a.confirm)) return;
  const payload={};
  const card=btn.closest('.plugin-card');
  if(card){
    card.querySelectorAll('[data-plugin-input]').forEach(input=>{
      payload[input.dataset.pluginInput]=input.value;
    });
  }
  const log=$('plugin-log');
  if(log) log.textContent=`Running ${p?.name||plugin} / ${a?.name||action}…`;
  btn.disabled=true;
  const d=await api('plugins/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plugin,action,payload})}).catch(e=>({error:e?.message||'failed'}));
  btn.disabled=false;
  const msg=d.error || d.result || JSON.stringify(d,null,2);
  if(log) log.textContent=msg;
  toast(d.error ? `Plugin failed: ${d.error}` : `${a?.name||action} complete`);
}

async function installMacApp(){
  const btn=$('install-app-btn');
  const note=$('install-app-note');
  if(btn){
    btn.disabled=true;
    btn.textContent='Installing Chinna.app…';
  }
  if(note) note.textContent='Building the Mac app and opening it when ready…';
  const d = await api('install-app',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>({error:'failed'}));
  if(d.error){
    if(btn){
      btn.disabled=false;
      btn.textContent='Install Chinna.app';
    }
    if(note) note.textContent='Install failed. Check permissions and try again.';
    toast('Install failed: '+d.error);
    return;
  }
  if(btn){
    btn.disabled=false;
    btn.textContent='Reinstall Chinna.app';
  }
  if(note) note.textContent='Installed at '+(d.app_path||'~/Applications/Chinna.app')+'. Open it from Applications, Dock, Spotlight, or SwiftBar.';
  toast('Chinna.app installed at '+(d.app_path||'~/Applications/Chinna.app'));
}

async function installSwiftBarQuickActions(){
  const btn=$('install-swiftbar-btn');
  if(btn){
    btn.disabled=true;
    btn.textContent='Installing SwiftBar actions…';
  }
  const d = await api('install-swiftbar',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>({error:'failed'}));
  if(d.error){
    if(btn){
      btn.disabled=false;
      btn.textContent='Install SwiftBar quick actions';
    }
    toast('SwiftBar install failed: '+d.error);
    return;
  }
  if(btn){
    btn.disabled=false;
    btn.textContent='Reinstall SwiftBar quick actions';
  }
  toast('SwiftBar quick actions installed');
}

async function installBrowserExtension(){
  const btn=$('install-extension-btn');
  const note=$('extension-install-note') || $('install-app-note');
  if(btn){
    btn.disabled=true;
    btn.textContent='Opening Chrome installer...';
  }
  if(note) note.textContent='Preparing the Chinna extension folder...';
  const d = await api('install-extension',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>({error:'failed'}));
  if(btn){
    btn.disabled=false;
    btn.textContent=d.error ? 'Install browser companion' : 'Reopen extension installer';
  }
  if(d.error){
    if(note) note.textContent='Install failed. Check the extension folder and Chrome.';
    toast('Extension install failed: '+d.error);
    return;
  }
  if(note) note.textContent=d.result || 'Chrome opened. Enable Developer Mode, click Load unpacked, and choose the Chinna extension folder.';
  toast('Chrome extension folder ready');
}

function showSources(row,sources){
  if(!sources || !sources.length) return;
  const box=document.createElement('div');
  box.className='sourcebox';
  box.textContent='Local context\n' + sources.slice(0,5).map(s=>`• ${s}`).join('\n');
  row.querySelector('.info')?.appendChild(box);
}
async function sendAI(forcedMsg,fromVoice=false){
  const inp=$('ai-in'),msg=(forcedMsg!==undefined?forcedMsg:inp.value).trim();if(!msg)return;inp.value='';
  const M=$('ai-msgs');

  // Add user message visually + to history
  M.appendChild(appendChat('user',msg));
  chatHistory.push({role:'user', content:msg});

  const think=appendChat('assistant','thinking…');
  think.id='ai-think';
  think.querySelector('.nm').classList.add('mt');
  M.appendChild(think);
  M.scrollTop=M.scrollHeight;

  let d;
  try{
    const payload = {
      message: msg,
      history: chatHistory.slice(0, -1),
      model: currentModel,
      attachments: aiAttachments.length ? aiAttachments : undefined
    };
    d = await api('chat', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
  }catch(err){
    d={reply:'',error:String(err?.message||err)};
  }

  // Clear staged attachments after sending
  aiAttachments = [];
  renderAttachments();

  $('ai-think')?.remove();

  const reply = d.reply || d.error || '(no response)';

  // Update our local history from server (authoritative)
  if (d.history && Array.isArray(d.history)) {
    chatHistory = d.history;
  } else {
    chatHistory.push({role:'assistant', content:reply});
  }

  const assistantRow = appendChat('assistant', reply);
  M.appendChild(assistantRow);

  // Beautiful rendering of tool calls (if any)
  if (d.tool_calls && d.tool_calls.length) {
    const toolsBox = document.createElement('div');
    toolsBox.style.cssText = 'margin:6px 0 12px 38px;font-size:11px;opacity:.85';
    toolsBox.innerHTML = d.tool_calls.map(t => 
      `<div style="background:rgba(255,255,255,.06);border-radius:8px;padding:6px 10px;margin-bottom:4px">
        <span style="color:var(--acc);font-weight:700">${t.tool}</span> 
        <span style="opacity:.6">→</span> ${typeof t.result === 'string' ? t.result.slice(0,160) : JSON.stringify(t.result).slice(0,160)}
      </div>`
    ).join('');
    assistantRow.appendChild(toolsBox);
  }

  M.scrollTop = M.scrollHeight;

  // Advanced voice: speaking state + continuous mode + interruption support
  if (voiceEnabled) {
    const speakText = reply.slice(0,650);
    if (speakText && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(speakText);
      utter.rate = 1.02; utter.pitch = 1.0;
      utter.onend = () => {
        setVoiceState('idle');
        if (voiceContinuous) setTimeout(() => startVoiceCaptureAdvanced(), 380);
      };
      voiceSpeakingUtterance = utter;
      setVoiceState('speaking');
      speechSynthesis.speak(utter);
    } else if (voiceContinuous) {
      setTimeout(() => startVoiceCaptureAdvanced(), 300);
    } else {
      setVoiceState('idle');
    }
  }

  // === Inline job progress streaming (for deep_clean, etc.) ===
  const jobIds = (d.tool_calls || []).filter(t => t.result && t.result.includes('job_id')).map(t => {
    try { return JSON.parse(t.result).job_id; } catch { return null; }
  }).filter(Boolean);

  if (jobIds.length) {
    jobIds.forEach(jid => startInlineJobStream(jid, M));
  }

  // === AI is explicitly asking for file upload ===
  if (d.needs_upload) {
    showUploadRequestBanner(d.upload_request || "Please attach the relevant file so I can analyze it.");
  }
}

/* ========== Subtle & Clear Progress Helpers ========== */
function showProgressMessage(el, text, subtext = '') {
  if (!el) return;
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;opacity:.9">
      <div class="spin" style="width:18px;height:18px;border-width:2px"></div>
      <div>
        <div style="font-size:12px;font-weight:600">${text}</div>
        ${subtext ? `<div style="font-size:10px;opacity:.6;margin-top:1px">${subtext}</div>` : ''}
      </div>
    </div>
  `;
}

function clearProgressMessage(el, fallback = '') {
  if (el) el.innerHTML = fallback;
}

let globalWorkingTimer = null;
function setGlobalWorking(show, label = 'Working…') {
  const el = $('global-working');
  if (!el) return;
  if (show) {
    el.textContent = label;
    el.style.display = 'inline-block';
    if (globalWorkingTimer) clearTimeout(globalWorkingTimer);
    globalWorkingTimer = setTimeout(() => { if (el) el.style.display = 'none'; }, 1000 * 60 * 4); // auto hide after 4 min max
  } else {
    el.style.display = 'none';
  }
}

function startInlineJobStream(jobId, container){
  const prog = document.createElement('div');
  prog.className = 'row';
  prog.style.marginLeft = '38px';
  prog.style.fontSize = '12px';
  prog.style.opacity = '0.9';
  prog.innerHTML = `<div class="info"><div class="nm" style="color:var(--acc)">⏳ Job ${jobId} running...</div><div class="mt" id="joblog-${jobId}"></div></div>`;
  container.appendChild(prog);
  container.scrollTop = container.scrollHeight;

  const logEl = prog.querySelector(`#joblog-${jobId}`);
  let lastLines = 0;

  const iv = setInterval(async () => {
    try{
      const j = await api(`job?id=${jobId}`);
      const lines = j.lines || [];
      if(lines.length > lastLines){
        logEl.innerHTML = lines.slice(-6).map(l => `<div style="font-family:monospace;opacity:.85">${l}</div>`).join('');
        container.scrollTop = container.scrollHeight;
        lastLines = lines.length;
      }
      if(j.done){
        clearInterval(iv);
        logEl.innerHTML += `<div style="color:var(--green);margin-top:4px">✓ Done</div>`;
      }
    }catch(e){
      clearInterval(iv);
    }
  }, 1200);
}

/* Banner when AI asks user to upload something */
let uploadBanner = null;
function showUploadRequestBanner(message){
  const aiView = $('view-ai');
  if (!aiView) return;

  if (uploadBanner) uploadBanner.remove();

  uploadBanner = document.createElement('div');
  uploadBanner.style.cssText = 'margin:8px 14px;padding:10px 14px;background:rgba(var(--accr),.12);border:1px solid rgba(var(--accr),.35);border-radius:10px;font-size:12px;display:flex;align-items:center;gap:10px';
  uploadBanner.innerHTML = `
    <span style="flex:1">${message}</span>
    <button type="button" class="bigbtn solid" style="padding:6px 14px;font-size:11px" onclick="triggerAttachmentFromBanner()">📎 Attach File</button>
    <button type="button" class="bigbtn" style="padding:6px 10px;font-size:11px" onclick="dismissUploadBanner()">✕</button>
  `;
  const vbody = aiView.querySelector('.vbody');
  vbody.insertBefore(uploadBanner, vbody.firstChild);
}

function triggerAttachmentFromBanner(){
  const input = $('ai-file-input');
  if (input) input.click();
  dismissUploadBanner();
}

function dismissUploadBanner(){
  if (uploadBanner) {
    uploadBanner.remove();
    uploadBanner = null;
  }
}

async function showPreviousUploads(){
  const container = $('ai-attachments');
  if (!container) return;

  // Create a temporary nice picker below the input
  let picker = $('previous-uploads-picker');
  if (picker) picker.remove();

  picker = document.createElement('div');
  picker.id = 'previous-uploads-picker';
  picker.style.cssText = 'margin:8px 12px;padding:12px;background:var(--panel2);border:1px solid var(--line);border-radius:12px;max-height:260px;overflow:auto';
  picker.innerHTML = `<div style="font-size:12px;font-weight:600;margin-bottom:8px">Previous uploads — click to re-attach</div><div id="prev-uploads-list">Loading...</div>`;

  container.parentNode.insertBefore(picker, container.nextSibling);

  try {
    const res = await api('chat', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({message: 'list my previous uploads', history: chatHistory})
    });

    let files = [];
    if (res.tool_calls) {
      for (const t of res.tool_calls) {
        if (t.tool === 'list_uploaded_files') {
          try { files = JSON.parse(t.result) || []; } catch {}
        }
      }
    }

    const listEl = picker.querySelector('#prev-uploads-list');
    if (!files.length) {
      listEl.innerHTML = '<div style="opacity:.6;font-size:11px">No previous uploads yet. Attach something first!</div>';
      return;
    }

    listEl.innerHTML = files.map(f => `
      <div class="row" style="padding:6px 8px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.06)" 
           onclick="reAttachPreviousFile('${f.id}', '${f.name.replace(/'/g, "\\'")}', '${f.mime}')">
        <div style="flex:1">
          <div style="font-size:12px">${f.name}</div>
          <div style="font-size:10px;opacity:.55">${(f.size/1024/1024).toFixed(1)} MB · ${new Date(f.uploaded_at*1000).toLocaleDateString()}</div>
        </div>
        <div style="font-size:10px;opacity:.6;align-self:center">Re-attach</div>
      </div>
    `).join('');
  } catch(e) {
    picker.querySelector('#prev-uploads-list').innerHTML = '<div style="color:var(--red);font-size:11px">Failed to load previous uploads</div>';
  }

  // Auto remove picker after 25s or on click outside
  setTimeout(() => { if (picker && picker.parentNode) picker.parentNode.removeChild(picker); }, 25000);
}

async function reAttachPreviousFile(fileId, fileName, mime){
  // Remove the picker
  const picker = $('previous-uploads-picker');
  if (picker) picker.remove();

  try {
    const data = await api(`uploaded-file?id=${fileId}`);
    if (data.error) {
      toast(data.error);
      return;
    }
    // Add to current attachments
    aiAttachments.push({
      name: data.name || fileName,
      mime: data.mime || mime,
      size: data.size,
      data_b64: data.data_b64
    });
    renderAttachments();
    toast(`Re-attached: ${fileName}`);
  } catch(e) {
    toast('Failed to load the file for re-attachment');
  }
}

/* keys */
async function saveKeys(){
  const b={};
  const orKey = $('set-or')?.value?.trim?.() || '';
  const oaKey = $('set-oa')?.value?.trim?.() || '';
  if(orKey)b.chinna_ai_key=orKey;
  if(oaKey)b.openai_key=oaKey;
  b.turn_enabled = !!$('set-turn-enabled')?.checked;
  b.turn_urls = $('set-turn-urls')?.value?.trim?.() || '';
  b.turn_username = $('set-turn-user')?.value?.trim?.() || '';
  b.turn_credential = $('set-turn-cred')?.value || '';
  b.chat_relay_url = $('set-chat-relay')?.value?.trim?.() || '';
  const d=await api('save_keys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
  rememberSavedKeys({ openrouter: orKey, openai: oaKey });
  toast(d.result||'Saved');
  $('set-or').value='';
  $('set-oa').value='';
  if($('turn-test-status')) $('turn-test-status').textContent = 'Saved. Run TURN test.';
  await loadKeySettings().catch(()=>{});
  await loadAIStatus().catch(()=>{});
  await loadModels().catch(()=>{});
  await chatxLoadRtcConfig().catch(()=>{});
  if(chatxIdentity) await chatxPublishInvite().catch(()=>{});
}
async function saveOnboardingKeys(){
  const b={};
  const orKey = $('onboard-or')?.value?.trim() || '';
  const oaKey = $('onboard-oa')?.value?.trim() || '';
  if(orKey) b.chinna_ai_key = orKey;
  if(oaKey) b.openai_key = oaKey;
  if(!b.chinna_ai_key && !b.openai_key){
    toast('Add OpenRouter or OpenAI key first');
    return;
  }
  const d=await api('save_keys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
  rememberSavedKeys({ openrouter: orKey, openai: oaKey });
  if($('onboard-or')) $('onboard-or').value='';
  if($('onboard-oa')) $('onboard-oa').value='';
  localStorage.setItem(ONBOARDING_KEY, '1');
  toast(d.result||'AI keys saved');
  await loadKeySettings().catch(()=>{});
  await loadAIStatus().catch(()=>{});
  await loadModels().catch(()=>{});
  go('agent');
}
async function saveTelegramToken(){
  const token=$('tg-token').value.trim();
  if(!token){ toast('Paste a Telegram bot token first.'); return; }
  const d=await api('save_keys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telegram_token:token})});
  rememberSavedKeys({ telegram: token });
  toast(d.result||'Telegram token saved');
  $('tg-token').value='';
  loadTelegramStatus();
}
async function createTelegramPair(){
  const d=await api('telegram/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  if(d.error){ toast(d.error); return; }
  $('tg-qr').src=d.qr_url||'';
  $('tg-link').innerHTML=`Pair link: <span class="muted">${d.pair_url}</span><div class="paircode">${d.code}</div>`;
  toast('Pair code generated');
  loadTelegramStatus();
}
async function testTelegram(){
  const d=await api('telegram/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'✅ Chinna dashboard test'})});
  toast(d.result||d.error||'Test sent');
}

/* simple actions */
async function reveal(p){await api('reveal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p})});toast('Revealed in Finder');}

/* ===== CONFIRM + LIVE PROGRESS MODAL ===== */
let pendingGo=null;
function openModal(title,desc,confirmHTML,onGo,goLabel){
  $('m-title').textContent=title;$('m-desc').textContent=desc;
  $('m-confirm').innerHTML=confirmHTML;$('m-confirm').style.display='';
  $('m-prog').style.display='none';$('m-log').innerHTML='';
  $('m-foot').style.display='';$('m-confirm').textContent=goLabel||'Confirm';$('m-confirm').style.display='';
  pendingGo=onGo;$('scrim').classList.add('on');
}
function closeModal(){$('scrim').classList.remove('on');pendingGo=null;}
$('m-confirm').onclick=()=>{if(pendingGo)pendingGo();};

function showProgress(title, desc = 'This may take a moment. Live updates below.'){
  $('m-title').textContent=title;
  $('m-desc').textContent=desc;
  $('m-confirm').style.display='none';
  $('m-prog').style.display='';
  $('m-confirm').style.display='none';
}

async function runJob(startPromise, doneLabel, friendlyMessages = {}){
  setGlobalWorking(true, doneLabel || 'Processing…');

  const {job}=await startPromise;
  const log=$('m-log');
  const poll=setInterval(async()=>{
    const j=await api('job?id='+job);
    log.innerHTML = (j.lines || []).map(line => {
      const lower = line.toLowerCase();
      let nice = line;

      // Make progress messages more understandable
      if (lower.includes('cleaning user caches')) nice = '🧹 Clearing user caches…';
      else if (lower.includes('npm cache')) nice = '📦 Cleaning npm cache…';
      else if (lower.includes('homebrew')) nice = '🍺 Running Homebrew cleanup…';
      else if (lower.includes('trash')) nice = '🗑 Emptying Trash…';
      else if (lower.includes('purg')) nice = '🧠 Purging inactive RAM memory…';
      else if (lower.includes('uninstalling')) nice = '🗑 Uninstalling app and leftovers…';
      else if (lower.includes('removing')) nice = '🗑 Removing leftover files…';
      else if (lower.includes('complete') || lower.includes('done')) nice = '✅ ' + line;

      const isDone = lower.includes('complete') || lower.includes('uninstalled') || lower.includes('removed') || lower.includes('purged') || lower.includes('done');
      return isDone ? `<div class="done">${nice}</div>` : `<div>${nice}</div>`;
    }).join('');

    log.scrollTop=log.scrollHeight;

    if(j.done){
      clearInterval(poll);
      $('m-foot').style.display='';
      $('m-confirm').style.display='none';
      $('m-foot').innerHTML='<button type="button" class="btn-cancel" onclick="closeModalRefresh()">Done</button>';
      toast(doneLabel || 'Finished');
      setGlobalWorking(false);
    }
  }, 650);
}
function closeModalRefresh(){closeModal();$('m-foot').innerHTML='<button type="button" class="btn-cancel" onclick="closeModal()">Cancel</button><button type="button" class="btn-go" id="m-confirm">Confirm</button>';$('m-confirm').onclick=()=>{if(pendingGo)pendingGo();};
  const cur=document.querySelector('.navitem.on')?.dataset.v;if(cur)go(cur);}

/* confirm flows */
function confirmAction(kind){
  if(kind==='clean'){
    confirmDeepCleanCustom();
    return;
  }
  const meta={
    purge:['Purge RAM','Freeing inactive memory. Safe operation that can help when RAM feels full.','Running macOS memory purge (may ask for sudo password in terminal)','Purge'],
    clean:['Deep Clean','Clearing system caches, npm, Homebrew, and emptying Trash. This can take 30–90 seconds.','Scanning and removing temporary files across multiple locations','Clean']
  }[kind];
  openModal(meta[0],meta[1],meta[2],()=>{showProgress(meta[0], 'Live progress will appear below…');runJob(api(kind,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),meta[0]+' complete');},meta[3]);
}

async function confirmDeepCleanCustom(){
  deepCleanItems = [];
  deepCleanSelected = new Set();
  deepCleanVolume = null;
  deepCleanForce = false;
  deepCleanForceRequired = new Set();

  openModal(
    'Deep Clean · Strict + Custom',
    'Scanning your disk and cleanup targets. You can choose exactly what to remove before running.',
    '<div style="display:flex;align-items:center;gap:10px"><div class="spin" style="width:18px;height:18px;border-width:2px;margin:0"></div><span style="font-size:12px">Building strict cleanup plan...</span></div>',
    ()=>runSelectedDeepClean(),
    'Run Selected Clean'
  );

  const goBtn = $('m-confirm');
  goBtn.disabled = true;
  goBtn.style.opacity = '.55';
  goBtn.textContent = 'Scanning...';

  try {
    const data = await api('clean/scan', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'});
    deepCleanItems = data.items || [];
    deepCleanVolume = data.volume || null;
    deepCleanForceRequired = new Set((data.force_required_ids || []).filter(Boolean));
    deepCleanSelected = new Set((data.recommended_ids || []).filter(Boolean));
    renderDeepCleanSelection();
    goBtn.disabled = false;
    goBtn.style.opacity = '';
    goBtn.textContent = 'Run Selected Clean';
  } catch(e) {
    $('m-confirm').innerHTML = '<div style="color:var(--red);font-size:12px">Failed to scan cleanup targets. Try again.</div>';
    goBtn.style.display = 'none';
  }
}

function renderDeepCleanSelection(){
  const c = $('m-confirm');
  if(!c) return;
  if(!deepCleanItems.length){
    c.innerHTML = '<div style="font-size:12px;opacity:.85">No cleanup targets found right now.</div>';
    return;
  }

  c.innerHTML = `
    <div style="display:grid;gap:10px">
      <div style="font-size:12px;line-height:1.6;padding:10px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.03)">
        <div><b>Volume:</b> ${escHtml(deepCleanVolume?.path || '/System/Volumes/Data')}</div>
        <div>Used: <span id="dc-used">${fmtBytes(deepCleanVolume?.used_bytes || 0)}</span> · Free: <span id="dc-free">${fmtBytes(deepCleanVolume?.free_bytes || 0)}</span> · Total: <span id="dc-total">${fmtBytes(deepCleanVolume?.total_bytes || 0)}</span></div>
        <div style="margin-top:4px;color:var(--acc)">Selected reclaim estimate: <b id="dc-selected">0 B</b> · Free after clean: <b id="dc-free-after">0 B</b></div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="bigbtn ghost smallbtn" onclick="setDeepCleanSelection('recommended')">Recommended</button>
        <button type="button" class="bigbtn ghost smallbtn" onclick="setDeepCleanSelection('all')">Select all</button>
        <button type="button" class="bigbtn ghost smallbtn" onclick="setDeepCleanSelection('none')">Clear all</button>
        <button type="button" class="bigbtn smallbtn ${deepCleanForce?'solid':'ghost'}" onclick="toggleDeepCleanForce()">${deepCleanForce?'Force Modules: ON':'Force Modules: OFF'}</button>
      </div>

      <div style="font-size:11px;line-height:1.6;padding:8px 10px;border:1px dashed var(--line);border-radius:10px;color:var(--t2)">
        System-sensitive modules are locked by default to avoid breaking current macOS features. Turn <b>Force Modules</b> on only if you explicitly want those operations.
      </div>

      <div style="max-height:280px;overflow:auto;border:1px solid var(--line);border-radius:10px;background:rgba(0,0,0,.24)">
        ${(deepCleanItems||[]).map(item => {
          const forceNeeded = !!item.requires_force;
          const locked = forceNeeded && !deepCleanForce;
          const checked = deepCleanSelected.has(item.id) ? 'checked' : '';
          const hint = item.path ? escHtml(item.path) : escHtml(item.kind || 'item');
          const risk = item?.extra?.risk ? `<div style="font-size:10px;color:var(--amber)">⚠ ${escHtml(item.extra.risk)}</div>` : '';
          const badge = forceNeeded ? `<span style="font-size:10px;padding:1px 6px;border-radius:999px;background:rgba(255,172,64,.15);color:var(--amber);margin-left:6px">FORCE</span>` : '';
          return `
            <label style="display:flex;gap:10px;align-items:flex-start;padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.06);opacity:${locked?'.62':'1'}">
              <input type="checkbox" data-dc-id="${escHtml(item.id)}" ${checked} ${locked?'disabled':''} onchange="toggleDeepCleanItem('${esc(item.id)}', this.checked)" style="margin-top:2px;accent-color:var(--acc)">
              <div style="flex:1;min-width:0">
                <div style="font-size:12px">${escHtml(item.label)} ${badge}</div>
                <div style="font-size:10px;opacity:.62;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${hint}</div>
                ${risk}
              </div>
              <div style="font-size:11px;color:var(--acc);white-space:nowrap">${escHtml(item.size || fmtBytes(item.size_bytes||0))}</div>
            </label>
          `;
        }).join('')}
      </div>
    </div>
  `;

  updateDeepCleanEstimate();
}

function toggleDeepCleanItem(id, on){
  if(on) deepCleanSelected.add(id);
  else deepCleanSelected.delete(id);
  updateDeepCleanEstimate();
}

function setDeepCleanSelection(mode){
  if(mode === 'none'){
    deepCleanSelected = new Set();
  }else if(mode === 'all'){
    deepCleanSelected = new Set((deepCleanItems||[]).filter(x => deepCleanForce || !x.requires_force).map(x=>x.id));
  }else{
    deepCleanSelected = new Set((deepCleanItems||[]).filter(x=>x.default_selected && (deepCleanForce || !x.requires_force)).map(x=>x.id));
  }
  document.querySelectorAll('input[data-dc-id]').forEach(el => {
    el.checked = deepCleanSelected.has(el.getAttribute('data-dc-id'));
  });
  updateDeepCleanEstimate();
}

function toggleDeepCleanForce(){
  deepCleanForce = !deepCleanForce;
  if(!deepCleanForce){
    deepCleanSelected = new Set([...deepCleanSelected].filter(id => !deepCleanForceRequired.has(id)));
  }
  renderDeepCleanSelection();
}

function updateDeepCleanEstimate(){
  const selectedBytes = (deepCleanItems||[])
    .filter(x => deepCleanSelected.has(x.id))
    .reduce((a,x)=>a + Number(x.size_bytes||0), 0);
  const freeNow = Number(deepCleanVolume?.free_bytes || 0);
  const freeAfter = freeNow + selectedBytes;
  if($('dc-selected')) $('dc-selected').textContent = fmtBytes(selectedBytes);
  if($('dc-free-after')) $('dc-free-after').textContent = fmtBytes(freeAfter);
}

function runSelectedDeepClean(){
  const selected = [...deepCleanSelected].filter(id => deepCleanForce || !deepCleanForceRequired.has(id));
  if(!selected.length){
    toast('Select at least one item to clean');
    return;
  }
  showProgress('Deep Clean · Running', 'Executing selected cleanup targets with strict mode. Live progress appears below.');
  runJob(
    api('clean/custom', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({selected_ids: selected, strict: true, allow_force: deepCleanForce})
    }),
    'Deep Clean complete'
  );
}
function confirmUninstall(path,name){
  openModal('Uninstall '+name,'This removes the app and its leftover support files. This cannot be undone.',
    `Will remove:\n• ${path}\n• ~/Library/Application Support/${name}\n• ~/Library/Caches/${name}\n• ~/Library/Preferences/*${name}*\n• Logs & saved state`.replace(/\n/g,'<br>'),
    ()=>{showProgress('Uninstalling '+name, 'Removing app bundle + support files, caches, and preferences.');runJob(api('uninstall',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,name})}),name+' uninstalled');},'Uninstall');
}
function confirmTrash(path,name){
  openModal('Move to Trash','Send this file to Trash? You can restore it from Trash later.',
    `• ${path}`,()=>{showProgress('Moving to Trash');
      api('trash',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path})}).then(()=>{$('m-log').innerHTML='<div class="done">Moved to Trash.</div>';$('m-foot').innerHTML='<button type="button" class="btn-cancel" onclick="closeModalRefresh()">Done</button>';toast('Moved to Trash');});
    },'Move to Trash');
}
function confirmDeleteDupes(){
  if(!dupeSel.size){toast('Select files first');return;}
  const paths=[...dupeSel];
  openModal('Delete '+paths.length+' duplicates','Permanently remove the selected duplicate files. This cannot be undone.',
    paths.map(p=>'• '+p).join('<br>'),
    ()=>{showProgress('Deleting duplicates', 'Permanently removing selected duplicate files…');runJob(api('delete-dupes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths})}),'Duplicates deleted').then(()=>{dupeSel.clear();});},
    'Delete '+paths.length+' files');
}
function confirmKill(pid,name){
  openModal('Kill process','Force-quit this process? Unsaved work in it will be lost.',`• ${name} (PID ${pid})`,
    ()=>{showProgress('Killing '+name);api('kill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pid})}).then(()=>{$('m-log').innerHTML='<div class="done">Killed '+name+'.</div>';$('m-foot').innerHTML='<button type="button" class="btn-cancel" onclick="closeModalRefresh()">Done</button>';toast('Killed '+name);});},'Kill');
}

setVoiceButton();
loadTelegramStatus().catch(()=>{});
startStatsPoll();
setupAttachmentUI();
renderRailProjects(); // initial load of tracked projects


// ── WHATSAPP ─────────────────────────────────────────────────
function waOpenWeb(){ window.open('https://web.whatsapp.com','_blank'); }
function waQrImage(qr){
  return qr ? chatxQrUrl(qr, 256) : '';
}
function waSetStatus(d){
  const state = $('wa-state');
  const detail = $('wa-detail');
  const img = $('wa-qr-img');
  if(!state || !detail || !img) return;
  if(d.connected){
    state.textContent = 'Connected';
    const me = d.me?.id || d.me?.name || 'WhatsApp linked';
    detail.textContent = `${me} · ${d.chats||0} chats loaded`;
    img.removeAttribute('src');
    img.alt = 'WhatsApp connected';
  }else if(d.qr || d.has_qr){
    state.textContent = 'Scan WhatsApp QR';
    detail.textContent = 'Open WhatsApp on your phone, go to Linked Devices, and scan this code.';
    img.src = waQrImage(d.qr);
  }else if(d.error || d.last_error){
    state.textContent = 'Bridge needs attention';
    detail.textContent = d.error || d.last_error;
    img.removeAttribute('src');
  }else{
    state.textContent = 'Starting QR mode';
    detail.textContent = 'Waiting for Baileys to produce a WhatsApp QR code.';
    img.removeAttribute('src');
  }
}
async function waInit(){
  await waRefresh();
  if(!waPollTimer) waPollTimer = setInterval(waRefresh, 2500);
}
async function waRefresh(){
  const d = await api('whatsapp/status').catch(e=>({error:e?.message||'WhatsApp bridge unavailable'}));
  waSetStatus(d);
  if(d.connected) await waLoadChats();
}
async function waLoadChats(){
  const d = await api('whatsapp/chats').catch(()=>({chats:[]}));
  waChats = d.chats || [];
  renderWaChats();
}
function waInitial(name){
  return String(name||'?').trim().slice(0,1).toUpperCase() || '?';
}
function renderWaChats(){
  const el = $('wa-chats');
  if(!el) return;
  if(!waChats.length){
    el.innerHTML = '<div style="font-size:11px;color:var(--t3);padding:8px">No chats yet. Open a phone number manually or wait for WhatsApp sync.</div>';
    return;
  }
  el.innerHTML = waChats.map(c=>{
    const name = c.name || c.jid || 'Chat';
    const last = c.last || c.jid || '';
    return `<div class="wa-chat-item ${waSelectedJid===c.jid?'on':''}" onclick="waSelectChat('${esc(c.jid)}','${esc(name)}')">
      <div class="wa-avatar">${escHtml(waInitial(name))}</div>
      <div style="min-width:0;flex:1">
        <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(name)}</div>
        <div style="font-size:10px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(last)}</div>
      </div>
    </div>`;
  }).join('');
}
function waNormalizeJid(value){
  const raw = String(value||'').trim();
  if(!raw) return '';
  if(raw.includes('@')) return raw;
  const digits = raw.replace(/\D/g,'');
  return digits ? `${digits}@s.whatsapp.net` : '';
}
function waSelectManualChat(){
  const raw = $('wa-new-chat')?.value || '';
  const jid = waNormalizeJid(raw);
  if(!jid){ toast('Enter a WhatsApp phone number or jid'); return; }
  waSelectChat(jid, raw);
}
async function waSelectChat(jid, name=''){
  waSelectedJid = jid;
  $('wa-peer-title').textContent = name || jid;
  $('wa-peer-sub').textContent = jid;
  renderWaChats();
  await waLoadMessages();
}
async function waLoadMessages(){
  if(!waSelectedJid) return;
  const d = await api(`whatsapp/messages?chat=${encodeURIComponent(waSelectedJid)}`).catch(()=>({messages:[]}));
  waMessages = d.messages || [];
  renderWaThread();
}
function renderWaThread(){
  const el = $('wa-thread');
  if(!el) return;
  if(!waMessages.length){
    el.innerHTML = '<div style="font-size:12px;color:var(--t3)">No cached messages yet. Send a message or wait for sync.</div>';
    return;
  }
  el.innerHTML = waMessages.map(m=>{
    const mine = m.fromMe;
    const time = new Date(Number(m.timestamp||0)*1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    return `<div class="wa-msg ${mine?'mine':''}">
      <div class="wa-msg-meta">${mine?'You':escHtml(m.pushName||m.participant||'Contact')} · ${escHtml(time)} · ${escHtml(m.type||'message')}</div>
      <div style="white-space:pre-wrap">${escHtml(m.text || '[media/message]')}</div>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}
async function waSend(){
  const msg=$('wa-msg')?.value?.trim() || '';
  const file=$('wa-file')?.files?.[0];
  if(!waSelectedJid){
    waSelectManualChat();
    if(!waSelectedJid) return;
  }
  if(!msg && !file){ toast('Enter a message or attach a file'); return; }
  const body = {jid:waSelectedJid,text:msg};
  if(file){
    body.file_b64 = await fileToBase64(file);
    body.mime = file.type || 'application/octet-stream';
    body.name = file.name || 'file';
  }
  const d=await api('whatsapp/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const out=$('wa-out');
  if(out){out.style.display='';out.textContent=d.ok?'Sent via WhatsApp bridge':(d.error||'error');}
  if(d.ok){
    $('wa-msg').value='';
    if($('wa-file')) $('wa-file').value='';
    toast('WhatsApp message sent');
    await waLoadMessages();
    await waLoadChats();
  }else toast('WhatsApp error: '+d.error);
}
async function waReconnect(){
  const d=await api('whatsapp/reconnect',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(e=>({error:e?.message||'failed'}));
  waSetStatus(d);
  toast(d.error ? d.error : 'WhatsApp bridge reconnecting');
}
async function waLogout(){
  if(!confirm('Log out of WhatsApp on this Chinna dashboard? You will need to scan QR again.')) return;
  const d=await api('whatsapp/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(e=>({error:e?.message||'failed'}));
  waSelectedJid=''; waChats=[]; waMessages=[]; renderWaChats(); renderWaThread(); waSetStatus(d);
  toast(d.error ? d.error : 'WhatsApp logged out');
}
async function waHandoffCall(mode){
  if(!waSelectedJid){ toast('Select a WhatsApp chat first'); return; }
  const d=await api('whatsapp/handoff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jid:waSelectedJid,mode})});
  if(d.url) window.open(d.url, '_blank');
  toast(d.note || 'Opening WhatsApp for call handoff');
}
// ── V6 INIT ──────────────────────────────────────────────────
function initV6(){
  showLaunchSplash();
  const firstRun = !localStorage.getItem(ONBOARDING_KEY);
  if(!localStorage.getItem('chinna_v6_welcomed')){
    document.getElementById('v6overlay').style.display='flex';
  }
  hydrateSavedKeyInputs();
  const initial=(window.location.hash||'').replace('#','');
  if(initial && $('view-'+initial)) window.setTimeout(()=>go(initial), 250);
  else window.setTimeout(()=>{ if(firstRun) go('onboarding'); }, 1150);
  loadKeySettings().catch(()=>{});
  loadModels();
  loadUpdateState().catch(()=>{});
  if(!updatePollTimer) updatePollTimer = setInterval(()=>loadUpdateState().catch(()=>{}), 5 * 60 * 1000);
}
function dismissV6(){
  localStorage.setItem('chinna_v6_welcomed','1');
  document.getElementById('v6overlay').style.display='none';
}

// ── MUSIC ────────────────────────────────────────────────────
async function music(action){
  const d=await api('music',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
  const out=document.getElementById('music-out');
  if(out) out.textContent=(d.result||d.error||'done');
}

// ── MAC ACTIONS ──────────────────────────────────────────────
async function macActionDo(action, extra){
  const body=Object.assign({action},extra||{});
  const d=await api('mac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const out=document.getElementById('mac-out');
  if(d.error && out){ out.textContent='Error: '+d.error; return d; }
  if(out){
    if(action==='screen-share') out.textContent='IP: '+d.ip+'  VNC: '+d.vnc+'  (copied to clipboard)';
    else out.textContent=d.result||d.action+' done';
  }
  return d;
}
function confirmMac(action,title,desc,key){
  openModal(title,desc,'',async ()=>{showProgress(title);const d=await macActionDo(action);document.getElementById('m-log').innerHTML='<div class="done">'+(d.result||d.action+' done')+'</div>';document.getElementById('m-foot').innerHTML='<button type="button" class="btn-cancel" onclick="closeModal()">Done</button>';},key);
}
async function screenShare(){
  const d=await macActionDo('screen-share');
  toast('Screen share info: '+d.ip+' (VNC URL copied)');
}
async function killPort(){
  const port=document.getElementById('kill-port-in')?.value?.trim();
  if(!port){toast('Enter a port number');return;}
  const d=await api('mac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'kill-port',port})});
  const out=document.getElementById('mac-out');
  if(out) out.textContent=d.result||d.error||'done';
  toast(d.result||d.error||'done');
}
function macOpenApp(app){macActionDo('open-app',{app});}

// ── AUDIT ────────────────────────────────────────────────────
async function runAudit(){
  const path=document.getElementById('audit-path-in')?.value?.trim()||'~';
  const out=document.getElementById('audit-out');
  if(out){out.style.display='';out.textContent='Starting audit...';}
  const d=await api('audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path})});
  if(!d.job){if(out)out.textContent='Error: '+JSON.stringify(d);return;}
  const poll=setInterval(async()=>{
    const j=await api('job?id='+d.job);
    if(out) out.textContent=j.lines.join('\n');
    if(j.done){clearInterval(poll);toast('Audit done');}
  },600);
}

// ── MODELS ───────────────────────────────────────────────────
async function loadModels(){
  const d=await api('models');
  setCurrentModel(d.active || currentModel || DEFAULT_OPENROUTER_MODEL);
  const pres=document.getElementById('model-presets');
  if(pres && d.presets) renderModelPresetGroups(pres, d.presets);
  // Also load automation
  try{
    const auto=document.getElementById('auto-val');
    if(auto) auto.textContent=d.auto_mode||'—';
  }catch(e){}
}
async function setModelPreset(preset){
  const d=await api('model-set',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({preset})});
  if(d.ok){
    setCurrentModel(d.active);
    toast('Model: '+d.active);
  } else {
    toast('Error: '+d.error);
  }
}
async function setCustomModel(){
  const m=document.getElementById('model-custom')?.value?.trim();
  if(!m){toast('Enter a model string');return;}
  const d=await api('model-set',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({custom:m})});
  if(d.ok){setCurrentModel(d.active);toast('Model set: '+d.active);}
  else toast('Error: '+d.error);
}
async function toggleAutomation(){
  const d=await api('automation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
  if(d.ok){
    const el=document.getElementById('auto-val');
    if(el) el.textContent=d.mode;
    const btn=document.getElementById('auto-btn');
    if(btn) btn.style.color=d.mode==='on'?'var(--acc)':'var(--t2)';
    toast('Automation: '+d.mode);
  }
}

applyTheme(localStorage.getItem(THEME_KEY) || 'macos', false);

initV6();


/* ============================================================================
   CHINNA V6 — ENHANCEMENT LAYER  (additive; runs after the main script)
   Adds: theme engine + background beat-sync visualizer, 3D parallax tilt,
   pointer spotlight, full keyboard navigation, ARIA backfill, live regions,
   command palette (Cmd/Ctrl+K), dashboard widget customization.
   It NEVER redefines existing app functions or touches any /api wiring.
   ========================================================================== */
(function(){
  "use strict";
  const D = document, W = window;
  const qs = (s,r=D)=>r.querySelector(s);
  const qsa = (s,r=D)=>Array.from((r||D).querySelectorAll(s));
  const reduced = ()=>W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = ()=>W.matchMedia && W.matchMedia('(pointer: fine)').matches;

  /* ---------- theme registry ---------- */
  const THEMES = {
    aurora:   {label:'Aurora',  icon:'🌊', mode:'aurora',   desc:'Liquid-glass macOS'},
    obsidian: {label:'Obsidian',icon:'🌑', mode:'bars',     desc:'Premium OLED'},
    nebula:   {label:'Nebula',  icon:'🌌', mode:'particles',desc:'Deep-space dark'},
    solaris:  {label:'Solaris', icon:'🌅', mode:'warm',     desc:'Warm editorial light'},
    synth:    {label:'Synth',   icon:'🌃', mode:'grid',     desc:'Retro-futuristic'}
  };
  const themeKey = ()=> D.documentElement.dataset.theme || 'aurora';

  /* ---------- live region for announcements ---------- */
  let live = qs('#cx-live');
  if(!live){
    live = D.createElement('div');
    live.id = 'cx-live'; live.className='sr-only';
    live.setAttribute('aria-live','polite'); live.setAttribute('aria-atomic','true');
    D.body.appendChild(live);
  }
  const announce = (m)=>{ if(!m) return; live.textContent=''; setTimeout(()=>{ live.textContent=String(m); }, 30); };

  /* announce toasts (without touching toast()) */
  const toastsEl = qs('#toasts');
  if(toastsEl){
    new MutationObserver(muts=>{
      muts.forEach(mu=>mu.addedNodes && mu.addedNodes.forEach(n=>{ if(n.nodeType===1) announce(n.textContent); }));
    }).observe(toastsEl,{childList:true});
  }

  /* ============================================================
     BACKGROUND BEAT-SYNC VISUALIZER
     ============================================================ */
  const cv = qs('#fx-bg');
  const ctx = cv ? cv.getContext('2d') : null;
  let DPR=1, Wd=0, Hd=0, raf=null, t0=performance.now();
  let particles=[], stars=[];
  let audioCtx=null, analyser=null, audioData=null, audioOn=false, level=0, lvSmooth=0;

  function resize(){
    if(!cv) return;
    DPR = Math.min(2, W.devicePixelRatio||1);
    Wd = cv.width = Math.floor(innerWidth*DPR);
    Hd = cv.height = Math.floor(innerHeight*DPR);
    cv.style.width = innerWidth+'px'; cv.style.height = innerHeight+'px';
    seed();
  }
  function seed(){
    particles=[]; stars=[];
    const n = Math.round((innerWidth*innerHeight)/26000);
    for(let i=0;i<n;i++){
      particles.push({x:Math.random()*Wd,y:Math.random()*Hd,r:(Math.random()*2+.6)*DPR,
        vx:(Math.random()-.5)*.18*DPR,vy:(Math.random()-.5)*.18*DPR,p:Math.random()*Math.PI*2});
    }
    for(let i=0;i<90;i++) stars.push({x:Math.random()*Wd,y:Math.random()*Hd,r:Math.random()*1.3*DPR,tw:Math.random()*Math.PI*2});
  }
  function accentRGB(){
    const v = getComputedStyle(D.documentElement).getPropertyValue('--accr').trim();
    return v || '10,132,255';
  }
  function readAudio(){
    if(analyser && audioData){
      analyser.getByteFrequencyData(audioData);
      let s=0; for(let i=0;i<audioData.length;i++) s+=audioData[i];
      level = (s/audioData.length)/255;
    } else {
      // gentle synthetic pulse so themes still breathe subtly
      const t=(performance.now()-t0)/1000;
      level = .12 + .06*Math.abs(Math.sin(t*1.1)) + .04*Math.abs(Math.sin(t*2.3));
    }
    lvSmooth += (level - lvSmooth)*0.18;
  }
  function frame(){
    if(!ctx){ return; }
    readAudio();
    const acc = accentRGB();
    const mode = (THEMES[themeKey()]||THEMES.aurora).mode;
    const t = (performance.now()-t0)/1000;
    ctx.clearRect(0,0,Wd,Hd);

    if(mode==='particles'){
      // drifting connected particles + glow (nebula)
      for(const p of particles){
        p.x+=p.vx + Math.sin(t*0.3+p.p)*0.12*DPR;
        p.y+=p.vy + Math.cos(t*0.25+p.p)*0.12*DPR;
        if(p.x<0)p.x+=Wd; if(p.x>Wd)p.x-=Wd; if(p.y<0)p.y+=Hd; if(p.y>Hd)p.y-=Hd;
      }
      ctx.lineWidth=DPR;
      for(let i=0;i<particles.length;i++){
        for(let j=i+1;j<particles.length;j++){
          const a=particles[i],b=particles[j];
          const dx=a.x-b.x,dy=a.y-b.y,d=dx*dx+dy*dy, lim=(120*DPR)*(120*DPR);
          if(d<lim){ const al=(1-d/lim)*(0.18+lvSmooth*.35);
            ctx.strokeStyle=`rgba(${acc},${al})`; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
        }
      }
      for(const p of particles){ ctx.fillStyle=`rgba(${acc},${.5+lvSmooth*.4})`; ctx.beginPath();
        ctx.arc(p.x,p.y,p.r*(1+lvSmooth*1.2),0,7); ctx.fill(); }
    }
    else if(mode==='bars'){
      // OLED equalizer bars across the bottom + faint stars
      for(const s of stars){ s.tw+=0.02; const a=(.18+.18*Math.sin(s.tw));
        ctx.fillStyle=`rgba(${acc},${a*.5})`; ctx.fillRect(s.x,s.y,s.r,s.r); }
      const bars=64, bw=Wd/bars;
      for(let i=0;i<bars;i++){
        let mag;
        if(audioData){ mag=(audioData[(i*2)%audioData.length]||0)/255; }
        else { mag=.12+.5*Math.abs(Math.sin(t*1.4+i*0.5))*Math.abs(Math.cos(t*0.6+i*.2)); }
        const h=(mag*0.5+lvSmooth*0.4)*Hd*0.42;
        const g=ctx.createLinearGradient(0,Hd-h,0,Hd);
        g.addColorStop(0,`rgba(${acc},${.32+mag*.4})`); g.addColorStop(1,`rgba(${acc},0)`);
        ctx.fillStyle=g; ctx.fillRect(i*bw+bw*0.18,Hd-h,bw*0.64,h);
      }
    }
    else if(mode==='grid'){
      // synthwave perspective grid + reactive sun + scan bars
      const horizon=Hd*0.46, cx=Wd/2;
      // sun
      const sunR=Hd*0.18*(1+lvSmooth*.25);
      const sg=ctx.createLinearGradient(cx,horizon-sunR,cx,horizon+sunR);
      sg.addColorStop(0,`rgba(${acc},.9)`); sg.addColorStop(1,'rgba(0,229,255,.5)');
      ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(cx,horizon,sunR,Math.PI,0); ctx.fill();
      ctx.globalCompositeOperation='destination-out';
      for(let i=0;i<7;i++){ const yy=horizon-sunR+ (i/7)*sunR*1.1; ctx.fillRect(cx-sunR,yy,sunR*2,sunR*0.05); }
      ctx.globalCompositeOperation='source-over';
      // grid floor
      ctx.strokeStyle=`rgba(${acc},.4)`; ctx.lineWidth=DPR;
      const scroll=(t*60*DPR)% (40*DPR);
      for(let y=horizon; y<Hd; y+=8){
        const k=(y-horizon)/(Hd-horizon);
      }
      for(let i=0;i<26;i++){
        const yy=horizon + Math.pow(i/26,2)*(Hd-horizon) + scroll*0.0;
        ctx.globalAlpha=Math.max(0,1-(yy-horizon)/(Hd-horizon))*0.5;
        ctx.beginPath(); ctx.moveTo(0,yy); ctx.lineTo(Wd,yy); ctx.stroke();
      }
      ctx.globalAlpha=0.4;
      for(let i=-20;i<=20;i++){
        ctx.beginPath(); ctx.moveTo(cx+i*30*DPR,horizon); ctx.lineTo(cx+i*220*DPR,Hd); ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
    else if(mode==='warm'){
      // solaris — slow warm blobs, very subtle
      for(let i=0;i<3;i++){
        const x=Wd*(0.3+0.4*Math.sin(t*0.12+i*2));
        const y=Hd*(0.3+0.4*Math.cos(t*0.1+i*1.7));
        const r=Math.max(Wd,Hd)*0.3;
        const g=ctx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,`rgba(${acc},${.05+lvSmooth*.05})`); g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g; ctx.fillRect(0,0,Wd,Hd);
      }
    }
    else { // aurora — light liquid blobs
      for(let i=0;i<4;i++){
        const x=Wd*(0.5+0.4*Math.sin(t*0.18+i*1.6));
        const y=Hd*(0.5+0.4*Math.cos(t*0.15+i*2.1));
        const r=Math.max(Wd,Hd)*0.28*(1+lvSmooth*.3);
        const g=ctx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,`rgba(${acc},${.07+lvSmooth*.06})`); g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g; ctx.fillRect(0,0,Wd,Hd);
      }
    }
    raf = requestAnimationFrame(frame);
  }
  function startFX(){ if(reduced()||!ctx) return; if(raf) cancelAnimationFrame(raf); t0=performance.now(); raf=requestAnimationFrame(frame); }
  function stopFX(){ if(raf) cancelAnimationFrame(raf); raf=null; }

  /* audio-reactive toggle */
  const audioBtn = (()=>{
    const b=D.createElement('button');
    b.id='cx-audio-btn'; b.type='button'; b.title='Audio-reactive background';
    b.setAttribute('aria-label','Toggle audio-reactive background visualizer');
    b.setAttribute('aria-pressed','false'); b.textContent='🎵';
    D.body.appendChild(b);
    b.addEventListener('click', async ()=>{
      if(audioOn){
        audioOn=false; b.classList.remove('on'); b.setAttribute('aria-pressed','false');
        try{ analyser&&analyser.disconnect(); }catch(e){}
        analyser=null; audioData=null; announce('Audio-reactive background off'); return;
      }
      try{
        const stream = await navigator.mediaDevices.getUserMedia({audio:true});
        audioCtx = audioCtx || new (W.AudioContext||W.webkitAudioContext)();
        if(audioCtx.state==='suspended') await audioCtx.resume();
        const src = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser(); analyser.fftSize=128; analyser.smoothingTimeConstant=.78;
        audioData = new Uint8Array(analyser.frequencyBinCount);
        src.connect(analyser);
        audioOn=true; b.classList.add('on'); b.setAttribute('aria-pressed','true');
        announce('Audio-reactive background on');
      }catch(e){ announce('Microphone unavailable for visualizer'); }
    });
    return b;
  })();

  /* ============================================================
     POINTER SPOTLIGHT + 3D PARALLAX TILT
     ============================================================ */
  let mx=innerWidth/2, my=innerHeight*0.3;
  W.addEventListener('pointermove', e=>{
    mx=e.clientX; my=e.clientY;
    D.documentElement.style.setProperty('--mx', (mx/innerWidth*100).toFixed(2)+'%');
    D.documentElement.style.setProperty('--my', (my/innerHeight*100).toFixed(2)+'%');
    if(finePointer() && !reduced()){
      const card = e.target.closest && e.target.closest('.gauge,.infocard,.plugin-card');
      if(card){
        const r=card.getBoundingClientRect();
        const px=(e.clientX-r.left)/r.width-0.5, py=(e.clientY-r.top)/r.height-0.5;
        card.style.transform=`translateY(-4px) perspective(800px) rotateX(${(-py*6).toFixed(2)}deg) rotateY(${(px*7).toFixed(2)}deg)`;
        card.dataset.cxTilt='1';
      }
    }
  }, {passive:true});
  W.addEventListener('pointerout', e=>{
    const card = e.target.closest && e.target.closest('.gauge,.infocard,.plugin-card');
    if(card && card.dataset.cxTilt){ card.style.transform=''; delete card.dataset.cxTilt; }
  }, {passive:true});

  /* ============================================================
     ACCESSIBILITY: landmarks, ARIA backfill, keyboard navigation
     ============================================================ */
  function setLandmarks(){
    const map=[['.topbar','banner','Top bar and vitals'],['#nav','navigation','Primary'],
      ['#center','main','Main content'],['#right','complementary','System rail'],
      ['#dock','toolbar','Quick actions dock'],['#toasts','status','Notifications']];
    map.forEach(([sel,role,label])=>{ const el=qs(sel); if(el){ if(!el.getAttribute('role'))el.setAttribute('role',role); if(label&&!el.getAttribute('aria-label'))el.setAttribute('aria-label',label);} });
    const center=qs('#center'); if(center && !center.id) center.id='main';
  }

  function backfillAria(){
    // icon-only buttons → derive label from .tip / title / text
    qsa('button,.iconbtn,.dapp,[role="button"]').forEach(b=>{
      if(b.getAttribute('aria-label')) return;
      const tip=b.querySelector && b.querySelector('.tip');
      let lbl = (tip&&tip.textContent.trim()) || b.getAttribute('title') || '';
      if(!lbl){ const txt=(b.textContent||'').replace(/\s+/g,' ').trim(); if(txt && txt.length<=24) lbl=txt; }
      if(lbl) b.setAttribute('aria-label', lbl);
    });
    // theme switcher semantics
    const themes=qs('#themes');
    if(themes){ themes.setAttribute('role','radiogroup'); themes.setAttribute('aria-label','Theme');
      qsa('button',themes).forEach(b=>{ b.setAttribute('role','radio'); b.setAttribute('aria-checked', b.classList.contains('on')?'true':'false'); });
    }
  }

  /* nav: roving focus + roles + aria-current */
  function setupNav(){
    const items = qsa('#nav .navitem');
    items.forEach((it,i)=>{
      it.setAttribute('role','button');
      it.setAttribute('tabindex', i===0?'0':'-1');
      if(it.classList.contains('on')) it.setAttribute('aria-current','page');
      it.addEventListener('keydown', e=>{
        if(e.key==='Enter'||e.key===' '){ e.preventDefault(); it.click(); }
        else if(e.key==='ArrowDown'||e.key==='ArrowUp'){
          e.preventDefault();
          const list=qsa('#nav .navitem'); const idx=list.indexOf(it);
          const next=list[(idx + (e.key==='ArrowDown'?1:list.length-1))%list.length];
          list.forEach(x=>x.setAttribute('tabindex','-1')); next.setAttribute('tabindex','0'); next.focus();
        }
      });
    });
    // keep aria-current synced when go() flips .on
    const nav=qs('#nav');
    if(nav) new MutationObserver(()=>{ qsa('#nav .navitem').forEach(x=>{ if(x.classList.contains('on')) x.setAttribute('aria-current','page'); else x.removeAttribute('aria-current'); }); })
      .observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
  }

  /* dock: roving focus + roles */
  function setupDock(){
    const apps=qsa('#dock .dapp');
    apps.forEach((a,i)=>{
      a.setAttribute('role','button'); a.setAttribute('tabindex', i===0?'0':'-1');
      a.addEventListener('keydown', e=>{
        if(e.key==='Enter'||e.key===' '){ e.preventDefault(); a.click(); }
        else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
          e.preventDefault(); const list=qsa('#dock .dapp'); const idx=list.indexOf(a);
          const next=list[(idx+(e.key==='ArrowRight'?1:list.length-1))%list.length];
          list.forEach(x=>x.setAttribute('tabindex','-1')); next.setAttribute('tabindex','0'); next.focus();
        }
      });
    });
  }

  /* views: role=tabpanel-ish + label */
  function setupViews(){
    qsa('.view').forEach(v=>{ v.setAttribute('role','region'); const h=v.querySelector('.vhead h2'); if(h&&!v.getAttribute('aria-label')) v.setAttribute('aria-label',h.textContent.trim()); });
  }

  /* ============================================================
     COMMAND PALETTE (Cmd/Ctrl+K)
     ============================================================ */
  let palette, palInput, palList, palItems=[], palIndex=0;
  function buildCommands(){
    const cmds=[];
    qsa('#nav .navitem').forEach(it=>{
      const v=it.dataset.v; const label=(it.textContent||'').replace(/\s+/g,' ').trim();
      const icon=(it.querySelector('.ic')||{}).textContent||'•';
      cmds.push({icon,label,grp:'Go to',run:()=>W.go&&W.go(v)});
    });
    cmds.push({icon:'⚡',label:'Purge RAM',grp:'Action',run:()=>W.confirmAction&&W.confirmAction('purge')});
    cmds.push({icon:'🧹',label:'Deep Clean',grp:'Action',run:()=>W.confirmAction&&W.confirmAction('clean')});
    cmds.push({icon:'🎙',label:'Toggle Voice mode',grp:'Action',run:()=>W.toggleVoiceMode&&W.toggleVoiceMode()});
    cmds.push({icon:'🎵',label:'Toggle audio-reactive background',grp:'Action',run:()=>audioBtn.click()});
    cmds.push({icon:'⚙',label:'Open Settings',grp:'Go to',run:()=>W.go&&W.go('settings')});
    Object.entries(THEMES).forEach(([k,v])=>cmds.push({icon:v.icon,label:'Theme: '+v.label,grp:'Theme',run:()=>W.applyTheme&&W.applyTheme(k)}));
    return cmds;
  }
  function buildPalette(){
    palette=D.createElement('div'); palette.id='cx-palette'; palette.setAttribute('role','dialog');
    palette.setAttribute('aria-modal','true'); palette.setAttribute('aria-label','Command palette');
    palette.innerHTML=`<div class="cx-pal-card">
      <div class="cx-pal-input">
        <span aria-hidden="true">⌘</span>
        <input id="cx-pal-q" type="text" role="combobox" aria-expanded="true" aria-controls="cx-pal-list" aria-autocomplete="list" placeholder="Search features, actions, themes…" autocomplete="off" spellcheck="false">
        <span class="cx-pal-kbd">ESC</span>
      </div>
      <div class="cx-pal-list" id="cx-pal-list" role="listbox" aria-label="Commands"></div>
    </div>`;
    D.body.appendChild(palette);
    palInput=qs('#cx-pal-q'); palList=qs('#cx-pal-list');
    palette.addEventListener('click',e=>{ if(e.target===palette) closePalette(); });
    palInput.addEventListener('input',()=>renderPalette(palInput.value));
    palInput.addEventListener('keydown',e=>{
      if(e.key==='ArrowDown'){e.preventDefault();palIndex=Math.min(palItems.length-1,palIndex+1);hi();}
      else if(e.key==='ArrowUp'){e.preventDefault();palIndex=Math.max(0,palIndex-1);hi();}
      else if(e.key==='Enter'){e.preventDefault();const it=palItems[palIndex];if(it){closePalette();it.cmd.run();}}
      else if(e.key==='Escape'){e.preventDefault();closePalette();}
    });
  }
  function renderPalette(q){
    const all=buildCommands(); const term=(q||'').toLowerCase().trim();
    const filtered=term?all.filter(c=>c.label.toLowerCase().includes(term)||c.grp.toLowerCase().includes(term)):all;
    palIndex=0; palItems=[];
    if(!filtered.length){ palList.innerHTML='<div class="cx-pal-empty">No matching commands</div>'; return; }
    palList.innerHTML='';
    filtered.forEach((c,i)=>{
      const el=D.createElement('div'); el.className='cx-pal-item'; el.setAttribute('role','option');
      el.id='cx-pal-opt-'+i; el.setAttribute('aria-selected', i===0?'true':'false');
      el.innerHTML=`<span class="ic" aria-hidden="true">${c.icon}</span><span class="lbl">${c.label}</span><span class="grp">${c.grp}</span>`;
      el.addEventListener('click',()=>{ closePalette(); c.run(); });
      el.addEventListener('mousemove',()=>{ palIndex=i; hi(); });
      palList.appendChild(el); palItems.push({el,cmd:c});
    });
  }
  function hi(){ palItems.forEach((it,i)=>{ const s=i===palIndex; it.el.setAttribute('aria-selected',s?'true':'false'); if(s){ palInput.setAttribute('aria-activedescendant',it.el.id); it.el.scrollIntoView({block:'nearest'});} }); }
  let palPrevFocus=null;
  function openPalette(){ if(!palette) buildPalette(); palPrevFocus=D.activeElement; palette.classList.add('on'); palInput.value=''; renderPalette(''); setTimeout(()=>palInput.focus(),20); announce('Command palette opened'); }
  function closePalette(){ if(palette){ palette.classList.remove('on'); if(palPrevFocus&&palPrevFocus.focus) palPrevFocus.focus(); } }
  W.cxOpenPalette = openPalette;

  D.addEventListener('keydown', e=>{
    if((e.metaKey||e.ctrlKey) && (e.key==='k'||e.key==='K')){ e.preventDefault(); palette&&palette.classList.contains('on')?closePalette():openPalette(); }
  });

  /* ============================================================
     DASHBOARD WIDGET CUSTOMIZATION  (Overview)
     ============================================================ */
  const WKEY='chinna_widgets_v1';
  const WIDGETS=[
    {id:'gauges',  name:'Gauges',        target:'#gauges'},
    {id:'info',    name:'System Info',   target:'#ov-info'},
    {id:'quick',   name:'Quick Actions', target:'#cx-w-quick', create:true},
    {id:'clock',   name:'Now',           target:'#cx-w-clock', create:true},
    {id:'projects',name:'Projects',      target:'#cx-w-projects-wrap'}
  ];
  function loadWidgetPrefs(){ try{ return JSON.parse(localStorage.getItem(WKEY)||'{}'); }catch(e){ return {}; } }
  function saveWidgetPrefs(p){ try{ localStorage.setItem(WKEY,JSON.stringify(p)); }catch(e){} }

  function setupWidgets(){
    const ovBody = qs('#view-overview .vbody');
    if(!ovBody || qs('#cx-customize-bar')) return;
    const prefs = loadWidgetPrefs();

    // wrap "Recent Projects" block so it can be toggled
    const projBlock = qs('#overview-projects') ? qs('#overview-projects').closest('div').parentElement || qs('#overview-projects').parentElement : null;
    if(projBlock && !projBlock.id){ projBlock.id='cx-w-projects-wrap'; }

    // create new widgets
    const quick=D.createElement('div'); quick.id='cx-w-quick'; quick.style.cssText='margin-top:18px';
    quick.innerHTML=`<div class="rlabel" style="margin:0 0 8px">Quick Actions</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <button type="button" class="bigbtn" onclick="confirmAction('purge')">⚡ Purge RAM</button>
        <button type="button" class="bigbtn" onclick="confirmAction('clean')">🧹 Deep Clean</button>
        <button type="button" class="bigbtn" onclick="go('plugins')">🧩 Advanced Tools</button>
        <button type="button" class="bigbtn" onclick="go('ai')">✦ Chinna AI</button>
        <button type="button" class="bigbtn ghost" onclick="cxOpenPalette()">⌘K Command Palette</button>
      </div>`;
    ovBody.appendChild(quick);

    const clock=D.createElement('div'); clock.id='cx-w-clock'; clock.style.cssText='margin-top:18px';
    clock.innerHTML=`<div class="rlabel" style="margin:0 0 8px">Now</div>
      <div class="infocard" style="display:flex;align-items:baseline;gap:14px">
        <div id="cx-clock-time" style="font-size:30px;font-weight:800;font-family:var(--font-mono)">--:--</div>
        <div id="cx-clock-date" style="font-size:12px;color:var(--t2)"></div>
      </div>`;
    ovBody.appendChild(clock);
    const tick=()=>{ const d=new Date(); const tm=qs('#cx-clock-time'),dt=qs('#cx-clock-date');
      if(tm) tm.textContent=d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      if(dt) dt.textContent=d.toLocaleDateString([], {weekday:'long',month:'short',day:'numeric'}); };
    tick(); setInterval(tick,15000);

    // customize bar
    const bar=D.createElement('div'); bar.id='cx-customize-bar'; bar.className='cx-customize-bar';
    bar.setAttribute('role','group'); bar.setAttribute('aria-label','Customize dashboard widgets');
    bar.innerHTML='<span class="lbl">Widgets</span>';
    WIDGETS.forEach(w=>{
      const on = prefs[w.id]!==false;
      const btn=D.createElement('button'); btn.type='button'; btn.className='cx-wtoggle';
      btn.setAttribute('aria-pressed', on?'true':'false'); btn.dataset.w=w.id;
      btn.innerHTML=`<span aria-hidden="true">${on?'◉':'○'}</span> ${w.name}`;
      btn.addEventListener('click',()=>{
        const p=loadWidgetPrefs(); const nowOn=!(p[w.id]!==false); p[w.id]=nowOn; saveWidgetPrefs(p);
        applyWidget(w,nowOn); btn.setAttribute('aria-pressed',nowOn?'true':'false');
        btn.innerHTML=`<span aria-hidden="true">${nowOn?'◉':'○'}</span> ${w.name}`;
        announce(`${w.name} widget ${nowOn?'shown':'hidden'}`);
      });
      bar.appendChild(btn);
    });
    ovBody.insertBefore(bar, ovBody.firstChild);

    WIDGETS.forEach(w=> applyWidget(w, prefs[w.id]!==false));
  }
  function applyWidget(w,on){ const el=qs(w.target); if(el) el.classList.toggle('cx-widget-hidden', !on); }

  /* ============================================================
     THEME SWITCH SIDE-EFFECTS
     ============================================================ */
  function onThemeChange(){
    const k=themeKey(); const meta=THEMES[k]||THEMES.aurora;
    backfillAria(); // refresh radio checked states
    announce('Theme: '+meta.label+' — '+meta.desc);
    seed();
  }
  new MutationObserver(onThemeChange).observe(D.documentElement,{attributes:true,attributeFilter:['data-theme']});

  /* ============================================================
     INIT
     ============================================================ */
  function init(){
    setLandmarks(); setupViews(); setupNav(); setupDock(); backfillAria(); setupWidgets();
    resize(); startFX();
    W.addEventListener('resize', ()=>{ resize(); });
    D.addEventListener('visibilitychange', ()=>{ if(D.hidden) stopFX(); else startFX(); });
    if(reduced()) D.body.classList.add('cx-reduce-fx');
    // re-run widget setup if overview re-rendered (defensive, runs once)
    announce('Chinna dashboard ready. Press Command or Control K for the command palette.');
  }
  W.dismissUpdateOverlay = dismissUpdateOverlay;
  W.loadUpdateState = loadUpdateState;
  W.updateNow = updateNow;
  W.laterUpdate = laterUpdate;
  W.copyFreshReinstallCommand = copyFreshReinstallCommand;
  if(D.readyState==='complete'||D.readyState==='interactive') setTimeout(init, 60);
  else D.addEventListener('DOMContentLoaded', ()=>setTimeout(init,60));
})();

// ── CHINNA AGENT V1 JS ────────────────────────────────────────────────────
let agentMode = 'build';
let agentHistory = [];
let agentRunning = false;
let agentEventSource = null;
let agentArtifacts = [];
let agentPreviewingId = null;
let agentCurrentPlan = '';
let agentArtifactView = 'code';
let agentPreviewHealthy = true;

function agentSetMode(mode) {
  agentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const planBar = document.getElementById('agentPlanBar');
  if (planBar) planBar.style.display = mode === 'plan' ? 'block' : 'none';
}

function agentQuickPrompt(text) {
  const inp = document.getElementById('agentInput');
  if (inp) { inp.value = text; agentSend(); }
}

function agentSetStatus(running, text) {
  agentRunning = running;
  const btn = document.getElementById('agentSendBtn');
  const status = document.getElementById('agentStatus');
  const stxt = document.getElementById('agentStatusTxt');
  if (btn) btn.disabled = running;
  if (status) status.style.display = running ? 'flex' : 'none';
  if (stxt) stxt.textContent = text || 'thinking…';
}

function agentAddMsg(role, text) {
  const w = document.getElementById('agentWelcome');
  if (w) w.remove();
  const msgs = document.getElementById('agentMsgs');
  if (!msgs) return null;
  const d = document.createElement('div');
  d.className = 'agent-msg ' + role;
  const who = role === 'user' ? 'You' : '◈ Chinna';
  d.innerHTML = `<div class="who">${who}</div><div class="bubble"></div>`;
  d.querySelector('.bubble').textContent = text || '';
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
  return d;
}

function agentAppendText(msgEl, chunk) {
  if (!msgEl) return;
  const b = msgEl.querySelector('.bubble');
  if (b) { b.textContent += chunk; }
  const msgs = document.getElementById('agentMsgs');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function agentAddToolBlock(tool, input, result) {
  const msgs = document.getElementById('agentMsgs');
  if (!msgs) return;
  const d = document.createElement('div');
  d.className = 'tool-block';
  const labels = {bash:'BASH',python:'PYTHON',create_artifact:'ARTIFACT',web_search:'SEARCH',
                  write_file:'FILE',read_file:'FILE',mac_control:'MACOS',update_plan:'PLAN'};
  const label = labels[tool] || tool.toUpperCase();
  d.innerHTML = `
    <div class="tool-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='block'?'none':'block'">
      <span class="tool-label ${tool}">${label}</span>
      <span style="font-size:11.5px;color:var(--t2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:2px">${(input||'').replace(/\n/g,' ').slice(0,80)}</span>
      <span class="tool-toggle">▾ expand</span>
    </div>
    <div class="tool-input" style="display:none">${escHtml(input||'')}</div>
    <div class="tool-result">${escHtml((result||'').slice(0,3000))}</div>`;
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
}

function escHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function agentAddArtifact(meta) {
  agentArtifacts.push(meta);
  const count = document.getElementById('agentArtifactCount');
  if (count) count.textContent = agentArtifacts.length;
  agentRenderArtifactList();
  agentOpenArtifactsPanel();
  if (meta.preview) {
    agentSetArtifactView('preview');
    agentShowPreview(meta.id, meta.name);
  }
}

function agentRenderArtifactList() {
  const list = document.getElementById('agentArtifactList');
  if (!list) return;
  list.innerHTML = agentArtifacts.slice().reverse().map(a => `
    <div class="artifact-card" onclick="agentShowPreview('${a.id}','${escHtml(a.name)}')">
      <div class="af-name">${escHtml(a.name)}</div>
      <div class="af-meta">${a.lang} · ${(a.size/1024).toFixed(1)}KB</div>
      <div class="af-acts">
        ${a.preview ? `<button class="bigbtn smallbtn" onclick="event.stopPropagation();agentShowPreview('${a.id}','${escHtml(a.name)}')">Preview</button>` : ''}
        <button class="bigbtn smallbtn" onclick="event.stopPropagation();agentDownloadArtifact('${a.id}')">Download</button>
        <button class="bigbtn danger smallbtn" onclick="event.stopPropagation();agentDeleteArtifact('${a.id}')">Delete</button>
      </div>
    </div>`).join('');
}

function agentOpenArtifactsPanel() {
  const panel = document.getElementById('agentArtifactsPanel');
  if (panel && panel.style.width === '0px' || panel && !panel.style.width) {
    panel.style.width = '320px';
  }
}
function agentCloseArtifacts() {
  const panel = document.getElementById('agentArtifactsPanel');
  if (panel) panel.style.width = '0';
  agentClosePreview();
}

function agentShowPreview(id, name) {
  agentPreviewingId = id;
  const wrap = document.getElementById('agentPreviewWrap');
  const frame = document.getElementById('agentPreviewFrame');
  const label = document.getElementById('agentPreviewLabel');
  const state = document.getElementById('agentPreviewState');
  if (!wrap || !frame) return;
  if (label) label.textContent = name || 'Preview';
  if (state) state.textContent = 'Loading preview...';
  agentPreviewHealthy = true;
  const repairBtn = document.getElementById('agentRepairBtn');
  if (repairBtn) repairBtn.style.display = 'none';
  frame.onload = () => {
    if (state) state.textContent = 'Preview ready';
  };
  frame.onerror = () => agentPreviewFailed('Preview failed to load');
  frame.src = `/api/artifact/${id}/preview`;
  wrap.style.display = 'flex';
  agentOpenArtifactsPanel();
}
function agentPreviewFailed(message) {
  agentPreviewHealthy = false;
  const state = document.getElementById('agentPreviewState');
  const repairBtn = document.getElementById('agentRepairBtn');
  if (state) state.textContent = message || 'Preview issue';
  if (repairBtn) repairBtn.style.display = '';
}
function agentSetArtifactView(view){
  agentArtifactView = view === 'preview' ? 'preview' : 'code';
  const codeBtn = document.getElementById('agentCodeToggle');
  const previewBtn = document.getElementById('agentPreviewToggle');
  if(codeBtn) codeBtn.classList.toggle('active', agentArtifactView === 'code');
  if(previewBtn) previewBtn.classList.toggle('active', agentArtifactView === 'preview');
  const wrap = document.getElementById('agentPreviewWrap');
  const list = document.getElementById('agentArtifactList');
  if(list) list.style.display = agentArtifactView === 'code' ? '' : 'none';
  if(wrap && agentArtifactView === 'preview' && agentPreviewingId) wrap.style.display = 'flex';
  if(wrap && agentArtifactView === 'code') wrap.style.display = 'none';
}
async function agentRepairPreview(){
  const current = agentArtifacts.find(a=>a.id===agentPreviewingId) || agentArtifacts[agentArtifacts.length-1];
  const name = current?.name || 'the latest artifact';
  const inp = document.getElementById('agentInput');
  if(inp){
    inp.value = `The preview for ${name} did not render successfully. Inspect the artifact, fix any HTML/CSS/JavaScript errors, recreate the artifact, and show the preview again.`;
    agentSend();
  }
}
function agentClosePreview() {
  const wrap = document.getElementById('agentPreviewWrap');
  const frame = document.getElementById('agentPreviewFrame');
  if (wrap) wrap.style.display = 'none';
  if (frame) frame.src = 'about:blank';
  agentPreviewingId = null;
  const state = document.getElementById('agentPreviewState');
  if (state) state.textContent = 'No preview';
}
function agentOpenPreviewFull() {
  if (agentPreviewingId) window.open(`/api/artifact/${agentPreviewingId}/preview`,'_blank');
}
async function agentDownloadArtifact(id) {
  const d = await api(`artifact/${id}`);
  if (!d.content) return;
  const blob = new Blob([d.content], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = d.name || `artifact-${id}.txt`;
  a.click(); URL.revokeObjectURL(a.href);
  toast('Downloaded: ' + (d.name||id));
}
async function agentDeleteArtifact(id) {
  await fetch(`/api/artifact/${id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({_delete:true})});
  agentArtifacts = agentArtifacts.filter(a=>a.id!==id);
  const count = document.getElementById('agentArtifactCount');
  if (count) count.textContent = agentArtifacts.length;
  agentRenderArtifactList();
  if (agentPreviewingId === id) agentClosePreview();
  toast('Artifact deleted');
}

function agentShowChoices(question, options) {
  const wrap = document.getElementById('agentChoices');
  const qEl = document.getElementById('agentQuestion');
  const opts = document.getElementById('agentOptions');
  if (!wrap || !qEl || !opts) return;
  qEl.textContent = question;
  opts.innerHTML = options.map((o,i) => `
    <button class="bigbtn" onclick="agentPickOption('${escHtml(o.label||o)}')">${escHtml(o.label||o)}</button>`
  ).join('');
  wrap.style.display = 'block';
}
function agentPickOption(label) {
  const wrap = document.getElementById('agentChoices');
  if (wrap) wrap.style.display = 'none';
  // Send the chosen option as the next message
  const inp = document.getElementById('agentInput');
  if (inp) inp.value = label;
  agentSend();
}

function agentUpdatePlan(planText) {
  agentCurrentPlan = planText;
  const bar = document.getElementById('agentPlanBar');
  const content = document.getElementById('agentPlanContent');
  const execBtn = document.getElementById('agentPlanExec');
  if (bar) bar.style.display = 'block';
  if (execBtn) execBtn.style.display = 'inline-flex';
  if (!content) return;
  // Render checklist
  const lines = planText.split('\n');
  content.innerHTML = lines.map(l => {
    const done = /^\s*-\s*\[x\]/i.test(l);
    const pending = /^\s*-\s*\[\s*\]/.test(l);
    if (done || pending) {
      const text = l.replace(/^\s*-\s*\[.\]\s*/,'');
      return `<div class="plan-step ${done?'done':''}"><input type="checkbox" ${done?'checked':''} disabled><span>${escHtml(text)}</span></div>`;
    }
    if (/^#+\s/.test(l)) { var ht=l.replace(/^#+\s*/,''); return '<div style="font-weight:700;color:var(--t1);font-size:12px;margin:4px 0">'+escHtml(ht)+'</div>'; }
    return l.trim() ? `<div style="font-size:12px;color:var(--t2)">${escHtml(l)}</div>` : '';
  }).join('');
}
function agentExecutePlan() {
  if (!agentCurrentPlan) return;
  agentSetMode('build');
  const inp = document.getElementById('agentInput');
  if (inp) inp.value = `Execute this plan:\n${agentCurrentPlan}`;
  agentSend();
}
function agentEditPlan() {
  const inp = document.getElementById('agentInput');
  if (inp && agentCurrentPlan) {
    inp.value = 'Revise the plan: ';
    inp.focus();
  }
}

function agentClearHistory() {
  agentHistory = []; agentArtifacts = []; agentCurrentPlan = '';
  if (agentEventSource) { agentEventSource.close(); agentEventSource = null; }
  const msgs = document.getElementById('agentMsgs');
  if (msgs) msgs.innerHTML = `<div id="agentWelcome" style="text-align:center;padding:48px 20px;color:var(--t3)">
    <div style="font-size:40px;margin-bottom:14px;opacity:.4">◈</div>
    <div style="font-size:16px;font-weight:700;color:var(--t1);margin-bottom:6px">Chinna Agent</div>
    <div style="font-size:13px;line-height:1.6">Ready for a new session.</div>
  </div>`;
  const count = document.getElementById('agentArtifactCount');
  if (count) count.textContent = '0';
  const list = document.getElementById('agentArtifactList');
  if (list) list.innerHTML = '';
  agentCloseArtifacts();
  agentSetStatus(false);
}

async function agentSend() {
  if (agentRunning) return;
  const inp = document.getElementById('agentInput');
  const message = inp ? inp.value.trim() : '';
  if (!message) return;
  if (inp) { inp.value = ''; inp.style.height = 'auto'; }

  agentAddMsg('user', message);
  agentHistory.push({ role: 'user', content: message });

  agentSetStatus(true, 'thinking…');

  let aiMsgEl = null;
  let toolInputBuffer = '';
  let currentTool = null;

  try {
    // Use fetch with ReadableStream for SSE
    const resp = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message, mode: agentMode,
        history: agentHistory.slice(-20),
        model: currentModel
      })
    });

    if (!resp.ok) throw new Error('Server error: ' + resp.status);
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let aiText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        let evt;
        try { evt = JSON.parse(line.slice(6)); } catch { continue; }

        if (evt.type === 'mode') {
          // mode confirmed
        } else if (evt.type === 'sandbox') {
          agentSetStatus(true, 'sandbox ready');
        } else if (evt.type === 'text') {
          if (!aiMsgEl) aiMsgEl = agentAddMsg('ai', '');
          agentAppendText(aiMsgEl, evt.content);
          aiText += evt.content;
        } else if (evt.type === 'tool_start') {
          agentSetStatus(true, `running ${evt.tool}…`);
          currentTool = evt.tool; toolInputBuffer = evt.input || '';
        } else if (evt.type === 'tool_result') {
          agentAddToolBlock(currentTool || evt.tool, toolInputBuffer, evt.result);
          currentTool = null; toolInputBuffer = '';
          agentSetStatus(true, 'thinking…');
        } else if (evt.type === 'artifact') {
          agentAddArtifact(evt.meta);
        } else if (evt.type === 'plan') {
          agentUpdatePlan(evt.content);
        } else if (evt.type === 'ask_user') {
          agentShowChoices(evt.question, evt.options || []);
          agentSetStatus(false);
          return;
        } else if (evt.type === 'error') {
          if (!aiMsgEl) aiMsgEl = agentAddMsg('ai', '');
          agentAppendText(aiMsgEl, '⚠ ' + evt.content);
          agentSetStatus(false);
          return;
        } else if (evt.type === 'done') {
          if (evt.plan && evt.plan !== agentCurrentPlan) agentUpdatePlan(evt.plan);
          if (evt.artifacts) evt.artifacts.forEach(a => {
            if (!agentArtifacts.find(x=>x.id===a.id)) agentAddArtifact(a);
          });
          agentSetStatus(false);
        }
      }
    }

    if (aiText) agentHistory.push({ role: 'assistant', content: aiText });
    agentSetStatus(false);

  } catch (err) {
    const errEl = agentAddMsg('ai','');
    agentAppendText(errEl, '⚠ Agent error: ' + err.message);
    agentSetStatus(false);
  }
}


// ── macOS genie dock magnification ────────────────────────────
(function(){
  var dock = document.getElementById('dock');
  if(!dock) return;
  var BASE = 40, PEAK = 68, RANGE = 130;
  function gauss(d){ return Math.exp(-(d*d)/(2*RANGE*RANGE/9)); }
  function update(cx){
    var items = dock.querySelectorAll('.dapp');
    items.forEach(function(el){
      var r = el.getBoundingClientRect();
      var center = r.left + r.width/2;
      var dist = Math.abs(cx - center);
      var scale = 1 + (PEAK/BASE - 1) * gauss(dist);
      var tx = (scale - 1) * (cx > center ? -2 : 2);
      el.style.transform = 'translateY(' + (-(scale-1)*BASE*.8) + 'px) scale(' + scale + ')';
      el.style.zIndex = Math.round(scale * 10);
    });
  }
  function reset(){
    dock.querySelectorAll('.dapp').forEach(function(el){
      el.style.transform = ''; el.style.zIndex = '';
    });
  }
  dock.addEventListener('mousemove', function(e){ update(e.clientX); });
  dock.addEventListener('mouseleave', reset);
})();

// ── Resizable sidebar ─────────────────────────────────────────
(function(){
  var nav = document.getElementById('nav');
  var handle = document.getElementById('nav-resize');
  if(!nav||!handle) return;
  var dragging=false, sx=0, sw=0;
  handle.addEventListener('mousedown',function(e){
    dragging=true; sx=e.clientX; sw=nav.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.cssText='cursor:col-resize;user-select:none';
    e.preventDefault();
  });
  document.addEventListener('mousemove',function(e){
    if(!dragging) return;
    nav.style.width = Math.max(160,Math.min(300,sw+(e.clientX-sx)))+'px';
  });
  document.addEventListener('mouseup',function(){
    if(!dragging) return;
    dragging=false; handle.classList.remove('dragging');
    document.body.style.cssText='';
    localStorage.setItem('cx_nav_w', nav.style.width);
  });
  var saved=localStorage.getItem('cx_nav_w');
  if(saved) nav.style.width=saved;
})();

// ── Collapsible nav sections ──────────────────────────────────
(function(){
  var nav=document.getElementById('nav');
  if(!nav) return;
  nav.querySelectorAll('.navlabel').forEach(function(label){
    if(label.querySelector('.arrow')) return;
    var arr=document.createElement('span');
    arr.className='arrow'; arr.textContent='▾';
    label.prepend(arr);
    var key='cx_sec_'+(label.textContent||'').trim().replace(/\s+/g,'_');
    if(localStorage.getItem(key)==='1'){
      label.classList.add('collapsed');
      toggle(label,true);
    }
    label.onclick=function(){
      var c=label.classList.toggle('collapsed');
      toggle(label,c);
      localStorage.setItem(key,c?'1':'0');
    };
  });
  function toggle(label, hide){
    var el=label.nextElementSibling;
    while(el && !el.classList.contains('navlabel')){
      if(el.classList.contains('navitem')) el.classList.toggle('nav-hidden',hide);
      el=el.nextElementSibling;
    }
  }
})();

// ── Center toast ──────────────────────────────────────────────
window.toast = function(msg, type, dur){
  var c=document.getElementById('toasts');
  if(!c) return;
  var t=document.createElement('div');
  t.className='toast'+(type?' '+type:'');
  if(type==='success') t.innerHTML='<span style="font-weight:800">\u2713</span><span>'+msg+'</span>';
  else if(type==='error') t.innerHTML='<span style="font-weight:800">\u2715</span><span>'+msg+'</span>';
  else t.textContent=msg;
  c.appendChild(t);
  setTimeout(function(){
    t.style.cssText='opacity:0;transform:translateY(4px);transition:all .2s';
    setTimeout(function(){t.remove();},220);
  }, dur||3200);
};


(function(){
  'use strict';
  var dock=document.getElementById('dock');
  var dockWrap=document.getElementById('dock-wrap');
  if(!dock||!dockWrap) return;
  var BASE=46, PEAK=74, RANGE=120;
  var items=[].slice.call(dock.querySelectorAll('.dapp'));
  var raf=null, lastX=null, inside=false;
  var hideTimer=null, isVisible=false;
  
  function sigma(){return RANGE/2.6;}
  function apply(){
    raf=null;
    if(!inside||lastX===null){return;}
    var s=sigma();
    items.forEach(function(el){
      var r=el.getBoundingClientRect(),c=r.left+r.width/2,d=Math.abs(lastX-c);
      var g=Math.exp(-(d*d)/(2*s*s));
      var sc=1+(PEAK/BASE-1)*g;
      el.style.transform='translateY('+(-(sc-1)*BASE*0.8)+'px) scale('+sc.toFixed(3)+')';
      el.style.transition='transform .05s linear';
      el.classList.toggle('show-tip', g>0.62);
    });
  }
  
  // macOS auto-hide behavior
  function showDock(){
    if(isVisible) return;
    isVisible=true;
    dockWrap.classList.add('dock-visible');
    if(hideTimer) clearTimeout(hideTimer);
  }
  function scheduleDockHide(){
    if(hideTimer) clearTimeout(hideTimer);
    hideTimer=setTimeout(function(){
      if(!inside){
        isVisible=false;
        dockWrap.classList.remove('dock-visible');
      }
    }, 800);
  }
  
  // Show dock when cursor approaches bottom edge
  document.addEventListener('mousemove', function(e){
    if(window.innerHeight - e.clientY < 20){
      showDock();
    }
  });
  
  dock.addEventListener('mouseenter',function(){
    inside=true;
    showDock();
  });
  dock.addEventListener('mousemove',function(e){
    lastX=e.clientX; inside=true;
    showDock();
    if(!raf) raf=requestAnimationFrame(apply);
  });
  dock.addEventListener('mouseleave',function(){
    inside=false; lastX=null;
    if(raf){cancelAnimationFrame(raf);raf=null;}
    items.forEach(function(el){
      el.style.transition='transform .22s cubic-bezier(.2,.9,.3,1.2)';
      el.style.transform='';
      el.classList.remove('show-tip');
    });
    scheduleDockHide();
  });
  
  // Start with dock visible briefly, then auto-hide
  setTimeout(function(){
    showDock();
    setTimeout(scheduleDockHide, 2000);
  }, 500);
  
  /* sync active dot */
  var origGo=window.go;
  if(typeof origGo==='function'){
    window.go=function(v){
      origGo(v);
      items.forEach(function(el){
        el.classList.toggle('nav-active', el.getAttribute('data-v')===v);
      });
    };
  }
})();
