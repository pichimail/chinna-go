const CHINNA_API = "http://localhost:7777";

async function api(path, options = {}) {
  const res = await fetch(`${CHINNA_API}${path}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data.error || `Chinna API ${res.status}`);
  }
  return data;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error("No active tab found");
  return tab;
}

async function scanActiveTab() {
  const tab = await activeTab();
  if (!/^https?:\/\//.test(tab.url || "")) {
    throw new Error("Open a normal http/https page before scanning");
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });

  const response = await chrome.tabs.sendMessage(tab.id, {
    type: "CHINNA_SCAN_PAGE",
    source: "popup"
  });

  if (!response || !response.ok) {
    throw new Error(response?.error || "Scan failed");
  }
  return response.scan;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "health") {
      sendResponse({ ok: true, data: await api("/api/extension/health") });
      return;
    }
    if (message.type === "scan") {
      const scan = await scanActiveTab();
      const local = await api("/api/extension/scan", { method: "POST", body: { scan } });
      sendResponse({ ok: true, scan, local });
      return;
    }
    if (message.type === "analyze") {
      const data = await api("/api/extension/analyze", {
        method: "POST",
        body: {
          scan: message.scan || {},
          prompt: message.prompt || "",
          attachments: message.attachments || []
        }
      });
      sendResponse({ ok: true, data });
      return;
    }
    if (message.type === "upload") {
      const data = await api("/api/extension/upload", {
        method: "POST",
        body: { attachments: message.attachments || [] }
      });
      sendResponse({ ok: true, data });
      return;
    }
    if (message.type === "command-plan") {
      const data = await api("/api/extension/command-plan", {
        method: "POST",
        body: message.body || {}
      });
      sendResponse({ ok: true, data });
      return;
    }
    sendResponse({ ok: false, error: "Unknown message" });
  })().catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});
