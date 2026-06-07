// Chinna AI content bridge. Idempotent so popup/side-panel scans do not erase captured errors.
(() => {
  if (window.__chinnaContentReady) return;
  window.__chinnaContentReady = true;
  window.__chinnaErrors = Array.isArray(window.__chinnaErrors) ? window.__chinnaErrors : [];

  function pushError(entry) {
    window.__chinnaErrors.push({ ts: Date.now(), ...entry });
    if (window.__chinnaErrors.length > 80) window.__chinnaErrors.shift();
  }

  function collectPageData() {
    const url = location.href;
    const title = document.title;
    const meta = {};
    document.querySelectorAll("meta[name],meta[property]").forEach((m) => {
      const key = m.getAttribute("name") || m.getAttribute("property");
      if (key) meta[key] = m.getAttribute("content") || "";
    });
    const headings = Array.from(document.querySelectorAll("h1,h2,h3")).slice(0, 16)
      .map((h) => ({ level: h.tagName, text: (h.innerText || "").trim().slice(0, 160) }));
    const links = Array.from(document.querySelectorAll("a[href]")).slice(0, 50)
      .map((a) => ({ href: a.href, text: (a.innerText || "").trim().slice(0, 100) }));
    const images = Array.from(document.querySelectorAll("img[src]")).slice(0, 40)
      .map((i) => ({ src: i.currentSrc || i.src, alt: i.alt || "" }));
    const controls = Array.from(document.querySelectorAll("input,textarea,select"));
    const cssEscape = window.CSS?.escape || ((value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"'));
    const inputs_unlabeled = controls.filter((el) => {
      if (el.type === "hidden") return false;
      if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) return false;
      if (el.id && document.querySelector(`label[for="${cssEscape(el.id)}"]`)) return false;
      if (el.closest("label")) return false;
      return true;
    }).length;
    const scripts = Array.from(document.querySelectorAll("script[src]")).map((s) => s.src).slice(0, 12);
    const bodyText = document.body?.innerText?.slice(0, 5000) || "";

    return {
      url,
      title,
      meta,
      headings,
      links,
      images,
      inputs: controls.length,
      inputs_unlabeled,
      scripts,
      bodyText,
      errors: window.__chinnaErrors.slice(-80),
      nodes: document.querySelectorAll("*").length,
      ts: Date.now(),
      viewport: { w: innerWidth, h: innerHeight }
    };
  }

  const previousOnError = window.onerror;
  window.onerror = function chinnaOnError(msg, src, line, col, err) {
    pushError({
      message: String(msg || ""),
      src: src || "window.onerror",
      line: line || 0,
      col: col || 0,
      stack: err?.stack?.slice(0, 600) || ""
    });
    return previousOnError?.apply(this, arguments) ?? false;
  };

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    pushError({
      message: reason?.message || String(reason || "Unhandled promise rejection"),
      src: "unhandledrejection",
      stack: reason?.stack?.slice(0, 600) || ""
    });
  });

  if (!window.__chinnaConsoleWrapped) {
    window.__chinnaConsoleWrapped = true;
    const originalError = console.error.bind(console);
    console.error = (...args) => {
      pushError({ message: args.map(String).join(" "), src: "console.error" });
      originalError(...args);
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type === "GET_PAGE_DATA") {
      reply(collectPageData());
      return true;
    }
    if (msg.type === "HIGHLIGHT") {
      const el = document.querySelector(msg.selector);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.outline = "2px solid #7c6ef7";
        el.style.outlineOffset = "3px";
        setTimeout(() => {
          el.style.outline = "";
          el.style.outlineOffset = "";
        }, 2000);
      }
      reply({ ok: !!el });
      return true;
    }
    return false;
  });
})();
