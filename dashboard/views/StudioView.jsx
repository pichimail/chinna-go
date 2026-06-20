/* StudioView v4 — exact design reference + real SSE /api/agent backend */

const MODELS = [
  { id:'chinna/free',   label:'chinna/free',      sub:'Fast · Free · Local',    badge:'FREE', color:'#baff29' },
  { id:'chinna/auto',   label:'chinna/auto',       sub:'Best for most tasks',    badge:'AUTO', color:'#5ac8fa' },
  { id:'chinna/reason', label:'chinna/reasoning',  sub:'Complex problems',       badge:'PRO',  color:'#ffc700' },
  { id:'claude-sonnet', label:'claude-3.5-sonnet', sub:'Anthropic flagship',     badge:null,   color:'#d54cff' },
  { id:'gpt-4o',        label:'gpt-4o',            sub:'OpenAI flagship',        badge:null,   color:'#0080ff' },
];

const CHIPS = [
  { icon:'🌐', label:'Build a landing page',    color:'#0080ff' },
  { icon:'🔧', label:'Fix TypeScript errors',   color:'#ffc700' },
  { icon:'⚡', label:'Run Mac Doctor',           color:'#ff2d8c' },
  { icon:'🐍', label:'Write a Python script',   color:'#2edd5e' },
  { icon:'◆',  label:'Explain this codebase',   color:'#d54cff' },
  { icon:'🚀', label:'Clone a GitHub repo',      color:'#5ac8fa' },
  { icon:'🎨', label:'Generate a UI component', color:'#baff29' },
  { icon:'🔍', label:'Debug React app',          color:'#ff8c00' },
];

const ATTACH_OPTS = [
  { icon:'📎', label:'Attach file',          sub:'Images, HTML, TSX, py, md…', color:'#ffc700' },
  { icon:'🔗', label:'Paste URL',             sub:'Fetch & summarize any page',  color:'#5ac8fa' },
  { icon:'◆',  label:'Clone Git repo',        sub:'github.com/user/repo',        color:'#baff29' },
  { icon:'📁', label:'Import project folder', sub:'Scan & understand codebase',  color:'#d54cff' },
  { icon:'⬡',  label:'Use a template',        sub:'Landing page, dashboard…',    color:'#ff8c00' },
];

const CODE_TRIGGERS = ['build','create','generate','make','write','code','html','tsx',
  'component','landing','website','script','function','fix','debug','refactor','page','app'];
const needsBuild = t => CODE_TRIGGERS.some(k => t.toLowerCase().includes(k));

/* ── Neon terminal renderer ── */
function NeonTerminal({ text }) {
  const lines = (text || '').split('\n');
  const tokenize = (line) => {
    if (line.startsWith('$ ')) {
      const cmd = line.slice(2);
      const parts = cmd.split(' ');
      return [
        { t:'$ ', c:'#ff2d8c', w:'800' },
        { t:parts[0]+' ', c:'#ffd60a', w:'700' },
        ...parts.slice(1).map(p => ({
          t:p+' ', w:'500',
          c: p.startsWith('--') ? '#5ac8fa' : p.startsWith('-') ? '#00e5ff' : p.includes('/') ? '#d54cff' : '#ffffff',
        }))
      ];
    }
    if (line.startsWith('> ')) {
      const rest = line.slice(2);
      return [
        { t:'> ', c:'#00e5ff', w:'700' },
        { t:rest.replace(/~\/[\w./\-]+/g,''), c:'rgba(255,255,255,.6)', w:'400' },
        ...(rest.match(/~\/[\w./\-]+/g)||[]).map(p => ({ t:p, c:'#d54cff', w:'600' })),
      ];
    }
    if (line.startsWith('✓')) {
      return [
        { t:'✓', c:'#2edd5e', w:'900' },
        { t:line.slice(1), c:'rgba(255,255,255,.75)', w:'500' },
      ];
    }
    if (line.startsWith('✗') || line.toLowerCase().startsWith('error')) {
      return [{ t:line, c:'#ff3333', w:'600' }];
    }
    const numReplaced = line.replace(/\b(\d[\d.,]*\s*(?:KB|MB|GB|ms|s|B|lines)?)\b/g, '\x00$1\x00');
    return numReplaced.split('\x00').map(seg => ({
      t:seg, w:'500',
      c:/^\d/.test(seg) ? '#5ac8fa' : 'rgba(255,255,255,.55)',
    }));
  };
  return (
    <div style={{ fontFamily:'var(--mono)', fontSize:'12px', lineHeight:'1.85',
      padding:'16px 20px', overflowY:'auto', flex:1 }}>
      {lines.map((line, i) => (
        <div key={i} style={{ display:'flex', flexWrap:'wrap', minHeight:'1.85em',
          paddingLeft: line.startsWith('> ') || line.startsWith('  ') ? '16px' : '0' }}>
          {line === '' ? <span>&nbsp;</span> : tokenize(line).map((tok, j) => (
            <span key={j} style={{ color:tok.c, fontWeight:tok.w, whiteSpace:'pre' }}>{tok.t}</span>
          ))}
        </div>
      ))}
      <span style={{ display:'inline-block', width:'8px', height:'14px',
        background:'#ff2d8c', marginLeft:'2px', verticalAlign:'middle',
        animation:'blink 1s step-end infinite' }}/>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} } @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}} @keyframes dot{0%,80%,100%{opacity:.25}40%{opacity:1}}`}</style>
    </div>
  );
}

/* ── Neon HTML syntax highlighter ── */
function NeonCode({ code }) {
  const html = (code || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/(&lt;!DOCTYPE[^&]*&gt;)/g,'<span style="color:#5ac8fa;font-weight:600">$1</span>')
    .replace(/(&lt;\/?)([\w-]+)/g,'<span style="color:rgba(255,255,255,.35)">$1</span><span style="color:#ff2d8c;font-weight:700">$2</span>')
    .replace(/\s([\w-]+)=/g,' <span style="color:#ffd60a;font-weight:600">$1</span>=')
    .replace(/"([^"]*)"/g,'<span style="color:#2edd5e">"$1"</span>')
    .replace(/([\w-]+)(?=\s*:)/g,'<span style="color:#5ac8fa">$1</span>')
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g,'<span style="color:rgba(255,255,255,.28);font-style:italic">$1</span>')
    .replace(/\b(\d+(?:px|em|rem|%|ms|s)?)\b/g,'<span style="color:#d54cff;font-weight:600">$1</span>')
    .replace(/(&gt;)/g,'<span style="color:rgba(255,255,255,.35)">$1</span>');
  return (
    <div style={{ fontFamily:'var(--mono)', fontSize:'11.5px', lineHeight:'1.75',
      padding:'16px 20px', overflowY:'auto', flex:1, overflowX:'auto' }}>
      <pre style={{ margin:0, whiteSpace:'pre-wrap', wordBreak:'break-all' }}
        dangerouslySetInnerHTML={{ __html: html }}/>
    </div>
  );
}

/* ── Model picker ── */
function ModelPicker({ model, onSelect }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const cur = MODELS.find(m => m.id === model) || MODELS[0];
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display:'flex', alignItems:'center', gap:'6px', padding:'5px 10px',
          borderRadius:'20px', border:`1px solid ${cur.color}44`,
          background:'transparent', color:cur.color,
          fontSize:'11.5px', fontWeight:'700', cursor:'pointer',
          fontFamily:'var(--mono)', transition:'all .1s', whiteSpace:'nowrap' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor=cur.color; e.currentTarget.style.background=`${cur.color}10`; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor=`${cur.color}44`; e.currentTarget.style.background='transparent'; }}>
        <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:cur.color,
          boxShadow:`0 0 6px ${cur.color}`, flexShrink:0 }} />
        {cur.label} <span style={{ opacity:.5, fontSize:'9px' }}>▾</span>
      </button>
      {open && (
        <div style={{ position:'absolute', bottom:'calc(100% + 8px)', left:0, zIndex:200,
          background:'rgba(0,0,0,.97)', border:'1px solid rgba(255,255,255,.12)',
          borderRadius:'8px', boxShadow:'0 24px 64px rgba(0,0,0,.9)',
          minWidth:'240px', overflow:'hidden', backdropFilter:'blur(20px)' }}>
          {MODELS.map(m => (
            <div key={m.id} onClick={() => { onSelect(m.id); setOpen(false); }}
              style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px',
                cursor:'pointer', transition:'all .08s',
                borderLeft:`2px solid ${model===m.id?m.color:'transparent'}`,
                background: model===m.id ? `${m.color}0d` : 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.background=`${m.color}0d`; e.currentTarget.style.borderLeftColor=m.color; }}
              onMouseLeave={e => { e.currentTarget.style.background=model===m.id?`${m.color}0d`:'transparent'; e.currentTarget.style.borderLeftColor=model===m.id?m.color:'transparent'; }}>
              <span style={{ width:'7px', height:'7px', borderRadius:'50%', flexShrink:0,
                background: model===m.id ? m.color : 'rgba(255,255,255,.18)',
                boxShadow: model===m.id ? `0 0 7px ${m.color}` : undefined }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'12.5px', fontWeight:'700', color:model===m.id?m.color:'rgba(255,255,255,.85)',
                  fontFamily:'var(--mono)' }}>{m.label}</div>
                <div style={{ fontSize:'10.5px', color:'rgba(255,255,255,.35)', marginTop:'1px' }}>{m.sub}</div>
              </div>
              {m.badge && (
                <span style={{ fontSize:'9px', fontWeight:'800', padding:'2px 6px',
                  border:`1px solid ${m.color}44`, borderRadius:'2px',
                  color:m.color, background:`${m.color}10` }}>{m.badge}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Attach menu ── */
function AttachMenu({ onClose }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} style={{ position:'absolute', bottom:'calc(100% + 8px)', left:0, zIndex:200,
      background:'rgba(0,0,0,.97)', border:'1px solid rgba(255,255,255,.12)',
      borderRadius:'8px', boxShadow:'0 24px 64px rgba(0,0,0,.9)',
      minWidth:'240px', overflow:'hidden', backdropFilter:'blur(20px)' }}>
      {ATTACH_OPTS.map(o => (
        <div key={o.label} onClick={onClose}
          style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px',
            cursor:'pointer', transition:'all .08s',
            borderBottom:'1px solid rgba(255,255,255,.05)' }}
          onMouseEnter={e => { e.currentTarget.style.background=`${o.color}0a`; }}
          onMouseLeave={e => { e.currentTarget.style.background='transparent'; }}>
          <div style={{ width:'30px', height:'30px', borderRadius:'6px', flexShrink:0,
            border:`1px solid ${o.color}33`, display:'grid', placeItems:'center',
            fontSize:'15px', background:`${o.color}0a` }}>{o.icon}</div>
          <div>
            <div style={{ fontSize:'13px', fontWeight:'600', color:'rgba(255,255,255,.9)' }}>{o.label}</div>
            <div style={{ fontSize:'10.5px', color:'rgba(255,255,255,.35)', marginTop:'1px' }}>{o.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Composer ── */
function Composer({ value, onChange, onSend, model, onModelChange, compact, placeholder, files }) {
  const [attachOpen, setAttachOpen] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const glow = focused
    ? { borderColor:'rgba(186,255,41,.5)', boxShadow:'0 0 0 1px rgba(186,255,41,.2), 0 0 24px rgba(186,255,41,.1)' }
    : { borderColor:'rgba(255,255,255,.12)' };
  return (
    <div style={{ width:'100%', maxWidth:compact?'none':'760px', position:'relative' }}>
      <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid',
        borderRadius:'12px', overflow:'visible', transition:'border-color .15s,box-shadow .15s', ...glow }}>
        <textarea aria-label="Prompt" value={value} onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder={placeholder || 'Ask Chinna — chat · build · run · explain…'}
          rows={compact ? 2 : 3}
          style={{ width:'100%', background:'none', border:'none', outline:'none',
            color:'#ffffff', fontSize:'14px', fontFamily:'var(--font)',
            resize:'none', lineHeight:'1.6', padding:compact ? '12px 14px 6px' : '16px 16px 8px',
            maxHeight:'200px', overflow:'auto', display:'block', caretColor:'#baff29' }} />
        {files && files.length > 0 && (
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', padding:'0 14px 6px' }}>
            {files.map((f,i) => (
              <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:'5px',
                padding:'2px 8px', border:'1px solid rgba(186,255,41,.3)', borderRadius:'20px',
                fontSize:'11px', color:'#baff29', background:'rgba(186,255,41,.08)' }}>
                📎 {f.name}
              </span>
            ))}
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:'8px',
          padding:compact ? '6px 10px' : '8px 12px',
          borderTop:'1px solid rgba(255,255,255,.07)' }}>
          <ModelPicker model={model} onSelect={onModelChange} />
          <div style={{ position:'relative' }}>
            <button aria-label="Attach" onClick={() => setAttachOpen(o => !o)}
              style={{ width:'28px', height:'28px', borderRadius:'6px',
                border:`1px solid ${attachOpen?'rgba(186,255,41,.4)':'rgba(255,255,255,.1)'}`,
                background: attachOpen ? 'rgba(186,255,41,.1)' : 'transparent',
                color: attachOpen ? '#baff29' : 'rgba(255,255,255,.5)',
                display:'grid', placeItems:'center', cursor:'pointer',
                fontSize:'16px', fontWeight:'300', transition:'all .1s' }}>
              +
            </button>
            {attachOpen && <AttachMenu onClose={() => setAttachOpen(false)} />}
          </div>
          <span style={{ fontSize:'10.5px', color:'rgba(255,255,255,.25)', marginLeft:'auto',
            fontFamily:'var(--mono)' }}>↵ send · ⇧↵ newline</span>
          <button aria-label="Send" onClick={onSend}
            style={{ width:'32px', height:'32px', borderRadius:'8px', flexShrink:0,
              background: value.trim() ? '#baff29' : 'transparent',
              color: value.trim() ? '#030a00' : 'rgba(255,255,255,.25)',
              border: value.trim() ? 'none' : '1px solid rgba(255,255,255,.1)',
              fontSize:'16px', display:'grid', placeItems:'center',
              cursor:'pointer', transition:'all .15s', fontWeight:'900',
              boxShadow: value.trim() ? '0 0 16px rgba(186,255,41,.3)' : undefined }}>↑</button>
        </div>
      </div>
    </div>
  );
}

/* ── Tool block ── */
function ToolBlock({ tool, input: inp, status, result }) {
  const [open, setOpen] = React.useState(true);
  const label = tool || 'tool';
  const cmd = typeof inp === 'string' ? inp : inp ? JSON.stringify(inp).slice(0,80) : '';
  const out = result ? (typeof result === 'string' ? result : JSON.stringify(result, null, 2)) : '';
  return (
    <div style={{ border:'1px solid rgba(96,165,250,.2)', borderRadius:'6px',
      overflow:'hidden', margin:'4px 0 6px', background:'transparent' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px',
          cursor:'pointer', borderBottom: open ? '1px solid rgba(255,255,255,.07)' : 'none',
          background:'rgba(96,165,250,.05)' }}>
        <span style={{ fontSize:'9px', fontWeight:'800', letterSpacing:'1px',
          textTransform:'uppercase', padding:'2px 7px', borderRadius:'2px',
          color: status === 'done' ? '#2edd5e' : '#60a5fa',
          border:`1px solid ${status==='done'?'rgba(46,221,94,.3)':'rgba(96,165,250,.3)'}`,
          background:'transparent' }}>{label}</span>
        <code style={{ fontSize:'11px', color:'rgba(255,255,255,.45)', fontFamily:'var(--mono)',
          flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cmd}</code>
        <span style={{ fontSize:'10px', color: status==='done' ? '#2edd5e' : '#60a5fa' }}>
          {status === 'done' ? '✓' : '⟳'}
        </span>
        <span style={{ fontSize:'10px', color:'rgba(255,255,255,.3)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && out && (
        <pre style={{ fontFamily:'var(--mono)', fontSize:'11px', padding:'8px 12px',
          margin:0, lineHeight:'1.7', maxHeight:'90px', overflowY:'auto',
          whiteSpace:'pre-wrap', background:'transparent',
          color: status==='done' ? '#2edd5e' : '#60a5fa' }}>{out.slice(0,400)}{out.length>400?'\n…':''}</pre>
      )}
    </div>
  );
}

/* ── Main StudioView ── */
function StudioView({ onNavigate }) {
  const [phase, setPhase]         = React.useState('hero');
  const [msgs, setMsgs]           = React.useState([]);
  const [input, setInput]         = React.useState('');
  const [model, setModel]         = React.useState('chinna/free');
  const [loading, setLoading]     = React.useState(false);
  const [tab, setTab]             = React.useState(0);
  const [leftW, setLeftW]         = React.useState(440);
  const [files, setFiles]         = React.useState([]);
  const [draggingOver, setDO]     = React.useState(false);
  const [artifacts, setArtifacts] = React.useState([]);
  const [tools, setTools]         = React.useState([]);
  const [artifactCode, setArtCode]= React.useState('');
  const [artifactId, setArtId]    = React.useState(null);

  const endRef    = React.useRef(null);
  const dragging  = React.useRef(false);
  const startX    = React.useRef(0);
  const startW    = React.useRef(0);
  const historyRef= React.useRef([]);
  const TABS      = ['Preview','Code','Terminal'];
  const now       = () => new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});

  const loadArtifacts = React.useCallback(() => {
    fetch('/api/artifacts').then(r => r.json()).then(d => {
      const list = d.artifacts ?? [];
      setArtifacts(list);
      if (list.length && list[0].id) {
        const first = list[0];
        setArtId(first.id);
        fetch(`/api/artifact/${first.id}`).then(r => r.text()).then(t => setArtCode(t)).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  React.useEffect(() => { loadArtifacts(); }, [loadArtifacts]);

  React.useEffect(() => {
    if (endRef.current) endRef.current.parentElement.scrollTop = endRef.current.offsetTop;
  }, [msgs, loading]);

  React.useEffect(() => {
    const mv = e => {
      if (!dragging.current) return;
      setLeftW(Math.max(280, Math.min(startW.current + e.clientX - startX.current, 680)));
    };
    const up = () => { dragging.current = false; };
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  }, []);

  const appendAi = React.useCallback((chunk) => setMsgs(m => {
    const copy = m.slice();
    for (let i = copy.length - 1; i >= 0; i--) {
      if (copy[i].role === 'ai' && copy[i].streaming) {
        copy[i] = { ...copy[i], text: copy[i].text + chunk };
        break;
      }
    }
    return copy;
  }), []);

  const finishAi = React.useCallback(() =>
    setMsgs(m => m.map(x => x.streaming ? { ...x, streaming: false, done: true } : x)), []);

  const send = async (text) => {
    const txt = (text || input).trim();
    if (!txt || loading) return;
    setInput('');
    setTools([]);

    const isBuild = needsBuild(txt) || phase === 'build';
    const agentMode = isBuild ? 'build' : 'ask';
    if (phase === 'hero') setPhase(isBuild ? 'build' : 'chat');
    else if (isBuild && phase === 'chat') setPhase('build');

    setMsgs(m => [...m,
      { role:'user', text:txt, ts:now() },
      { role:'ai', text:'', streaming:true, ts:now() }
    ]);
    setLoading(true);

    try {
      const resp = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: txt, mode: agentMode, model, history: historyRef.current }),
      });

      if (!resp.ok) {
        appendAi(`\n⚠ Server error ${resp.status}`);
      } else {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let assistantText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop();
          for (const part of parts) {
            const line = part.split('\n').find(l => l.startsWith('data:'));
            if (!line) continue;
            let evt;
            try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }

            if (evt.type === 'text')        { assistantText += evt.content; appendAi(evt.content); }
            else if (evt.type === 'plan')   { assistantText += evt.content; appendAi(evt.content); }
            else if (evt.type === 'tool_start') {
              setTools(ts => [...ts, { tool: evt.tool, input: evt.input, status: 'running' }]);
            }
            else if (evt.type === 'tool_result') {
              setTools(ts => ts.map(x =>
                x.tool === evt.tool && x.status === 'running'
                  ? { ...x, status: 'done', result: evt.result }
                  : x
              ));
            }
            else if (evt.type === 'artifact') {
              if (evt.meta) {
                setArtifacts(a => [evt.meta, ...a.filter(x => x.id !== evt.meta.id)]);
                setArtId(evt.meta.id);
                fetch(`/api/artifact/${evt.meta.id}`).then(r => r.text()).then(t => {
                  setArtCode(t);
                  if (phase !== 'build') setPhase('build');
                }).catch(() => {});
              }
            }
            else if (evt.type === 'ask_user') {
              appendAi(`\n\n❓ ${evt.question}` + (evt.options ? `\nOptions: ${evt.options.join(', ')}` : ''));
            }
            else if (evt.type === 'error')  { appendAi(`\n⚠ ${evt.content}`); }
            else if (evt.type === 'done')   {
              if (Array.isArray(evt.artifacts) && evt.artifacts.length) {
                const list = evt.artifacts.slice().reverse();
                setArtifacts(list);
                if (list[0]?.id) {
                  setArtId(list[0].id);
                  fetch(`/api/artifact/${list[0].id}`).then(r => r.text()).then(t => setArtCode(t)).catch(() => {});
                }
              }
            }
          }
        }
        historyRef.current = [
          ...historyRef.current,
          { role:'user', content: txt },
          { role:'assistant', content: assistantText }
        ].slice(-20);
      }
    } catch {
      appendAi('\n⚠ Could not reach the AI backend. Check your API key in Settings.');
    }

    finishAi();
    setLoading(false);
    loadArtifacts();
  };

  const handleFileDrop = (file) => {
    setFiles(p => [...p, file]);
    if (file.name.match(/\.(html|tsx|jsx|ts|js|py|css)$/i)) {
      setPhase('build');
      setTab(1);
    }
  };

  const terminalText = React.useMemo(() => {
    if (!tools.length) return '$ chinna agent ready\n> waiting for task…';
    return tools.map(t => {
      const cmd = typeof t.input === 'string' ? t.input : (t.input ? JSON.stringify(t.input) : '');
      const lines = [`$ chinna ${t.tool} ${cmd.slice(0,60)}`];
      if (t.status === 'done' && t.result) {
        const out = typeof t.result === 'string' ? t.result : JSON.stringify(t.result, null, 2);
        out.split('\n').slice(0,8).forEach(l => lines.push(l.startsWith('✓') || l.startsWith('✗') ? l : `> ${l}`));
        lines.push(`✓  ${t.tool} complete`);
      }
      return lines.join('\n');
    }).join('\n\n');
  }, [tools]);

  /* ── HERO ── */
  if (phase === 'hero') return (
    <div onDragOver={e => { e.preventDefault(); setDO(true); }}
      onDragLeave={() => setDO(false)}
      onDrop={e => { e.preventDefault(); setDO(false); const f = e.dataTransfer.files[0]; if (f) handleFileDrop(f); }}
      style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'24px 20px 100px', gap:'28px', position:'relative',
        overflow:'hidden', background:'var(--bg)',
        border: draggingOver ? '2px dashed rgba(186,255,41,.4)' : '2px solid transparent' }}>
      {/* Ambient glows */}
      <div style={{ position:'absolute', top:'10%', left:'20%', width:'500px', height:'500px', pointerEvents:'none',
        background:'radial-gradient(circle,rgba(186,255,41,.04),transparent 60%)' }} />
      <div style={{ position:'absolute', top:'20%', right:'15%', width:'360px', height:'360px', pointerEvents:'none',
        background:'radial-gradient(circle,rgba(213,76,255,.04),transparent 60%)' }} />
      <div style={{ position:'absolute', bottom:'20%', left:'30%', width:'300px', height:'300px', pointerEvents:'none',
        background:'radial-gradient(circle,rgba(0,128,255,.03),transparent 60%)' }} />

      <div style={{ textAlign:'center', maxWidth:'620px', animation:'fadeUp .35s ease' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', marginBottom:'18px' }}>
          <div style={{ width:'30px', height:'30px', borderRadius:'7px', background:'#baff29',
            display:'grid', placeItems:'center', fontSize:'14px', fontWeight:'900', color:'#030a00',
            boxShadow:'0 0 20px rgba(186,255,41,.35)' }}>C</div>
          <span style={{ fontSize:'11px', fontWeight:'700', letterSpacing:'2.5px',
            textTransform:'uppercase', color:'rgba(255,255,255,.35)' }}>CHINNA STUDIO</span>
        </div>
        <h1 style={{ fontSize:'48px', fontWeight:'900', lineHeight:'1.03', letterSpacing:'-2.5px',
          color:'#ffffff', marginBottom:'14px' }}>
          What are we<br/>
          <span style={{ background:'linear-gradient(90deg,#baff29,#5ac8fa)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>building today?</span>
        </h1>
        <p style={{ fontSize:'15px', color:'rgba(255,255,255,.45)', lineHeight:'1.65', marginBottom:'6px' }}>
          Chat · Code · Agent · Mac control — all in one.
        </p>
        <p style={{ fontSize:'12px', fontFamily:'var(--mono)', color:'rgba(255,255,255,.25)' }}>
          Telugu · Hindi · Tinglish · English
        </p>
      </div>

      <div style={{ width:'100%', maxWidth:'720px', animation:'fadeUp .45s ease' }}>
        <Composer value={input} onChange={setInput} onSend={() => send()}
          model={model} onModelChange={setModel} files={files}
          placeholder="Ask anything, paste code, drop a file, or describe what to build…" />
      </div>

      <div style={{ display:'flex', flexWrap:'wrap', gap:'7px', justifyContent:'center',
        maxWidth:'700px', animation:'fadeUp .55s ease' }}>
        {CHIPS.map(c => (
          <button key={c.label} onClick={() => send(c.label)}
            style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 13px',
              borderRadius:'20px', border:`1px solid ${c.color}33`,
              background:'transparent', color:'rgba(255,255,255,.55)',
              fontSize:'12px', fontWeight:'500', cursor:'pointer',
              transition:'all .12s', fontFamily:'var(--font)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=`${c.color}88`; e.currentTarget.style.color=c.color; e.currentTarget.style.background=`${c.color}0d`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=`${c.color}33`; e.currentTarget.style.color='rgba(255,255,255,.55)'; e.currentTarget.style.background='transparent'; }}>
            <span style={{ fontSize:'14px' }}>{c.icon}</span>{c.label}
          </button>
        ))}
      </div>
      {draggingOver && (
        <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center',
          background:'rgba(0,0,0,.75)', backdropFilter:'blur(6px)',
          fontSize:'22px', fontWeight:'800', color:'#baff29', letterSpacing:'-0.5px',
          textShadow:'0 0 32px rgba(186,255,41,.5)' }}>
          Drop to preview or edit →
        </div>
      )}
    </div>
  );

  /* ── Chat panel (shared between chat and build phases) ── */
  const ChatPanel = (
    <div style={{ display:'flex', flexDirection:'column',
      width: phase === 'build' ? leftW : '100%',
      minWidth: phase === 'build' ? 280 : undefined,
      maxWidth: phase === 'chat' ? '860px' : undefined,
      margin: phase === 'chat' ? '0 auto' : undefined,
      flex: phase === 'chat' ? 1 : undefined,
      flexShrink: 0, position:'relative', minHeight: 0 }}>
      <div style={{ flex:1, minHeight:0, overflowY:'auto', padding:'16px',
        display:'flex', flexDirection:'column', gap:'12px', paddingBottom:'160px' }}>
        {msgs.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div key={i} style={{ display:'flex', flexDirection:'column', gap:'4px',
              alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth:'88%', animation:'fadeUp .15s ease' }}>
              <div style={{ fontSize:'9px', fontWeight:'800', letterSpacing:'.8px',
                textTransform:'uppercase', textAlign: isUser ? 'right' : 'left',
                color: isUser ? '#baff29' : 'rgba(255,255,255,.3)',
                display:'flex', alignItems:'center', gap:'5px',
                justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                {!isUser && <span style={{ width:'14px', height:'14px', borderRadius:'3px',
                  background:'#baff29', display:'grid', placeItems:'center',
                  fontSize:'7px', fontWeight:'900', color:'#030a00', flexShrink:0 }}>C</span>}
                {isUser ? 'YOU' : 'CHINNA'} · {m.ts}
                {m.done && !m.streaming && <span style={{ color:'#2edd5e' }}>✓</span>}
              </div>
              {/* Tool blocks inline with AI message */}
              {!isUser && i === msgs.length - 1 && tools.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                  {tools.map((t, ti) => <ToolBlock key={ti} {...t} />)}
                </div>
              )}
              {m.text && (
                <div style={{ padding:'10px 14px', fontSize:'13.5px', lineHeight:'1.65',
                  wordBreak:'break-word', whiteSpace:'pre-wrap', color:'#ffffff',
                  borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background:'transparent',
                  border: isUser ? '1px solid rgba(186,255,41,.35)' : '1px solid rgba(255,255,255,.1)',
                  boxShadow: isUser ? '0 0 0 1px rgba(186,255,41,.08) inset' : undefined }}>
                  {m.text || (m.streaming ? '' : '')}
                  {m.streaming && <span style={{ color:'#baff29' }}> ▋</span>}
                </div>
              )}
              {m.streaming && !m.text && (
                <div style={{ display:'flex', gap:'4px', padding:'10px 14px',
                  border:'1px solid rgba(255,255,255,.1)', borderRadius:'12px 12px 12px 2px', background:'transparent' }}>
                  {[0,1,2].map(j => <span key={j} style={{ width:'6px', height:'6px', borderRadius:'50%',
                    background:'#baff29', display:'inline-block',
                    animation:'dot 1s infinite', animationDelay:`${j*.15}s` }} />)}
                </div>
              )}
            </div>
          );
        })}
        {loading && msgs.length > 0 && msgs[msgs.length-1].role !== 'ai' && (
          <div style={{ alignSelf:'flex-start', display:'flex', gap:'4px', padding:'10px 14px',
            border:'1px solid rgba(255,255,255,.1)', borderRadius:'12px 12px 12px 2px', background:'transparent' }}>
            {[0,1,2].map(j => <span key={j} style={{ width:'6px', height:'6px', borderRadius:'50%',
              background:'#baff29', display:'inline-block',
              animation:'dot 1s infinite', animationDelay:`${j*.15}s` }} />)}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer bar pinned to bottom */}
      <div style={{ position:'absolute', bottom:0, left:0,
        width: phase === 'build' ? leftW : '100%',
        padding:'10px 14px',
        background:'linear-gradient(to top,rgba(0,0,0,.98) 65%,transparent)' }}>
        <div style={{ display:'flex', gap:'10px', marginBottom:'8px', alignItems:'center' }}>
          <button onClick={() => { setPhase('hero'); setMsgs([]); setFiles([]); setTools([]); }}
            style={{ fontSize:'11px', color:'rgba(255,255,255,.3)', background:'none', border:'none',
              cursor:'pointer', fontFamily:'var(--font)', padding:0, transition:'color .1s' }}
            onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,.7)'}
            onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.3)'}>← New chat</button>
          {phase === 'chat' && (
            <span style={{ fontSize:'11px', color:'rgba(255,255,255,.2)', fontFamily:'var(--mono)' }}>
              Ask to build → split view opens
            </span>
          )}
          {phase === 'build' && artifacts.length > 0 && (
            <span style={{ fontSize:'11px', color:'rgba(186,255,41,.4)', fontFamily:'var(--mono)' }}>
              {artifacts.length} artifact{artifacts.length > 1 ? 's' : ''} ready
            </span>
          )}
        </div>
        <Composer value={input} onChange={setInput} onSend={() => send()}
          model={model} onModelChange={setModel} compact files={files} />
      </div>
    </div>
  );

  if (phase === 'chat') return (
    <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column',
      overflow:'hidden', background:'var(--bg)' }}>
      {ChatPanel}
    </div>
  );

  /* ── BUILD phase — split view ── */
  return (
    <div style={{ flex:1, minHeight:0, display:'flex', overflow:'hidden', background:'var(--bg)' }}>
      {ChatPanel}

      {/* Drag divider */}
      <div onMouseDown={e => { dragging.current=true; startX.current=e.clientX; startW.current=leftW; e.preventDefault(); }}
        style={{ width:'3px', background:'rgba(255,255,255,.06)', cursor:'col-resize',
          flexShrink:0, zIndex:5, transition:'background .1s' }}
        onMouseEnter={e => e.currentTarget.style.background='#baff29'}
        onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.06)'} />

      {/* Artifact panel */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column' }}>
        {/* Tab bar */}
        <div style={{ display:'flex', alignItems:'stretch', borderBottom:'1px solid rgba(255,255,255,.07)',
          flexShrink:0, padding:'0 12px' }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              style={{ padding:'10px 14px', border:'none', background:'transparent',
                color: tab===i ? '#ffffff' : 'rgba(255,255,255,.35)',
                fontSize:'12px', fontWeight: tab===i ? '700' : '500', cursor:'pointer',
                fontFamily:'var(--font)', borderBottom:`2px solid ${tab===i?'#baff29':'transparent'}`,
                transition:'all .1s', marginBottom:'-1px' }}>
              {t === 'Terminal'
                ? <span style={{ color: tab===i ? '#ff2d8c' : 'rgba(255,255,255,.35)' }}>{t}</span>
                : t === 'Code'
                  ? <span style={{ color: tab===i ? '#ffd60a' : 'rgba(255,255,255,.35)' }}>{t}</span>
                  : t}
            </button>
          ))}
          <div style={{ marginLeft:'auto', display:'flex', gap:'6px', alignItems:'center' }}>
            {artifacts.length > 0 && (
              <span style={{ fontSize:'10.5px', color:'rgba(255,255,255,.25)', fontFamily:'var(--mono)' }}>
                {artifacts[0]?.name || artifacts[0]?.filename || 'artifact'}
              </span>
            )}
            <button onClick={loadArtifacts}
              style={{ padding:'4px 10px', border:'1px solid rgba(255,255,255,.1)', borderRadius:'2px',
                background:'transparent', color:'rgba(255,255,255,.4)', fontSize:'11px',
                cursor:'pointer', fontFamily:'var(--font)', transition:'all .1s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(255,255,255,.25)'; e.currentTarget.style.color='#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,.1)'; e.currentTarget.style.color='rgba(255,255,255,.4)'; }}>
              ↺
            </button>
            {artifactId && (
              <a href={`/api/artifact/${artifactId}`} target="_blank" rel="noreferrer"
                style={{ padding:'4px 10px', border:'1px solid rgba(186,255,41,.3)', borderRadius:'2px',
                  background:'transparent', color:'#baff29', fontSize:'11px', fontWeight:'700',
                  textDecoration:'none', fontFamily:'var(--font)', transition:'all .1s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(186,255,41,.1)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                ⤓ Export
              </a>
            )}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ flex:1, minHeight:0, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {tab === 0 && (
            artifactId
              ? <iframe src={`/api/artifact/${artifactId}/preview`} title="Artifact preview"
                  style={{ flex:1, border:'none', background:'#050505' }} />
              : <div style={{ flex:1, display:'grid', placeItems:'center', color:'rgba(255,255,255,.2)',
                  fontFamily:'var(--mono)', fontSize:'13px', textAlign:'center', padding:'40px' }}>
                  <div>
                    <div style={{ fontSize:'32px', marginBottom:'12px', opacity:.3 }}>📦</div>
                    <div>No artifact yet.</div>
                    <div style={{ fontSize:'11px', marginTop:'6px', opacity:.6 }}>Ask the AI to build something.</div>
                  </div>
                </div>
          )}
          {tab === 1 && (
            artifactCode
              ? <NeonCode code={artifactCode} />
              : <div style={{ flex:1, display:'grid', placeItems:'center', color:'rgba(255,255,255,.2)',
                  fontFamily:'var(--mono)', fontSize:'13px' }}>No code yet.</div>
          )}
          {tab === 2 && <NeonTerminal text={terminalText} />}
        </div>

        {/* Artifact list footer */}
        {artifacts.length > 1 && (
          <div style={{ borderTop:'1px solid rgba(255,255,255,.06)', padding:'8px 12px',
            display:'flex', gap:'6px', overflowX:'auto', flexShrink:0 }}>
            {artifacts.map((a, i) => {
              const id = a.id ?? i;
              const active = id === artifactId;
              return (
                <button key={id} onClick={() => {
                  setArtId(a.id);
                  fetch(`/api/artifact/${a.id}`).then(r => r.text()).then(t => setArtCode(t)).catch(() => {});
                }} style={{ flexShrink:0, padding:'4px 10px', borderRadius:'2px',
                  border:`1px solid ${active ? 'rgba(186,255,41,.4)' : 'rgba(255,255,255,.08)'}`,
                  background: active ? 'rgba(186,255,41,.08)' : 'transparent',
                  color: active ? '#baff29' : 'rgba(255,255,255,.4)',
                  fontSize:'11px', cursor:'pointer', fontFamily:'var(--mono)', whiteSpace:'nowrap' }}>
                  {a.name || a.filename || id}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { StudioView });
