/* SettingsView.jsx — 3-column sleek settings */

function SettingsView() {
  const [keys, setKeys] = React.useState({});
  const [saved, setSaved] = React.useState(false);
  const [version, setVersion] = React.useState(null);

  React.useEffect(() => {
    fetch('/api/get_keys').then(r => r.json()).then(setKeys).catch(() => {});
    fetch('/api/version').then(r => r.json()).then(setVersion).catch(() => {});
  }, []);

  async function saveKey(k, v) {
    const payload = { ...keys, [k]: v };
    await fetch('/api/save_keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
    setKeys(payload); setSaved(true); setTimeout(() => setSaved(false), 2000);
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
                {[['🧹 Deep Clean', '#2edd5e', () => fetch('/api/purge', { method: 'POST' })],
                  ['⚡ Purge RAM', '#ff2d55', () => fetch('/api/purge', { method: 'POST' })],
                  ['🔍 Doctor', '#ffc700', () => fetch('/api/doctor')],
                ].map(([label, color, fn]) => (
                  <button key={label} onClick={fn}
                    style={{ padding: '7px 12px', border: `1px solid ${color}44`, background: 'transparent', color, borderRadius: '2px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={S}>
              <Label>Relay</Label>
              <div style={{ fontSize: '11px', color: 'var(--t3)', lineHeight: 1.6 }}>
                {keys.chat_relay_url ? (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', wordBreak: 'break-all', color: 'var(--t2)' }}>{keys.chat_relay_url}</div>
                ) : 'No relay configured'}
              </div>
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
