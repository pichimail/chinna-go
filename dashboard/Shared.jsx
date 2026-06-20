/* Shared.jsx — DotReveal canvas hover effect + global utilities */

(function () {
  /* DotReveal: attaches a canvas dot-grid that illuminates near cursor */
  function DotReveal(el, opts = {}) {
    if (!el || el.__dotReveal) return;
    el.__dotReveal = true;
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      position: 'absolute', inset: '0', pointerEvents: 'none',
      borderRadius: getComputedStyle(el).borderRadius, zIndex: '0',
    });
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.insertBefore(canvas, el.firstChild);
    const ctx = canvas.getContext('2d');
    const DOT = opts.size || 2.5;
    const GAP = opts.gap || 10;
    const COLOR = opts.color || 'rgba(186,255,41,ALPHA)';
    let mx = -999, my = -999, raf = null, alive = true;

    function resize() {
      const r = el.getBoundingClientRect();
      canvas.width = r.width; canvas.height = r.height;
    }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let x = GAP / 2; x < canvas.width; x += GAP) {
        for (let y = GAP / 2; y < canvas.height; y += GAP) {
          const dx = mx - x, dy = my - y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const radius = opts.radius || 80;
          if (dist > radius) continue;
          const alpha = (1 - dist / radius) * 0.65;
          ctx.fillStyle = COLOR.replace('ALPHA', alpha.toFixed(3));
          ctx.beginPath();
          ctx.arc(x, y, DOT / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    function loop() { if (!alive) return; draw(); raf = requestAnimationFrame(loop); }

    function onMove(e) {
      const r = el.getBoundingClientRect();
      mx = e.clientX - r.left; my = e.clientY - r.top;
    }
    function onLeave() { mx = -999; my = -999; }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    loop();

    el.__dotRevealDestroy = () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      canvas.remove();
    };
  }

  /* Attach DotReveal to any element with data-dot-reveal */
  function attachAll() {
    document.querySelectorAll('[data-dot-reveal]').forEach(el => DotReveal(el));
  }
  const mo = new MutationObserver(attachAll);
  mo.observe(document.body, { childList: true, subtree: true });
  attachAll();

  window.DotReveal = DotReveal;
  window.attachDotReveal = attachAll;
})();
