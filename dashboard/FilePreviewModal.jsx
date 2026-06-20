/* FilePreviewModal.jsx — Advanced media preview modal (shared across all file views) */

function FilePreviewModal({ file, files, onClose }) {
  const [current, setCurrent] = React.useState(file);
  const [zoom, setZoom] = React.useState(1);
  const [rotate, setRotate] = React.useState(0);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState(null);
  const mediaRef = React.useRef(null);
  const [ms, setMs] = React.useState({ playing: false, ct: 0, dur: 0, vol: 1, muted: false });
  const [speed, setSpeed] = React.useState(1);
  const [textContent, setTextContent] = React.useState(null);
  const [imgLoaded, setImgLoaded] = React.useState(false);
  const [seeking, setSeeking] = React.useState(false);

  const path = current.path ?? current.name ?? '';
  const name = path.split('/').pop() || path;
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  const size = current.human ?? current.size ?? '';
  const streamUrl = `/api/files/stream?path=${encodeURIComponent(path)}`;

  const isImg = ['jpg','jpeg','png','gif','webp','svg','bmp','avif','tiff'].includes(ext);
  const isVid = ['mp4','mov','avi','webm','mkv','m4v','ogv'].includes(ext);
  const isAud = ['mp3','wav','m4a','flac','ogg','aac','opus','wma','alac'].includes(ext);
  const isTxt = ['txt','md','json','js','jsx','ts','tsx','css','html','xml','py','sh','yaml','yml','csv','log','env','ini','conf','toml','rb','go','rs','java','c','cpp','h','swift','kt'].includes(ext);

  const idx = files ? files.findIndex(f => (f.path ?? f.name) === path) : -1;
  const hasPrev = files && idx > 0;
  const hasNext = files && idx < files.length - 1;

  function navTo(nextFile) {
    setCurrent(nextFile);
    setZoom(1); setRotate(0); setPan({ x: 0, y: 0 });
    setMs(s => ({ playing: false, ct: 0, dur: 0, vol: s.vol, muted: s.muted }));
    setTextContent(null); setImgLoaded(false);
  }

  // Load text/code files
  React.useEffect(() => {
    if (!isTxt) return;
    setTextContent(null);
    fetch(streamUrl).then(r => r.text()).then(t => setTextContent(t)).catch(() => setTextContent('(could not read file)'));
  }, [path]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const fn = e => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowLeft' && hasPrev) navTo(files[idx - 1]);
      if (e.key === 'ArrowRight' && hasNext) navTo(files[idx + 1]);
      if (e.key === ' ' && (isVid || isAud)) { e.preventDefault(); togglePlay(); }
      if (!isImg) return;
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(8, z + 0.25));
      if (e.key === '-') setZoom(z => Math.max(0.1, z - 0.25));
      if (e.key === '0') { setZoom(1); setPan({ x: 0, y: 0 }); }
      if (e.key === 'r') setRotate(r => (r + 90) % 360);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [idx, isImg, isVid, isAud, hasPrev, hasNext]);

  // Media helpers
  function togglePlay() {
    if (!mediaRef.current) return;
    if (mediaRef.current.paused) { mediaRef.current.play(); }
    else { mediaRef.current.pause(); }
  }

  function onSeekClick(e) {
    if (!mediaRef.current || !ms.dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    mediaRef.current.currentTime = ratio * ms.dur;
  }

  function onSeekDrag(e) {
    if (!seeking || !mediaRef.current || !ms.dur) return;
    const bar = e.currentTarget;
    const r = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    mediaRef.current.currentTime = ratio * ms.dur;
  }

  function fmtTime(t) {
    if (!t || isNaN(t)) return '0:00';
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    return `${m}:${s.toString().padStart(2,'0')}`;
  }

  // Image pan/zoom
  function onImgWheel(e) {
    e.preventDefault();
    const delta = e.ctrlKey ? e.deltaY * 0.01 : e.deltaY * 0.001;
    setZoom(z => Math.max(0.1, Math.min(8, z - delta * 2)));
  }
  function onImgMD(e) {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    setPanStart({ mx: e.clientX - pan.x, my: e.clientY - pan.y });
  }
  function onImgMM(e) {
    if (!isPanning || !panStart) return;
    setPan({ x: e.clientX - panStart.mx, y: e.clientY - panStart.my });
  }
  function onImgMU() { setIsPanning(false); setPanStart(null); }

  const pct = ms.dur ? Math.min(100, (ms.ct / ms.dur) * 100) : 0;

  const Btn = ({ onClick, title, children, color, active, style: sx }) => (
    <button onClick={onClick} title={title}
      style={{ padding: '4px 9px', background: active ? `${color ?? '#baff29'}18` : 'transparent',
        border: `1px solid ${active ? (color ?? '#baff29') + '55' : 'rgba(255,255,255,.15)'}`,
        borderRadius: '2px', color: active ? (color ?? '#baff29') : 'rgba(255,255,255,.7)',
        cursor: 'pointer', fontSize: '13px', lineHeight: 1, flexShrink: 0,
        fontFamily: 'var(--font)', ...(sx || {}) }}>
      {children}
    </button>
  );

  const extColors = { mp4:'#ff8c00', mov:'#ff8c00', mp3:'#d54cff', wav:'#d54cff', m4a:'#d54cff', flac:'#d54cff',
    jpg:'#00d9ff', jpeg:'#00d9ff', png:'#00d9ff', gif:'#2edd5e', webp:'#00d9ff', pdf:'#ff3333' };
  const extColor = extColors[ext] ?? 'rgba(255,255,255,.4)';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,.96)',
        display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      {/* ── Topbar ── */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px',
          padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,.07)',
          background: '#080808' }}>

        {/* Nav arrows */}
        <Btn onClick={() => hasPrev && navTo(files[idx - 1])} title="Previous  ←"
          style={{ opacity: hasPrev ? 1 : 0.3, pointerEvents: hasPrev ? 'auto' : 'none' }}>←</Btn>
        <Btn onClick={() => hasNext && navTo(files[idx + 1])} title="Next  →"
          style={{ opacity: hasNext ? 1 : 0.3, pointerEvents: hasNext ? 'auto' : 'none' }}>→</Btn>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,.1)', flexShrink: 0 }} />

        {/* File info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.38)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px', fontFamily: 'var(--mono)' }}>
            <span style={{ color: extColor, fontWeight: 700 }}>{ext.toUpperCase() || '?'}</span>
            {size && <span> · {size}</span>}
            {files && idx >= 0 && <span style={{ opacity: 0.6 }}> · {idx + 1} / {files.length}</span>}
            {path && <span> · {path}</span>}
          </div>
        </div>

        {/* Image controls */}
        {isImg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <Btn onClick={() => setZoom(z => Math.max(0.1, z - 0.25))} title="Zoom out  −">−</Btn>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.5)', minWidth: '38px', textAlign: 'center', fontFamily: 'var(--mono)' }}>{Math.round(zoom * 100)}%</span>
            <Btn onClick={() => setZoom(z => Math.min(8, z + 0.25))} title="Zoom in  +">+</Btn>
            <Btn onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Fit to screen  0">Fit</Btn>
            <Btn onClick={() => { setZoom(2); setPan({ x: 0, y: 0 }); }} title="200%">2×</Btn>
            <Btn onClick={() => setRotate(r => (r + 90) % 360)} title="Rotate 90°  R">↻</Btn>
          </div>
        )}

        <Btn onClick={onClose} title="Close  Esc" color="#ff3333">✕</Btn>
      </div>

      {/* ── Content area ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          cursor: isImg ? (zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in') : 'default',
          background: isVid ? '#000' : 'transparent' }}
        onWheel={isImg ? onImgWheel : undefined}
        onMouseDown={isImg ? onImgMD : undefined}
        onMouseMove={isImg ? onImgMM : undefined}
        onMouseUp={isImg ? onImgMU : undefined}
        onMouseLeave={isImg ? onImgMU : undefined}>

        {/* Image viewer */}
        {isImg && (
          <>
            {!imgLoaded && <div style={{ position: 'absolute', color: 'rgba(255,255,255,.3)', fontSize: '13px' }}>⟳ Loading…</div>}
            <img src={streamUrl} alt={name} draggable={false}
              onLoad={() => setImgLoaded(true)}
              style={{ display: imgLoaded ? 'block' : 'none',
                maxWidth: zoom === 1 ? '100%' : 'none', maxHeight: zoom === 1 ? '100%' : 'none',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotate}deg)`,
                transformOrigin: 'center center', userSelect: 'none',
                transition: isPanning ? 'none' : 'transform .12s ease',
                imageRendering: zoom >= 3 ? 'pixelated' : 'auto' }}
              onClick={() => { if (zoom === 1) setZoom(2); else { setZoom(1); setPan({ x: 0, y: 0 }); } }}
            />
          </>
        )}

        {/* Video player */}
        {isVid && (
          <video ref={mediaRef} src={streamUrl}
            style={{ maxWidth: '100%', maxHeight: '100%', outline: 'none' }}
            onTimeUpdate={() => mediaRef.current && setMs(s => ({ ...s, ct: mediaRef.current.currentTime }))}
            onLoadedMetadata={() => mediaRef.current && setMs(s => ({ ...s, dur: mediaRef.current.duration || 0 }))}
            onPlay={() => setMs(s => ({ ...s, playing: true }))}
            onPause={() => setMs(s => ({ ...s, playing: false }))}
            onEnded={() => setMs(s => ({ ...s, playing: false, ct: 0 }))}
            onClick={togglePlay} />
        )}

        {/* Audio player */}
        {isAud && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px', padding: '48px 32px' }}>
            <div style={{ position: 'relative', width: '140px', height: '140px' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
                background: `conic-gradient(rgba(186,255,41,.4) ${pct * 3.6}deg, rgba(255,255,255,.06) 0deg)`,
                transition: 'background .3s' }} />
              <div style={{ position: 'absolute', inset: '8px', borderRadius: '50%', background: '#0a0a0a',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '52px',
                animation: ms.playing ? 'spin 4s linear infinite' : 'none' }}>🎵</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>{name.replace(/\.[^.]+$/, '')}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.4)', fontFamily: 'var(--mono)' }}>{ext.toUpperCase()} · {size}</div>
            </div>
            <audio ref={mediaRef} src={streamUrl}
              onTimeUpdate={() => mediaRef.current && setMs(s => ({ ...s, ct: mediaRef.current.currentTime }))}
              onLoadedMetadata={() => mediaRef.current && setMs(s => ({ ...s, dur: mediaRef.current.duration || 0 }))}
              onPlay={() => setMs(s => ({ ...s, playing: true }))}
              onPause={() => setMs(s => ({ ...s, playing: false }))}
              onEnded={() => setMs(s => ({ ...s, playing: false, ct: 0 }))} />
          </div>
        )}

        {/* Text / code viewer */}
        {isTxt && (
          <div style={{ width: '100%', height: '100%', overflow: 'auto', padding: '24px 28px' }}>
            <pre style={{ fontSize: '12px', color: 'rgba(255,255,255,.75)', fontFamily: 'var(--mono)',
              lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
              {textContent === null ? '⟳ Loading…' : textContent}
            </pre>
          </div>
        )}

        {/* No preview */}
        {!isImg && !isVid && !isAud && !isTxt && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '80px', marginBottom: '24px', opacity: 0.15 }}>📎</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'rgba(255,255,255,.5)', marginBottom: '8px' }}>No preview available</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.25)' }}>{ext.toUpperCase() || 'Unknown'} files cannot be previewed in-browser</div>
          </div>
        )}
      </div>

      {/* ── Media controls ── */}
      {(isVid || isAud) && (
        <div style={{ flexShrink: 0, padding: '10px 18px 14px', borderTop: '1px solid rgba(255,255,255,.07)',
            background: '#070707' }}>

          {/* Seek bar */}
          <div
            onClick={onSeekClick}
            onMouseDown={() => setSeeking(true)}
            onMouseMove={onSeekDrag}
            onMouseUp={() => setSeeking(false)}
            onMouseLeave={() => setSeeking(false)}
            style={{ height: '5px', background: 'rgba(255,255,255,.1)', borderRadius: '3px',
              cursor: 'pointer', marginBottom: '11px', position: 'relative', userSelect: 'none' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '3px',
              background: 'rgba(255,255,255,.06)' }} />
            <div style={{ height: '100%', width: `${pct}%`, background: '#baff29',
              borderRadius: '3px', pointerEvents: 'none', position: 'relative', zIndex: 1 }} />
            <div style={{ position: 'absolute', top: '50%', left: `${pct}%`,
              transform: 'translate(-50%, -50%)', width: '14px', height: '14px',
              borderRadius: '50%', background: '#baff29', border: '2px solid #000',
              boxShadow: '0 0 8px rgba(186,255,41,.6)', pointerEvents: 'none', zIndex: 2,
              transition: seeking ? 'none' : 'left .1s' }} />
          </div>

          {/* Controls row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Play/Pause */}
            <button onClick={togglePlay}
              style={{ width: '38px', height: '38px', borderRadius: '50%',
                background: 'rgba(186,255,41,.12)', border: '1px solid rgba(186,255,41,.35)',
                color: '#baff29', fontSize: '16px', cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {ms.playing ? '⏸' : '▶'}
            </button>

            {/* Time */}
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.45)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
              {fmtTime(ms.ct)} <span style={{ opacity: 0.4 }}>/</span> {fmtTime(ms.dur)}
            </span>

            <div style={{ flex: 1 }} />

            {/* Mute + Volume */}
            <button onClick={() => { const m = !ms.muted; if (mediaRef.current) mediaRef.current.muted = m; setMs(s => ({ ...s, muted: m })); }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: '16px', padding: '2px 3px', flexShrink: 0 }}>
              {ms.muted || ms.vol === 0 ? '🔇' : ms.vol < 0.4 ? '🔈' : ms.vol < 0.8 ? '🔉' : '🔊'}
            </button>
            <input type="range" min="0" max="1" step="0.02"
              value={ms.muted ? 0 : ms.vol}
              onChange={e => {
                const v = parseFloat(e.target.value);
                if (mediaRef.current) { mediaRef.current.volume = v; mediaRef.current.muted = v === 0; }
                setMs(s => ({ ...s, vol: v, muted: v === 0 }));
              }}
              style={{ width: '76px', accentColor: '#baff29', cursor: 'pointer', flexShrink: 0 }} />

            {/* Speed */}
            <select value={speed}
              onChange={e => { const r = parseFloat(e.target.value); setSpeed(r); if (mediaRef.current) mediaRef.current.playbackRate = r; }}
              style={{ background: '#111', border: '1px solid rgba(255,255,255,.14)', color: 'rgba(255,255,255,.6)',
                fontSize: '11px', padding: '4px 7px', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--mono)', flexShrink: 0 }}>
              {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3].map(r => <option key={r} value={r}>{r}×</option>)}
            </select>

            {/* Fullscreen (video only) */}
            {isVid && (
              <button onClick={() => mediaRef.current?.requestFullscreen?.()}
                style={{ padding: '4px 9px', background: 'transparent', border: '1px solid rgba(255,255,255,.14)',
                  borderRadius: '2px', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}
                title="Fullscreen">⛶</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Inline preview panel (used in Columns / Quick Look view modes) ── */
function FilePreviewPane({ file, style: sx }) {
  const mediaRef = React.useRef(null);
  const [ms, setMs] = React.useState({ playing: false, ct: 0, dur: 0, vol: 1, muted: false });
  const [speed, setSpeed] = React.useState(1);
  const [textContent, setTextContent] = React.useState(null);

  const path = file?.path ?? file?.name ?? '';
  const name = path.split('/').pop() || path;
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  const size = file?.human ?? file?.size ?? '';
  const streamUrl = file ? `/api/files/stream?path=${encodeURIComponent(path)}` : '';

  const isImg = ['jpg','jpeg','png','gif','webp','svg','bmp','avif'].includes(ext);
  const isVid = ['mp4','mov','avi','webm','mkv','m4v'].includes(ext);
  const isAud = ['mp3','wav','m4a','flac','ogg','aac','opus','wma'].includes(ext);
  const isTxt = ['txt','md','json','js','jsx','ts','tsx','css','html','xml','py','sh','yaml','yml','csv','log','env','ini','conf','toml'].includes(ext);

  React.useEffect(() => {
    setMs({ playing: false, ct: 0, dur: 0, vol: 1, muted: false });
    setTextContent(null);
    if (isTxt && file) {
      fetch(streamUrl).then(r => r.text()).then(t => setTextContent(t)).catch(() => setTextContent('(read error)'));
    }
  }, [path]);

  function togglePlay() {
    if (!mediaRef.current) return;
    if (mediaRef.current.paused) mediaRef.current.play();
    else mediaRef.current.pause();
  }
  function fmtTime(t) {
    if (!t || isNaN(t)) return '0:00';
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  function onSeek(e) {
    if (!mediaRef.current || !ms.dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    mediaRef.current.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * ms.dur;
  }

  const pct = ms.dur ? Math.min(100, (ms.ct / ms.dur) * 100) : 0;

  if (!file) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', gap: '12px', color: 'rgba(255,255,255,.2)', ...sx }}>
        <div style={{ fontSize: '40px', opacity: 0.3 }}>◎</div>
        <div style={{ fontSize: '12px' }}>Select a file to preview</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', ...sx }}>
      {/* File name */}
      <div style={{ flexShrink: 0, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.07)',
          background: 'rgba(255,255,255,.02)' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.35)', marginTop: '2px', fontFamily: 'var(--mono)' }}>
          {ext.toUpperCase() || '?'}{size && ` · ${size}`}
        </div>
      </div>

      {/* Preview content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isVid ? '#000' : 'transparent', position: 'relative' }}>
        {isImg && (
          <img src={streamUrl} alt={name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        )}
        {isVid && (
          <video ref={mediaRef} src={streamUrl}
            style={{ maxWidth: '100%', maxHeight: '100%' }}
            onTimeUpdate={() => mediaRef.current && setMs(s => ({ ...s, ct: mediaRef.current.currentTime }))}
            onLoadedMetadata={() => mediaRef.current && setMs(s => ({ ...s, dur: mediaRef.current.duration || 0 }))}
            onPlay={() => setMs(s => ({ ...s, playing: true }))}
            onPause={() => setMs(s => ({ ...s, playing: false }))}
            onEnded={() => setMs(s => ({ ...s, playing: false }))}
            onClick={togglePlay} />
        )}
        {isAud && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px',
              animation: ms.playing ? 'spin 3s linear infinite' : 'none',
              display: 'inline-block' }}>🎵</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,.8)', marginBottom: '4px' }}>
              {name.replace(/\.[^.]+$/, '')}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.3)' }}>{size}</div>
            <audio ref={mediaRef} src={streamUrl}
              onTimeUpdate={() => mediaRef.current && setMs(s => ({ ...s, ct: mediaRef.current.currentTime }))}
              onLoadedMetadata={() => mediaRef.current && setMs(s => ({ ...s, dur: mediaRef.current.duration || 0 }))}
              onPlay={() => setMs(s => ({ ...s, playing: true }))}
              onPause={() => setMs(s => ({ ...s, playing: false }))}
              onEnded={() => setMs(s => ({ ...s, playing: false }))} />
          </div>
        )}
        {isTxt && (
          <div style={{ width: '100%', height: '100%', overflow: 'auto', padding: '12px 14px' }}>
            <pre style={{ fontSize: '11px', color: 'rgba(255,255,255,.65)', fontFamily: 'var(--mono)',
              lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
              {textContent === null ? '⟳ Loading…' : textContent}
            </pre>
          </div>
        )}
        {!isImg && !isVid && !isAud && !isTxt && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.2)', padding: '20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }}>📎</div>
            <div style={{ fontSize: '12px' }}>No preview for .{ext || '?'}</div>
          </div>
        )}
      </div>

      {/* Inline media controls */}
      {(isVid || isAud) && (
        <div style={{ flexShrink: 0, padding: '8px 12px 10px', borderTop: '1px solid rgba(255,255,255,.06)',
            background: '#070707' }}>
          <div onClick={onSeek}
            style={{ height: '3px', background: 'rgba(255,255,255,.1)', borderRadius: '2px',
              cursor: 'pointer', marginBottom: '8px', position: 'relative' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#baff29', borderRadius: '2px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={togglePlay}
              style={{ padding: '3px 9px', background: 'rgba(186,255,41,.1)', border: '1px solid rgba(186,255,41,.3)',
                borderRadius: '2px', color: '#baff29', fontSize: '13px', cursor: 'pointer' }}>
              {ms.playing ? '⏸' : '▶'}
            </button>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,.4)', fontFamily: 'var(--mono)', flex: 1 }}>
              {fmtTime(ms.ct)} / {fmtTime(ms.dur)}
            </span>
            <input type="range" min="0" max="1" step="0.05" value={ms.muted ? 0 : ms.vol}
              onChange={e => {
                const v = parseFloat(e.target.value);
                if (mediaRef.current) { mediaRef.current.volume = v; mediaRef.current.muted = v === 0; }
                setMs(s => ({ ...s, vol: v, muted: v === 0 }));
              }}
              style={{ width: '56px', accentColor: '#baff29', cursor: 'pointer' }} />
            <select value={speed}
              onChange={e => { const r = parseFloat(e.target.value); setSpeed(r); if (mediaRef.current) mediaRef.current.playbackRate = r; }}
              style={{ background: '#111', border: '1px solid rgba(255,255,255,.12)', color: 'rgba(255,255,255,.5)',
                fontSize: '10px', padding: '2px 4px', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--mono)' }}>
              {[0.5, 1, 1.5, 2].map(r => <option key={r} value={r}>{r}×</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { FilePreviewModal, FilePreviewPane });
