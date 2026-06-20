/* FilesView.jsx */

function FilesView() {
  const [tab, setTab] = React.useState('large');
  const [files, setFiles] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [sort, setSort] = React.useState('size');
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState(new Set());

  const loadFiles = React.useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch(`/api/files?tab=${tab}&sort=${sort}`).then(r => r.json());
      setFiles(d.files ?? d ?? []);
    } catch { setFiles([]); }
    setLoading(false);
  }, [tab, sort]);

  React.useEffect(() => { loadFiles(); }, [loadFiles]);

  const filtered = files.filter(f => !search || (f.name ?? f.path ?? '').toLowerCase().includes(search.toLowerCase()));

  const EXT_COLORS = { mp4: '#ff8c00', mov: '#ff8c00', zip: '#ffc700', rar: '#ffc700', pdf: '#ff3333', dmg: '#d54cff', app: '#0080ff' };
  const ext = f => (f.name ?? f.path ?? '').split('.').pop()?.toLowerCase() ?? '';

  function toggleSelect(path) {
    setSelected(s => { const n = new Set(s); n.has(path) ? n.delete(path) : n.add(path); return n; });
  }

  async function deleteSelected() {
    if (!selected.size || !confirm(`Delete ${selected.size} file(s)?`)) return;
    for (const path of selected) {
      await fetch('/api/files/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) }).catch(() => {});
    }
    setSelected(new Set()); loadFiles();
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#ffc700', marginBottom: '4px' }}>FILE MANAGER</div>
        <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Files</h2>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '8px', padding: '8px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', background: 'var(--s1)', border: '1px solid var(--line)', borderRadius: '2px', padding: '2px' }}>
          {[['large', '⬤ Large'], ['downloads', '↓ Downloads'], ['dupes', '⊕ Dupes']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ border: 'none', padding: '5px 12px', fontSize: '11px', fontWeight: 600,
              background: tab === id ? 'var(--acc)' : 'transparent', color: tab === id ? '#000' : 'var(--t3)',
              borderRadius: '1px', cursor: 'pointer', fontFamily: 'var(--font)' }}>{label}</button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: '120px', display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--s1)', border: '1px solid var(--line2)', borderRadius: '2px', padding: '5px 10px' }}>
          <span style={{ color: 'var(--t3)' }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: '12px', fontFamily: 'var(--font)' }} />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)}
          style={{ background: 'var(--s1)', border: '1px solid var(--line2)', color: 'var(--t1)', fontSize: '11px', padding: '5px 9px', borderRadius: '2px', cursor: 'pointer' }}>
          <option value="size">Size ↓</option>
          <option value="date">Date ↓</option>
          <option value="name">Name A-Z</option>
        </select>
        {selected.size > 0 && (
          <button onClick={deleteSelected} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid rgba(255,51,51,.35)', color: '#ff3333', borderRadius: '2px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
            🗑 Delete ({selected.size})
          </button>
        )}
        <button onClick={loadFiles} style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--line2)', color: 'var(--t2)', borderRadius: '2px', fontSize: '11px', cursor: 'pointer' }}>↺ Refresh</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--t3)' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>⟳</div>Scanning…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--t3)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>🗂</div>
            No files found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filtered.map((f, i) => {
              const name = f.name ?? f.path?.split('/').pop() ?? '?';
              const size = f.human ?? f.size ?? '—';
              const color = EXT_COLORS[ext(f)] ?? 'var(--t3)';
              const path = f.path ?? f.name;
              return (
                <div key={i} onClick={() => toggleSelect(path)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                    border: '1px solid ' + (selected.has(path) ? 'rgba(186,255,41,.35)' : 'transparent'),
                    background: selected.has(path) ? 'rgba(186,255,41,.05)' : 'transparent',
                    borderRadius: '2px', cursor: 'pointer', transition: 'all .1s' }}
                  onMouseEnter={e => { if (!selected.has(path)) { e.currentTarget.style.background = 'var(--s1)'; e.currentTarget.style.borderColor = 'var(--line)'; } }}
                  onMouseLeave={e => { if (!selected.has(path)) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '2px', background: 'var(--s1)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                    {ext(f) === 'mp4' || ext(f) === 'mov' ? '🎬' : ext(f) === 'zip' || ext(f) === 'rar' ? '📦' : ext(f) === 'pdf' ? '📄' : ext(f) === 'dmg' ? '💿' : '📎'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path}</div>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', color, flexShrink: 0 }}>{size}</div>
                  <div style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '2px', background: 'rgba(186,255,41,.1)', color: 'var(--acc)', border: '1px solid rgba(186,255,41,.25)', fontWeight: 700, flexShrink: 0 }}>
                    {ext(f).toUpperCase() || 'FILE'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { FilesView });
