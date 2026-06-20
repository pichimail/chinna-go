/* WebViewsView.jsx — iFrame embed browser with persistent bookmarks */

function WebViewsView() {
  const [bookmarks, setBookmarks] = React.useState([]);
  const [url, setUrl] = React.useState('');
  const [current, setCurrent] = React.useState('');
  const [history, setHistory] = React.useState([]);
  const [forward, setForward] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [addName, setAddName] = React.useState('');
  const [addIcon, setAddIcon] = React.useState('⊙');
  const [addOpen, setAddOpen] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const iframeRef = React.useRef(null);

  React.useEffect(() => {
    fetch('/api/webview/bookmarks').then(r => r.json()).then(d => {
      setBookmarks(d.bookmarks ?? []);
    }).catch(() => {});
  }, []);

  function showToast(msg, color = '#2edd5e') {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2500);
  }

  function navigate(target) {
    let u = target.trim();
    if (!u) return;
    if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'https://' + u;
    setHistory(h => [...h, current].filter(Boolean));
    setForward([]);
    setCurrent(u); setUrl(u); setLoading(true);
  }

  function goBack() {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setForward(f => [current, ...f].filter(Boolean));
    setHistory(h => h.slice(0, -1));
    setCurrent(prev); setUrl(prev); setLoading(true);
  }

  function goForward() {
    if (!forward.length) return;
    const next = forward[0];
    setHistory(h => [...h, current].filter(Boolean));
    setForward(f => f.slice(1));
    setCurrent(next); setUrl(next); setLoading(true);
  }

  async function addBookmark() {
    if (!current) return;
    const name = addName.trim() || new URL(current).hostname.replace('www.', '');
    const bm = { name, url: current, icon: addIcon };
    try {
      const d = await fetch('/api/webview/bookmarks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bm),
      }).then(r => r.json());
      setBookmarks(d.bookmarks ?? bookmarks);
      showToast(`Saved: ${name}`);
    } catch { showToast('Failed to save', '#ff3333'); }
    setAddName(''); setAddOpen(false);
  }

  async function removeBookmark(bm) {
    try {
      const d = await fetch('/api/webview/bookmarks/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: bm.url }),
      }).then(r => r.json());
      setBookmarks(d.bookmarks ?? bookmarks.filter(b => b.url !== bm.url));
      showToast(`Removed: ${bm.name}`);
    } catch { showToast('Failed', '#ff3333'); }
  }

  const isBookmarked = current && bookmarks.some(b => b.url === current);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {toast && (
        <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 9999, padding: '8px 16px', borderRadius: '2px', border: `1px solid ${toast.color}44`, background: `${toast.color}14`, color: toast.color, fontSize: '12px', fontWeight: 700 }}>
          {toast.msg}
        </div>
      )}

      {/* Header + nav bar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#0080ff', marginBottom: '8px' }}>WEB BROWSER</div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={goBack} disabled={!history.length} title="Back"
            style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--line)', borderRadius: '2px', color: history.length ? 'var(--t2)' : 'var(--t4)', cursor: history.length ? 'pointer' : 'default', fontSize: '13px' }}>
            ←
          </button>
          <button onClick={goForward} disabled={!forward.length} title="Forward"
            style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--line)', borderRadius: '2px', color: forward.length ? 'var(--t2)' : 'var(--t4)', cursor: forward.length ? 'pointer' : 'default', fontSize: '13px' }}>
            →
          </button>
          <button onClick={() => { if (current) { setLoading(true); if (iframeRef.current) iframeRef.current.src = current; } }} title="Reload"
            style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--line)', borderRadius: '2px', color: 'var(--t2)', cursor: 'pointer', fontSize: '13px' }}>
            ↺
          </button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--s1)', border: '1px solid var(--line2)', borderRadius: '2px', padding: '6px 10px' }}>
            <span style={{ color: current.startsWith('https') ? '#2edd5e' : 'var(--t4)', flexShrink: 0, fontSize: '11px' }}>🔒</span>
            <input value={url} onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && navigate(url)}
              placeholder="Enter URL or domain…"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: '12px', fontFamily: 'var(--mono)' }} />
            {loading && current && <span style={{ color: 'var(--t3)', fontSize: '11px', flexShrink: 0 }}>⟳</span>}
          </div>
          <button onClick={() => navigate(url)}
            style={{ padding: '6px 14px', background: '#0080ff', border: 'none', borderRadius: '2px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>Go</button>
          {/* Bookmark toggle */}
          {current && (
            <button onClick={isBookmarked ? () => removeBookmark(bookmarks.find(b => b.url === current)) : () => setAddOpen(o => !o)}
              title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
              style={{ padding: '6px 10px', background: isBookmarked ? 'rgba(255,199,0,.12)' : 'transparent', border: `1px solid ${isBookmarked ? 'rgba(255,199,0,.4)' : 'var(--line)'}`, borderRadius: '2px', color: isBookmarked ? '#ffc700' : 'var(--t3)', fontSize: '14px', cursor: 'pointer' }}>
              {isBookmarked ? '★' : '☆'}
            </button>
          )}
        </div>

        {/* Add bookmark form */}
        {addOpen && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
            <input value={addIcon} onChange={e => setAddIcon(e.target.value)} placeholder="⊙"
              style={{ width: '36px', background: 'var(--s1)', border: '1px solid var(--line2)', borderRadius: '2px', color: 'var(--t1)', fontSize: '14px', padding: '5px 8px', textAlign: 'center', outline: 'none' }} />
            <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Bookmark name…"
              onKeyDown={e => e.key === 'Enter' && addBookmark()}
              style={{ flex: 1, background: 'var(--s1)', border: '1px solid var(--line2)', borderRadius: '2px', color: 'var(--t1)', fontSize: '12px', padding: '6px 10px', outline: 'none' }} />
            <button onClick={addBookmark}
              style={{ padding: '6px 12px', background: '#0080ff', border: 'none', borderRadius: '2px', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Save</button>
            <button onClick={() => setAddOpen(false)}
              style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: '2px', color: 'var(--t3)', fontSize: '11px', cursor: 'pointer' }}>✕</button>
          </div>
        )}
      </div>

      {/* Bookmarks bar */}
      <div style={{ display: 'flex', gap: '6px', padding: '6px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center', minHeight: '38px' }}>
        {bookmarks.length === 0 ? (
          <span style={{ fontSize: '11px', color: 'var(--t4)' }}>No bookmarks yet — navigate to a site and click ☆ to save</span>
        ) : bookmarks.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
            <button onClick={() => navigate(b.url)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                border: '1px solid var(--line)', borderRadius: '2px 0 0 2px', background: current === b.url ? 'rgba(0,128,255,.08)' : 'transparent',
                color: current === b.url ? '#0080ff' : 'var(--t2)', cursor: 'pointer', transition: 'all .15s',
                borderRight: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#0080ff44'; e.currentTarget.style.color = '#0080ff'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = current === b.url ? '#0080ff' : 'var(--t2)'; }}>
              {b.icon} {b.name}
            </button>
            <button onClick={() => removeBookmark(b)} title="Remove"
              style={{ padding: '4px 6px', fontSize: '10px', border: '1px solid var(--line)', borderRadius: '0 2px 2px 0', background: 'transparent', color: 'var(--t4)', cursor: 'pointer', lineHeight: 1 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ff3333'; e.currentTarget.style.borderColor = 'rgba(255,51,51,.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--t4)'; e.currentTarget.style.borderColor = 'var(--line)'; }}>
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {!current ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '20px', color: 'var(--t3)' }}>
            <div style={{ fontSize: '48px', opacity: 0.2 }}>⊙</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--t2)' }}>New Tab</div>
            {bookmarks.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px', maxWidth: '500px', width: '90%' }}>
                {bookmarks.map((b, i) => (
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
            )}
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
