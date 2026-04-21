// Inbound list + detail, Products, Warehouses, Cycle counts

function ScreenInboundList({ theme }) {
  const t = theme;
  const rows = [
    { ref: 'PO-7821', sup: 'Sunrise Organics', status: 'Receiving', tone: 'primary', exp: 'Today · 3:30p', lines: 18, door: 'D-02' },
    { ref: 'PO-7820', sup: 'Pacific Pantry', status: 'Expected', tone: 'neutral', exp: 'Today · 4:15p', lines: 12, door: '—' },
    { ref: 'PO-7818', sup: 'Northwoods Foods', status: 'Closed', tone: 'mint', exp: 'Apr 20', lines: 24, door: 'D-01' },
    { ref: 'PO-7817', sup: 'Glacier Imports', status: 'Short', tone: 'coral', exp: 'Apr 20', lines: 16, door: 'D-03' },
    { ref: 'PO-7815', sup: 'Cascade Co-op', status: 'Closed', tone: 'mint', exp: 'Apr 19', lines: 8, door: 'D-02' },
  ];
  return (
    <Shell theme={t} active="inbound"
      actions={<><Btn theme={t} variant="secondary" size="sm" icon={Ic.Filter}>Filter</Btn><Btn theme={t} variant="accent" size="sm" icon={Ic.Plus}>New inbound</Btn></>}>
      <PageTitle theme={t} eyebrow="Coming in" title="Inbound" subtitle="Trucks at the dock, expected receipts, and reconciliations."
        tabs={[{ key: 'today', label: 'Today', count: 3 }, { key: 'week', label: 'This week', count: 11 }, { key: 'closed', label: 'Closed' }]} tabActive="today" />
      <div style={{ padding: '0 28px 28px' }}>
        <Card theme={t} padding={0}>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 130px 180px 70px 90px 40px', gap: 14, padding: '14px 22px', fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
            <span>Reference</span><span>Supplier</span><span>Status</span><span>Expected</span><span style={{ textAlign: 'right' }}>Lines</span><span>Door</span><span></span>
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 130px 180px 70px 90px 40px', gap: 14, padding: '16px 22px', alignItems: 'center', borderTop: `1.5px dashed ${t.border}` }}>
              <span style={{ fontFamily: FONTS.mono, fontWeight: 600, color: t.ink }}>{r.ref}</span>
              <span>{r.sup}</span>
              <Tag theme={t} tone={r.tone}>{r.status}</Tag>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>{r.exp}</span>
              <span style={{ fontFamily: FONTS.mono, textAlign: 'right', color: t.ink }}>{r.lines}</span>
              <span style={{ fontFamily: FONTS.mono, color: t.ink, fontSize: 12 }}>{r.door}</span>
              <Ic.Arrow size={14} color={t.muted} />
            </div>
          ))}
        </Card>
      </div>
    </Shell>
  );
}

function ScreenInboundDetail({ theme }) {
  const t = theme;
  return (
    <Shell theme={t} active="inbound"
      actions={<><Btn theme={t} variant="secondary" size="sm">Cancel</Btn><Btn theme={t} variant="primary" size="sm" icon={Ic.Check}>Close receipt</Btn></>}>
      <div style={{ padding: '22px 28px 14px' }}>
        <div style={{ fontSize: 13, color: t.muted, marginBottom: 4 }}>Inbound · Today</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 34, fontWeight: 600, color: t.ink, letterSpacing: -1 }}>PO-7821</div>
          <Tag theme={t} tone="primary">Receiving</Tag>
          <span style={{ fontSize: 13.5, color: t.muted }}>Sunrise Organics · Dock <b style={{ color: t.ink, fontFamily: FONTS.mono }}>D-02</b></span>
        </div>
      </div>
      <div style={{ padding: '0 28px 28px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, height: 'calc(100% - 130px)', overflow: 'auto' }}>
        <Card theme={t} padding={0}>
          <div style={{ padding: '16px 22px 12px', display: 'flex', alignItems: 'center' }}>
            <div style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: t.ink }}>Receipt lines</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <Tag theme={t} tone="coral">2 short</Tag>
              <Tag theme={t} tone="mint">3 complete</Tag>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '30px 130px 1fr 70px 70px 120px', gap: 12, padding: '10px 22px', fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>
            <span>#</span><span>SKU</span><span>Name</span><span style={{ textAlign: 'right' }}>Exp</span><span style={{ textAlign: 'right' }}>Recd</span><span>Variance</span>
          </div>
          {[
            { sku: 'SKU-00421', n: 'Organic Quinoa 2kg', e: 48, r: 48 },
            { sku: 'SKU-00815', n: 'Dark Chocolate Bars', e: 36, r: 24 },
            { sku: 'SKU-01902', n: 'Dried Apricots 500g', e: 60, r: 54 },
            { sku: 'SKU-00137', n: 'Cold-Press Olive Oil 1L', e: 24, r: 24 },
            { sku: 'SKU-02431', n: 'Almond Butter 340g', e: 12, r: 12 },
          ].map((r, i) => {
            const v = r.r - r.e;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '30px 130px 1fr 70px 70px 120px', gap: 12, padding: '12px 22px', borderTop: `1.5px dashed ${t.border}`, alignItems: 'center', fontSize: 13 }}>
                <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.muted }}>{i+1}</span>
                <span style={{ fontFamily: FONTS.mono, fontWeight: 600, color: t.ink }}>{r.sku}</span>
                <span style={{ color: t.body }}>{r.n}</span>
                <span style={{ fontFamily: FONTS.mono, textAlign: 'right' }}>{r.e}</span>
                <span style={{ fontFamily: FONTS.mono, textAlign: 'right', fontWeight: 600, color: t.ink }}>{r.r}</span>
                {v === 0
                  ? <Tag theme={t} tone="mint">Matched</Tag>
                  : <Tag theme={t} tone="coral">{v} short</Tag>}
              </div>
            );
          })}
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card theme={t} padding={20} tint="coral">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Cubby size={48} theme={t} mood="wow" />
              <div>
                <div style={{ fontSize: 11, color: t.mode==='dark'?t.coral:'#B53D30', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>Heads up</div>
                <div style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.ink, marginTop: 2, fontStyle: 'italic' }}>18 units short across 2 lines.</div>
                <div style={{ fontSize: 12.5, color: t.body, marginTop: 4 }}>Add a reason to close this receipt.</div>
              </div>
            </div>
          </Card>
          <Card theme={t} padding={20}>
            <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: t.ink, marginBottom: 12 }}>Put-away plan</div>
            {[{ z: 'A2 · Dry goods', n: 8, pct: 60 }, { z: 'A3 · Dry goods', n: 6, pct: 40 }, { z: 'C1 · Bulk', n: 2, pct: 15 }].map((r, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', fontSize: 12.5, marginBottom: 4 }}>
                  <span style={{ color: t.body }}>{r.z}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>{r.n} pallets</span>
                </div>
                <div style={{ height: 8, background: t.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${r.pct}%`, height: '100%', background: i===0?t.primary:i===1?t.sky:t.mint, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </Shell>
  );
}

function ScreenProducts({ theme }) {
  const t = theme;
  return (
    <Shell theme={t} active="products"
      actions={<><Btn theme={t} variant="secondary" size="sm" icon={Ic.Download}>Import CSV</Btn><Btn theme={t} variant="accent" size="sm" icon={Ic.Plus}>New product</Btn></>}>
      <PageTitle theme={t} eyebrow="Catalog" title="Products" subtitle="1,284 SKUs across 3 warehouses." />
      <div style={{ padding: '0 28px 28px' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <Search theme={t} placeholder="Search SKU, name, or barcode…" width={360} />
          <Tabs theme={t} items={[{key:'all',label:'All'},{key:'A',label:'A'},{key:'B',label:'B'},{key:'C',label:'C'}]} active="all" />
        </div>
        <Card theme={t} padding={0}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 160px 80px 80px 100px 60px', gap: 12, padding: '14px 22px', fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
            <span>SKU</span><span>Name</span><span>Barcode</span><span style={{ textAlign: 'right' }}>Weight</span><span>Vel.</span><span style={{ textAlign: 'right' }}>On hand</span><span style={{ textAlign: 'right' }}>Loc</span>
          </div>
          {[
            { s: 'SKU-00421', n: 'Organic Quinoa 2kg', bc: '850012004210', w: '2.0kg', v: 'A', oh: 4820, lc: 3 },
            { s: 'SKU-00137', n: 'Cold-Press Olive Oil 1L', bc: '850012001378', w: '1.1kg', v: 'A', oh: 3412, lc: 5 },
            { s: 'SKU-00815', n: 'Dark Chocolate Bars', bc: '850012008159', w: '0.4kg', v: 'B', oh: 1988, lc: 2 },
            { s: 'SKU-01902', n: 'Dried Apricots 500g', bc: '850012019024', w: '0.5kg', v: 'B', oh: 2104, lc: 2 },
            { s: 'SKU-02431', n: 'Almond Butter 340g', bc: '850012024318', w: '0.35kg', v: 'C', oh: 1240, lc: 1 },
            { s: 'SKU-00903', n: 'Himalayan Pink Salt', bc: '850012009033', w: '0.9kg', v: 'C', oh: 744, lc: 1 },
          ].map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 160px 80px 80px 100px 60px', gap: 12, padding: '12px 22px', alignItems: 'center', borderTop: `1.5px dashed ${t.border}`, fontSize: 13 }}>
              <span style={{ fontFamily: FONTS.mono, fontWeight: 600, color: t.ink }}>{r.s}</span>
              <span>{r.n}</span>
              <span style={{ fontFamily: FONTS.mono, color: t.muted, fontSize: 12 }}>{r.bc}</span>
              <span style={{ fontFamily: FONTS.mono, textAlign: 'right' }}>{r.w}</span>
              <Tag theme={t} tone={r.v==='A'?'primary':r.v==='B'?'sky':'neutral'}>{r.v}</Tag>
              <span style={{ fontFamily: FONTS.mono, textAlign: 'right', fontWeight: 600, color: t.ink }}>{r.oh.toLocaleString()}</span>
              <span style={{ fontFamily: FONTS.mono, textAlign: 'right', color: t.muted }}>{r.lc}</span>
            </div>
          ))}
        </Card>
      </div>
    </Shell>
  );
}

function ScreenWarehouses({ theme }) {
  const t = theme;
  const sites = [
    { code: 'WH-01', name: 'Main DC', loc: 'Tacoma, WA', util: 72, pallets: 4820, mood: 'happy' },
    { code: 'WH-02', name: 'South Bay', loc: 'San Jose, CA', util: 58, pallets: 2204, mood: 'happy' },
    { code: 'WH-03', name: 'Gulf Cold', loc: 'Houston, TX', util: 86, pallets: 5810, mood: 'wow' },
    { code: 'WH-04', name: 'Midwest Hub', loc: 'Columbus, OH', util: 44, pallets: 1288, mood: 'sleep' },
  ];
  return (
    <Shell theme={t} active="warehouses"
      actions={<Btn theme={t} variant="accent" size="sm" icon={Ic.Plus}>Add site</Btn>}>
      <PageTitle theme={t} eyebrow="Your sites" title="Warehouses" subtitle="Four locations, one cheerful little mascot per." />
      <div style={{ padding: '0 28px 28px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {sites.map((s, i) => (
          <Card key={i} theme={t} padding={0}>
            <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14, borderBottom: `1.5px dashed ${t.border}` }}>
              <Cubby size={52} theme={t} mood={s.mood} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <div style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: t.ink }}>{s.name}</div>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>{s.code}</span>
                </div>
                <div style={{ fontSize: 12.5, color: t.muted, display: 'flex', alignItems: 'center', gap: 5 }}><Ic.Pin size={12} /> {s.loc}</div>
              </div>
              <Tag theme={t} tone={s.util > 80 ? 'coral' : s.util > 60 ? 'primary' : 'mint'}>{s.util}% full</Tag>
            </div>
            <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
              <Ring theme={t} size={80} value={s.util/100} stroke={9} color={s.util > 80 ? t.coral : t.primary} label={`${s.util}%`} />
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>Pallets</div><div style={{ fontFamily: FONTS.mono, fontSize: 16, fontWeight: 700, color: t.ink, marginTop: 2 }}>{s.pallets.toLocaleString()}</div></div>
                <div><div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>Today</div><div style={{ fontFamily: FONTS.mono, fontSize: 16, fontWeight: 700, color: t.ink, marginTop: 2 }}>+{40 + i*20}</div></div>
              </div>
              <Btn theme={t} variant="secondary" size="sm" icon={Ic.Arrow}>Open</Btn>
            </div>
          </Card>
        ))}
      </div>
    </Shell>
  );
}

function ScreenCounts({ theme }) {
  const t = theme;
  return (
    <Shell theme={t} active="counts"
      actions={<Btn theme={t} variant="accent" size="sm" icon={Ic.Plus}>New count</Btn>}>
      <PageTitle theme={t} eyebrow="Keeping books honest" title="Cycle counts" subtitle="Variance review and reconciliation."
        tabs={[{ key: 'open', label: 'Open', count: 4 }, { key: 'rev', label: 'Reviewing', count: 2 }, { key: 'done', label: 'Approved' }]} tabActive="open" />
      <div style={{ padding: '0 28px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          <StatBig theme={t} label="Open" value="4" tint="primary" />
          <StatBig theme={t} label="Reviewing" value="2" tint="sky" />
          <StatBig theme={t} label="Accuracy · 30d" value="99.4%" tint="mint" delta="+0.2%" />
        </div>
        <Card theme={t} padding={0}>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 170px 130px 130px 90px 90px 1fr', gap: 14, padding: '14px 22px', fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
            <span>Count</span><span>Zone</span><span>Status</span><span>Due</span><span style={{ textAlign: 'right' }}>Items</span><span style={{ textAlign: 'right' }}>Variance</span><span>Assigned</span>
          </div>
          {[
            { id: 'CC-0418', z: 'A2 · Dry', s: 'Counting', tone: 'primary', due: 'Today', items: 84, v: '—', who: 'M. Rivera', init: 'MR' },
            { id: 'CC-0412', z: 'B3 · Cold', s: 'Overdue', tone: 'coral', due: 'Yesterday', items: 56, v: '—', who: '—', init: '?' },
            { id: 'CC-0409', z: 'C1 · Bulk', s: 'Reviewing', tone: 'sky', due: 'Apr 19', items: 120, v: '−4', who: 'S. Park', init: 'SP' },
            { id: 'CC-0402', z: 'A1 · Dry', s: 'Approved', tone: 'mint', due: 'Apr 17', items: 48, v: '0', who: 'A. Torres', init: 'AT' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 170px 130px 130px 90px 90px 1fr', gap: 14, padding: '14px 22px', alignItems: 'center', borderTop: `1.5px dashed ${t.border}`, fontSize: 13 }}>
              <span style={{ fontFamily: FONTS.mono, fontWeight: 600, color: t.ink }}>{r.id}</span>
              <span>{r.z}</span>
              <Tag theme={t} tone={r.tone}>{r.s}</Tag>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: r.s === 'Overdue' ? t.coral : t.muted }}>{r.due}</span>
              <span style={{ fontFamily: FONTS.mono, textAlign: 'right' }}>{r.items}</span>
              <span style={{ fontFamily: FONTS.mono, textAlign: 'right', color: r.v === '0' ? (t.mode==='dark'?t.mint:'#1F6B45') : r.v.startsWith('−') ? t.coral : t.muted, fontWeight: 600 }}>{r.v}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 9, background: r.init === '?' ? t.surfaceAlt : t.primary, color: r.init === '?' ? t.muted : t.primaryText, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 10.5 }}>{r.init}</div>
                <span style={{ color: r.who === '—' ? t.muted : t.body }}>{r.who}</span>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </Shell>
  );
}

Object.assign(window, { ScreenInboundList, ScreenInboundDetail, ScreenProducts, ScreenWarehouses, ScreenCounts });
