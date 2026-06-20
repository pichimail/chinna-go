/* OverviewView.jsx — Main bento dashboard */

const W = { border: '1px solid var(--line)', borderRadius: '2px', padding: '12px', background: 'transparent', minWidth: 0, overflow: 'hidden' };
const G2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' };
const KICKER = { fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--acc)', marginBottom: '4px' };

function VitalsCard() {
  const [cpu, setCpu] = React.useState(0);
  const [ram, setRam] = React.useState(0);
  const [disk, setDisk] = React.useState(0);
  const [battery, setBattery] = React.useState(0);
  const [cpuH, setCpuH] = React.useState(Array(20).fill(0));
  const [ramH, setRamH] = React.useState(Array(20).fill(0));
  const [info, setInfo] = React.useState({ uptime: '—', ip: '—', chip: '—' });

  React.useEffect(() => {
    const poll = async () => {
      try {
        const d = await fetch('/api/stats').then(r => r.json());
        const c = Math.round(d.cpu?.pct ?? 0);
        const r = Math.round(d.memory?.pct ?? 0);
        const dk = Math.round(d.disk?.pct ?? 0);
        const bt = Math.round(d.battery?.pct ?? 0);
        setCpu(c); setCpuH(h => [...h.slice(1), c]);
        setRam(r); setRamH(h => [...h.slice(1), r]);
        setDisk(dk); setBattery(bt);
        setInfo({ uptime: d.uptime ?? '—', ip: d.network?.ip ?? '—', chip: d.os?.chip ?? d.os?.cpu ?? '—' });
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, []);

  const vitals = [
    { label: 'CPU', val: cpu, unit: '%', color: '#baff29', hist: cpuH },
    { label: 'RAM', val: ram, unit: '%', color: '#0080ff', hist: ramH },
    { label: 'DISK', val: disk, unit: '%', color: '#d54cff', hist: null },
    { label: 'BATT', val: battery, unit: '%', color: '#ffc700', hist: null },
  ];

  return (
    <div style={W}>
      <div style={KICKER}>VITALS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        {vitals.map(v => (
          <div key={v.label} style={{ border: '1px solid var(--line)', borderRadius: '2px', padding: '8px' }}>
            <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: '4px' }}>{v.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: v.color, fontVariantNumeric: 'tabular-nums' }}>{v.val}<span style={{ fontSize: '11px', color: 'var(--t3)' }}>{v.unit}</span></div>
            {v.hist && <Sparkline data={v.hist} color={v.color} height={24} />}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[['⏱', info.uptime], ['🌐', info.ip], ['⚡', info.chip]].map(([ic, val]) => (
          <div key={ic} style={{ fontSize: '10px', color: 'var(--t3)', display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span>{ic}</span><span style={{ color: 'var(--t2)' }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MusicCard() {
  const [track, setTrack] = React.useState({ title: '—', artist: '—', duration: 1 });
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const poll = async () => {
      try {
        const d = await fetch('/api/music/status').then(r => r.json());
        if (d.playing) {
          setPlaying(true);
          setTrack({ title: d.title ?? '—', artist: d.artist ?? '—', duration: d.duration ?? 1 });
          setProgress(d.position != null ? (d.position / (d.duration || 1)) * 100 : 0);
        } else setPlaying(false);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  const ctrl = (action) => fetch('/api/music', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }).catch(() => {});

  return (
    <div style={W}>
      <div style={KICKER}>NOW PLAYING</div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
      <div style={{ fontSize: '11px', color: 'var(--t3)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</div>
      <div style={{ height: '2px', background: 'var(--s2)', borderRadius: '1px', marginBottom: '10px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: playing ? '#ff2d55' : 'var(--line)', borderRadius: '1px', transition: 'width 1s linear' }} />
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {[['⏮', 'prev'], ['⏯', playing ? 'pause' : 'play'], ['⏭', 'next']].map(([ic, act]) => (
          <button key={act} onClick={() => ctrl(act)} style={{ flex: 1, border: '1px solid var(--line)', background: 'transparent', color: playing && act !== 'prev' && act !== 'next' ? '#ff2d55' : 'var(--t2)', borderRadius: '2px', padding: '6px', cursor: 'pointer', fontSize: '14px' }}>
            {ic}
          </button>
        ))}
      </div>
    </div>
  );
}

function HeroCard() {
  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => { const id = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(id); }, []);
  const greet = time.getHours() < 12 ? 'Good morning' : time.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <div style={{ ...W, background: 'linear-gradient(135deg,rgba(186,255,41,.06),rgba(0,128,255,.04),transparent)', minHeight: '120px' }}>
      <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--acc)', marginBottom: '8px' }}>CHINNA DASHBOARD</div>
      <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--t1)', letterSpacing: '-0.5px', marginBottom: '6px' }}>{greet} 👋</div>
      <div style={{ fontSize: '12px', color: 'var(--t2)', lineHeight: 1.6 }}>
        {time.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
        {['⚡ Purge RAM', '🧹 Deep Clean', '📊 Scan'].map(a => (
          <button key={a} data-dot-reveal style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 600, border: '1px solid var(--line)', borderRadius: '2px', background: 'transparent', color: 'var(--t2)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
            onClick={() => runAction(a)}>
            <span style={{ position: 'relative', zIndex: 1 }}>{a}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function runAction(label) {
  const map = { '⚡ Purge RAM': '/api/purge', '🧹 Deep Clean': '/api/purge', '📊 Scan': '/api/doctor' };
  const url = map[label];
  if (!url) return;
  fetch(url, { method: label.includes('Doctor') ? 'GET' : 'POST' }).catch(() => {});
}

function QuickAIWidget({ onNavigate }) {
  const [msgs, setMsgs] = React.useState([{ role: 'ai', text: 'How can I help you today?' }]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const endRef = React.useRef(null);

  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function send() {
    const t = input.trim(); if (!t) return;
    setInput(''); setMsgs(m => [...m, { role: 'user', text: t }]); setLoading(true);
    try {
      const d = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: t }) }).then(r => r.json());
      setMsgs(m => [...m, { role: 'ai', text: d.reply ?? d.message ?? d.text ?? '...' }]);
    } catch { setMsgs(m => [...m, { role: 'ai', text: 'Connection error. Is the server running?' }]); }
    setLoading(false);
  }

  return (
    <div style={{ ...W, display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '200px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ ...KICKER, color: '#d54cff', marginBottom: 0 }}>QUICK AI</div>
        <button onClick={() => onNavigate('studio')} style={{ fontSize: '10px', color: '#d54cff', background: 'transparent', border: 'none', cursor: 'pointer' }}>Full Studio →</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: '160px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ fontSize: '12px', lineHeight: 1.5, padding: '6px 8px', borderRadius: '2px',
            border: '1px solid ' + (m.role === 'user' ? 'rgba(213,76,255,.3)' : 'var(--line)'),
            color: m.role === 'user' ? '#d54cff' : 'var(--t2)',
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%' }}>{m.text}</div>
        ))}
        {loading && <div style={{ fontSize: '11px', color: 'var(--t3)' }}>Thinking…</div>}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask anything…"
          style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid #d54cff', outline: 'none', color: 'var(--t1)', fontSize: '12px', padding: '4px 0', fontFamily: 'var(--font)' }} />
        <button onClick={send} style={{ padding: '4px 10px', background: '#d54cff', border: 'none', borderRadius: '2px', color: '#000', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>→</button>
      </div>
    </div>
  );
}

function QuickTerminalWidget() {
  const ALLOWED = ['ls', 'pwd', 'date', 'uptime', 'uname', 'echo', 'whoami', 'hostname', 'df', 'free', 'top', 'ps'];
  const [lines, setLines] = React.useState([{ type: 'info', text: 'Chinna Terminal — sandboxed shell' }]);
  const [input, setInput] = React.useState('');
  const [hist, setHist] = React.useState([]);
  const [histIdx, setHistIdx] = React.useState(-1);
  const endRef = React.useRef(null);
  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);

  async function run() {
    const cmd = input.trim(); if (!cmd) return;
    setInput(''); setHist(h => [cmd, ...h].slice(0, 50)); setHistIdx(-1);
    setLines(l => [...l, { type: 'cmd', text: `$ ${cmd}` }]);
    const base = cmd.split(' ')[0];
    if (!ALLOWED.includes(base)) {
      setLines(l => [...l, { type: 'err', text: `Command not allowed: ${base}` }]);
      return;
    }
    try {
      const d = await fetch('/api/exec', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cmd }) }).then(r => r.json());
      const out = d.stdout || d.stderr || d.output || '(no output)';
      setLines(l => [...l, { type: 'out', text: out }]);
    } catch { setLines(l => [...l, { type: 'err', text: 'Server error' }]); }
  }

  function onKey(e) {
    if (e.key === 'Enter') { run(); return; }
    if (e.key === 'ArrowUp') { const i = Math.min(histIdx + 1, hist.length - 1); setHistIdx(i); setInput(hist[i] ?? ''); }
    if (e.key === 'ArrowDown') { const i = Math.max(histIdx - 1, -1); setHistIdx(i); setInput(i < 0 ? '' : hist[i]); }
  }

  const colors = { cmd: '#ff2d8c', err: '#ff3333', out: 'var(--t2)', info: 'var(--t3)' };

  return (
    <div style={{ ...W, display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '200px' }}>
      <div style={KICKER}>TERMINAL</div>
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: '160px', fontFamily: 'var(--mono)', fontSize: '11px' }}>
        {lines.map((l, i) => (
          <div key={i} style={{ color: colors[l.type] ?? 'var(--t2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>{l.text}</div>
        ))}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <span style={{ color: '#ff2d8c', fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 700 }}>$</span>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
          placeholder="ls, pwd, date…"
          style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid #baff29', outline: 'none', color: '#baff29', fontSize: '12px', padding: '4px 0', fontFamily: 'var(--mono)' }} />
      </div>
    </div>
  );
}

function StorageWidget() {
  const [data, setData] = React.useState(null);
  React.useEffect(() => {
    fetch('/api/storage').then(r => r.json()).then(setData).catch(() => {});
  }, []);
  const items = data?.entries?.slice(0, 5) ?? [
    { name: 'Downloads', size: '—', pct: 0 }, { name: 'Library', size: '—', pct: 0 },
    { name: 'Applications', size: '—', pct: 0 },
  ];
  return (
    <div style={W}>
      <div style={KICKER}>STORAGE</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
              <span style={{ color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{item.name || item.path?.split('/').pop()}</span>
              <span style={{ color: 'var(--t3)', fontFamily: 'var(--mono)' }}>{item.size || item.human}</span>
            </div>
            <MiniBar pct={item.pct ?? 0} color="#d54cff" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProcessesWidget() {
  const [procs, setProcs] = React.useState([]);
  React.useEffect(() => {
    const poll = () => fetch('/api/stats').then(r => r.json()).then(d => setProcs((d.processes ?? []).slice(0, 5))).catch(() => {});
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={W}>
      <div style={KICKER}>TOP PROCESSES</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {procs.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ flex: 1, fontSize: '11px', color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: '#ff8c00', flexShrink: 0 }}>{p.cpu?.toFixed(1)}%</span>
            <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: '#0080ff', flexShrink: 0, width: '40px', textAlign: 'right' }}>{p.mem?.toFixed(0)}MB</span>
          </div>
        ))}
        {!procs.length && <div style={{ fontSize: '11px', color: 'var(--t3)' }}>Loading…</div>}
      </div>
    </div>
  );
}

function AIReadinessCard() {
  const [status, setStatus] = React.useState(null);
  React.useEffect(() => {
    fetch('/api/ai/status').then(r => r.json()).then(setStatus).catch(() => {});
  }, []);
  const ready = status?.ready;
  return (
    <div style={W}>
      <div style={KICKER}>AI READINESS</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ready ? '#2edd5e' : '#ff3333', boxShadow: `0 0 6px ${ready ? '#2edd5e' : '#ff3333'}` }} />
        <span style={{ fontSize: '12px', fontWeight: 700, color: ready ? '#2edd5e' : '#ff3333' }}>
          {ready ? 'Ready' : 'Not configured'}
        </span>
      </div>
      {status && (
        <div style={{ fontSize: '11px', color: 'var(--t3)', lineHeight: 1.6 }}>
          {status.provider && <div>Provider: <span style={{ color: 'var(--t2)' }}>{status.provider}</span></div>}
          {status.label && <div style={{ color: 'var(--t3)' }}>{status.label}</div>}
        </div>
      )}
    </div>
  );
}

function VersionCard() {
  const [ver, setVer] = React.useState(null);
  React.useEffect(() => {
    fetch('/api/version').then(r => r.json()).then(setVer).catch(() => {});
  }, []);
  return (
    <div style={W}>
      <div style={KICKER}>VERSION</div>
      <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--t1)', fontVariantNumeric: 'tabular-nums' }}>
        {ver?.version ?? '—'}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '4px' }}>{ver?.name ?? 'Chinna'}</div>
    </div>
  );
}

function ShortcutsWidget({ onNavigate }) {
  const shortcuts = [
    { icon: '⚡', label: 'Purge RAM', color: '#ff2d55', action: () => fetch('/api/purge', { method: 'POST' }) },
    { icon: '🧹', label: 'Deep Clean', color: '#2edd5e', action: () => fetch('/api/purge', { method: 'POST' }) },
    { icon: '📊', label: 'Doctor', color: '#ffc700', action: () => onNavigate('apps') },
    { icon: '◈', label: 'Studio', color: '#d54cff', action: () => onNavigate('studio') },
    { icon: '🗂', label: 'Files', color: '#0080ff', action: () => onNavigate('files') },
    { icon: '⚙', label: 'Settings', color: '#00e5ff', action: () => onNavigate('settings') },
  ];
  return (
    <div style={W}>
      <div style={KICKER}>SHORTCUTS</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
        {shortcuts.map((s, i) => (
          <button key={i} onClick={s.action} data-dot-reveal
            style={{ border: `1px solid ${s.color}33`, background: 'transparent', borderRadius: '2px',
              padding: '10px 6px', cursor: 'pointer', textAlign: 'center', position: 'relative', overflow: 'hidden',
              transition: 'border-color .15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '18px', position: 'relative', zIndex: 1 }}>{s.icon}</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: s.color, position: 'relative', zIndex: 1 }}>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DeepLinksWidget() {
  const links = [
    { icon: '📡', label: 'WhatsApp', id: 'whatsapp', color: '#2edd5e' },
    { icon: '🔒', label: 'Secure Chat', id: 'securechat', color: '#00e5ff' },
    { icon: '🌐', label: 'Browser', id: 'webviews', color: '#0080ff' },
    { icon: '🔌', label: 'Plugins', id: 'plugins', color: '#d54cff' },
    { icon: '📋', label: 'Duplicates', id: 'duplicates', color: '#ff8c00' },
  ];
  return (
    <div style={{ ...W, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {links.map(l => (
        <a key={l.id} href={`#${l.id}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
          border: `1px solid ${l.color}44`, borderRadius: '2px', color: l.color, fontSize: '11px', fontWeight: 700,
          textDecoration: 'none', transition: 'border-color .15s' }}>
          <span>{l.icon}</span>{l.label}
        </a>
      ))}
    </div>
  );
}

function FoldersWidget() {
  const folders = ['~/Downloads', '~/Desktop', '~/Documents', '~/Movies', '~/Pictures'];
  return (
    <div style={W}>
      <div style={KICKER}>QUICK FOLDERS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {folders.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0',
            borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: '12px', color: 'var(--t2)' }}>
            <span>📁</span>{f}
          </div>
        ))}
      </div>
    </div>
  );
}

function CommsWidget({ onNavigate }) {
  return (
    <div style={W}>
      <div style={KICKER}>COMMS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[['◎ WhatsApp', 'whatsapp', '#2edd5e'], ['⊛ Secure Chat', 'securechat', '#00e5ff']].map(([label, id, color]) => (
          <button key={id} onClick={() => onNavigate(id)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
              border: `1px solid ${color}44`, borderRadius: '2px', background: 'transparent',
              color, fontSize: '12px', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function OverviewView({ onNavigate }) {
  return (
    <div style={{ display: 'flex', gap: '8px', padding: '10px', alignItems: 'flex-start', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      {/* LEFT — 2/3 */}
      <div style={{ flex: '2 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <HeroCard />
        <div style={G2}>
          <WeatherCard compact={false} />
          <ShortcutsWidget onNavigate={onNavigate} />
        </div>
        <div style={G2}>
          <QuickAIWidget onNavigate={onNavigate} />
          <QuickTerminalWidget />
        </div>
        <DeepLinksWidget />
        <div style={G2}>
          <FoldersWidget />
          <CommsWidget onNavigate={onNavigate} />
        </div>
        <div style={G2}>
          <StorageWidget />
          <ProcessesWidget />
        </div>
      </div>
      {/* RIGHT RAIL — 1/3 */}
      <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={W}>
          <div style={{ ...KICKER, marginBottom: '12px' }}>CLOCK</div>
          <AnalogClock />
        </div>
        <VitalsCard />
        <MusicCard />
        <AIReadinessCard />
        <VersionCard />
      </div>
    </div>
  );
}

Object.assign(window, { OverviewView });
