const CHINNA = "http://localhost:7777";

chrome.action.onClicked.addListener(async(tab)=>{
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    await chrome.sidePanel.setOptions({ tabId: tab.id, path: "sidepanel.html", enabled: true });
  } catch(e) {
    // fallback: popup will open (declared in manifest)
    console.warn("Side panel open failed, falling back to popup:", e);
  }
});

// Keep side panel in sync on tab change
chrome.tabs.onActivated.addListener(async({ tabId })=>{
  try { await chrome.sidePanel.setOptions({ tabId, path:"sidepanel.html", enabled:true }); }
  catch(_){}
});

// Health ping every 30s → broadcast to popup/panel
let healthy = false;
async function pingChinna() {
  try {
    const r = await fetch(`${CHINNA}/api/extension/health`, { signal: AbortSignal.timeout(4000) });
    healthy = r.ok;
  } catch(_) { healthy = false; }
  try {
    const wins = await chrome.windows.getAll({ populate:false });
    for(const w of wins) {
      chrome.runtime.sendMessage({ type:"HEALTH", ok: healthy }).catch(()=>{});
    }
  } catch(_){}
  return healthy;
}
pingChinna();
setInterval(pingChinna, 30000);

chrome.runtime.onMessage.addListener((msg, _sender, reply)=>{
  if(msg.type === "PING_HEALTH") { reply({ ok: healthy }); return true; }
});
