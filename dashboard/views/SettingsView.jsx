/* SettingsView.jsx — 3-column sleek settings */

function SettingsView() {
  const [keys, setKeys] = React.useState({});
  const [saved, setSaved] = React.useState(false);
  const [version, setVersion] = React.useState(null);
  const [models, setModels] = React.useState({ active: '', presets: {}, preset_labels: {} });
  const [tgMsg, setTgMsg] = React.useState(null);
  const [actionMsg, setActionMsg] = React.useState(null);
  const [actionBusy, setActionBusy] = React.useState(null);
  const [relayEdit, setRelayEdit] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/get_keys').then(r => r.json()).then(setKeys).catch(() => {});
    fetch('/api/version').then(r => r.json()).then(setVersion).catch(() => {});
    fetch('/api/models').then(r => r.json()).then(setModels).catch(() => {});
  }, []);

  async function saveKey(k, v) {
    const payload = { ...keys, [k]: v };
    await fetch('/api/save_keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
    setKeys(payload); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function setModel(preset) {
    await fetch('/api/model-set', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preset }) }).catch(() => {});
    fetch('/api/models').then(r => r.json()).then(setModels).catch(() => {});
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function telegramPair() {
    setTgMsg('Pairing…');
    try {
      const d = await fetch('/api/telegram/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).then(r => r.json());
      setTgMsg(d.result ?? d.message ?? (d.pair_code ? `Pair code: ${d.pair_code}` : 'Pairing started'));
      fetch('/api/get_keys').then(r => r.json()).then(setKeys).catch(() => {});
    } catch { setTgMsg('Pair failed'); }
    setTimeout(() => setTgMsg(null), 6000);
  }

  async function telegramTest() {
    setTgMsg('Sending test…');
    try {
      const d = await fetch('/api/telegram/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).then(r => r.json());
      setTgMsg(d.result ?? (d.ok ? 'Test message sent ✓' : 'Test failed'));
    } catch { setTgMsg('Test failed'); }
    setTimeout(() => setTgMsg(null), 6000);
  }

  const S = { border: '1px solid var(--line)', borderRadius: '2px', padding: '14px', background: 'transparent' };
  const Label = ({ children }) => <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: '6px' }}>{children}</div>;
  const Help = ({ children }) => <div style={{ fontSize: '11px', color: 'var(--t4)', lineHeight: 1.5, marginTop: '6px' }}>{children}</div>;
  const FInput = ({ value, onChange, type = 'text', placeholder }) => (
    <input type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder}
      style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--line2)', outline: 'none',
        color: 'var(--t1)', fontSize: '12px', padding: '6px 0', fontFamily: 'var(--mono)', transition: 'border-color .15s' }}
      onFocus={e => e.target.style.borderBottomColor = 'var(--acc)'}
      onBlur={e => e.target.style.borderBottomColor = 'var(--line2)'} />
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#00e5ff', marginBottom: '4px' }}>CONFIGURATION</div>
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Settings</h2>
        </div>
        {saved && <div style={{ fontSize: '12px', fontWeight: 700, color: '#2edd5e' }}>✓ Saved</div>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {/* Column 1 — AI */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#d54cff', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,.07)', paddingBottom: '8px' }}>AI PROVIDERS</div>

            <div style={S}>
              <Label>OpenRouter API Key</Label>
              <FInput value={keys.OPENROUTER_API_KEY ?? ''} type="password"
                placeholder="sk-or-v1-…"
                onChange={e => setKeys(k => ({ ...k, OPENROUTER_API_KEY: e.target.value }))} />
              <Help>Powers all Chinna AI features. Get a free key at openrouter.ai</Help>
              <button onClick={() => saveKey('OPENROUTER_API_KEY', keys.OPENROUTER_API_KEY)}
                style={{ marginTop: '10px', padding: '5px 12px', background: '#d54cff', border: 'none', borderRadius: '2px', color: '#000', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                Save
              </button>
            </div>

            <div style={S}>
              <Label>OpenAI API Key</Label>
              <FInput value={keys.OPENAI_API_KEY ?? ''} type="password"
                placeholder="sk-proj-…"
                onChange={e => setKeys(k => ({ ...k, OPENAI_API_KEY: e.target.value }))} />
              <Help>Optional. Enables GPT-4 and Whisper features.</Help>
              <button onClick={() => saveKey('OPENAI_API_KEY', keys.OPENAI_API_KEY)}
                style={{ marginTop: '10px', padding: '5px 12px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: '2px', color: 'var(--t2)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                Save
              </button>
            </div>

            <div style={S}>
              <Label>AI Status</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: keys.ai_ready ? '#2edd5e' : '#ff3333', boxShadow: `0 0 6px ${keys.ai_ready ? '#2edd5e' : '#ff3333'}` }} />
                <span style={{ fontSize: '12px', color: keys.ai_ready ? '#2edd5e' : '#ff3333', fontWeight: 700 }}>
                  {keys.ai_ready ? `Ready · ${keys.ai_provider ?? ''}` : 'Not configured'}
                </span>
              </div>
              {keys.ai_status && <Help>{keys.ai_status}</Help>}
            </div>

            <div style={S}>
              <Label>Active Model</Label>
              <select value={''} onChange={e => e.target.value && setModel(e.target.value)}
                style={{ width: '100%', background: 'var(--s1)', border: '1px solid var(--line2)', color: 'var(--t1)', fontSize: '12px', padding: '7px 9px', borderRadius: '2px', cursor: 'pointer', marginTop: '4px' }}>
                <option value="">{models.active_display ?? models.active ?? 'Select model…'}</option>
                {Object.keys(models.presets ?? {}).map(k => (
                  <option key={k} value={k}>{(models.preset_labels ?? {})[k] ?? k}</option>
                ))}
              </select>
              <Help>Current: <span style={{ color: 'var(--acc)' }}>{models.active_display ?? models.active ?? '—'}</span></Help>
            </div>
          </div>

          {/* Column 2 — Integrations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#2edd5e', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,.07)', paddingBottom: '8px' }}>INTEGRATIONS</div>

            <div style={S}>
              <Label>Telegram Bot Token</Label>
              <FInput value={keys.TELEGRAM_BOT_TOKEN ?? ''} type="password"
                placeholder="1234567890:ABC…"
                onChange={e => setKeys(k => ({ ...k, TELEGRAM_BOT_TOKEN: e.target.value }))} />
              <Help>Create a bot at @BotFather on Telegram. Enables remote notifications.</Help>
              <button onClick={() => saveKey('TELEGRAM_BOT_TOKEN', keys.TELEGRAM_BOT_TOKEN)}
                style={{ marginTop: '10px', padding: '5px 12px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: '2px', color: 'var(--t2)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                Save
              </button>
            </div>

            <div style={S}>
              <Label>Telegram Status</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                <StatusRow label="Bot configured" ok={keys.telegram_set} />
                <StatusRow label="Chat paired" ok={keys.telegram_paired} />
                {keys.telegram_bot && <div style={{ fontSize: '11px', color: 'var(--t3)' }}>@{keys.telegram_bot}</div>}
                {keys.pair_code && (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: 800, color: 'var(--acc)', letterSpacing: '4px', marginTop: '8px' }}>
                    {keys.pair_code}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                <button onClick={telegramPair}
                  style={{ flex: 1, padding: '6px 10px', background: 'rgba(46,221,94,.12)', border: '1px solid rgba(46,221,94,.35)', borderRadius: '2px', color: '#2edd5e', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  🔗 Pair
                </button>
                <button onClick={telegramTest}
                  style={{ flex: 1, padding: '6px 10px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: '2px', color: 'var(--t2)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  ✉ Test
                </button>
              </div>
              {tgMsg && <Help><span style={{ color: '#2edd5e' }}>{tgMsg}</span></Help>}
            </div>

            <div style={S}>
              <Label>OpenWeather API Key</Label>
              <FInput value={keys.OPENWEATHER_KEY ?? ''} type="password"
                placeholder="a1b2c3d4e5f6…"
                onChange={e => setKeys(k => ({ ...k, OPENWEATHER_KEY: e.target.value }))} />
              <Help>Free key from openweathermap.org. Powers the weather widget.</Help>
              <button onClick={() => saveKey('OPENWEATHER_KEY', keys.OPENWEATHER_KEY)}
                style={{ marginTop: '10px', padding: '5px 12px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: '2px', color: 'var(--t2)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                Save
              </button>
            </div>
          </div>

          {/* Column 3 — System + Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#00e5ff', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,.07)', paddingBottom: '8px' }}>SYSTEM</div>

            <div style={S}>
              <Label>Version</Label>
              <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--t1)', fontVariantNumeric: 'tabular-nums', marginBottom: '4px' }}>
                {version?.version ?? '—'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--t3)' }}>{version?.name ?? 'Chinna'}</div>
              <button onClick={() => fetch('/api/check-update').then(r => r.json()).then(d => alert(d.message ?? JSON.stringify(d))).catch(() => alert('Could not check for updates'))}
                style={{ marginTop: '12px', padding: '5px 12px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: '2px', color: 'var(--t2)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                Check for Updates
              </button>
            </div>

            <div style={S}>
              <Label>Quick Actions</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                {[['🧹 Deep Clean', '#2edd5e', '/api/deep-clean', 'POST'],
                  ['⚡ Purge RAM', '#ff2d55', '/api/purge-ram', 'POST'],
                  ['🔍 Doctor', '#ffc700', '/api/doctor', 'GET'],
                ].map(([label, color, url, method]) => (
                  <button key={label} disabled={!!actionBusy}
                    onClick={async () => {
                      setActionBusy(label); setActionMsg(null);
                      try {
                        const d = await fetch(url, { method }).then(r => r.json());
                        setActionMsg({ label, msg: d.result ?? d.message ?? '✓ Done', color });
                      } catch { setActionMsg({ label, msg: 'Error', color: '#ff3333' }); }
                      setActionBusy(null);
                      setTimeout(() => setActionMsg(null), 5000);
                    }}
                    style={{ padding: '7px 12px', border: `1px solid ${color}44`, background: 'transparent', color: actionBusy === label ? color : color, borderRadius: '2px', fontSize: '11px', fontWeight: 700, cursor: actionBusy ? 'wait' : 'pointer', textAlign: 'left', opacity: actionBusy && actionBusy !== label ? 0.5 : 1 }}>
                    {actionBusy === label ? '⟳ Working…' : label}
                  </button>
                ))}
              </div>
              {actionMsg && (
                <div style={{ marginTop: '8px', padding: '6px 10px', border: `1px solid ${actionMsg.color}44`, borderRadius: '2px', fontSize: '11px', color: actionMsg.color, background: `${actionMsg.color}0a` }}>
                  <span style={{ fontWeight: 700 }}>{actionMsg.label}</span> · {actionMsg.msg}
                </div>
              )}
            </div>

            <div style={S}>
              <Label>Relay URL</Label>
              {relayEdit ? (
                <div>
                  <FInput value={keys.chat_relay_url ?? ''} placeholder="https://your-relay.example.com"
                    onChange={e => setKeys(k => ({ ...k, chat_relay_url: e.target.value }))} />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <button onClick={() => { saveKey('chat_relay_url', keys.chat_relay_url); setRelayEdit(false); }}
                      style={{ flex: 1, padding: '5px 10px', background: 'transparent', border: '1px solid var(--acc)', borderRadius: '2px', color: 'var(--acc)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setRelayEdit(false)}
                      style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: '2px', color: 'var(--t3)', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <div style={{ flex: 1, fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--t3)', wordBreak: 'break-all' }}>
                    {keys.chat_relay_url || keys.chat_default_relay_url || 'Not configured'}
                  </div>
                  <button onClick={() => setRelayEdit(true)}
                    style={{ padding: '3px 8px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: '2px', color: 'var(--t3)', fontSize: '10px', cursor: 'pointer' }}>Edit</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, ok }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: ok ? '#2edd5e' : '#ff3333', flexShrink: 0 }} />
      <span style={{ color: ok ? 'var(--t2)' : 'var(--t3)' }}>{label}</span>
    </div>
  );
}

Object.assign(window, { SettingsView });
