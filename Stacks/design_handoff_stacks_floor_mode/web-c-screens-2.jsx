// Web Floor-mode screens: Inbound (list+detail), Products, Warehouses, Counts

function WC_InboundList({ t }) {
  const rows = [
    { ref: 'PO-7821', sup: 'Sunrise Organics',  status: 'Receiving', tone: 'primary', exp: '15:30',  lines: 18, door: 'D-02', prog: 0.60 },
    { ref: 'PO-7820', sup: 'Pacific Pantry',    status: 'Expected',  tone: 'neutral', exp: '16:15',  lines: 12, door: '—',    prog: 0 },
    { ref: 'PO-7818', sup: 'Northwoods Foods',  status: 'Closed',    tone: 'mint',    exp: 'Apr 20', lines: 24, door: 'D-01', prog: 1 },
    { ref: 'PO-7817', sup: 'Glacier Imports',   status: 'Short',     tone: 'coral',   exp: 'Apr 20', lines: 16, door: 'D-03', prog: 0.88 },
    { ref: 'PO-7815', sup: 'Cascade Co-op',     status: 'Closed',    tone: 'mint',    exp: 'Apr 19', lines: 8,  door: 'D-02', prog: 1 },
  ];
  return (
    <FShell t={t} active="inbound" title="Inbound"
      eyebrow="Coming in · 8 active"
      subtitle="next truck 15:30 · 2 docks open"
      tabs={[
        { key: 'today', label: 'Today',     count: 3 },
        { key: 'week',  label: 'This week', count: 11 },
        { key: 'closed',label: 'Closed' },
      ]} tabActive="today"
      actions={<>
        <FBtn t={t} variant="ghost" size="sm" icon={Ic.Filter}>Filter</FBtn>
        <FBtn t={t} variant="primary" size="sm" icon={Ic.Plus}>New inbound</FBtn>
      </>}>

      {/* Dock-door status strip */}
      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
        {[
          { d: 'D-01', state: 'idle',     lbl: '— · idle' },
          { d: 'D-02', state: 'active',   lbl: 'PO-7821 · Sunrise · 60%' },
          { d: 'D-03', state: 'closing',  lbl: 'PO-7817 · Glacier · variance' },
          { d: 'D-04', state: 'closed',   lbl: '— · closed' },
        ].map((d, i) => (
          <div key={i} style={{
            flex: 1, padding: 14, borderRadius: 12,
            background: d.state === 'active' ? t.primarySoft : t.surface,
            border: `1px solid ${d.state === 'active' ? 'rgba(255,178,62,.4)' : t.border}`,
            boxShadow: d.state === 'active' ? `0 0 18px ${t.primaryGlow}` : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: d.state === 'active' ? t.primary : d.state === 'closing' ? t.coral : d.state === 'closed' ? t.mutedSoft : t.muted, boxShadow: d.state === 'active' ? `0 0 6px ${t.primary}` : 'none' }} />
              <span style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 800, color: t.ink, letterSpacing: 0.5 }}>{d.d}</span>
              <span style={{ marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 9.5, color: t.muted, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>{d.state}</span>
            </div>
            <div style={{ fontSize: 12, color: t.muted, marginTop: 8 }}>{d.lbl}</div>
          </div>
        ))}
      </div>

      <FCard t={t} padding={0} style={{ marginTop: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 130px 130px 70px 80px 160px 40px', gap: 14, padding: '14px 22px', fontFamily: FONTS.mono, fontSize: 10, color: t.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 700, borderBottom: `1px solid ${t.border}` }}>
          <span>Reference</span><span>Supplier</span><span>Status</span><span>Expected</span><span style={{ textAlign: 'right' }}>Lines</span><span>Door</span><span>Progress</span><span></span>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 130px 130px 70px 80px 160px 40px', gap: 14, padding: '16px 22px', alignItems: 'center', borderTop: i ? `1px solid ${t.border}` : 'none', background: r.status === 'Receiving' ? t.primarySoft : 'transparent' }}>
            <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: t.ink }}>{r.ref}</span>
            <span style={{ color: t.body, fontSize: 13 }}>{r.sup}</span>
            <FPill t={t} tone={r.tone}>{r.status}</FPill>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted, fontWeight: 700 }}>{r.exp}</span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: t.ink, textAlign: 'right' }}>{r.lines}</span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.ink, fontWeight: 700, letterSpacing: 0.4 }}>{r.door}</span>
            <div style={{ height: 6, background: t.surfaceAlt, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${r.prog * 100}%`, height: '100%', background: r.tone === 'mint' ? t.mint : r.tone === 'coral' ? t.coral : t.primary }} />
            </div>
            <Ic.Arrow size={14} color={t.muted} />
          </div>
        ))}
      </FCard>
    </FShell>
  );
}

function WC_InboundDetail({ t }) {
  return (
    <FShell t={t} active="inbound" title="PO-7821"
      eyebrow="Inbound · receiving · D-02"
      subtitle="Sunrise Organics · arrived 14:08 · estimated close 15:30"
      actions={<>
        <FBtn t={t} variant="ghost" size="sm">Cancel</FBtn>
        <FBtn t={t} variant="primary" size="sm" icon={Ic.Check}>Close receipt</FBtn>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, marginTop: 6 }}>
        <FCard t={t} padding={0}>
          <div style={{ padding: '16px 22px 12px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
            <div style={{ fontFamily: FONTS.sans, fontSize: 18, fontWeight: 800, color: t.ink, letterSpacing: -0.4 }}>Receipt lines</div>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <FPill t={t} tone="coral" size="sm">2 short · −18</FPill>
              <FPill t={t} tone="mint" size="sm">3 matched</FPill>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '30px 130px 1fr 60px 60px 130px', gap: 12, padding: '10px 22px', fontFamily: FONTS.mono, fontSize: 10, color: t.muted, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>
            <span>#</span><span>SKU</span><span>Name</span><span style={{ textAlign: 'right' }}>Exp</span><span style={{ textAlign: 'right' }}>Recd</span><span>Variance</span>
          </div>
          {[
            { sku: 'SKU-00421', n: 'Organic Quinoa 2kg',     e: 48, r: 48, lot: 'L-814' },
            { sku: 'SKU-00815', n: 'Dark Chocolate Bars',    e: 36, r: 24, lot: 'L-817' },
            { sku: 'SKU-01902', n: 'Dried Apricots 500g',    e: 60, r: 54, lot: 'L-810' },
            { sku: 'SKU-00137', n: 'Cold-Press Olive Oil 1L', e: 24, r: 24, lot: 'L-812' },
            { sku: 'SKU-02431', n: 'Almond Butter 340g',     e: 12, r: 12, lot: 'L-816' },
          ].map((r, i) => {
            const v = r.r - r.e;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '30px 130px 1fr 60px 60px 130px', gap: 12, padding: '12px 22px', borderTop: `1px solid ${t.border}`, alignItems: 'center', background: v < 0 ? t.coralSoft : 'transparent' }}>
                <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.muted, fontWeight: 700 }}>{i+1}</span>
                <span style={{ fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700, color: t.ink }}>{r.sku}</span>
                <span style={{ color: t.body, fontSize: 13 }}>{r.n}</span>
                <span style={{ fontFamily: FONTS.mono, fontSize: 12, textAlign: 'right', color: t.muted, fontWeight: 700 }}>{r.e}</span>
                <span style={{ fontFamily: FONTS.mono, fontSize: 13, textAlign: 'right', color: v < 0 ? t.coral : t.ink, fontWeight: 800 }}>{r.r}</span>
                {v === 0 ? <FPill t={t} tone="mint" size="sm">Matched</FPill> : <FPill t={t} tone="coral" size="sm">{v} short</FPill>}
              </div>
            );
          })}
        </FCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Heads-up variance */}
          <FCard t={t} padding={20} style={{ borderColor: 'rgba(255,107,91,.4)', borderTop: `2px solid ${t.coral}` }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Cubby size={48} theme={{ ...t, primary: t.coral, primaryDeep: '#B53D30', ink: t.ink, charcoal: '#2E2824' }} mood="wow" />
              <div>
                <FPill t={t} tone="coral" size="sm">Heads up · variance</FPill>
                <div style={{ fontFamily: FONTS.sans, fontSize: 16, fontWeight: 700, color: t.ink, marginTop: 6, lineHeight: 1.35 }}>18 units short across 2 lines.</div>
                <div style={{ fontSize: 12.5, color: t.muted, marginTop: 6, lineHeight: 1.5 }}>Add a reason before closing. Sunrise's last 3 POs all had &lt;5% variance — flag if this becomes a pattern.</div>
                <FBtn t={t} variant="danger" size="sm" style={{ marginTop: 12 }}>Log reason</FBtn>
              </div>
            </div>
          </FCard>

          {/* Putaway plan */}
          <FCard t={t} padding={20}>
            <FPill t={t} tone="primary">Put-away plan</FPill>
            <div style={{ fontSize: 12, color: t.muted, marginTop: 6 }}>Suggested by lot, velocity, available bays.</div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { z: 'A2 · Dry goods', n: 8, pct: 60, c: t.primary },
                { z: 'A3 · Dry goods', n: 6, pct: 40, c: t.sky },
                { z: 'C1 · Bulk',      n: 2, pct: 15, c: t.mint },
              ].map((r, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', fontSize: 12.5, marginBottom: 5 }}>
                    <span style={{ color: t.body, fontWeight: 500 }}>{r.z}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 12, color: t.ink, fontWeight: 800 }}>{r.n} pal</span>
                  </div>
                  <div style={{ height: 6, background: t.surfaceAlt, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${r.pct}%`, height: '100%', background: r.c }} />
                  </div>
                </div>
              ))}
            </div>
          </FCard>

          {/* Truck info */}
          <FCard t={t} padding={20}>
            <FPill t={t} tone="neutral">Truck</FPill>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 12 }}>
              {[
                ['Carrier', 'OldDominion'],
                ['Trailer', 'OD-44102'],
                ['Driver',  'C. Suarez'],
                ['ETA out', '15:30'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.muted, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>{k}</div>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: t.ink, marginTop: 4 }}>{v}</div>
                </div>
              ))}
            </div>
          </FCard>
        </div>
      </div>
    </FShell>
  );
}

function WC_Products({ t }) {
  return (
    <FShell t={t} active="products" title="Products"
      eyebrow="Catalog · 1,284 SKUs"
      subtitle="across 3 warehouses · A/B/C velocity bands"
      actions={<>
        <FBtn t={t} variant="ghost" size="sm" icon={Ic.Download}>Import CSV</FBtn>
        <FBtn t={t} variant="primary" size="sm" icon={Ic.Plus}>New product</FBtn>
      </>}>
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10 }}>
          {[['all','All','1,284'],['A','A · top','148'],['B','B','420'],['C','C · slow','716']].map(([k, l, n]) => (
            <div key={k} style={{ padding: '6px 12px', borderRadius: 6, background: k === 'all' ? t.primary : 'transparent', color: k === 'all' ? t.primaryText : t.muted, fontFamily: FONTS.mono, fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', display: 'inline-flex', gap: 6, alignItems: 'center' }}>{l}<span style={{ opacity: 0.6 }}>{n}</span></div>
          ))}
        </div>
        <FBtn t={t} variant="ghost" size="sm" icon={Ic.Filter}>Filter</FBtn>
      </div>

      <FCard t={t} padding={0} style={{ marginTop: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 160px 80px 60px 100px 60px', gap: 12, padding: '14px 22px', fontFamily: FONTS.mono, fontSize: 10, color: t.muted, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700, borderBottom: `1px solid ${t.border}` }}>
          <span>SKU</span><span>Name</span><span>Barcode</span><span style={{ textAlign: 'right' }}>Weight</span><span>Vel</span><span style={{ textAlign: 'right' }}>On hand</span><span style={{ textAlign: 'right' }}>Loc</span>
        </div>
        {[
          { s: 'SKU-00421', n: 'Organic Quinoa 2kg',      bc: '850012004210', w: '2.0 kg',  v: 'A', oh: 4820, lc: 3 },
          { s: 'SKU-00137', n: 'Cold-Press Olive Oil 1L', bc: '850012001378', w: '1.1 kg',  v: 'A', oh: 3412, lc: 5 },
          { s: 'SKU-00815', n: 'Dark Chocolate Bars',     bc: '850012008159', w: '0.4 kg',  v: 'B', oh: 1988, lc: 2 },
          { s: 'SKU-01902', n: 'Dried Apricots 500g',     bc: '850012019024', w: '0.5 kg',  v: 'B', oh: 2104, lc: 2 },
          { s: 'SKU-02431', n: 'Almond Butter 340g',      bc: '850012024318', w: '0.35 kg', v: 'C', oh: 1240, lc: 1 },
          { s: 'SKU-00903', n: 'Himalayan Pink Salt',     bc: '850012009033', w: '0.9 kg',  v: 'C', oh: 744,  lc: 1 },
        ].map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 160px 80px 60px 100px 60px', gap: 12, padding: '13px 22px', alignItems: 'center', borderTop: `1px solid ${t.border}`, fontSize: 13 }}>
            <span style={{ fontFamily: FONTS.mono, fontWeight: 700, color: t.ink }}>{r.s}</span>
            <span style={{ color: t.body }}>{r.n}</span>
            <span style={{ fontFamily: FONTS.mono, color: t.muted, fontSize: 11.5 }}>{r.bc}</span>
            <span style={{ fontFamily: FONTS.mono, textAlign: 'right', color: t.body, fontWeight: 600 }}>{r.w}</span>
            <FPill t={t} tone={r.v === 'A' ? 'primary' : r.v === 'B' ? 'sky' : 'neutral'} size="sm">{r.v}</FPill>
            <span style={{ fontFamily: FONTS.mono, textAlign: 'right', fontWeight: 800, color: t.ink }}>{r.oh.toLocaleString()}</span>
            <span style={{ fontFamily: FONTS.mono, textAlign: 'right', color: t.muted, fontWeight: 700 }}>{r.lc}</span>
          </div>
        ))}
      </FCard>
    </FShell>
  );
}

function WC_Warehouses({ t }) {
  const sites = [
    { code: 'WH-01', name: 'Main DC',     loc: 'Tacoma, WA',     util: 72, pallets: 4820, mood: 'happy', today: 124, cap: 6700 },
    { code: 'WH-02', name: 'South Bay',   loc: 'San Jose, CA',   util: 58, pallets: 2204, mood: 'happy', today: 78,  cap: 3800 },
    { code: 'WH-03', name: 'Gulf Cold',   loc: 'Houston, TX',    util: 86, pallets: 5810, mood: 'wow',   today: 210, cap: 6750 },
    { code: 'WH-04', name: 'Midwest Hub', loc: 'Columbus, OH',   util: 44, pallets: 1288, mood: 'sleep', today: 32,  cap: 2900 },
  ];
  return (
    <FShell t={t} active="warehouses" title="Warehouses"
      eyebrow="Sites · 4 active"
      subtitle="13,122 pallets in network · 68% blended utilization"
      actions={<FBtn t={t} variant="primary" size="sm" icon={Ic.Plus}>Add site</FBtn>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 6 }}>
        {sites.map((s, i) => {
          const isHot = s.util > 80;
          const isCold = s.util < 50;
          return (
            <FCard key={i} t={t} padding={0} style={isHot ? { borderTop: `2px solid ${t.coral}` } : {}}>
              <div style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 16, borderBottom: `1px solid ${t.border}` }}>
                <Cubby size={56} theme={{ ...t, primary: t.primary, primaryDeep: t.primaryDeep, ink: t.ink, charcoal: '#2E2824' }} mood={s.mood} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <div style={{ fontFamily: FONTS.sans, fontSize: 22, fontWeight: 800, color: t.ink, letterSpacing: -0.6 }}>{s.name}</div>
                    <span style={{ fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700, color: t.muted }}>{s.code}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: FONTS.mono, fontSize: 12, color: t.muted, marginTop: 4 }}>
                    <Ic.Pin size={12} color={t.muted} />{s.loc}
                  </div>
                </div>
                <FPill t={t} tone={isHot ? 'coral' : isCold ? 'neutral' : 'primary'}>{s.util}% full</FPill>
              </div>
              <div style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 22 }}>
                <div style={{ position: 'relative', width: 96, height: 96 }}>
                  <svg width="96" height="96" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="48" cy="48" r="40" fill="none" stroke={t.surfaceAlt} strokeWidth="8" />
                    <circle cx="48" cy="48" r="40" fill="none" stroke={isHot ? t.coral : t.primary} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 40 * (s.util / 100)} ${2 * Math.PI * 40}`} style={{ filter: `drop-shadow(0 0 6px ${isHot ? 'rgba(255,107,91,.45)' : t.primaryGlow})` }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 18, fontWeight: 800, color: t.ink }}>{s.util}%</div>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    ['Pallets',  s.pallets.toLocaleString()],
                    ['Capacity', s.cap.toLocaleString()],
                    ['Today',    `+${s.today}`],
                    ['Avg dwell', '14 d'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.muted, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>{k}</div>
                      <div style={{ fontFamily: FONTS.mono, fontSize: 16, fontWeight: 800, color: t.ink, marginTop: 3 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <FBtn t={t} variant="ghost" size="sm" icon={Ic.Arrow}>Open</FBtn>
              </div>
            </FCard>
          );
        })}
      </div>
    </FShell>
  );
}

function WC_Counts({ t }) {
  return (
    <FShell t={t} active="counts" title="Cycle counts"
      eyebrow="Keeping books honest"
      subtitle="30-day variance 0.6% · target ≤ 1.0%"
      tabs={[
        { key: 'open', label: 'Open',      count: 4 },
        { key: 'rev',  label: 'Reviewing', count: 2 },
        { key: 'done', label: 'Approved' },
      ]} tabActive="open"
      actions={<FBtn t={t} variant="primary" size="sm" icon={Ic.Plus}>New count</FBtn>}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 6 }}>
        <KPI t={t} label="Open"           value="4"   spark={[3,4,4,3,4,4,4,4]} accent />
        <KPI t={t} label="Reviewing"      value="2"   spark={[1,2,1,2,2,1,2,2]} />
        <KPI t={t} label="Accuracy · 30d" value="99.4" suffix="%" delta="+0.2%" spark={[97,98,98,99,99,99,99,99]} />
      </div>

      <FCard t={t} padding={0} style={{ marginTop: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 170px 130px 130px 80px 90px 1fr', gap: 14, padding: '14px 22px', fontFamily: FONTS.mono, fontSize: 10, color: t.muted, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700, borderBottom: `1px solid ${t.border}` }}>
          <span>Count</span><span>Zone</span><span>Status</span><span>Due</span><span style={{ textAlign: 'right' }}>Items</span><span style={{ textAlign: 'right' }}>Variance</span><span>Assigned</span>
        </div>
        {[
          { id: 'CC-0418', z: 'A2 · Dry',  s: 'Counting', tone: 'primary', due: 'Today',     items: 84,  v: '—', who: 'M. Rivera', init: 'MR' },
          { id: 'CC-0412', z: 'B3 · Cold', s: 'Overdue',  tone: 'coral',   due: 'Yesterday', items: 56,  v: '—', who: '—',         init: '?' },
          { id: 'CC-0409', z: 'C1 · Bulk', s: 'Reviewing',tone: 'sky',     due: 'Apr 19',    items: 120, v: '−4', who: 'S. Park',   init: 'SP' },
          { id: 'CC-0402', z: 'A1 · Dry',  s: 'Approved', tone: 'mint',    due: 'Apr 17',    items: 48,  v: '0', who: 'A. Torres', init: 'AT' },
        ].map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 170px 130px 130px 80px 90px 1fr', gap: 14, padding: '14px 22px', alignItems: 'center', borderTop: i ? `1px solid ${t.border}` : 'none', background: r.s === 'Overdue' ? t.coralSoft : 'transparent' }}>
            <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: t.ink }}>{r.id}</span>
            <span style={{ color: t.body, fontSize: 13 }}>{r.z}</span>
            <FPill t={t} tone={r.tone}>{r.s}</FPill>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: r.s === 'Overdue' ? t.coral : t.muted, fontWeight: 700 }}>{r.due}</span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 13, textAlign: 'right', color: t.ink, fontWeight: 700 }}>{r.items}</span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 13, textAlign: 'right', color: r.v === '0' ? t.mint : r.v.startsWith('−') ? t.coral : t.muted, fontWeight: 800 }}>{r.v}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: r.init === '?' ? t.surfaceAlt : t.primarySoft, border: `1px solid ${r.init === '?' ? t.border : 'rgba(255,178,62,.3)'}`, color: r.init === '?' ? t.muted : t.primary, display: 'grid', placeItems: 'center', fontFamily: FONTS.mono, fontWeight: 800, fontSize: 10 }}>{r.init}</div>
              <span style={{ color: r.who === '—' ? t.muted : t.body, fontSize: 12.5 }}>{r.who}</span>
            </div>
          </div>
        ))}
      </FCard>
    </FShell>
  );
}

Object.assign(window, { WC_InboundList, WC_InboundDetail, WC_Products, WC_Warehouses, WC_Counts });
