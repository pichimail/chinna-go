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
  const title = document.title;
  const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
  const headings = [...document.querySelectorAll('h1,h2,h3')].slice(0,40).map(h=>clean(h.textContent)).filter(Boolean);
  const paras = [...document.querySelectorAll('p,li')].map(p=>clean(p.textContent)).filter(t=>t.length>40).slice(0,120);
  const links = [...document.querySelectorAll('a[href]')].slice(0,60).map(a=>({t:clean(a.textContent).slice(0,80), href:a.href})).filter(l=>l.t);
  const tables = [...document.querySelectorAll('table')].slice(0,5).map(tb=>{
    return [...tb.querySelectorAll('tr')].slice(0,30).map(tr=>[...tr.querySelectorAll('td,th')].map(td=>clean(td.textContent)).join(' | ')).join('\n');
  });
  return { title, metaDesc, headings, paras, links, tables, url: location.href };
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
