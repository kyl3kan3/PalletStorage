# Handoff: Stacks — Floor mode (web + mobile)

## Overview

This is the complete UI redesign of **Stacks** (the WMS at `kyl3kan3/PalletStorage`) in a single visual direction: **Floor mode** — dark, marigold-bold, scanner-first, glove-friendly. Same DNA across the manager's desktop dashboard (`apps/web`) and the floor-staff phone app (`apps/mobile`).

Two targets, one design system.

| | Web (`apps/web`) | Mobile (`apps/mobile`) |
|---|---|---|
| **User** | Warehouse manager at a desktop in the office | Floor staff with phones / handheld scanners |
| **Stack** | Next.js 15 App Router + tRPC v11 + Drizzle | Expo (React Native) + tRPC client |
| **Screens designed** | Home, Operations, Outbound (list+detail), Inventory, Inbound (list+detail), Products, Warehouses, Cycle counts | Today, Scan, Pick, Receive, Putaway |
| **Density** | High — operations-center; big mono numbers, multi-pane | Low — one job at a time, huge hit targets |

## About the design files

The files in this bundle are **design references created in browser-side React/JSX** (no build step — loaded via Babel standalone). They are prototypes showing intended look and behavior — **not production code to copy directly.**

Re-implement these designs **in the target codebase's existing environment**, following the patterns already in `apps/web` and `apps/mobile`:

- **Web** → Next.js App Router pages under `apps/web/src/app/`, with shared kit components in `apps/web/src/components/kit.tsx` (per `CLAUDE.md`: "prefer kit components"). Server data via tRPC v11 + TanStack Query. Style with whatever the app currently uses (Tailwind + CSS variables for tokens is fine).
- **Mobile** → Expo (React Native) screens under `apps/mobile/`. Use `expo-camera` for scanning, `expo-haptics` for tactile feedback. Translate inline `style={{ ... }}` to `StyleSheet` and use the design tokens at the bottom of this README as the source of truth.

Do not paste the `<div>` markup into JSX components verbatim — interpret it. The HTML uses web concepts that don't map 1:1 to React Native (`gridTemplateColumns`, `backdropFilter`, `box-shadow`). Use the tokens, copy the layout intent.

## Fidelity

**High-fidelity.** All colors, type scale, spacing, radii, and copy are final. Recreate as close to pixel-perfect as the target environment allows.

## Where it lives in the repo

This handoff bundle is a sibling of `design-system/` in the existing repo:

```
PalletStorage/
├─ apps/
│  ├─ web/         ← implement web screens here
│  └─ mobile/      ← implement mobile screens here
├─ packages/
│  ├─ api/         ← tRPC routers (shared, already built)
│  ├─ core/        ← domain logic (already built — see _stateMachine.ts)
│  ├─ db/          ← Drizzle schema + migrations (already built)
│  └─ ui/          ← shared web kit (Btn, Card, PageTitle, Tag, TextField — extend these)
├─ design-system/  ← original "warm cream" direction (legacy reference only)
└─ design_handoff_stacks_floor_mode/   ← THIS bundle
```

After implementation, the original warm-cream `design-system/` files are **historical reference**. The new direction supersedes them.

## Per `CLAUDE.md` rules (do not violate)

- **Commit and push directly to `main`.** No feature branches.
- **Money is integer cents everywhere** (`unitPriceCents`, `storageRateCentsPerPalletMonth`). Never floats.
- **All tRPC procedures gate on `requireOrgId(ctx)`** — no cross-tenant reads.
- **Manager-gated mutations use `managerProcedure`** (overrides, cancels, reason-logging); **everyday intake uses `tenantProcedure`** (picks, receives).
- **Set `app.org_id` per request** so RLS filters everything — see migration `0001_rls.sql`.

---

## Web — screens (`apps/web`)

All screens use the same dark `FShell` (sidebar + top bar + page title + content area). The sidebar shows: **Home · Operations · Inbound (8) · Outbound (34) · Inventory · Products · Warehouses · Cycle counts (4)**, plus a live "WH-01 · 42 on floor · shift 2/3" status card at the bottom. The top bar has a wide search field placeholder (`P-… · SO-… · SKU-… · A2-02-B`) and a user chip (initials avatar in marigold).

### Web · Home (`/`)
- **Purpose**: live operations dashboard — what's happening *right now*.
- **Hero card** (60% width): pill kicker ("Throughput · ahead of pace"), 44-px headline ("42 picks in flight, 2 trucks at the dock."), supporting paragraph, two CTAs (`Today's plan` primary marigold + `Open shift report` ghost). Right side: 180-px sparkline panel ("Last 8 hours" mini bar chart with peak hour glowing marigold).
- **Needs you feed** (40% width): coral-pinned card with 3 urgent items — short-shipped PO, overdue cycle count, invoices ready for QBO. Each row: tinted icon square + title + sub + time-ago.
- **KPI row**: 4 large stat tiles — Received (284), Shipped (412), Dock-to-stock (47 min), On-time (96%). Each shows mono numeral, delta (mint or coral), and a 8-bar sparkline.
- **Active waves table** (60%): live picks/receives with progress bars, ship times (coral if same-day urgent), picker avatars.
- **Cubby ops card** (40%): mascot + 2 suggested actions (schedule cycle count, divert inbound to less-full WH).

### Web · Operations (`/overview`)
- **Purpose**: rolled-up KPIs and ledger.
- **KPI row** (4 tiles): Pallets stored, Open inbound, Picking, Moves/24h.
- **Throughput chart** (66% width): 12-hour bar chart, in/out grouped, current hour glowing marigold. Toggle pills (In / Out / Both) top-right.
- **Dock-to-stock ring** (33% width): SVG ring chart with mono percent label center; p50 / p95 / Δ-week stats stacked beside.
- **Top stock table** (55% width): top 4 SKUs by on-hand, pallet count pill, big mono on-hand number.
- **Movement ledger** (45% width): live activity feed with colored dot indicators and `MM:SS ago` timestamps.

### Web · Outbound list (`/orders/outbound`)
- **Purpose**: scan the order pipeline.
- **Tabs**: Active (12) · Ready (4) · Shipped · Cancelled
- **KPI row**: Open (34), Picking (12), Ready (4), On-time (96%).
- **Table**: 8-column grid — `Ref | Customer | Status | Ship by | Lines | Progress bar | Crew chip | →`. Picking rows get a marigold-soft background tint + a glow on the progress bar. Crew chip shows picker initials (or `—` for unassigned).

### Web · Outbound detail (`/orders/outbound/[ref]`)
- **Purpose**: dive into one order. Manager view of what's happening.
- **Header**: order ref as title (`SO-24881`), eyebrow pill, subtitle with customer + ship countdown. Right actions: danger `Cancel order` + primary `Mark packed`.
- **Stepper card** (full width): 4 steps — Open ✓ · **Picking (active, marigold glow)** · Packed · Shipped. Connected by progress bars.
- **Lines table** (60% width): #, SKU, name, ordered qty, picked qty, progress bar. Active line tinted marigold-soft; completed lines show check + mint qty.
- **Right column** (40% width): Cubby ETA card, Crew card (avatars + per-picker progress bars), Ship info card (carrier, dock, ship-to, weight).

### Web · Inventory / Scan (`/inventory`)
- **Purpose**: paste an LPN, SKU, location, or PO and see everything.
- **Hero scan field** (45% width): massive marigold-bordered input with 30-px mono LPN + cursor + green "Stored" pill. Hint text below shows valid prefixes. Recent scans list (5 items) — each row: clock icon + mono code + type pill + brief description + time-ago.
- **Result card** (55% width): 60-px squircle pallet icon, big LPN, location pill, 6-cell metadata grid (Location / Received / Lot / Weight / From PO / Age), contents table (3 SKUs with qty), action row (Move primary + Adjust + Cycle count + Label).

### Web · Inbound list (`/orders/inbound`)
- **Dock door status strip** (above table): 4 cards for D-01 through D-04 — colored status dot, dock code, current PO + progress. Active dock glows marigold.
- **Table**: Ref | Supplier | Status | Expected | Lines | Door | Progress | →.

### Web · Inbound detail (`/orders/inbound/[ref]`)
- **Lines table** (60%): 6-col grid with variance pill per row. Short lines tinted coral-soft, matched lines show mint variance pill.
- **Right column** (40%):
  - **Variance Cubby card** (coral-pinned): mascot mood=wow, "Heads up · variance" pill, callout copy, primary danger "Log reason" button.
  - **Putaway plan card**: 3 zones with mini progress bars (A2 dry / A3 dry / C1 bulk) showing suggested pallet distribution.
  - **Truck card**: 2×2 grid of carrier / trailer / driver / ETA-out.

### Web · Products (`/products`)
- **Filter strip**: All (1284) · A · B · C velocity tabs + `Filter` button.
- **Table**: SKU | Name | Barcode | Weight | Velocity pill | On hand | Loc count.

### Web · Warehouses (`/warehouses`)
- **2-column grid of site cards**. Each card:
  - **Header**: 56-px Cubby (mood reflects utilization — `wow` for >80%, `sleep` for <50%), site name, code, location pin, utilization pill.
  - **Body**: 96-px ring chart + 2×2 stats grid (Pallets / Capacity / Today / Avg dwell) + `Open` button.
  - **Hot sites** (>80% util) get a coral top-border accent.

### Web · Cycle counts (`/counts`)
- **Tabs**: Open (4) · Reviewing (2) · Approved
- **KPI row**: Open · Reviewing · 30-day accuracy.
- **Table**: Count ID | Zone | Status | Due | Items | Variance | Assigned. Overdue rows tinted coral-soft.

---

## Mobile — screens (`apps/mobile`)

Five screens. All dark `#0F0C0A`, marigold-bold, big hit targets (60px+), bottom tab bar (Today · Scan · Tasks · More) with active tab as a solid marigold pill.

### Mobile · Today (queue / home)
- **Top bar**: Cubby (28px happy) + "WH-01 · MAYA" eyebrow + "Morning shift · 5 left" subtitle + green `● LIVE` pill.
- **Hero "Open scanner" button**: huge marigold card with 36-px scan icon, 22-px "Open scanner" label, "or hardware trigger" sub, and a `TRG` mono badge on the right indicating the hardware-trigger keybind. Glowing marigold shadow.
- **Queue list (5 items)**: each card has a 4-px colored side-stripe (marigold for PICK, sky for RECV, mint for COUNT, lilac for PUT), type label in mono, reference number, customer/zone, ship time (coral if urgent). Top "active" item gets a marigold-soft background.

### Mobile · Scan (camera)
- **Full-bleed camera view** with radial marigold haze emanating from top-left.
- **Mode switcher** (glass pill, top): LPN | SKU | LOC | LOT — active mode is solid marigold.
- **Viewfinder corners** (4 marigold-glowing L-shapes).
- **Scan line** (animated, 1.5s loop top↔bottom, marigold with glow shadow).
- **Bottom HUD** (glass card with backdrop-blur): last scan info (LPN + location + weight + SKU count) + 3 actions (OPEN primary marigold / MOVE ghost / LABEL ghost).
- **Hardware trigger** support — see "Scanning" under Interactions.

### Mobile · Pick run
- **Top bar**: Cubby + "SO-24881 · LINE 13/22" + customer + coral countdown pill (`1H 12M`).
- **Hero "Go to" card**: massive marigold card with 11-px "GO TO" mono kicker, 64-px monospace location code (`A2-02-B`), pin icon + step count + walk seconds, big arrow icon on the right. Marigold glow shadow.
- **Item card** (dark, white-text): SKU + name + velocity pill at top; then a 2-column row with the huge "Take 12 ea" quantity on the left and lot/expiry on the right (also mono, larger).
- **Confirm strip**: white "SCAN TO CONFIRM" button (full width, 20px padding, 17px bold) + three smaller ghost buttons (SKIP / SHORT / SUB).

### Mobile · Receive
- **Top bar**: Cubby + PO + dock + coral `1 SHORT` pill.
- **Progress card**: "3 / 5 LINES" + "VAR −12 EA" mono labels + a split 2-color progress bar (mint matched + coral short).
- **Lines list** (5 items): each row a card with status badge on the left (mint ✓ / coral ✗ / number badge for todo, marigold for active), SKU + name, and big mono `received/expected` qty on the right (coral when short).
- **Primary action** at bottom: marigold "SCAN LINE 5" button (the next-up todo line) with glow shadow.

### Mobile · Putaway
- **Top bar**: Cubby + LPN + weight + `PUTAWAY` pill.
- **Suggestion hero**: massive marigold card with 11-px "DROP AT" kicker, 64-px monospace location code (`A3-04-C`), confidence chip (`BEST 94`), plain-English reason ("Same lot already there · empty bay"), big arrow icon.
- **Alternatives list** (2-3 items): compact rows with location code, confidence number, one-line reason.
- **Primary action**: white "SCAN LOCATION" button + ghost "OVERRIDE LOCATION" below it.

---

## Interactions & behavior

### Routing (web)
The repo is Next.js App Router. Slot screens under:
```
apps/web/src/app/
  page.tsx                     → Home
  overview/page.tsx            → Operations
  orders/outbound/page.tsx     → Outbound list
  orders/outbound/[ref]/page.tsx → Outbound detail
  orders/inbound/page.tsx      → Inbound list
  orders/inbound/[ref]/page.tsx → Inbound detail
  inventory/page.tsx           → Inventory / Scan
  products/page.tsx            → Products
  warehouses/page.tsx          → Warehouses
  counts/page.tsx              → Cycle counts
  settings/integrations/page.tsx → QBO connect (already exists per README)
```
Search bar (top of every page) opens a Cmd+K palette. Implement with `cmdk` or your existing pattern.

### Routing (mobile)
Use **Expo Router** with `(tabs)` layout. Tabs: `today | scan | tasks | more`.
```
apps/mobile/app/
  (tabs)/
    today.tsx        → Today queue
    scan.tsx         → Scan / camera
    tasks/index.tsx  → Tasks list (basically Today + filters)
    tasks/pick/[ref].tsx     → Pick run
    tasks/receive/[ref].tsx  → Receive
    tasks/putaway/[lpn].tsx  → Putaway suggest
    more.tsx         → Settings / profile / sign out
```

### Scanning (mobile)
- **Hardware trigger**: most warehouse iPhones expose the trigger as a keyboard event or vendor SDK callback. Wire one global handler:
  1. Trigger haptic (`expo-haptics` `ImpactFeedbackStyle.Medium`).
  2. Read the scanned string.
  3. Auto-route by prefix: `P-` → pallet detail, `L-` → location detail, `SKU-` → product, `PO-` → inbound, `SO-` → outbound, `CC-` → cycle count.
- **Camera fallback**: `expo-camera` with `BarCodeScanner.Constants.BarCodeType.{code128,code39,qr,dataMatrix}`.
- **Manual entry**: every scan screen accepts typed input — labels get torn.
- **Confirmation flow**: Pick / Putaway require *two* scans (location + SKU/LPN). On success: green flash + success haptic + check icon snap-in (300ms). On mismatch: red flash + error haptic + coral toast "Wrong location — scan A2-02-B".

### Search (web)
Top-bar search is the primary navigation accelerator. Pattern: detect prefix, route directly.
- `P-...` → `/inventory?lpn=...`
- `SO-...` → `/orders/outbound/...`
- `PO-...` → `/orders/inbound/...`
- `SKU-...` → `/products?sku=...`
- `A2-02-B` (location regex) → `/inventory?loc=...`
- Anything else → fuzzy search across all of the above.

### Animations
- **Tab change** (web sidebar + mobile bottom bar): 200ms ease-out on indicator background.
- **Scan line** (mobile C scan): 1.5s linear top↔bottom loop, marigold with `boxShadow: 0 0 20px marigold`.
- **Card press** (mobile): scale to 0.98 over 80ms via `Pressable`.
- **Marigold glow on active items** (web sidebar active row, hero buttons, active progress bars): CSS `box-shadow: 0 0 12px rgba(255,178,62,.4)`.
- **Live ledger updates** (web Home): list items fade in from the top, 40-ms stagger.
- **Auto-refresh** (web Operations + Home): poll every 30s via TanStack Query `refetchInterval`. Show "updated 4s ago" in mono next to each card title.

### Loading / empty / error states
- **Loading**: skeleton rows in `t.surfaceAlt` — 3 per list, no spinner.
- **Empty**: Cubby `mood="sleep"` + friendly mono copy ("Nothing here yet. Quiet shift.").
- **Error**: coral toast at top of screen, dismissible. Network errors don't block — queued mutations sync when online.
- **Offline (mobile)**: top status pill flips from green `● LIVE` to amber `◐ OFFLINE`; mutations queue in TanStack Query persister.

### Form validation
- **Receive line qty**: integer, 0 ≤ qty ≤ expected. Invalid input shakes (8px, 4 cycles, 80ms each) + coral border.
- **Short reason**: required dropdown — `DAMAGED | MISSING | EXPIRED | OTHER` (OTHER requires free-text).
- **Location override (Putaway)**: must match an existing bay code in the warehouse. Live-validate against a cached location list (TanStack Query cache, refetch on warehouse switch).

---

## State management

**Server state**: tRPC v11 + TanStack Query is already wired in `packages/api`. Don't introduce a new state library.

**Per-screen local state**: `useState` is sufficient. Don't reach for Zustand/Redux/Jotai.

**Session-level state** (selected warehouse, current user, online status, scan history): one root `AppContext` provider. On mobile, also store the manual-entry input value and last-scan timestamp.

### tRPC procedures the developer should expect / build

Per `CLAUDE.md`'s domain glossary (Customer · Supplier · Pallet · Inbound order · Outbound order · Movement ledger):

```ts
// queries
home.summary({ warehouseId })                // hero card + KPI row
ops.kpis({ warehouseId, range })             // Operations page
ops.throughput({ warehouseId, hour })        // hourly bar chart
ops.dockToStock({ warehouseId, range })      // ring chart
ops.topStock({ warehouseId, limit })         // top SKU table
movement.recent({ warehouseId, limit })      // ledger feed
order.outboundList({ warehouseId, status })  // outbound table
order.outbound({ ref })                      // detail page
order.outboundLines({ ref })                 // line table on detail
order.inboundList({ warehouseId, status })
order.inbound({ ref })
order.inboundLines({ ref })
dock.status({ warehouseId })                 // dock-door strip
pallet.byLpn({ lpn })                        // inventory result card
location.byCode({ code, warehouseId })       // alt inventory result
product.list({ warehouseId, vel, search })
warehouse.list()                             // sites grid
cycleCount.list({ warehouseId, status })
task.listForUser({ warehouseId })            // mobile Today queue
pick.next({ orderId })                       // mobile pick step
putaway.suggest({ palletId })                // mobile putaway suggestion + alternatives

// mutations (tenant)
pick.confirm({ orderId, lineId, qty, lot, locationCode })
receive.line({ poId, lineId, qty, lot })
putaway.commit({ palletId, locationCode })
movement.log({ ... })

// mutations (manager — managerProcedure)
order.cancel({ ref, reason })
order.markPacked({ ref })
receive.recordShort({ poId, lineId, reason, note })
putaway.override({ palletId, locationCode, reason })
cycleCount.approve({ countId })
warehouse.add({ ... })
product.create({ ... })
```

Every mutation must invalidate the relevant `home.summary`, `ops.*`, and list-query keys. Use `useUtils()` for invalidation, not a global event bus.

---

## Design tokens

Source of truth: `web-c-shell.jsx::floorTheme()` (web) and the `'dark'` branch of `brand.jsx::themeFor()` (mobile).

### Colors

```
# Foundation (web "floor" + mobile dark)
bg              #0B0907   web canvas
bg              #0F0C0A   mobile canvas
bgAlt           #1A1613   secondary surface
surface         rgba(255,255,255,.04)   cards
surfaceAlt      rgba(255,255,255,.07)
border          rgba(255,255,255,.08)
borderStrong    rgba(255,255,255,.16)

# Text
ink             #FBF5E9   primary
body            #E8DFCF   body
muted           rgba(255,255,255,.55)
mutedSoft       rgba(255,255,255,.32)

# Brand
primary         #FFB23E   marigold — CTAs, active states, accents, glow
primaryText     #1F1308   text on marigold
primaryDeep     #E88F10   hover / borders
primarySoft     rgba(255,178,62,.12)   tint background
primaryGlow     rgba(255,178,62,.35)   for box-shadow / drop-shadow

# Semantic
coral           #FF6B5B   danger, short, urgent
coralSoft       rgba(255,107,91,.14)
mint            #7FD8A8   success, completed, online
mintSoft        rgba(127,216,168,.14)
sky             #7BB4E8   info, inbound, secondary tag
skySoft         rgba(123,180,232,.14)
lilac           #C9B8F0   tertiary (putaway)
```

### Typography

```
display   "Fraunces", Georgia, serif        — used sparingly for editorial italic moments
sans      "Geist", -apple-system, ...        — UI / body / headlines (800 weight for impact)
mono      "JetBrains Mono", ui-monospace ... — codes, qty, locations, deltas, ALL CAPS labels
```

**Type scale** (px):

```
44  Geist 800, letter-spacing -1.6  hero headline (web Home)
36  Geist 800, -1.4                  page title (web)
30  Mono 800, letter-spacing 2.5     LPN in inventory hero (web)
24  Geist 800, -0.6                  card title
22  Geist 800, -0.6                  site name (web Warehouses)
18  Geist 800, -0.4                  inline card title
17  Geist 700                        button label (lg mobile)
16  Geist 700                        section heading
14  Geist 600/700                    body / button label (md)
13  Geist 500/700                    body
12  Geist / Mono 500/700             metadata
11  Mono 700, letter-spacing 0.6     pill text, table headers (UPPERCASE)
10  Mono 800, letter-spacing 0.8     dense labels (UPPERCASE)

# Numbers
64  Mono 800, letter-spacing 2       location / qty hero (mobile)
56  Mono 800                         optional larger variant
40  Mono 800, -1                     KPI value (web)
30  Mono 800, 2.5                    LPN result (web)
22  Mono 800, -0.5                   ring center number / pallet ID
18  Mono 800                         site stat (web)
14  Mono 800                         table on-hand numbers
```

### Spacing scale (px)

```
2  4  6  8  10  12  14  16  18  20  22  24  28
```

- Cards: **18-22** internal padding.
- Table rows: **12-14** vertical, **20-22** horizontal.
- Cards-to-card gap in grids: **14-18**.

### Border radius (px)

```
4   inner progress fill
6   tiny pills / tab inside backgrounds
8   small buttons, dense table cells
10  list rows, pressed states, status cards
12  buttons, search field, pill-tab containers
14  card inner sections
16  KPI tiles, card variants
18  cards (web standard), large buttons
22  hero / scanner viewfinder
26  scan-result hero
```

### Shadows / glow

```
# Card (dark)
0 1px 0 rgba(255,255,255,.03), 0 8px 24px rgba(0,0,0,.4)

# Primary CTA marigold glow
0 8px 22px rgba(255,178,62,.35), inset 0 -2px 0 rgba(0,0,0,.15)

# Big "Go to" mobile card
0 14px 32px rgba(255,178,62,.35)

# Live indicator dot
box-shadow: 0 0 8px <color>

# Active sidebar item rail
box-shadow: 0 0 12px rgba(255,178,62,.4)
```

React Native: convert to `shadowColor / shadowOffset / shadowOpacity / shadowRadius` on iOS, `elevation` on Android. The marigold *glow* won't reproduce natively — accept it on Android (it falls back to a flat marigold fill) and keep it pretty on iOS via shadow + opacity.

### Iconography

24×24 viewBox, stroke 1.8, rounded line caps. See `icons.jsx` for the canonical SVG paths. In React Native, use **`@expo/vector-icons`** (Feather is closest — `home`, `bar-chart-2`, `box`, `package`, `truck`, `clipboard`, `map-pin`, `zap`, `clock`, `check`, `x`, `plus`, `filter`, `download`, `search`, `dollar-sign`, `maximize` for scan). If pixel match matters, paste `icons.jsx` path data into `react-native-svg`.

### Cubby mascot

Defined in `brand.jsx` as an inline SVG component. **4 moods**: `happy | think | wow | sleep`. Sizes used:

- `22–28` — sidebar / status header
- `36–48` — Cubby callout cards (web variance, mobile receive heads-up)
- `52–60` — site cards, ETA cards
- `140+` — decorative bottom-right of hero (low opacity, decorative only)

Port to `react-native-svg` for mobile.

The wordmark is `Cubby + "stacks" (Fraunces italic, weight 600) + marigold period`. An `OPS` chip sits next to the wordmark on the web sidebar to indicate "manager mode" — drop this on mobile.

---

## Copy guidelines

- **Voice**: direct, warm, never cute. Cubby says short complete sentences — "Heads up — 18 units short across 2 lines." Not "Oopsie! Looks like..."
- **Numbers**: always in mono. Always with units (`12 ea`, `32 steps`, `312 kg`, `47 min`).
- **Times**: 24-hour where space allows (`17:00`, `15:30`). Short forms acceptable (`tmw`, `today`, `5:00p`).
- **Codes**: always uppercase, mono, with hyphens (`SO-24881`, `P-9QK4X72L`, `A2-02-B`).
- **Status pills**: `Picking`, `Packed`, `Shipped`, `Short`, `Open`, `Receiving`, `Closed`, `Overdue`, `Approved`, `Reviewing`, `Counting`, `Matched` — single word, sentence case.
- **Mono kickers** above titles: `LIVE`, `THROUGHPUT · AHEAD OF PACE`, `NEEDS YOU · 3`, `BEST 94` — uppercase, letter-spaced.

---

## Files in this bundle

### Live design (open `Mobile Floor Staff.html` in a browser)

| File | What's in it |
|---|---|
| **`Mobile Floor Staff.html`** | Entry point. Loads everything, mounts the design canvas. |
| `design-canvas.jsx` | Pan/zoom canvas viewer (skill-provided). |
| `tweaks-panel.jsx` | Design-time controls (skill-provided). |
| `icons.jsx` | Icon library (SVG paths). |
| `brand.jsx` | **Source of truth** for colors, fonts, Cubby, Wordmark. |
| `kit.jsx` | Legacy primitives (web "warm cream" — for reference only). |
| `mobile-screens.jsx` | Frame, status bar, tab bar, pill primitives for mobile. |
| `screens-c.jsx` | **All 5 mobile screens** (Today, Scan, Pick, Receive, Putaway). |
| `web-c-shell.jsx` | **Web shell** (Sidebar, top bar, page title) + `floorTheme()`, `FCard`, `FBtn`, `FPill`, `KPI`. |
| `web-c-screens-1.jsx` | Web screens: Home, Operations, Outbound list, Outbound detail, Inventory. |
| `web-c-screens-2.jsx` | Web screens: Inbound list, Inbound detail, Products, Warehouses, Cycle counts. |

### Legacy (`design-system/` in repo) — *do not* port these

The repo's existing `design-system/` folder is the prior "warm cream" direction. Treat it as historical reference only. The screens at `apps/web/src/app/**` currently match that direction; replace them with the floor-mode designs in this bundle.

---

## Implementation order (suggested)

### Phase 1 — Tokens & primitives (web + mobile)

1. Translate `floorTheme()` + the dark-mode tokens into `apps/web/src/lib/theme.tsx` (Tailwind theme + CSS variables, or whatever the app uses today). Mirror in `apps/mobile/src/lib/theme.ts`.
2. Port **Cubby** to `react-native-svg` for mobile (the web version already exists in `apps/web/src/components/icons.tsx` per the design-system README).
3. Update / replace `packages/ui` shared web kit: `FBtn`, `FCard`, `FPill`, `KPI` from `web-c-shell.jsx`. Keep API close to existing `Btn`, `Card`, `Tag` so it's a drop-in.
4. Build mobile primitives in `apps/mobile/src/components/`: `Frame`, `Pill`, `Btn`, `Card`, `TabBar`.

### Phase 2 — Web shell + first 3 pages

5. Build `<FShell>` as a layout in `apps/web/src/app/layout.tsx` (or a `(dashboard)` route group's layout). Wire sidebar nav to existing routes.
6. Build the search palette (Cmd+K) with prefix-based routing.
7. Implement **Home, Operations, Inventory** (the highest-impact pages). Wire to existing tRPC queries; build any new procedures listed above.

### Phase 3 — Order pages (web)

8. Implement Outbound list + detail, Inbound list + detail. These exercise the dock-door strip, stepper, variance callout patterns.
9. Implement Products, Warehouses, Cycle counts.

### Phase 4 — Mobile

10. Set up Expo Router with the `(tabs)` layout described above.
11. Implement **Today** first (simplest data, exercises most primitives).
12. Implement **Scan** with `expo-camera` + hardware trigger handler + type-prefix router.
13. Implement **Pick**, **Receive**, **Putaway** — each is one query + one mutation.
14. Wire offline queue (`@tanstack/react-query-persist-client-core`) + status pill.

### Phase 5 — Polish

15. Marigold glow effects (web `box-shadow`, mobile iOS shadow + Android elevation fallback).
16. Live update polling on Home + Operations (30s `refetchInterval`).
17. Skeleton loading states + empty states (Cubby `mood="sleep"`).
18. Cycle count detail screen (designed at a high level; line-by-line UI matches Pick).

---

## Open questions / known gaps

- **Mobile Cycle Count detail** — designed at the queue level only. Recommend recycling the Pick screen pattern (one line at a time, big mono qty, scan to confirm).
- **Wave / batch picking** — currently each pick is per-order. Real floors batch pick across orders. Not designed; backlog item.
- **Settings / Profile (mobile More tab)** — placeholder. Needs warehouse switcher, theme toggle (light fallback?), sign out, app version, sync queue inspector.
- **Onboarding (mobile)** — first launch should explain hardware trigger + ask camera permissions. Not designed.
- **QBO settings page (web)** — exists already at `/settings/integrations` per README. Style with the new tokens but the structure shouldn't change.
- **Reports / billing** — `/reports/billing` exists per `CLAUDE.md`. Re-style with `KPI` tiles + dark dashboard pattern; same structure as Operations.

If anything in this README is ambiguous, ask the designer (or open Mobile Floor Staff.html and zoom in — every measurement is in the inline JSX).
