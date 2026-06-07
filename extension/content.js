(() => {
  if (window.__chinnaRuntimeHookInstalled) return;
  window.__chinnaRuntimeHookInstalled = true;

  const KEY = '__chinna_runtime_events';
  const MAX = 80;
  const read = () => {
    try { return JSON.parse(sessionStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  };
  const write = (items) => {
    try { sessionStorage.setItem(KEY, JSON.stringify(items.slice(-MAX))); }
    catch {}
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'chinna-runtime') return;
    const items = read();
    items.push({ ...event.data.payload, at: Date.now(), url: location.href });
    write(items);
  });

  const script = document.createElement('script');
  script.textContent = `(() => {
    if (window.__chinnaPageHookInstalled) return;
    window.__chinnaPageHookInstalled = true;
    const emit = (payload) => window.postMessage({ source: 'chinna-runtime', payload }, '*');
    window.addEventListener('error', (e) => emit({
      kind: 'error',
      message: e.message || '',
      source: e.filename || '',
      line: e.lineno || 0,
      column: e.colno || 0,
      stack: e.error && e.error.stack ? String(e.error.stack).slice(0, 3000) : ''
    }));
    window.addEventListener('unhandledrejection', (e) => emit({
      kind: 'unhandledrejection',
      message: e.reason && e.reason.message ? e.reason.message : String(e.reason || ''),
      stack: e.reason && e.reason.stack ? String(e.reason.stack).slice(0, 3000) : ''
    }));
    ['error', 'warn'].forEach((level) => {
      const original = console[level];
      console[level] = function(...args) {
        emit({ kind: 'console', level, message: args.map((x) => {
          try { return typeof x === 'string' ? x : JSON.stringify(x); }
          catch { return String(x); }
        }).join(' ').slice(0, 3000) });
        return original.apply(this, args);
      };
    });
  })();`;
  (document.documentElement || document.head || document.body).appendChild(script);
  script.remove();
})();
