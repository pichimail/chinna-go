/* StudioView v5 — Project management, scaffold, wizard, dev server, AI build */

/* ── Constants ──────────────────────────────────────────────────────────── */
const MODELS = [
  { id:'chinna/free',   label:'chinna/free',      sub:'Fast · Free',          badge:'FREE', color:'#baff29' },
  { id:'chinna/auto',   label:'chinna/auto',       sub:'Best for most tasks',  badge:'AUTO', color:'#5ac8fa' },
  { id:'chinna/reason', label:'chinna/reasoning',  sub:'Complex problems',     badge:'PRO',  color:'#ffc700' },
  { id:'claude-sonnet', label:'claude-3.5-sonnet', sub:'Anthropic flagship',   badge:null,   color:'#d54cff' },
  { id:'gpt-4o',        label:'gpt-4o',            sub:'OpenAI flagship',      badge:null,   color:'#0080ff' },
];

const STACKS = [
  { id:'auto',      label:'Auto Mode',    sub:'Best stack for your request',      color:'#baff29', icon:'✦' },
  { id:'react',     label:'React + Vite', sub:'Fast SPA, hot reload',             color:'#5ac8fa', icon:'⚛' },
  { id:'nextjs',    label:'Next.js 14',   sub:'SSR, API routes, App Router',      color:'#ffffff', icon:'▲' },
  { id:'html',      label:'Vanilla HTML', sub:'No framework, instant preview',    color:'#ffc700', icon:'◎' },
  { id:'python',    label:'Python / Flask',sub:'Backend API or script',           color:'#2edd5e', icon:'🐍' },
  { id:'svelte',    label:'SvelteKit',    sub:'Compiled, minimal JS',             color:'#ff3e00', icon:'⬡' },
];

const BUILD_TYPES = [
  { id:'landing',   icon:'🌐', label:'Landing Page',    sub:'Hero, features, CTA, animations',  color:'#0080ff' },
  { id:'dashboard', icon:'📊', label:'Dashboard',       sub:'Admin, analytics, data viz',        color:'#d54cff' },
  { id:'fullstack', icon:'⚡', label:'Full-Stack App',  sub:'API + frontend + auth + DB',        color:'#ffc700' },
  { id:'component', icon:'🎨', label:'UI Component',    sub:'Reusable, animated, exported',      color:'#baff29' },
  { id:'script',    icon:'🤖', label:'Script / API',    sub:'Python, Node, automation',          color:'#2edd5e' },
  { id:'enhance',   icon:'🔧', label:'Enhance Project', sub:'Bug fix, new feature, refactor',   color:'#ff8c00' },
];

const DASHBOARD_TYPES = [
  { id:'admin',    icon:'⚙️', label:'Admin Panel',      sub:'Users, roles, CRUD' },
  { id:'analytics',icon:'📈', label:'Analytics',        sub:'Charts, KPIs, trends' },
  { id:'saas',     icon:'☁️', label:'SaaS Dashboard',   sub:'Billing, usage, onboarding' },
  { id:'crm',      icon:'👥', label:'CRM',              sub:'Contacts, pipeline, deals' },
  { id:'ecommerce',icon:'🛒', label:'E-commerce',       sub:'Orders, products, revenue' },
  { id:'devops',   icon:'🚀', label:'DevOps / Infra',   sub:'Deployments, logs, metrics' },
];

const UI_LIBS = [
  { id:'shadcn',   label:'Shadcn/UI',    sub:'Radix + Tailwind, copy-paste components', color:'#ffffff' },
  { id:'tailwind', label:'Tailwind CSS', sub:'Utility-first, fully custom',              color:'#06b6d4' },
  { id:'antd',     label:'Ant Design',   sub:'Enterprise-grade, feature-rich',           color:'#1677ff' },
  { id:'chakra',   label:'Chakra UI',    sub:'Accessible, composable, themeable',        color:'#319795' },
];

const DASH_FEATURES = [
  '🌙 Dark mode', '🔐 Authentication', '📊 Charts (Recharts)', '📋 Data tables',
  '🔔 Notifications', '🔍 Global search', '💳 Billing/Stripe', '📱 Mobile responsive',
  '📁 File uploads', '⚙️ Settings page',
];

const CODE_TRIGGERS = ['build','create','generate','make','write','code','html','tsx',
  'component','landing','website','script','function','fix','debug','refactor','page','app','dashboard'];
const needsBuild = t => CODE_TRIGGERS.some(k => t.toLowerCase().includes(k));

/* ── NeonTerminal ─────────────────────────────────────────────────────────── */
function NeonTerminal({ text }) {
  const lines = (text || '').split('\n');
  const tokenize = (line) => {
    if (line.startsWith('$ ')) {
      const parts = line.slice(2).split(' ');
      return [{ t:'$ ',c:'#ff2d8c',w:'800' },{ t:parts[0]+' ',c:'#ffd60a',w:'700' },
        ...parts.slice(1).map(p => ({ t:p+' ',w:'500',c:p.startsWith('--')?'#5ac8fa':p.startsWith('-')?'#00e5ff':p.includes('/')?'#d54cff':'#fff' }))];
    }
    if (line.startsWith('> ')) return [{ t:'> ',c:'#00e5ff',w:'700' },{ t:line.slice(2),c:'rgba(255,255,255,.6)',w:'400' }];
    if (line.startsWith('✓')) return [{ t:'✓',c:'#2edd5e',w:'900' },{ t:line.slice(1),c:'rgba(255,255,255,.75)',w:'500' }];
    if (line.startsWith('✅')) return [{ t:line,c:'#2edd5e',w:'700' }];
    if (line.startsWith('✗') || line.toLowerCase().startsWith('error')) return [{ t:line,c:'#ff3333',w:'600' }];
    return [{ t:line,c:'rgba(255,255,255,.5)',w:'400' }];
  };
  return (
    <div style={{ fontFamily:'var(--mono)',fontSize:'11.5px',lineHeight:'1.85',padding:'16px 20px',overflowY:'auto',flex:1 }}>
      {lines.map((line, i) => (
        <div key={i} style={{ display:'flex',flexWrap:'wrap',minHeight:'1.85em' }}>
          {line === '' ? <span>&nbsp;</span> : tokenize(line).map((tok, j) =>
            <span key={j} style={{ color:tok.c,fontWeight:tok.w,whiteSpace:'pre' }}>{tok.t}</span>
          )}
        </div>
      ))}
      <span style={{ display:'inline-block',width:'8px',height:'14px',background:'#ff2d8c',marginLeft:'2px',verticalAlign:'middle',animation:'blink 1s step-end infinite' }}/>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes dot{0%,80%,100%{opacity:.25}40%{opacity:1}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ── NeonCode ─────────────────────────────────────────────────────────────── */
function NeonCode({ code }) {
  const html = (code || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/(&lt;!DOCTYPE[^&]*&gt;)/g,'<span style="color:#5ac8fa;font-weight:600">$1</span>')
    .replace(/(&lt;\/?)([\w-]+)/g,'<span style="color:rgba(255,255,255,.35)">$1</span><span style="color:#ff2d8c;font-weight:700">$2</span>')
    .replace(/\s([\w-]+)=/g,' <span style="color:#ffd60a;font-weight:600">$1</span>=')
    .replace(/"([^"]*)"/g,'<span style="color:#2edd5e">"$1"</span>')
    .replace(/(\/\/[^\n]*)/g,'<span style="color:rgba(255,255,255,.28);font-style:italic">$1</span>')
    .replace(/\b(\d+(?:px|em|rem|%|ms|s)?)\b/g,'<span style="color:#d54cff;font-weight:600">$1</span>');
  return (
    <div style={{ fontFamily:'var(--mono)',fontSize:'11.5px',lineHeight:'1.75',padding:'16px 20px',overflowY:'auto',flex:1,overflowX:'auto' }}>
      <pre style={{ margin:0,whiteSpace:'pre-wrap',wordBreak:'break-all' }} dangerouslySetInnerHTML={{ __html: html }}/>
    </div>
  );
}

/* ── ModelPicker ──────────────────────────────────────────────────────────── */
function ModelPicker({ model, onSelect }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  const cur = MODELS.find(m => m.id === model) || MODELS[0];
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display:'flex',alignItems:'center',gap:'6px',padding:'5px 10px',borderRadius:'20px',border:`1px solid ${cur.color}44`,background:'transparent',color:cur.color,fontSize:'11.5px',fontWeight:'700',cursor:'pointer',fontFamily:'var(--mono)',whiteSpace:'nowrap' }}>
        <span style={{ width:'6px',height:'6px',borderRadius:'50%',background:cur.color,boxShadow:`0 0 6px ${cur.color}`,flexShrink:0 }}/>
        {cur.label} <span style={{ opacity:.5,fontSize:'9px' }}>▾</span>
      </button>
      {open && (
        <div style={{ position:'absolute',bottom:'calc(100% + 8px)',left:0,zIndex:300,background:'rgba(0,0,0,.97)',border:'1px solid rgba(255,255,255,.12)',borderRadius:'8px',boxShadow:'0 24px 64px rgba(0,0,0,.9)',minWidth:'240px',overflow:'hidden' }}>
          {MODELS.map(m => (
            <div key={m.id} onClick={() => { onSelect(m.id); setOpen(false); }}
              style={{ display:'flex',alignItems:'center',gap:'10px',padding:'10px 14px',cursor:'pointer',borderLeft:`2px solid ${model===m.id?m.color:'transparent'}`,background:model===m.id?`${m.color}0d`:'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.background=`${m.color}0d`; e.currentTarget.style.borderLeftColor=m.color; }}
              onMouseLeave={e => { e.currentTarget.style.background=model===m.id?`${m.color}0d`:'transparent'; e.currentTarget.style.borderLeftColor=model===m.id?m.color:'transparent'; }}>
              <span style={{ width:'7px',height:'7px',borderRadius:'50%',background:model===m.id?m.color:'rgba(255,255,255,.18)',boxShadow:model===m.id?`0 0 7px ${m.color}`:undefined,flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'12.5px',fontWeight:'700',color:model===m.id?m.color:'rgba(255,255,255,.85)',fontFamily:'var(--mono)' }}>{m.label}</div>
                <div style={{ fontSize:'10.5px',color:'rgba(255,255,255,.35)',marginTop:'1px' }}>{m.sub}</div>
              </div>
              {m.badge && <span style={{ fontSize:'9px',fontWeight:'800',padding:'2px 6px',border:`1px solid ${m.color}44`,borderRadius:'2px',color:m.color,background:`${m.color}10` }}>{m.badge}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── StackPicker ──────────────────────────────────────────────────────────── */
function StackPicker({ value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  const cur = STACKS.find(s => s.id === value) || STACKS[0];
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display:'flex',alignItems:'center',gap:'6px',padding:'5px 12px',borderRadius:'20px',border:`1px solid ${cur.color}33`,background:'transparent',color:'rgba(255,255,255,.6)',fontSize:'11px',fontWeight:'600',cursor:'pointer',fontFamily:'var(--font)',whiteSpace:'nowrap' }}>
        <span style={{ fontSize:'13px' }}>{cur.icon}</span>
        {cur.label}
        <span style={{ opacity:.4,fontSize:'9px' }}>▾</span>
      </button>
      {open && (
        <div style={{ position:'absolute',bottom:'calc(100% + 8px)',left:0,zIndex:300,background:'rgba(0,0,0,.97)',border:'1px solid rgba(255,255,255,.12)',borderRadius:'8px',boxShadow:'0 24px 64px rgba(0,0,0,.9)',minWidth:'220px',overflow:'hidden' }}>
          {STACKS.map(s => (
            <div key={s.id} onClick={() => { onChange(s.id); setOpen(false); }}
              style={{ display:'flex',alignItems:'center',gap:'10px',padding:'9px 14px',cursor:'pointer',background:value===s.id?`${s.color}0d`:'transparent',borderLeft:`2px solid ${value===s.id?s.color:'transparent'}` }}
              onMouseEnter={e => { e.currentTarget.style.background=`${s.color}0d`; e.currentTarget.style.borderLeftColor=s.color; }}
              onMouseLeave={e => { e.currentTarget.style.background=value===s.id?`${s.color}0d`:'transparent'; e.currentTarget.style.borderLeftColor=value===s.id?s.color:'transparent'; }}>
              <span style={{ fontSize:'14px',flexShrink:0 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize:'12px',fontWeight:'700',color:value===s.id?s.color:'rgba(255,255,255,.85)' }}>{s.label}</div>
                <div style={{ fontSize:'10px',color:'rgba(255,255,255,.3)',marginTop:'1px' }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── ToolBlock ────────────────────────────────────────────────────────────── */
function ToolBlock({ tool, input: inp, status, result }) {
  const [open, setOpen] = React.useState(true);
  const label = tool || 'tool';
  const cmd = typeof inp === 'string' ? inp : inp ? JSON.stringify(inp).slice(0,80) : '';
  const out = result ? (typeof result === 'string' ? result : JSON.stringify(result, null, 2)) : '';
  return (
    <div style={{ border:'1px solid rgba(96,165,250,.2)',borderRadius:'6px',overflow:'hidden',margin:'4px 0 6px' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display:'flex',alignItems:'center',gap:'8px',padding:'7px 10px',cursor:'pointer',background:'rgba(96,165,250,.05)' }}>
        <span style={{ fontSize:'9px',fontWeight:'800',letterSpacing:'1px',textTransform:'uppercase',padding:'2px 7px',borderRadius:'2px',color:status==='done'?'#2edd5e':'#60a5fa',border:`1px solid ${status==='done'?'rgba(46,221,94,.3)':'rgba(96,165,250,.3)'}` }}>{label}</span>
        <code style={{ fontSize:'11px',color:'rgba(255,255,255,.45)',fontFamily:'var(--mono)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{cmd}</code>
        <span style={{ fontSize:'10px',color:status==='done'?'#2edd5e':'#60a5fa' }}>{status==='done'?'✓':'⟳'}</span>
      </div>
      {open && out && (
        <pre style={{ fontFamily:'var(--mono)',fontSize:'11px',padding:'8px 12px',margin:0,lineHeight:'1.7',maxHeight:'90px',overflowY:'auto',whiteSpace:'pre-wrap',color:status==='done'?'#2edd5e':'#60a5fa' }}>{out.slice(0,400)}{out.length>400?'\n…':''}</pre>
      )}
    </div>
  );
}

/* ── Composer ─────────────────────────────────────────────────────────────── */
function Composer({ value, onChange, onSend, model, onModelChange, stack, onStackChange, compact, placeholder, files, onAttach }) {
  const [focused, setFocused] = React.useState(false);
  const glow = focused
    ? { borderColor:'rgba(186,255,41,.5)',boxShadow:'0 0 0 1px rgba(186,255,41,.2),0 0 24px rgba(186,255,41,.1)' }
    : { borderColor:'rgba(255,255,255,.1)' };
  return (
    <div style={{ width:'100%',position:'relative' }}>
      <div style={{ background:'rgba(255,255,255,.03)',border:'1px solid',borderRadius:'12px',overflow:'visible',transition:'border-color .15s,box-shadow .15s',...glow }}>
        <textarea aria-label="Prompt" value={value} onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder={placeholder || 'Ask Chinna — chat · build · run · debug…'}
          rows={compact ? 2 : 3}
          style={{ width:'100%',background:'none',border:'none',outline:'none',color:'#fff',fontSize:'14px',fontFamily:'var(--font)',resize:'none',lineHeight:'1.6',padding:compact?'12px 14px 6px':'16px 16px 8px',maxHeight:'200px',overflow:'auto',display:'block',caretColor:'#baff29' }}/>
        {files && files.length > 0 && (
          <div style={{ display:'flex',gap:'6px',flexWrap:'wrap',padding:'0 14px 6px' }}>
            {files.map((f,i) => (
              <span key={i} style={{ display:'inline-flex',alignItems:'center',gap:'5px',padding:'2px 8px',border:'1px solid rgba(186,255,41,.3)',borderRadius:'20px',fontSize:'11px',color:'#baff29',background:'rgba(186,255,41,.08)' }}>
                📎 {f.name}
              </span>
            ))}
          </div>
        )}
        <div style={{ display:'flex',alignItems:'center',gap:'8px',padding:compact?'6px 10px':'8px 12px',borderTop:'1px solid rgba(255,255,255,.07)',flexWrap:'wrap' }}>
          <ModelPicker model={model} onSelect={onModelChange} />
          {!compact && <StackPicker value={stack} onChange={onStackChange} />}
          <button onClick={() => onAttach?.()}
            style={{ width:'28px',height:'28px',borderRadius:'6px',border:'1px solid rgba(255,255,255,.1)',background:'transparent',color:'rgba(255,255,255,.5)',display:'grid',placeItems:'center',cursor:'pointer',fontSize:'16px',fontWeight:'300',transition:'all .1s' }}>
            +
          </button>
          <span style={{ fontSize:'10.5px',color:'rgba(255,255,255,.2)',marginLeft:'auto',fontFamily:'var(--mono)' }}>↵ send · ⇧↵ newline</span>
          <button aria-label="Send" onClick={onSend}
            style={{ width:'32px',height:'32px',borderRadius:'8px',flexShrink:0,background:value.trim()?'#baff29':'transparent',color:value.trim()?'#030a00':'rgba(255,255,255,.25)',border:value.trim()?'none':'1px solid rgba(255,255,255,.1)',fontSize:'16px',display:'grid',placeItems:'center',cursor:'pointer',transition:'all .15s',fontWeight:'900',boxShadow:value.trim()?'0 0 16px rgba(186,255,41,.3)':undefined }}>↑</button>
        </div>
      </div>
    </div>
  );
}

/* ── DashboardWizard ──────────────────────────────────────────────────────── */
function DashboardWizard({ onConfirm, onCancel }) {
  const [step, setStep] = React.useState(0);
  const [dashType, setDashType] = React.useState('');
  const [uiLib, setUiLib] = React.useState('shadcn');
  const [features, setFeatures] = React.useState(['🌙 Dark mode', '📱 Mobile responsive']);
  const [customDesc, setCustomDesc] = React.useState('');

  function toggleFeature(f) {
    setFeatures(fs => fs.includes(f) ? fs.filter(x => x !== f) : [...fs, f]);
  }

  function buildPrompt() {
    const type = DASHBOARD_TYPES.find(d => d.id === dashType) || { label: 'custom', sub: '' };
    const lib = UI_LIBS.find(l => l.id === uiLib) || UI_LIBS[0];
    const feats = features.map(f => f.replace(/^[^ ]+ /, '')).join(', ');
    return `Build a production-ready ${type.label} dashboard using ${lib.label} (${lib.sub}). Include: ${feats}. ${customDesc ? 'Additional requirements: ' + customDesc + '.' : ''} Make it visually stunning with a dark theme, smooth animations, and professional data visualization. Generate complete, working code with realistic placeholder data. Stack: React + Vite + TypeScript.`;
  }

  const steps = [
    { title: 'Dashboard Type', sub: 'What kind of dashboard?' },
    { title: 'UI Library', sub: 'Choose your component library' },
    { title: 'Features', sub: 'Select features to include' },
    { title: 'Confirm', sub: 'Review and generate' },
  ];

  return (
    <div style={{ position:'fixed',inset:0,zIndex:999,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(12px)' }} onClick={onCancel}>
      <div style={{ background:'rgba(6,8,4,.98)',border:'1px solid rgba(255,255,255,.12)',borderRadius:'12px',padding:'28px',maxWidth:'560px',width:'90%',maxHeight:'90vh',overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        {/* Progress */}
        <div style={{ display:'flex',gap:'4px',marginBottom:'24px' }}>
          {steps.map((s, i) => (
            <div key={i} style={{ flex:1,height:'2px',background:i <= step ? '#baff29' : 'rgba(255,255,255,.1)',borderRadius:'1px',transition:'background .2s' }}/>
          ))}
        </div>
        <div style={{ marginBottom:'20px' }}>
          <div style={{ fontSize:'9px',fontWeight:'800',letterSpacing:'2px',textTransform:'uppercase',color:'#d54cff',marginBottom:'6px' }}>DASHBOARD WIZARD · STEP {step + 1}</div>
          <div style={{ fontSize:'20px',fontWeight:'900',color:'#fff',marginBottom:'4px' }}>{steps[step].title}</div>
          <div style={{ fontSize:'13px',color:'rgba(255,255,255,.4)' }}>{steps[step].sub}</div>
        </div>

        {/* Step 0: Type */}
        {step === 0 && (
          <div style={{ display:'grid',gridTemplateColumns:'repeat(2, 1fr)',gap:'8px' }}>
            {DASHBOARD_TYPES.map(d => (
              <div key={d.id} onClick={() => setDashType(d.id)}
                style={{ padding:'14px',border:`1px solid ${dashType===d.id?'rgba(213,76,255,.5)':'rgba(255,255,255,.08)'}`,borderRadius:'8px',cursor:'pointer',background:dashType===d.id?'rgba(213,76,255,.08)':'transparent',transition:'all .1s' }}
                onMouseEnter={e => { if (dashType !== d.id) e.currentTarget.style.borderColor='rgba(255,255,255,.18)'; }}
                onMouseLeave={e => { if (dashType !== d.id) e.currentTarget.style.borderColor='rgba(255,255,255,.08)'; }}>
                <div style={{ fontSize:'22px',marginBottom:'6px' }}>{d.icon}</div>
                <div style={{ fontSize:'13px',fontWeight:'700',color:dashType===d.id?'#d54cff':'rgba(255,255,255,.85)' }}>{d.label}</div>
                <div style={{ fontSize:'10px',color:'rgba(255,255,255,.35)',marginTop:'2px' }}>{d.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Step 1: UI Library */}
        {step === 1 && (
          <div style={{ display:'flex',flexDirection:'column',gap:'8px' }}>
            {UI_LIBS.map(lib => (
              <div key={lib.id} onClick={() => setUiLib(lib.id)}
                style={{ display:'flex',alignItems:'center',gap:'12px',padding:'12px 14px',border:`1px solid ${uiLib===lib.id?`${lib.color}44`:'rgba(255,255,255,.08)'}`,borderRadius:'8px',cursor:'pointer',background:uiLib===lib.id?`${lib.color}08`:'transparent',transition:'all .1s' }}>
                <div style={{ width:'8px',height:'8px',borderRadius:'50%',background:uiLib===lib.id?lib.color:'rgba(255,255,255,.2)',flexShrink:0,boxShadow:uiLib===lib.id?`0 0 6px ${lib.color}`:undefined }}/>
                <div>
                  <div style={{ fontSize:'13px',fontWeight:'700',color:uiLib===lib.id?lib.color:'rgba(255,255,255,.85)' }}>{lib.label}</div>
                  <div style={{ fontSize:'10.5px',color:'rgba(255,255,255,.35)' }}>{lib.sub}</div>
                </div>
                {uiLib === lib.id && <span style={{ marginLeft:'auto',fontSize:'12px',color:lib.color }}>✓</span>}
              </div>
            ))}
          </div>
        )}

        {/* Step 2: Features */}
        {step === 2 && (
          <div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'16px' }}>
              {DASH_FEATURES.map(f => {
                const sel = features.includes(f);
                return (
                  <button key={f} onClick={() => toggleFeature(f)}
                    style={{ padding:'6px 12px',border:`1px solid ${sel?'rgba(186,255,41,.4)':'rgba(255,255,255,.1)'}`,borderRadius:'20px',background:sel?'rgba(186,255,41,.08)':'transparent',color:sel?'#baff29':'rgba(255,255,255,.55)',fontSize:'11.5px',fontWeight:sel?'700':'500',cursor:'pointer',transition:'all .1s' }}>
                    {f}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop:'8px' }}>
              <div style={{ fontSize:'11px',color:'rgba(255,255,255,.35)',marginBottom:'6px' }}>Any additional requirements?</div>
              <textarea value={customDesc} onChange={e => setCustomDesc(e.target.value)} placeholder="e.g. Multi-tenant, real-time updates, export to PDF…"
                style={{ width:'100%',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.1)',borderRadius:'6px',color:'#fff',fontSize:'12px',padding:'10px 12px',outline:'none',resize:'vertical',minHeight:'72px',fontFamily:'var(--font)' }}/>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div>
            <div style={{ background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:'8px',padding:'14px',marginBottom:'16px' }}>
              <div style={{ fontSize:'10px',color:'rgba(255,255,255,.35)',marginBottom:'8px',fontWeight:'700',letterSpacing:'1px',textTransform:'uppercase' }}>Generated Prompt</div>
              <div style={{ fontSize:'12px',color:'rgba(255,255,255,.8)',lineHeight:'1.7',fontFamily:'var(--mono)' }}>{buildPrompt()}</div>
            </div>
            <div style={{ display:'flex',gap:'6px',flexWrap:'wrap' }}>
              <div style={{ padding:'4px 10px',border:'1px solid rgba(213,76,255,.3)',borderRadius:'4px',fontSize:'11px',color:'#d54cff' }}>
                {DASHBOARD_TYPES.find(d => d.id === dashType)?.label || 'Dashboard'}
              </div>
              <div style={{ padding:'4px 10px',border:'1px solid rgba(255,255,255,.1)',borderRadius:'4px',fontSize:'11px',color:'rgba(255,255,255,.6)' }}>
                {UI_LIBS.find(l => l.id === uiLib)?.label}
              </div>
              <div style={{ padding:'4px 10px',border:'1px solid rgba(186,255,41,.2)',borderRadius:'4px',fontSize:'11px',color:'rgba(186,255,41,.8)' }}>
                {features.length} features
              </div>
            </div>
          </div>
        )}

        {/* Nav buttons */}
        <div style={{ display:'flex',gap:'8px',marginTop:'20px',justifyContent:'flex-end' }}>
          <button onClick={onCancel} style={{ padding:'8px 16px',background:'transparent',border:'1px solid rgba(255,255,255,.12)',borderRadius:'6px',color:'rgba(255,255,255,.5)',fontSize:'12px',cursor:'pointer' }}>Cancel</button>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{ padding:'8px 16px',background:'transparent',border:'1px solid rgba(255,255,255,.12)',borderRadius:'6px',color:'rgba(255,255,255,.7)',fontSize:'12px',cursor:'pointer' }}>← Back</button>
          )}
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={step === 0 && !dashType}
              style={{ padding:'8px 20px',background:step===0&&!dashType?'rgba(186,255,41,.15)':'#baff29',border:'none',borderRadius:'6px',color:step===0&&!dashType?'rgba(186,255,41,.4)':'#030a00',fontSize:'12px',fontWeight:'700',cursor:step===0&&!dashType?'default':'pointer',transition:'all .15s' }}>
              Next →
            </button>
          ) : (
            <button onClick={() => onConfirm(buildPrompt())}
              style={{ padding:'8px 20px',background:'#d54cff',border:'none',borderRadius:'6px',color:'#fff',fontSize:'12px',fontWeight:'700',cursor:'pointer',boxShadow:'0 0 16px rgba(213,76,255,.3)' }}>
              ✦ Generate Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── ScaffoldPanel ────────────────────────────────────────────────────────── */
function ScaffoldPanel({ project, onClose, onScaffold }) {
  const [presets, setPresets] = React.useState([]);
  const [busyId, setBusyId] = React.useState(null);
  const [jobs, setJobs] = React.useState({});

  React.useEffect(() => {
    fetch('/api/studio/scaffold/presets').then(r => r.json()).then(d => setPresets(d.presets ?? [])).catch(() => {});
  }, []);

  async function applyPreset(presetId, presetName) {
    setBusyId(presetId);
    try {
      const d = await fetch('/api/studio/scaffold', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: project.path, preset: presetId }),
      }).then(r => r.json());
      if (d.job) {
        setJobs(j => ({ ...j, [presetId]: { id: d.job, status: 'running' } }));
        pollJob(d.job, presetId);
      }
    } catch {}
    setBusyId(null);
  }

  function pollJob(jid, presetId) {
    const interval = setInterval(async () => {
      try {
        const d = await fetch(`/api/job?id=${jid}`).then(r => r.json());
        setJobs(j => ({ ...j, [presetId]: { id: jid, status: d.done ? (d.ok ? 'done' : 'error') : 'running', lines: d.lines } }));
        if (d.done) clearInterval(interval);
      } catch { clearInterval(interval); }
    }, 1200);
  }

  return (
    <div style={{ position:'fixed',inset:0,zIndex:998,background:'rgba(0,0,0,.8)',display:'flex',alignItems:'flex-end',justifyContent:'flex-end' }} onClick={onClose}>
      <div style={{ width:'380px',height:'100%',background:'rgba(6,8,4,.98)',borderLeft:'1px solid rgba(255,255,255,.1)',padding:'20px',overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px' }}>
          <div>
            <div style={{ fontSize:'9px',fontWeight:'800',letterSpacing:'2px',textTransform:'uppercase',color:'#ffc700',marginBottom:'4px' }}>SCAFFOLD</div>
            <div style={{ fontSize:'16px',fontWeight:'900',color:'#fff' }}>Install Dependencies</div>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',color:'rgba(255,255,255,.4)',cursor:'pointer',fontSize:'18px' }}>×</button>
        </div>
        <div style={{ fontSize:'11px',color:'rgba(255,255,255,.35)',marginBottom:'16px',fontFamily:'var(--mono)',wordBreak:'break-all' }}>
          {project.path.replace(process?.env?.HOME || '/Users/', '~/')}
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:'8px' }}>
          {presets.map(p => {
            const j = jobs[p.id];
            const running = j?.status === 'running';
            const done = j?.status === 'done';
            const err = j?.status === 'error';
            return (
              <div key={p.id} style={{ border:`1px solid ${done?'rgba(46,221,94,.25)':err?'rgba(255,51,51,.2)':'rgba(255,255,255,.08)'}`,borderRadius:'8px',padding:'12px',background:done?'rgba(46,221,94,.04)':'transparent' }}>
                <div style={{ display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px' }}>
                  <div style={{ width:'28px',height:'28px',borderRadius:'6px',border:`1px solid ${p.color}33`,background:`${p.color}0a`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',flexShrink:0 }}>{p.icon}</div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:'12px',fontWeight:'700',color:done?'#2edd5e':'rgba(255,255,255,.85)' }}>{p.name}</div>
                    <div style={{ fontSize:'10px',color:'rgba(255,255,255,.35)' }}>{p.description}</div>
                  </div>
                  {done && <span style={{ color:'#2edd5e',fontSize:'14px' }}>✓</span>}
                </div>
                {j?.lines && j.lines.length > 0 && (
                  <div style={{ background:'rgba(0,0,0,.4)',borderRadius:'4px',padding:'6px 8px',marginBottom:'8px',maxHeight:'60px',overflowY:'auto' }}>
                    {j.lines.slice(-3).map((l, i) => (
                      <div key={i} style={{ fontSize:'10px',fontFamily:'var(--mono)',color:l.includes('✓')||l.includes('✅')?'#2edd5e':l.includes('✗')||l.includes('error')?'#ff3333':'rgba(255,255,255,.5)' }}>{l}</div>
                    ))}
                  </div>
                )}
                <button onClick={() => applyPreset(p.id, p.name)} disabled={running || done || busyId === p.id}
                  style={{ width:'100%',padding:'6px',border:`1px solid ${done?'rgba(46,221,94,.2)':p.color+'33'}`,borderRadius:'4px',background:'transparent',color:done?'#2edd5e':p.color,fontSize:'11px',fontWeight:'700',cursor:running||done?'default':'pointer',opacity:running?0.7:1,transition:'all .1s' }}>
                  {running ? '⟳ Installing…' : done ? '✓ Installed' : err ? '↺ Retry' : '▶ Install'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── ProjectPanel ─────────────────────────────────────────────────────────── */
function ProjectPanel({ projects, activeProject, onSelect, onRefresh, onUnlink, devStatus, onStartDev, onStopDev, onShowScaffold, onOpenInFinder }) {
  const [addMode, setAddMode] = React.useState(null); // 'clone'|'link-url'|null
  const [cloneUrl, setCloneUrl] = React.useState('');
  const [linkPath, setLinkPath] = React.useState('');
  const [cloneJob, setCloneJob] = React.useState(null);
  const [cloneLog, setCloneLog] = React.useState([]);
  const [openTree, setOpenTree] = React.useState(null);
  const [tree, setTree] = React.useState([]);

  async function doClone() {
    if (!cloneUrl.trim()) return;
    try {
      const d = await fetch('/api/studio/clone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cloneUrl.trim() }),
      }).then(r => r.json());
      if (d.job) {
        setCloneJob(d.job);
        setCloneLog(['Cloning…']);
        pollClone(d.job);
      }
    } catch { setCloneLog(['✗ Request failed']); }
  }

  function pollClone(jid) {
    const iv = setInterval(async () => {
      try {
        const d = await fetch(`/api/job?id=${jid}`).then(r => r.json());
        setCloneLog(d.lines || []);
        if (d.done) {
          clearInterval(iv);
          if (d.ok) { setAddMode(null); setCloneUrl(''); onRefresh(); }
        }
      } catch { clearInterval(iv); }
    }, 1000);
  }

  async function doPicker() {
    try {
      const d = await fetch('/api/studio/open-picker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.json());
      if (d.ok && d.path) {
        await fetch('/api/studio/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: d.path, name: d.name }) }).then(r => r.json());
        onRefresh();
        setAddMode(null);
      }
    } catch {}
  }

  async function doLink() {
    if (!linkPath.trim()) return;
    try {
      await fetch('/api/studio/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: linkPath.trim() }) }).then(r => r.json());
      onRefresh(); setAddMode(null); setLinkPath('');
    } catch {}
  }

  async function loadTree(path) {
    if (openTree === path) { setOpenTree(null); return; }
    try {
      const d = await fetch(`/api/studio/project/tree?path=${encodeURIComponent(path)}&depth=2`).then(r => r.json());
      setTree(d.tree ?? []);
      setOpenTree(path);
    } catch {}
  }

  const DS = devStatus[activeProject?.path] || {};

  return (
    <div style={{ width:'230px',flexShrink:0,display:'flex',flexDirection:'column',borderRight:'1px solid rgba(255,255,255,.07)',background:'rgba(0,0,0,.3)' }}>
      {/* Header */}
      <div style={{ padding:'12px 12px 8px',borderBottom:'1px solid rgba(255,255,255,.07)',flexShrink:0 }}>
        <div style={{ fontSize:'8px',fontWeight:'800',letterSpacing:'2px',textTransform:'uppercase',color:'rgba(186,255,41,.6)',marginBottom:'8px' }}>PROJECTS</div>
        <div style={{ display:'flex',gap:'4px' }}>
          <button onClick={() => setAddMode(addMode === 'clone' ? null : 'clone')}
            style={{ flex:1,padding:'5px 6px',border:`1px solid ${addMode==='clone'?'rgba(186,255,41,.4)':'rgba(255,255,255,.1)'}`,borderRadius:'4px',background:addMode==='clone'?'rgba(186,255,41,.06)':'transparent',color:addMode==='clone'?'#baff29':'rgba(255,255,255,.5)',fontSize:'10px',fontWeight:'700',cursor:'pointer' }}>
            ◆ Clone
          </button>
          <button onClick={doPicker}
            style={{ flex:1,padding:'5px 6px',border:'1px solid rgba(255,255,255,.1)',borderRadius:'4px',background:'transparent',color:'rgba(255,255,255,.5)',fontSize:'10px',fontWeight:'700',cursor:'pointer' }}>
            📁 Import
          </button>
          <button onClick={() => setAddMode(addMode === 'link' ? null : 'link')}
            style={{ padding:'5px 8px',border:'1px solid rgba(255,255,255,.08)',borderRadius:'4px',background:'transparent',color:'rgba(255,255,255,.35)',fontSize:'10px',cursor:'pointer' }}>
            ⊕
          </button>
        </div>
      </div>

      {/* Clone form */}
      {addMode === 'clone' && (
        <div style={{ padding:'10px 12px',borderBottom:'1px solid rgba(255,255,255,.07)',background:'rgba(186,255,41,.03)',flexShrink:0 }}>
          <input value={cloneUrl} onChange={e => setCloneUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doClone()}
            placeholder="github.com/user/repo"
            style={{ width:'100%',background:'rgba(0,0,0,.4)',border:'1px solid rgba(186,255,41,.2)',borderRadius:'4px',color:'#fff',fontSize:'11px',padding:'6px 8px',outline:'none',fontFamily:'var(--mono)',marginBottom:'6px' }}/>
          {cloneLog.length > 0 && (
            <div style={{ background:'rgba(0,0,0,.5)',borderRadius:'3px',padding:'5px 7px',marginBottom:'6px',maxHeight:'60px',overflowY:'auto' }}>
              {cloneLog.slice(-3).map((l, i) => (
                <div key={i} style={{ fontSize:'9.5px',fontFamily:'var(--mono)',color:l.includes('✓')||l.includes('✅')?'#2edd5e':l.includes('✗')?'#ff3333':'rgba(255,255,255,.5)',lineHeight:'1.5' }}>{l}</div>
              ))}
            </div>
          )}
          <button onClick={doClone} disabled={!cloneUrl.trim() || !!cloneJob}
            style={{ width:'100%',padding:'5px',background:'rgba(186,255,41,.12)',border:'1px solid rgba(186,255,41,.3)',borderRadius:'4px',color:'#baff29',fontSize:'11px',fontWeight:'700',cursor:'pointer' }}>
            {cloneJob ? '⟳ Cloning…' : '↓ Clone'}
          </button>
        </div>
      )}

      {/* Link form */}
      {addMode === 'link' && (
        <div style={{ padding:'10px 12px',borderBottom:'1px solid rgba(255,255,255,.07)',background:'rgba(213,76,255,.03)',flexShrink:0 }}>
          <input value={linkPath} onChange={e => setLinkPath(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doLink()}
            placeholder="~/projects/myapp"
            style={{ width:'100%',background:'rgba(0,0,0,.4)',border:'1px solid rgba(213,76,255,.2)',borderRadius:'4px',color:'#fff',fontSize:'11px',padding:'6px 8px',outline:'none',fontFamily:'var(--mono)',marginBottom:'6px' }}/>
          <button onClick={doLink} disabled={!linkPath.trim()}
            style={{ width:'100%',padding:'5px',background:'rgba(213,76,255,.1)',border:'1px solid rgba(213,76,255,.3)',borderRadius:'4px',color:'#d54cff',fontSize:'11px',fontWeight:'700',cursor:'pointer' }}>
            ⊕ Link Folder
          </button>
        </div>
      )}

      {/* Project list */}
      <div style={{ flex:1,overflowY:'auto' }}>
        {projects.length === 0 ? (
          <div style={{ padding:'24px 12px',textAlign:'center',color:'rgba(255,255,255,.25)',fontSize:'11px',lineHeight:'1.7' }}>
            <div style={{ fontSize:'24px',marginBottom:'8px',opacity:.3 }}>◈</div>
            Clone a repo or import a folder to get started
          </div>
        ) : projects.map((proj, i) => {
          const isActive = activeProject?.path === proj.path;
          const ds = devStatus[proj.path] || {};
          return (
            <div key={i}>
              <div onClick={() => onSelect(proj)}
                style={{ padding:'9px 12px',cursor:'pointer',borderLeft:`2px solid ${isActive?'#baff29':'transparent'}`,background:isActive?'rgba(186,255,41,.04)':'transparent',transition:'all .1s' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background='rgba(255,255,255,.03)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background='transparent'; }}>
                <div style={{ display:'flex',alignItems:'center',gap:'6px' }}>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:'12px',fontWeight:isActive?'700':'500',color:isActive?'#baff29':'rgba(255,255,255,.8)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{proj.name}</div>
                    <div style={{ fontSize:'9px',color:'rgba(255,255,255,.3)',marginTop:'1px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:'var(--mono)' }}>
                      {(proj.stacks||[]).slice(0,2).join(' · ') || proj.source || '—'}
                    </div>
                  </div>
                  {ds.running && <span style={{ width:'6px',height:'6px',borderRadius:'50%',background:'#2edd5e',boxShadow:'0 0 4px #2edd5e',flexShrink:0 }}/>}
                  {!proj.exists && <span style={{ fontSize:'9px',color:'#ff3333' }}>✗</span>}
                </div>
              </div>
              {/* Active project actions */}
              {isActive && (
                <div style={{ padding:'0 12px 8px',borderLeft:'2px solid #baff29',background:'rgba(186,255,41,.04)' }}>
                  <div style={{ display:'flex',flexWrap:'wrap',gap:'4px' }}>
                    {!ds.running ? (
                      <button onClick={() => onStartDev(proj)} style={{ padding:'3px 7px',border:'1px solid rgba(46,221,94,.3)',borderRadius:'3px',background:'transparent',color:'#2edd5e',fontSize:'9px',fontWeight:'700',cursor:'pointer' }}>▶ Dev</button>
                    ) : (
                      <button onClick={() => onStopDev(proj)} style={{ padding:'3px 7px',border:'1px solid rgba(255,51,51,.3)',borderRadius:'3px',background:'transparent',color:'#ff3333',fontSize:'9px',fontWeight:'700',cursor:'pointer' }}>◼ Stop</button>
                    )}
                    {ds.port && (
                      <button onClick={() => window.open(`http://localhost:${ds.port}`, '_blank')} style={{ padding:'3px 7px',border:'1px solid rgba(90,200,250,.3)',borderRadius:'3px',background:'transparent',color:'#5ac8fa',fontSize:'9px',fontWeight:'700',cursor:'pointer' }}>⊙ :{ds.port}</button>
                    )}
                    <button onClick={() => onShowScaffold(proj)} style={{ padding:'3px 7px',border:'1px solid rgba(255,199,0,.3)',borderRadius:'3px',background:'transparent',color:'#ffc700',fontSize:'9px',fontWeight:'700',cursor:'pointer' }}>⬡ Scaffold</button>
                    <button onClick={() => loadTree(proj.path)} style={{ padding:'3px 7px',border:'1px solid rgba(255,255,255,.1)',borderRadius:'3px',background:'transparent',color:'rgba(255,255,255,.4)',fontSize:'9px',cursor:'pointer' }}>{openTree===proj.path?'▲ Tree':'▼ Tree'}</button>
                    <button onClick={() => onOpenInFinder(proj)} style={{ padding:'3px 7px',border:'1px solid rgba(255,255,255,.1)',borderRadius:'3px',background:'transparent',color:'rgba(255,255,255,.35)',fontSize:'9px',cursor:'pointer' }}>⌐ Finder</button>
                    <button onClick={() => onUnlink(proj)} style={{ padding:'3px 7px',border:'1px solid rgba(255,51,51,.2)',borderRadius:'3px',background:'transparent',color:'rgba(255,51,51,.5)',fontSize:'9px',cursor:'pointer' }}>unlink</button>
                  </div>
                </div>
              )}
              {/* File tree */}
              {openTree === proj.path && isActive && tree.length > 0 && (
                <div style={{ padding:'4px 0 8px 14px',borderLeft:'2px solid #baff29',background:'rgba(186,255,41,.02)',maxHeight:'220px',overflowY:'auto' }}>
                  {tree.filter(f => f.depth < 3).map((f, fi) => (
                    <div key={fi} style={{ display:'flex',alignItems:'center',gap:'5px',padding:'1px 0',paddingLeft:f.depth * 10 + 4,opacity:f.type==='dir'?0.9:0.6 }}>
                      <span style={{ fontSize:'9px',color:f.type==='dir'?'#ffc700':'rgba(255,255,255,.4)',flexShrink:0 }}>{f.type==='dir'?'▸':'·'}</span>
                      <span style={{ fontSize:'10px',color:f.type==='dir'?'rgba(255,199,0,.8)':'rgba(255,255,255,.5)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:'var(--mono)' }}>{f.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main StudioView ──────────────────────────────────────────────────────── */
function StudioView({ onNavigate }) {
  const [phase, setPhase]             = React.useState('hero');
  const [msgs, setMsgs]               = React.useState([]);
  const [input, setInput]             = React.useState('');
  const [model, setModel]             = React.useState('chinna/free');
  const [stack, setStack]             = React.useState('auto');
  const [loading, setLoading]         = React.useState(false);
  const [tab, setTab]                 = React.useState(0);
  const [leftW, setLeftW]             = React.useState(480);
  const [files, setFiles]             = React.useState([]);
  const [artifacts, setArtifacts]     = React.useState([]);
  const [tools, setTools]             = React.useState([]);
  const [artifactCode, setArtCode]    = React.useState('');
  const [artifactId, setArtId]        = React.useState(null);
  const [projects, setProjects]       = React.useState([]);
  const [activeProject, setActiveP]   = React.useState(null);
  const [showPanel, setShowPanel]     = React.useState(true);
  const [devStatus, setDevStatus]     = React.useState({});
  const [showScaffold, setShowSc]     = React.useState(null);
  const [showWizard, setShowWizard]   = React.useState(false);
  const [selectedBuild, setSelBuild]  = React.useState(null);
  const [draggingOver, setDO]         = React.useState(false);

  const endRef    = React.useRef(null);
  const dragging  = React.useRef(false);
  const startX    = React.useRef(0);
  const startW    = React.useRef(0);
  const historyRef= React.useRef([]);
  const TABS      = ['Preview', 'Code', 'Terminal'];
  const now       = () => new Date().toLocaleTimeString('en', { hour:'2-digit', minute:'2-digit' });

  const loadProjects = React.useCallback(() => {
    fetch('/api/studio/projects').then(r => r.json()).then(d => {
      const projs = d.projects ?? [];
      setProjects(projs);
      const statuses = {};
      projs.forEach(p => { statuses[p.path] = { running: p.dev_running, port: p.dev_port }; });
      setDevStatus(statuses);
    }).catch(() => {});
  }, []);

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

  React.useEffect(() => { loadProjects(); loadArtifacts(); }, [loadProjects, loadArtifacts]);

  React.useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, loading]);

  React.useEffect(() => {
    const mv = e => {
      if (!dragging.current) return;
      setLeftW(Math.max(320, Math.min(startW.current + e.clientX - startX.current, 720)));
    };
    const up = () => { dragging.current = false; };
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  }, []);

  const appendAi = React.useCallback((chunk) => setMsgs(m => {
    const copy = m.slice();
    for (let i = copy.length - 1; i >= 0; i--) {
      if (copy[i].role === 'ai' && copy[i].streaming) { copy[i] = { ...copy[i], text: copy[i].text + chunk }; break; }
    }
    return copy;
  }), []);

  const finishAi = React.useCallback(() =>
    setMsgs(m => m.map(x => x.streaming ? { ...x, streaming: false, done: true } : x)), []);

  const buildSystemContext = () => {
    const parts = [];
    if (activeProject) {
      parts.push(`Active project: ${activeProject.name} at ${activeProject.path}`);
      parts.push(`Stack: ${(activeProject.stacks || []).join(', ')}`);
    }
    if (stack !== 'auto') {
      const s = STACKS.find(x => x.id === stack);
      parts.push(`Requested stack: ${s?.label || stack}`);
    }
    return parts.join('\n');
  };

  const send = async (text) => {
    const txt = (text || input).trim();
    if (!txt || loading) return;
    setInput('');
    setTools([]);

    const isDashboard = /\bdashboard\b/i.test(txt) && phase === 'hero' && !text;
    if (isDashboard) { setShowWizard(true); return; }

    const isBuild = needsBuild(txt) || phase === 'build';
    const agentMode = isBuild ? 'build' : 'ask';
    if (phase === 'hero') setPhase(isBuild ? 'build' : 'chat');
    else if (isBuild && phase === 'chat') setPhase('build');

    const ctx = buildSystemContext();
    const fullTxt = ctx ? `${txt}\n\n[Context]\n${ctx}` : txt;

    setMsgs(m => [...m,
      { role:'user', text: txt, ts: now() },
      { role:'ai', text:'', streaming: true, ts: now() }
    ]);
    setLoading(true);

    try {
      const resp = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fullTxt, mode: agentMode, model, history: historyRef.current }),
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
            if (evt.type === 'text' || evt.type === 'plan') { assistantText += evt.content; appendAi(evt.content); }
            else if (evt.type === 'tool_start') { setTools(ts => [...ts, { tool: evt.tool, input: evt.input, status: 'running' }]); }
            else if (evt.type === 'tool_result') { setTools(ts => ts.map(x => x.tool === evt.tool && x.status === 'running' ? { ...x, status: 'done', result: evt.result } : x)); }
            else if (evt.type === 'artifact') {
              if (evt.meta) {
                setArtifacts(a => [evt.meta, ...a.filter(x => x.id !== evt.meta.id)]);
                setArtId(evt.meta.id);
                fetch(`/api/artifact/${evt.meta.id}`).then(r => r.text()).then(t => { setArtCode(t); if (phase !== 'build') setPhase('build'); }).catch(() => {});
              }
            }
            else if (evt.type === 'ask_user') { appendAi(`\n\n❓ ${evt.question}` + (evt.options ? `\nOptions: ${evt.options.join(', ')}` : '')); }
            else if (evt.type === 'error') { appendAi(`\n⚠ ${evt.content}`); }
            else if (evt.type === 'done') {
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
        historyRef.current = [...historyRef.current,
          { role: 'user', content: txt },
          { role: 'assistant', content: assistantText }
        ].slice(-20);
      }
    } catch { appendAi('\n⚠ Could not reach AI backend. Check your API key in Settings.'); }

    finishAi();
    setLoading(false);
    loadArtifacts();
  };

  async function startDev(proj) {
    try {
      const d = await fetch('/api/studio/dev/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: proj.path }) }).then(r => r.json());
      if (d.ok) {
        setDevStatus(ds => ({ ...ds, [proj.path]: { running: true, port: d.port } }));
        setTimeout(() => fetch(`/api/studio/dev/status?path=${encodeURIComponent(proj.path)}`).then(r => r.json()).then(s => {
          setDevStatus(ds => ({ ...ds, [proj.path]: { running: s.running, port: s.port } }));
        }), 4000);
      }
    } catch {}
  }

  async function stopDev(proj) {
    try {
      await fetch('/api/studio/dev/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: proj.path }) });
      setDevStatus(ds => ({ ...ds, [proj.path]: { running: false, port: null } }));
    } catch {}
  }

  async function unlinkProject(proj) {
    await fetch('/api/studio/unlink', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: proj.path }) });
    if (activeProject?.path === proj.path) setActiveP(null);
    loadProjects();
  }

  async function openInFinder(proj) {
    await fetch('/api/files/reveal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: proj.path }) });
  }

  const terminalText = React.useMemo(() => {
    if (!tools.length) return '$ chinna agent ready\n> waiting for task…';
    return tools.map(t => {
      const cmd = typeof t.input === 'string' ? t.input : (t.input ? JSON.stringify(t.input) : '');
      const lines = [`$ chinna ${t.tool} ${cmd.slice(0, 60)}`];
      if (t.status === 'done' && t.result) {
        const out = typeof t.result === 'string' ? t.result : JSON.stringify(t.result, null, 2);
        out.split('\n').slice(0, 8).forEach(l => lines.push(l.startsWith('✓') || l.startsWith('✗') ? l : `> ${l}`));
        lines.push(`✓  ${t.tool} complete`);
      }
      return lines.join('\n');
    }).join('\n\n');
  }, [tools]);

  /* ── HERO phase ── */
  if (phase === 'hero') return (
    <div style={{ flex:1,display:'flex',overflow:'hidden' }}>
      {/* Project sidebar in hero */}
      {showPanel && (
        <ProjectPanel
          projects={projects} activeProject={activeProject}
          onSelect={p => { setActiveP(p); send(`I'm working on the project "${p.name}" at ${p.path} (${(p.stacks||[]).join(', ')}). Analyze this project, describe what it does, and suggest improvements.`); }}
          onRefresh={loadProjects} onUnlink={unlinkProject}
          devStatus={devStatus} onStartDev={startDev} onStopDev={stopDev}
          onShowScaffold={p => setShowSc(p)} onOpenInFinder={openInFinder}
        />
      )}

      <div
        onDragOver={e => { e.preventDefault(); setDO(true); }}
        onDragLeave={() => setDO(false)}
        onDrop={e => { e.preventDefault(); setDO(false); const f = e.dataTransfer.files[0]; if (f) { setFiles(p => [...p, f]); } }}
        style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px 20px 80px',gap:'24px',overflow:'auto',position:'relative',border:draggingOver?'2px dashed rgba(186,255,41,.3)':'2px solid transparent' }}>

        {/* Ambient glows */}
        <div style={{ position:'absolute',top:'10%',left:'20%',width:'500px',height:'500px',pointerEvents:'none',background:'radial-gradient(circle,rgba(186,255,41,.04),transparent 60%)' }}/>
        <div style={{ position:'absolute',top:'20%',right:'15%',width:'360px',height:'360px',pointerEvents:'none',background:'radial-gradient(circle,rgba(213,76,255,.04),transparent 60%)' }}/>

        {/* Panel toggle */}
        <button onClick={() => setShowPanel(p => !p)} style={{ position:'absolute',top:'12px',left:'12px',padding:'5px 10px',background:'transparent',border:'1px solid rgba(255,255,255,.08)',borderRadius:'4px',color:'rgba(255,255,255,.3)',fontSize:'11px',cursor:'pointer' }}>
          {showPanel ? '◁ Hide' : '▷ Projects'}
        </button>

        {/* Title */}
        <div style={{ textAlign:'center',maxWidth:'640px',animation:'fadeUp .35s ease' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',marginBottom:'16px' }}>
            <div style={{ width:'30px',height:'30px',borderRadius:'7px',background:'#baff29',display:'grid',placeItems:'center',fontSize:'14px',fontWeight:'900',color:'#030a00',boxShadow:'0 0 20px rgba(186,255,41,.35)' }}>C</div>
            <span style={{ fontSize:'11px',fontWeight:'700',letterSpacing:'2.5px',textTransform:'uppercase',color:'rgba(255,255,255,.3)' }}>CHINNA STUDIO</span>
          </div>
          <h1 style={{ fontSize:'46px',fontWeight:'900',lineHeight:'1.05',letterSpacing:'-2px',color:'#fff',marginBottom:'12px' }}>
            What are we<br/>
            <span style={{ background:'linear-gradient(90deg,#baff29,#5ac8fa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' }}>building today?</span>
          </h1>
          <p style={{ fontSize:'14px',color:'rgba(255,255,255,.4)',lineHeight:'1.6' }}>Chat · Code · Agent · Build · Deploy — all in one.</p>
        </div>

        {/* Build type cards */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:'8px',maxWidth:'620px',width:'100%',animation:'fadeUp .45s ease' }}>
          {BUILD_TYPES.map(bt => (
            <div key={bt.id} onClick={() => {
              if (bt.id === 'dashboard') { setSelBuild(bt); setShowWizard(true); }
              else { send(`${bt.label}: ${bt.sub}`); }
            }}
              style={{ padding:'14px 12px',border:`1px solid ${selectedBuild?.id===bt.id?`${bt.color}66`:'rgba(255,255,255,.07)'}`,borderRadius:'8px',cursor:'pointer',background:selectedBuild?.id===bt.id?`${bt.color}08`:'transparent',transition:'all .12s',textAlign:'center' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor=`${bt.color}44`; e.currentTarget.style.background=`${bt.color}06`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor=selectedBuild?.id===bt.id?`${bt.color}66`:'rgba(255,255,255,.07)'; e.currentTarget.style.background=selectedBuild?.id===bt.id?`${bt.color}08`:'transparent'; }}>
              <div style={{ fontSize:'20px',marginBottom:'6px' }}>{bt.icon}</div>
              <div style={{ fontSize:'12px',fontWeight:'700',color:'rgba(255,255,255,.85)',marginBottom:'3px' }}>{bt.label}</div>
              <div style={{ fontSize:'10px',color:'rgba(255,255,255,.3)',lineHeight:'1.4' }}>{bt.sub}</div>
            </div>
          ))}
        </div>

        {/* Composer */}
        <div style={{ width:'100%',maxWidth:'720px',animation:'fadeUp .55s ease' }}>
          <Composer value={input} onChange={setInput} onSend={() => send()} model={model} onModelChange={setModel} stack={stack} onStackChange={setStack} files={files} onAttach={() => {}}
            placeholder="Ask anything — or type 'build a dashboard', 'fix my React app', 'clone github.com/…'" />
        </div>

        {/* Quick chips */}
        <div style={{ display:'flex',flexWrap:'wrap',gap:'6px',justifyContent:'center',maxWidth:'680px',animation:'fadeUp .65s ease' }}>
          {[
            { icon:'🌐', label:'Build a landing page', color:'#0080ff' },
            { icon:'⚡', label:'Clone github.com/user/repo', color:'#5ac8fa' },
            { icon:'🔧', label:'Fix TypeScript errors', color:'#ffc700' },
            { icon:'🎨', label:'Generate a UI component', color:'#baff29' },
            { icon:'🐍', label:'Write a Python script', color:'#2edd5e' },
            { icon:'🔍', label:'Debug my React app', color:'#ff8c00' },
          ].map(c => (
            <button key={c.label} onClick={() => send(c.label)}
              style={{ display:'flex',alignItems:'center',gap:'6px',padding:'6px 13px',borderRadius:'20px',border:`1px solid ${c.color}33`,background:'transparent',color:'rgba(255,255,255,.5)',fontSize:'12px',fontWeight:'500',cursor:'pointer',transition:'all .12s',fontFamily:'var(--font)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor=`${c.color}88`; e.currentTarget.style.color=c.color; e.currentTarget.style.background=`${c.color}0d`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor=`${c.color}33`; e.currentTarget.style.color='rgba(255,255,255,.5)'; e.currentTarget.style.background='transparent'; }}>
              <span style={{ fontSize:'14px' }}>{c.icon}</span>{c.label}
            </button>
          ))}
        </div>

        {draggingOver && (
          <div style={{ position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(0,0,0,.75)',backdropFilter:'blur(6px)',fontSize:'22px',fontWeight:'800',color:'#baff29',textShadow:'0 0 32px rgba(186,255,41,.5)' }}>
            Drop file to analyze or edit →
          </div>
        )}
      </div>

      {showWizard && <DashboardWizard onConfirm={prompt => { setShowWizard(false); send(prompt); }} onCancel={() => setShowWizard(false)} />}
      {showScaffold && <ScaffoldPanel project={showScaffold} onClose={() => setShowSc(null)} />}
    </div>
  );

  /* ── Chat panel ── */
  const ChatPanel = (
    <div style={{ display:'flex',flexDirection:'column',width:phase==='build'?leftW:'100%',minWidth:phase==='build'?320:undefined,maxWidth:phase==='chat'?'860px':undefined,margin:phase==='chat'?'0 auto':undefined,flex:phase==='chat'?1:undefined,flexShrink:0,position:'relative',minHeight:0 }}>
      {/* Project context bar */}
      {activeProject && (
        <div style={{ padding:'6px 14px',borderBottom:'1px solid rgba(186,255,41,.1)',background:'rgba(186,255,41,.03)',flexShrink:0,display:'flex',alignItems:'center',gap:'8px' }}>
          <span style={{ width:'6px',height:'6px',borderRadius:'50%',background:'#baff29',boxShadow:'0 0 4px #baff29',flexShrink:0 }}/>
          <span style={{ fontSize:'10px',fontFamily:'var(--mono)',color:'rgba(186,255,41,.7)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{activeProject.name} · {(activeProject.stacks||[]).join(', ')}</span>
          {devStatus[activeProject.path]?.running && devStatus[activeProject.path]?.port && (
            <a href={`http://localhost:${devStatus[activeProject.path].port}`} target="_blank" rel="noreferrer"
              style={{ marginLeft:'auto',fontSize:'10px',color:'#2edd5e',textDecoration:'none',flexShrink:0 }}>
              ⊙ :{devStatus[activeProject.path].port}
            </a>
          )}
        </div>
      )}

      <div style={{ flex:1,minHeight:0,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:'12px',paddingBottom:'160px' }}>
        {msgs.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div key={i} style={{ display:'flex',flexDirection:'column',gap:'4px',alignSelf:isUser?'flex-end':'flex-start',maxWidth:'88%',animation:'fadeUp .15s ease' }}>
              <div style={{ fontSize:'9px',fontWeight:'800',letterSpacing:'.8px',textTransform:'uppercase',textAlign:isUser?'right':'left',color:isUser?'#baff29':'rgba(255,255,255,.3)',display:'flex',alignItems:'center',gap:'5px',justifyContent:isUser?'flex-end':'flex-start' }}>
                {!isUser && <span style={{ width:'14px',height:'14px',borderRadius:'3px',background:'#baff29',display:'grid',placeItems:'center',fontSize:'7px',fontWeight:'900',color:'#030a00',flexShrink:0 }}>C</span>}
                {isUser ? 'YOU' : 'CHINNA'} · {m.ts}
                {m.done && !m.streaming && <span style={{ color:'#2edd5e' }}>✓</span>}
              </div>
              {!isUser && i === msgs.length - 1 && tools.length > 0 && (
                <div style={{ display:'flex',flexDirection:'column',gap:'4px' }}>
                  {tools.map((t, ti) => <ToolBlock key={ti} {...t} />)}
                </div>
              )}
              {m.text && (
                <div style={{ padding:'10px 14px',fontSize:'13.5px',lineHeight:'1.65',wordBreak:'break-word',whiteSpace:'pre-wrap',color:'#fff',borderRadius:isUser?'12px 12px 2px 12px':'12px 12px 12px 2px',border:isUser?'1px solid rgba(186,255,41,.35)':'1px solid rgba(255,255,255,.1)' }}>
                  {m.text}{m.streaming && <span style={{ color:'#baff29' }}> ▋</span>}
                </div>
              )}
              {m.streaming && !m.text && (
                <div style={{ display:'flex',gap:'4px',padding:'10px 14px',border:'1px solid rgba(255,255,255,.1)',borderRadius:'12px 12px 12px 2px' }}>
                  {[0,1,2].map(j => <span key={j} style={{ width:'6px',height:'6px',borderRadius:'50%',background:'#baff29',display:'inline-block',animation:'dot 1s infinite',animationDelay:`${j*.15}s` }}/>)}
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef}/>
      </div>

      {/* Composer pinned */}
      <div style={{ position:'absolute',bottom:0,left:0,width:phase==='build'?leftW:'100%',padding:'10px 14px',background:'linear-gradient(to top,rgba(0,0,0,.98) 65%,transparent)' }}>
        <div style={{ display:'flex',gap:'10px',marginBottom:'8px',alignItems:'center',flexWrap:'wrap' }}>
          <button onClick={() => { setPhase('hero'); setMsgs([]); setFiles([]); setTools([]); }}
            style={{ fontSize:'11px',color:'rgba(255,255,255,.3)',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font)',padding:0 }}
            onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,.7)'}
            onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.3)'}>← New</button>
          <button onClick={() => setShowPanel(p => !p)}
            style={{ fontSize:'11px',color:'rgba(186,255,41,.4)',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font)',padding:0 }}>
            {showPanel ? '◁ Projects' : '▷ Projects'}
          </button>
          {phase === 'build' && activeProject && (
            <button onClick={() => setShowSc(activeProject)}
              style={{ fontSize:'11px',color:'rgba(255,199,0,.5)',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font)',padding:0 }}>⬡ Scaffold</button>
          )}
          {phase === 'build' && artifacts.length > 0 && (
            <span style={{ fontSize:'11px',color:'rgba(186,255,41,.4)',fontFamily:'var(--mono)',marginLeft:'auto' }}>
              {artifacts.length} artifact{artifacts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Composer value={input} onChange={setInput} onSend={() => send()} model={model} onModelChange={setModel} stack={stack} onStackChange={setStack} compact files={files} onAttach={() => {}}/>
      </div>
    </div>
  );

  if (phase === 'chat') return (
    <div style={{ flex:1,minHeight:0,display:'flex',overflow:'hidden',background:'var(--bg)' }}>
      {showPanel && (
        <ProjectPanel projects={projects} activeProject={activeProject} onSelect={setActiveP}
          onRefresh={loadProjects} onUnlink={unlinkProject} devStatus={devStatus}
          onStartDev={startDev} onStopDev={stopDev} onShowScaffold={p => setShowSc(p)} onOpenInFinder={openInFinder}/>
      )}
      {ChatPanel}
      {showScaffold && <ScaffoldPanel project={showScaffold} onClose={() => setShowSc(null)}/>}
    </div>
  );

  /* ── BUILD phase — 3-panel ── */
  return (
    <div style={{ flex:1,minHeight:0,display:'flex',overflow:'hidden',background:'var(--bg)' }}>
      {/* Project sidebar */}
      {showPanel && (
        <ProjectPanel projects={projects} activeProject={activeProject} onSelect={setActiveP}
          onRefresh={loadProjects} onUnlink={unlinkProject} devStatus={devStatus}
          onStartDev={startDev} onStopDev={stopDev} onShowScaffold={p => setShowSc(p)} onOpenInFinder={openInFinder}/>
      )}

      {ChatPanel}

      {/* Drag divider */}
      <div onMouseDown={e => { dragging.current=true; startX.current=e.clientX; startW.current=leftW; e.preventDefault(); }}
        style={{ width:'3px',background:'rgba(255,255,255,.06)',cursor:'col-resize',flexShrink:0,zIndex:5,transition:'background .1s' }}
        onMouseEnter={e => e.currentTarget.style.background='#baff29'}
        onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.06)'}/>

      {/* Artifact panel */}
      <div style={{ flex:1,minWidth:0,display:'flex',flexDirection:'column' }}>
        {/* Tab bar */}
        <div style={{ display:'flex',alignItems:'stretch',borderBottom:'1px solid rgba(255,255,255,.07)',flexShrink:0,padding:'0 12px' }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              style={{ padding:'10px 14px',border:'none',background:'transparent',color:tab===i?'#fff':'rgba(255,255,255,.35)',fontSize:'12px',fontWeight:tab===i?'700':'500',cursor:'pointer',fontFamily:'var(--font)',borderBottom:`2px solid ${tab===i?'#baff29':'transparent'}`,transition:'all .1s',marginBottom:'-1px' }}>
              {t}
            </button>
          ))}
          <div style={{ marginLeft:'auto',display:'flex',gap:'6px',alignItems:'center',padding:'0 4px' }}>
            {activeProject && devStatus[activeProject.path]?.port && (
              <a href={`http://localhost:${devStatus[activeProject.path].port}`} target="_blank" rel="noreferrer"
                style={{ padding:'4px 10px',border:'1px solid rgba(46,221,94,.3)',borderRadius:'2px',color:'#2edd5e',fontSize:'11px',fontWeight:'700',textDecoration:'none' }}>
                ⊙ localhost:{devStatus[activeProject.path].port}
              </a>
            )}
            {artifacts.length > 0 && <span style={{ fontSize:'10.5px',color:'rgba(255,255,255,.25)',fontFamily:'var(--mono)' }}>{artifacts[0]?.name||'artifact'}</span>}
            <button onClick={loadArtifacts} style={{ padding:'4px 8px',border:'1px solid rgba(255,255,255,.1)',borderRadius:'2px',background:'transparent',color:'rgba(255,255,255,.4)',fontSize:'11px',cursor:'pointer' }}>↺</button>
            {artifactId && (
              <a href={`/api/artifact/${artifactId}`} target="_blank" rel="noreferrer"
                style={{ padding:'4px 10px',border:'1px solid rgba(186,255,41,.3)',borderRadius:'2px',background:'transparent',color:'#baff29',fontSize:'11px',fontWeight:'700',textDecoration:'none' }}>
                ⤓ Export
              </a>
            )}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ flex:1,minHeight:0,overflow:'hidden',display:'flex',flexDirection:'column' }}>
          {tab === 0 && (
            artifactId
              ? <iframe src={`/api/artifact/${artifactId}/preview`} title="Artifact preview" style={{ flex:1,border:'none',background:'#050505' }}/>
              : <div style={{ flex:1,display:'grid',placeItems:'center',color:'rgba(255,255,255,.2)',fontFamily:'var(--mono)',fontSize:'13px',textAlign:'center',padding:'40px' }}>
                  <div><div style={{ fontSize:'32px',marginBottom:'12px',opacity:.3 }}>📦</div>No artifact yet.<br/><span style={{ fontSize:'11px',opacity:.6 }}>Ask the AI to build something.</span></div>
                </div>
          )}
          {tab === 1 && (artifactCode ? <NeonCode code={artifactCode}/> : <div style={{ flex:1,display:'grid',placeItems:'center',color:'rgba(255,255,255,.2)',fontFamily:'var(--mono)',fontSize:'13px' }}>No code yet.</div>)}
          {tab === 2 && <NeonTerminal text={terminalText}/>}
        </div>

        {/* Artifact list */}
        {artifacts.length > 1 && (
          <div style={{ borderTop:'1px solid rgba(255,255,255,.06)',padding:'8px 12px',display:'flex',gap:'6px',overflowX:'auto',flexShrink:0 }}>
            {artifacts.map((a, i) => {
              const id = a.id ?? i;
              const active = id === artifactId;
              return (
                <button key={id} onClick={() => { setArtId(a.id); fetch(`/api/artifact/${a.id}`).then(r => r.text()).then(t => setArtCode(t)).catch(() => {}); }}
                  style={{ flexShrink:0,padding:'4px 10px',borderRadius:'2px',border:`1px solid ${active?'rgba(186,255,41,.4)':'rgba(255,255,255,.08)'}`,background:active?'rgba(186,255,41,.08)':'transparent',color:active?'#baff29':'rgba(255,255,255,.4)',fontSize:'11px',cursor:'pointer',fontFamily:'var(--mono)',whiteSpace:'nowrap' }}>
                  {a.name||a.filename||id}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showScaffold && <ScaffoldPanel project={showScaffold} onClose={() => setShowSc(null)}/>}
    </div>
  );
}

Object.assign(window, { StudioView });
