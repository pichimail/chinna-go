(() => {
  const THINKING_STATES = [
    "Thinking through this page…",
    "Reading the structure…",
    "Pulling the important details together…",
    "Shaping a clean answer…"
  ];

  const state = {
    shell: document.body.dataset.shell || "popup",
    tab: null,
    profile: null,
    lastScan: null,
    lastLocal: null,
    attachments: [],
    thinkingTimer: null,
    pollTimer: null
  };

  const $ = (id) => document.getElementById(id);
  const msg = (payload) => chrome.runtime.sendMessage(payload);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function toast(text) {
    const el = $("toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(window.__chinnaToast);
    window.__chinnaToast = setTimeout(() => el.classList.remove("show"), 1900);
  }

  function setThinking(active, label) {
    const wrap = $("thinking");
    const text = $("thinkingText");
    if (!active) {
      wrap.hidden = true;
      clearInterval(state.thinkingTimer);
      return;
    }
    let index = 0;
    wrap.hidden = false;
    text.textContent = label || THINKING_STATES[0];
    clearInterval(state.thinkingTimer);
    state.thinkingTimer = setInterval(() => {
      index = (index + 1) % THINKING_STATES.length;
      text.textContent = THINKING_STATES[index];
    }, 1400);
  }

  function addBubble(role, text, meta) {
    const root = $("conversation");
    const article = document.createElement("article");
    article.className = `bubble ${role}`;
    article.innerHTML = `
      <span class="meta">${escapeHtml(meta || (role === "user" ? "You" : role === "system" ? "Workspace" : "Chinna"))}</span>
      <p>${escapeHtml(text)}</p>
    `;
    root.appendChild(article);
    root.scrollTop = root.scrollHeight;
  }

  function clearConversation() {
    $("conversation").innerHTML = "";
    addBubble("assistant", "Hey Buddy. I’m watching this tab and I’ll keep the prompts relevant to what’s open.");
  }

  function currentHost() {
    try {
      return new URL(state.tab?.url || "").hostname.replace(/^www\./, "") || "this site";
    } catch {
      return "this site";
    }
  }

  function renderMetrics() {
    $("scoreValue").textContent = state.lastLocal?.score ?? "--";
    $("issueCount").textContent = Array.isArray(state.lastLocal?.findings) ? state.lastLocal.findings.length : 0;
    $("errorCount").textContent = Array.isArray(state.lastScan?.errors) ? state.lastScan.errors.length : 0;
    $("nodeCount").textContent = state.lastScan?.counts?.nodes ?? "--";
    $("siteBrief").textContent = state.profile?.summary || "Open a page and I’ll shape the suggestions around it.";
  }

  function renderSiteContext() {
    $("greeting").textContent = "Hey Buddy";
    $("subGreeting").textContent = state.profile?.summary || "I’ll stay calm, clear, and tuned to this tab.";
    $("hostPill").textContent = currentHost();
    $("modePill").textContent = state.shell === "sidepanel" ? "Side panel mode" : "Popup mode";
    $("memoryPill").textContent = `Smart prompts • ${state.profile?.vibe || "general"}`;
  }

  function renderSuggestions() {
    const wrap = $("suggestions");
    wrap.innerHTML = "";
    (state.profile?.suggestions || [
      "What matters most on this page?",
      "What should be improved here first?"
    ]).forEach((text) => {
      const button = document.createElement("button");
      button.className = "suggestion-btn";
      button.type = "button";
      button.textContent = text;
      button.addEventListener("click", () => {
        $("prompt").value = text;
        analyze(text);
      });
      wrap.appendChild(button);
    });
  }

  async function refreshContext(announce) {
    try {
      const res = await msg({ type: "get-tab-context" });
      if (!res?.ok) return;
      const changed = state.tab && state.tab.url !== res.tab.url;
      state.tab = res.tab;
      state.profile = res.site;
      renderSiteContext();
      renderSuggestions();
      renderMetrics();
      if (announce && changed) {
        addBubble("system", "I refreshed the suggestions for the new tab.");
        state.lastScan = null;
        state.lastLocal = null;
        renderMetrics();
      }
    } catch {}
  }

  async function runScan(silent = false) {
    const button = $("scanBtn");
    button.disabled = true;
    if (!silent) addBubble("user", "Scan this page and show me what stands out.");
    setThinking(true, "Reading the page…");
    try {
      const res = await msg({ type: "scan" });
      if (!res?.ok) throw new Error(res?.error || "Scan failed");
      state.lastScan = res.scan;
      state.lastLocal = res.local;
      renderMetrics();
      if (!silent) addBubble("assistant", `I scanned ${currentHost()} and pulled out the key things that look worth fixing.`);
      toast("Scan complete");
    } catch (error) {
      addBubble("assistant", error.message || String(error));
      toast(error.message || String(error));
    } finally {
      setThinking(false);
      button.disabled = false;
    }
  }

  async function analyze(prefilled) {
    const prompt = String(prefilled || $("prompt").value || "").trim() || state.profile?.suggestions?.[0] || "Give me the clearest next steps for this page.";
    $("prompt").value = "";
    addBubble("user", prompt);

    if (!state.lastScan) await runScan(true);
    if (!state.lastScan) return;

    const analyzeBtn = $("analyzeBtn");
    analyzeBtn.disabled = true;
    setThinking(true);

    try {
      const fullPrompt = `${prompt}\n\nStyle: ${$("styleSelect").value}. Keep it natural and conversational.`;
      const res = await msg({
        type: "analyze",
        prompt: fullPrompt,
        scan: state.lastScan,
        attachments: state.attachments
      });
      if (!res?.ok) throw new Error(res?.error || "Analysis failed");
      state.lastLocal = res.data;
      renderMetrics();
      addBubble("assistant", res.data?.answer || res.data?.summary || res.data?.message || "I reviewed the page and turned it into calm next steps.");
      toast("Answer ready");
    } catch (error) {
      addBubble("assistant", error.message || String(error));
      toast(error.message || String(error));
    } finally {
      analyzeBtn.disabled = false;
      setThinking(false);
    }
  }

  function initSplitter() {
    const splitter = $("splitter");
    let startX = 0;
    let startWidth = 250;

    splitter.addEventListener("mousedown", (event) => {
      startX = event.clientX;
      startWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--rail-size")) || 250;
      const onMove = (moveEvent) => {
        const delta = moveEvent.clientX - startX;
        const next = Math.max(190, Math.min(360, startWidth + delta));
        document.documentElement.style.setProperty("--rail-size", `${next}px`);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function wire() {
    clearConversation();
    initSplitter();

    $("composer").addEventListener("submit", (event) => {
      event.preventDefault();
      analyze();
    });

    $("scanBtn").addEventListener("click", () => runScan(false));
    $("clearBtn").addEventListener("click", clearConversation);
    $("sidePanelBtn").addEventListener("click", async () => {
      const res = await msg({ type: "open-sidepanel" });
      toast(res?.ok ? "Side panel opened" : res?.error || "Could not open side panel");
    });
    $("panelModeBtn").addEventListener("click", async () => {
      const res = await msg({ type: "open-sidepanel" });
      toast(res?.ok ? "Side panel opened" : res?.error || "Could not open side panel");
    });
    $("attachBtn").addEventListener("click", async () => {
      const res = await msg({ type: "toggle-overlay" });
      toast(res?.ok ? "Attached to tab" : res?.error || "Could not attach");
    });
    $("overlayModeBtn").addEventListener("click", async () => {
      const res = await msg({ type: "toggle-overlay" });
      toast(res?.ok ? "Attached to tab" : res?.error || "Could not attach");
    });
    $("modeToggleBtn").addEventListener("click", async () => {
      if (state.shell === "popup") {
        const res = await msg({ type: "open-sidepanel" });
        toast(res?.ok ? "Switched to side panel" : res?.error || "Could not switch");
      } else {
        const res = await msg({ type: "toggle-overlay" });
        toast(res?.ok ? "Attached to tab" : res?.error || "Could not attach");
      }
    });
    $("copyScanBtn").addEventListener("click", async () => {
      await navigator.clipboard.writeText(JSON.stringify(state.lastScan || {}, null, 2));
      toast("Copied");
    });
    $("pageBriefBtn").addEventListener("click", async () => {
      const text = [
        `Site: ${currentHost()}`,
        state.profile?.summary || "",
        state.lastScan?.title ? `Page: ${state.lastScan.title}` : ""
      ].filter(Boolean).join("\n");
      await navigator.clipboard.writeText(text);
      toast("Copied");
    });

    refreshContext();
    state.pollTimer = setInterval(() => refreshContext(true), 1800);
  }

  wire();
})();
