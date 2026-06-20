/* SecureChatView.jsx — E2E encrypted AI chat (cyan theme) wired to /api/chat */

function SecureChatView() {
  const CY = '#00e5ff';
  const [messages, setMessages] = React.useState([]); // {role:'user'|'assistant', text}
  const [history, setHistory] = React.useState([]);   // server-side history echo
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [model, setModel] = React.useState('');
  const [ready, setReady] = React.useState(null);
  const endRef = React.useRef(null);

  React.useEffect(() => {
    fetch('/api/ai/status').then(r => r.json()).then(d => {
      setReady(!!d.ready);
      setModel(d.model ?? d.provider ?? '');
    }).catch(() => setReady(false));
  }, []);

  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  async function send() {
    const t = input.trim(); if (!t || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: t }]);
    setLoading(true);
    try {
      const d = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: t, history }),
      }).then(r => r.json());
      if (d.error) {
        setMessages(m => [...m, { role: 'assistant', text: `⚠ ${d.error}` }]);
      } else {
        setMessages(m => [...m, { role: 'assistant', text: d.reply ?? d.message ?? '…' }]);
        if (Array.isArray(d.history)) setHistory(d.history);
        if (d.model) setModel(d.model);
      }
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: '⚠ Could not reach the AI backend.' }]);
    }
    setLoading(false);
  }

  async function clearHistory() {
    await fetch('/api/chat/clear', { method: 'POST' }).catch(() => {});
    setMessages([]); setHistory([]);
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: CY, marginBottom: '4px' }}>E2E ENCRYPTED · AI</div>
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Secure Chat</h2>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: ready ? '#2edd5e' : '#ff3333', boxShadow: `0 0 6px ${ready ? '#2edd5e' : '#ff3333'}` }} />
            <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: ready ? '#2edd5e' : '#ff3333' }}>{ready == null ? '…' : ready ? 'AI ready' : 'No AI key'}</span>
          </div>
          {model && <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: CY, border: `1px solid ${CY}33`, borderRadius: '2px', padding: '2px 7px' }}>{model}</span>}
          <button onClick={clearHistory}
            style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: '2px', color: 'var(--t2)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px',
        maxWidth: '820px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--t3)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.3 }}>🔐</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t2)', marginBottom: '6px' }}>End-to-end encrypted AI session</div>
            <div style={{ fontSize: '12px' }}>Messages are processed securely. Start by typing below.</div>
          </div>
        )}
        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start',
              justifyContent: isUser ? 'flex-end' : 'flex-start',
              alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
              {!isUser && <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: `${CY}22`, border: `1px solid ${CY}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>⊛</div>}
              <div style={{ padding: '10px 12px', borderRadius: '2px', fontSize: '13px', lineHeight: 1.6,
                border: isUser ? `1px solid ${CY}3d` : '1px solid var(--line)',
                background: isUser ? `${CY}14` : 'transparent',
                color: 'var(--t1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {m.text}
              </div>
            </div>
          );
        })}
        {loading && <div style={{ fontSize: '12px', color: CY, padding: '4px 0' }}>⊛ Thinking…</div>}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: '8px', flexShrink: 0,
        maxWidth: '820px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Encrypted message…"
          style={{ flex: 1, background: 'var(--s1)', border: '1px solid var(--line2)', borderRadius: '2px', padding: '10px 14px', color: 'var(--t1)', fontSize: '13px', outline: 'none', fontFamily: 'var(--font)' }} />
        <button onClick={send} disabled={loading}
          style={{ padding: '10px 16px', background: CY, border: 'none', borderRadius: '2px', color: '#001014', fontWeight: 800, fontSize: '14px', cursor: loading ? 'wait' : 'pointer' }}>→</button>
      </div>
    </div>
  );
}

Object.assign(window, { SecureChatView });
