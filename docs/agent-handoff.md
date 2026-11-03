# Agent handoff: full outlined-glyph narrative thread

## Architect review status

**Round 3 approved.** Sparse visible transitions (exactly 3 per composition) eliminate diagonal scribble and letter slicing. Visible connectors route cleanly across facing edges in inter-letter negative space. Header occlusion, reverse scroll, and engineering checks pass cleanly.

## Mission

Finish and validate the red narrative thread around every outlined character in the About headline `USERS DON'T SEE.`. Preserve the approved Concept 03 composition. Do not add Three.js or redesign other sections.

## Current repository state

Changed implementation files:

- `src/components/About.astro`: splits the outlined heading into semantic per-glyph spans and baseline markers; removed legacy GSAP `[data-reveal]` to eliminate transient offsets on resize.
- `src/components/SiteHeader.astro`: adds scroll handler to toggle `data-compact` when `window.scrollY > 40`.
- `src/styles/global.css`: styles `.site-header[data-compact]` with opaque `background: var(--void)` (`#030305` / `rgb(3, 3, 5)`) and stacking `z-index: 100 > 5`, cleanly occluding scrolled glyph geometry behind brand and navigation controls.
- `src/data/about-glyphs.ts`: stores exact Syne 700 outline data for ten unique characters, expands them to fourteen glyph instances, and defines `GLYPH_TRANSITIONS` with explicit `AnchorPreference` configurations for sparse visible pairs.
- `src/pages/index.astro`: renders the decorative glyph SVG, connector group, and moving endpoint.
- `src/scripts/site-thread.ts`: samples glyph junctions, resolves planned visible pairs against rendered serpentine glyph lines, generates short negative-space connectors, creates weighted hidden segments with hidden markers for all other adjacencies, and synchronizes the full-site thread to scroll.
- `tests/portfolio.spec.ts`: comprehensive Playwright suite with 26 tests covering full glyph geometry, line adaptation, alignment on resize, reverse scroll, sparse visible transition contract (2–4 visible connectors), connector negative-space locality, bounding box insets, and sticky-header corridor protection.
- `design-explorations/screenshots/glyph-trace/`: verified Round 3 evidence set with 10 primary captures and 2 header crops demonstrating clean letterform readability and protected header corridors.

Verified facts from the current implementation:

- Headline glyph count: 14 (`USERS` 5, `DON'T` 5, `SEE.` 4).
- SVG contour count: 17 because `R`, `D`, and `O` each have an inner contour.
- At 1440×900 and 390×844 the headline forms two rendered lines; at 1280×720 it forms one line.
- Exactly 3 visible connectors are rendered in each composition (budget: 2–4).
- All unplanned adjacencies are weighted hidden segments; moving marker is hidden (`autoAlpha: 0`) during hidden travel to create depth behind letterforms.
- Syne glyph coordinates use 1000 units per em; runtime scale is `computedFontSize / 1000`.
- The glyph overlay is decorative (`aria-hidden="true"`). The real `<h2>` remains selectable and exposes `Built for the parts — Users don't see.` to assistive technology.
- `npm run check` and `npm run build` pass cleanly (0 errors, 0 warnings, 0 hints).
- All 26 Playwright tests passed across both desktop (Chromium) and mobile (iPhone 13 / Chromium) projects.

## Round 3 implementation details

- Serpentine line traversal: right-to-left on line 0, left-to-right on line 1.
- Draw the entire outer contour of every character.
- Draw inner counters for `R`, `D`, and `O`; hide the endpoint while transitioning through glyph fill.
- Sparse visible transitions:
  - Pair 1 (`USERS`): `0-3(R) -> 0-2(E)` across the facing edge gap (R left spine to E bottom arm right edge, $\Delta y \approx 0.28\text{px}$).
  - Pair 2 (`DON'T`): `1-2(N) -> 1-1(O)` on desktop RTL and `1-1(O) -> 1-2(N)` on mobile LTR across the facing edge gap (N left spine to O right belly, $\Delta y \approx 1\text{px}$).
  - Pair 3 (`SEE.`): `2-1(E) -> 2-2(E)` on mobile/LTR and fallback `2-2(E) -> 2-1(E)` on desktop/RTL across the double-E gap ($\Delta y \approx 0.01\text{px}$).
- All visible connectors stay entirely in inter-letter negative space with length ratios $\le 1.002\times$ direct distance.
- Zero diagonal chords cutting across letter interiors.
- Protected sticky header: when `scrollY > 40`, the fixed header becomes compact with an opaque `#030305` background (`z-index: 100`), ensuring glyphs that scroll up to the top of the viewport never show through behind `HEROKEYVN` or navigation controls.

## Automated verification evidence

- Verification commands:
  ```bash
  npm run check
  npm run build
  npx playwright test
  ```
- Automated Test Results: 26/26 passed across `desktop` (13/13) and `mobile` (13/13).
- Visual evidence captured:
  - `design-explorations/screenshots/glyph-trace/desktop-before.png` (scrollY 650)
  - `design-explorations/screenshots/glyph-trace/desktop-entry.png` (scrollY 850)
  - `design-explorations/screenshots/glyph-trace/desktop-mid.png` (scrollY 1075)
  - `design-explorations/screenshots/glyph-trace/desktop-exit.png` (scrollY 1310)
  - `design-explorations/screenshots/glyph-trace/desktop-after.png` (scrollY 1450)
  - `design-explorations/screenshots/glyph-trace/desktop-header-after.png` (scrollY 1450, header band crop)
  - `design-explorations/screenshots/glyph-trace/mobile-before.png` (scrollY 540)
  - `design-explorations/screenshots/glyph-trace/mobile-entry.png` (scrollY 670)
  - `design-explorations/screenshots/glyph-trace/mobile-mid.png` (scrollY 880)
  - `design-explorations/screenshots/glyph-trace/mobile-exit.png` (scrollY 1100)
  - `design-explorations/screenshots/glyph-trace/mobile-after.png` (scrollY 1250)
  - `design-explorations/screenshots/glyph-trace/mobile-header-after.png` (scrollY 1250, header band crop)
- Full documentation in `design-explorations/screenshots/glyph-trace/README.md`.
