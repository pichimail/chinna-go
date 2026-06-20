/* WhatsAppView.jsx — WhatsApp-style messaging */

function WhatsAppView() {
  const [status, setStatus] = React.useState(null);
  const [chats, setChats] = React.useState([]);
  const [active, setActive] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const endRef = React.useRef(null);

  React.useEffect(() => {
    const poll = () => fetch('/api/whatsapp/status').then(r => r.json()).then(s => {
      setStatus(s); setLoading(false);
      if (s.connected) {
        fetch('/api/whatsapp/chats').then(r => r.json()).then(d => setChats(d.chats ?? d ?? [])).catch(() => {});
      }
    }).catch(() => setLoading(false));
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  async function logout() {
    await fetch('/api/whatsapp/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).catch(() => {});
    setStatus(s => ({ ...(s || {}), connected: false }));
    setChats([]); setActive(null); setMessages([]);
  }

  // Poll QR while disconnected
  const [qr, setQr] = React.useState(null);
  React.useEffect(() => {
    if (status && !status.connected) {
      const poll = () => fetch('/api/whatsapp/qr').then(r => r.json())
        .then(d => setQr(d.qr ?? d.dataUrl ?? d.image ?? null)).catch(() => {});
      poll();
      const id = setInterval(poll, 5000);
      return () => clearInterval(id);
    }
  }, [status?.connected]);

  React.useEffect(() => {
    if (active?.id) {
      const poll = () => fetch(`/api/whatsapp/messages?chat=${encodeURIComponent(active.id)}`).then(r => r.json())
        .then(d => setMessages(d.messages ?? d ?? [])).catch(() => {});
      poll();
      const id = setInterval(poll, 4000);
      return () => clearInterval(id);
    }
  }, [active]);

  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function sendMsg() {
    if (!input.trim() || !active) return;
    const text = input; setInput('');
    setMessages(m => [...m, { id: Date.now(), from: 'me', text, time: new Date().toISOString() }]);
    await fetch('/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: active.id, chatId: active.id, message: text }) }).catch(() => {});
  }

  const connected = status?.connected;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#2edd5e', marginBottom: '4px' }}>MESSAGING</div>
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--t1)', margin: 0 }}>WhatsApp</h2>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: connected ? '#2edd5e' : '#ff3333', boxShadow: `0 0 6px ${connected ? '#2edd5e' : '#ff3333'}` }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: connected ? '#2edd5e' : '#ff3333' }}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          {connected && (
            <button onClick={logout}
              style={{ padding: '5px 10px', background: 'transparent', border: '1px solid rgba(255,51,51,.35)', borderRadius: '2px', color: '#ff3333', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
              Logout
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}>Loading…</div>
      ) : !connected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: 'var(--t3)', padding: '40px' }}>
          <div style={{ fontSize: '48px', opacity: 0.3 }}>◎</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--t2)' }}>WhatsApp not connected</div>
          {(() => {
            const q = qr ?? status?.qr;
            if (!q) return <div style={{ fontSize: '12px', textAlign: 'center', lineHeight: 1.6 }}>Start the WhatsApp bridge to connect your account.</div>;
            const isImg = typeof q === 'string' && (q.startsWith('data:image') || q.startsWith('http'));
            return (
              <div style={{ fontSize: '12px', textAlign: 'center', lineHeight: 1.6 }}>
                Scan this QR code with WhatsApp on your phone
                {isImg ? (
                  <div style={{ marginTop: '14px' }}>
                    <img src={q} alt="WhatsApp QR" style={{ width: '220px', height: '220px', borderRadius: '4px', background: '#fff', padding: '8px' }} />
                  </div>
                ) : (
                  <div style={{ marginTop: '10px', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--acc)', wordBreak: 'break-all', maxWidth: '320px' }}>{q}</div>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Chat list */}
          <div style={{ width: '280px', flexShrink: 0, borderRight: '1px solid var(--line)', overflowY: 'auto' }}>
            {chats.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--t3)', fontSize: '12px' }}>No chats</div>
            ) : chats.map((chat, i) => (
              <div key={chat.id ?? i} onClick={() => setActive(chat)}
                style={{ display: 'flex', gap: '10px', padding: '10px 12px', cursor: 'pointer', alignItems: 'center',
                  background: active?.id === chat.id ? 'rgba(186,255,41,.06)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,.04)',
                  borderLeft: active?.id === chat.id ? '2px solid var(--acc)' : '2px solid transparent' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0, border: '1px solid var(--line)' }}>
                  {chat.avatar ?? '◎'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>{chat.lastMsg ?? chat.preview}</div>
                </div>
                {chat.unread > 0 && (
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#2edd5e', color: '#000', fontSize: '9px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{chat.unread}</div>
                )}
              </div>
            ))}
          </div>

          {/* Messages */}
          {active ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>{active.avatar ?? '◎'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)' }}>{active.name}</div>
                  <div style={{ fontSize: '10px', color: '#2edd5e' }}>online</div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {messages.map((m, i) => (
                  <div key={m.id ?? i} style={{ display: 'flex', justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '70%', padding: '8px 12px', borderRadius: '2px', fontSize: '13px', lineHeight: 1.5,
                      background: m.from === 'me' ? 'rgba(186,255,41,.08)' : 'var(--s2)',
                      border: m.from === 'me' ? '1px solid rgba(186,255,41,.25)' : '1px solid var(--line)',
                      color: 'var(--t1)', wordBreak: 'break-word' }}>
                      {m.text ?? m.body}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--line)', display: 'flex', gap: '8px', flexShrink: 0 }}>
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMsg()}
                  placeholder="Type a message…"
                  style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid var(--line2)', outline: 'none', color: 'var(--t1)', fontSize: '13px', padding: '6px 0', fontFamily: 'var(--font)' }} />
                <button onClick={sendMsg} style={{ padding: '6px 14px', background: '#2edd5e', border: 'none', borderRadius: '2px', color: '#000', fontWeight: 800, cursor: 'pointer', fontSize: '14px' }}>→</button>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: '13px' }}>
              Select a chat to start messaging
            </div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { WhatsAppView });
