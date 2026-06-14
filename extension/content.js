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
