/* PluginsView.jsx */

function PluginsView() {
  const [plugins, setPlugins] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [log, setLog] = React.useState('');

  React.useEffect(() => {
    fetch('/api/plugins').then(r => r.json()).then(d => {
      setPlugins(d.plugins ?? d ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function runPlugin(plugin) {
    setLog(`Running ${plugin.name}…\n`);
    try {
      const d = await fetch(`/api/plugins/${plugin.id}`, { method: 'POST' }).then(r => r.json());
      setLog(prev => prev + (d.output ?? d.result ?? JSON.stringify(d, null, 2)));
    } catch (e) { setLog(prev => prev + `Error: ${e.message}`); }
  }

  const ICON_COLORS = { optimizer: '#baff29', cleaner: '#2edd5e', monitor: '#0080ff', utility: '#ffc700', security: '#ff3333', default: '#d54cff' };
  const color = (p) => ICON_COLORS[p.category?.toLowerCase()] ?? ICON_COLORS.default;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#d54cff', marginBottom: '4px' }}>PLUGIN ENGINE</div>
        <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Plugins</h2>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', gap: '16px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--t3)' }}>Loading plugins…</div>
          ) : plugins.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--t3)' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>⬡</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t2)', marginBottom: '8px' }}>No plugins installed</div>
              <div style={{ fontSize: '12px' }}>Add plugins to extend Chinna's capabilities</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
              {plugins.map((p, i) => (
                <div key={i} style={{ border: '1px solid var(--line)', borderRadius: '2px', padding: '14px', cursor: 'pointer',
                  transition: 'border-color .15s, background .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = color(p) + '66'; e.currentTarget.style.background = color(p) + '08'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '22px' }}>{p.icon ?? '⬡'}</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)' }}>{p.name}</div>
                      {p.category && <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: color(p), marginTop: '2px' }}>{p.category}</div>}
                    </div>
                  </div>
                  {p.description && <div style={{ fontSize: '11px', color: 'var(--t3)', lineHeight: 1.5, marginBottom: '10px' }}>{p.description}</div>}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => runPlugin(p)}
                      style={{ flex: 1, padding: '5px', border: `1px solid ${color(p)}44`, background: 'transparent', color: color(p), borderRadius: '2px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                      ▶ Run
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {log && (
          <div style={{ width: '300px', flexShrink: 0, border: '1px solid var(--line)', borderRadius: '2px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t2)' }}>Output</span>
              <button onClick={() => setLog('')} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: '14px' }}>×</button>
            </div>
            <pre style={{ flex: 1, overflowY: 'auto', padding: '12px', margin: 0, fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--t2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
              {log}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { PluginsView });
