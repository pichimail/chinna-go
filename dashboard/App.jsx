/* App.jsx — Header-tab navigation + collapsible sidebar + routing */

const HEADER_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'studio', label: 'Studio' },
  { id: 'files', label: 'Files' },
  { id: 'apps', label: 'Apps' },
  { id: 'plugins', label: 'Plugins' },
  { id: 'duplicates', label: 'Duplicates' },
  { id: 'settings', label: 'Settings' },
];

const SIDEBAR_ITEMS = [
  { id: 'overview', icon: '⌂', label: 'Overview', accent: '#baff29' },
  { id: 'studio', icon: '◈', label: 'Studio', accent: '#d54cff' },
  { id: 'files', icon: '🗂', label: 'Files', accent: '#ffc700' },
  { id: 'apps', icon: '⊞', label: 'Apps', accent: '#ff8c00' },
  { id: 'plugins', icon: '⬡', label: 'Plugins', accent: '#d54cff' },
  { id: 'duplicates', icon: '⊕', label: 'Duplicates', accent: '#ff8c00' },
  { id: 'settings', icon: '⚙', label: 'Settings', accent: '#00e5ff' },
  '_sep',
  { id: 'whatsapp', icon: '◎', label: 'WhatsApp', accent: '#2edd5e', badge: 'WA' },
  { id: 'securechat', icon: '⊛', label: 'Secure Chat', accent: '#00e5ff' },
  { id: 'webviews', icon: '⊙', label: 'Browser', accent: '#0080ff' },
];

const VIEWS = {
  overview: 'OverviewView',
  studio: 'StudioView',
  files: 'FilesView',
  apps: 'AppsView',
  duplicates: 'DuplicatesView',
  plugins: 'PluginsView',
  settings: 'SettingsView',
  whatsapp: 'WhatsAppView',
  securechat: 'SecureChatView',
  webviews: 'WebViewsView',
};

function NotificationBell({ notifications }) {
  const [open, setOpen] = React.useState(false);
  const count = notifications.filter(n => !n.read).length;
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: 32, height: 32, border: '1px solid var(--line2)', borderRadius: 2,
          background: 'transparent', color: 'var(--t3)', cursor: 'pointer', display: 'grid',
          placeItems: 'center', fontSize: 14, position: 'relative', transition: 'all .1s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; e.currentTarget.style.color = 'var(--t1)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t3)'; }}>
        🔔
        {count > 0 && (
          <div style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16,
            borderRadius: '50%', background: '#ff3333', color: '#fff', fontSize: 9,
            fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {count > 9 ? '9+' : count}
          </div>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 300,
          background: 'rgba(0,0,0,.94)', backdropFilter: 'blur(16px)', border: '1px solid var(--line)',
          borderRadius: 2, zIndex: 999, boxShadow: 'var(--sh-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--t4)', fontFamily: 'var(--mono)' }}>NOTIFICATIONS</span>
            {count > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: '#ff3333' }}>{count} new</span>}
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--t4)', fontSize: 12 }}>No notifications yet</div>
            ) : notifications.slice(0, 12).map((n, i) => (
              <div key={i} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', gap: 8, alignItems: 'flex-start',
                transition: 'background .08s', cursor: 'default' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{n.icon ?? 'ℹ'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: n.read ? 'var(--t3)' : 'var(--t1)' }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>
                </div>
                {!n.read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--acc)', flexShrink: 0, marginTop: 5 }} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [view, setView] = React.useState('overview');
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState([]);
  const [stats, setStats] = React.useState({});
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQ, setSearchQ] = React.useState('');
  const [searchResults, setSearchResults] = React.useState([]);
  const searchTimer = React.useRef(null);

  const [dockVisible, setDockVisible] = React.useState(() => {
    try { return localStorage.getItem('chinna_dock_visible') === '1'; } catch { return false; }
  });

  React.useEffect(() => {
    try { localStorage.setItem('chinna_dock_visible', dockVisible ? '1' : '0'); } catch {}
  }, [dockVisible]);

  window.__setDockVisible = setDockVisible;
  window.__getDockVisible = () => dockVisible;

  React.useEffect(() => {
    const poll = () => fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {});
    poll(); const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    const poll = () => fetch('/api/notifications').then(r => r.json())
      .then(d => setNotifications((d.notifications ?? []).map(n => ({
        icon: n.icon, title: n.title, body: n.body, color: n.color, time: n.time, read: !!n.read,
      })))).catch(() => {});
    poll(); const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, []);

  function pushNotification(icon, title, body) {
    setNotifications(n => [{ icon, title, body, read: false, time: Date.now() }, ...n].slice(0, 50));
  }
  window.__pushNotification = pushNotification;

  function doSearch(q) {
    setSearchQ(q);
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`).then(r => r.json())
        .then(d => setSearchResults(d.results ?? [])).catch(() => {});
    }, 180);
  }

  function navigate(id) {
    if (VIEWS[id]) { setView(id); setSearchOpen(false); setSearchQ(''); setSearchResults([]); setSidebarOpen(false); }
  }
  React.useEffect(() => { window.__navigate = navigate; }, []);

  React.useEffect(() => {
    const handler = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(o => !o); }
      if (e.key === 'Escape' && searchOpen) { setSearchOpen(false); setSearchQ(''); setSearchResults([]); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [searchOpen]);

  const cpu = stats.cpu?.pct ?? 0;
  const ram = stats.memory?.pct ?? 0;
  const ViewComp = window[VIEWS[view] ?? ''];

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* HEADER */}
      <header style={{ flexShrink: 0, height: 52, borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px', zIndex: 20,
        background: 'radial-gradient(ellipse at 2% 50%,rgba(186,255,41,.02),transparent 35%),radial-gradient(ellipse at 98% 50%,rgba(0,128,255,.02),transparent 35%),transparent' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, cursor: 'pointer' }}
          onClick={() => navigate('overview')}>
          <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--acc)',
            display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 900, color: '#030a00' }}>C</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase' }}>CHINNA</div>
            <div style={{ fontSize: 9, color: 'var(--acc)', fontWeight: 600, opacity: .8 }}>v7.0</div>
          </div>
        </div>

        {/* Tab nav */}
        <nav style={{ display: 'flex', gap: 0, flex: 1, alignItems: 'stretch', height: '100%',
          borderLeft: '1px solid var(--line)', borderRight: '1px solid var(--line)' }}>
          {HEADER_TABS.map(t => (
            <button key={t.id} onClick={() => navigate(t.id)}
              style={{ flex: 1, border: 'none', background: view === t.id ? 'rgba(186,255,41,.04)' : 'transparent',
                color: view === t.id ? 'var(--t1)' : 'var(--t3)', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .1s',
                borderBottom: `2px solid ${view === t.id ? 'var(--acc)' : 'transparent'}`,
                padding: '0 8px' }}
              onMouseEnter={e => { if (view !== t.id) { e.currentTarget.style.color = 'var(--t2)'; e.currentTarget.style.background = 'rgba(255,255,255,.02)'; }}}
              onMouseLeave={e => { if (view !== t.id) { e.currentTarget.style.color = 'var(--t3)'; e.currentTarget.style.background = 'transparent'; }}}>
              {t.label}
            </button>
          ))}
        </nav>

        {/* Header actions */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
          {/* Search */}
          <button onClick={() => setSearchOpen(true)}
            style={{ height: 32, padding: '0 10px', border: '1px solid var(--line2)', borderRadius: 2,
              background: 'transparent', color: 'var(--t3)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: 5, fontSize: 11, transition: 'all .1s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; e.currentTarget.style.color = 'var(--t1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t3)'; }}>
            <span>⌕</span><span>⌘K</span>
          </button>

          <NotificationBell notifications={notifications} />

          {/* Sidebar toggle */}
          <button onClick={() => setSidebarOpen(o => !o)}
            style={{ width: 32, height: 32, border: '1px solid var(--line2)', borderRadius: 2,
              background: sidebarOpen ? 'rgba(186,255,41,.08)' : 'transparent',
              color: sidebarOpen ? 'var(--acc)' : 'var(--t3)', cursor: 'pointer', display: 'grid',
              placeItems: 'center', fontSize: 14, transition: 'all .1s' }}
            onMouseEnter={e => { if (!sidebarOpen) { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; e.currentTarget.style.color = 'var(--t1)'; }}}
            onMouseLeave={e => { if (!sidebarOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t3)'; }}}
            title="Toggle sidebar">
            ☰
          </button>
        </div>
      </header>

      {/* BODY */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Sidebar overlay */}
        {sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 30 }} />
        )}

        {/* Collapsible Sidebar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: 240,
          background: 'var(--s0)', borderRight: '1px solid var(--line)',
          zIndex: 40, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform .2s var(--ease)',
        }}>
          {/* Sidebar header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--t3)' }}>NAVIGATION</div>
            <button onClick={() => setSidebarOpen(false)}
              style={{ width: 24, height: 24, border: 'none', background: 'transparent', color: 'var(--t3)', cursor: 'pointer', fontSize: 16, display: 'grid', placeItems: 'center', borderRadius: 2 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--t1)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}>×</button>
          </div>

          {/* Sidebar items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
            {SIDEBAR_ITEMS.map((item, i) => {
              if (item === '_sep') return (
                <div key={`sep-${i}`} style={{ height: 1, background: 'var(--line)', margin: '6px 14px' }} />
              );
              const active = view === item.id;
              return (
                <div key={item.id} onClick={() => navigate(item.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
                    color: active ? item.accent : 'var(--t2)', fontSize: 12.5, fontWeight: active ? 600 : 450,
                    cursor: 'pointer', transition: 'all .1s',
                    borderLeft: `2px solid ${active ? item.accent : 'transparent'}`,
                    background: active ? `${item.accent}0d` : 'transparent' }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--s2)'; e.currentTarget.style.color = 'var(--t1)'; }}}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t2)'; }}}>
                  <span style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, opacity: active ? 1 : .7 }}>{item.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                  {item.badge && (
                    <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 2, background: 'rgba(186,255,41,.15)', color: 'var(--acc)' }}>{item.badge}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sidebar footer — vitals */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', flexShrink: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {[['CPU', `${cpu}%`, '#baff29'], ['RAM', `${ram}%`, '#0080ff']].map(([k, v, c]) => (
              <div key={k} style={{ padding: '5px 8px', background: 'var(--s1)', border: '1px solid var(--line)', borderRadius: 2 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--t3)' }}>{k}</div>
                <div style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: c }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {ViewComp ? (
            <ViewComp onNavigate={navigate} />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}>
              View not found: {view}
            </div>
          )}
        </div>
      </div>

      {/* DOCK (hidden by default, toggleable in settings) */}
      {dockVisible && <Dock currentView={view} onNavigate={navigate} />}

      {/* Search overlay */}
      {searchOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', justifyContent: 'center', paddingTop: 120 }}
          onClick={e => { if (e.target === e.currentTarget) { setSearchOpen(false); setSearchQ(''); setSearchResults([]); }}}>
          <div style={{ width: '100%', maxWidth: 520, height: 'fit-content' }}>
            <div style={{ background: 'var(--s0)', border: '1px solid var(--line2)', borderRadius: 2, overflow: 'hidden', boxShadow: 'var(--sh-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--t4)', fontSize: 14 }}>⌕</span>
                <input autoFocus value={searchQ} onChange={e => doSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQ(''); setSearchResults([]); }}}
                  placeholder="Search pages, files, commands…"
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: 14, fontFamily: 'var(--font)' }} />
                <kbd style={{ fontSize: 10, color: 'var(--t4)', padding: '2px 6px', background: 'var(--s2)', border: '1px solid var(--line)', borderRadius: 2 }}>ESC</kbd>
              </div>
              {searchQ && (
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {/* Quick nav results */}
                  {HEADER_TABS.filter(t => t.label.toLowerCase().includes(searchQ.toLowerCase())).map(t => (
                    <div key={t.id} onClick={() => navigate(t.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', transition: 'background .08s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(186,255,41,.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ fontSize: 12, color: 'var(--acc)' }}>→</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{t.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t4)' }}>page</span>
                    </div>
                  ))}
                  {/* API search results */}
                  {searchResults.map((r, i) => (
                    <div key={i} onClick={() => r.type === 'nav' && navigate(r.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer',
                        borderTop: '1px solid rgba(255,255,255,.04)', transition: 'background .08s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(186,255,41,.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ fontSize: 13 }}>{r.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                        {r.sub && <div style={{ fontSize: 10, color: 'var(--t4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>}
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t4)' }}>{r.type}</span>
                    </div>
                  ))}
                  {searchResults.length === 0 && HEADER_TABS.filter(t => t.label.toLowerCase().includes(searchQ.toLowerCase())).length === 0 && (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--t4)', fontSize: 12 }}>No results for "{searchQ}"</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
