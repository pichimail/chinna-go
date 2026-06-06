const CHINNA_API = "http://localhost:7777";

async function api(path, options = {}) {
  const res = await fetch(`${CHINNA_API}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
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

function classifySite(tab = {}) {
  const url = tab.url || "";
  const title = tab.title || "Current tab";

  let hostname = "site";
  let pathname = "/";

  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.replace(/^www\./, "") || hostname;
    pathname = parsed.pathname || pathname;
  } catch {}

  const haystack = `${hostname} ${pathname} ${title}`.toLowerCase();

  let vibe = "general";
  let summary = `I’m tuned to ${hostname} and can keep the conversation natural and relevant to this page.`;
  let suggestions = [
    "What is this page mainly trying to do?",
    "What looks unclear or broken here?",
    "Give me the next best improvements for this page.",
    "Summarize this page in a friendly, simple way."
  ];

  if (/(login|signup|register|auth|forgot|reset)/.test(haystack)) {
    vibe = "auth";
    summary = `This looks like an account or sign-in flow on ${hostname}. I can help spot friction, confusing copy, and trust issues.`;
    suggestions = [
      "What could make this sign-in flow feel smoother?",
      "Do you notice trust or clarity issues on this auth page?",
      "How can this page reduce drop-off for first-time users?",
      "Give me practical UX fixes for this login or signup screen."
    ];
  } else if (/(product|pricing|cart|checkout|shop|store)/.test(haystack)) {
    vibe = "commerce";
    summary = `This feels like a shopping or conversion-focused page on ${hostname}. I can focus on trust, clarity, and conversion friction.`;
    suggestions = [
      "What might stop someone from converting on this page?",
      "How can this page feel more trustworthy and easier to scan?",
      "Give me quick UX and copy upgrades for this product flow.",
      "What should stand out more clearly on this commerce page?"
    ];
  } else if (/(dashboard|admin|workspace|portal|analytics|app)/.test(haystack)) {
    vibe = "dashboard";
    summary = `This looks like an app workspace or dashboard on ${hostname}. I can focus on clarity, hierarchy, and task flow.`;
    suggestions = [
      "What feels noisy or overwhelming in this dashboard?",
      "How can the layout feel calmer and easier to use?",
      "What actions should be more obvious on this screen?",
      "Give me clean UI improvements for this workspace."
    ];
  } else if (/(docs|guide|help|developer|reference|api)/.test(haystack)) {
    vibe = "docs";
    summary = `This page looks documentation-heavy. I can help turn it into clearer guidance, cleaner navigation, and better reading flow.`;
    suggestions = [
      "What makes this documentation harder to scan?",
      "How could this page explain things more clearly?",
      "What headings or sections should be reorganized here?",
      "Summarize this doc page in a more conversational style."
    ];
  } else if (/(blog|article|news|post|story)/.test(haystack)) {
    vibe = "content";
    summary = `This feels like an article or content page on ${hostname}. I can focus on reading flow, trust, and content structure.`;
    suggestions = [
      "Give me a simple summary of this page.",
      "What would improve readability and flow here?",
      "What feels too dense or easy to skip on this page?",
      "How can this page feel more human and conversational?"
    ];
  } else if (/(watch|video|stream|media|player|youtube)/.test(haystack)) {
    vibe = "media";
    summary = `This looks like a media-heavy page on ${hostname}. I can help evaluate focus, controls, and distraction points.`;
    suggestions = [
      "What distracts from the main content here?",
      "How can the player area feel cleaner and easier to use?",
      "What UI elements should be quieter on this media page?",
      "Give me a quick usability review of this screen."
    ];
  } else if (/(github|gitlab|bitbucket|repo|pull|issue)/.test(haystack)) {
    vibe = "repo";
    summary = `This looks like a code or repo page on ${hostname}. I can help summarize context, surface issues, and suggest next actions.`;
    suggestions = [
      "Summarize what matters on this repo page.",
      "What should I pay attention to first here?",
      "Turn this page into a quick actionable brief.",
      "What looks risky, missing, or unclear on this developer page?"
    ];
  }

  return {
    hostname,
    pathname,
    title,
    vibe,
    summary,
    suggestions,
    greeting: "Hey Buddy"
  };
}

async function ensureContent(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  } catch (error) {
    const message = String(error?.message || error || "");
    if (!/already injected|cannot access|Frame with ID 0/.test(message)) {
      throw error;
    }
  }
}

async function scanActiveTab() {
  const tab = await activeTab();
  if (!/^https?:\/\//.test(tab.url || "")) {
    throw new Error("Open a normal http or https page before scanning.");
  }

  await ensureContent(tab.id);

  const response = await chrome.tabs.sendMessage(tab.id, {
    type: "CHINNA_SCAN_PAGE",
    source: "background"
  });

  if (!response || !response.ok) {
    throw new Error(response?.error || "Scan failed");
  }

  return response.scan;
}

async function openSidePanelForCurrentTab() {
  const tab = await activeTab();
  await chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: "sidepanel.html",
    enabled: true
  });
  await chrome.sidePanel.open({ tabId: tab.id });
  return tab;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "health") {
      sendResponse({ ok: true, data: await api("/api/extension/health") });
      return;
    }

    if (message.type === "get-tab-context") {
      const tab = await activeTab();
      sendResponse({
        ok: true,
        tab: {
          id: tab.id,
          title: tab.title || "",
          url: tab.url || "",
          favIconUrl: tab.favIconUrl || ""
        },
        site: classifySite(tab)
      });
      return;
    }

    if (message.type === "open-sidepanel") {
      const tab = await openSidePanelForCurrentTab();
      sendResponse({ ok: true, tabId: tab.id });
      return;
    }

    if (message.type === "toggle-overlay") {
      const tab = await activeTab();
      await ensureContent(tab.id);
      const response = await chrome.tabs.sendMessage(tab.id, { type: "CHINNA_TOGGLE_OVERLAY" });
      sendResponse({ ok: true, data: response || {} });
      return;
    }

    if (message.type === "scan") {
      const scan = await scanActiveTab();
      const local = await api("/api/extension/scan", {
        method: "POST",
        body: { scan }
      });
      sendResponse({ ok: true, scan, local });
      return;
    }

    if (message.type === "analyze") {
      const data = await api("/api/extension/analyze", {
        method: "POST",
        body: {
          scan: message.scan || {},
          prompt: message.prompt || "Give me the clearest, calmest next steps for this page.",
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
  })().catch((error) => {
    sendResponse({ ok: false, error: error.message || String(error) });
  });

  return true;
});
