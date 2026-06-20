/* FilesView.jsx */

function FilesView() {
  const [tab, setTab] = React.useState('large');
  const [files, setFiles] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [sort, setSort] = React.useState('size');
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState(new Set());
  const [stats, setStats] = React.useState(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteProgress, setDeleteProgress] = React.useState({ done: 0, total: 0 });
  const [toast, setToast] = React.useState(null);
  const [busyFile, setBusyFile] = React.useState(null);

  const loadFiles = React.useCallback(async () => {
    setLoading(true);
    setStats(null);
    try {
      const [d, s] = await Promise.all([
        fetch(`/api/files?tab=${tab}&sort=${sort}`).then(r => r.json()),
        fetch(`/api/files/stats?tab=${tab}`).then(r => r.json()).catch(() => null),
      ]);
      setFiles(d.files ?? d ?? []);
      if (s) setStats(s);
    } catch { setFiles([]); }
    setLoading(false);
  }, [tab, sort]);

  React.useEffect(() => { loadFiles(); }, [loadFiles]);

  const filtered = files.filter(f => !search || (f.name ?? f.path ?? '').toLowerCase().includes(search.toLowerCase()));

  const EXT_COLORS = { mp4: '#ff8c00', mov: '#ff8c00', zip: '#ffc700', rar: '#ffc700', pdf: '#ff3333', dmg: '#d54cff', app: '#0080ff' };
  const ext = f => (f.name ?? f.path ?? '').split('.').pop()?.toLowerCase() ?? '';
  const fileIcon = f => {
    const e = ext(f);
    if (e === 'mp4' || e === 'mov' || e === 'avi') return '🎬';
    if (e === 'zip' || e === 'rar' || e === '7z' || e === 'tar' || e === 'gz') return '📦';
    if (e === 'pdf') return '📄';
    if (e === 'dmg' || e === 'pkg') return '💿';
    if (e === 'jpg' || e === 'jpeg' || e === 'png' || e === 'gif' || e === 'webp') return '🖼';
    if (e === 'mp3' || e === 'wav' || e === 'm4a' || e === 'flac') return '🎵';
    return '📎';
  };

  function toggleSelect(path) {
    setSelected(s => { const n = new Set(s); n.has(path) ? n.delete(path) : n.add(path); return n; });
  }

  function selectAll() { setSelected(new Set(filtered.map(f => f.path ?? f.name))); }
  function clearSelect() { setSelected(new Set()); }

  function showToast(msg, color = '#2edd5e') {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  }

  async function openFile(path) {
    setBusyFile(path + ':open');
    try {
      const d = await fetch('/api/files/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) }).then(r => r.json());
      if (d.ok) showToast('Opened in default app');
      else showToast(d.error ?? 'Failed', '#ff3333');
    } catch { showToast('Failed to open', '#ff3333'); }
    setBusyFile(null);
  }

  async function revealFile(path) {
    setBusyFile(path + ':reveal');
    try {
      await fetch('/api/files/reveal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) }).then(r => r.json());
      showToast('Revealed in Finder');
    } catch { showToast('Failed', '#ff3333'); }
    setBusyFile(null);
  }

  async function deleteSelected() {
    if (!selected.size) return;
    const paths = [...selected];
    setDeleting(true);
    setDeleteProgress({ done: 0, total: paths.length });
    let done = 0;
    for (const path of paths) {
      await fetch('/api/files/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) }).catch(() => {});
      done++;
      setDeleteProgress({ done, total: paths.length });
    }
    setDeleting(false);
    setSelected(new Set());
    showToast(`Deleted ${done} file${done !== 1 ? 's' : ''}`);
    loadFiles();
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#ffc700', marginBottom: '4px' }}>FILE MANAGER</div>
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Files</h2>
        </div>
        {stats && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--t1)', fontFamily: 'var(--mono)' }}>{stats.total_human}</div>
            <div style={{ fontSize: '10px', color: 'var(--t3)' }}>{stats.count} files</div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 9999, padding: '8px 16px', borderRadius: '2px', border: `1px solid ${toast.color}44`, background: `${toast.color}14`, color: toast.color, fontSize: '12px', fontWeight: 700 }}>
          {toast.msg}
        </div>
      )}

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
        {filtered.length > 0 && selected.size === 0 && (
          <button onClick={selectAll} style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--line2)', color: 'var(--t3)', borderRadius: '2px', fontSize: '11px', cursor: 'pointer' }}>
            ☐ All
          </button>
        )}
        {selected.size > 0 && (
          <>
            <button onClick={clearSelect} style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--line2)', color: 'var(--t3)', borderRadius: '2px', fontSize: '11px', cursor: 'pointer' }}>✕ Clear</button>
            <button onClick={deleteSelected} disabled={deleting}
              style={{ padding: '5px 12px', background: 'transparent', border: '1px solid rgba(255,51,51,.35)', color: '#ff3333', borderRadius: '2px', fontSize: '11px', fontWeight: 600, cursor: deleting ? 'wait' : 'pointer' }}>
              {deleting ? `⟳ Deleting ${deleteProgress.done}/${deleteProgress.total}…` : `🗑 Delete (${selected.size})`}
            </button>
          </>
        )}
        <button onClick={loadFiles} style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--line2)', color: 'var(--t2)', borderRadius: '2px', fontSize: '11px', cursor: 'pointer' }}>↺</button>
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
              const isSel = selected.has(path);
              return (
                <div key={i}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px',
                    border: '1px solid ' + (isSel ? 'rgba(186,255,41,.35)' : 'transparent'),
                    background: isSel ? 'rgba(186,255,41,.04)' : 'transparent',
                    borderRadius: '2px', transition: 'all .1s' }}
                  onMouseEnter={e => { if (!isSel) { e.currentTarget.style.background = 'var(--s1)'; e.currentTarget.style.borderColor = 'var(--line)'; } }}
                  onMouseLeave={e => { if (!isSel) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}>
                  {/* Checkbox */}
                  <input type="checkbox" checked={isSel} onChange={() => toggleSelect(path)}
                    style={{ flexShrink: 0, accentColor: 'var(--acc)', cursor: 'pointer' }} />
                  {/* Icon */}
                  <div style={{ width: '28px', height: '28px', borderRadius: '2px', background: 'var(--s1)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0, cursor: 'pointer' }}
                    onClick={() => toggleSelect(path)}>
                    {fileIcon(f)}
                  </div>
                  {/* Name + path */}
                  <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => toggleSelect(path)}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path}</div>
                  </div>
                  {/* Size */}
                  <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', color, flexShrink: 0 }}>{size}</div>
                  {/* Ext badge */}
                  <div style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '2px', background: 'rgba(186,255,41,.08)', color: 'var(--acc)', border: '1px solid rgba(186,255,41,.2)', fontWeight: 700, flexShrink: 0, minWidth: '28px', textAlign: 'center' }}>
                    {ext(f).toUpperCase() || 'FILE'}
                  </div>
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button onClick={() => openFile(path)} disabled={busyFile === path + ':open'}
                      title="Open"
                      style={{ padding: '3px 7px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: '2px', color: 'var(--t3)', fontSize: '11px', cursor: 'pointer' }}>
                      ▶
                    </button>
                    <button onClick={() => revealFile(path)} disabled={busyFile === path + ':reveal'}
                      title="Reveal in Finder"
                      style={{ padding: '3px 7px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: '2px', color: 'var(--t3)', fontSize: '11px', cursor: 'pointer' }}>
                      ⌐
                    </button>
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
