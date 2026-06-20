/* MediaPlayer.jsx — AnalogClock + WeatherCard */

function AnalogClock() {
  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = time.getSeconds(), m = time.getMinutes(), h = time.getHours() % 12;
  const sDeg = s * 6;
  const mDeg = m * 6 + s * 0.1;
  const hDeg = h * 30 + m * 0.5;

  return (
    <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto' }}>
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
        <circle cx="50" cy="50" r="48" fill="none" stroke="var(--line)" strokeWidth="1" />
        {[...Array(12)].map((_, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const x1 = 50 + Math.cos(a) * 42, y1 = 50 + Math.sin(a) * 42;
          const x2 = 50 + Math.cos(a) * 46, y2 = 50 + Math.sin(a) * 46;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,.3)" strokeWidth={i % 3 === 0 ? 1.5 : 0.8} />;
        })}
        {/* Hour hand — blue */}
        <line x1="50" y1="50"
          x2={50 + Math.cos((hDeg - 90) * Math.PI / 180) * 28}
          y2={50 + Math.sin((hDeg - 90) * Math.PI / 180) * 28}
          stroke="#0080ff" strokeWidth="3" strokeLinecap="round" />
        {/* Minute hand — yellow */}
        <line x1="50" y1="50"
          x2={50 + Math.cos((mDeg - 90) * Math.PI / 180) * 36}
          y2={50 + Math.sin((mDeg - 90) * Math.PI / 180) * 36}
          stroke="#ffc700" strokeWidth="2" strokeLinecap="round" />
        {/* Second hand — pink */}
        <line x1="50" y1="50"
          x2={50 + Math.cos((sDeg - 90) * Math.PI / 180) * 40}
          y2={50 + Math.sin((sDeg - 90) * Math.PI / 180) * 40}
          stroke="#ff2d55" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="50" cy="50" r="3" fill="var(--acc)" />
      </svg>
      <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '11px', fontWeight: 700,
        color: 'var(--t2)', fontFamily: 'var(--mono)', letterSpacing: '1px' }}>
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
    </div>
  );
}

function WeatherCard({ compact = false }) {
  const [weather, setWeather] = React.useState({ temp: 29, condition: 'Partly Cloudy', humidity: 72, wind: 12 });
  React.useEffect(() => {
    fetch('/api/weather')
      .then(r => r.json())
      .then(d => setWeather(d))
      .catch(() => {});
  }, []);

  const icons = { clear: '☀', cloudy: '⛅', rain: '🌧', storm: '⛈', snow: '❄', fog: '🌫', default: '🌤' };
  const cond = (weather.condition || '').toLowerCase();
  const icon = cond.includes('clear') || cond.includes('sunny') ? icons.clear
    : cond.includes('rain') || cond.includes('drizzle') ? icons.rain
    : cond.includes('storm') || cond.includes('thunder') ? icons.storm
    : cond.includes('snow') ? icons.snow
    : cond.includes('fog') || cond.includes('mist') ? icons.fog
    : cond.includes('cloud') ? icons.cloudy : icons.default;

  if (compact) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '20px' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--teal)' }}>{weather.temp}°C</div>
        <div style={{ fontSize: '9px', color: 'var(--t3)' }}>{weather.condition}</div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '32px' }}>{icon}</span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '36px', fontWeight: 900, color: 'var(--teal)', lineHeight: 1 }}>{weather.temp}°</div>
          <div style={{ fontSize: '10px', color: 'var(--t3)' }}>Feels {weather.feels_like ?? weather.temp}°</div>
        </div>
      </div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t2)', marginBottom: '6px', textTransform: 'capitalize' }}>
        {weather.condition}
      </div>
      <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--t3)' }}>
        <span>💧 {weather.humidity}%</span>
        <span>💨 {weather.wind} km/h</span>
      </div>
    </div>
  );
}

Object.assign(window, { AnalogClock, WeatherCard });
