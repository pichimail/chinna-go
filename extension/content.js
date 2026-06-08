/* Chinna Companion — content script: form field extraction + autofill */
'use strict';

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'GET_FORM_FIELDS') {
    const fields = [];
    document.querySelectorAll('input, textarea, select').forEach((el) => {
      const type = (el.type || el.tagName).toLowerCase();
      if (['hidden', 'submit', 'button', 'image', 'reset', 'file'].includes(type)) return;
      const name = el.name || el.id || el.placeholder || el.getAttribute('aria-label') || '';
      if (!name) return;
      const label = findLabel(el);
      fields.push({ name, type, label, placeholder: el.placeholder || '' });
    });
    reply(fields);
    return true;
  }

  if (msg.type === 'FILL_FORM') {
    let filled = 0;
    Object.entries(msg.values).forEach(([key, val]) => {
      const el = findField(key);
      if (el) {
        setNativeValue(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        flashField(el);
        filled++;
      }
    });
    reply({ filled });
    return true;
  }

  if (msg.type === 'GET_PAGE_TEXT') {
    reply({ title: document.title, url: location.href, text: document.body.innerText.slice(0, 10000) });
    return true;
  }

  if (msg.type === 'BROWSER_AUTOMATION') {
    reply(runBrowserAutomation(msg.action, msg.value));
    return true;
  }
});

function findLabel(el) {
  if (el.labels && el.labels[0]) return el.labels[0].innerText.trim().slice(0, 40);
  const wrap = el.closest('label');
  if (wrap) return wrap.innerText.trim().slice(0, 40);
  return '';
}
function findField(key) {
  const k = key.toLowerCase();
  let el = document.querySelector(`[name="${key}"], #${CSS.escape(key)}`);
  if (el) return el;
  // fuzzy match by name/placeholder/label
  const all = [...document.querySelectorAll('input, textarea, select')];
  return all.find((e) => {
    const hay = ((e.name || '') + (e.id || '') + (e.placeholder || '') + findLabel(e)).toLowerCase();
    return hay.includes(k) || k.includes((e.name || '').toLowerCase());
  });
}
function setNativeValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
    : el.tagName === 'SELECT' ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value); else el.value = value;
}
function flashField(el) {
  const orig = el.style.boxShadow;
  el.style.transition = 'box-shadow .3s';
  el.style.boxShadow = '0 0 0 2px #baff29';
  setTimeout(() => { el.style.boxShadow = orig; }, 700);
}

function clickableElements() {
  return [...document.querySelectorAll('a[href],button,[role="button"],input[type="button"],input[type="submit"],summary,[onclick]')]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none';
    })
    .slice(0, 80);
}

function elementLabel(el) {
  return (el.innerText || el.value || el.getAttribute('aria-label') || el.title || el.href || el.tagName)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
}

function clearAutomationBadges() {
  document.querySelectorAll('.chinna-click-badge').forEach((el) => el.remove());
}

function highlightClickTargets() {
  clearAutomationBadges();
  const els = clickableElements();
  window.__chinnaClickMap = els;
  els.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const badge = document.createElement('div');
    badge.className = 'chinna-click-badge';
    badge.textContent = String(i + 1);
    badge.style.cssText = `position:fixed;left:${Math.max(2, r.left)}px;top:${Math.max(2, r.top)}px;z-index:2147483647;background:#baff29;color:#06120a;border:1px solid #06120a;border-radius:4px;padding:1px 5px;font:700 11px system-ui;box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none`;
    document.documentElement.appendChild(badge);
  });
  return { summary: `Highlighted ${els.length} clickable targets. Use a number or visible text to click.` };
}

function clickElement(el) {
  if (!el) return { summary: 'Target not found.' };
  el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  setTimeout(() => {
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.click();
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, 160);
  return { summary: `Clicked: ${elementLabel(el)}` };
}

function runBrowserAutomation(action, value) {
  if (action === 'highlight') return highlightClickTargets();
  if (action === 'click-index') {
    const idx = Math.max(0, parseInt(value, 10) - 1);
    return clickElement((window.__chinnaClickMap || clickableElements())[idx]);
  }
  if (action === 'click-text') {
    const needle = String(value || '').toLowerCase();
    return clickElement(clickableElements().find((el) => elementLabel(el).toLowerCase().includes(needle)));
  }
  if (action === 'scroll-down') {
    window.scrollBy({ top: Math.round(window.innerHeight * 0.82), behavior: 'smooth' });
    return { summary: 'Scrolled down.' };
  }
  if (action === 'scroll-top') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return { summary: 'Scrolled to top.' };
  }
  if (action === 'extract') {
    const links = [...document.querySelectorAll('a[href]')].slice(0, 25).map((a) => `${elementLabel(a)} — ${a.href}`).join('\n');
    const headings = [...document.querySelectorAll('h1,h2,h3')].slice(0, 20).map(elementLabel).filter(Boolean).join('\n');
    return { summary: `Title: ${document.title}\nURL: ${location.href}\n\nHeadings:\n${headings || '—'}\n\nLinks:\n${links || '—'}` };
  }
  return { summary: 'Unknown browser automation action.' };
}
