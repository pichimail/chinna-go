/* App.jsx — Sidebar + routing */

const SIDEBAR_SECTIONS = [
  {
    label: 'MAIN',
    items: [
      { id: 'overview', icon: '⌂', label: 'Overview', accent: '#baff29' },
      { id: 'studio', icon: '◈', label: 'Studio', accent: '#d54cff' },
      { id: 'files', icon: '🗂', label: 'Files', accent: '#ffc700' },
      { id: 'apps', icon: '⊞', label: 'Apps', accent: '#ff8c00' },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { id: 'duplicates', icon: '⊕', label: 'Duplicates', accent: '#ff8c00' },
      { id: 'plugins', icon: '⬡', label: 'Plugins', accent: '#d54cff' },
      { id: 'settings', icon: '⚙', label: 'Settings', accent: '#00e5ff' },
    ],
  },
  {
    label: 'COMMS',
    items: [
      { id: 'whatsapp', icon: '◎', label: 'WhatsApp', accent: '#2edd5e', badge: 'WA' },
      { id: 'securechat', icon: '⊛', label: 'Secure Chat', accent: '#00e5ff' },
      { id: 'webviews', icon: '⊙', label: 'Browser', accent: '#0080ff' },
    ],
  },
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

function NotificationBell({ notifications, onToggle }) {
  const [open, setOpen] = React.useState(false);
  const count = notifications.filter(n => !n.read).length;

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '32px', height: '32px', border: '1px solid var(--line)', borderRadius: '2px',
          background: 'transparent', color: 'var(--t2)', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: '14px', position: 'relative' }}>
        🔔
        {count > 0 && (
          <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px',
            borderRadius: '50%', background: '#ff3333', color: '#fff', fontSize: '9px',
            fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {count}
          </div>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: '280px',
          background: 'rgba(0,0,0,.94)', backdropFilter: 'blur(16px)', border: '1px solid var(--line)',
          borderRadius: '2px', zIndex: 999, boxShadow: '0 8px 32px rgba(0,0,0,.6)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--t3)' }}>NOTIFICATIONS</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer' }}>×</button>
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--t3)', fontSize: '12px' }}>No notifications</div>
          ) : notifications.slice(0, 8).map((n, i) => (
            <div key={i} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '14px', flexShrink: 0 }}>{n.icon ?? 'ℹ'}</span>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)' }}>{n.title}</div>
                <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '2px' }}>{n.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [view, setView] = React.useState('overview');
  const [collapsed, setCollapsed] = React.useState(false);
  const [notifications, setNotifications] = React.useState([]);
  const [stats, setStats] = React.useState({});
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQ, setSearchQ] = React.useState('');

  React.useEffect(() => {
    const poll = () => fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {});
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  function pushNotification(icon, title, body) {
    setNotifications(n => [{ icon, title, body, read: false, time: Date.now() }, ...n].slice(0, 50));
  }
  window.__pushNotification = pushNotification;

  function navigate(id) { if (VIEWS[id]) setView(id); }
  React.useEffect(() => { window.__navigate = navigate; }, []);

  const cpu = stats.cpu?.pct ?? 0;
  const ram = stats.memory?.pct ?? 0;

  const currentItem = SIDEBAR_SECTIONS.flatMap(s => s.items).find(i => i.id === view);
  const ViewComp = window[VIEWS[view] ?? ''];

  return (
    <div id="app" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>

      {/* SIDEBAR */}
      <div id="sidebar" style={{
        width: collapsed ? '54px' : '220px', minWidth: collapsed ? '54px' : '220px', maxWidth: collapsed ? '54px' : '220px',
        flexShrink: 0, background: 'var(--s0)', borderRight: '1px solid var(--line)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 10,
        transition: 'width .18s ease, min-width .18s ease, max-width .18s ease',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '14px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <img src="assets/chinna-icon.svg" style={{ width: '28px', height: '28px', borderRadius: '4px', flexShrink: 0, objectFit: 'cover' }} alt="Chinna"
            onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
          />
          <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: 'var(--acc)', display: 'none', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 900, color: '#030a00', flexShrink: 0 }}>C</div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--t1)', whiteSpace: 'nowrap' }}>CHINNA</div>
              <div style={{ fontSize: '9px', fontWeight: 600, color: 'var(--acc)', letterSpacing: '1px', opacity: 0.8 }}>v7.0</div>
            </div>
          )}
          <button onClick={() => setCollapsed(c => !c)}
            style={{ marginLeft: 'auto', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--t3)', borderRadius: '2px', cursor: 'pointer', flexShrink: 0, fontSize: '12px' }}>
            {collapsed ? '»' : '«'}
          </button>
        </div>

        {/* Nav */}
        <div id="nav" style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {SIDEBAR_SECTIONS.map((section, si) => (
            <div key={si}>
              {!collapsed && (
                <div style={{ padding: '10px 14px 4px', fontSize: '9px', fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--t3)', userSelect: 'none',
                  ...(si > 0 ? { borderTop: '1px solid var(--line)', marginTop: '4px', paddingTop: '12px' } : {}) }}>
                  {section.label}
                </div>
              )}
              {section.items.map(item => {
                const active = view === item.id;
                return (
                  <div key={item.id} onClick={() => navigate(item.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '9px',
                      padding: collapsed ? '9px' : '7px 14px',
                      color: active ? item.accent : 'var(--t2)',
                      fontSize: '12.5px', fontWeight: active ? 600 : 450,
                      cursor: 'pointer', transition: 'all .1s',
                      borderLeft: collapsed ? 'none' : `2px solid ${active ? item.accent : 'transparent'}`,
                      borderBottom: collapsed ? `2px solid ${active ? item.accent : 'transparent'}` : 'none',
                      background: active ? `${item.accent}0d` : 'transparent',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--s2)'; e.currentTarget.style.color = 'var(--t1)'; } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = active ? `${item.accent}0d` : 'transparent'; e.currentTarget.style.color = active ? item.accent : 'var(--t2)'; } }}>
                    <span style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '13px', opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                    {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
                    {!collapsed && item.badge && (
                      <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '2px', background: 'rgba(186,255,41,.15)', color: 'var(--acc)' }}>{item.badge}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom vitals */}
        {!collapsed && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', flexShrink: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            {[['CPU', `${cpu}%`, '#baff29'], ['RAM', `${ram}%`, '#0080ff']].map(([k, v, c]) => (
              <div key={k} style={{ padding: '5px 8px', background: 'var(--s1)', border: '1px solid var(--line)', borderRadius: '2px' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--t3)' }}>{k}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: c }}>{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CENTER */}
      <div id="center" style={{ flex: '1 1 0', minWidth: 0, background: 'var(--bg)', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', zIndex: 1 }}>
        {/* Top command bar */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderBottom: '1px solid var(--line)', minHeight: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {currentItem && <span style={{ fontSize: '12px', color: currentItem.accent }}>{currentItem.icon}</span>}
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t2)' }}>{currentItem?.label ?? 'Chinna'}</span>
          </div>
          <div style={{ flex: 1 }} />
          {searchOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--s1)', border: '1px solid var(--line2)', borderRadius: '2px', padding: '4px 10px', minWidth: '200px' }}>
              <span style={{ color: 'var(--t3)', fontSize: '12px' }}>⌕</span>
              <input autoFocus value={searchQ} onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && (setSearchOpen(false), setSearchQ(''))}
                placeholder="Search…"
                style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: '12px', fontFamily: 'var(--font)', width: '100%' }} />
              <button onClick={() => { setSearchOpen(false); setSearchQ(''); }} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: '14px' }}>×</button>
            </div>
          ) : (
            <button onClick={() => setSearchOpen(true)}
              style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid var(--line)', borderRadius: '2px', background: 'transparent', color: 'var(--t3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span>⌕</span><span>⌘K</span>
            </button>
          )}
          <NotificationBell notifications={notifications} />
        </div>

        {/* View area */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {ViewComp ? (
            <ViewComp onNavigate={navigate} />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}>
              View not found: {view}
            </div>
          )}
        </div>
      </div>

      {/* DOCK */}
      <Dock currentView={view} onNavigate={navigate} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
