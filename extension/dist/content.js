(() => {
  if (window.__CHINNA_ASSISTANT__) {
    window.__CHINNA_ASSISTANT__.toggle();
    return;
  }

  const state = {
    installedAt: Date.now(),
    console: [],
    errors: [],
    resources: [],
    longTasks: 0,
    lastScan: null,
    overlay: null,
    shadow: null,
    visible: false,
    currentUrl: location.href
  };

  const trim = (value, max = 1200) => String(value ?? "").slice(0, max);
  const push = (bucket, item, limit = 80) => {
    bucket.push({ at: Date.now(), ...item });
    if (bucket.length > limit) bucket.shift();
  };

  ["log", "warn", "error"].forEach((level) => {
    const original = console[level];
    if (typeof original !== "function") return;
    console[level] = function chinnaConsoleProxy(...args) {
      push(state.console, {
        level,
        text: args.map((arg) => {
          try { return typeof arg === "string" ? arg : JSON.stringify(arg); }
          catch { return String(arg); }
        }).join(" ").slice(0, 1800)
      });
      return original.apply(this, args);
    };
  });

  window.addEventListener("error", (event) => {
    const target = event.target;
    if (target && target !== window && target.tagName) {
      push(state.resources, {
        tag: target.tagName,
        url: target.currentSrc || target.src || target.href || "",
        outer: trim(target.outerHTML, 500)
      });
      return;
    }
    push(state.errors, {
      message: trim(event.message || "Runtime error"),
      filename: event.filename || "",
      lineno: event.lineno || 0,
      colno: event.colno || 0,
      stack: trim(event.error?.stack || "", 2200)
    });
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    push(state.errors, {
      message: trim(event.reason?.message || event.reason || "Unhandled promise rejection"),
      stack: trim(event.reason?.stack || "", 2200),
      type: "unhandledrejection"
    });
  });

  try {
    const observer = new PerformanceObserver((list) => {
      state.longTasks += list.getEntries().length;
    });
    observer.observe({ type: "longtask", buffered: true });
  } catch {}

  function textOf(selector, limit = 40) {
    return Array.from(document.querySelectorAll(selector)).slice(0, limit).map((node) => ({
      text: trim(node.innerText || node.textContent || "", 220),
      id: node.id || "",
      class: trim(node.className || "", 120)
    })).filter((x) => x.text || x.id || x.class);
  }

  function visibleTextSample() {
    const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
    return text.slice(0, 2500);
  }

  function collectScan() {
    const images = Array.from(document.images || []);
    const inputs = Array.from(document.querySelectorAll("input, textarea, select"));
    const links = Array.from(document.links || []);
    const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
    const metas = Object.fromEntries(
      Array.from(document.querySelectorAll("meta[name], meta[property]")).slice(0, 80).map((meta) => [
        meta.getAttribute("name") || meta.getAttribute("property"),
        meta.getAttribute("content") || ""
      ])
    );
    const nav = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource").slice(-120);

    const scan = {
      collected_at: new Date().toISOString(),
      scanner: {
        name: "chinna-extension",
        injected_at: new Date(state.installedAt).toISOString(),
        live_capture_note: "Console capture starts when Chinna injects the scanner."
      },
      page: {
        url: location.href,
        origin: location.origin,
        title: document.title || "",
        lang: document.documentElement.lang || "",
        charset: document.characterSet || "",
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          device_pixel_ratio: window.devicePixelRatio || 1
        },
        meta: {
          description: metas.description || "",
          ogTitle: metas["og:title"] || "",
          ogDescription: metas["og:description"] || "",
          canonical: document.querySelector('link[rel="canonical"]')?.href || "",
          robots: metas.robots || ""
        },
        counts: {
          nodes: document.querySelectorAll("*").length,
          h1: document.querySelectorAll("h1").length,
          h2: document.querySelectorAll("h2").length,
          links: links.length,
          buttons: buttons.length,
          forms: document.forms.length,
          images: images.length,
          scripts: document.scripts.length,
          stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length
        },
        headings: {
          h1: textOf("h1", 12),
          h2: textOf("h2", 24),
          h3: textOf("h3", 24)
        },
        performance: {
          dom_complete_ms: nav ? Math.round(nav.domComplete) : 0,
          load_event_ms: nav ? Math.round(nav.loadEventEnd) : 0,
          transfer_size: resources.reduce((sum, item) => sum + (item.transferSize || 0), 0),
          long_tasks: state.longTasks
        },
        console: state.console.slice(-60),
        errors: state.errors.slice(-40),
        samples: {
          links: links.slice(0, 20).map((a) => ({ text: trim(a.innerText || a.textContent || "", 120), href: a.href })),
          buttons: buttons.slice(0, 20).map((b) => ({ text: trim(b.innerText || b.textContent || b.getAttribute("aria-label") || "", 120) })),
          text: visibleTextSample()
        }
      },
      title: document.title || "",
      url: location.href,
      counts: {
        nodes: document.querySelectorAll("*").length,
        links: links.length,
        buttons: buttons.length
      },
      errors: state.errors.slice(-40)
    };

    state.lastScan = scan;
    return scan;
  }

  function ensureOverlay() {
    if (state.overlay) return;

    const host = document.createElement("div");
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.zIndex = "2147483647";
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .panel {
          position: fixed;
          top: 24px;
          right: 24px;
          width: 460px;
          height: min(82vh, 760px);
          display: none;
          grid-template-columns: 180px 8px minmax(0,1fr);
          grid-template-rows: auto auto 1fr auto;
          color: #f3f7ff;
          background: linear-gradient(180deg, rgba(13,19,36,.92), rgba(10,15,29,.92));
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 24px;
          box-shadow: 0 30px 80px rgba(0,0,0,.38);
          backdrop-filter: blur(18px);
          overflow: hidden;
        }
        .panel.visible { display: grid; }
        .header, .hero, .composer { grid-column: 1 / -1; }
        .header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,.08);
          cursor: move; background: rgba(255,255,255,.03);
        }
        .brand { display:flex; gap:12px; align-items:center; }
        .brand img { width:38px; height:38px; border-radius:12px; padding:5px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); }
        .eyebrow { color:#8aa0c4; font-size:11px; text-transform:uppercase; letter-spacing:.12em; }
        h2 { margin:2px 0 0; font-size:20px; font-weight:600; }
        .actions { display:flex; gap:8px; }
        .icon, button, textarea, select { border:1px solid rgba(255,255,255,.09); background:rgba(255,255,255,.035); color:#f3f7ff; border-radius:14px; }
        button { cursor:pointer; }
        .icon { width:34px; height:34px; display:inline-flex; align-items:center; justify-content:center; position:relative; }
        .icon[data-tip]:hover::after { content: attr(data-tip); position:absolute; top:calc(100% + 8px); right:0; white-space:nowrap; font-size:11px; padding:6px 8px; border-radius:10px; background:rgba(10,15,29,.96); border:1px solid rgba(255,255,255,.1); }
        .hero { padding:0 16px 14px; border-bottom:1px solid rgba(255,255,255,.08); }
        .hero p { margin:0 0 10px; color:#aebbd2; font-size:13px; line-height:1.5; }
        .pills { display:flex; flex-wrap:wrap; gap:8px; }
        .pill { min-height:28px; display:inline-flex; align-items:center; padding:0 10px; border-radius:999px; border:1px solid rgba(255,255,255,.08); color:#aebbd2; background:rgba(255,255,255,.04); font-size:12px; }
        .rail { padding:12px; display:flex; flex-direction:column; gap:12px; overflow:auto; }
        .card { border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03); border-radius:18px; padding:12px; }
        .card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; color:#aebbd2; font-size:13px; }
        .suggestions { display:flex; flex-direction:column; gap:8px; }
        .suggestion { width:100%; text-align:left; padding:12px; }
        .splitter { position:relative; cursor:col-resize; }
        .splitter::before { content:""; position:absolute; left:2px; top:12px; bottom:12px; width:4px; border-radius:999px; background:linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.03)); }
        .chat { padding:12px; display:flex; flex-direction:column; gap:12px; min-width:0; }
        .conversation { flex:1; min-height:180px; overflow:auto; display:flex; flex-direction:column; gap:10px; }
        .bubble { max-width:92%; padding:14px; border-radius:18px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); }
        .bubble.user { align-self:flex-end; background:rgba(136,168,255,.13); }
        .bubble.assistant, .bubble.system { align-self:flex-start; }
        .meta { display:block; margin-bottom:8px; color:#8aa0c4; font-size:11px; letter-spacing:.08em; text-transform:uppercase; }
        .bubble p { margin:0; font-size:13px; line-height:1.52; white-space:pre-wrap; }
        .composer { padding:12px; border-top:1px solid rgba(255,255,255,.08); display:flex; flex-direction:column; gap:10px; }
        textarea { width:100%; min-height:90px; resize:vertical; padding:14px; outline:none; line-height:1.55; }
        .row { display:flex; gap:8px; align-items:center; }
        select { height:38px; padding:0 12px; }
        .send { margin-left:auto; height:38px; padding:0 14px; }
        .resize-edge { position:absolute; left:0; top:0; bottom:0; width:10px; cursor:ew-resize; }
        .resize-corner { position:absolute; right:10px; bottom:10px; width:16px; height:16px; border-right:2px solid rgba(255,255,255,.16); border-bottom:2px solid rgba(255,255,255,.16); cursor:nwse-resize; }
      </style>
      <div class="panel" id="panel">
        <div class="resize-edge" id="resizeEdge"></div>
        <div class="header" id="dragHandle">
          <div class="brand">
            <img src="${chrome.runtime.getURL("icon.svg")}" alt="Chinna" />
            <div>
              <div class="eyebrow">Chinna assistant</div>
              <h2>Hey Buddy</h2>
            </div>
          </div>
          <div class="actions">
            <button class="icon" id="scanBtn" data-tip="Scan page">⌁</button>
            <button class="icon" id="sideBtn" data-tip="Open side panel">⇢</button>
            <button class="icon" id="closeBtn" data-tip="Close">✕</button>
          </div>
        </div>
        <div class="hero">
          <p>I’ll stay calm, clear, and tuned to this tab.</p>
          <div class="pills">
            <span class="pill">${location.hostname.replace(/^www\./, "")}</span>
            <span class="pill">Attached mode</span>
            <span class="pill">Smart prompts</span>
          </div>
        </div>
        <aside class="rail" id="rail">
          <div class="card">
            <div class="card-head"><span>Quick suggestions</span></div>
            <div class="suggestions" id="suggestions"></div>
          </div>
        </aside>
        <div class="splitter" id="splitter"></div>
        <section class="chat">
          <div class="conversation" id="conversation"></div>
        </section>
        <form class="composer" id="composer">
          <textarea id="prompt" placeholder="Ask naturally about this page…"></textarea>
          <div class="row">
            <select id="styleSelect">
              <option value="gentle">Gentle</option>
              <option value="focused">Focused</option>
              <option value="actionable">Actionable</option>
            </select>
            <button type="submit" class="send">Send</button>
          </div>
        </form>
        <div class="resize-corner" id="resizeCorner"></div>
      </div>
    `;

    state.overlay = host;
    state.shadow = shadow;

    const q = (id) => shadow.getElementById(id);
    const addBubble = (role, text, meta = role === "user" ? "You" : "Chinna") => {
      const article = document.createElement("article");
      article.className = `bubble ${role}`;
      article.innerHTML = `<span class="meta">${meta}</span><p>${text}</p>`;
      q("conversation").appendChild(article);
      q("conversation").scrollTop = q("conversation").scrollHeight;
    };

    const suggestions = [
      "What matters most on this page?",
      "What feels unclear or noisy here?",
      "What should I improve first?"
    ];
    suggestions.forEach((text) => {
      const button = document.createElement("button");
      button.className = "suggestion";
      button.textContent = text;
      button.type = "button";
      button.addEventListener("click", () => {
        q("prompt").value = text;
      });
      q("suggestions").appendChild(button);
    });

    addBubble("assistant", "Hey Buddy. I’m attached to this page now, and I’ll keep the suggestions aligned with the current URL.");

    q("composer").addEventListener("submit", async (event) => {
      event.preventDefault();
      const prompt = q("prompt").value.trim();
      if (!prompt) return;
      addBubble("user", prompt, "You");
      q("prompt").value = "";
    });

    q("scanBtn").addEventListener("click", () => addBubble("assistant", "I’m ready to scan this page from the attached view."));
    q("sideBtn").addEventListener("click", () => chrome.runtime.sendMessage({ type: "open-sidepanel" }));
    q("closeBtn").addEventListener("click", () => hide());

    let startX = 0, startWidth = 180;
    q("splitter").addEventListener("mousedown", (event) => {
      startX = event.clientX;
      startWidth = q("rail").getBoundingClientRect().width;
      const move = (e) => {
        const next = Math.max(150, Math.min(260, startWidth + (e.clientX - startX)));
        q("panel").style.gridTemplateColumns = `${next}px 8px minmax(0,1fr)`;
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });

    let dragStartX = 0, dragStartY = 0, startTop = 24, startLeft = 0;
    q("dragHandle").addEventListener("mousedown", (event) => {
      if (event.target.closest("button")) return;
      const rect = q("panel").getBoundingClientRect();
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      startTop = rect.top;
      startLeft = rect.left;
      q("panel").style.right = "auto";
      q("panel").style.left = `${rect.left}px`;
      const move = (e) => {
        q("panel").style.top = `${Math.max(12, startTop + e.clientY - dragStartY)}px`;
        q("panel").style.left = `${Math.max(12, startLeft + e.clientX - dragStartX)}px`;
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });

    let edgeStartX = 0, edgeStartWidth = 460;
    q("resizeEdge").addEventListener("mousedown", (event) => {
      edgeStartX = event.clientX;
      edgeStartWidth = q("panel").getBoundingClientRect().width;
      const move = (e) => {
        q("panel").style.width = `${Math.max(360, Math.min(840, edgeStartWidth - (e.clientX - edgeStartX)))}px`;
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });

    let cornerStartX = 0, cornerStartY = 0, startW = 460, startH = 620;
    q("resizeCorner").addEventListener("mousedown", (event) => {
      const rect = q("panel").getBoundingClientRect();
      cornerStartX = event.clientX;
      cornerStartY = event.clientY;
      startW = rect.width;
      startH = rect.height;
      const move = (e) => {
        q("panel").style.width = `${Math.max(360, Math.min(900, startW + e.clientX - cornerStartX))}px`;
        q("panel").style.height = `${Math.max(420, Math.min(window.innerHeight - 12, startH + e.clientY - cornerStartY))}px`;
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  }

  function show() {
    ensureOverlay();
    state.shadow.getElementById("panel").classList.add("visible");
    state.visible = true;
  }

  function hide() {
    if (!state.shadow) return;
    state.shadow.getElementById("panel").classList.remove("visible");
    state.visible = false;
  }

  function toggle() {
    if (state.visible) hide();
    else show();
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "CHINNA_SCAN_PAGE") {
      try {
        sendResponse({ ok: true, scan: collectScan() });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || String(error) });
      }
      return true;
    }

    if (message?.type === "CHINNA_TOGGLE_OVERLAY") {
      toggle();
      sendResponse({ ok: true, visible: state.visible });
      return true;
    }
  });

  setInterval(() => {
    if (location.href !== state.currentUrl) {
      state.currentUrl = location.href;
      state.lastScan = null;
    }
  }, 1500);

  window.__CHINNA_ASSISTANT__ = { toggle, show, hide, collectScan };
})();
