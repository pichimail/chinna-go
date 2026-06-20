/* AppsView.jsx */

function AppsView() {
  const [apps, setApps] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [loginItems, setLoginItems] = React.useState([]);
  const [sortMode, setSortMode] = React.useState('name');
  const [busyApp, setBusyApp] = React.useState(null);
  const [toast, setToast] = React.useState(null);

  React.useEffect(() => {
    Promise.all([
      fetch('/api/apps').then(r => r.json()).catch(() => ({ apps: [] })),
      fetch('/api/loginitems').then(r => r.json()).catch(() => ({ result: '' })),
    ]).then(([a, l]) => {
      setApps(a.apps ?? []);
      setLoginItems((l.result ?? '').split('\n').filter(Boolean));
      setLoading(false);
    });
  }, []);

  function showToast(msg, color = '#2edd5e') {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  }

  async function launchApp(app) {
    setBusyApp(app.name);
    try {
      const d = await fetch('/api/apps/launch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: app.name, path: app.path }),
      }).then(r => r.json());
      if (d.ok) showToast(`Launched ${app.name}`);
      else showToast(d.error ?? 'Launch failed', '#ff3333');
    } catch { showToast('Failed to launch', '#ff3333'); }
    setBusyApp(null);
  }

  const sorted = React.useMemo(() => {
    const f = apps.filter(a => !search || (a.name ?? '').toLowerCase().includes(search.toLowerCase()));
    if (sortMode === 'name') return [...f].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    if (sortMode === 'size') return [...f].sort((a, b) => (b.size_bytes ?? 0) - (a.size_bytes ?? 0));
    return f;
  }, [apps, search, sortMode]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {toast && (
        <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 9999, padding: '8px 16px', borderRadius: '2px', border: `1px solid ${toast.color}44`, background: `${toast.color}14`, color: toast.color, fontSize: '12px', fontWeight: 700 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#ff8c00', marginBottom: '4px' }}>APP MANAGER</div>
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Applications</h2>
        </div>
        {!loading && <div style={{ fontSize: '11px', color: 'var(--t3)' }}>{sorted.length} apps</div>}
      </div>

      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--s1)', border: '1px solid var(--line2)', borderRadius: '2px', padding: '6px 10px' }}>
          <span style={{ color: 'var(--t3)' }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search apps…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: '12px', fontFamily: 'var(--font)' }} />
        </div>
        <div style={{ display: 'flex', background: 'var(--s1)', border: '1px solid var(--line)', borderRadius: '2px', padding: '2px' }}>
          {[['name', 'A-Z'], ['size', 'Size']].map(([id, label]) => (
            <button key={id} onClick={() => setSortMode(id)} style={{ border: 'none', padding: '4px 10px', fontSize: '11px', fontWeight: 600,
              background: sortMode === id ? 'var(--acc)' : 'transparent', color: sortMode === id ? '#000' : 'var(--t3)',
              borderRadius: '1px', cursor: 'pointer', fontFamily: 'var(--font)' }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loginItems.length > 0 && (
          <div>
            <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#ffc700', marginBottom: '8px' }}>LOGIN ITEMS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {loginItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: '2px' }}>
                  <span style={{ fontSize: '14px' }}>🚀</span>
                  <span style={{ flex: 1, fontSize: '12px', color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#ff8c00', marginBottom: '8px' }}>
            INSTALLED APPS {!loading && sorted.length > 0 && `(${sorted.length})`}
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--t3)' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>⟳</div>
              Scanning applications…
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
              {sorted.map((app, i) => (
                <div key={i} style={{ border: '1px solid var(--line)', borderRadius: '2px', padding: '12px', transition: 'border-color .15s', display: 'flex', flexDirection: 'column', gap: '8px' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,140,0,.35)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--line)'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--s1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                      {app.icon ?? '📦'}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.name}</div>
                      {app.version && <div style={{ fontSize: '10px', color: 'var(--t3)' }}>v{app.version}</div>}
                      {app.size && <div style={{ fontSize: '10px', color: 'var(--t4)', fontFamily: 'var(--mono)' }}>{app.size}</div>}
                    </div>
                  </div>
                  <button onClick={() => launchApp(app)} disabled={busyApp === app.name}
                    style={{ width: '100%', padding: '5px', border: '1px solid rgba(255,140,0,.3)', background: busyApp === app.name ? 'rgba(255,140,0,.1)' : 'transparent', color: '#ff8c00', borderRadius: '2px', fontSize: '11px', fontWeight: 700, cursor: busyApp ? 'wait' : 'pointer', transition: 'all .1s' }}>
                    {busyApp === app.name ? '⟳ Launching…' : '▶ Launch'}
                  </button>
                </div>
              ))}
              {sorted.length === 0 && !loading && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px', color: 'var(--t3)' }}>No apps found</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AppsView });
