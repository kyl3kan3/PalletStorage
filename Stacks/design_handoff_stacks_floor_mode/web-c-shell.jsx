// Web — "Floor mode" (variation C extended to desktop)
// Dark operations-center: near-black, marigold-bold, huge mono numbers,
// commanding KPIs, scanner-first sensibility.

// ─── Theme ───────────────────────────────────────────────────
function floorTheme() {
  return {
    mode: 'floor',
    bg:           '#0B0907',
    bgAlt:        '#0F0C0A',
    surface:      'rgba(255,255,255,.04)',
    surfaceAlt:   'rgba(255,255,255,.07)',
    surfaceLift:  'rgba(255,255,255,.06)',
    border:       'rgba(255,255,255,.08)',
    borderStrong: 'rgba(255,255,255,.16)',
    ink:          '#FBF5E9',
    body:         '#E8DFCF',
    muted:        'rgba(255,255,255,.55)',
    mutedSoft:    'rgba(255,255,255,.32)',
    primary:      '#FFB23E',
    primaryText:  '#1F1308',
    primaryDeep:  '#E88F10',
    primarySoft:  'rgba(255,178,62,.12)',
    primaryGlow:  'rgba(255,178,62,.35)',
    coral:        '#FF6B5B',
    coralSoft:    'rgba(255,107,91,.14)',
    mint:         '#7FD8A8',
    mintSoft:     'rgba(127,216,168,.14)',
    sky:          '#7BB4E8',
    skySoft:      'rgba(123,180,232,.14)',
    lilac:        '#C9B8F0',
  };
}

// ─── Reusable bits ───────────────────────────────────────────
function FPill({ t, tone = 'neutral', size = 'md', children }) {
  const map = {
    primary: { bg: t.primarySoft, fg: t.primary, border: 'rgba(255,178,62,.35)' },
    mint:    { bg: t.mintSoft,    fg: t.mint,    border: 'rgba(127,216,168,.35)' },
    coral:   { bg: t.coralSoft,   fg: t.coral,   border: 'rgba(255,107,91,.4)' },
    sky:     { bg: t.skySoft,     fg: t.sky,     border: 'rgba(123,180,232,.35)' },
    neutral: { bg: t.surface,     fg: t.muted,   border: t.border },
    lilac:   { bg: 'rgba(201,184,240,.14)', fg: t.lilac, border: 'rgba(201,184,240,.3)' },
  }[tone];
  const sz = size === 'sm' ? { px: 7, py: 2, fs: 10 } : { px: 10, py: 4, fs: 11 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: `${sz.py}px ${sz.px}px`, borderRadius: 999,
      background: map.bg, color: map.fg,
      border: `1px solid ${map.border}`,
      fontFamily: FONTS.mono, fontSize: sz.fs, fontWeight: 700, letterSpacing: 0.4,
      textTransform: 'uppercase',
    }}>{children}</span>
  );
}

function FCard({ t, children, padding = 18, accent, style }) {
  return (
    <div style={{
      background: t.surface,
      border: `1px solid ${t.border}`,
      borderRadius: 18, padding,
      boxShadow: '0 1px 0 rgba(255,255,255,.03), 0 8px 24px rgba(0,0,0,.4)',
      position: 'relative',
      ...(accent ? { borderTop: `2px solid ${t.primary}` } : {}),
      ...(style || {}),
    }}>{children}</div>
  );
}

function FBtn({ t, variant = 'primary', size = 'md', icon, children, style, ...rest }) {
  const sz = {
    sm: { padding: '6px 12px', fs: 11.5 },
    md: { padding: '10px 18px', fs: 13 },
    lg: { padding: '14px 22px', fs: 15 },
  }[size];
  const v = {
    primary: { bg: t.primary, fg: t.primaryText, border: t.primary, shadow: `0 8px 22px ${t.primaryGlow}, inset 0 -2px 0 rgba(0,0,0,.15)` },
    ghost:   { bg: 'transparent', fg: t.ink, border: t.borderStrong, shadow: 'none' },
    light:   { bg: '#fff', fg: '#0F0C0A', border: '#fff', shadow: 'inset 0 -2px 0 rgba(0,0,0,.1)' },
    danger:  { bg: t.coralSoft, fg: t.coral, border: 'rgba(255,107,91,.35)', shadow: 'none' },
  }[variant];
  return (
    <button {...rest} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: sz.padding, fontSize: sz.fs, fontFamily: FONTS.sans,
      fontWeight: 700, letterSpacing: -0.1,
      background: v.bg, color: v.fg, border: `1.5px solid ${v.border}`,
      borderRadius: 12, cursor: 'pointer',
      boxShadow: v.shadow,
      ...(style || {}),
    }}>
      {icon ? React.createElement(icon, { size: sz.fs + 2 }) : null}
      {children}
    </button>
  );
}

// Big KPI tile with mono number + label + delta + sparkline-ish bar
function KPI({ t, label, value, suffix, delta, deltaTone = 'mint', spark, accent }) {
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16,
      padding: 18, position: 'relative', overflow: 'hidden',
      borderTop: accent ? `2px solid ${t.primary}` : `1px solid ${t.border}`,
    }}>
      <div style={{ fontFamily: FONTS.mono, fontSize: 10.5, fontWeight: 700, color: t.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: 40, fontWeight: 800, color: t.ink, letterSpacing: -1, lineHeight: 1 }}>{value}</span>
        {suffix && <span style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 600, color: t.muted }}>{suffix}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        {delta && (
          <span style={{ fontFamily: FONTS.mono, fontSize: 11, fontWeight: 800, color: deltaTone === 'coral' ? t.coral : t.mint }}>{delta}</span>
        )}
        {spark && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, flex: 1, height: 18, marginLeft: 'auto' }}>
            {spark.map((h, i) => (
              <div key={i} style={{ width: 4, height: `${h}%`, background: i === spark.length - 1 ? t.primary : 'rgba(255,255,255,.18)', borderRadius: 1 }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shell ───────────────────────────────────────────────────
function FShell({ t, active, title, eyebrow, subtitle, actions, tabs, tabActive, children }) {
  const nav = [
    { k: 'home',      l: 'Home',         i: Ic.Home },
    { k: 'overview',  l: 'Operations',   i: Ic.Chart },
    { k: 'inbound',   l: 'Inbound',      i: Ic.Inbound,   badge: 8 },
    { k: 'outbound',  l: 'Outbound',     i: Ic.Outbound,  badge: 34 },
    { k: 'inventory', l: 'Inventory',    i: Ic.Scan },
    { k: 'products',  l: 'Products',     i: Ic.Boxes },
    { k: 'warehouses',l: 'Warehouses',   i: Ic.Warehouse },
    { k: 'counts',    l: 'Cycle counts', i: Ic.Clipboard, badge: 4 },
  ];
  return (
    <div style={{
      width: '100%', height: '100%', display: 'grid', gridTemplateColumns: '240px 1fr',
      background: t.bg, color: t.body, fontFamily: FONTS.sans, overflow: 'hidden',
    }}>
      {/* Sidebar */}
      <aside style={{
        background: t.bgAlt,
        borderRight: `1px solid ${t.border}`,
        padding: '22px 14px', display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ padding: '4px 10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cubby size={26} theme={{ ...t, primary: t.primary, primaryDeep: t.primaryDeep, ink: '#FBF5E9' }} />
          <span style={{ fontFamily: FONTS.display, fontStyle: 'italic', fontSize: 20, fontWeight: 600, color: t.ink, letterSpacing: -0.5 }}>stacks<span style={{ color: t.primary }}>.</span></span>
          <span style={{ marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 9, fontWeight: 700, color: t.primary, letterSpacing: 1, padding: '2px 6px', borderRadius: 4, background: t.primarySoft, border: `1px solid rgba(255,178,62,.3)` }}>OPS</span>
        </div>

        <FBtn t={t} size="md" icon={Ic.Scan} style={{ marginBottom: 14, justifyContent: 'flex-start' }}>Open scanner</FBtn>

        <div style={{ fontFamily: FONTS.mono, fontSize: 9.5, fontWeight: 700, color: t.mutedSoft, padding: '6px 10px', letterSpacing: 1.2, textTransform: 'uppercase' }}>Workspace</div>
        {nav.map((n) => {
          const on = active === n.k;
          return (
            <div key={n.k} style={{
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
              background: on ? t.surfaceLift : 'transparent',
              color: on ? t.ink : t.body,
              fontSize: 13, fontWeight: on ? 700 : 500,
              position: 'relative', letterSpacing: -0.1,
            }}>
              {on && <div style={{ position: 'absolute', left: -14, top: 8, bottom: 8, width: 3, borderRadius: 2, background: t.primary, boxShadow: `0 0 12px ${t.primaryGlow}` }} />}
              <n.i size={16} color={on ? t.primary : t.muted} />
              <span style={{ flex: 1 }}>{n.l}</span>
              {n.badge && (
                <span style={{ fontFamily: FONTS.mono, fontSize: 10, fontWeight: 700, color: on ? t.primary : t.muted, background: on ? t.primarySoft : t.surface, padding: '2px 7px', borderRadius: 6, border: `1px solid ${on ? 'rgba(255,178,62,.3)' : t.border}` }}>{n.badge}</span>
              )}
            </div>
          );
        })}

        <div style={{ flex: 1 }} />

        {/* live status */}
        <div style={{ padding: 12, borderRadius: 12, background: t.surface, border: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: 4, background: t.mint, boxShadow: `0 0 8px ${t.mint}` }} />
            <span style={{ fontFamily: FONTS.mono, fontSize: 10, fontWeight: 700, color: t.mint, letterSpacing: 0.6 }}>LIVE · 42 ON FLOOR</span>
          </div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: t.muted, marginTop: 6 }}>WH-01 · TACOMA</div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: t.muted }}>{new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} · SHIFT 2 of 3</div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 28px', borderBottom: `1px solid ${t.border}`,
          background: t.bg, position: 'relative', zIndex: 2,
        }}>
          {/* search */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '9px 14px', borderRadius: 12,
            background: t.surface, border: `1px solid ${t.border}`,
            width: 360, color: t.muted,
          }}>
            <Ic.Search size={14} color={t.muted} />
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, letterSpacing: 0.2 }}>P-… · SO-… · SKU-… · A2-02-B</span>
            <span style={{ marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 10, color: t.mutedSoft, padding: '2px 6px', borderRadius: 4, background: t.surface, border: `1px solid ${t.border}` }}>⌘ K</span>
          </div>
          <div style={{ flex: 1 }} />
          {actions}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 6px 12px', borderRadius: 12, background: t.surface, border: `1px solid ${t.border}` }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: t.ink, fontWeight: 600 }}>Jordan Reyes</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.muted }}>MANAGER · WH-01</div>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: t.primary, color: t.primaryText, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 12 }}>JR</div>
          </div>
        </div>

        {/* Page title */}
        {(title || eyebrow) && (
          <div style={{ padding: '24px 28px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
              <div style={{ flex: 1 }}>
                {eyebrow && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FONTS.mono, fontSize: 10.5, color: t.primary, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 800, marginBottom: 8, padding: '4px 10px', borderRadius: 999, background: t.primarySoft, border: `1px solid rgba(255,178,62,.3)` }}>{eyebrow}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                  <h1 style={{ margin: 0, fontFamily: FONTS.sans, fontSize: 36, fontWeight: 800, color: t.ink, letterSpacing: -1.4, lineHeight: 1 }}>{title}</h1>
                  {subtitle && <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted, letterSpacing: 0.3 }}>{subtitle}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>{actions ? null : null}{tabs ? null : null}</div>
            </div>
            {tabs && (
              <div style={{ marginTop: 18, display: 'inline-flex', gap: 4, padding: 4, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12 }}>
                {tabs.map((tb) => {
                  const isActive = (tb.key || tb) === (tabActive || (tabs[0].key || tabs[0]));
                  return (
                    <div key={tb.key || tb} style={{
                      padding: '7px 14px', borderRadius: 8,
                      background: isActive ? t.primary : 'transparent',
                      color: isActive ? t.primaryText : t.muted,
                      fontFamily: FONTS.mono, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4,
                      textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                      {tb.label || tb}
                      {tb.count != null && (
                        <span style={{ fontSize: 10, color: isActive ? t.primaryText : t.mutedSoft, opacity: 0.7 }}>{tb.count}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '0 28px 28px' }}>{children}</div>
      </main>
    </div>
  );
}

Object.assign(window, { floorTheme, FPill, FCard, FBtn, KPI, FShell });
