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

function updateScore(data) {
  $("scoreValue").textContent = data?.score ?? "--";
  $("issueCount").textContent = (data?.findings || []).length;
  $("errorCount").textContent = (lastScan?.errors || []).length;
}

function renderFindings(data) {
  const findings = data?.findings || [];
  const root = $("findings");
  if (!findings.length) {
    root.className = "stack empty";
    root.textContent = "No major findings from the local scanner.";
    return;
  }
  root.className = "stack";
  root.innerHTML = findings.map((f) => `
    <article class="finding">
      <span class="sev ${escapeHtml(f.severity || "low")}">${escapeHtml(f.severity || "info")}</span>
      <strong>${escapeHtml(f.title)}</strong>
      <p>${escapeHtml(f.detail)}</p>
      <code>${escapeHtml(f.fix)}</code>
    </article>
  `).join("");
}

function renderCommands(data) {
  const commands = data?.commands || [];
  const root = $("commands");
  if (!commands.length) {
    root.className = "stack empty";
    root.textContent = "No terminal commands suggested yet.";
    return;
  }
  root.className = "stack";
  root.innerHTML = commands.map((command) => `
    <article class="command">
      <strong>Terminal</strong>
      <code>${escapeHtml(command)}</code>
      <div class="row">
        <button data-copy="${escapeHtml(command)}">Copy</button>
        <button data-run="${escapeHtml(command)}">Confirm Run</button>
      </div>
    </article>
  `).join("");

  root.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", () => copy(button.dataset.copy));
  });
  root.querySelectorAll("[data-run]").forEach((button) => {
    button.addEventListener("click", () => runCommand(button.dataset.run, button));
  });
}

function renderAnswer(data) {
  $("model").textContent = data?.model || "local";
  $("answer").textContent = data?.ai_reply || data?.summary || "Analysis ready.";
}

async function checkHealth() {
  const res = await msg({ type: "health" });
  if (res?.ok) {
    setHealth(true, res.data.ai_ready ? "AI ready" : "Local ready");
  } else {
    setHealth(false, "Offline");
    $("answer").textContent = "Start Chinna first: chinna dashboard";
  }
}

async function runScan() {
  const button = $("scanBtn");
  button.disabled = true;
  button.textContent = "Scanning...";
  try {
    const res = await msg({ type: "scan" });
    if (!res?.ok) throw new Error(res?.error || "Scan failed");
    lastScan = res.scan;
    lastLocal = res.local;
    updateScore(lastLocal);
    renderFindings(lastLocal);
    renderCommands(lastLocal);
    renderAnswer(lastLocal);
    toast("Scan complete");
  } catch (error) {
    toast(error.message || String(error));
    $("answer").textContent = error.message || String(error);
  } finally {
    button.disabled = false;
    button.innerHTML = '<span class="icon">⌁</span> Scan Active Site';
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
  toast(`${attachments.length} file(s) uploaded`);
}

async function analyze() {
  if (!lastScan) {
    await runScan();
  }
  if (!lastScan) return;
  const button = $("analyzeBtn");
  button.disabled = true;
  button.textContent = "Thinking";
  try {
    const res = await msg({
      type: "analyze",
      scan: lastScan,
      prompt: $("prompt").value,
      attachments
    });
    if (!res?.ok) throw new Error(res?.error || "Analysis failed");
    lastLocal = res.data;
    updateScore(lastLocal);
    renderFindings(lastLocal);
    renderCommands(lastLocal);
    renderAnswer(lastLocal);
    toast("Chinna answered");
  } catch (error) {
    toast(error.message || String(error));
    $("answer").textContent = error.message || String(error);
  } finally {
    button.disabled = false;
    button.textContent = "Send to Chinna";
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
    $("answer").textContent = [
      `$ ${data.command || command}`,
      data.stdout || "",
      data.stderr ? `stderr:\n${data.stderr}` : "",
      data.error ? `error: ${data.error}` : ""
    ].filter(Boolean).join("\n\n");
    toast(data.ok ? "Command finished" : "Command returned output");
  } catch (error) {
    toast(error.message || String(error));
  } finally {
    button.disabled = false;
    button.textContent = "Confirm Run";
  }
}

$("scanBtn").addEventListener("click", runScan);
$("analyzeBtn").addEventListener("click", analyze);
$("fileInput").addEventListener("change", handleFiles);
$("copyScanBtn").addEventListener("click", () => copy(JSON.stringify(lastScan || {}, null, 2)));
$("openDashboard").addEventListener("click", () => chrome.tabs.create({ url: "http://localhost:7777" }));

checkHealth().catch(() => setHealth(false, "Offline"));
