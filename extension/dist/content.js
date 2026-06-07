// Chinna AI — content script
// Collects page context, exposes it via chrome.runtime messaging

function collectPageData() {
  const url      = location.href;
  const title    = document.title;
  const meta     = {};
  document.querySelectorAll("meta[name],meta[property]").forEach(m => {
    const key = m.getAttribute("name") || m.getAttribute("property");
    if(key) meta[key] = m.getAttribute("content");
  });
  const headings = Array.from(document.querySelectorAll("h1,h2,h3")).slice(0,12)
    .map(h => ({ level: h.tagName, text: h.innerText.trim().slice(0,120) }));
  const links = Array.from(document.querySelectorAll("a[href]")).slice(0,30)
    .map(a => a.href);
  const images = Array.from(document.querySelectorAll("img[src]")).slice(0,10)
    .map(i => ({ src: i.src, alt: i.alt }));
  const inputs  = document.querySelectorAll("input,textarea,select").length;
  const inputs_unlabeled = Array.from(document.querySelectorAll("input,textarea,select")).filter((el) => {
    if (el.type === "hidden") return false;
    if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) return false;
    if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return false;
    if (el.closest("label")) return false;
    return true;
  }).length;
  const scripts = Array.from(document.querySelectorAll("script[src]")).map(s=>s.src).slice(0,8);
  const bodyText = document.body?.innerText?.slice(0,4000) || "";
  const errors   = window.__chinnaErrors || [];

  return { url, title, meta, headings, links, images, inputs, scripts, bodyText, errors,
           inputs_unlabeled, nodes: document.querySelectorAll("*").length,
           ts: Date.now(), viewport: { w: innerWidth, h: innerHeight } };
}

// capture console errors
window.__chinnaErrors = [];
const _onerror = window.onerror;
window.onerror = function(msg, src, line, col, err) {
  window.__chinnaErrors.push({ msg, src, line, col, stack: err?.stack?.slice(0,200) });
  if(window.__chinnaErrors.length > 50) window.__chinnaErrors.shift();
  return _onerror?.apply(this, arguments) ?? false;
};
const _ce = console.error.bind(console);
console.error = (...a) => { window.__chinnaErrors.push({ msg: a.map(String).join(" "), src:"console", ts: Date.now() }); _ce(...a); };

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if(msg.type === "GET_PAGE_DATA") { reply(collectPageData()); return true; }
  if(msg.type === "HIGHLIGHT") {
    const el = document.querySelector(msg.selector);
    if(el) { el.scrollIntoView({ behavior:"smooth", block:"center" });
      el.style.outline="2px solid #7c6ef7"; el.style.outlineOffset="3px";
      setTimeout(()=>{ el.style.outline=""; el.style.outlineOffset=""; }, 2000); }
    reply({ ok: !!el }); return true;
  }
});
