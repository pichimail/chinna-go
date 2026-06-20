/* FilesView.jsx — List · Icons · Columns · Quick Look views with inline media preview */

const FILE_EXT_COLORS = { mp4:'#ff8c00', mov:'#ff8c00', avi:'#ff8c00', webm:'#ff8c00',
  mp3:'#d54cff', wav:'#d54cff', m4a:'#d54cff', flac:'#d54cff', aac:'#d54cff',
  zip:'#ffc700', rar:'#ffc700', '7z':'#ffc700', tar:'#ffc700', gz:'#ffc700',
  pdf:'#ff3333', dmg:'#d54cff', pkg:'#d54cff', app:'#0080ff',
  jpg:'#00d9ff', jpeg:'#00d9ff', png:'#00d9ff', gif:'#2edd5e', webp:'#00d9ff', svg:'#00d9ff',
};

function fileExt(f) { return ((f.name ?? f.path ?? '').split('.').pop() ?? '').toLowerCase(); }
function fileIcon(f) {
  const e = fileExt(f);
  if (['mp4','mov','avi','webm','mkv','m4v'].includes(e)) return '🎬';
  if (['mp3','wav','m4a','flac','ogg','aac','opus'].includes(e)) return '🎵';
  if (['jpg','jpeg','png','gif','webp','svg','bmp','avif'].includes(e)) return '🖼';
  if (['zip','rar','7z','tar','gz','bz2'].includes(e)) return '📦';
  if (e === 'pdf') return '📄';
  if (['dmg','pkg','iso'].includes(e)) return '💿';
  if (e === 'app') return '📱';
  if (['doc','docx'].includes(e)) return '📝';
  if (['xls','xlsx','csv'].includes(e)) return '📊';
  if (['ppt','pptx'].includes(e)) return '📊';
  if (['js','jsx','ts','tsx','py','go','rb','rs','java','c','cpp','h'].includes(e)) return '⌨';
  if (['json','yaml','yml','xml','toml','ini','env','conf'].includes(e)) return '⚙';
  if (['txt','md','log'].includes(e)) return '📋';
  return '📎';
}
function isPreviewable(f) {
  const e = fileExt(f);
  return ['jpg','jpeg','png','gif','webp','svg','bmp','avif',
          'mp4','mov','avi','webm','mkv','m4v',
          'mp3','wav','m4a','flac','ogg','aac','opus',
          'txt','md','json','js','jsx','ts','tsx','css','html','py','sh','yaml','yml','log','csv'].includes(e);
}

const VIEW_MODES = [
  { id: 'list',     icon: '≡',  label: 'List' },
  { id: 'icons',    icon: '⊞',  label: 'Icons' },
  { id: 'columns',  icon: '▤',  label: 'Columns' },
  { id: 'quicklook',icon: '⬚',  label: 'Quick Look' },
];

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
  const [viewMode, setViewMode] = React.useState('list');
  const [previewModal, setPreviewModal] = React.useState(null);  // file for full-screen modal
  const [colFile, setColFile] = React.useState(null);            // file for columns/ql panel

  const loadFiles = React.useCallback(async () => {
    setLoading(true); setStats(null);
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

  React.useEffect(() => { loadFiles(); setColFile(null); }, [loadFiles]);

  // Keyboard: Space to toggle preview, Escape to close
  React.useEffect(() => {
    const fn = e => {
      if (e.key === 'Escape') { setPreviewModal(null); }
      if (e.key === ' ' && colFile && !previewModal) { e.preventDefault(); setPreviewModal(colFile); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [colFile, previewModal]);

  const filtered = files.filter(f =>
    !search || (f.name ?? f.path ?? '').toLowerCase().includes(search.toLowerCase()));

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
    setBusyFile(path + ':o');
    try {
      const d = await fetch('/api/files/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) }).then(r => r.json());
      if (d.ok) showToast('Opened'); else showToast(d.error ?? 'Failed', '#ff3333');
    } catch { showToast('Failed to open', '#ff3333'); }
    setBusyFile(null);
  }

  async function revealFile(path) {
    setBusyFile(path + ':r');
    try {
      await fetch('/api/files/reveal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) }).then(r => r.json());
      showToast('Revealed in Finder');
    } catch { showToast('Failed', '#ff3333'); }
    setBusyFile(null);
  }

  async function deleteSelected() {
    if (!selected.size) return;
    const paths = [...selected];
    setDeleting(true); setDeleteProgress({ done: 0, total: paths.length });
    let done = 0;
    for (const path of paths) {
      await fetch('/api/files/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) }).catch(() => {});
      done++; setDeleteProgress({ done, total: paths.length });
    }
    setDeleting(false); setSelected(new Set());
    showToast(`Deleted ${done} file${done !== 1 ? 's' : ''}`);
    loadFiles();
  }

  /* ─── Shared action buttons per file ─── */
  function FileActions({ f }) {
    const path = f.path ?? f.name;
    return (
      <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
        {isPreviewable(f) && (
          <button onClick={e => { e.stopPropagation(); setPreviewModal(f); }}
            title="Quick Look  ⌘Space"
            style={{ padding: '3px 7px', background: 'transparent', border: '1px solid rgba(186,255,41,.25)',
              borderRadius: '2px', color: '#baff29', fontSize: '11px', cursor: 'pointer' }}>
            👁
          </button>
        )}
        <button onClick={e => { e.stopPropagation(); openFile(path); }} disabled={busyFile === path + ':o'}
          title="Open" style={{ padding: '3px 7px', background: 'transparent', border: '1px solid var(--line2)',
            borderRadius: '2px', color: 'var(--t3)', fontSize: '11px', cursor: 'pointer' }}>▶</button>
        <button onClick={e => { e.stopPropagation(); revealFile(path); }} disabled={busyFile === path + ':r'}
          title="Reveal in Finder" style={{ padding: '3px 7px', background: 'transparent', border: '1px solid var(--line2)',
            borderRadius: '2px', color: 'var(--t3)', fontSize: '11px', cursor: 'pointer' }}>⌐</button>
      </div>
    );
  }

  /* ─── LIST VIEW ─── */
  function renderList() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {filtered.map((f, i) => {
          const name = f.name ?? f.path?.split('/').pop() ?? '?';
          const size = f.human ?? f.size ?? '—';
          const path = f.path ?? f.name;
          const isSel = selected.has(path);
          const color = FILE_EXT_COLORS[fileExt(f)] ?? 'var(--t3)';
          return (
            <div key={i}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px',
                border: `1px solid ${isSel ? 'rgba(186,255,41,.35)' : 'transparent'}`,
                background: isSel ? 'rgba(186,255,41,.04)' : 'transparent',
                borderRadius: '2px', transition: 'all .1s', cursor: 'pointer' }}
              onMouseEnter={e => { if (!isSel) { e.currentTarget.style.background='var(--s1)'; e.currentTarget.style.borderColor='var(--line)'; } }}
              onMouseLeave={e => { if (!isSel) { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='transparent'; } }}
              onClick={() => toggleSelect(path)}>
              <input type="checkbox" checked={isSel} onChange={() => toggleSelect(path)}
                onClick={e => e.stopPropagation()}
                style={{ flexShrink: 0, accentColor: 'var(--acc)', cursor: 'pointer' }} />
              <div style={{ width: '28px', height: '28px', borderRadius: '2px', background: 'var(--s1)',
                  border: '1px solid var(--line)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '13px', flexShrink: 0 }}>
                {fileIcon(f)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '1px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path}</div>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', color, flexShrink: 0 }}>{size}</div>
              <div style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '2px',
                background: 'rgba(186,255,41,.08)', color: 'var(--acc)',
                border: '1px solid rgba(186,255,41,.2)', fontWeight: 700, flexShrink: 0, minWidth: '30px', textAlign: 'center' }}>
                {fileExt(f).toUpperCase() || 'FILE'}
              </div>
              <FileActions f={f} />
            </div>
          );
        })}
      </div>
    );
  }

  /* ─── ICONS VIEW ─── */
  function renderIcons() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
        {filtered.map((f, i) => {
          const name = f.name ?? f.path?.split('/').pop() ?? '?';
          const path = f.path ?? f.name;
          const isSel = selected.has(path);
          const ext = fileExt(f);
          const isPrev = isPreviewable(f);
          const streamUrl = isPrev ? `/api/files/stream?path=${encodeURIComponent(path)}` : null;
          const isImg = ['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext);
          return (
            <div key={i}
              onClick={() => toggleSelect(path)}
              onDoubleClick={() => isPrev && setPreviewModal(f)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                padding: '10px 8px', border: `1px solid ${isSel ? 'rgba(186,255,41,.5)' : 'var(--line)'}`,
                background: isSel ? 'rgba(186,255,41,.07)' : 'transparent',
                borderRadius: '2px', cursor: 'pointer', transition: 'all .12s', position: 'relative' }}
              onMouseEnter={e => { if (!isSel) { e.currentTarget.style.borderColor='var(--line2)'; e.currentTarget.style.background='var(--s1)'; } }}
              onMouseLeave={e => { if (!isSel) { e.currentTarget.style.borderColor='var(--line)'; e.currentTarget.style.background='transparent'; } }}>
              {/* Thumbnail or icon */}
              <div style={{ width: '64px', height: '64px', borderRadius: '4px', overflow: 'hidden', background: 'var(--s1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                {isImg && streamUrl ? (
                  <img src={streamUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '28px' }}>{fileIcon(f)}</span>
                )}
                {isPrev && (
                  <div onClick={e => { e.stopPropagation(); setPreviewModal(f); }}
                    style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0, transition: 'opacity .15s', fontSize: '20px', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                    👁
                  </div>
                )}
              </div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t2)', textAlign: 'center',
                width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
              <div style={{ fontSize: '9px', fontFamily: 'var(--mono)', color: FILE_EXT_COLORS[ext] ?? 'var(--t4)' }}>
                {f.human ?? f.size ?? ''}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ─── COLUMNS VIEW (list + side preview pane) ─── */
  function renderColumns() {
    return (
      <div style={{ display: 'flex', height: '100%', gap: 0 }}>
        {/* Left: file list */}
        <div style={{ width: '280px', flexShrink: 0, overflowY: 'auto',
            borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '1px',
            padding: '4px 0' }}>
          {filtered.map((f, i) => {
            const name = f.name ?? f.path?.split('/').pop() ?? '?';
            const path = f.path ?? f.name;
            const isSel = colFile && (colFile.path ?? colFile.name) === path;
            return (
              <div key={i} onClick={() => setColFile(f)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
                  background: isSel ? 'rgba(186,255,41,.1)' : 'transparent',
                  borderLeft: `2px solid ${isSel ? '#baff29' : 'transparent'}`,
                  cursor: 'pointer', transition: 'all .1s' }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--s1)'; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>{fileIcon(f)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: isSel ? 700 : 500, color: isSel ? '#baff29' : 'var(--t1)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                  <div style={{ fontSize: '9px', color: 'var(--t4)', fontFamily: 'var(--mono)' }}>
                    {(f.human ?? f.size ?? '')} · {fileExt(f).toUpperCase() || '?'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: detail + preview pane */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {colFile ? (
            <>
              {/* File detail header */}
              <div style={{ flexShrink: 0, padding: '10px 14px', borderBottom: '1px solid var(--line)',
                  display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--s0)' }}>
                <span style={{ fontSize: '22px' }}>{fileIcon(colFile)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(colFile.path ?? colFile.name ?? '').split('/').pop()}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--t3)', fontFamily: 'var(--mono)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                    {colFile.path}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: FILE_EXT_COLORS[fileExt(colFile)] ?? 'var(--t1)',
                    fontFamily: 'var(--mono)' }}>{colFile.human ?? colFile.size}</div>
                  <div style={{ fontSize: '9px', color: 'var(--t4)', letterSpacing: '1px' }}>
                    {fileExt(colFile).toUpperCase() || 'FILE'}
                  </div>
                </div>
              </div>
              {/* Actions */}
              <div style={{ flexShrink: 0, display: 'flex', gap: '6px', padding: '8px 14px',
                  borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                {isPreviewable(colFile) && (
                  <button onClick={() => setPreviewModal(colFile)}
                    style={{ padding: '5px 12px', background: 'rgba(186,255,41,.1)', border: '1px solid rgba(186,255,41,.3)',
                      borderRadius: '2px', color: '#baff29', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                    👁 Full Preview
                  </button>
                )}
                <button onClick={() => openFile(colFile.path ?? colFile.name)}
                  style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--line2)',
                    borderRadius: '2px', color: 'var(--t2)', fontSize: '11px', cursor: 'pointer' }}>▶ Open</button>
                <button onClick={() => revealFile(colFile.path ?? colFile.name)}
                  style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--line2)',
                    borderRadius: '2px', color: 'var(--t2)', fontSize: '11px', cursor: 'pointer' }}>⌐ Finder</button>
                <button onClick={() => { toggleSelect(colFile.path ?? colFile.name); }}
                  style={{ padding: '5px 10px', background: selected.has(colFile.path ?? colFile.name) ? 'rgba(255,51,51,.1)' : 'transparent',
                    border: `1px solid ${selected.has(colFile.path ?? colFile.name) ? 'rgba(255,51,51,.35)' : 'var(--line2)'}`,
                    borderRadius: '2px', color: selected.has(colFile.path ?? colFile.name) ? '#ff3333' : 'var(--t3)',
                    fontSize: '11px', cursor: 'pointer' }}>
                  {selected.has(colFile.path ?? colFile.name) ? '✓ Selected' : '☐ Select'}
                </button>
              </div>
              {/* Inline preview */}
              {typeof FilePreviewPane !== 'undefined' && isPreviewable(colFile) && (
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <FilePreviewPane file={colFile} />
                </div>
              )}
              {!isPreviewable(colFile) && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: '12px', color: 'var(--t4)', padding: '32px' }}>
                  <div style={{ fontSize: '48px', opacity: 0.2 }}>{fileIcon(colFile)}</div>
                  <div style={{ fontSize: '12px' }}>No preview for .{fileExt(colFile) || '?'} files</div>
                  <button onClick={() => openFile(colFile.path ?? colFile.name)}
                    style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--line2)',
                      borderRadius: '2px', color: 'var(--t2)', fontSize: '11px', cursor: 'pointer' }}>▶ Open in Default App</button>
                </div>
              )}
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '12px', color: 'var(--t4)' }}>
              <div style={{ fontSize: '36px', opacity: 0.2 }}>◎</div>
              <div style={{ fontSize: '12px' }}>Select a file to preview</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─── QUICK LOOK VIEW (wide preview pane) ─── */
  function renderQuickLook() {
    return (
      <div style={{ display: 'flex', height: '100%' }}>
        {/* Left: compact list */}
        <div style={{ width: '220px', flexShrink: 0, overflowY: 'auto',
            borderRight: '1px solid var(--line)', padding: '4px 0' }}>
          {filtered.map((f, i) => {
            const name = f.name ?? f.path?.split('/').pop() ?? '?';
            const path = f.path ?? f.name;
            const isSel = colFile && (colFile.path ?? colFile.name) === path;
            return (
              <div key={i} onClick={() => setColFile(f)}
                style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 10px',
                  background: isSel ? 'rgba(186,255,41,.1)' : 'transparent',
                  borderLeft: `2px solid ${isSel ? '#baff29' : 'transparent'}`,
                  cursor: 'pointer', transition: 'background .1s' }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--s1)'; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ fontSize: '13px' }}>{fileIcon(f)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: isSel ? 700 : 500,
                    color: isSel ? '#baff29' : 'var(--t1)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                  <div style={{ fontSize: '9px', color: 'var(--t4)', fontFamily: 'var(--mono)' }}>
                    {f.human ?? f.size ?? ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: big preview pane + expand button */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          {colFile && isPreviewable(colFile) && (
            <button onClick={() => setPreviewModal(colFile)}
              style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10,
                padding: '4px 10px', background: 'rgba(186,255,41,.12)', border: '1px solid rgba(186,255,41,.3)',
                borderRadius: '2px', color: '#baff29', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
              ⛶ Expand
            </button>
          )}
          {typeof FilePreviewPane !== 'undefined' ? (
            <FilePreviewPane file={colFile} style={{ flex: 1 }} />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t4)' }}>
              Select a file
            </div>
          )}
        </div>
      </div>
    );
  }

  const isColumnMode = viewMode === 'columns' || viewMode === 'quicklook';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Full-screen preview modal */}
      {previewModal && typeof FilePreviewModal !== 'undefined' && (
        <FilePreviewModal file={previewModal} files={filtered} onClose={() => setPreviewModal(null)} />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 9999, padding: '8px 16px',
            borderRadius: '2px', border: `1px solid ${toast.color}44`, background: `${toast.color}14`,
            color: toast.color, fontSize: '12px', fontWeight: 700, pointerEvents: 'none' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase',
            color: '#ffc700', marginBottom: '4px' }}>FILE MANAGER</div>
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Files</h2>
        </div>
        {stats && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--t1)', fontFamily: 'var(--mono)' }}>{stats.total_human}</div>
            <div style={{ fontSize: '10px', color: 'var(--t3)' }}>{stats.count} files</div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '6px', padding: '7px 16px', borderBottom: '1px solid var(--line)',
          flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Tab filter */}
        <div style={{ display: 'flex', background: 'var(--s1)', border: '1px solid var(--line)', borderRadius: '2px', padding: '2px' }}>
          {[['large','⬤ Large'],['downloads','↓ Downloads'],['dupes','⊕ Dupes']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ border: 'none', padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                background: tab === id ? 'var(--acc)' : 'transparent',
                color: tab === id ? '#000' : 'var(--t3)',
                borderRadius: '1px', cursor: 'pointer', fontFamily: 'var(--font)' }}>{label}</button>
          ))}
        </div>

        {/* View mode toggle */}
        <div style={{ display: 'flex', background: 'var(--s1)', border: '1px solid var(--line)', borderRadius: '2px', padding: '2px' }}>
          {VIEW_MODES.map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)} title={v.label}
              style={{ border: 'none', padding: '4px 9px', fontSize: '13px',
                background: viewMode === v.id ? 'rgba(186,255,41,.15)' : 'transparent',
                color: viewMode === v.id ? '#baff29' : 'var(--t4)',
                borderRadius: '1px', cursor: 'pointer', lineHeight: 1 }}>{v.icon}</button>
          ))}
        </div>

        {/* Search */}
        <div style={{ flex: 1, minWidth: '120px', display: 'flex', alignItems: 'center', gap: '6px',
            background: 'var(--s1)', border: '1px solid var(--line2)', borderRadius: '2px', padding: '5px 10px' }}>
          <span style={{ color: 'var(--t3)' }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--t1)', fontSize: '12px', fontFamily: 'var(--font)' }} />
          {search && <button onClick={() => setSearch('')}
            style={{ background: 'none', border: 'none', color: 'var(--t4)', cursor: 'pointer', fontSize: '12px', padding: 0 }}>✕</button>}
        </div>

        {/* Sort */}
        <select value={sort} onChange={e => setSort(e.target.value)}
          style={{ background: 'var(--s1)', border: '1px solid var(--line2)', color: 'var(--t1)',
            fontSize: '11px', padding: '5px 9px', borderRadius: '2px', cursor: 'pointer' }}>
          <option value="size">Size ↓</option>
          <option value="date">Date ↓</option>
          <option value="name">Name A-Z</option>
        </select>

        {/* Batch actions */}
        {!isColumnMode && filtered.length > 0 && selected.size === 0 && (
          <button onClick={selectAll}
            style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--line2)',
              color: 'var(--t3)', borderRadius: '2px', fontSize: '11px', cursor: 'pointer' }}>☐ All</button>
        )}
        {selected.size > 0 && (
          <>
            <button onClick={clearSelect}
              style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--line2)',
                color: 'var(--t3)', borderRadius: '2px', fontSize: '11px', cursor: 'pointer' }}>✕ Clear</button>
            <button onClick={deleteSelected} disabled={deleting}
              style={{ padding: '5px 12px', background: 'transparent', border: '1px solid rgba(255,51,51,.35)',
                color: '#ff3333', borderRadius: '2px', fontSize: '11px', fontWeight: 600,
                cursor: deleting ? 'wait' : 'pointer' }}>
              {deleting ? `⟳ ${deleteProgress.done}/${deleteProgress.total}` : `🗑 Delete (${selected.size})`}
            </button>
          </>
        )}
        <button onClick={loadFiles}
          style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--line2)',
            color: 'var(--t2)', borderRadius: '2px', fontSize: '11px', cursor: 'pointer' }}>↺</button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', color: 'var(--t3)' }}>
          <div style={{ fontSize: '24px', marginBottom: '12px' }}>⟳</div>Scanning…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', color: 'var(--t3)' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>🗂</div>No files found
        </div>
      ) : isColumnMode ? (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {viewMode === 'columns' && renderColumns()}
          {viewMode === 'quicklook' && renderQuickLook()}
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
          {viewMode === 'list' && renderList()}
          {viewMode === 'icons' && renderIcons()}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { FilesView, fileIcon, fileExt, FILE_EXT_COLORS, isPreviewable });
