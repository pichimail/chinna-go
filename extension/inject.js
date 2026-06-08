/* Chinna Companion — page-context injected script (reserved for deep DOM/JS access) */
(function () {
  'use strict';
  window.__chinna__ = window.__chinna__ || {
    version: '2.0.0',
    getMeta() {
      const m = {};
      document.querySelectorAll('meta[property], meta[name]').forEach((el) => {
        const k = el.getAttribute('property') || el.getAttribute('name');
        if (k) m[k] = el.getAttribute('content');
      });
      return m;
    },
  };
})();
