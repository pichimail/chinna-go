let lastScan = null;
let lastLocal = null;
let attachments = [];

const $ = (id) => document.getElementById(id);
const msg = (payload) => chrome.runtime.sendMessage(payload);

function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(window.__chinnaToast);
  window.__chinnaToast = setTimeout(() => el.classList.remove("show"), 1800);
}

function setHealth(ok, text) {
  $("health").classList.toggle("ok", ok);
  $("health").classList.toggle("bad", !ok);
  $("healthText").textContent = text;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function copy(text) {
  navigator.clipboard.writeText(text).then(() => toast("Copied"));
}

function addBubble(role, html) {
  const root = $("conversation");
  const article = document.createElement("article");
  article.className = `bubble ${role}`;
  article.innerHTML = html;
  root.appendChild(article);
  root.scrollTop = root.scrollHeight;
  return article;
}

function resetConversation() {
  $("conversation").innerHTML = "";
}

function setContext(scan) {
  const title = scan?.title || scan?.url || "Current tab";
  const clean = title.length > 42 ? `${title.slice(0, 39)}...` : title;
  $("contextText").textContent = `Sharing "${clean}"`;
}

async function loadTabContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.title) setContext({ title: tab.title });
  } catch {
    setContext(null);
  }
}

function updateScore(data) {
  $("scoreValue").textContent = data?.score ?? "--";
  $("issueCount").textContent = (data?.findings || []).length;
  $("errorCount").textContent = (lastScan?.errors || []).length;
}

function findingsHtml(data) {
  const findings = data?.findings || [];
  if (!findings.length) {
    return '<span class="label">Scan</span><p>No major findings from the local scanner.</p>';
  }
  return `
    <span class="label">Findings</span>
    ${findings.slice(0, 5).map((f) => `
      <div class="finding">
        <span class="sev ${escapeHtml(f.severity || "low")}">${escapeHtml(f.severity || "info")}</span>
        <strong>${escapeHtml(f.title)}</strong>
        <p>${escapeHtml(f.detail)}</p>
        <code>${escapeHtml(f.fix)}</code>
      </div>
    `).join("")}
  `;
}

function commandsHtml(data) {
  const commands = data?.commands || [];
  if (!commands.length) return "";
  return `
    <span class="label">Commands</span>
    ${commands.map((command) => `
      <div class="command-card">
        <strong>Terminal</strong>
        <code>${escapeHtml(command)}</code>
        <div class="command-row">
          <button data-copy="${escapeHtml(command)}">Copy</button>
          <button data-run="${escapeHtml(command)}">Confirm Run</button>
        </div>
      </div>
    `).join("")}
  `;
}

function wireCommandButtons(root = document) {
  root.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", () => copy(button.dataset.copy));
  });
  root.querySelectorAll("[data-run]").forEach((button) => {
    button.addEventListener("click", () => runCommand(button.dataset.run, button));
  });
}

function renderLocalResult(data) {
  const findings = addBubble("assistant", findingsHtml(data));
  wireCommandButtons(findings);
  const commands = commandsHtml(data);
  if (commands) {
    const commandBubble = addBubble("system", commands);
    wireCommandButtons(commandBubble);
  }
}

function renderAnswer(data) {
  const text = data?.ai_reply || data?.summary || "Analysis ready.";
  const model = data?.model || $("modeSelect").value || "local";
  const html = `
    <span class="label">${escapeHtml(model)}</span>
    <p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>
  `;
  addBubble("assistant", html);
}

async function checkHealth() {
  const res = await msg({ type: "health" });
  if (res?.ok) {
    setHealth(true, res.data.ai_ready ? "AI ready" : "Local ready");
  } else {
    setHealth(false, "Offline");
    addBubble("assistant", '<span class="label">Offline</span><p>Start Chinna first: chinna dashboard</p>');
  }
}

async function runScan(options = {}) {
  const button = $("scanBtn");
  button.disabled = true;
  button.textContent = "Scanning";
  if (options.reset !== false) {
    resetConversation();
    addBubble("user", '<span class="label">You</span><p>Scan this tab.</p>');
  }
  try {
    const res = await msg({ type: "scan" });
    if (!res?.ok) throw new Error(res?.error || "Scan failed");
    lastScan = res.scan;
    lastLocal = res.local;
    setContext(lastScan);
    updateScore(lastLocal);
    if (options.render !== false) renderLocalResult(lastLocal);
    toast("Scan complete");
  } catch (error) {
    const text = error.message || String(error);
    toast(text);
    addBubble("assistant", `<span class="label">Scan failed</span><p>${escapeHtml(text)}</p>`);
  } finally {
    button.disabled = false;
    button.textContent = "Scan";
  }
}

function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      resolve({
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        data_b64: dataUrl.split(",")[1] || ""
      });
    };
    reader.readAsDataURL(file);
  });
}

async function handleFiles(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  attachments = await Promise.all(files.map(fileToAttachment));
  const res = await msg({ type: "upload", attachments });
  if (!res?.ok) {
    toast(res?.error || "Upload failed");
    return;
  }
  const names = attachments.map((file) => file.name).join(", ");
  addBubble("user", `<span class="label">Upload</span><p>${escapeHtml(names)}</p>`);
  addBubble("assistant", `<span class="label">Files</span><p>${attachments.length} file(s) ready for analysis.</p>`);
  toast(`${attachments.length} file(s) uploaded`);
}

async function analyze() {
  const prompt = $("prompt").value.trim() || "Analyze this page and give exact fix commands.";
  resetConversation();
  addBubble("user", `<span class="label">You</span><p>${escapeHtml(prompt)}</p>`);
  if (!lastScan) {
    await runScan({ reset: false, render: false });
  }
  if (!lastScan) return;
  const button = $("analyzeBtn");
  button.disabled = true;
  button.textContent = "...";
  try {
    const res = await msg({
      type: "analyze",
      scan: lastScan,
      prompt,
      attachments
    });
    if (!res?.ok) throw new Error(res?.error || "Analysis failed");
    lastLocal = res.data;
    updateScore(lastLocal);
    renderLocalResult(lastLocal);
    renderAnswer(lastLocal);
    toast("Chinna answered");
  } catch (error) {
    const text = error.message || String(error);
    toast(text);
    addBubble("assistant", `<span class="label">Error</span><p>${escapeHtml(text)}</p>`);
  } finally {
    button.disabled = false;
    button.textContent = "▶";
  }
}

async function runCommand(command, button) {
  if (!confirm(`Run this through local Chinna?\n\n${command}`)) return;
  button.disabled = true;
  button.textContent = "Running";
  try {
    const res = await msg({
      type: "command-plan",
      body: {
        command,
        scan: lastScan || {},
        confirmed: true
      }
    });
    if (!res?.ok) throw new Error(res?.error || "Command failed");
    const data = res.data || {};
    const output = [
      `$ ${data.command || command}`,
      data.stdout || "",
      data.stderr ? `stderr:\n${data.stderr}` : "",
      data.error ? `error: ${data.error}` : ""
    ].filter(Boolean).join("\n\n");
    addBubble("system", `<span class="label">Terminal</span><code>${escapeHtml(output)}</code>`);
    toast(data.ok ? "Command finished" : "Command returned output");
  } catch (error) {
    toast(error.message || String(error));
  } finally {
    button.disabled = false;
    button.textContent = "Confirm Run";
  }
}

function quick(action) {
  if (action === "scan") {
    $("prompt").value = "";
    runScan();
    return;
  }
  if (action === "errors") {
    $("prompt").value = "Find console and runtime errors on this page and give exact fixes.";
    analyze();
    return;
  }
  if (action === "commands") {
    $("prompt").value = "Give only the safest terminal commands and code prompts to fix this page.";
    analyze();
  }
}

$("scanBtn").addEventListener("click", () => runScan());
$("analyzeBtn").addEventListener("click", analyze);
$("fileInput").addEventListener("change", handleFiles);
$("copyScanBtn").addEventListener("click", () => copy(JSON.stringify(lastScan || {}, null, 2)));
$("openDashboard").addEventListener("click", () => chrome.tabs.create({ url: "http://localhost:7777" }));
$("clearBtn").addEventListener("click", () => {
  resetConversation();
  addBubble("assistant", '<span class="label">Chinna</span><p>Ready.</p>');
});
document.querySelectorAll("[data-quick]").forEach((button) => {
  button.addEventListener("click", () => quick(button.dataset.quick));
});
$("prompt").addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") analyze();
});

loadTabContext();
checkHealth().catch(() => setHealth(false, "Offline"));
