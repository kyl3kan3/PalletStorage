// Brand: "Stacks" — a playful warehouse OS.
// Mascot is a little stacked-pallet guy called "Cubby". Warm cream canvas,
// marigold primary, deep ink navy, mint + coral accents.

const BRAND = {
  name: 'stacks',
  tagline: 'warehouse that feels good',
};

const palette = {
  // Brand
  marigold: '#FFB23E',   // primary
  marigoldDeep: '#E88F10',
  coral: '#FF6B5B',      // alert / playful accent
  mint: '#7FD8A8',       // success
  sky: '#7BB4E8',        // info
  lilac: '#C9B8F0',      // tertiary tag
  // Neutrals (warm)
  ink: '#1F1A17',
  charcoal: '#2E2824',
  slate: '#5A4F46',
  fog: '#8B7F73',
  pebble: '#C9BFB3',
  cream: '#FAF6EE',
  paper: '#F5EFE2',
  snow: '#FFFDF8',
};

function themeFor(mode) {
  if (mode === 'dark') {
    return {
      mode: 'dark',
      bg: '#1A1613',
      bgAlt: '#221D19',
      surface: '#2B2520',
      surfaceAlt: '#352D27',
      border: 'rgba(255,255,255,.08)',
      borderStrong: 'rgba(255,255,255,.14)',
      ink: '#FBF5E9',
      body: '#E8DFCF',
      muted: '#A89C8B',
      mutedSoft: '#6E6558',
      primary: palette.marigold,
      primaryText: '#1F1308',
      primaryDeep: palette.marigoldDeep,
      primarySoft: 'rgba(255,178,62,.14)',
      coral: palette.coral,
      coralSoft: 'rgba(255,107,91,.14)',
      mint: palette.mint,
      mintSoft: 'rgba(127,216,168,.14)',
      sky: palette.sky,
      skySoft: 'rgba(123,180,232,.14)',
      lilac: palette.lilac,
      shadow: '0 1px 0 rgba(255,255,255,.03), 0 8px 24px rgba(0,0,0,.35)',
      shadowLift: '0 1px 0 rgba(255,255,255,.04), 0 12px 36px rgba(0,0,0,.45)',
    };
  }
  return {
    mode: 'light',
    bg: palette.cream,
    bgAlt: palette.paper,
    surface: palette.snow,
    surfaceAlt: '#F3ECDD',
    border: 'rgba(31,26,23,.08)',
    borderStrong: 'rgba(31,26,23,.16)',
    ink: palette.ink,
    body: palette.charcoal,
    muted: palette.slate,
    mutedSoft: palette.fog,
    primary: palette.marigold,
    primaryText: '#1F1308',
    primaryDeep: palette.marigoldDeep,
    primarySoft: '#FFEACC',
    coral: palette.coral,
    coralSoft: '#FFDFDA',
    mint: palette.mint,
    mintSoft: '#DBF3E5',
    sky: palette.sky,
    skySoft: '#DEECF9',
    lilac: palette.lilac,
    shadow: '0 1px 0 rgba(255,255,255,.7) inset, 0 1px 3px rgba(31,26,23,.06), 0 8px 28px rgba(31,26,23,.05)',
    shadowLift: '0 1px 0 rgba(255,255,255,.8) inset, 0 2px 8px rgba(31,26,23,.08), 0 18px 40px rgba(31,26,23,.08)',
  };
}

const FONTS = {
  display: '"Fraunces", Georgia, serif',
  sans: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
};

// Cubby — stacked pallet mascot. Three blocks + little feet + eyes.
// Used as logo + empty-state + avatar-size.
function Cubby({ size = 56, mood = 'happy', theme }) {
  const t = theme || themeFor('light');
  const w = size, h = size;
  // Eyes offset by mood
  const eye = { happy: [0, 0], think: [1, -1], wow: [0, 1], sleep: [0, 2] }[mood] || [0, 0];
  return (
    <svg viewBox="0 0 64 64" width={w} height={h} style={{ display: 'block' }}>
      {/* shadow */}
      <ellipse cx="32" cy="58" rx="20" ry="2.5" fill="rgba(0,0,0,.12)" />
      {/* bottom crate */}
      <rect x="6" y="40" width="52" height="16" rx="5" fill={t.primaryDeep} />
      <rect x="6" y="40" width="52" height="4" rx="2" fill={t.primary} />
      {/* middle crate */}
      <rect x="10" y="24" width="44" height="16" rx="5" fill={t.primary} />
      <rect x="10" y="24" width="44" height="3.5" rx="1.75" fill="#FFD488" />
      {/* top crate (face) */}
      <rect x="14" y="8" width="36" height="18" rx="5" fill={t.ink} />
      <rect x="14" y="8" width="36" height="3.5" rx="1.75" fill={t.charcoal || '#2E2824'} opacity=".5" />
      {/* face */}
      {mood === 'sleep' ? (
        <>
          <path d={`M 22 ${17 + eye[1]} q 2 -2 4 0`} stroke={t.primary} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d={`M 38 ${17 + eye[1]} q 2 -2 4 0`} stroke={t.primary} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={24 + eye[0]} cy={17 + eye[1]} r="2" fill={t.primary} />
          <circle cx={40 + eye[0]} cy={17 + eye[1]} r="2" fill={t.primary} />
        </>
      )}
      {/* mouth */}
      {mood === 'wow' ? (
        <ellipse cx="32" cy="22" rx="2" ry="2.5" fill={t.primary} />
      ) : (
        <path d={mood === 'think' ? 'M 29 22 L 35 22' : 'M 28 21 Q 32 24 36 21'} stroke={t.primary} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      )}
      {/* feet */}
      <rect x="14" y="54" width="8" height="4" rx="1.5" fill={t.ink} />
      <rect x="42" y="54" width="8" height="4" rx="1.5" fill={t.ink} />
    </svg>
  );
}

// Wordmark — "stacks" in Fraunces italic + little cubby dot
function Wordmark({ theme, size = 22 }) {
  const t = theme || themeFor('light');
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FONTS.display, fontWeight: 600, fontSize: size, color: t.ink, letterSpacing: -0.5, fontStyle: 'italic' }}>
      <div style={{ width: size + 6, height: size + 6, position: 'relative' }}>
        <Cubby size={size + 6} theme={t} />
      </div>
      <span>stacks<span style={{ color: t.primary }}>.</span></span>
    </div>
  );
}

Object.assign(window, { BRAND, palette, themeFor, FONTS, Cubby, Wordmark });
