/* StudioView.jsx — AI Studio: hero → chat → build, wired to /api/agent SSE streaming + /api/artifacts */

function StudioView({ onNavigate }) {
  const AC = '#d54cff';
  const [phase, setPhase] = React.useState('hero');   // hero | chat | build
  const [mode, setMode] = React.useState('build');    // ask | plan | build
  const [msgs, setMsgs] = React.useState([]);         // {role, text, streaming?}
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [artifacts, setArtifacts] = React.useState([]);
  const [tools, setTools] = React.useState([]);       // live tool trace
  const endRef = React.useRef(null);
  const historyRef = React.useRef([]);

  const loadArtifacts = React.useCallback(() => {
    fetch('/api/artifacts').then(r => r.json()).then(d => setArtifacts(d.artifacts ?? [])).catch(() => {});
  }, []);
  React.useEffect(() => { loadArtifacts(); }, [loadArtifacts]);
  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, tools, loading]);

  async function send(text) {
    const t = (text ?? input).trim(); if (!t || loading) return;
    setPhase('chat');
    setInput('');
    setTools([]);
    setMsgs(m => [...m, { role: 'user', text: t }, { role: 'ai', text: '', streaming: true }]);
    setLoading(true);

    const appendAi = (chunk) => setMsgs(m => {
      const copy = m.slice();
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === 'ai' && copy[i].streaming) { copy[i] = { ...copy[i], text: copy[i].text + chunk }; break; }
      }
      return copy;
    });
    const finishAi = () => setMsgs(m => m.map(x => x.streaming ? { ...x, streaming: false } : x));

    try {
      const resp = await fetch('/api/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: t, mode, history: historyRef.current }),
      });
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
          let evt; try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
          if (evt.type === 'text') { assistantText += evt.content; appendAi(evt.content); }
          else if (evt.type === 'plan') { assistantText += evt.content; appendAi(evt.content); }
          else if (evt.type === 'tool_start') { setTools(ts => [...ts, { tool: evt.tool, input: evt.input, status: 'running' }]); }
          else if (evt.type === 'tool_result') { setTools(ts => ts.map(x => x.tool === evt.tool && x.status === 'running' ? { ...x, status: 'done', result: evt.result } : x)); }
          else if (evt.type === 'artifact') { setArtifacts(a => [evt.meta, ...a.filter(x => x.id !== evt.meta?.id)]); }
          else if (evt.type === 'ask_user') { appendAi(`\n\n❓ ${evt.question}` + (evt.options ? `\nOptions: ${evt.options.join(', ')}` : '')); }
          else if (evt.type === 'error') { appendAi(`\n⚠ ${evt.content}`); }
          else if (evt.type === 'done') { if (Array.isArray(evt.artifacts) && evt.artifacts.length) setArtifacts(evt.artifacts.slice().reverse()); }
        }
      }
      historyRef.current = [...historyRef.current, { role: 'user', content: t }, { role: 'assistant', content: assistantText }].slice(-20);
    } catch {
      appendAi('\n⚠ Could not reach the AI backend. Check your API key in Settings.');
    }
    finishAi();
    setLoading(false);
    loadArtifacts();
  }

  const suggestions = [
    'Build me a landing page for my SaaS',
    'Create a Python script to parse JSON',
    'Write a React component for a data table',
    'Debug my API connection issue',
    'Explain how async/await works',
  ];

  const ModeTabs = () => (
    <div style={{ display: 'flex', gap: '4px' }}>
      {['ask', 'plan', 'build'].map(p => (
        <button key={p} onClick={() => setMode(p)} style={{
          padding: '4px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '2px', border: '1px solid',
          borderColor: mode === p ? AC : 'var(--line)', background: mode === p ? `${AC}1f` : 'transparent',
          color: mode === p ? AC : 'var(--t3)', cursor: 'pointer', textTransform: 'capitalize',
        }}>{p}</button>
      ))}
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: AC, marginBottom: '4px' }}>AI STUDIO</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Chinna Studio</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <ModeTabs />
            <div style={{ display: 'flex', gap: '6px' }}>
              {['hero', 'chat', 'build'].map(p => (
                <button key={p} onClick={() => setPhase(p)} style={{
                  padding: '4px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '2px', border: '1px solid',
                  borderColor: phase === p ? AC : 'var(--line)', background: phase === p ? `${AC}1f` : 'transparent',
                  color: phase === p ? AC : 'var(--t3)', cursor: 'pointer', textTransform: 'capitalize',
                }}>{p === 'build' ? `Artifacts (${artifacts.length})` : p}</button>
              ))}
            </div>
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
                <button key={i} onClick={() => send(s)}
                  style={{ padding: '8px 14px', border: `1px solid ${AC}4d`, borderRadius: '2px',
                    background: `${AC}10`, color: 'var(--t2)', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>
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
              <button onClick={() => send()} style={{ padding: '10px 16px', background: AC, border: 'none',
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
                  {m.role === 'ai' && <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: `${AC}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>◈</div>}
                  <div style={{ padding: '10px 12px', borderRadius: '2px', fontSize: '13px', lineHeight: 1.6,
                    border: m.role === 'user' ? `1px solid ${AC}4d` : '1px solid var(--line)',
                    background: m.role === 'user' ? `${AC}14` : 'transparent',
                    color: 'var(--t1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {m.text || (m.streaming ? '…' : '')}
                    {m.streaming && <span style={{ color: AC }}> ▋</span>}
                  </div>
                </div>
              ))}
              {tools.length > 0 && (
                <div style={{ alignSelf: 'flex-start', maxWidth: '82%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {tools.map((t, i) => (
                    <div key={i} style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: t.status === 'done' ? '#2edd5e' : AC,
                      border: '1px solid var(--line)', borderRadius: '2px', padding: '5px 8px' }}>
                      {t.status === 'done' ? '✓' : '⟳'} {t.tool}
                    </div>
                  ))}
                </div>
              )}
              <div ref={endRef} />
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: '8px', flexShrink: 0 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder={`Message Chinna AI · ${mode} mode…`}
                style={{ flex: 1, background: 'var(--s1)', border: '1px solid var(--line2)', borderRadius: '2px',
                  padding: '10px 14px', color: 'var(--t1)', fontSize: '13px', outline: 'none', fontFamily: 'var(--font)' }} />
              <button onClick={() => send()} disabled={loading} style={{ padding: '10px 16px', background: AC, border: 'none',
                borderRadius: '2px', color: '#000', fontWeight: 800, fontSize: '14px', cursor: loading ? 'wait' : 'pointer' }}>→</button>
            </div>
          </div>
        )}

        {phase === 'build' && (
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: AC }}>ARTIFACTS</div>
              <button onClick={loadArtifacts} style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid var(--line2)', borderRadius: '2px', background: 'transparent', color: 'var(--t2)', cursor: 'pointer' }}>↺ Refresh</button>
            </div>
            {artifacts.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--t3)', padding: '48px 20px' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>📦</div>
                <div>No artifacts yet. Ask the AI to build something in Chat.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {artifacts.map((a, i) => {
                  const id = a.id ?? a.name ?? i;
                  return (
                    <div key={id} style={{ border: '1px solid var(--line)', borderRadius: '2px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t1)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name ?? a.filename ?? id}</div>
                        <div style={{ fontSize: '11px', color: 'var(--t3)' }}>{a.type ?? a.lang ?? 'file'}{a.size ? ` · ${a.size}` : ''}</div>
                      </div>
                      {a.id && (
                        <>
                          <a href={`/api/artifact/${a.id}/preview`} target="_blank" rel="noreferrer"
                            style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 700, border: `1px solid ${AC}4d`, borderRadius: '2px', color: AC, textDecoration: 'none' }}>Preview</a>
                          <a href={`/api/artifact/${a.id}`} target="_blank" rel="noreferrer"
                            style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 700, border: '1px solid var(--line2)', borderRadius: '2px', color: 'var(--t2)', textDecoration: 'none' }}>Open</a>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { StudioView });
