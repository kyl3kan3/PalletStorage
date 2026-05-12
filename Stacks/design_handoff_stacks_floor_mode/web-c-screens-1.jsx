// Web Floor-mode screens: Home, Operations, Outbound (list+detail), Inventory

function WC_Home({ t }) {
  return (
    <FShell t={t} active="home" title="Operations · Tacoma"
      eyebrow="Live · Wednesday May 12"
      subtitle="14:22 PT · 42 staff on floor · 2 trucks at dock">
      {/* Hero alert strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18 }}>
        <FCard t={t} padding={24} accent>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
            <div style={{ flex: 1 }}>
              <FPill t={t} tone="primary">Throughput · ahead of pace</FPill>
              <div style={{ fontFamily: FONTS.sans, fontSize: 44, fontWeight: 800, color: t.ink, letterSpacing: -1.6, lineHeight: 1.02, marginTop: 14 }}>
                42 picks in flight,<br/>
                <span style={{ color: t.primary }}>2 trucks</span> at the dock.
              </div>
              <div style={{ fontSize: 14, color: t.muted, marginTop: 12, maxWidth: 480, lineHeight: 1.5 }}>Ship targets hold through 18:00. Inbound queue light through the rest of shift — good window to push variances.</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <FBtn t={t} variant="primary" size="md" icon={Ic.Lightning}>Today's plan</FBtn>
                <FBtn t={t} variant="ghost" size="md">Open shift report</FBtn>
              </div>
            </div>
            {/* mini sparkline column */}
            <div style={{ width: 180, padding: 14, background: t.bgAlt, borderRadius: 12, border: `1px solid ${t.border}` }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, fontWeight: 700, color: t.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>Last 8 hours</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, marginTop: 10 }}>
                {[22, 30, 28, 41, 48, 52, 46, 38].map((h, i) => (
                  <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 5 ? t.primary : 'rgba(255,255,255,.18)', borderRadius: 2, boxShadow: i === 5 ? `0 0 12px ${t.primaryGlow}` : 'none' }} />
                ))}
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.muted, marginTop: 8 }}>Peak <b style={{ color: t.ink }}>52 pal/h</b> · 12:00</div>
            </div>
          </div>
        </FCard>

        {/* Needs you feed */}
        <FCard t={t} padding={0}>
          <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
            <FPill t={t} tone="coral">Needs you · 3</FPill>
            <span style={{ marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 11, color: t.muted, letterSpacing: 0.3 }}>auto-sorted by urgency</span>
          </div>
          {[
            { tone: 'coral', icon: Ic.Truck,     t: 'PO-7821 short-shipped',      s: 'Sunrise Organics · 18 units missing',  when: '12m' },
            { tone: 'primary', icon: Ic.Clipboard, t: 'Cycle count CC-0412 overdue', s: 'Zone B3 · Cold · M. Rivera unassigned', when: '1h' },
            { tone: 'sky',   icon: Ic.Dollar,   t: '2 invoices ready for QBO',    s: 'SO-24875 · SO-24876 · $4,212.80',     when: '2h' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderTop: i ? `1px solid ${t.border}` : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: r.tone === 'coral' ? t.coralSoft : r.tone === 'primary' ? t.primarySoft : t.skySoft, display: 'grid', placeItems: 'center' }}>
                <r.icon size={17} color={r.tone === 'coral' ? t.coral : r.tone === 'primary' ? t.primary : t.sky} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{r.t}</div>
                <div style={{ fontSize: 11.5, color: t.muted, marginTop: 1 }}>{r.s}</div>
              </div>
              <span style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: t.muted, fontWeight: 700 }}>{r.when}</span>
            </div>
          ))}
        </FCard>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 20 }}>
        <KPI t={t} label="Received today"  value="284"  delta="+12%"   spark={[40,55,60,52,65,70,80,90]} accent />
        <KPI t={t} label="Shipped today"   value="412"  delta="+4%"    spark={[60,65,55,70,72,68,78,84]} />
        <KPI t={t} label="Dock to stock"   value="47"   suffix="min"  delta="−8m" deltaTone="mint" spark={[80,72,70,65,60,55,52,50]} />
        <KPI t={t} label="On-time ship"    value="96"   suffix="%"    delta="+1%" spark={[88,90,92,90,93,94,95,96]} />
      </div>

      {/* Action queue */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginTop: 20 }}>
        <FCard t={t} padding={0}>
          <div style={{ padding: '16px 18px 10px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
            <FPill t={t} tone="primary">Active waves · 4</FPill>
            <span style={{ marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 11, color: t.muted }}>updated 4s ago</span>
          </div>
          {[
            { ref: 'SO-24881', cust: 'Glacier Foods',     prog: 0.52, ship: '17:00', urgent: true, pickers: 2 },
            { ref: 'SO-24880', cust: 'Northwind Market',  prog: 1.00, ship: '18:00', pickers: 0,   status: 'packed' },
            { ref: 'SO-24878', cust: 'Alpine Cafés',      prog: 0.22, ship: 'tomorrow', pickers: 1 },
            { ref: 'PO-7821',  cust: 'Sunrise Organics',  prog: 0.60, ship: 'in @ 15:30', kind: 'recv', pickers: 1 },
          ].map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 110px 1fr 130px 90px', gap: 12, padding: '14px 18px', borderTop: i ? `1px solid ${t.border}` : 'none', alignItems: 'center' }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, fontWeight: 800, color: r.kind === 'recv' ? t.sky : t.primary, letterSpacing: 0.8 }}>{r.kind === 'recv' ? 'RECV' : 'PICK'}</div>
              <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: t.ink }}>{r.ref}</span>
              <div>
                <div style={{ fontSize: 13, color: t.body, fontWeight: 500 }}>{r.cust}</div>
                <div style={{ marginTop: 6, height: 4, background: t.surfaceAlt, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${r.prog * 100}%`, height: '100%', background: r.prog === 1 ? t.mint : r.kind === 'recv' ? t.sky : t.primary, boxShadow: r.urgent ? `0 0 6px ${t.primaryGlow}` : 'none' }} />
                </div>
              </div>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: r.urgent ? t.coral : t.muted, fontWeight: 700 }}>{r.ship}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {Array.from({ length: r.pickers }).map((_, k) => (
                  <div key={k} style={{ width: 22, height: 22, borderRadius: 7, background: t.surfaceAlt, border: `1px solid ${t.border}`, color: t.ink, display: 'grid', placeItems: 'center', fontFamily: FONTS.mono, fontSize: 9, fontWeight: 700 }}>{['MR','SP','AT'][k]}</div>
                ))}
                {r.pickers === 0 && <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.muted }}>—</span>}
              </div>
            </div>
          ))}
        </FCard>

        {/* Cubby ops card */}
        <FCard t={t} padding={20}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Cubby size={48} theme={{ ...t, primary: t.primary, primaryDeep: t.primaryDeep, ink: t.ink, charcoal: '#2E2824' }} mood="happy" />
            <div>
              <FPill t={t} tone="primary" size="sm">Cubby says</FPill>
              <div style={{ fontFamily: FONTS.sans, fontSize: 16, fontWeight: 700, color: t.ink, marginTop: 6, lineHeight: 1.35 }}>You're 12 minutes ahead of pace.</div>
            </div>
          </div>
          <div style={{ marginTop: 14, padding: 14, background: t.bgAlt, borderRadius: 10, border: `1px solid ${t.border}` }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 700 }}>Suggested next</div>
            <div style={{ fontSize: 13, color: t.ink, marginTop: 6, lineHeight: 1.5 }}>Pull <b style={{ fontFamily: FONTS.mono, color: t.primary }}>CC-0412</b> forward — Maya's free at 15:00 and zone B3 is quiet.</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <FBtn t={t} variant="primary" size="sm">Schedule</FBtn>
              <FBtn t={t} variant="ghost" size="sm">Later</FBtn>
            </div>
          </div>
          <div style={{ marginTop: 14, padding: 14, background: t.bgAlt, borderRadius: 10, border: `1px solid ${t.border}` }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 700 }}>Heads up</div>
            <div style={{ fontSize: 13, color: t.ink, marginTop: 6, lineHeight: 1.5 }}>WH-03 (Houston) at <b style={{ color: t.coral }}>86% full</b>. Consider diverting next Sunrise inbound to WH-02.</div>
          </div>
        </FCard>
      </div>
    </FShell>
  );
}

function WC_Operations({ t }) {
  const bars = [22, 28, 34, 41, 38, 46, 52, 48, 40, 36, 30, 24];
  const dashH = bars.map((_, i) => (i < 6 ? 'in' : 'out'));
  return (
    <FShell t={t} active="overview" title="Operations"
      eyebrow="Last 30 days"
      subtitle="WH-01 · live · auto-refresh 30s">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KPI t={t} label="Pallets stored"  value="4,820" delta="+124"  spark={[60,68,72,80,84,88,92,96]} accent />
        <KPI t={t} label="Open inbound"    value="8"     delta="−2"  deltaTone="mint" spark={[50,48,40,38,30,26,24,20]} />
        <KPI t={t} label="Picking"         value="12"    spark={[20,25,30,30,28,32,34,36]} />
        <KPI t={t} label="Moves · 24h"     value="1,284" suffix="ops" delta="+6%" spark={[60,72,68,78,84,82,90,94]} />
      </div>

      {/* Throughput + dock-to-stock */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginTop: 18 }}>
        <FCard t={t} padding={22}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <FPill t={t} tone="primary">Throughput · today</FPill>
              <div style={{ fontFamily: FONTS.sans, fontSize: 24, fontWeight: 800, color: t.ink, letterSpacing: -0.6, marginTop: 8 }}>Pallets in & out, hourly</div>
            </div>
            <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10 }}>
              {[['in','In'],['out','Out'],['all','Both']].map(([k, l], i) => (
                <div key={k} style={{ padding: '5px 10px', borderRadius: 6, background: k === 'all' ? t.primary : 'transparent', color: k === 'all' ? t.primaryText : t.muted, fontFamily: FONTS.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>{l}</div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 170, marginTop: 22 }}>
            {bars.map((h, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ width: '100%', height: 150 - h * 2.4, display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', height: h * 2.4, borderRadius: 6,
                    background: i === 6 ? t.primary : (dashH[i] === 'in' ? 'rgba(123,180,232,.45)' : 'rgba(255,178,62,.32)'),
                    boxShadow: i === 6 ? `0 0 16px ${t.primaryGlow}` : 'none',
                    border: i === 6 ? `1px solid ${t.primaryDeep}` : `1px solid ${t.border}`,
                  }} />
                </div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 9.5, color: t.muted }}>{6 + i}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 18, fontFamily: FONTS.mono, fontSize: 11, color: t.muted, marginTop: 12 }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(123,180,232,.45)', borderRadius: 2, marginRight: 6, verticalAlign: 'middle' }} /> Inbound</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(255,178,62,.32)', borderRadius: 2, marginRight: 6, verticalAlign: 'middle' }} /> Outbound</span>
            <span style={{ marginLeft: 'auto' }}>Peak at <b style={{ color: t.primary }}>12:00 · 52 pal</b></span>
          </div>
        </FCard>

        <FCard t={t} padding={22}>
          <FPill t={t} tone="mint">Dock to stock</FPill>
          <div style={{ fontFamily: FONTS.sans, fontSize: 24, fontWeight: 800, color: t.ink, letterSpacing: -0.6, marginTop: 8 }}>Fast and faster</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 22 }}>
            <div style={{ position: 'relative', width: 110, height: 110 }}>
              <svg width="110" height="110" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="55" cy="55" r="46" fill="none" stroke={t.surfaceAlt} strokeWidth="9" />
                <circle cx="55" cy="55" r="46" fill="none" stroke={t.primary} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 46 * 0.74} ${2 * Math.PI * 46}`} style={{ filter: `drop-shadow(0 0 8px ${t.primaryGlow})` }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <div style={{ fontFamily: FONTS.mono, fontSize: 22, fontWeight: 800, color: t.ink, letterSpacing: -0.5 }}>47m</div>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['p50', '38m', t.mint], ['p95', '1h 12m', t.muted], ['Δ wk', '−8m', t.mint]].map(([k, v, c]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 10px', background: t.bgAlt, borderRadius: 8, border: `1px solid ${t.border}` }}>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.muted, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700, width: 36 }}>{k}</span>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 800, color: c, marginLeft: 'auto' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </FCard>
      </div>

      {/* Top SKUs + recent moves */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, marginTop: 14 }}>
        <FCard t={t} padding={0}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
            <FPill t={t} tone="primary">Top stock</FPill>
            <span style={{ marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 11, color: t.muted }}>by on-hand</span>
          </div>
          {[
            { sku: 'SKU-00421', n: 'Organic Quinoa 2kg',     qty: 4820, p: 14, tone: 'primary' },
            { sku: 'SKU-00137', n: 'Cold-Press Olive Oil 1L', qty: 3412, p: 9,  tone: 'mint' },
            { sku: 'SKU-01902', n: 'Dried Apricots 500g',    qty: 2104, p: 6,  tone: 'sky' },
            { sku: 'SKU-00815', n: 'Dark Chocolate Bars',    qty: 1988, p: 5,  tone: 'coral' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr auto 80px', gap: 14, padding: '14px 20px', alignItems: 'center', borderTop: i ? `1px solid ${t.border}` : 'none' }}>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.ink, fontWeight: 700 }}>{r.sku}</span>
              <span style={{ color: t.body, fontSize: 13 }}>{r.n}</span>
              <FPill t={t} tone={r.tone} size="sm">{r.p} pal</FPill>
              <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 800, fontSize: 14, textAlign: 'right' }}>{r.qty.toLocaleString()}</span>
            </div>
          ))}
        </FCard>

        <FCard t={t} padding={0}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
            <FPill t={t} tone="mint">Movement ledger</FPill>
            <span style={{ marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 11, color: t.muted }}>live · just now</span>
          </div>
          {[
            { ago: 'now', who: 'M. Rivera', act: 'moved',    what: 'P-9QK4X72L',         to: 'A2-02-B', tone: t.mint },
            { ago: '2m',  who: 'Scanner 04', act: 'received', what: 'PO-7821',           to: 'Dock 3',  tone: t.primary },
            { ago: '5m',  who: 'S. Park',   act: 'picked',   what: '12 ea SKU-00421',   to: 'SO-24881', tone: t.coral },
            { ago: '8m',  who: 'A. Torres', act: 'counted',  what: 'CC-0418',           to: '84 items', tone: t.sky },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderTop: i ? `1px solid ${t.border}` : 'none' }}>
              <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.muted, fontWeight: 700, width: 28, textAlign: 'right' }}>{r.ago}</span>
              <div style={{ width: 7, height: 7, borderRadius: 4, background: r.tone, boxShadow: `0 0 6px ${r.tone}` }} />
              <div style={{ flex: 1, fontSize: 12.5 }}>
                <b style={{ color: t.ink }}>{r.who}</b> <span style={{ color: t.muted }}>{r.act}</span> <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>{r.what}</span> <span style={{ color: t.muted }}>→ {r.to}</span>
              </div>
            </div>
          ))}
        </FCard>
      </div>
    </FShell>
  );
}

function WC_OutboundList({ t }) {
  const rows = [
    { ref: 'SO-24881', cust: 'Glacier Foods Co.',   status: 'Picking',  tone: 'primary', ship: '17:00',     lines: 22, prog: 0.52, picker: 'MR' },
    { ref: 'SO-24880', cust: 'Northwind Market',    status: 'Packed',   tone: 'sky',     ship: '18:00',     lines: 14, prog: 1,    picker: 'SP' },
    { ref: 'SO-24879', cust: 'Harbor Bakeries',     status: 'Open',     tone: 'neutral', ship: 'Tomorrow',  lines: 8,  prog: 0,    picker: '—' },
    { ref: 'SO-24878', cust: 'Alpine Cafés',        status: 'Picking',  tone: 'primary', ship: 'Tomorrow',  lines: 11, prog: 0.22, picker: 'AT' },
    { ref: 'SO-24875', cust: 'Evergreen Grocer',    status: 'Shipped',  tone: 'mint',    ship: 'Apr 20',    lines: 28, prog: 1,    picker: 'MR' },
    { ref: 'SO-24874', cust: 'Cedar & Co.',         status: 'Shipped',  tone: 'mint',    ship: 'Apr 20',    lines: 18, prog: 1,    picker: 'SP' },
  ];
  return (
    <FShell t={t} active="outbound" title="Outbound"
      eyebrow="Going out the door · 34 open"
      subtitle="ship windows: today (4) · tomorrow (8) · week (22)"
      tabs={[
        { key: 'active',    label: 'Active',     count: 12 },
        { key: 'ready',     label: 'Ready',      count: 4 },
        { key: 'shipped',   label: 'Shipped' },
        { key: 'cancelled', label: 'Cancelled' },
      ]} tabActive="active"
      actions={<>
        <FBtn t={t} variant="ghost" size="sm" icon={Ic.Filter}>Filter</FBtn>
        <FBtn t={t} variant="primary" size="sm" icon={Ic.Plus}>New order</FBtn>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 6 }}>
        <KPI t={t} label="Open"     value="34" spark={[20,24,30,28,32,30,34,34]} />
        <KPI t={t} label="Picking"  value="12" delta="+3" spark={[8,9,10,11,10,12,12,12]} accent />
        <KPI t={t} label="Ready"    value="4"  spark={[2,3,2,3,4,4,3,4]} />
        <KPI t={t} label="On-time"  value="96" suffix="%" delta="+1%" spark={[88,90,90,92,93,94,95,96]} />
      </div>

      <FCard t={t} padding={0} style={{ marginTop: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 110px 130px 60px 200px 50px 36px', gap: 14, padding: '14px 22px', fontFamily: FONTS.mono, fontSize: 10, color: t.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 700, borderBottom: `1px solid ${t.border}` }}>
          <span>Reference</span><span>Customer</span><span>Status</span><span>Ship by</span><span style={{ textAlign: 'right' }}>Lines</span><span>Progress</span><span>Crew</span><span></span>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 110px 130px 60px 200px 50px 36px', gap: 14, padding: '16px 22px', alignItems: 'center', borderTop: i ? `1px solid ${t.border}` : 'none', background: r.status === 'Picking' ? t.primarySoft : 'transparent' }}>
            <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: t.ink }}>{r.ref}</span>
            <span style={{ color: t.body, fontSize: 13 }}>{r.cust}</span>
            <FPill t={t} tone={r.tone}>{r.status}</FPill>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted, fontWeight: 700 }}>{r.ship}</span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: t.ink, textAlign: 'right' }}>{r.lines}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 6, background: t.surfaceAlt, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${r.prog * 100}%`, height: '100%', background: r.tone === 'mint' ? t.mint : r.tone === 'sky' ? t.sky : t.primary, boxShadow: r.status === 'Picking' ? `0 0 8px ${t.primaryGlow}` : 'none' }} />
              </div>
              <span style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: t.muted, fontWeight: 700, minWidth: 28, textAlign: 'right' }}>{Math.round(r.prog * 100)}</span>
            </div>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: r.picker === '—' ? t.surfaceAlt : t.primarySoft, border: `1px solid ${r.picker === '—' ? t.border : 'rgba(255,178,62,.35)'}`, color: r.picker === '—' ? t.muted : t.primary, display: 'grid', placeItems: 'center', fontFamily: FONTS.mono, fontSize: 10, fontWeight: 800 }}>{r.picker}</div>
            <Ic.Arrow size={14} color={t.muted} />
          </div>
        ))}
      </FCard>
    </FShell>
  );
}

function WC_OutboundDetail({ t }) {
  const steps = [
    { k: 'Open',    done: true,  icon: Ic.Plus },
    { k: 'Picking', done: true,  active: true, icon: Ic.Boxes },
    { k: 'Packed',  done: false, icon: Ic.Package },
    { k: 'Shipped', done: false, icon: Ic.Truck },
  ];
  return (
    <FShell t={t} active="outbound" title="SO-24881"
      eyebrow="Outbound · picking"
      subtitle="Glacier Foods Co. · ship 17:00 · 1h 12m remaining"
      actions={<>
        <FBtn t={t} variant="danger" size="sm">Cancel order</FBtn>
        <FBtn t={t} variant="primary" size="sm" icon={Ic.Package}>Mark packed</FBtn>
      </>}>

      {/* Stepper */}
      <FCard t={t} padding={22} style={{ marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 90 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: s.active ? t.primary : s.done ? t.mintSoft : t.surface,
                  border: `1.5px solid ${s.active ? t.primaryDeep : s.done ? 'rgba(127,216,168,.4)' : t.border}`,
                  color: s.active ? t.primaryText : s.done ? t.mint : t.muted,
                  display: 'grid', placeItems: 'center',
                  boxShadow: s.active ? `0 0 22px ${t.primaryGlow}` : 'none',
                }}>
                  {s.done && !s.active ? <Ic.Check size={20} /> : <s.icon size={20} />}
                </div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 11, fontWeight: 700, color: s.active ? t.ink : t.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>{s.k}</div>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: s.done ? t.mint : t.surfaceAlt, borderRadius: 1, marginBottom: 22 }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </FCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, marginTop: 18 }}>
        {/* Lines */}
        <FCard t={t} padding={0}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
            <div style={{ fontFamily: FONTS.sans, fontSize: 18, fontWeight: 800, color: t.ink, letterSpacing: -0.4 }}>Lines</div>
            <FPill t={t} tone="primary" size="sm" style={{ marginLeft: 10 }}>11 of 22</FPill>
            <div style={{ marginLeft: 'auto' }}>
              <FBtn t={t} variant="ghost" size="sm" icon={Ic.Download}>Export</FBtn>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '30px 130px 1fr 60px 60px 130px', gap: 12, padding: '10px 20px', fontFamily: FONTS.mono, fontSize: 10, color: t.muted, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>
            <span>#</span><span>SKU</span><span>Name</span><span style={{ textAlign: 'right' }}>Ord</span><span style={{ textAlign: 'right' }}>Pkd</span><span>Progress</span>
          </div>
          {[
            { sku: 'SKU-00421', n: 'Organic Quinoa 2kg',     o: 48, p: 48, done: true },
            { sku: 'SKU-00815', n: 'Dark Chocolate Bars',    o: 36, p: 24, done: false, active: true },
            { sku: 'SKU-01902', n: 'Dried Apricots 500g',    o: 24, p: 24, done: true },
            { sku: 'SKU-00137', n: 'Cold-Press Olive Oil 1L', o: 60, p: 12, done: false },
            { sku: 'SKU-02431', n: 'Almond Butter 340g',     o: 18, p: 0,  done: false },
          ].map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '30px 130px 1fr 60px 60px 130px', gap: 12, padding: '12px 20px', borderTop: `1px solid ${t.border}`, alignItems: 'center', background: r.active ? t.primarySoft : 'transparent' }}>
              <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.muted, fontWeight: 700 }}>{i+1}</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700, color: t.ink }}>{r.sku}</span>
              <span style={{ color: t.body, fontSize: 13 }}>{r.n}</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, textAlign: 'right', color: t.muted, fontWeight: 700 }}>{r.o}</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 13, textAlign: 'right', color: r.done ? t.mint : t.ink, fontWeight: 800 }}>{r.p}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, height: 4, background: t.surfaceAlt, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(r.p / r.o) * 100}%`, height: '100%', background: r.done ? t.mint : t.primary }} />
                </div>
                {r.done && <Ic.Check size={12} color={t.mint} />}
              </div>
            </div>
          ))}
        </FCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Cubby ETA */}
          <FCard t={t} padding={20}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <Cubby size={52} theme={{ ...t, primary: t.primary, primaryDeep: t.primaryDeep, ink: t.ink, charcoal: '#2E2824' }} mood="think" />
              <div>
                <FPill t={t} tone="primary" size="sm">ETA · 22 min</FPill>
                <div style={{ fontFamily: FONTS.sans, fontSize: 16, fontWeight: 700, color: t.ink, marginTop: 6, lineHeight: 1.3 }}>2 pickers on it. Tracking ahead of ship window.</div>
              </div>
            </div>
          </FCard>

          {/* Crew */}
          <FCard t={t} padding={20}>
            <FPill t={t} tone="neutral">Crew · 2</FPill>
            {[
              { name: 'Maya Rivera', pct: 62, tone: t.primary, init: 'MR' },
              { name: 'Sol Park',    pct: 48, tone: t.sky,     init: 'SP' },
            ].map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: p.tone, color: t.primaryText, display: 'grid', placeItems: 'center', fontFamily: FONTS.mono, fontWeight: 800, fontSize: 12 }}>{p.init}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{p.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                    <div style={{ flex: 1, height: 5, background: t.surfaceAlt, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${p.pct}%`, height: '100%', background: p.tone }} />
                    </div>
                    <span style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: t.muted, minWidth: 28, textAlign: 'right', fontWeight: 700 }}>{p.pct}%</span>
                  </div>
                </div>
              </div>
            ))}
          </FCard>

          {/* Ship info */}
          <FCard t={t} padding={20}>
            <FPill t={t} tone="neutral">Ship</FPill>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 12, fontSize: 13 }}>
              {[
                ['Carrier',  'FedEx Freight', false],
                ['Dock',     'D-04',          true],
                ['Ship-to',  '1820 Pacific Ave\nPortland, OR', false],
                ['Weight',   '2,148 lb',      true],
              ].map(([k, v, mono]) => (
                <div key={k}>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.muted, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>{k}</div>
                  <div style={{ marginTop: 4, color: t.ink, fontFamily: mono ? FONTS.mono : FONTS.sans, fontWeight: 600, whiteSpace: 'pre-line' }}>{v}</div>
                </div>
              ))}
            </div>
          </FCard>
        </div>
      </div>
    </FShell>
  );
}

function WC_Inventory({ t }) {
  return (
    <FShell t={t} active="inventory" title="Inventory · Lookup"
      eyebrow="Scan or paste"
      subtitle="Pallets · Locations · Lots · SKUs · POs">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 22, marginTop: 6 }}>
        <div>
          {/* hero scan field */}
          <div style={{
            padding: 4, borderRadius: 26,
            background: `linear-gradient(180deg, ${t.primarySoft}, transparent)`,
            border: `2px solid ${t.primary}`,
            boxShadow: `0 0 0 8px ${t.primarySoft}, 0 24px 60px ${t.primaryGlow}`,
          }}>
            <div style={{ background: t.surface, borderRadius: 22, padding: 22, display: 'flex', alignItems: 'center', gap: 16 }}>
              <Ic.Scan size={32} color={t.primary} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: t.primary, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>Pallet · LPN</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 30, fontWeight: 800, color: t.ink, letterSpacing: 2.5, marginTop: 4 }}>P-9QK4X72L<span style={{ opacity: 0.4, animation: 'blink 1s steps(2) infinite' }}>|</span></div>
              </div>
              <FPill t={t} tone="mint">Stored</FPill>
            </div>
          </div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.muted, marginTop: 12, letterSpacing: 0.2 }}>P-XXXXXXXXXX · L-XXXXXXXXXX · PO-XXXX · SKU-XXXXX</div>

          {/* recent */}
          <div style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: t.muted, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 28 }}>Recent · this shift</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {[
              { c: 'P-9QK4X72L', k: 'Pallet',   at: 'A2-02-B',     ago: '12s' },
              { c: 'L-A2-02-B', k: 'Location', at: '14 pallets',   ago: '2m' },
              { c: 'P-7MJ3P01K', k: 'Pallet',   at: 'A3-04-C',     ago: '8m' },
              { c: 'PO-7821',   k: 'Receipt',  at: 'Sunrise · D2', ago: '15m' },
              { c: 'SKU-00421', k: 'Product',  at: '4,820 on hand', ago: '22m' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, background: t.surface, border: `1px solid ${t.border}` }}>
                <Ic.Clock size={13} color={t.muted} />
                <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: t.ink }}>{r.c}</span>
                <FPill t={t} tone="neutral" size="sm">{r.k}</FPill>
                <span style={{ fontSize: 12, color: t.muted }}>{r.at}</span>
                <span style={{ marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 11, color: t.muted, fontWeight: 700 }}>{r.ago}</span>
              </div>
            ))}
          </div>
        </div>

        {/* result card */}
        <FCard t={t} padding={0} style={{ alignSelf: 'start' }}>
          <div style={{ padding: '22px 22px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: t.primarySoft, border: `1px solid rgba(255,178,62,.3)`, display: 'grid', placeItems: 'center' }}>
              <Ic.Package size={28} color={t.primary} />
            </div>
            <div style={{ flex: 1 }}>
              <FPill t={t} tone="primary" size="sm">Pallet</FPill>
              <div style={{ fontFamily: FONTS.mono, fontSize: 22, fontWeight: 800, color: t.ink, letterSpacing: 1.5, marginTop: 6 }}>P-9QK4X72L</div>
            </div>
            <FPill t={t} tone="mint">Stored · A2-02-B</FPill>
          </div>
          <div style={{ padding: 22, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, borderBottom: `1px solid ${t.border}` }}>
            {[
              ['Location',  'A2-02-B',          true],
              ['Received',  'Apr 19 · 14:22',   true],
              ['Lot',       'L-2024-814',       true],
              ['Weight',    '312 kg',           true],
              ['From',      'PO-7814',          true],
              ['Age',       '3 days',           false],
            ].map(([k, v, mono]) => (
              <div key={k}>
                <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.muted, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>{k}</div>
                <div style={{ fontFamily: mono ? FONTS.mono : FONTS.sans, fontSize: 14, fontWeight: 700, color: t.ink, marginTop: 5 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '20px 22px 16px' }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.muted, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>Contents · 3 SKUs · 108 units</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { s: 'SKU-00421', n: 'Organic Quinoa 2kg',  q: 48 },
                { s: 'SKU-00815', n: 'Dark Chocolate Bars', q: 36 },
                { s: 'SKU-01902', n: 'Dried Apricots 500g', q: 24 },
              ].map((r) => (
                <div key={r.s} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 70px', gap: 10, padding: '10px 14px', borderRadius: 10, background: t.bgAlt, border: `1px solid ${t.border}`, fontSize: 13 }}>
                  <span style={{ fontFamily: FONTS.mono, fontWeight: 700, color: t.ink }}>{r.s}</span>
                  <span style={{ color: t.muted }}>{r.n}</span>
                  <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 800, textAlign: 'right' }}>{r.q} ea</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: 16, borderTop: `1px solid ${t.border}`, display: 'flex', gap: 8 }}>
            <FBtn t={t} variant="primary" size="md" icon={Ic.Arrow}>Move</FBtn>
            <FBtn t={t} variant="ghost" size="md">Adjust</FBtn>
            <FBtn t={t} variant="ghost" size="md" icon={Ic.Clipboard}>Cycle count</FBtn>
            <FBtn t={t} variant="ghost" size="md" icon={Ic.Download} style={{ marginLeft: 'auto' }}>Label</FBtn>
          </div>
        </FCard>
      </div>
    </FShell>
  );
}

Object.assign(window, { WC_Home, WC_Operations, WC_OutboundList, WC_OutboundDetail, WC_Inventory });
