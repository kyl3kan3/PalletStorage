// Outbound list + detail
function ScreenOutboundList({ theme }) {
  const t = theme;
  const rows = [
    { ref: 'SO-24881', cust: 'Glacier Foods Co.', status: 'Picking', tone: 'primary', ship: 'Today · 5:00p', lines: 22, prog: 0.52 },
    { ref: 'SO-24880', cust: 'Northwind Market', status: 'Packed', tone: 'sky', ship: 'Today · 6:00p', lines: 14, prog: 1 },
    { ref: 'SO-24879', cust: 'Harbor Bakeries', status: 'Open', tone: 'neutral', ship: 'Tomorrow · 9:00a', lines: 8, prog: 0 },
    { ref: 'SO-24878', cust: 'Alpine Cafés', status: 'Picking', tone: 'primary', ship: 'Tomorrow · Noon', lines: 11, prog: 0.22 },
    { ref: 'SO-24875', cust: 'Evergreen Grocer', status: 'Shipped', tone: 'mint', ship: 'Apr 20', lines: 28, prog: 1 },
    { ref: 'SO-24874', cust: 'Cedar & Co.', status: 'Shipped', tone: 'mint', ship: 'Apr 20', lines: 18, prog: 1 },
  ];
  return (
    <Shell theme={t} active="outbound"
      actions={<>
        <Btn theme={t} variant="secondary" size="sm" icon={Ic.Filter}>Filter</Btn>
        <Btn theme={t} variant="accent" size="sm" icon={Ic.Plus}>New order</Btn>
      </>}>
      <PageTitle theme={t} eyebrow="Going out the door" title="Outbound"
        subtitle="Waves, picks, packs, and trucks."
        tabs={[
          { key: 'active', label: 'Active', count: 12 },
          { key: 'ready', label: 'Ready to ship', count: 4 },
          { key: 'shipped', label: 'Shipped' },
          { key: 'cancelled', label: 'Cancelled' },
        ]} tabActive="active" />
      <div style={{ padding: '0 28px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, margin: '8px 0 18px' }}>
          <StatBig theme={t} label="Open" value="34" />
          <StatBig theme={t} label="Picking" value="12" tint="primary" />
          <StatBig theme={t} label="Ready" value="4" tint="sky" />
          <StatBig theme={t} label="On-time" value="96%" tint="mint" />
        </div>
        <Card theme={t} padding={0}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px 160px 60px 200px 40px', gap: 14, padding: '14px 22px', fontSize: 11, color: t.muted, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>
            <span>Reference</span><span>Customer</span><span>Status</span><span>Ship by</span><span style={{ textAlign: 'right' }}>Lines</span><span>Progress</span><span></span>
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px 160px 60px 200px 40px', gap: 14, padding: '16px 22px', alignItems: 'center', borderTop: `1.5px dashed ${t.border}` }}>
              <span style={{ fontFamily: FONTS.mono, fontWeight: 600, color: t.ink }}>{r.ref}</span>
              <span style={{ color: t.body }}>{r.cust}</span>
              <Tag theme={t} tone={r.tone}>{r.status}</Tag>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>{r.ship}</span>
              <span style={{ fontFamily: FONTS.mono, textAlign: 'right', color: t.ink }}>{r.lines}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 8, background: t.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${r.prog*100}%`, height: '100%', background: r.tone === 'mint' ? t.mint : t.primary, borderRadius: 4 }} />
                </div>
                <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.muted, minWidth: 30, textAlign: 'right' }}>{Math.round(r.prog*100)}%</span>
              </div>
              <Ic.Arrow size={14} color={t.muted} />
            </div>
          ))}
        </Card>
      </div>
    </Shell>
  );
}

function ScreenOutboundDetail({ theme }) {
  const t = theme;
  const steps = [
    { k: 'Open', done: true, icon: Ic.Plus },
    { k: 'Picking', done: true, active: true, icon: Ic.Boxes },
    { k: 'Packed', done: false, icon: Ic.Package },
    { k: 'Shipped', done: false, icon: Ic.Truck },
  ];
  return (
    <Shell theme={t} active="outbound"
      actions={<>
        <Btn theme={t} variant="secondary" size="sm">Cancel order</Btn>
        <Btn theme={t} variant="primary" size="sm" icon={Ic.Package}>Mark packed</Btn>
      </>}>
      <div style={{ padding: '22px 28px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: t.muted }}>Outbound</span>
          <Ic.Arrow size={12} color={t.muted} />
          <span style={{ fontSize: 13, color: t.muted }}>Active</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 34, fontWeight: 600, color: t.ink, letterSpacing: -1 }}>SO-24881</div>
          <Tag theme={t} tone="primary">Picking</Tag>
          <span style={{ fontSize: 13.5, color: t.muted }}>Glacier Foods Co. · ship by <b style={{ color: t.ink, fontFamily: FONTS.mono }}>Today 5:00p</b></span>
        </div>
      </div>

      <div style={{ padding: '0 28px 28px', overflow: 'auto', height: 'calc(100% - 130px)', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stepper */}
          <Card theme={t} padding={22}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {steps.map((s, i) => (
                <React.Fragment key={i}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 14,
                      background: s.active ? t.primary : s.done ? t.mint : t.surfaceAlt,
                      color: s.active ? t.primaryText : s.done ? '#155A38' : t.muted,
                      border: `1.5px solid ${s.active ? t.primaryDeep : s.done ? t.mint : t.border}`,
                      display: 'grid', placeItems: 'center',
                    }}>
                      {s.done && !s.active ? <Ic.Check size={18} /> : <s.icon size={18} />}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: s.active ? t.ink : t.muted }}>{s.k}</div>
                  </div>
                  {i < steps.length - 1 && (
                    <div style={{ flex: 1, height: 3, background: s.done ? t.mint : t.surfaceAlt, borderRadius: 2, margin: '0 6px', marginBottom: 20 }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </Card>

          {/* Lines */}
          <Card theme={t} padding={0}>
            <div style={{ padding: '16px 22px 12px', display: 'flex', alignItems: 'center' }}>
              <div style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: t.ink, letterSpacing: -0.3 }}>Lines · <span style={{ color: t.muted }}>22 SKUs</span></div>
              <div style={{ marginLeft: 'auto' }}><Btn theme={t} variant="ghost" size="sm" icon={Ic.Download}>Export</Btn></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '30px 130px 1fr 70px 70px 120px', gap: 12, padding: '10px 22px', fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>
              <span>#</span><span>SKU</span><span>Name</span><span style={{ textAlign: 'right' }}>Ord</span><span style={{ textAlign: 'right' }}>Picked</span><span>Progress</span>
            </div>
            {[
              { sku: 'SKU-00421', n: 'Organic Quinoa 2kg', o: 48, p: 48, done: true },
              { sku: 'SKU-00815', n: 'Dark Chocolate Bars', o: 36, p: 24, done: false },
              { sku: 'SKU-01902', n: 'Dried Apricots 500g', o: 24, p: 24, done: true },
              { sku: 'SKU-00137', n: 'Cold-Press Olive Oil 1L', o: 60, p: 12, done: false },
              { sku: 'SKU-02431', n: 'Almond Butter 340g', o: 18, p: 0, done: false },
            ].map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '30px 130px 1fr 70px 70px 120px', gap: 12, padding: '12px 22px', borderTop: `1.5px dashed ${t.border}`, alignItems: 'center', fontSize: 13 }}>
                <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.muted }}>{i+1}</span>
                <span style={{ fontFamily: FONTS.mono, fontWeight: 600, color: t.ink }}>{r.sku}</span>
                <span style={{ color: t.body }}>{r.n}</span>
                <span style={{ fontFamily: FONTS.mono, textAlign: 'right' }}>{r.o}</span>
                <span style={{ fontFamily: FONTS.mono, textAlign: 'right', color: r.done ? (t.mode==='dark'?t.mint:'#1F6B45') : t.ink, fontWeight: 600 }}>{r.p}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 6, background: t.surfaceAlt, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(r.p/r.o)*100}%`, height: '100%', background: r.done ? t.mint : t.primary }} />
                  </div>
                  {r.done && <Ic.Check size={12} color={t.mint} />}
                </div>
              </div>
            ))}
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Cubby status */}
          <Card theme={t} padding={20} tint="primary">
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <Cubby size={56} theme={t} mood="think" />
              <div>
                <div style={{ fontSize: 11, color: t.primaryDeep, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>Cubby says</div>
                <div style={{ fontFamily: FONTS.display, fontStyle: 'italic', fontSize: 17, fontWeight: 600, color: t.ink, letterSpacing: -0.2, marginTop: 2, lineHeight: 1.3 }}>
                  "You've got 2 pickers on this order.<br/>ETA to pack: <b>~22 min.</b>"
                </div>
              </div>
            </div>
          </Card>

          {/* Pickers */}
          <Card theme={t} padding={20}>
            <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: t.ink, marginBottom: 12 }}>Crew on it</div>
            {[
              { name: 'Maya Rivera', pct: 62, tone: t.primary, init: 'MR' },
              { name: 'Sol Park', pct: 48, tone: t.sky, init: 'SP' },
            ].map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 12, background: p.tone, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>{p.init}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.ink }}>{p.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <div style={{ flex: 1, height: 6, background: t.surfaceAlt, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${p.pct}%`, height: '100%', background: p.tone }} />
                    </div>
                    <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.muted, minWidth: 30, textAlign: 'right' }}>{p.pct}%</span>
                  </div>
                </div>
              </div>
            ))}
          </Card>

          {/* Ship info */}
          <Card theme={t} padding={20}>
            <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: t.ink, marginBottom: 12 }}>Ship</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13 }}>
              <div><div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>Carrier</div><div style={{ marginTop: 3, color: t.ink }}>FedEx Freight</div></div>
              <div><div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>Dock</div><div style={{ marginTop: 3, fontFamily: FONTS.mono, color: t.ink }}>D-04</div></div>
              <div><div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>Ship-to</div><div style={{ marginTop: 3, color: t.ink, lineHeight: 1.4 }}>1820 Pacific Ave<br/>Portland, OR</div></div>
              <div><div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>Weight</div><div style={{ marginTop: 3, fontFamily: FONTS.mono, color: t.ink }}>2,148 lb</div></div>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

// Inventory scan — centerpiece scan, beautifully friendly
function ScreenInventory({ theme }) {
  const t = theme;
  return (
    <Shell theme={t} active="inventory">
      <div style={{ padding: 28, overflow: 'auto', height: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
          <div>
            <div style={{ fontSize: 11, color: t.muted, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Inventory · Lookup</div>
            <div style={{ fontFamily: FONTS.display, fontSize: 38, fontWeight: 600, color: t.ink, letterSpacing: -1, lineHeight: 1.05, fontStyle: 'italic' }}>Scan to find<br/>anything.</div>
            <div style={{ fontSize: 14, color: t.body, marginTop: 10, maxWidth: 400 }}>Pallets, locations, lots, and SKUs — paste a code or scan a label.</div>

            <Card theme={t} padding={6} style={{ marginTop: 22, border: `2px solid ${t.primary}`, boxShadow: `0 0 0 6px ${t.primarySoft}, ${t.shadow}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <Ic.Scan size={22} color={t.primaryDeep} />
                <div style={{ flex: 1, fontFamily: FONTS.mono, fontSize: 18, fontWeight: 600, color: t.ink, letterSpacing: 2 }}>P-9QK4X72L<span style={{ opacity: 0.4, animation: 'blink 1s steps(2) infinite' }}>|</span></div>
                <Tag theme={t} tone="primary">LPN</Tag>
              </div>
            </Card>
            <div style={{ fontSize: 12, color: t.muted, marginTop: 8, fontFamily: FONTS.mono }}>P-XXXXXXXXXX · L-XXXXXXXXXX · PO-XXXX</div>

            <div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, margin: '28px 0 10px' }}>Recent</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { c: 'P-9QK4X72L', k: 'Pallet', ago: '12s' },
                { c: 'L-A2-02-B', k: 'Location', ago: '2m' },
                { c: 'P-7MJ3P01K', k: 'Pallet', ago: '8m' },
                { c: 'PO-7821', k: 'Receipt', ago: '15m' },
              ].map((r, i) => (
                <Card key={i} theme={t} padding={12} interactive style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Ic.Clock size={14} color={t.muted} />
                  <span style={{ fontFamily: FONTS.mono, fontWeight: 600, color: t.ink, fontSize: 13 }}>{r.c}</span>
                  <Tag theme={t} tone="neutral">{r.k}</Tag>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: t.muted, fontFamily: FONTS.mono }}>{r.ago} ago</span>
                </Card>
              ))}
            </div>
          </div>

          {/* Result card */}
          <Card theme={t} padding={0} style={{ alignSelf: 'start' }}>
            <div style={{ padding: '22px 22px 16px', borderBottom: `1.5px dashed ${t.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
              <SquircleIcon theme={t} icon={Ic.Package} tint="primary" size={56} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: t.muted, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>Pallet</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 20, fontWeight: 700, color: t.ink }}>P-9QK4X72L</div>
              </div>
              <Tag theme={t} tone="mint">Stored</Tag>
            </div>
            <div style={{ padding: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                ['Location', 'A2-02-B', true],
                ['Received', 'Apr 19 · 2:22p', false],
                ['Lot', 'L-2024-814', true],
                ['Weight', '312 kg', true],
                ['From', 'PO-7814', true],
                ['Age', '3 days', false],
              ].map(([k, v, mono], i) => (
                <div key={i}>
                  <div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{k}</div>
                  <div style={{ marginTop: 3, fontFamily: mono ? FONTS.mono : FONTS.sans, color: t.ink, fontSize: 14, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '0 22px 18px' }}>
              <div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 8 }}>Contents · 3 SKUs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { s: 'SKU-00421', n: 'Organic Quinoa 2kg', q: 48 },
                  { s: 'SKU-00815', n: 'Dark Chocolate Bars', q: 36 },
                  { s: 'SKU-01902', n: 'Dried Apricots 500g', q: 24 },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: t.surfaceAlt, borderRadius: 10, fontSize: 13, alignItems: 'center' }}>
                    <span style={{ fontFamily: FONTS.mono, fontWeight: 700, color: t.ink }}>{r.s}</span>
                    <span style={{ color: t.muted, flex: 1 }}>{r.n}</span>
                    <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>{r.q} ea</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: 16, borderTop: `1.5px dashed ${t.border}`, display: 'flex', gap: 8 }}>
              <Btn theme={t} variant="primary" size="sm" icon={Ic.Arrow}>Move</Btn>
              <Btn theme={t} variant="secondary" size="sm">Adjust</Btn>
              <Btn theme={t} variant="ghost" size="sm" icon={Ic.Download} style={{ marginLeft: 'auto' }}>Label</Btn>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

Object.assign(window, { ScreenOutboundList, ScreenOutboundDetail, ScreenInventory });
