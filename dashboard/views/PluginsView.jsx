/* PluginsView.jsx — Plugin engine with category filters, column toggle, action buttons */

function PluginsView() {
  const [plugins, setPlugins] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [log, setLog] = React.useState('');
  const [busyId, setBusyId] = React.useState(null);
  const [logTitle, setLogTitle] = React.useState('Output');
  const [cols, setCols] = React.useState(3);
  const [filter, setFilter] = React.useState('all');
  const [expanded, setExpanded] = React.useState(null);

  React.useEffect(() => {
    fetch('/api/plugins').then(r => r.json()).then(d => {
      setPlugins(d.plugins ?? d ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function runPlugin(plugin, actionId) {
    if (busyId) return;
    let action = actionId;
    if (!action) {
      try {
        const meta = await fetch(`/api/plugins/${plugin.id}`).then(r => r.json());
        const acts = meta.actions ?? plugin.actions ?? [];
        action = (acts[0] && (acts[0].id ?? acts[0].name ?? acts[0])) || 'run';
      } catch { action = 'run'; }
    }
    setBusyId(plugin.id);
    setLogTitle(`${plugin.name} · ${action}`);
    setLog(`> Running ${plugin.name} · ${action}…\n`);
    try {
      const d = await fetch('/api/plugins/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plugin: plugin.id, action, payload: {} }),
      }).then(r => r.json());
      const out = d.output ?? d.result ?? d.error ?? JSON.stringify(d, null, 2);
      setLog(prev => prev + out + '\n');
    } catch (e) {
      setLog(prev => prev + `Error: ${e.message}\n`);
    }
    setBusyId(null);
  }

  const ICON_COLORS = { optimizer: '#baff29', cleaner: '#2edd5e', monitor: '#0080ff', utility: '#ffc700', security: '#ff3333', default: '#d54cff' };
  const color = (p) => ICON_COLORS[p.category?.toLowerCase()] ?? ICON_COLORS.default;

  const categories = ['all', ...new Set(plugins.map(p => p.category?.toLowerCase()).filter(Boolean))];
  const filtered = filter === 'all' ? plugins : plugins.filter(p => (p.category ?? '').toLowerCase() === filter);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#d54cff', marginBottom: 4 }}>PLUGIN ENGINE</div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Plugins</h2>
        </div>
        {!loading && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{filtered.length} plugins</div>}
      </div>

      {/* Toolbar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Category filters */}
        <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              style={{ padding: '4px 10px', border: `1px solid ${filter === c ? '#d54cff' : 'var(--line)'}`,
                borderRadius: 2, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: filter === c ? 'rgba(213,76,255,.12)' : 'transparent',
                color: filter === c ? '#d54cff' : 'var(--t3)', transition: 'all .1s',
                fontFamily: 'var(--font)', textTransform: 'capitalize' }}>
              {c}
            </button>
          ))}
        </div>

        {/* Column toggle */}
        <div style={{ display: 'flex', background: 'var(--s1)', border: '1px solid var(--line)', borderRadius: 2, padding: 2 }}>
          {[2, 3, 4].map(n => (
            <button key={n} onClick={() => setCols(n)}
              style={{ border: 'none', padding: '4px 10px', fontSize: 11, fontWeight: 600,
                background: cols === n ? 'var(--acc)' : 'transparent', color: cols === n ? '#000' : 'var(--t3)',
                borderRadius: 1, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              {n}col
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--t3)' }}>
              <div className="spin" style={{ fontSize: 24, marginBottom: 12 }}>⟳</div>
              Loading plugins…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--t3)' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: .3 }}>⬡</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t2)', marginBottom: 8 }}>No plugins found</div>
              <div style={{ fontSize: 12 }}>Add plugins to extend Chinna's capabilities</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
              {filtered.map((p, i) => {
                const isExpanded = expanded === p.id;
                const c = color(p);
                return (
                  <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 2, padding: 14, cursor: 'pointer',
                    transition: 'all .15s', background: isExpanded ? `${c}06` : 'transparent',
                    borderColor: isExpanded ? `${c}44` : 'var(--line)' }}
                    onClick={() => setExpanded(isExpanded ? null : p.id)}
                    onMouseEnter={e => { if (!isExpanded) { e.currentTarget.style.borderColor = c + '44'; e.currentTarget.style.background = c + '06'; }}}
                    onMouseLeave={e => { if (!isExpanded) { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'transparent'; }}}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 22 }}>{p.icon ?? '⬡'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{p.name}</div>
                        {p.category && <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: c, marginTop: 2 }}>{p.category}</div>}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--t4)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }}>▼</span>
                    </div>
                    {p.description && <div style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.5, marginBottom: isExpanded ? 10 : 0 }}>{p.description}</div>}
                    {isExpanded && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => runPlugin(p)} disabled={!!busyId}
                          style={{ flex: 1, padding: 6, border: `1px solid ${c}44`, background: busyId === p.id ? `${c}10` : 'transparent',
                            color: c, borderRadius: 2, fontSize: 11, fontWeight: 700, cursor: busyId ? 'wait' : 'pointer',
                            opacity: busyId && busyId !== p.id ? .5 : 1, transition: 'all .1s' }}>
                          {busyId === p.id ? 'Running…' : 'Run'}
                        </button>
                        {(p.actions ?? []).slice(1, 3).map((a, ai) => (
                          <button key={ai} onClick={() => runPlugin(p, a.id ?? a.name ?? a)} disabled={!!busyId}
                            style={{ padding: '6px 10px', border: '1px solid var(--line)', background: 'transparent',
                              color: 'var(--t3)', borderRadius: 2, fontSize: 11, fontWeight: 600, cursor: busyId ? 'wait' : 'pointer' }}>
                            {a.label ?? a.name ?? a}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {log && (
          <div style={{ width: 300, flexShrink: 0, border: '1px solid var(--line)', borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)' }}>{logTitle}</span>
              <button onClick={() => setLog('')} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 14 }}>×</button>
            </div>
            <pre style={{ flex: 1, overflowY: 'auto', padding: 12, margin: 0, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--t2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
              {log}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { PluginsView });
