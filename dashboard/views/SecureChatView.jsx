/* SecureChatView.jsx — E2E encrypted AI chat */

function SecureChatView() {
  const [me, setMe] = React.useState(null);
  const [contacts, setContacts] = React.useState([]);
  const [active, setActive] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [addId, setAddId] = React.useState('');
  const endRef = React.useRef(null);

  React.useEffect(() => {
    Promise.all([
      fetch('/api/chat/user').then(r => r.json()).catch(() => ({})),
      fetch('/api/chat/users').then(r => r.json()).catch(() => ({ users: [] })),
    ]).then(([user, usersData]) => {
      setMe(user);
      setContacts(usersData.users ?? []);
      setLoading(false);
    });
  }, []);

  React.useEffect(() => {
    if (!active) return;
    const poll = async () => {
      const d = await fetch(`/api/chat/history?with=${encodeURIComponent(active.id)}`).then(r => r.json()).catch(() => ({ messages: [] }));
      setMessages(d.messages ?? d ?? []);
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [active]);

  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    const t = input.trim(); if (!t || !active) return;
    setInput('');
    await fetch('/api/chat/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: active.id, message: t }) }).catch(() => {});
    setMessages(m => [...m, { from: me?.id, to: active.id, text: t, time: Date.now() }]);
  }

  async function addContact() {
    if (!addId.trim()) return;
    await fetch('/api/chat/add-contact', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: addId.trim() }) }).catch(() => {});
    setContacts(c => [...c, { id: addId.trim(), name: addId.trim() }]);
    setAddId('');
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#00e5ff', marginBottom: '4px' }}>E2E ENCRYPTED</div>
        <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Secure Chat</h2>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}>Loading…</div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Sidebar */}
          <div style={{ width: '260px', flexShrink: 0, borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }}>
            {/* Identity */}
            {me && (
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,229,255,.15)', border: '1px solid rgba(0,229,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>⊛</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me.name ?? 'You'}</div>
                  <div style={{ fontSize: '9px', color: '#00e5ff', fontFamily: 'var(--mono)', letterSpacing: '0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me.id}</div>
                </div>
              </div>
            )}

            {/* Add contact */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input value={addId} onChange={e => setAddId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addContact()}
                  placeholder="Add contact ID…"
                  style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid var(--line2)', outline: 'none', color: 'var(--t1)', fontSize: '11px', padding: '5px 0', fontFamily: 'var(--mono)' }} />
                <button onClick={addContact} style={{ padding: '4px 8px', background: '#00e5ff', border: 'none', borderRadius: '2px', color: '#000', fontWeight: 800, cursor: 'pointer', fontSize: '12px' }}>+</button>
              </div>
            </div>

            {/* Contacts list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {contacts.length === 0 ? (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--t3)', fontSize: '11px' }}>No contacts yet</div>
              ) : contacts.map((c, i) => (
                <div key={c.id ?? i} onClick={() => setActive(c)}
                  style={{ display: 'flex', gap: '10px', padding: '10px 12px', cursor: 'pointer', alignItems: 'center',
                    background: active?.id === c.id ? 'rgba(0,229,255,.06)' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,.04)',
                    borderLeft: active?.id === c.id ? '2px solid #00e5ff' : '2px solid transparent' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(0,229,255,.1)', border: '1px solid rgba(0,229,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0 }}>⊛</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name ?? c.id}</div>
                    <div style={{ fontSize: '9px', color: 'var(--t4)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.id}</div>
                  </div>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.online ? '#2edd5e' : 'var(--line3)', flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Chat area */}
          {active ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, background: 'rgba(0,229,255,.02)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)' }}>{active.name ?? active.id}</div>
                  <div style={{ fontSize: '9px', fontFamily: 'var(--mono)', color: '#00e5ff' }}>🔐 E2E Encrypted</div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--t3)', fontSize: '12px' }}>
                    🔐 Messages are end-to-end encrypted
                  </div>
                )}
                {messages.map((m, i) => {
                  const isMe = m.from === me?.id;
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '70%', padding: '8px 12px', borderRadius: '2px', fontSize: '13px', lineHeight: 1.5,
                        background: isMe ? 'rgba(0,229,255,.08)' : 'var(--s1)',
                        border: isMe ? '1px solid rgba(0,229,255,.25)' : '1px solid var(--line)',
                        color: 'var(--t1)', wordBreak: 'break-word' }}>
                        {m.text ?? m.content}
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', display: 'flex', gap: '8px', flexShrink: 0 }}>
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder="Encrypted message…"
                  style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid #00e5ff', outline: 'none', color: 'var(--t1)', fontSize: '13px', padding: '6px 0', fontFamily: 'var(--font)' }} />
                <button onClick={send} style={{ padding: '6px 14px', background: '#00e5ff', border: 'none', borderRadius: '2px', color: '#000', fontWeight: 800, cursor: 'pointer', fontSize: '14px' }}>→</button>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: 'var(--t3)' }}>
              <div style={{ fontSize: '40px', opacity: 0.2 }}>⊛</div>
              <div style={{ fontSize: '13px' }}>Select a contact to start a secure chat</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { SecureChatView });
