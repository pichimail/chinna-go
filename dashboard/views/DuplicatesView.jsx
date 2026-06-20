/* DuplicatesView.jsx */

function DuplicatesView() {
  const [groups, setGroups] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState(new Set());

  React.useEffect(() => {
    fetch('/api/files?tab=dupes&sort=size').then(r => r.json()).then(d => {
      const files = d.files ?? d ?? [];
      const byHash = {};
      files.forEach(f => {
        const key = f.hash ?? f.size ?? f.human;
        if (!byHash[key]) byHash[key] = [];
        byHash[key].push(f);
      });
      const dupeGroups = Object.values(byHash).filter(g => g.length > 1);
      setGroups(dupeGroups);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function deleteSelected() {
    if (!selected.size || !confirm(`Delete ${selected.size} duplicate(s)?`)) return;
    for (const path of selected) {
      await fetch('/api/files/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) }).catch(() => {});
    }
    setSelected(new Set());
    setGroups(g => g.map(grp => grp.filter(f => !selected.has(f.path))).filter(grp => grp.length > 1));
  }

  function toggleFile(path) {
    setSelected(s => { const n = new Set(s); n.has(path) ? n.delete(path) : n.add(path); return n; });
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#ff8c00', marginBottom: '4px' }}>DUPLICATE FINDER</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Duplicates</h2>
          {selected.size > 0 && (
            <button onClick={deleteSelected} style={{ padding: '6px 14px', background: 'transparent', border: '1px solid rgba(255,51,51,.35)', color: '#ff3333', borderRadius: '2px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              🗑 Delete {selected.size} selected
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--t3)' }}>Scanning for duplicates…</div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--t3)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>✓</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t2)', marginBottom: '8px' }}>No duplicates found</div>
            <div style={{ fontSize: '12px' }}>Your file system looks clean</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '4px' }}>Found {groups.length} groups of duplicates</div>
            {groups.map((group, gi) => (
              <div key={gi} style={{ border: '1px solid var(--line)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', background: 'rgba(255,140,0,.05)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#ff8c00' }}>GROUP {gi + 1}</span>
                  <span style={{ fontSize: '11px', color: 'var(--t3)' }}>{group.length} copies · {group[0].human ?? group[0].size}</span>
                </div>
                {group.map((f, fi) => {
                  const path = f.path ?? f.name;
                  const name = path?.split('/').pop() ?? path;
                  const isSel = selected.has(path);
                  return (
                    <div key={fi} onClick={() => fi > 0 && toggleFile(path)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
                        background: isSel ? 'rgba(255,51,51,.06)' : fi === 0 ? 'rgba(186,255,41,.03)' : 'transparent',
                        borderBottom: fi < group.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                        cursor: fi > 0 ? 'pointer' : 'default' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '2px',
                        background: fi === 0 ? 'rgba(186,255,41,.1)' : 'rgba(255,51,51,.1)',
                        color: fi === 0 ? 'var(--acc)' : '#ff3333', flexShrink: 0 }}>
                        {fi === 0 ? 'ORIGINAL' : `COPY ${fi}`}
                      </span>
                      <span style={{ flex: 1, fontSize: '11px', color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                      <span style={{ fontSize: '10px', color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{path}</span>
                      {fi > 0 && <input type="checkbox" checked={isSel} readOnly style={{ flexShrink: 0, accentColor: '#ff3333' }} />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { DuplicatesView });
