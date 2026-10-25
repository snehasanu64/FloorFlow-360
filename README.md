# FloorFlow 360

A browser-only room and furniture designer. Enter room dimensions (rectangular, L, T, U or angled), arrange furniture on a scaled 2D plan, and explore the same design in interactive 3D — day or night, from above or walking through it. Projects live in your browser; nothing is uploaded unless you explicitly use the optional Claude photo analysis.

Stack: Next.js (App Router) · TypeScript · React · Tailwind CSS v4 · React Konva (2D) · Three.js + React Three Fiber + drei (3D) · Zustand · Lucide · jsPDF (PDF report) · `@anthropic-ai/sdk` (optional photo analysis).

## Install and run

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run start        # serve the production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest (84 tests)
```

## What it does

**Rooms** — rectangle, L, T, U or angled-corner floor plans (rotatable); per-wall colours and patterns (stripes, dots, brick, panelling, plaster); doors and windows you can drag along (and between) walls; multiple floors with staircases that cut stairwell openings; units in cm / m / in / ft; dark mode.

**Furniture** — 156 household items from A to Z (sofas, beds, wardrobes, kitchen and bathroom fixtures, appliances, ACs and fans, fireplaces, curtains, wall art, treadmills, aquariums, jhula, mandir, stairs, a Xmas tree, a zafu cushion…) across living, bedroom, dining, office, kitchen, bathroom, kids, outdoor, pooja and general, each with realistic default sizes and fully resizable; browse by room or in an A–Z index with a letter jump bar. Small tabletop items (crockery, books, gadgets) are not modelled — import any other object as a GLB. Import your own **.glb** models (stored in this browser, scaled to real size).

**Editing** — drag, rotate, resize, duplicate; multi-select (Shift+click, Shift+drag box, Ctrl+A); group, lock, align and distribute; copy / cut / paste; snap to grid and walls; alignment guides; measure tool (click two points); collision and out-of-room warnings (never destructive); unlimited undo / redo per floor.

**Look** — colour picker and presets, fabric / leather / wood / metal / painted materials, roughness, procedural surface detail (wood grain, weave, leather, brushed metal), or upload your own texture image per piece; time-of-day sun with shadows through the windows; lamps that really light the room at night.

**3D** — orbit, perspective or top-down orthographic camera, wall hide modes, 360° inspection mode with preset views, selected-piece inspection, **first-person walkthrough** (WASD / on-screen pad, collision with walls and furniture).

**Planning tools** (toolbar → Tools)
- **Templates** — nine complete starting rooms (living room, bedroom, studio/1RK, kitchen, pooja room, home office, dining, kids room, bathroom).
- **Auto-arrange** — rule-based layouts for eight room types (clearances around beds and tables, clear door swings, sofa facing the TV…).
- **Vastu check** — direction and placement hints for mandir, cooker, sink, bed, toilet, desk, entrance and more, with a settable north angle. General guidelines for inspiration, not professional advice.
- **Cost estimate** — bill of materials across all floors, editable unit prices, currency / discount / tax, **CSV** (Excel) and **PDF** report (plan, 3D view, rooms, furniture, totals). Default prices are *indicative placeholders*.
- **Photo studio** — take photos with the camera, upload photos, or upload a **360° panorama** (opens in an interactive viewer). On-device analysis reads colour and light, names the closest interior style, and suggests furniture; apply any of 11 style presets (Scandinavian, minimal, modern, industrial, boho, traditional Indian, Japandi, luxe, coastal, rustic, mid-century) to recolour walls, floor and furniture in one undoable step. You can also describe a style in words.
- **Optional Claude vision** — paste your own Anthropic API key to have Claude recognise the room type and existing furniture and suggest pieces from the catalogue. Your photos are then sent to Anthropic with your key, billed to your account; the app stores neither (the key is kept only if you tick "remember"). Uses `claude-opus-5-5` through the official SDK with structured output.

**Save / export** — multiple saved projects (library with thumbnails, rename, duplicate, delete) in localStorage; JSON export / import with validation (older single-room files still load); PNG of the 2D plan and of the 3D view; PDF design report.

## Controls

| Action | How |
| --- | --- |
| Zoom / pan 2D | Wheel or pinch / drag empty space (or middle / right mouse) |
| Move / resize / rotate | Drag; handles on the selected item (rotation snaps to 90°) |
| Select several | Shift+click, Shift+drag box (or the box-select tool), `Ctrl+A` |
| Copy / cut / paste | `Ctrl+C` / `Ctrl+X` / `Ctrl+V` |
| Duplicate / delete | `Ctrl+D` / `Del` |
| Group / ungroup / lock | `Ctrl+G` / `Ctrl+Shift+G` / `L` |
| Rotate 90° | `R` / `Shift+R` |
| Nudge | Arrow keys (grid step, `Shift` ×5) |
| Measure | `M`, click two points; `Esc` to stop |
| Undo / redo / save | `Ctrl+Z` / `Ctrl+Y` / `Ctrl+S` |
| Walk through the room | 3D view → **Walk inside**; WASD / arrows, `Shift` to run, drag to look, `Esc` to exit |

## Architecture

```
src/
  app/                 layout, page, global styles (light + dark theme tokens)
  components/
    layout/            AppShell, status bar, toasts, confirm dialog, modal / drawer, UI atoms
    toolbar/           top toolbar, Tools menu
    sidebar/           Room / Furniture / Materials / Properties tabs
    properties/        properties panel, number field, material controls
    room/              setup screen, room fields, walls, doors & windows, floors
    editor2d/          React Konva floor plan (client-only)
    editor3d/          React Three Fiber scene, levels, camera rig, walkthrough, overlays (client-only)
    furniture/         procedural models, GLB loader, SVG thumbnails
    panels/            projects, templates, auto-arrange, Vastu, estimate, lighting, models, photo studio
  store/               Zustand store + selectors
  data/                catalogue, templates, indicative pricing
  lib/                 geometry, room shapes, placement, auto-layout, vastu, styles, photo analysis,
                       AI client, estimate / report, persistence, library, custom models, textures, …
  types/
tests/                 Vitest: geometry, room shapes, floors, templates, auto-layout, Vastu, styles, photo analysis, AI parsing
```

Key decisions:

- **One state, two renderers.** The store holds the active floor's room and furniture; Konva and Three.js only render it. Other floors are kept as snapshots and shown (read-only) in 3D.
- **Units and coordinates.** The UI converts to the chosen unit; the store, 2D scene (100 px/m) and Three.js use metres. The floor is a clockwise polygon in a bounding box; an item's position is its footprint centre; rotation is clockwise degrees. `lib/geometry.ts` / `lib/roomShape.ts` hold the shared maths (rotated corners, SAT overlap, polygon containment, mitred walls).
- **One footprint definition** drives the 2D shapes, thumbnails and collision rectangles, so 2D and 3D agree (including the L-shaped sofa and desk).
- **History.** Immutable snapshots (capped at 100); drags and resizes are one undo step; undo restarts when you switch floors.
- **Performance.** 3D renders on demand (continuously only while auto-rotating or walking), memoised per item, shared procedural textures, a fixed pool of 6 lamp lights so shaders never recompile, no remote assets.
- **Real models.** Catalogue entries have an optional `glbUrl`; user-imported GLBs are first-class (`lib/custom-models.ts`, `components/furniture/GlbModel.tsx`).

## Known limitations

- Furniture is procedural primitives, not product photography; textures are generated (or your own upload). Ambient occlusion is approximated with soft contact shadows.
- Imported GLBs must be self-contained and not Draco-compressed (the app never fetches a decoder). Model files stay in this browser; exported JSON only records their size and name, so on another computer they appear as placeholder boxes until the .glb is imported there too.
- On-device photo analysis sees colour and light only — it cannot recognise furniture or measure a room. Claude analysis needs your own API key and an internet connection; it was exercised against a mocked endpoint in tests, **not against the live API**.
- Auto-arrange and the Vastu check are rule-based starting points, not a guarantee of a good (or auspicious) layout. Room templates and auto-arrange assume rectangular rooms for best results.
- Overlap checks are footprint-based (no height awareness) except rugs, wall-hung and ceiling items. Doors and windows do not take part in collision checks.
- Projects live in one browser profile's localStorage; use JSON export to move or back them up. Unused images (photos) in the Photo studio are never saved.
- Room outlines come from the rectangle, L, T, U and angled-corner presets; free-form polygons are not editable. Stairs are straight or spiral and sized by hand (height = floor-to-floor).
- Tested in Chromium (Edge) at desktop size; touch gestures, other browsers and the printed PDF layout in other viewers have not been tested. WebGL is required for 3D.
