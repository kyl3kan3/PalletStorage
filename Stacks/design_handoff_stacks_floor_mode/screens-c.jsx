// Variation C — Dark scanner-first (glove-friendly, marigold-bold, action-only)

function C_TopBar({ t, label, sub, right }) {
  return (
    <div style={{ padding: '14px 18px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <Cubby size={28} theme={t} mood="happy" />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: '#FFB23E', letterSpacing: 0.8, fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
      </div>
      <div style={{ marginLeft: 'auto' }}>{right}</div>
    </div>
  );
}

function C_Today({ t }) {
  return (
    <Frame t={t} dark bg="#0F0C0A">
      <C_TopBar t={t} label="WH-01 · MAYA" sub="Morning shift · 5 left"
        right={<div style={{ display: 'flex', gap: 6 }}>
          <div style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(127,216,168,.16)', fontFamily: FONTS.mono, fontSize: 10, color: '#7FD8A8', fontWeight: 700 }}>● LIVE</div>
        </div>}
      />

      {/* hero scan button — primary CTA on Today */}
      <div style={{ padding: '6px 16px 0' }}>
        <button style={{
          width: '100%', padding: '22px 22px', borderRadius: 22,
          background: '#FFB23E', color: '#1F1308', border: 'none',
          display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 12px 28px rgba(255,178,62,.4), inset 0 -3px 0 rgba(0,0,0,.16)',
        }}>
          <Ic.Scan size={36} color="#1F1308" />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1 }}>Open scanner</div>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginTop: 4 }}>or hardware trigger</div>
          </div>
          <div style={{ marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 10, background: 'rgba(31,19,8,.18)' }}>TRG</div>
        </button>
      </div>

      <div style={{ padding: '16px 18px 0', fontFamily: FONTS.mono, fontSize: 10.5, color: 'rgba(255,255,255,.5)', letterSpacing: 0.8, fontWeight: 700, textTransform: 'uppercase' }}>Queue · 5 left</div>
      <div style={{ padding: '8px 16px 100px' }}>
        {[
          { type: 'PICK',    tone: '#FFB23E', ref: 'SO-24881', cust: 'Glacier Foods · 11/22',  ship: '5:00p', urgent: true },
          { type: 'RECEIVE', tone: '#7BB4E8', ref: 'PO-7821',  cust: 'Sunrise · D-02',         ship: '3:30p' },
          { type: 'PICK',    tone: '#FFB23E', ref: 'SO-24878', cust: 'Alpine Cafés · 0/11',    ship: 'tmw' },
          { type: 'COUNT',   tone: '#7FD8A8', ref: 'CC-0418',  cust: 'A2 · Dry · 84',          ship: 'tod' },
          { type: 'PUTAWAY', tone: '#C9B8F0', ref: 'P-7KP02M', cust: '8 pallets → A3',         ship: 'aft' },
        ].map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, marginTop: 8,
            padding: '14px 14px', borderRadius: 16,
            background: r.urgent ? 'rgba(255,178,62,.1)' : 'rgba(255,255,255,.04)',
            border: `1.5px solid ${r.urgent ? 'rgba(255,178,62,.4)' : 'rgba(255,255,255,.08)'}`,
          }}>
            <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: r.tone }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: FONTS.mono, fontSize: 10, fontWeight: 800, color: r.tone, letterSpacing: 0.8 }}>{r.type}</span>
                <span style={{ fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700, color: '#fff' }}>{r.ref}</span>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cust}</div>
            </div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 12.5, fontWeight: 800, color: r.urgent ? '#FF6B5B' : '#fff', minWidth: 40, textAlign: 'right' }}>{r.ship}</div>
          </div>
        ))}
      </div>

      <TabBar t={t} variant="C" active="home" />
    </Frame>
  );
}

function C_Scan({ t }) {
  return (
    <Frame t={t} dark bg="#000">
      {/* full-bleed camera */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 25%, rgba(255,178,62,.35), #0F0C0A 60%, #000 100%)' }} />
      <div style={{ position: 'absolute', left: '12%', right: '12%', bottom: '24%', height: '36%', background: 'linear-gradient(180deg, rgba(255,178,62,.45), rgba(232,143,16,.6))', borderRadius: 8, transform: 'perspective(500px) rotateX(20deg)', boxShadow: '0 40px 80px rgba(0,0,0,.7)' }} />
      <div style={{ position: 'absolute', left: '28%', right: '28%', top: '36%', height: 80, background: '#FAF6EE', borderRadius: 4, padding: '10px 12px', display: 'flex', alignItems: 'end', gap: 2 }}>
        {Array.from({length: 30}).map((_, i) => (
          <div key={i} style={{ width: i % 3 ? 2 : 3, background: '#1F1A17', height: i % 4 ? 56 : 44, flex: 'none' }} />
        ))}
      </div>

      {/* top: switch modes */}
      <div style={{ position: 'absolute', top: 56, left: 0, right: 0, padding: '0 16px' }}>
        <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 14, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,.12)' }}>
          {['LPN', 'SKU', 'LOC', 'LOT'].map((m) => (
            <div key={m} style={{
              flex: 1, padding: '8px 10px', borderRadius: 10, textAlign: 'center',
              background: m === 'LPN' ? '#FFB23E' : 'transparent',
              color: m === 'LPN' ? '#1F1308' : '#fff',
              fontFamily: FONTS.mono, fontSize: 12, fontWeight: 800, letterSpacing: 0.5,
            }}>{m}</div>
          ))}
        </div>
      </div>

      {/* corners */}
      {['tl','tr','bl','br'].map((k) => {
        const pos = k === 'tl' ? { top: '24%', left: '8%' } : k === 'tr' ? { top: '24%', right: '8%' } : k === 'bl' ? { bottom: '32%', left: '8%' } : { bottom: '32%', right: '8%' };
        const rot = k === 'tl' ? 0 : k === 'tr' ? 90 : k === 'bl' ? 270 : 180;
        return (
          <div key={k} style={{ position: 'absolute', ...pos, width: 42, height: 42, transform: `rotate(${rot}deg)`, zIndex: 5 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 38, height: 4, background: '#FFB23E', borderRadius: 2, boxShadow: '0 0 12px rgba(255,178,62,.7)' }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: 38, background: '#FFB23E', borderRadius: 2, boxShadow: '0 0 12px rgba(255,178,62,.7)' }} />
          </div>
        );
      })}

      {/* bottom HUD */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 110, padding: '0 16px' }}>
        <div style={{ borderRadius: 22, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,.12)', padding: '16px 18px' }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: '#FFB23E', letterSpacing: 0.8, fontWeight: 800, textTransform: 'uppercase' }}>Last scan · 12s ago</div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: 1.5, marginTop: 4 }}>P-9QK4X72L</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>Pallet · A2-02-B · 312kg · 3 SKU</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#FFB23E', color: '#1F1308', border: 'none', fontFamily: FONTS.sans, fontSize: 13, fontWeight: 800 }}>OPEN</button>
            <button style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.16)', fontFamily: FONTS.sans, fontSize: 13, fontWeight: 700 }}>MOVE</button>
            <button style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.16)', fontFamily: FONTS.sans, fontSize: 13, fontWeight: 700 }}>LABEL</button>
          </div>
        </div>
      </div>

      {/* scan line */}
      <div style={{ position: 'absolute', left: '8%', right: '8%', top: '52%', height: 2, background: '#FFB23E', boxShadow: '0 0 20px #FFB23E', zIndex: 4 }} />

      <TabBar t={t} variant="C" active="scan" />
    </Frame>
  );
}

function C_Pick({ t }) {
  return (
    <Frame t={t} dark bg="#0F0C0A">
      <C_TopBar t={t} label="SO-24881 · LINE 13/22" sub="Glacier Foods · ship 5:00p"
        right={<div style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(255,107,91,.18)', fontFamily: FONTS.mono, fontSize: 10.5, color: '#FF6B5B', fontWeight: 800 }}>1H 12M</div>}
      />

      {/* HUGE goto */}
      <div style={{ padding: '4px 16px 0' }}>
        <div style={{ borderRadius: 26, background: '#FFB23E', color: '#1F1308', padding: '20px 22px', position: 'relative', overflow: 'hidden', boxShadow: '0 14px 32px rgba(255,178,62,.35)' }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: 11, fontWeight: 800, letterSpacing: 1, opacity: 0.7 }}>GO TO</div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 64, fontWeight: 800, letterSpacing: 2, lineHeight: 1, marginTop: 4 }}>A2-02-B</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700 }}>
              <Ic.Pin size={14} color="#1F1308" />
              <span>32 STEPS · 18s</span>
            </div>
            <Ic.Arrow size={28} color="#1F1308" />
          </div>
        </div>
      </div>

      {/* big qty card */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ borderRadius: 22, background: 'rgba(255,255,255,.04)', border: '1.5px solid rgba(255,255,255,.1)', padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: '#FFB23E', fontWeight: 800, letterSpacing: 0.8 }}>SKU-00137</div>
              <div style={{ fontSize: 17, color: '#fff', marginTop: 3, fontWeight: 600 }}>Cold-Press Olive Oil 1L</div>
            </div>
            <Pill t={t} tone="sky" size="sm">A-vel</Pill>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 18 }}>
            <div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: 'rgba(255,255,255,.5)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>Take</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 64, fontWeight: 800, color: '#fff', lineHeight: 1 }}>12<span style={{ fontSize: 22, color: 'rgba(255,255,255,.5)', fontWeight: 700 }}> ea</span></div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: 'rgba(255,255,255,.5)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>Lot</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 16, color: '#fff', marginTop: 4, fontWeight: 700 }}>L-2024-814</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>exp Jan '26</div>
            </div>
          </div>
        </div>
      </div>

      {/* big scan button */}
      <div style={{ padding: '12px 16px 0' }}>
        <button style={{
          width: '100%', padding: '20px 22px', borderRadius: 18, border: 'none',
          background: '#fff', color: '#0F0C0A',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          fontFamily: FONTS.sans, fontSize: 18, fontWeight: 800,
          boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.1)',
        }}>
          <Ic.Scan size={22} color="#0F0C0A" />SCAN TO CONFIRM
        </button>
      </div>
      <div style={{ padding: '8px 16px 0', display: 'flex', gap: 8 }}>
        <button style={{ flex: 1, padding: '12px', borderRadius: 14, background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.16)', fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}>SKIP</button>
        <button style={{ flex: 1, padding: '12px', borderRadius: 14, background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.16)', fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}>SHORT</button>
        <button style={{ flex: 1, padding: '12px', borderRadius: 14, background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.16)', fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}>SUB</button>
      </div>

      <TabBar t={t} variant="C" active="tasks" />
    </Frame>
  );
}

function C_Receive({ t }) {
  const lines = [
    { sku: 'SKU-00421', n: 'Quinoa 2kg',     e: 48, r: 48, done: true },
    { sku: 'SKU-00815', n: 'Choc Bars',      e: 36, r: 24, short: true },
    { sku: 'SKU-01902', n: 'Apricots',       e: 60, r: 60, done: true },
    { sku: 'SKU-00137', n: 'Olive Oil 1L',   e: 24, r: 24, done: true },
    { sku: 'SKU-02431', n: 'Almond Butter',  e: 12, r: 0, active: true },
  ];
  return (
    <Frame t={t} dark bg="#0F0C0A">
      <C_TopBar t={t} label="PO-7821 · DOCK 2" sub="Sunrise Organics · receiving"
        right={<div style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(255,107,91,.18)', fontFamily: FONTS.mono, fontSize: 10.5, color: '#FF6B5B', fontWeight: 800 }}>1 SHORT</div>}
      />

      <div style={{ padding: '4px 16px 0' }}>
        <div style={{ borderRadius: 18, background: 'rgba(255,255,255,.04)', border: '1.5px solid rgba(255,255,255,.1)', padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.mono, fontSize: 11, fontWeight: 800, color: '#FFB23E', letterSpacing: 0.8 }}>
            <span>3 / 5 LINES</span>
            <span style={{ color: '#FF6B5B' }}>VAR −12 EA</span>
          </div>
          <div style={{ marginTop: 8, height: 8, background: 'rgba(255,255,255,.1)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: '60%', background: '#7FD8A8' }} />
            <div style={{ width: '20%', background: '#FF6B5B' }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 16px 100px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lines.map((r, i) => (
            <div key={i} style={{
              padding: 14, borderRadius: 16,
              background: r.active ? 'rgba(255,178,62,.12)' : 'rgba(255,255,255,.04)',
              border: `1.5px solid ${r.active ? '#FFB23E' : 'rgba(255,255,255,.08)'}`,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11,
                background: r.done ? '#7FD8A8' : r.short ? '#FF6B5B' : r.active ? '#FFB23E' : 'rgba(255,255,255,.1)',
                display: 'grid', placeItems: 'center', color: r.active ? '#1F1308' : '#fff',
              }}>
                {r.done ? <Ic.Check size={18} color="#0F4225" /> : r.short ? <Ic.X size={16} color="#fff" /> : <span style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 800 }}>{i+1}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONTS.mono, fontSize: 12, fontWeight: 800, color: '#fff' }}>{r.sku}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.n}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FONTS.mono, fontSize: 18, fontWeight: 800, color: r.short ? '#FF6B5B' : '#fff' }}>{r.r}<span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', fontWeight: 600 }}>/{r.e}</span></div>
              </div>
            </div>
          ))}
        </div>

        <button style={{
          marginTop: 14, width: '100%', padding: '18px', borderRadius: 16, border: 'none',
          background: '#FFB23E', color: '#1F1308', fontFamily: FONTS.sans, fontSize: 16, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: '0 10px 24px rgba(255,178,62,.35)',
        }}>
          <Ic.Scan size={20} color="#1F1308" />SCAN LINE 5
        </button>
      </div>

      <TabBar t={t} variant="C" active="tasks" />
    </Frame>
  );
}

function C_Putaway({ t }) {
  return (
    <Frame t={t} dark bg="#0F0C0A">
      <C_TopBar t={t} label="P-7KP02M · 312KG" sub="From PO-7821 · 3 SKU"
        right={<Pill t={t} tone="primary" size="sm">PUTAWAY</Pill>}
      />

      <div style={{ padding: '4px 16px 0' }}>
        <div style={{ borderRadius: 26, background: '#FFB23E', color: '#1F1308', padding: '22px 22px', boxShadow: '0 14px 32px rgba(255,178,62,.35)', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: 11, fontWeight: 800, letterSpacing: 1, opacity: 0.7 }}>DROP AT</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, background: 'rgba(31,19,8,.18)', fontFamily: FONTS.mono, fontSize: 10, fontWeight: 800 }}>
              <Ic.Spark size={11} color="#1F1308" />BEST 94
            </div>
          </div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 64, fontWeight: 800, letterSpacing: 2, lineHeight: 1, marginTop: 6 }}>A3-04-C</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Same lot already there · empty bay</span>
            <Ic.Arrow size={28} color="#1F1308" />
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 16px 0', fontFamily: FONTS.mono, fontSize: 10.5, color: 'rgba(255,255,255,.5)', fontWeight: 800, letterSpacing: 0.8 }}>ALTS ↓</div>
      <div style={{ padding: '6px 16px 0' }}>
        {[['A3-04-B', '81', 'adjacent · 6 free'], ['A2-02-A', '62', 'origin · 3 free']].map(([l, s, why]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', marginTop: 6, borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}>
            <span style={{ fontFamily: FONTS.mono, fontSize: 14, color: '#fff', fontWeight: 800, letterSpacing: 0.5, width: 86 }}>{l}</span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: '#FFB23E', fontWeight: 800 }}>{s}</span>
            <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,.55)' }}>{why}</span>
            <Ic.Arrow size={14} color="rgba(255,255,255,.5)" />
          </div>
        ))}
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <button style={{
          width: '100%', padding: '20px', borderRadius: 18, border: 'none',
          background: '#fff', color: '#0F0C0A', fontFamily: FONTS.sans, fontSize: 17, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.1)',
        }}>
          <Ic.Scan size={20} color="#0F0C0A" />SCAN LOCATION
        </button>
      </div>
      <div style={{ padding: '8px 16px 0' }}>
        <button style={{ width: '100%', padding: '12px', borderRadius: 14, background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.16)', fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>OVERRIDE LOCATION</button>
      </div>

      <TabBar t={t} variant="C" active="tasks" />
    </Frame>
  );
}

Object.assign(window, { C_Today, C_Scan, C_Pick, C_Receive, C_Putaway });
