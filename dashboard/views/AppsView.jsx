/* AppsView.jsx — App manager with category filters, card grid, launch/uninstall */

function AppsView() {
  const [apps, setApps] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [loginItems, setLoginItems] = React.useState([]);
  const [sortMode, setSortMode] = React.useState('name');
  const [busyApp, setBusyApp] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [category, setCategory] = React.useState('all');

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

  const CATEGORIES = [
    { id: 'all', label: 'All', color: 'var(--t2)' },
    { id: 'developer', label: 'Developer', color: '#baff29' },
    { id: 'ai', label: 'AI', color: '#d54cff' },
    { id: 'browser', label: 'Browser', color: '#0080ff' },
    { id: 'design', label: 'Design', color: '#ff8c00' },
    { id: 'utilities', label: 'Utilities', color: '#ffc700' },
    { id: 'comms', label: 'Comms', color: '#2edd5e' },
    { id: 'media', label: 'Media', color: '#ff2d55' },
  ];

  const sorted = React.useMemo(() => {
    let f = apps.filter(a => !search || (a.name ?? '').toLowerCase().includes(search.toLowerCase()));
    if (category !== 'all') f = f.filter(a => (a.category ?? '').toLowerCase() === category);
    if (sortMode === 'name') return [...f].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    if (sortMode === 'size') return [...f].sort((a, b) => (b.size_bytes ?? 0) - (a.size_bytes ?? 0));
    return f;
  }, [apps, search, sortMode, category]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, padding: '8px 16px', borderRadius: 2, border: `1px solid ${toast.color}44`, background: `${toast.color}14`, color: toast.color, fontSize: 12, fontWeight: 700, animation: 'fadeIn .2s' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#ff8c00', marginBottom: 4 }}>APP MANAGER</div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Applications</h2>
        </div>
        {!loading && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{sorted.length} apps</div>}
      </div>

      {/* Toolbar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--s1)', border: '1px solid var(--line2)', borderRadius: 2, padding: '6px 10px' }}>
          <span style={{ color: 'var(--t3)', fontSize: 12 }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search apps…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: 12, fontFamily: 'var(--font)' }} />
        </div>

        {/* Category filters */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCategory(c.id)}
              style={{ padding: '4px 10px', border: `1px solid ${category === c.id ? c.color : 'var(--line)'}`,
                borderRadius: 2, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: category === c.id ? `${c.color}15` : 'transparent',
                color: category === c.id ? c.color : 'var(--t3)',
                transition: 'all .1s', fontFamily: 'var(--font)' }}
              onMouseEnter={e => { if (category !== c.id) { e.currentTarget.style.borderColor = c.color; e.currentTarget.style.color = c.color; }}}
              onMouseLeave={e => { if (category !== c.id) { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--t3)'; }}}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div style={{ display: 'flex', background: 'var(--s1)', border: '1px solid var(--line)', borderRadius: 2, padding: 2 }}>
          {[['name', 'A-Z'], ['size', 'Size']].map(([id, label]) => (
            <button key={id} onClick={() => setSortMode(id)} style={{ border: 'none', padding: '4px 10px', fontSize: 11, fontWeight: 600,
              background: sortMode === id ? 'var(--acc)' : 'transparent', color: sortMode === id ? '#000' : 'var(--t3)',
              borderRadius: 1, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .1s' }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loginItems.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#ffc700', marginBottom: 8 }}>LOGIN ITEMS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {loginItems.map((item, i) => (
                <div key={i} style={{ padding: '5px 10px', border: '1px solid rgba(255,199,0,.2)', borderRadius: 2, fontSize: 11, color: '#ffc700', fontWeight: 600 }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--t3)' }}>
            <div className="spin" style={{ fontSize: 24, marginBottom: 12 }}>⟳</div>
            <div>Scanning applications…</div>
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--t3)' }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: .3 }}>📦</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t2)', marginBottom: 8 }}>No apps found</div>
            <div style={{ fontSize: 12 }}>{search ? `No results for "${search}"` : 'Install apps to see them here'}</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {sorted.map((app, i) => (
              <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 2, padding: 14, transition: 'all .15s', display: 'flex', flexDirection: 'column', gap: 8, cursor: 'default' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,140,0,.35)'; e.currentTarget.style.background = 'rgba(255,140,0,.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'transparent'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--s1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {app.icon ?? '📦'}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.name}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                      {app.version && <span style={{ fontSize: 10, color: 'var(--t3)' }}>v{app.version}</span>}
                      {app.size && <span style={{ fontSize: 10, color: 'var(--t4)', fontFamily: 'var(--mono)' }}>{app.size}</span>}
                    </div>
                  </div>
                </div>
                {app.category && (
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--t4)' }}>{app.category}</div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => launchApp(app)} disabled={busyApp === app.name}
                    style={{ flex: 1, padding: 5, border: '1px solid rgba(255,140,0,.3)', background: busyApp === app.name ? 'rgba(255,140,0,.1)' : 'transparent', color: '#ff8c00', borderRadius: 2, fontSize: 11, fontWeight: 700, cursor: busyApp ? 'wait' : 'pointer', transition: 'all .1s' }}
                    onMouseEnter={e => { if (!busyApp) e.currentTarget.style.background = 'rgba(255,140,0,.12)'; }}
                    onMouseLeave={e => e.currentTarget.style.background = busyApp === app.name ? 'rgba(255,140,0,.1)' : 'transparent'}>
                    {busyApp === app.name ? 'Launching…' : 'Open'}
                  </button>
                  <button onClick={() => showToast('Uninstall coming soon', '#ffc700')}
                    style={{ padding: '5px 10px', border: '1px solid var(--line)', background: 'transparent', color: 'var(--t3)', borderRadius: 2, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .1s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#ff3333'; e.currentTarget.style.color = '#ff3333'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--t3)'; }}>
                    Uninstall
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { AppsView });
