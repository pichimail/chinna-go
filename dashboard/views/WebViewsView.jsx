/* WebViewsView.jsx — iFrame embed browser */

function WebViewsView() {
  const BOOKMARKS = [
    { name: 'GitHub', url: 'https://github.com', icon: '⊛' },
    { name: 'Google', url: 'https://google.com', icon: '⊙' },
    { name: 'Claude', url: 'https://claude.ai', icon: '◈' },
    { name: 'Vercel', url: 'https://vercel.com', icon: '⬡' },
    { name: 'npm', url: 'https://npmjs.com', icon: '⬤' },
    { name: 'MDN', url: 'https://developer.mozilla.org', icon: '◎' },
  ];

  const [url, setUrl] = React.useState('');
  const [current, setCurrent] = React.useState('');
  const [history, setHistory] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const iframeRef = React.useRef(null);

  function navigate(target) {
    let u = target.trim();
    if (!u) return;
    if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'https://' + u;
    setHistory(h => [...h, current].filter(Boolean));
    setCurrent(u); setUrl(u); setLoading(true);
  }

  function goBack() {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setCurrent(prev); setUrl(prev); setLoading(true);
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#0080ff', marginBottom: '8px' }}>WEB BROWSER</div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={goBack} disabled={!history.length}
            style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--line)', borderRadius: '2px', color: history.length ? 'var(--t2)' : 'var(--t4)', cursor: history.length ? 'pointer' : 'default', fontSize: '13px' }}>
            ←
          </button>
          <button onClick={() => { setLoading(true); iframeRef.current && (iframeRef.current.src = current); }}
            style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--line)', borderRadius: '2px', color: 'var(--t2)', cursor: 'pointer', fontSize: '13px' }}>
            ↺
          </button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--s1)', border: '1px solid var(--line2)', borderRadius: '2px', padding: '6px 10px' }}>
            <span style={{ color: current.startsWith('https') ? '#2edd5e' : 'var(--t4)', flexShrink: 0, fontSize: '11px' }}>🔒</span>
            <input value={url} onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && navigate(url)}
              placeholder="Enter URL or search…"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: '12px', fontFamily: 'var(--mono)' }} />
            {loading && current && <span style={{ color: 'var(--t3)', fontSize: '11px', flexShrink: 0 }}>⟳</span>}
          </div>
          <button onClick={() => navigate(url)}
            style={{ padding: '6px 14px', background: '#0080ff', border: 'none', borderRadius: '2px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>Go</button>
        </div>
      </div>

      {/* Bookmarks bar */}
      <div style={{ display: 'flex', gap: '6px', padding: '6px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, flexWrap: 'wrap' }}>
        {BOOKMARKS.map((b, i) => (
          <button key={i} onClick={() => navigate(b.url)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', fontSize: '11px', fontWeight: 600,
              border: '1px solid var(--line)', borderRadius: '2px', background: 'transparent', color: 'var(--t2)', cursor: 'pointer',
              transition: 'border-color .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#0080ff44'; e.currentTarget.style.color = '#0080ff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--t2)'; }}>
            {b.icon} {b.name}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {!current ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '20px', color: 'var(--t3)' }}>
            <div style={{ fontSize: '48px', opacity: 0.2 }}>⊙</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--t2)' }}>New Tab</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', maxWidth: '400px' }}>
              {BOOKMARKS.map((b, i) => (
                <button key={i} onClick={() => navigate(b.url)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px 12px',
                    border: '1px solid var(--line)', borderRadius: '2px', background: 'transparent', color: 'var(--t2)',
                    cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#0080ff'; e.currentTarget.style.background = 'rgba(0,128,255,.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ fontSize: '20px' }}>{b.icon}</span>{b.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <iframe ref={iframeRef} src={current}
            onLoad={() => setLoading(false)}
            style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
            title="WebView" />
        )}
      </div>
    </div>
  );
}

Object.assign(window, { WebViewsView });
