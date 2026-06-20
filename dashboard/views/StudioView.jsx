/* StudioView.jsx — AI Studio: hero → chat → build */

function StudioView({ onNavigate }) {
  const [phase, setPhase] = React.useState('hero'); // hero | chat | build
  const [msgs, setMsgs] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [artifacts, setArtifacts] = React.useState([]);
  const endRef = React.useRef(null);

  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function send() {
    const t = input.trim(); if (!t) return;
    setPhase('chat');
    setInput('');
    setMsgs(m => [...m, { role: 'user', text: t }]);
    setLoading(true);
    try {
      const d = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: t, mode: 'studio' }),
      }).then(r => r.json());
      const reply = d.reply ?? d.message ?? d.text ?? 'I can help you build that.';
      setMsgs(m => [...m, { role: 'ai', text: reply }]);
      if (d.artifact) setArtifacts(a => [d.artifact, ...a]);
    } catch {
      setMsgs(m => [...m, { role: 'ai', text: 'Could not reach the AI backend. Check your API key in Settings.' }]);
    }
    setLoading(false);
  }

  const suggestions = [
    'Build me a landing page for my SaaS',
    'Create a Python script to parse JSON',
    'Write a React component for a data table',
    'Debug my API connection issue',
    'Explain how async/await works',
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#d54cff', marginBottom: '4px' }}>AI STUDIO</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Chinna Studio</h2>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['hero', 'chat', 'build'].map(p => (
              <button key={p} onClick={() => setPhase(p)} style={{
                padding: '4px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '2px', border: '1px solid',
                borderColor: phase === p ? '#d54cff' : 'var(--line)', background: phase === p ? 'rgba(213,76,255,.12)' : 'transparent',
                color: phase === p ? '#d54cff' : 'var(--t3)', cursor: 'pointer', textTransform: 'capitalize',
              }}>{p}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {phase === 'hero' && (
          <div style={{ padding: '40px 20px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>◈</div>
            <h2 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--t1)', marginBottom: '12px' }}>
              What will you build today?
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--t2)', lineHeight: 1.6, marginBottom: '28px' }}>
              Describe your idea and Chinna AI will write the code, explain the concepts, and help you ship faster.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => { setInput(s); setPhase('chat'); }}
                  style={{ padding: '8px 14px', border: '1px solid rgba(213,76,255,.3)', borderRadius: '2px',
                    background: 'rgba(213,76,255,.06)', color: 'var(--t2)', fontSize: '12px', cursor: 'pointer',
                    transition: 'border-color .15s', fontWeight: 500 }}>
                  {s}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', maxWidth: '480px', margin: '0 auto' }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Describe what you want to build…"
                style={{ flex: 1, background: 'var(--s1)', border: '1px solid var(--line2)', borderRadius: '2px',
                  padding: '10px 14px', color: 'var(--t1)', fontSize: '13px', outline: 'none', fontFamily: 'var(--font)' }} />
              <button onClick={send} style={{ padding: '10px 16px', background: '#d54cff', border: 'none',
                borderRadius: '2px', color: '#000', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}>→</button>
            </div>
          </div>
        )}

        {phase === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {msgs.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--t3)', padding: '40px 20px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px', opacity: 0.3 }}>◈</div>
                  <div style={{ fontSize: '14px' }}>Start a conversation with Chinna AI</div>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '82%',
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {m.role === 'ai' && <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: 'rgba(213,76,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>◈</div>}
                  <div style={{ padding: '10px 12px', borderRadius: '2px', fontSize: '13px', lineHeight: 1.6,
                    border: m.role === 'user' ? '1px solid rgba(213,76,255,.3)' : '1px solid var(--line)',
                    background: m.role === 'user' ? 'rgba(213,76,255,.08)' : 'transparent',
                    color: 'var(--t1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && <div style={{ fontSize: '12px', color: '#d54cff', padding: '8px 0' }}>◈ Thinking…</div>}
              <div ref={endRef} />
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: '8px', flexShrink: 0 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Message Chinna AI…"
                style={{ flex: 1, background: 'var(--s1)', border: '1px solid var(--line2)', borderRadius: '2px',
                  padding: '10px 14px', color: 'var(--t1)', fontSize: '13px', outline: 'none', fontFamily: 'var(--font)' }} />
              <button onClick={send} style={{ padding: '10px 16px', background: '#d54cff', border: 'none',
                borderRadius: '2px', color: '#000', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}>→</button>
            </div>
          </div>
        )}

        {phase === 'build' && (
          <div style={{ padding: '20px' }}>
            <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#d54cff', marginBottom: '16px' }}>ARTIFACTS</div>
            {artifacts.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--t3)', padding: '48px 20px' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>📦</div>
                <div>No artifacts yet. Ask the AI to build something in Chat.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {artifacts.map((a, i) => (
                  <div key={i} style={{ border: '1px solid var(--line)', borderRadius: '2px', padding: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t1)', marginBottom: '4px' }}>{a.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--t3)' }}>{a.type} · {a.size}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { StudioView });
