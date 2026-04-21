# Design system reference

These files are the original design canvas for the "stacks" brand direction
— a standalone HTML preview (`PalletStorage Redesign.html`) that loads each
`.jsx` via `<script>` tags and composes them into a live gallery.

**They are not imported by the app.** Integrated production versions live at:

| Canvas file | Production port |
| --- | --- |
| `brand.jsx` | `apps/web/src/lib/theme.tsx` |
| `icons.jsx` | `apps/web/src/components/icons.tsx` |
| `kit.jsx` | `apps/web/src/components/kit.tsx` |
| `shell.jsx` | `apps/web/src/components/shell.tsx` |
| `screens/*.jsx` | `apps/web/src/app/**` (per-page) |

Treat this folder as the source of truth for visual decisions (palette,
spacing, copy, mascot moods). If you change the app's look, update the
matching canvas file here too so future designers have a working preview.
