/* DuplicatesView.jsx — Duplicate finder with List · Icons views and inline media preview */

function DuplicatesView() {
  const [groups, setGroups] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState(new Set());
  const [deleting, setDeleting] = React.useState(false);
  const [deleteProgress, setDeleteProgress] = React.useState({ done: 0, total: 0 });
  const [toast, setToast] = React.useState(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [previewModal, setPreviewModal] = React.useState(null);
  const [viewMode, setViewMode] = React.useState('list');  // list | icons
  const [expandedGroups, setExpandedGroups] = React.useState(new Set());

  const loadDupes = React.useCallback(() => {
    setLoading(true);
    fetch('/api/files?tab=dupes&sort=size').then(r => r.json()).then(d => {
      const files = d.files ?? d ?? [];
      const byGroup = {};
      files.forEach(f => {
        const key = f.dupe_group ?? f.hash ?? f.human;
        if (!byGroup[key]) byGroup[key] = [];
        byGroup[key].push(f);
      });
      const dupeGroups = Object.values(byGroup).filter(g => g.length > 1);
      setGroups(dupeGroups);
      // Expand all groups by default
      setExpandedGroups(new Set(dupeGroups.map((_, i) => i)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  React.useEffect(() => { loadDupes(); }, [loadDupes]);

  function showToast(msg, color = '#2edd5e') {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3500);
  }

  function toggleFile(path) {
    setSelected(s => { const n = new Set(s); n.has(path) ? n.delete(path) : n.add(path); return n; });
  }
  function autoSelectCopies() {
    const copies = new Set();
    groups.forEach(grp => grp.slice(1).forEach(f => copies.add(f.path ?? f.name)));
    setSelected(copies);
  }
  function selectGroupCopies(grp) {
    setSelected(s => { const n = new Set(s); grp.slice(1).forEach(f => n.add(f.path ?? f.name)); return n; });
  }
  function deselectGroup(grp) {
    setSelected(s => { const n = new Set(s); grp.slice(1).forEach(f => n.delete(f.path ?? f.name)); return n; });
  }
  function clearSelect() { setSelected(new Set()); }

  function toggleGroup(i) {
    setExpandedGroups(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  const spaceSaved = React.useMemo(() => {
    let bytes = 0;
    groups.forEach(grp => grp.slice(1).forEach(f => {
      if (selected.has(f.path ?? f.name)) bytes += (f.size_bytes || 0);
    }));
    if (bytes === 0) return null;
    if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes/1048576).toFixed(1)} MB`;
    return `${(bytes/1073741824).toFixed(2)} GB`;
  }, [groups, selected]);

  const totalWaste = React.useMemo(() => {
    let bytes = 0;
    groups.forEach(grp => grp.slice(1).forEach(f => bytes += (f.size_bytes || 0)));
    if (bytes < 1048576) return `${(bytes/1024).toFixed(0)} KB`;
    if (bytes < 1073741824) return `${(bytes/1048576).toFixed(1)} MB`;
    return `${(bytes/1073741824).toFixed(2)} GB`;
  }, [groups]);

  async function deleteSelected() {
    const paths = [...selected];
    setConfirmOpen(false); setDeleting(true);
    setDeleteProgress({ done: 0, total: paths.length });
    let done = 0;
    for (const path of paths) {
      await fetch('/api/files/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) }).catch(() => {});
      done++; setDeleteProgress({ done, total: paths.length });
    }
    setDeleting(false); setSelected(new Set());
    showToast(`Deleted ${done} duplicate${done !== 1 ? 's' : ''} · Freed ${spaceSaved}`);
    loadDupes();
  }

  // Flatten all files for modal navigation
  const allFiles = React.useMemo(() => groups.flatMap(g => g), [groups]);

  /* ─── File card for icons view ─── */
  function DupeCard({ f, isOriginal, groupSize }) {
    const path = f.path ?? f.name;
    const name = path?.split('/').pop() ?? path;
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    const isSel = selected.has(path);
    const isImg = ['jpg','jpeg','png','gif','webp','svg','bmp','avif'].includes(ext);
    const streamUrl = isImg ? `/api/files/stream?path=${encodeURIComponent(path)}` : null;
    const isPrev = ['jpg','jpeg','png','gif','webp','svg','mp4','mov','mp3','wav','m4a','flac'].includes(ext);

    return (
      <div onClick={() => !isOriginal && toggleFile(path)}
        style={{ position: 'relative', border: `1px solid ${isSel ? 'rgba(255,51,51,.5)' : isOriginal ? 'rgba(186,255,41,.3)' : 'var(--line)'}`,
          background: isSel ? 'rgba(255,51,51,.07)' : isOriginal ? 'rgba(186,255,41,.04)' : 'transparent',
          borderRadius: '2px', padding: '10px', cursor: isOriginal ? 'default' : 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
          transition: 'all .12s' }}>
        {/* Badge */}
        <div style={{ position: 'absolute', top: '6px', left: '6px', fontSize: '8px', fontWeight: 800,
            padding: '2px 5px', borderRadius: '2px',
            background: isOriginal ? 'rgba(186,255,41,.15)' : 'rgba(255,51,51,.15)',
            color: isOriginal ? '#baff29' : '#ff3333', letterSpacing: '0.5px' }}>
          {isOriginal ? 'ORIGINAL' : 'COPY'}
        </div>
        {/* Checkbox */}
        {!isOriginal && (
          <div style={{ position: 'absolute', top: '6px', right: '6px' }}>
            <input type="checkbox" checked={isSel} readOnly
              style={{ accentColor: '#ff3333', cursor: 'pointer' }} />
          </div>
        )}
        {/* Thumbnail */}
        <div style={{ width: '72px', height: '72px', marginTop: '14px', borderRadius: '4px',
            overflow: 'hidden', background: 'var(--s1)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', position: 'relative' }}>
          {isImg && streamUrl ? (
            <img src={streamUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '28px' }}>{fileIcon(f)}</span>
          )}
          {isPrev && (
            <div onClick={e => { e.stopPropagation(); setPreviewModal(f); }}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity .15s', fontSize: '18px', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0'}>👁</div>
          )}
        </div>
        <div style={{ width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t1)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: '9px', color: 'var(--t4)', fontFamily: 'var(--mono)', marginTop: '2px' }}>
            {f.human ?? f.size ?? ''}
          </div>
        </div>
        {/* Size match badge */}
        <div style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '2px',
          background: 'rgba(255,255,255,.05)', color: 'var(--t4)', border: '1px solid rgba(255,255,255,.08)' }}>
          {groupSize} each
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Full-screen preview modal */}
      {previewModal && typeof FilePreviewModal !== 'undefined' && (
        <FilePreviewModal file={previewModal} files={allFiles} onClose={() => setPreviewModal(null)} />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 9999, padding: '8px 16px',
            borderRadius: '2px', border: `1px solid ${toast.color}44`, background: `${toast.color}14`,
            color: toast.color, fontSize: '12px', fontWeight: 700, pointerEvents: 'none' }}>
          {toast.msg}
        </div>
      )}

      {/* Confirm dialog */}
      {confirmOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setConfirmOpen(false)}>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '2px',
              padding: '24px', maxWidth: '340px', width: '90%' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--t1)', marginBottom: '10px' }}>Delete Duplicates?</div>
            <div style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '16px', lineHeight: 1.6 }}>
              Delete <strong style={{ color: 'var(--t1)' }}>{selected.size} file{selected.size !== 1 ? 's' : ''}</strong> and reclaim{' '}
              <strong style={{ color: '#ff8c00' }}>{spaceSaved}</strong> of storage. Files will be moved to Trash.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={deleteSelected}
                style={{ flex: 1, padding: '8px', background: 'rgba(255,51,51,.12)',
                  border: '1px solid rgba(255,51,51,.4)', borderRadius: '2px',
                  color: '#ff3333', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                🗑 Delete {selected.size} files
              </button>
              <button onClick={() => setConfirmOpen(false)}
                style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--line2)',
                  borderRadius: '2px', color: 'var(--t3)', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase',
              color: '#ff8c00', marginBottom: '4px' }}>DUPLICATE FINDER</div>
            <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Duplicates</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            {!loading && groups.length > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#ff8c00', fontFamily: 'var(--mono)' }}>{totalWaste}</div>
                <div style={{ fontSize: '10px', color: 'var(--t3)' }}>{groups.length} groups · reclaimable</div>
              </div>
            )}
            {/* View toggle */}
            <div style={{ display: 'flex', background: 'var(--s1)', border: '1px solid var(--line)', borderRadius: '2px', padding: '2px' }}>
              {[['list','≡','List'],['icons','⊞','Icons']].map(([id, icon, label]) => (
                <button key={id} onClick={() => setViewMode(id)} title={label}
                  style={{ border: 'none', padding: '3px 8px', fontSize: '13px',
                    background: viewMode === id ? 'rgba(186,255,41,.15)' : 'transparent',
                    color: viewMode === id ? '#baff29' : 'var(--t4)',
                    borderRadius: '1px', cursor: 'pointer' }}>{icon}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Action bar */}
        {!loading && groups.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={autoSelectCopies}
              style={{ padding: '5px 12px', background: 'rgba(255,140,0,.1)', border: '1px solid rgba(255,140,0,.3)',
                borderRadius: '2px', color: '#ff8c00', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
              ⊕ Auto-select All Copies
            </button>
            {selected.size > 0 && <>
              <button onClick={clearSelect}
                style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--line2)',
                  borderRadius: '2px', color: 'var(--t3)', fontSize: '11px', cursor: 'pointer' }}>✕ Clear</button>
              <button onClick={() => setConfirmOpen(true)} disabled={deleting}
                style={{ padding: '5px 12px', background: 'transparent', border: '1px solid rgba(255,51,51,.35)',
                  color: '#ff3333', borderRadius: '2px', fontSize: '11px', fontWeight: 700,
                  cursor: deleting ? 'wait' : 'pointer' }}>
                {deleting ? `⟳ Deleting ${deleteProgress.done}/${deleteProgress.total}…` : `🗑 Delete ${selected.size} selected`}
              </button>
              {spaceSaved && (
                <div style={{ padding: '5px 10px', border: '1px solid rgba(46,221,94,.2)',
                    borderRadius: '2px', color: '#2edd5e', fontSize: '11px', fontWeight: 700 }}>
                  Frees {spaceSaved}
                </div>
              )}
            </>}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--t3)' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>⟳</div>Scanning for duplicates…
          </div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--t3)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>✓</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t2)', marginBottom: '8px' }}>No duplicates found</div>
            <div style={{ fontSize: '12px' }}>Your file system looks clean</div>
            <button onClick={loadDupes}
              style={{ marginTop: '16px', padding: '6px 14px', background: 'transparent',
                border: '1px solid var(--line2)', borderRadius: '2px', color: 'var(--t3)',
                fontSize: '11px', cursor: 'pointer' }}>↺ Rescan</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {groups.map((group, gi) => {
              const groupSize = group[0]?.human ?? group[0]?.size ?? '?';
              const copyCount = group.length - 1;
              const groupSel = group.slice(1).filter(f => selected.has(f.path ?? f.name)).length;
              const isExpanded = expandedGroups.has(gi);
              return (
                <div key={gi} style={{ border: '1px solid var(--line)', borderRadius: '2px', overflow: 'hidden' }}>
                  {/* Group header */}
                  <div style={{ padding: '8px 12px', background: 'rgba(255,140,0,.04)',
                      borderBottom: isExpanded ? '1px solid var(--line)' : 'none',
                      display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                    onClick={() => toggleGroup(gi)}>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.25)', flexShrink: 0, fontFamily: 'var(--mono)' }}>
                      {isExpanded ? '▾' : '▸'}
                    </span>
                    <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase',
                      color: '#ff8c00', flexShrink: 0 }}>GROUP {gi + 1}</span>
                    <span style={{ fontSize: '11px', color: 'var(--t3)', flex: 1 }}>
                      {group.length} copies · {groupSize} each
                    </span>
                    {/* File icon preview */}
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>{fileIcon(group[0])}</span>
                    {/* Select/deselect */}
                    <button onClick={e => { e.stopPropagation(); groupSel === copyCount ? deselectGroup(group) : selectGroupCopies(group); }}
                      style={{ padding: '3px 8px', flexShrink: 0,
                        background: groupSel === copyCount ? 'rgba(255,51,51,.12)' : 'transparent',
                        border: `1px solid ${groupSel === copyCount ? 'rgba(255,51,51,.4)' : 'var(--line2)'}`,
                        borderRadius: '2px', color: groupSel === copyCount ? '#ff3333' : 'var(--t3)',
                        fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                      {groupSel === copyCount ? `✓ ${copyCount} sel` : `Select ${copyCount} cop${copyCount===1?'y':'ies'}`}
                    </button>
                  </div>

                  {/* Group files */}
                  {isExpanded && (
                    viewMode === 'icons' ? (
                      <div style={{ padding: '12px', display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
                        {group.map((f, fi) => (
                          <DupeCard key={fi} f={f} isOriginal={fi === 0} groupSize={groupSize} />
                        ))}
                      </div>
                    ) : (
                      group.map((f, fi) => {
                        const path = f.path ?? f.name;
                        const name = path?.split('/').pop() ?? path;
                        const isSel = selected.has(path);
                        const isOriginal = fi === 0;
                        const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
                        const isPrev = ['jpg','jpeg','png','gif','webp','svg','mp4','mov','mp3','wav','m4a','flac'].includes(ext);
                        return (
                          <div key={fi} onClick={() => !isOriginal && toggleFile(path)}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
                              background: isSel ? 'rgba(255,51,51,.06)' : isOriginal ? 'rgba(186,255,41,.02)' : 'transparent',
                              borderBottom: fi < group.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                              cursor: isOriginal ? 'default' : 'pointer', transition: 'background .1s' }}>
                            {!isOriginal && (
                              <input type="checkbox" checked={isSel} readOnly
                                style={{ flexShrink: 0, accentColor: '#ff3333', cursor: 'pointer' }} />
                            )}
                            {/* Icon */}
                            <span style={{ fontSize: '14px', flexShrink: 0 }}>{fileIcon(f)}</span>
                            {/* Badge */}
                            <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '2px', flexShrink: 0,
                              background: isOriginal ? 'rgba(186,255,41,.1)' : 'rgba(255,51,51,.1)',
                              color: isOriginal ? '#baff29' : '#ff3333' }}>
                              {isOriginal ? 'ORIGINAL' : `COPY ${fi}`}
                            </span>
                            <span style={{ flex: 1, fontSize: '11px', color: 'var(--t2)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                            <span style={{ fontSize: '10px', color: 'var(--t3)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{path}</span>
                            {/* Preview button */}
                            {isPrev && (
                              <button onClick={e => { e.stopPropagation(); setPreviewModal(f); }}
                                title="Preview"
                                style={{ padding: '3px 7px', background: 'transparent',
                                  border: '1px solid rgba(186,255,41,.25)', borderRadius: '2px',
                                  color: '#baff29', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>👁</button>
                            )}
                          </div>
                        );
                      })
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { DuplicatesView });
