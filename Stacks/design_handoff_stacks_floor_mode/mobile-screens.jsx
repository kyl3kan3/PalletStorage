// Stacks mobile — floor-staff screens, three variations.
// A: Warm editorial (Cubby companion, Fraunces italic, generous)
// B: Utility dense   (mono-heavy, info per row, minimal mascot)
// C: Dark scanner    (dark, huge hit targets, glove-friendly)

// ─────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────

function StatusBar({ dark, time = '8:42' }) {
  const c = dark ? '#fff' : '#000';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 28px 8px', fontFamily: '-apple-system, system-ui',
      fontWeight: 600, fontSize: 15, color: c, position: 'relative', zIndex: 10,
    }}>
      <span>{time}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx=".5" fill={c}/><rect x="4.5" y="5" width="3" height="6" rx=".5" fill={c}/><rect x="9" y="3" width="3" height="8" rx=".5" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx=".5" fill={c}/></svg>
        <svg width="14" height="11" viewBox="0 0 14 11"><path d="M7 3c1.7 0 3.3.7 4.5 1.7L12.5 4C11 2.6 9 2 7 2S3 2.6 1.5 4l1 .7C3.7 3.7 5.3 3 7 3z" fill={c}/><path d="M7 6c1 0 1.9.4 2.5 1L10.5 6c-1-1-2.2-1.5-3.5-1.5S4 5 3 6l1 1C4.6 6.4 5.5 6 7 6z" fill={c}/><circle cx="7" cy="9" r="1.3" fill={c}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x=".5" y=".5" width="20" height="10" rx="2.5" stroke={c} strokeOpacity=".4" fill="none"/><rect x="2" y="2" width="14" height="7" rx="1.4" fill={c}/><path d="M22 3.5v4c.7-.2 1.2-1 1.2-2s-.5-1.8-1.2-2z" fill={c} fillOpacity=".5"/></svg>
      </div>
    </div>
  );
}

function HomeIndicator({ dark }) {
  return (
    <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: 134, height: 5, borderRadius: 3, background: dark ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.3)' }} />
    </div>
  );
}

function Frame({ t, dark, children, bg }) {
  return (
    <div style={{
      width: 390, height: 844, borderRadius: 48, overflow: 'hidden',
      background: bg || (dark ? '#0F0C0A' : t.bg),
      position: 'relative', boxShadow: '0 30px 60px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.12)',
      fontFamily: FONTS.sans,
    }}>
      <StatusBar dark={dark} />
      <div style={{ position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)', width: 116, height: 33, borderRadius: 22, background: '#000', zIndex: 50 }} />
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        {children}
      </div>
      <HomeIndicator dark={dark} />
    </div>
  );
}

// Tab bar — three flavors
function TabBar({ t, variant, active = 'home' }) {
  const items = [
    { k: 'home',   label: 'Today',  icon: Ic.Home },
    { k: 'scan',   label: 'Scan',   icon: Ic.Scan },
    { k: 'tasks',  label: 'Tasks',  icon: Ic.Clipboard },
    { k: 'more',   label: 'More',   icon: Ic.Boxes },
  ];

  if (variant === 'C') {
    // dark — big chunky tab bar
    return (
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 14px 28px',
        background: 'linear-gradient(to top, rgba(0,0,0,.6), rgba(0,0,0,0))',
        display: 'flex', justifyContent: 'space-around',
      }}>
        {items.map((i) => (
          <div key={i.k} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '8px 10px', borderRadius: 14,
            background: active === i.k ? t.primary : 'transparent',
            color: active === i.k ? '#1F1308' : '#fff',
            minWidth: 64,
          }}>
            <i.icon size={22} color={active === i.k ? '#1F1308' : '#fff'} />
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2 }}>{i.label.toUpperCase()}</div>
          </div>
        ))}
      </div>
    );
  }

  // A & B — translucent floating
  const isA = variant === 'A';
  return (
    <div style={{
      position: 'absolute', bottom: 18, left: 14, right: 14,
      background: t.surface, borderRadius: 22, padding: '8px 8px',
      border: `1.5px solid ${t.border}`, boxShadow: t.shadowLift,
      display: 'flex', justifyContent: 'space-around',
    }}>
      {items.map((i) => (
        <div key={i.k} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          padding: '7px 10px', borderRadius: 14,
          background: active === i.k ? (isA ? t.primarySoft : t.surfaceAlt) : 'transparent',
          color: active === i.k ? t.ink : t.muted,
          minWidth: 56, transition: 'background .15s',
        }}>
          <i.icon size={20} color={active === i.k ? (isA ? t.primaryDeep : t.ink) : t.muted} />
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.1, fontFamily: isA ? FONTS.sans : FONTS.mono }}>
            {isA ? i.label : i.label.toLowerCase()}
          </div>
        </div>
      ))}
    </div>
  );
}

// Compact pill for densities
function Pill({ t, children, tone = 'neutral', size = 'md' }) {
  const map = {
    primary: { bg: t.primarySoft, fg: t.primaryDeep },
    mint:    { bg: t.mintSoft,    fg: t.mode === 'dark' ? t.mint : '#1F6B45' },
    coral:   { bg: t.coralSoft,   fg: t.mode === 'dark' ? t.coral : '#B53D30' },
    sky:     { bg: t.skySoft,     fg: t.mode === 'dark' ? t.sky : '#2C5B8A' },
    neutral: { bg: t.surfaceAlt,  fg: t.muted },
    ink:     { bg: t.ink,         fg: t.primary },
  }[tone];
  const sz = size === 'sm' ? { px: 7, py: 2, fs: 10.5 } : { px: 10, py: 3, fs: 11.5 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: `${sz.py}px ${sz.px}px`, borderRadius: 999,
      background: map.bg, color: map.fg, fontSize: sz.fs, fontWeight: 700,
      letterSpacing: 0.1,
    }}>{children}</span>
  );
}

Object.assign(window, { Frame, TabBar, StatusBar, HomeIndicator, Pill });
