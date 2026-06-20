/* AppsView.jsx */

function AppsView() {
  const [apps, setApps] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [loginItems, setLoginItems] = React.useState([]);

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

  const filtered = apps.filter(a => !search || (a.name ?? '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#ff8c00', marginBottom: '4px' }}>APP MANAGER</div>
        <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Applications</h2>
      </div>

      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--s1)', border: '1px solid var(--line2)', borderRadius: '2px', padding: '6px 10px' }}>
          <span style={{ color: 'var(--t3)' }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search apps…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: '12px', fontFamily: 'var(--font)' }} />
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
            INSTALLED APPS {filtered.length > 0 && `(${filtered.length})`}
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--t3)' }}>Scanning applications…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
              {filtered.map((app, i) => (
                <div key={i} style={{ border: '1px solid var(--line)', borderRadius: '2px', padding: '12px', transition: 'border-color .15s', cursor: 'default' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--line2)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--line)'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--s1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                      {app.icon ?? '📦'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.name}</div>
                      {app.version && <div style={{ fontSize: '10px', color: 'var(--t3)' }}>v{app.version}</div>}
                    </div>
                  </div>
                  {app.size && <div style={{ fontSize: '10px', color: 'var(--t3)', fontFamily: 'var(--mono)' }}>{app.size}</div>}
                </div>
              ))}
              {filtered.length === 0 && !loading && (
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
