/* Charts.jsx — Sparkline + ring gauge components */

function Sparkline({ data = [], color = 'var(--acc)', height = 36, fill = true }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !data.length) return;
    const w = el.clientWidth || 120;
    const h = height;
    el.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    });
    const line = `M ${pts.join(' L ')}`;
    const area = `${line} L ${(data.length - 1) / (data.length - 1) * w},${h} L 0,${h} Z`;
    el.innerHTML = fill
      ? `<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity=".28"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#sg)"/><path d="${line}" fill="none" stroke="${color}" stroke-width="1.5"/>`
      : `<path d="${line}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
  }, [data, color, height, fill]);
  return <svg ref={ref} style={{ width: '100%', height: `${height}px`, display: 'block', overflow: 'visible' }} />;
}

function RingGauge({ pct = 0, color = 'var(--acc)', size = 78, label, value, unit }) {
  const r = 28, cx = 39, cy = 39;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, margin: '0 auto 6px' }}>
        <svg width={size} height={size} viewBox="0 0 78 78" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--s2)" strokeWidth="5" />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray .5s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: '1px' }}>
          <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--t1)', fontVariantNumeric: 'tabular-nums' }}>
            {value ?? pct}
          </span>
          {unit && <span style={{ fontSize: '9px', color: 'var(--t3)' }}>{unit}</span>}
        </div>
      </div>
      {label && <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--t3)' }}>{label}</div>}
    </div>
  );
}

function MiniBar({ pct = 0, color = 'var(--acc)' }) {
  return (
    <div style={{ height: '3px', background: 'var(--s2)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: '2px',
        transition: 'width .4s ease' }} />
    </div>
  );
}

Object.assign(window, { Sparkline, RingGauge, MiniBar });
