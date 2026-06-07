// Chinna AI — shared JS for popup.html + sidepanel.html
// v7.0.0

const CHINNA = "http://localhost:7777";
const IS_PANEL = !!document.querySelector('.resize-handle');

// ── Suggestion sets keyed by URL pattern ───────────────────────
const SUGGESTION_MAP = [
  { test: /github\.com/, tips: ["Summarise this repo", "List open issues", "Explain the tech stack", "Review latest commits"] },
  { test: /localhost|127\.0\.0\.1/, tips: ["Scan for console errors", "Check accessibility", "Find performance bottlenecks", "Describe the page layout"] },
  { test: /supabase\.com/, tips: ["Explain this table schema", "Find slow queries", "Review RLS policies", "Suggest index improvements"] },
  { test: /vercel\.com/, tips: ["Check deployment status", "Review env variables", "Optimise build config", "Explain this project"] },
  { test: /figma\.com/, tips: ["Describe this design", "Check colour contrast", "Flag spacing issues", "Suggest improvements"] },
  { test: /youtube\.com/, tips: ["What's this video about?", "Summarise the description", "Key topics covered"] },
  { test: /stackoverflow\.com|stackexchange\.com/, tips: ["Explain the problem", "Is the accepted answer best?", "Simpler solution?"] },
  { test: /npmjs\.com/, tips: ["Summarise this package", "List peer dependencies", "Is it well-maintained?"] },
  { test: /docs\./, tips: ["Summarise this page", "Give me a quick example", "What are the gotchas?"] },
];
const DEFAULT_TIPS = ["Summarise this page", "Find issues", "What can I do here?", "Scan for errors"];

function getSuggestions(url) {
  if(!url) return DEFAULT_TIPS;
  for(const { test, tips } of SUGGESTION_MAP) {
    if(test.test(url)) return tips;
  }
  // generic domain-based hint
  try {
    const host = new URL(url).hostname.replace("www.", "");
    return [`What does ${host} show?`, "Summarise this page", "Find issues", "Scan for errors"];
  } catch(_) { return DEFAULT_TIPS; }
}

// ── DOM refs ────────────────────────────────────────────────────
const conv        = document.getElementById("conversation");
const welcome     = document.getElementById("welcome");
const sugsEl      = document.getElementById("suggestions");
const promptEl    = document.getElementById("prompt");
const scanBtn     = document.getElementById("scanBtn");
const analyzeBtn  = document.getElementById("analyzeBtn");
const clearBtn    = document.getElementById("clearBtn");
const fileInput   = document.getElementById("fileInput");
const attachBar   = document.getElementById("attachBar");
const attachNames = document.getElementById("attachNames");
const clearAttach = document.getElementById("clearAttach");
const ctxText     = document.getElementById("contextText");
const ctxScanBtn  = document.getElementById("ctxScanBtn");
const modelSel    = document.getElementById("modelSelect");
const healthEl    = document.getElementById("health");
const healthTxt   = document.getElementById("healthText");
const toast       = document.getElementById("toast");
const openSidePanel = document.getElementById("openSidePanel"); // popup only
const copyScanBtn = document.getElementById("copyScanBtn");
const statsRow    = document.getElementById("statsRow");
const scoreEl     = document.getElementById("scoreValue");
const issueEl     = document.getElementById("issueCount");
const errorEl     = document.getElementById("errorCount");
const miniIssueEl = document.getElementById("miniIssueVal");
const miniErrEl   = document.getElementById("miniErrVal");

// ── State ────────────────────────────────────────────────────────
let lastScan   = null;
let activeTab  = null;
let attachedFiles = [];

const THEME_ICONS = {
  dark: '<path d="M13 8.6A5.2 5.2 0 0 1 7.4 3a4.9 4.9 0 1 0 5.6 5.6Z"/>',
  light: '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"/>'
};

function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  const icon = document.getElementById("themeIcon");
  if(icon) icon.innerHTML = next === "light" ? THEME_ICONS.light : THEME_ICONS.dark;
}

async function initTheme() {
  const stored = await chrome.storage.local.get("chinna_extension_theme").catch(()=>({}));
  applyTheme(stored.chinna_extension_theme || "dark");
}

async function ensureContentScript(tabId) {
  if(!tabId) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  } catch(_) {
    // Static content script usually already exists; this is only for tabs opened before install/reload.
  }
}

// ── Health check ─────────────────────────────────────────────────
function setHealth(ok) {
  if(!healthEl) return;
  healthEl.className = "health-pill " + (ok ? "ok" : "bad");
  healthTxt.textContent = ok ? "ready" : "offline";
}
chrome.runtime.sendMessage({ type: "PING_HEALTH" }, r => setHealth(r?.ok));
chrome.runtime.onMessage.addListener(msg => { if(msg.type === "HEALTH") setHealth(msg.ok); });

// ── Tabs & suggestions ────────────────────────────────────────────
async function loadTab(tab) {
  activeTab = tab;
  if(!tab) return;
  try {
    const host = new URL(tab.url).hostname.replace("www.", "");
    if(ctxText) ctxText.textContent = host || tab.title || "Current tab";
  } catch(_) {
    if(ctxText) ctxText.textContent = tab.title || "Current tab";
  }
  renderSuggestions(tab.url);
}
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  return tab;
}
(async () => {
  const tab = await getCurrentTab();
  loadTab(tab);
})();
chrome.tabs.onActivated.addListener(async({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  loadTab(tab);
  clearConversation(false);
});
chrome.tabs.onUpdated.addListener(async(tabId, info, tab) => {
  if(info.status === "complete") {
    const [cur] = await chrome.tabs.query({ active:true, currentWindow:true });
    if(cur?.id === tabId) loadTab(tab);
  }
});

function renderSuggestions(url) {
  if(!sugsEl) return;
  sugsEl.innerHTML = "";
  const tips = getSuggestions(url);
  tips.forEach(t => {
    const b = document.createElement("button");
    b.className = "sug-btn fade-up";
    b.textContent = t;
    b.addEventListener("click", () => {
      promptEl.value = t;
      sendMessage();
    });
    sugsEl.appendChild(b);
  });
}

// ── Toast ───────────────────────────────────────────────────────
function showToast(msg, ms=2200) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), ms);
}

// ── Conversation ─────────────────────────────────────────────────
function hideWelcome() {
  if(welcome) welcome.style.display = "none";
}
function clearConversation(keepWelcome=true) {
  if(!conv) return;
  conv.innerHTML = "";
  if(keepWelcome && welcome) {
    welcome.style.display = "";
    conv.appendChild(welcome);
  }
  lastScan = null;
  if(statsRow)    statsRow.style.display = "none";
  if(scoreEl)     scoreEl.textContent = "--";
  if(issueEl)     issueEl.textContent = "0";
  if(errorEl)     errorEl.textContent = "0";
  if(miniIssueEl) miniIssueEl.textContent = "0";
  if(miniErrEl)   miniErrEl.textContent = "0";
}

function addBubble(role, html, label="") {
  hideWelcome();
  const art = document.createElement("article");
  art.className = `bubble ${role} fade-up`;
  if(label) {
    const lbl = document.createElement("div");
    lbl.className = "b-label";
    lbl.textContent = label;
    art.appendChild(lbl);
  }
  const p = document.createElement("p");
  p.innerHTML = html;
  art.appendChild(p);
  conv.appendChild(art);
  conv.scrollTop = conv.scrollHeight;
  return art;
}

function addThinking() {
  hideWelcome();
  const art = document.createElement("article");
  art.className = "bubble assistant fade-up";
  art.id = "__thinking__";
  art.innerHTML = `<div class="b-label">Chinna</div><div class="thinking">
    <span></span><span></span><span></span></div>`;
  conv.appendChild(art);
  conv.scrollTop = conv.scrollHeight;
  return art;
}
function removeThinking() {
  document.getElementById("__thinking__")?.remove();
}

function escapeHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function formatResponse(text) {
  if(!text) return "";
  // code blocks
  text = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_,c) => `<code>${escapeHtml(c.trim())}</code>`);
  // inline code
  text = text.replace(/`([^`]+)`/g, (_, c) => `<code style="display:inline;padding:1px 5px;font-size:11px">${escapeHtml(c)}</code>`);
  // bold
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // newlines
  text = text.replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>");
  return text;
}

// ── Stats update ──────────────────────────────────────────────────
function updateStats(data) {
  const issues = (data.findings?.length || data.issues?.length || data.suggestions?.length || 0);
  const errors = (data.errors?.length || 0);
  const score  = data.score ?? data.health_score ?? "--";
  if(statsRow)    statsRow.style.display = "flex";
  if(scoreEl)     scoreEl.textContent = typeof score==="number" ? Math.round(score) : score;
  if(issueEl)     issueEl.textContent = issues;
  if(errorEl)     errorEl.textContent = errors;
  if(miniIssueEl) { miniIssueEl.textContent = issues; }
  if(miniErrEl)   { miniErrEl.textContent = errors; }
}

function renderCommandCards(commands = []) {
  commands.slice(0, 6).forEach((command) => {
    const safe = escapeHtml(command);
    const bubble = addBubble("system", `<code>${safe}</code><div class="cmd-row"><button type="button" class="copy-command">Copy command</button></div>`, "Fix command");
    bubble.querySelector(".copy-command")?.addEventListener("click", () => {
      navigator.clipboard.writeText(command).then(() => showToast("Command copied"));
    });
  });
}

function buildScanPayload(pageData = {}) {
  const headings = Array.isArray(pageData.headings) ? pageData.headings : [];
  const images = Array.isArray(pageData.images) ? pageData.images : [];
  const errors = Array.isArray(pageData.errors) ? pageData.errors : [];
  return {
    page: {
      url: pageData.url || activeTab?.url || "",
      title: pageData.title || activeTab?.title || "",
      text_sample: pageData.bodyText || "",
      viewport: pageData.viewport || {}
    },
    meta: pageData.meta || {},
    counts: {
      h1: headings.filter(h => String(h.level || "").toUpperCase() === "H1").length,
      headings: headings.length,
      links: Array.isArray(pageData.links) ? pageData.links.length : 0,
      images: images.length,
      inputs: Number(pageData.inputs || 0),
      nodes: Number(pageData.nodes || 0)
    },
    accessibility: {
      images_missing_alt: images.filter(img => !String(img.alt || "").trim()).length,
      inputs_unlabeled: Number(pageData.inputs_unlabeled || 0)
    },
    errors: errors.map(e => ({
      message: e.message || e.msg || e.text || "",
      source: e.src || e.source || "runtime",
      line: e.line || 0,
      column: e.col || e.column || 0,
      stack: e.stack || ""
    })),
    console: [],
    resources: { failed: Array.isArray(pageData.failedResources) ? pageData.failedResources : [] },
    performance: pageData.performance || {},
    raw: pageData
  };
}

// ── Send message ──────────────────────────────────────────────────
async function sendMessage() {
  const text = promptEl.value.trim();
  if(!text) return;
  promptEl.value = "";
  addBubble("user", escapeHtml(text));
  const thinkEl = addThinking();

  let pageData = null;
  try {
    if(activeTab?.id) {
      await ensureContentScript(activeTab.id);
      pageData = await chrome.tabs.sendMessage(activeTab.id, { type:"GET_PAGE_DATA" });
    }
  } catch(_) {}

  const model = modelSel?.value === "local" ? "local" : "flash";
  const payload = { message: text, model, page_context: pageData, timestamp: Date.now() };

  if(attachedFiles.length) {
    const reads = await Promise.all(attachedFiles.map(f => new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => {
        const dataUrl = String(e.target.result || "");
        res({
          name: f.name,
          mime: f.type || "application/octet-stream",
          size: f.size,
          data_b64: dataUrl.split(",")[1] || ""
        });
      };
      r.onerror = rej;
      r.readAsDataURL(f);
    })));
    payload.attachments = reads;
  }

  try {
    const res = await fetch(`${CHINNA}/api/chat`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000)
    });
    removeThinking();
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const reply = data.reply || data.response || data.message || data.result || JSON.stringify(data);
    addBubble("assistant", formatResponse(reply), "Chinna");
  } catch(err) {
    removeThinking();
    addBubble("assistant", `<span style="color:var(--red)">${escapeHtml(err.message)}</span>`, "Chinna");
    if(err.message.includes("Failed to fetch") || err.message.includes("timeout")) {
      showToast("⚠️ Chinna server unreachable");
      setHealth(false);
    }
  }

  // clear attachments after send
  attachedFiles = [];
  if(attachBar) attachBar.style.display = "none";
}

// ── Scan ─────────────────────────────────────────────────────────
async function runScan() {
  if(!activeTab?.id) { showToast("No active tab"); return; }
  const thinkEl = addThinking();
  try {
    await ensureContentScript(activeTab.id);
    const pageData = await chrome.tabs.sendMessage(activeTab.id, { type:"GET_PAGE_DATA" });
    const scanPayload = buildScanPayload(pageData);
    const res = await fetch(`${CHINNA}/api/extension/scan`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ scan: scanPayload }),
      signal: AbortSignal.timeout(45000)
    });
    removeThinking();
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    lastScan = scanPayload;
    data.errors = scanPayload.errors || [];
    updateStats(data);

    const findings = data.findings || data.issues || [];
    if(findings.length) {
      findings.slice(0,6).forEach(f => {
        const sev = (f.severity||f.level||"low").toLowerCase();
        const title = f.title || f.message || f.description || "Finding";
        const detail = f.detail || f.fix || "";
        const html = `<span class="sev ${sev}">${sev.toUpperCase()}</span> ${escapeHtml(title)}${detail ? `<br><small>${escapeHtml(detail)}</small>` : ""}`;
        addBubble("assistant", html, "Chinna");
      });
    } else {
      addBubble("assistant", data.summary || "Scan complete — no major issues found.", "Chinna");
    }
    renderCommandCards(data.commands || []);
  } catch(err) {
    removeThinking();
    addBubble("assistant", `Scan failed: <span style="color:var(--red)">${escapeHtml(err.message)}</span>`, "Chinna");
    showToast("Scan failed");
  }
}

// ── Copy scan ─────────────────────────────────────────────────────
function copyScan() {
  if(!lastScan) { showToast("Nothing to copy yet"); return; }
  navigator.clipboard.writeText(JSON.stringify(lastScan, null, 2)).then(() => showToast("Copied!"));
}

// ── Attachments ───────────────────────────────────────────────────
fileInput?.addEventListener("change", () => {
  attachedFiles = Array.from(fileInput.files);
  if(attachedFiles.length && attachBar && attachNames) {
    attachBar.style.display = "flex";
    attachNames.textContent = attachedFiles.map(f=>f.name).join(", ");
  }
  fileInput.value = "";
});
clearAttach?.addEventListener("click", () => {
  attachedFiles = [];
  if(attachBar) attachBar.style.display = "none";
});

// ── Wire events ───────────────────────────────────────────────────
analyzeBtn?.addEventListener("click", sendMessage);
promptEl?.addEventListener("keydown", e => {
  if(e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
scanBtn?.addEventListener("click", runScan);
ctxScanBtn?.addEventListener("click", runScan);
clearBtn?.addEventListener("click", () => clearConversation(true));
copyScanBtn?.addEventListener("click", copyScan);
document.getElementById("themeBtn")?.addEventListener("click", async () => {
  const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const next = current === "light" ? "dark" : "light";
  applyTheme(next);
  await chrome.storage.local.set({ chinna_extension_theme: next }).catch(()=>{});
});

openSidePanel?.addEventListener("click", async () => {
  try {
    const tab = await getCurrentTab();
    await chrome.sidePanel.open({ windowId: tab.windowId });
    window.close();
  } catch(e) { showToast("Side panel not supported"); }
});

document.getElementById("openDashboard")?.addEventListener("click", () => {
  chrome.tabs.create({ url: "http://localhost:7777" });
});

document.getElementById("switchToPopup")?.addEventListener("click", () => {
  chrome.action.openPopup?.().catch?.(() => {});
});

initTheme();
