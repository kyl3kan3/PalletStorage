// Shared app shell: sidebar + top bar, themed.

function Shell({ theme, active, children, actions, greeting, personality }) {
  const nav = [
    { key: 'home', label: 'Home', icon: Ic.Home },
    { key: 'overview', label: 'Overview', icon: Ic.Chart },
    { key: 'inbound', label: 'Inbound', icon: Ic.Inbound, badge: 8 },
    { key: 'outbound', label: 'Outbound', icon: Ic.Outbound, badge: 34 },
    { key: 'inventory', label: 'Inventory', icon: Ic.Scan },
    { key: 'products', label: 'Products', icon: Ic.Boxes },
    { key: 'warehouses', label: 'Warehouses', icon: Ic.Warehouse },
    { key: 'counts', label: 'Cycle counts', icon: Ic.Clipboard, badge: 4 },
  ];
  return (
    <div style={{
      width: '100%', height: '100%', display: 'grid', gridTemplateColumns: '232px 1fr',
      background: theme.bg, color: theme.body, fontFamily: FONTS.sans, overflow: 'hidden',
    }}>
      {/* Sidebar */}
      <aside style={{
        background: theme.mode === 'dark' ? theme.bgAlt : theme.bgAlt,
        borderRight: `1.5px solid ${theme.border}`,
        padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{ padding: '6px 8px 18px' }}>
          <Wordmark theme={theme} size={20} />
        </div>
        <Btn theme={theme} variant="accent" size="sm" icon={Ic.Plus} style={{ marginBottom: 14 }}>Quick action</Btn>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: theme.mutedSoft, padding: '4px 10px', letterSpacing: 0.8, textTransform: 'uppercase' }}>Workspace</div>
        {nav.map((n) => {
          const on = active === n.key;
          return (
            <div key={n.key} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
              background: on ? theme.surface : 'transparent',
              color: on ? theme.ink : theme.body,
              border: on ? `1.5px solid ${theme.border}` : '1.5px solid transparent',
              boxShadow: on ? '0 1px 2px rgba(0,0,0,.04)' : 'none',
              fontSize: 13.5, fontWeight: on ? 600 : 500,
              position: 'relative',
            }}>
              {on && <div style={{ position: 'absolute', left: -16, top: 10, bottom: 10, width: 3, borderRadius: 2, background: theme.primary }} />}
              <n.icon size={16} color={on ? theme.primaryDeep : theme.muted} />
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.badge && (
                <span style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: theme.muted, background: theme.surfaceAlt, padding: '1px 7px', borderRadius: 8 }}>{n.badge}</span>
              )}
            </div>
          );
        })}
        <div style={{ flex: 1 }} />
        <Card theme={theme} padding={14} tint="primary" style={{ borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cubby size={40} theme={theme} mood="happy" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.ink, fontFamily: FONTS.display, fontStyle: 'italic' }}>Hi, I'm Cubby!</div>
              <div style={{ fontSize: 11, color: theme.muted }}>Tap me for a tour →</div>
            </div>
          </div>
        </Card>
      </aside>

      {/* Main */}
      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 28px', borderBottom: `1.5px solid ${theme.border}`,
          background: theme.bg,
        }}>
          {greeting && (
            <div>
              <div style={{ fontSize: 11, color: theme.muted, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>{greeting.eyebrow}</div>
              <div style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: theme.ink, letterSpacing: -0.3 }}>{greeting.title}</div>
            </div>
          )}
          <Search theme={theme} placeholder="Search pallets, SKUs, orders…" width={320} />
          <div style={{ flex: 1 }} />
          {actions}
          <div style={{ display: 'inline-flex', padding: 3, background: theme.surfaceAlt, borderRadius: 10 }}>
            <div style={{ padding: '5px 8px', borderRadius: 7, background: theme.mode === 'light' ? theme.surface : 'transparent', display: 'grid', placeItems: 'center' }}>
              <Ic.Sun size={14} color={theme.mode === 'light' ? theme.primaryDeep : theme.muted} />
            </div>
            <div style={{ padding: '5px 8px', borderRadius: 7, background: theme.mode === 'dark' ? theme.surface : 'transparent', display: 'grid', placeItems: 'center' }}>
              <Ic.Moon size={14} color={theme.mode === 'dark' ? theme.primary : theme.muted} />
            </div>
          </div>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: theme.primary, display: 'grid', placeItems: 'center', color: theme.primaryText, fontWeight: 700, fontSize: 13 }}>JR</div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>{children}</div>
      </main>
    </div>
  );
}

function PageTitle({ theme, eyebrow, title, subtitle, right, tabs, tabActive }) {
  return (
    <div style={{ padding: '22px 28px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <div style={{ flex: 1 }}>
          {eyebrow && <div style={{ fontSize: 11, color: theme.muted, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>{eyebrow}</div>}
          <div style={{ fontFamily: FONTS.display, fontSize: 32, fontWeight: 600, color: theme.ink, letterSpacing: -0.8, lineHeight: 1.05 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 14, color: theme.muted, marginTop: 6, maxWidth: 560 }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>{right}</div>
      </div>
      {tabs && (
        <div style={{ marginTop: 16 }}>
          <Tabs theme={theme} items={tabs} active={tabActive || (tabs[0].key || tabs[0])} />
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Shell, PageTitle });
