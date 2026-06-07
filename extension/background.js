// Chinna Tab Assistant — service worker
const CHINNA = 'http://localhost:7777';

chrome.action.onClicked.addListener(async (tab) => {
  try { await chrome.sidePanel.open({ tabId: tab.id }); } catch (e) {}
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(()=>{});
});

// Relay messages between side panel and content script / tab APIs
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'capture-screenshot') {
    chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
      sendResponse({ ok: !chrome.runtime.lastError, dataUrl, error: chrome.runtime.lastError?.message });
    });
    return true;
  }
  if (msg.type === 'get-active-tab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const t = tabs[0] || {};
      sendResponse({ url: t.url || '', title: t.title || '', id: t.id });
    });
    return true;
  }
  if (msg.type === 'run-in-tab') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const t = tabs[0];
      if (!t) { sendResponse({ ok: false, error: 'no active tab' }); return; }
      try {
        const [res] = await chrome.scripting.executeScript({
          target: { tabId: t.id },
          func: msg.func === 'scrape' ? scrapePage : clonePage,
          args: [msg.options || {}]
        });
        sendResponse({ ok: true, result: res.result });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    });
    return true;
  }
});

// Notify side panel when the active tab changes (for auto-switching suggestions)
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const t = await chrome.tabs.get(tabId);
    chrome.runtime.sendMessage({ type: 'tab-changed', url: t.url || '', title: t.title || '' }).catch(()=>{});
  } catch (e) {}
});
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.active) {
    chrome.runtime.sendMessage({ type: 'tab-changed', url: tab.url || '', title: tab.title || '' }).catch(()=>{});
  }
});

// ---- Injected: scrape readable page content ----
function scrapePage() {
  function clean(t){ return (t||'').replace(/\s+/g,' ').trim(); }
  function meta(sel){ return document.querySelector(sel)?.getAttribute('content') || document.querySelector(sel)?.getAttribute('href') || ''; }
  function metaMap(prefix){
    const out = {};
    document.querySelectorAll(`meta[${prefix}]`).forEach(m => {
      const key = (m.getAttribute(prefix) || '').replace(/^(og:|twitter:)/, '');
      if (key) out[key] = clean(m.getAttribute('content') || '');
    });
    return out;
  }
  function parseScriptJson(varName) {
    for (const s of document.scripts) {
      const txt = s.textContent || '';
      const ix = txt.indexOf(varName);
      if (ix < 0) continue;
      const eq = txt.indexOf('{', ix);
      if (eq < 0) continue;
      let depth = 0, end = -1, inStr = false, esc = false;
      for (let i = eq; i < txt.length; i++) {
        const ch = txt[i];
        if (inStr) {
          if (esc) esc = false;
          else if (ch === '\\') esc = true;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') inStr = true;
        else if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) { end = i + 1; break; }
        }
      }
      if (end > eq) {
        try { return JSON.parse(txt.slice(eq, end)); } catch(e) {}
      }
    }
    return null;
  }
  const title = clean(document.title);
  const metaDesc = clean(meta('meta[name="description"]'));
  const openGraph = metaMap('property');
  const twitter = metaMap('name');
  const canonical = meta('link[rel="canonical"]');
  const headings = [...document.querySelectorAll('h1,h2,h3')].slice(0,60).map(h=>clean(h.textContent)).filter(Boolean);
  const paras = [...document.querySelectorAll('p,li,#description-inline-expander,#description,yt-formatted-string')].map(p=>clean(p.textContent)).filter(t=>t.length>25).slice(0,140);
  const visibleText = clean(document.body?.innerText || '').slice(0, 10000);
  const links = [...document.querySelectorAll('a[href]')].slice(0,90).map(a=>({t:clean(a.textContent).slice(0,100), href:a.href})).filter(l=>l.t);
  const forms = [...document.querySelectorAll('form')].slice(0,20).map(f => ({
    action: f.action || '',
    method: f.method || 'get',
    inputs: [...f.querySelectorAll('input,textarea,select,button')].slice(0,40).map(i => ({
      name: i.name || '',
      type: i.type || i.tagName.toLowerCase(),
      label: clean(i.getAttribute('aria-label') || document.querySelector(`label[for="${i.id}"]`)?.textContent || '')
    }))
  }));
  const images = [...document.images].slice(0,80).map(img => ({src: img.currentSrc || img.src, alt: img.alt || '', w: img.naturalWidth || img.width, h: img.naturalHeight || img.height}));
  const media = [...document.querySelectorAll('video,audio')].slice(0,20).map(m => ({
    tag: m.tagName.toLowerCase(),
    src: m.currentSrc || m.src || '',
    duration: Number.isFinite(m.duration) ? m.duration : '',
    paused: !!m.paused,
    currentTime: Number.isFinite(m.currentTime) ? m.currentTime : '',
  }));
  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].slice(0,8).map(s => {
    try { return JSON.parse(s.textContent); } catch(e) { return clean(s.textContent).slice(0,1000); }
  });
  let runtimeEvents = [];
  try { runtimeEvents = JSON.parse(sessionStorage.getItem('__chinna_runtime_events') || '[]').slice(-80); } catch(e) {}
  const player = parseScriptJson('ytInitialPlayerResponse') || {};
  const playerDetails = player.videoDetails || {};
  const url = location.href;
  const urlObj = new URL(url);
  const videoId = urlObj.searchParams.get('v') || playerDetails.videoId || '';
  const descriptionNode = document.querySelector('#description-inline-expander, ytd-text-inline-expander, #description');
  const channelNode = document.querySelector('#owner #channel-name a, ytd-video-owner-renderer ytd-channel-name a, ytd-channel-name a');
  const hashtags = [...new Set((visibleText.match(/#[\p{L}\p{N}_-]+/gu) || []).slice(0,20))];
  const youtube = /(^|\.)youtube\.com$|youtu\.be$/.test(location.hostname) ? {
    videoId,
    url,
    title: clean(playerDetails.title || document.querySelector('h1 yt-formatted-string, h1')?.textContent || openGraph.title || title),
    channel: clean(playerDetails.author || channelNode?.textContent || ''),
    description: clean(playerDetails.shortDescription || descriptionNode?.textContent || metaDesc).slice(0, 5000),
    duration: playerDetails.lengthSeconds || '',
    keywords: playerDetails.keywords || [],
    hashtags,
    isLive: !!playerDetails.isLiveContent,
    viewsText: clean(document.querySelector('#info span, #count yt-formatted-string, span.view-count')?.textContent || ''),
    publishText: clean([...document.querySelectorAll('#info-strings yt-formatted-string, #date yt-formatted-string')].map(x => x.textContent).join(' ')),
    playback: media.find(m => m.tag === 'video') || null,
  } : null;
  const tables = [...document.querySelectorAll('table')].slice(0,5).map(tb=>{
    return [...tb.querySelectorAll('tr')].slice(0,30).map(tr=>[...tr.querySelectorAll('td,th')].map(td=>clean(td.textContent)).join(' | ')).join('\n');
  });
  return {
    url,
    title,
    metaDesc,
    meta: { description: metaDesc, canonical },
    openGraph,
    twitter,
    jsonLd,
    youtube,
    headings,
    paras,
    visibleText,
    links,
    forms,
    images,
    media,
    tables,
    errors: runtimeEvents.filter(e => e.kind === 'error' || e.kind === 'unhandledrejection'),
    console: runtimeEvents.filter(e => e.kind === 'console'),
    performance: {
      url,
      navigationType: performance.getEntriesByType?.('navigation')?.[0]?.type || '',
      timing: performance.getEntriesByType?.('navigation')?.[0]?.toJSON?.() || {},
    },
    counts: {
      h1: document.querySelectorAll('h1').length,
      links: document.querySelectorAll('a[href]').length,
      images: document.images.length,
      forms: document.forms.length,
    },
    accessibility: {
      images_missing_alt: [...document.images].filter(img => !img.hasAttribute('alt')).length,
      inputs_unlabeled: [...document.querySelectorAll('input,textarea,select')].filter(i => !i.labels?.length && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby')).length,
    }
  };
}

// ---- Injected: clone page into single self-contained HTML ----
async function clonePage() {
  async function toDataUri(url){
    try {
      const r = await fetch(url, { mode:'cors' });
      const b = await r.blob();
      return await new Promise(res=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=()=>res(url); fr.readAsDataURL(b); });
    } catch(e){ return url; }
  }
  // Inline stylesheets
  let css = '';
  for (const sheet of document.styleSheets) {
    try {
      const rules = sheet.cssRules;
      if (rules) { for (const r of rules) css += r.cssText + '\n'; }
    } catch(e) {
      if (sheet.href) { try { const t = await (await fetch(sheet.href)).text(); css += t + '\n'; } catch(_){} }
    }
  }
  // Clone DOM
  const doc = document.documentElement.cloneNode(true);
  // Remove scripts (keep behaviour CSS-driven; safer single-file)
  doc.querySelectorAll('script').forEach(s=>s.remove());
  doc.querySelectorAll('link[rel="stylesheet"]').forEach(l=>l.remove());
  // Inline images
  const imgs = [...doc.querySelectorAll('img')];
  for (const img of imgs) {
    const src = img.getAttribute('src');
    if (src && !src.startsWith('data:')) { img.setAttribute('src', await toDataUri(new URL(src, location.href).href)); }
    img.removeAttribute('srcset'); img.removeAttribute('loading');
  }
  // Inject collected CSS
  const styleTag = `<style>\n${css}\n/* chinna-clone: smooth */\n*{scroll-behavior:smooth}\na,button{transition:all .15s ease}\n</style>`;
  const head = doc.querySelector('head');
  if (head) head.insertAdjacentHTML('beforeend', styleTag);
  const html = '<!DOCTYPE html>\n' + doc.outerHTML;
  return { html, title: document.title, url: location.href, bytes: html.length };
}
