/* Dock.jsx — Liquid glass bottom dock */

function Dock({ currentView, onNavigate }) {
  const [hidden, setHidden] = React.useState(false);
  const [zoom, setZoom] = React.useState({});
  const [tip, setTip] = React.useState(null);

  const items = [
    { id: 'overview', icon: '⌂', label: 'Overview', cls: 'c-overview' },
    { id: 'studio', icon: '◈', label: 'Studio', cls: 'c-ai' },
    { id: 'files', icon: '🗂', label: 'Files', cls: 'c-files' },
    { id: 'apps', icon: '⊞', label: 'Apps', cls: 'c-apps' },
    null,
    { id: 'duplicates', icon: '⊕', label: 'Duplicates', cls: 'c-dupes' },
    { id: 'plugins', icon: '⬡', label: 'Plugins', cls: 'c-plugins' },
    { id: 'settings', icon: '⚙', label: 'Settings', cls: 'c-settings' },
    null,
    { id: 'whatsapp', icon: '◎', label: 'WhatsApp', cls: 'c-wa' },
    { id: 'securechat', icon: '⊛', label: 'Secure Chat', cls: 'c-chat' },
    { id: 'webviews', icon: '⊙', label: 'Browser', cls: 'c-macos' },
  ];

  React.useEffect(() => {
    const trigger = document.getElementById('dock-trigger');
    const wrap = document.getElementById('dock-wrap');
    if (!trigger || !wrap) return;
    const show = () => setHidden(false);
    trigger.addEventListener('mouseenter', show);
    let timer;
    const hide = () => { timer = setTimeout(() => setHidden(true), 1800); };
    wrap.addEventListener('mouseleave', hide);
    wrap.addEventListener('mouseenter', () => clearTimeout(timer));
    return () => { trigger.removeEventListener('mouseenter', show); wrap.removeEventListener('mouseleave', hide); };
  }, []);

  function handleMouseMove(e, id) {
    const dock = document.getElementById('dock');
    if (!dock) return;
    const dockRect = dock.getBoundingClientRect();
    const center = dockRect.left + dockRect.width / 2;
    const x = e.clientX;
    const dist = Math.abs(x - center);
    const maxDist = dockRect.width * 0.6;
    const scale = dist < maxDist ? 1 + 0.35 * Math.max(0, 1 - dist / maxDist) : 1;
    setZoom(prev => ({ ...prev, [id]: scale }));
  }

  function resetZoom() { setZoom({}); }

  return (
    <div id="dock-wrap" className={hidden ? 'dock-hidden' : ''} style={{
      position: 'fixed', bottom: '12px',
      left: '50%',
      transform: 'translateX(-50%)', zIndex: 300,
      display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
      pointerEvents: 'none', transition: 'bottom .22s ease, opacity .2s',
    }}>
      <div id="dock" style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', padding: '9px 16px',
        borderRadius: '24px', pointerEvents: 'all',
        background: 'rgba(255,255,255,.07)', backdropFilter: 'blur(50px) saturate(200%)',
        WebkitBackdropFilter: 'blur(50px) saturate(200%)',
        border: '1px solid rgba(255,255,255,.15)',
        boxShadow: '0 12px 40px rgba(0,0,0,.5), 0 1px 0 rgba(255,255,255,.2) inset, 0 -1px 0 rgba(0,0,0,.3) inset',
      }}>
        {items.map((item, i) => {
          if (item === null) return (
            <div key={`sep-${i}`} style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,.14)', margin: '0 4px', alignSelf: 'center' }} />
          );
          const active = currentView === item.id;
          const scale = zoom[item.id] || 1;
          return (
            <div key={item.id}
              style={{
                position: 'relative', width: '46px', height: '46px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px', cursor: 'pointer', borderRadius: '13px',
                border: '1px solid rgba(255,255,255,.16)',
                boxShadow: '0 2px 10px rgba(0,0,0,.32), 0 1px 0 rgba(255,255,255,.22) inset',
                transformOrigin: 'bottom center',
                transform: `scale(${scale})`,
                transition: 'transform .12s ease, box-shadow .15s ease',
                background: active
                  ? 'linear-gradient(160deg,rgba(186,255,41,.5),rgba(186,255,41,.2))'
                  : `linear-gradient(160deg,rgba(255,255,255,.14),rgba(255,255,255,.04))`,
                flexShrink: 0,
              }}
              title={item.label}
              onClick={() => onNavigate(item.id)}
              onMouseMove={(e) => handleMouseMove(e, item.id)}
              onMouseLeave={resetZoom}
              onMouseEnter={() => setTip(item.id)}
            >
              {item.icon}
              {active && (
                <div style={{ position: 'absolute', bottom: '-6px', left: '50%', transform: 'translateX(-50%)',
                  width: '4px', height: '4px', borderRadius: '50%', background: '#fff',
                  boxShadow: '0 0 6px rgba(255,255,255,.8)' }} />
              )}
              {tip === item.id && (
                <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%',
                  transform: 'translateX(-50%)', background: 'rgba(12,12,14,.94)',
                  backdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,.12)',
                  color: 'rgba(240,240,242,.95)', fontSize: '11px', fontWeight: 600,
                  padding: '5px 11px', borderRadius: '8px', whiteSpace: 'nowrap',
                  boxShadow: '0 4px 16px rgba(0,0,0,.4)', pointerEvents: 'none', zIndex: 999,
                }}>{item.label}</div>
              )}
            </div>
          );
        })}
      </div>
      <div id="dock-trigger" style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', height: '48px', zIndex: 299, pointerEvents: 'auto' }} />
    </div>
  );
}

Object.assign(window, { Dock });
