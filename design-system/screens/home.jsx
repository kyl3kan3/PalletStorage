// Home screen — warm, friendly landing
function ScreenHome({ theme }) {
  const t = theme;
  return (
    <Shell theme={t} active="home" greeting={{ eyebrow: 'WH-01 · Tacoma · 2:14 PM', title: 'Home' }}
      actions={<Btn theme={t} variant="secondary" size="sm" icon={Ic.Bell}>3</Btn>}>
      <div style={{ padding: 28, overflow: 'auto', height: '100%' }}>
        {/* Hero */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 20, marginBottom: 22 }}>
          <Card theme={t} padding={28} tint="primary" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.18 }}>
              <Cubby size={240} theme={t} mood="happy" />
            </div>
            <div style={{ position: 'relative', maxWidth: 380 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.primaryDeep, textTransform: 'uppercase', letterSpacing: 0.6 }}>Good afternoon, Jordan</div>
              <div style={{ fontFamily: FONTS.display, fontSize: 38, fontWeight: 600, letterSpacing: -1.2, color: t.ink, lineHeight: 1.05, marginTop: 8, fontStyle: 'italic' }}>
                42 picks in flight,<br/>2 trucks at the dock.
              </div>
              <div style={{ fontSize: 14, color: t.body, marginTop: 10, lineHeight: 1.5 }}>You're <b>ahead of pace</b> — ship targets look good through 6pm.</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <Btn theme={t} variant="primary" size="md" icon={Ic.Lightning}>See today's plan</Btn>
                <Btn theme={t} variant="ghost" size="md">What's new →</Btn>
              </div>
            </div>
          </Card>
          <Card theme={t} padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 10px' }}>
              <div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Needs you</div>
              <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: t.ink, marginTop: 2 }}>3 things to peek at</div>
            </div>
            {[
              { tone: 'coral', icon: Ic.Truck, t: 'PO-7821 short-shipped', s: 'Sunrise Organics · 18 units missing' },
              { tone: 'primary', icon: Ic.Clipboard, t: 'Cycle count CC-0412 overdue', s: 'Zone B3 · Cold' },
              { tone: 'sky', icon: Ic.Dollar, t: '2 invoices ready for QuickBooks', s: 'SO-24875, SO-24876' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 20px', borderTop: `1.5px dashed ${t.border}`, alignItems: 'center' }}>
                <SquircleIcon theme={t} icon={r.icon} tint={r.tone} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: t.ink }}>{r.t}</div>
                  <div style={{ fontSize: 12, color: t.muted }}>{r.s}</div>
                </div>
                <Ic.Arrow size={14} color={t.muted} />
              </div>
            ))}
          </Card>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
          <StatBig theme={t} label="Received today" value="284" delta="+12%" />
          <StatBig theme={t} label="Shipped today" value="412" delta="+4%" />
          <StatBig theme={t} label="Dock-to-stock" value="47m" delta="−8m" tint="mint" />
          <StatBig theme={t} label="On-time ship" value="96%" delta="+1%" tint="primary" />
        </div>

        {/* Quick jump */}
        <div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginBottom: 10 }}>Jump in</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { icon: Ic.Inbound, tint: 'primary', t: 'Inbound', s: '8 active receipts' },
            { icon: Ic.Outbound, tint: 'coral', t: 'Outbound', s: '34 open orders' },
            { icon: Ic.Scan, tint: 'mint', t: 'Scan', s: 'Find a pallet' },
            { icon: Ic.Clipboard, tint: 'sky', t: 'Cycle counts', s: '4 due this week' },
          ].map((r, i) => (
            <Card key={i} theme={t} padding={16} interactive>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <SquircleIcon theme={t} icon={r.icon} tint={r.tint} size={42} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>{r.t}</div>
                  <div style={{ fontSize: 12, color: t.muted }}>{r.s}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Shell>
  );
}

// Overview — "stories over tables"
function ScreenOverview({ theme }) {
  const t = theme;
  const bars = [22, 28, 34, 41, 38, 46, 52, 48, 40, 36, 30, 24];
  return (
    <Shell theme={t} active="overview"
      actions={<>
        <Btn theme={t} variant="secondary" size="sm" icon={Ic.Calendar}>Last 30 days</Btn>
        <Btn theme={t} variant="secondary" size="sm" icon={Ic.Download}>Export</Btn>
      </>}>
      <PageTitle theme={t} eyebrow="How the floor is doing" title="Overview" subtitle="Numbers for this week, rolled up and easy to scan." />
      <div style={{ padding: '8px 28px 28px', overflow: 'auto', height: 'calc(100% - 116px)' }}>
        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          <StatBig theme={t} label="Pallets stored" value="4,820" delta="+124" tint="primary" />
          <StatBig theme={t} label="Open inbound" value="8" delta="−2" />
          <StatBig theme={t} label="Picking" value="12" />
          <StatBig theme={t} label="Moves / 24h" value="1,284" delta="+6%" tint="mint" />
        </div>

        {/* Throughput chart */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
          <Card theme={t} padding={22}>
            <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Throughput</div>
                <div style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 600, color: t.ink, letterSpacing: -0.4 }}>Pallets in & out, today</div>
              </div>
              <Tabs theme={t} items={[{ key: 'in', label: 'In' }, { key: 'out', label: 'Out' }, { key: 'all', label: 'Both' }]} active="all" />
            </div>
            {/* Bar chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, padding: '0 4px' }}>
              {bars.map((h, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: '100%', height: 160 - h*2.5, minHeight: 6, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', height: h * 2.5, background: i === 6 ? t.primary : (i % 2 ? t.primarySoft : t.surfaceAlt), borderRadius: 8, border: `1.5px solid ${i === 6 ? t.primaryDeep : t.border}` }} />
                  </div>
                  <div style={{ fontSize: 10, color: t.muted, fontFamily: FONTS.mono }}>{6 + i}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: t.muted, marginTop: 10 }}>Peak at <b style={{ color: t.ink }}>12pm</b> · 52 pallets</div>
          </Card>

          <Card theme={t} padding={22}>
            <div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Dock-to-stock</div>
            <div style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 600, color: t.ink, letterSpacing: -0.4 }}>Fast and getting faster</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 18 }}>
              <Ring theme={t} size={96} value={0.74} stroke={10} label="47m" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                <div><span style={{ color: t.muted }}>p50</span> <b style={{ fontFamily: FONTS.mono, color: t.ink }}>38m</b></div>
                <div><span style={{ color: t.muted }}>p95</span> <b style={{ fontFamily: FONTS.mono, color: t.ink }}>1h 12m</b></div>
                <div><span style={{ color: t.muted }}>vs last week</span> <b style={{ color: t.mode==='dark'?t.mint:'#1F6B45', fontFamily: FONTS.mono }}>−8m</b></div>
              </div>
            </div>
          </Card>
        </div>

        {/* Top SKUs + recent moves */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16 }}>
          <Card theme={t} padding={0}>
            <div style={{ padding: '16px 22px 10px', display: 'flex', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Top stock</div>
                <div style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: t.ink, letterSpacing: -0.3 }}>Most on hand</div>
              </div>
              <div style={{ marginLeft: 'auto' }}><Btn theme={t} variant="ghost" size="sm">See all →</Btn></div>
            </div>
            {[
              { sku: 'SKU-00421', name: 'Organic Quinoa 2kg', qty: 4820, p: 14, tone: 'primary' },
              { sku: 'SKU-00137', name: 'Cold-Press Olive Oil 1L', qty: 3412, p: 9, tone: 'mint' },
              { sku: 'SKU-01902', name: 'Dried Apricots 500g', qty: 2104, p: 6, tone: 'sky' },
              { sku: 'SKU-00815', name: 'Dark Chocolate Bars', qty: 1988, p: 5, tone: 'coral' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto auto', gap: 14, padding: '12px 22px', alignItems: 'center', borderTop: `1.5px dashed ${t.border}` }}>
                <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.ink, fontWeight: 600 }}>{r.sku}</span>
                <span style={{ color: t.body, fontSize: 13 }}>{r.name}</span>
                <Tag theme={t} tone={r.tone}>{r.p} pallets</Tag>
                <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 600, minWidth: 60, textAlign: 'right' }}>{r.qty.toLocaleString()}</span>
              </div>
            ))}
          </Card>

          <Card theme={t} padding={0}>
            <div style={{ padding: '16px 22px 10px', display: 'flex', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Moves</div>
                <div style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: t.ink, letterSpacing: -0.3 }}>Just now</div>
              </div>
              <div style={{ marginLeft: 'auto' }}><Btn theme={t} variant="ghost" size="sm">All activity →</Btn></div>
            </div>
            {[
              { ago: 'now', who: 'M. Rivera', act: 'moved', what: 'P-9QK4X72L', to: 'A2-02-B', tone: 'mint' },
              { ago: '2m', who: 'Scanner 04', act: 'received', what: 'PO-7821', to: 'Dock 3', tone: 'primary' },
              { ago: '5m', who: 'S. Park', act: 'picked', what: '12 ea · SKU-00421', to: 'SO-24881', tone: 'coral' },
              { ago: '8m', who: 'A. Torres', act: 'counted', what: 'CC-0418', to: '84 items', tone: 'sky' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 22px', borderTop: `1.5px dashed ${t.border}`, alignItems: 'center' }}>
                <div style={{ width: 46, textAlign: 'right', fontFamily: FONTS.mono, fontSize: 11, color: t.muted }}>{r.ago}</div>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: r.tone === 'mint' ? t.mint : r.tone === 'primary' ? t.primary : r.tone === 'coral' ? t.coral : t.sky }} />
                <div style={{ flex: 1, fontSize: 13 }}>
                  <b style={{ color: t.ink }}>{r.who}</b> <span style={{ color: t.muted }}>{r.act}</span> <span style={{ fontFamily: FONTS.mono, color: t.ink }}>{r.what}</span> <span style={{ color: t.muted }}>→ {r.to}</span>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </Shell>
  );
}

Object.assign(window, { ScreenHome, ScreenOverview });
