/* SettingsView.jsx — Full settings: AI providers, integrations, interface, system */

function SettingsView() {
  const [keys, setKeys] = React.useState({});
  const [saved, setSaved] = React.useState(false);
  const [version, setVersion] = React.useState(null);
  const [models, setModels] = React.useState({ active: '', presets: {}, preset_labels: {} });
  const [tgMsg, setTgMsg] = React.useState(null);
  const [actionMsg, setActionMsg] = React.useState(null);
  const [actionBusy, setActionBusy] = React.useState(null);
  const [relayEdit, setRelayEdit] = React.useState(false);
  const [battery, setBattery] = React.useState(null);
  const [turnEdit, setTurnEdit] = React.useState(false);
  const [sysReportBusy, setSysReportBusy] = React.useState(false);

  const [dockVisible, setDockVisibleLocal] = React.useState(() => {
    try { return localStorage.getItem('chinna_dock_visible') === '1'; } catch { return false; }
  });
  const [sidebarDefault, setSidebarDefault] = React.useState(() => {
    try { return localStorage.getItem('chinna_sidebar_default') === '1'; } catch { return false; }
  });
  const [animations, setAnimations] = React.useState(() => {
    try { return localStorage.getItem('chinna_animations') !== '0'; } catch { return true; }
  });
  const [compactMode, setCompactMode] = React.useState(() => {
    try { return localStorage.getItem('chinna_compact') === '1'; } catch { return false; }
  });

  React.useEffect(() => {
    fetch('/api/get_keys').then(r => r.json()).then(setKeys).catch(() => {});
    fetch('/api/version').then(r => r.json()).then(setVersion).catch(() => {});
    fetch('/api/models').then(r => r.json()).then(setModels).catch(() => {});
    fetch('/api/battery').then(r => r.json()).then(setBattery).catch(() => {});
  }, []);

  async function saveKey(k, v) {
    const payload = { ...keys, [k]: v };
    await fetch('/api/save_keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
    setKeys(payload); flash();
  }
  async function saveKeys(updates) {
    const payload = { ...keys, ...updates };
    await fetch('/api/save_keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
    setKeys(payload); flash();
  }
  function flash() { setSaved(true); setTimeout(() => setSaved(false), 2000); }

  async function setModel(preset) {
    await fetch('/api/model-set', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preset }) }).catch(() => {});
    fetch('/api/models').then(r => r.json()).then(setModels).catch(() => {});
    flash();
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
      setTgMsg(d.result ?? (d.ok ? 'Test message sent' : 'Test failed'));
    } catch { setTgMsg('Test failed'); }
    setTimeout(() => setTgMsg(null), 6000);
  }

  async function downloadSysReport() {
    setSysReportBusy(true);
    try {
      const d = await fetch('/api/sysreport').then(r => r.json());
      const text = d.report ?? d.result ?? JSON.stringify(d, null, 2);
      const blob = new Blob([text], { type: 'text/plain' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `chinna-sysreport-${new Date().toISOString().slice(0, 10)}.txt`; a.click();
    } catch {}
    setSysReportBusy(false);
  }

  function toggleDock() {
    const next = !dockVisible;
    setDockVisibleLocal(next);
    try { localStorage.setItem('chinna_dock_visible', next ? '1' : '0'); } catch {}
    if (window.__setDockVisible) window.__setDockVisible(next);
  }
  function toggleSidebar() {
    const next = !sidebarDefault;
    setSidebarDefault(next);
    try { localStorage.setItem('chinna_sidebar_default', next ? '1' : '0'); } catch {}
  }
  function toggleAnimations() {
    const next = !animations;
    setAnimations(next);
    try { localStorage.setItem('chinna_animations', next ? '1' : '0'); } catch {}
  }
  function toggleCompact() {
    const next = !compactMode;
    setCompactMode(next);
    try { localStorage.setItem('chinna_compact', next ? '1' : '0'); } catch {}
  }

  const S = { border: '1px solid var(--line)', borderRadius: 2, padding: 14, background: 'transparent' };
  const SH = ({ children, color }) => <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color, borderBottom: '1px solid rgba(255,255,255,.07)', paddingBottom: 8 }}>{children}</div>;
  const Label = ({ children }) => <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6 }}>{children}</div>;
  const Help = ({ children }) => <div style={{ fontSize: 11, color: 'var(--t4)', lineHeight: 1.5, marginTop: 6 }}>{children}</div>;
  const FInput = ({ value, onChange, type = 'text', placeholder }) => (
    <input type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder}
      style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--line2)', outline: 'none',
        color: 'var(--t1)', fontSize: 12, padding: '6px 0', fontFamily: 'var(--mono)', transition: 'border-color .15s' }}
      onFocus={e => e.target.style.borderBottomColor = 'var(--acc)'}
      onBlur={e => e.target.style.borderBottomColor = 'var(--line2)'} />
  );
  const SaveBtn = ({ onClick, color = 'var(--t2)' }) => (
    <button onClick={onClick}
      style={{ marginTop: 10, padding: '5px 12px', background: 'transparent', border: `1px solid ${color}66`, borderRadius: 2, color, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .1s' }}
      onMouseEnter={e => { e.currentTarget.style.background = `${color}15`; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>Save</button>
  );
  const Toggle = ({ on, onToggle, label, desc }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2 }}>{desc}</div>}
      </div>
      <button onClick={onToggle}
        style={{ width: 38, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative',
          background: on ? 'var(--acc)' : 'var(--s2)', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 3, left: on ? 20 : 3, width: 14, height: 14, borderRadius: '50%', background: on ? '#030a00' : 'var(--t3)', transition: 'left .2s' }} />
      </button>
    </div>
  );

  const conditionColor = c => {
    if (!c) return 'var(--t3)';
    const l = c.toLowerCase();
    if (l === 'normal' || l === 'good') return '#2edd5e';
    if (l === 'replace soon') return '#ffc700';
    return '#ff3333';
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#00e5ff', marginBottom: 4 }}>CONFIGURATION</div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Settings</h2>
        </div>
        {saved && <div style={{ fontSize: 12, fontWeight: 700, color: '#2edd5e', animation: 'fadeIn .2s' }}>Saved</div>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>

          {/* Column 1 — AI Providers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SH color="#d54cff">AI PROVIDERS</SH>

            <div style={S}>
              <Label>OpenRouter API Key</Label>
              <FInput value={keys.OPENROUTER_API_KEY ?? ''} type="password" placeholder="sk-or-v1-…"
                onChange={e => setKeys(k => ({ ...k, OPENROUTER_API_KEY: e.target.value }))} />
              <Help>Powers all Chinna AI features. Free key at openrouter.ai</Help>
              <SaveBtn onClick={() => saveKey('OPENROUTER_API_KEY', keys.OPENROUTER_API_KEY)} color="#d54cff" />
            </div>

            <div style={S}>
              <Label>OpenAI API Key</Label>
              <FInput value={keys.OPENAI_API_KEY ?? ''} type="password" placeholder="sk-proj-…"
                onChange={e => setKeys(k => ({ ...k, OPENAI_API_KEY: e.target.value }))} />
              <Help>Optional. Enables GPT-4o and Whisper.</Help>
              <SaveBtn onClick={() => saveKey('OPENAI_API_KEY', keys.OPENAI_API_KEY)} />
            </div>

            <div style={S}>
              <Label>Anthropic API Key</Label>
              <FInput value={keys.ANTHROPIC_API_KEY ?? ''} type="password" placeholder="sk-ant-…"
                onChange={e => setKeys(k => ({ ...k, ANTHROPIC_API_KEY: e.target.value }))} />
              <Help>Optional. Enables Claude 3/4 models directly.</Help>
              <SaveBtn onClick={() => saveKey('ANTHROPIC_API_KEY', keys.ANTHROPIC_API_KEY)} />
            </div>

            <div style={S}>
              <Label>Active Model</Label>
              <select value={''} onChange={e => e.target.value && setModel(e.target.value)}
                style={{ width: '100%', background: 'var(--s1)', border: '1px solid var(--line2)', color: 'var(--t1)', fontSize: 12, padding: '7px 9px', borderRadius: 2, cursor: 'pointer', marginTop: 4 }}>
                <option value="">{models.active_display ?? models.active ?? 'Select model…'}</option>
                {Object.keys(models.presets ?? {}).map(k => (
                  <option key={k} value={k}>{(models.preset_labels ?? {})[k] ?? k}</option>
                ))}
              </select>
              <Help>Current: <span style={{ color: 'var(--acc)' }}>{models.active_display ?? models.active ?? '—'}</span></Help>
            </div>

            <div style={S}>
              <Label>AI Status</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: keys.ai_ready ? '#2edd5e' : '#ff3333', boxShadow: `0 0 6px ${keys.ai_ready ? '#2edd5e' : '#ff3333'}` }} />
                <span style={{ fontSize: 12, color: keys.ai_ready ? '#2edd5e' : '#ff3333', fontWeight: 700 }}>
                  {keys.ai_ready ? `Ready · ${keys.ai_provider ?? ''}` : 'Not configured'}
                </span>
              </div>
              {keys.ai_status && <Help>{keys.ai_status}</Help>}
            </div>
          </div>

          {/* Column 2 — Interface + Integrations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SH color="#baff29">INTERFACE</SH>

            <div style={S}>
              <Label>Appearance</Label>
              <Toggle on={dockVisible} onToggle={toggleDock} label="Bottom Dock" desc="Show macOS-style dock bar" />
              <Toggle on={sidebarDefault} onToggle={toggleSidebar} label="Auto-open Sidebar" desc="Open sidebar on launch" />
              <Toggle on={animations} onToggle={toggleAnimations} label="Animations" desc="Enable transitions and effects" />
              <Toggle on={compactMode} onToggle={toggleCompact} label="Compact Mode" desc="Reduce spacing and padding" />
            </div>

            <SH color="#2edd5e">INTEGRATIONS</SH>

            <div style={S}>
              <Label>Telegram Bot Token</Label>
              <FInput value={keys.TELEGRAM_BOT_TOKEN ?? ''} type="password" placeholder="1234567890:ABC…"
                onChange={e => setKeys(k => ({ ...k, TELEGRAM_BOT_TOKEN: e.target.value }))} />
              <Help>Create a bot at @BotFather on Telegram.</Help>
              <SaveBtn onClick={() => saveKey('TELEGRAM_BOT_TOKEN', keys.TELEGRAM_BOT_TOKEN)} />
            </div>

            <div style={S}>
              <Label>Telegram Status</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                <StatusRow label="Bot configured" ok={keys.telegram_set} />
                <StatusRow label="Chat paired" ok={keys.telegram_paired} />
                {keys.telegram_bot && <div style={{ fontSize: 11, color: 'var(--t3)' }}>@{keys.telegram_bot}</div>}
                {keys.pair_code && (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 800, color: 'var(--acc)', letterSpacing: '4px', marginTop: 8 }}>
                    {keys.pair_code}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button onClick={telegramPair}
                  style={{ flex: 1, padding: '6px 10px', background: 'rgba(46,221,94,.12)', border: '1px solid rgba(46,221,94,.35)', borderRadius: 2, color: '#2edd5e', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(46,221,94,.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(46,221,94,.12)'}>
                  Pair
                </button>
                <button onClick={telegramTest}
                  style={{ flex: 1, padding: '6px 10px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: 2, color: 'var(--t2)', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  Test
                </button>
              </div>
              {tgMsg && <Help><span style={{ color: '#2edd5e' }}>{tgMsg}</span></Help>}
            </div>

            <div style={S}>
              <Label>OpenWeather API Key</Label>
              <FInput value={keys.OPENWEATHER_KEY ?? ''} type="password" placeholder="a1b2c3d4e5f6…"
                onChange={e => setKeys(k => ({ ...k, OPENWEATHER_KEY: e.target.value }))} />
              <Help>Free key from openweathermap.org. Powers weather widget.</Help>
              <SaveBtn onClick={() => saveKey('OPENWEATHER_KEY', keys.OPENWEATHER_KEY)} />
            </div>
          </div>

          {/* Column 3 — System */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SH color="#00e5ff">SYSTEM</SH>

            <div style={S}>
              <Label>Version</Label>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--t1)', fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
                {version?.version ?? '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>{version?.name ?? 'Chinna'}</div>
              <button onClick={() => fetch('/api/check-update').then(r => r.json()).then(d => alert(d.message ?? JSON.stringify(d))).catch(() => alert('Could not check for updates'))}
                style={{ marginTop: 12, padding: '5px 12px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: 2, color: 'var(--t2)', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                Check for Updates
              </button>
            </div>

            <div style={S}>
              <Label>Battery Health</Label>
              {battery ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  {[['Condition', battery.condition, conditionColor(battery.condition)],
                    ['Max Capacity', battery.max_capacity, 'var(--t1)'],
                    ['Cycle Count', battery.cycles, 'var(--t1)'],
                    ['Charging', battery.charging, battery.charging === 'Yes' ? '#2edd5e' : 'var(--t3)'],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: 'var(--t3)' }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'var(--mono)' }}>{val}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 4 }}>Loading battery data…</div>
              )}
              <button onClick={() => fetch('/api/battery').then(r => r.json()).then(setBattery).catch(() => {})}
                style={{ marginTop: 10, padding: '4px 10px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: 2, color: 'var(--t3)', fontSize: 10, cursor: 'pointer', transition: 'all .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                Refresh
              </button>
            </div>

            {/* TURN / WebRTC */}
            <div style={S}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Label>TURN / WebRTC</Label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 10, color: keys.turn_enabled ? '#2edd5e' : 'var(--t4)' }}>
                    {keys.turn_enabled ? 'Enabled' : 'Disabled'}
                  </div>
                  <button onClick={() => saveKeys({ TURN_ENABLED: keys.turn_enabled ? '' : '1' })}
                    style={{ width: 34, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', position: 'relative',
                      background: keys.turn_enabled ? '#2edd5e' : 'var(--s1)', transition: 'background .2s' }}>
                    <div style={{ position: 'absolute', top: 2, left: keys.turn_enabled ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#000', transition: 'left .2s' }} />
                  </button>
                </div>
              </div>
              {!turnEdit ? (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>{keys.turn_urls || '(default TURN servers)'}</div>
                  {keys.turn_username && <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 4 }}>User: {keys.turn_username}</div>}
                  <StatusRow label="Credential set" ok={keys.turn_credential_set} />
                  <button onClick={() => setTurnEdit(true)}
                    style={{ marginTop: 8, padding: '4px 10px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: 2, color: 'var(--t3)', fontSize: 10, cursor: 'pointer' }}>
                    Edit TURN Config
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 3 }}>TURN URLs (comma-separated)</div>
                    <FInput value={keys.TURN_URLS ?? ''} placeholder="turn:server:3478,turns:server:5349"
                      onChange={e => setKeys(k => ({ ...k, TURN_URLS: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 3 }}>Username</div>
                    <FInput value={keys.TURN_USERNAME ?? ''} placeholder="username"
                      onChange={e => setKeys(k => ({ ...k, TURN_USERNAME: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 3 }}>Credential</div>
                    <FInput value={keys.TURN_CREDENTIAL ?? ''} type="password" placeholder="password"
                      onChange={e => setKeys(k => ({ ...k, TURN_CREDENTIAL: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { saveKeys({ TURN_URLS: keys.TURN_URLS, TURN_USERNAME: keys.TURN_USERNAME, TURN_CREDENTIAL: keys.TURN_CREDENTIAL }); setTurnEdit(false); }}
                      style={{ flex: 1, padding: '5px 10px', background: 'transparent', border: '1px solid var(--acc)', borderRadius: 2, color: 'var(--acc)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setTurnEdit(false)}
                      style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: 2, color: 'var(--t3)', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            <div style={S}>
              <Label>Quick Actions</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {[['Deep Clean', '#2edd5e', '/api/deep-clean', 'POST'],
                  ['Purge RAM', '#ff2d55', '/api/purge-ram', 'POST'],
                  ['Doctor', '#ffc700', '/api/doctor', 'GET'],
                ].map(([label, color, url, method]) => (
                  <button key={label} disabled={!!actionBusy}
                    onClick={async () => {
                      setActionBusy(label); setActionMsg(null);
                      try {
                        const d = await fetch(url, { method }).then(r => r.json());
                        setActionMsg({ label, msg: d.result ?? d.message ?? 'Done', color });
                      } catch { setActionMsg({ label, msg: 'Error', color: '#ff3333' }); }
                      setActionBusy(null);
                      setTimeout(() => setActionMsg(null), 5000);
                    }}
                    style={{ padding: '7px 12px', border: `1px solid ${color}44`, background: 'transparent', color, borderRadius: 2, fontSize: 11, fontWeight: 700, cursor: actionBusy ? 'wait' : 'pointer', textAlign: 'left', opacity: actionBusy && actionBusy !== label ? .5 : 1, transition: 'all .1s' }}
                    onMouseEnter={e => { if (!actionBusy) e.currentTarget.style.background = `${color}10`; }}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {actionBusy === label ? 'Working…' : label}
                  </button>
                ))}
                <button onClick={downloadSysReport} disabled={sysReportBusy}
                  style={{ padding: '7px 12px', border: '1px solid rgba(0,229,255,.3)', background: 'transparent', color: '#00e5ff', borderRadius: 2, fontSize: 11, fontWeight: 700, cursor: sysReportBusy ? 'wait' : 'pointer', textAlign: 'left', transition: 'all .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {sysReportBusy ? 'Generating…' : 'System Report'}
                </button>
              </div>
              {actionMsg && (
                <div style={{ marginTop: 8, padding: '6px 10px', border: `1px solid ${actionMsg.color}44`, borderRadius: 2, fontSize: 11, color: actionMsg.color, background: `${actionMsg.color}0a`, wordBreak: 'break-word', animation: 'fadeIn .2s' }}>
                  <span style={{ fontWeight: 700 }}>{actionMsg.label}</span> — {actionMsg.msg.slice(0, 200)}
                </div>
              )}
            </div>

            <div style={S}>
              <Label>Relay URL</Label>
              {relayEdit ? (
                <div>
                  <FInput value={keys.chat_relay_url ?? ''} placeholder="https://your-relay.example.com"
                    onChange={e => setKeys(k => ({ ...k, chat_relay_url: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={() => { saveKey('CHAT_RELAY_URL', keys.chat_relay_url); setRelayEdit(false); }}
                      style={{ flex: 1, padding: '5px 10px', background: 'transparent', border: '1px solid var(--acc)', borderRadius: 2, color: 'var(--acc)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setRelayEdit(false)}
                      style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: 2, color: 'var(--t3)', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--t3)', wordBreak: 'break-all' }}>
                    {keys.chat_relay_url || keys.chat_default_relay_url || 'Not configured'}
                  </div>
                  <button onClick={() => setRelayEdit(true)}
                    style={{ padding: '3px 8px', background: 'transparent', border: '1px solid var(--line2)', borderRadius: 2, color: 'var(--t3)', fontSize: 10, cursor: 'pointer' }}>Edit</button>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, marginTop: 3 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: ok ? '#2edd5e' : '#ff3333', flexShrink: 0 }} />
      <span style={{ color: ok ? 'var(--t2)' : 'var(--t3)' }}>{label}</span>
    </div>
  );
}

Object.assign(window, { SettingsView });
