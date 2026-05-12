// Reusable UI primitives — all rounded, warm, soft shadows.

function Btn({ theme, variant = 'primary', size = 'md', icon, children, full, style, ...rest }) {
  const t = theme;
  const sizes = {
    sm: { padding: '6px 12px', fontSize: 12.5, radius: 10, iconSize: 13, gap: 6 },
    md: { padding: '9px 16px', fontSize: 13.5, radius: 12, iconSize: 15, gap: 7 },
    lg: { padding: '12px 20px', fontSize: 15, radius: 14, iconSize: 17, gap: 8 },
  }[size];

  const variants = {
    primary: { bg: t.ink, fg: t.primary, border: t.ink, shadow: '0 2px 0 rgba(0,0,0,.2), 0 4px 12px rgba(0,0,0,.12)' },
    accent:  { bg: t.primary, fg: t.primaryText, border: t.primary, shadow: '0 2px 0 rgba(0,0,0,.15), 0 4px 12px rgba(255,178,62,.3)' },
    secondary: { bg: t.surface, fg: t.ink, border: t.borderStrong, shadow: 'none' },
    ghost: { bg: 'transparent', fg: t.ink, border: 'transparent', shadow: 'none' },
    danger: { bg: t.coral, fg: '#fff', border: t.coral, shadow: 'none' },
  }[variant];

  return (
    <button {...rest} style={{
      display: 'inline-flex', alignItems: 'center', gap: sizes.gap,
      padding: sizes.padding, fontSize: sizes.fontSize, fontFamily: FONTS.sans, fontWeight: 600,
      background: variants.bg, color: variants.fg,
      border: `1.5px solid ${variants.border}`, borderRadius: sizes.radius,
      boxShadow: variants.shadow,
      width: full ? '100%' : undefined, justifyContent: full ? 'center' : undefined,
      cursor: 'pointer', transition: 'transform .08s, box-shadow .12s',
      letterSpacing: -0.1,
      ...(style || {}),
    }}>
      {icon ? React.createElement(icon, { size: sizes.iconSize }) : null}
      {children}
    </button>
  );
}

function Card({ theme, children, padding = 18, radius = 20, interactive, tint, style, ...rest }) {
  const bg = tint === 'primary' ? theme.primarySoft :
             tint === 'mint' ? theme.mintSoft :
             tint === 'coral' ? theme.coralSoft :
             tint === 'sky' ? theme.skySoft :
             tint === 'alt' ? theme.surfaceAlt : theme.surface;
  return (
    <div {...rest} style={{
      background: bg, borderRadius: radius, padding,
      border: `1.5px solid ${theme.border}`,
      boxShadow: theme.shadow,
      transition: interactive ? 'transform .15s, box-shadow .2s' : undefined,
      cursor: interactive ? 'pointer' : undefined,
      ...(style || {}),
    }}>{children}</div>
  );
}

function Tag({ theme, tone = 'neutral', children, style }) {
  const map = {
    primary: { bg: theme.primarySoft, fg: theme.primaryDeep, dot: theme.primary },
    mint: { bg: theme.mintSoft, fg: theme.mode === 'dark' ? theme.mint : '#1F6B45', dot: theme.mint },
    coral: { bg: theme.coralSoft, fg: theme.mode === 'dark' ? theme.coral : '#B53D30', dot: theme.coral },
    sky: { bg: theme.skySoft, fg: theme.mode === 'dark' ? theme.sky : '#2C5B8A', dot: theme.sky },
    neutral: { bg: theme.surfaceAlt, fg: theme.muted, dot: theme.mutedSoft },
    ink: { bg: theme.ink, fg: theme.bg, dot: theme.primary },
  }[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', borderRadius: 999,
      background: map.bg, color: map.fg,
      fontSize: 11.5, fontWeight: 600, fontFamily: FONTS.sans, letterSpacing: 0.1,
      ...(style || {}),
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: map.dot }} />
      {children}
    </span>
  );
}

function SquircleIcon({ theme, icon: I, tint = 'primary', size = 40 }) {
  const bg = tint === 'primary' ? theme.primarySoft :
             tint === 'mint' ? theme.mintSoft :
             tint === 'coral' ? theme.coralSoft :
             tint === 'sky' ? theme.skySoft :
             tint === 'lilac' ? 'rgba(201,184,240,.25)' :
             theme.surfaceAlt;
  const fg = tint === 'primary' ? theme.primaryDeep :
             tint === 'mint' ? (theme.mode === 'dark' ? theme.mint : '#1F6B45') :
             tint === 'coral' ? (theme.mode === 'dark' ? theme.coral : '#B53D30') :
             tint === 'sky' ? (theme.mode === 'dark' ? theme.sky : '#2C5B8A') :
             tint === 'lilac' ? '#6B4FB8' :
             theme.ink;
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32,
      background: bg, color: fg,
      display: 'grid', placeItems: 'center', flexShrink: 0,
    }}>
      <I size={size * 0.48} />
    </div>
  );
}

function StatBig({ theme, label, value, delta, deltaTone = 'mint', tint }) {
  return (
    <Card theme={theme} tint={tint} padding={20}>
      <div style={{ fontSize: 12, fontWeight: 500, color: theme.muted, letterSpacing: 0.2 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
        <div style={{ fontFamily: FONTS.display, fontSize: 38, fontWeight: 600, color: theme.ink, letterSpacing: -1, lineHeight: 1, fontFeatureSettings: '"ss01"' }}>{value}</div>
        {delta && (
          <span style={{ fontSize: 12, fontWeight: 600, color: deltaTone === 'coral' ? theme.coral : (theme.mode === 'dark' ? theme.mint : '#1F6B45') }}>{delta}</span>
        )}
      </div>
    </Card>
  );
}

// Progress ring (SVG)
function Ring({ theme, size = 64, value = 0.5, stroke = 7, color, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * value;
  const col = color || theme.primary;
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={theme.surfaceAlt} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
      </svg>
      {label && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600, color: theme.ink }}>{label}</div>
      )}
    </div>
  );
}

// Segment/tab strip
function Tabs({ theme, items, active, onChange }) {
  return (
    <div style={{ display: 'inline-flex', padding: 4, background: theme.surfaceAlt, borderRadius: 12, border: `1.5px solid ${theme.border}` }}>
      {items.map((it) => (
        <button key={it.key || it} onClick={() => onChange && onChange(it.key || it)}
          style={{
            padding: '7px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: FONTS.sans,
            color: active === (it.key || it) ? theme.ink : theme.muted,
            background: active === (it.key || it) ? theme.surface : 'transparent',
            border: 'none', borderRadius: 9, cursor: 'pointer',
            boxShadow: active === (it.key || it) ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
          {it.label || it}
          {it.count != null && <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: theme.muted }}>{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

// Search input
function Search({ theme, value, placeholder = 'Search…', width }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '9px 14px', borderRadius: 12,
      background: theme.surfaceAlt, border: `1.5px solid ${theme.border}`,
      width,
    }}>
      <Ic.Search size={14} color={theme.muted} />
      <input value={value} readOnly placeholder={placeholder}
        style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontFamily: FONTS.sans, fontSize: 13, color: theme.ink }} />
    </div>
  );
}

// Data row used in tables
function Row({ theme, cols, children, hover }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: cols, gap: 16,
      padding: '14px 20px', alignItems: 'center',
      borderTop: `1.5px dashed ${theme.border}`,
      fontSize: 13.5, color: theme.body, fontFamily: FONTS.sans,
    }}>
      {children}
    </div>
  );
}

Object.assign(window, { Btn, Card, Tag, SquircleIcon, StatBig, Ring, Tabs, Search, Row });
