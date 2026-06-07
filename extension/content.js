(() => {
  if (window.top !== window) return;
  if (window.__chinnaRuntimeHookRequested) return;
  window.__chinnaRuntimeHookRequested = true;
  chrome.runtime.sendMessage({ type: 'install-runtime-hooks' }, () => void chrome.runtime.lastError);
})();
