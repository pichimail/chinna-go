(() => {
  if (window.__CHINNA_SCANNER_INSTALLED__) return;
  window.__CHINNA_SCANNER_INSTALLED__ = true;

  const state = {
    installedAt: Date.now(),
    console: [],
    errors: [],
    resources: [],
    longTasks: 0
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
          try {
            return typeof arg === "string" ? arg : JSON.stringify(arg);
          } catch {
            return String(arg);
          }
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
    const slowResources = resources
      .filter((entry) => entry.duration > 900)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 12)
      .map((entry) => ({
        name: trim(entry.name, 220),
        duration: Math.round(entry.duration),
        type: entry.initiatorType || ""
      }));

    const unlabeledInputs = inputs.filter((input) => {
      const id = input.id;
      return !input.getAttribute("aria-label")
        && !input.getAttribute("aria-labelledby")
        && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`))
        && !input.closest("label");
    });

    return {
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
        }
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
      accessibility: {
        images_missing_alt: images.filter((img) => !img.hasAttribute("alt")).length,
        inputs_unlabeled: unlabeledInputs.length,
        landmarks: Array.from(document.querySelectorAll("main, nav, header, footer, aside, [role]")).slice(0, 40).map((node) => ({
          tag: node.tagName,
          role: node.getAttribute("role") || "",
          label: node.getAttribute("aria-label") || "",
          id: node.id || ""
        }))
      },
      performance: {
        dom_complete_ms: nav ? Math.round(nav.domComplete) : 0,
        load_event_ms: nav ? Math.round(nav.loadEventEnd) : 0,
        transfer_size: resources.reduce((sum, item) => sum + (item.transferSize || 0), 0),
        slow_resources: slowResources,
        long_tasks: state.longTasks
      },
      resources: {
        failed: state.resources.slice(-40)
      },
      console: state.console.slice(-60),
      errors: state.errors.slice(-40),
      samples: {
        links: links.slice(0, 20).map((a) => ({ text: trim(a.innerText || a.textContent || "", 120), href: a.href })),
        buttons: buttons.slice(0, 20).map((b) => ({ text: trim(b.innerText || b.textContent || b.getAttribute("aria-label") || "", 120) })),
        text: visibleTextSample()
      }
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "CHINNA_SCAN_PAGE") return;
    try {
      sendResponse({ ok: true, scan: collectScan() });
    } catch (error) {
      sendResponse({ ok: false, error: error.message || String(error) });
    }
  });
})();
