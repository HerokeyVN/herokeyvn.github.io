# Agent handoff: full outlined-glyph narrative thread

## Architect review status

**Review round 2 work order completed.** The visual defects identified in round 1 rejection (accidental overline across words and sticky-header collisions at submitted `after` positions) are resolved. Automated test suite extended to 26 tests (including explicit outer-junction diversity, 3-consecutive connector spread > 4px, and sticky header corridor occlusion); all 26/26 passed across desktop and mobile. Final evidence set updated with 10 primary screenshots + 2 header crops; diagnostic captures removed from git tracking.

## Mission

Finish and validate the red narrative thread around every outlined character in the About headline `USERS DON'T SEE.`. Preserve the approved Concept 03 composition. Do not add Three.js or redesign other sections.

## Current repository state

Changed implementation files:

- `src/components/About.astro`: splits the outlined heading into semantic per-glyph spans and baseline markers; removed legacy GSAP `[data-reveal]` to eliminate transient offsets on resize.
- `src/components/SiteHeader.astro`: adds scroll handler to toggle `data-compact` when `window.scrollY > 40`.
- `src/styles/global.css`: styles `.site-header[data-compact]` with opaque `background: var(--void)` (`#030305` / `rgb(3, 3, 5)`) and stacking `z-index: 100 > 5`, cleanly occluding scrolled glyph geometry behind brand and navigation controls.
- `src/data/about-glyphs.ts`: stores exact Syne 700 outline data for ten unique characters, expands them to fourteen glyph instances, and defines explicit `GLYPH_JUNCTION_PREFERENCES` with art-directed anchor modes (`top`, `bottom`, `right`).
- `src/pages/index.astro`: renders the decorative glyph SVG, connector group, and moving endpoint.
- `src/scripts/site-thread.ts`: samples glyph junctions according to art-directed preferences, connects adjacent glyphs via organic cubic bezier S-curves through inter-glyph whitespace, orders lines in serpentine order, and synchronizes the full-site thread to scroll.
- `tests/portfolio.spec.ts`: comprehensive Playwright suite with 26 tests covering full glyph geometry, line adaptation, alignment on resize, reverse scroll, explicit junction diversity, connector spread (> 4px), and sticky-header corridor protection.
- `design-explorations/screenshots/glyph-trace/`: updated clean final evidence set with 10 primary captures and 2 header crops. Diagnostic images removed from tracking.

Verified facts from the current implementation:

- Headline glyph count: 14 (`USERS` 5, `DON'T` 5, `SEE.` 4).
- SVG contour count: 17 because `R`, `D`, and `O` each have an inner contour.
- At 1440×900 and 390×844 the headline forms two rendered lines, producing 12 visible same-line connectors; the line break is a hidden transition.
- At Playwright's default desktop viewport (1280×720), the headline fits on one line, producing 13 visible connectors. Tests dynamically derive connector count from actual line count.
- Syne glyph coordinates use 1000 units per em; runtime scale is `computedFontSize / 1000`.
- The glyph overlay is decorative (`aria-hidden="true"`). The real `<h2>` remains selectable and exposes `Built for the parts — Users don't see.` to assistive technology.
- `npm run check` and `npm run build` pass cleanly (0 errors, 0 warnings, 0 hints).
- All 26 Playwright tests passed across both desktop (Chromium) and mobile (iPhone 13 / Chromium) projects.

## Visual direction & Round 2 corrections

- Serpentine line traversal: right-to-left on line 0, left-to-right on line 1.
- Draw the entire outer contour of every character.
- Draw inner counters for `R`, `D`, and `O`; hide the endpoint while transitioning through glyph fill.
- Art-directed negative-space connectors: junctions alternate between `top` (-660 font units), `bottom` (0 to 14 font units), and intermediate points (`'` at -443, `.` at -114), eliminating accidental horizontal overlines.
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
- Diagnostic captures removed from git tracking.
- Full documentation in `design-explorations/screenshots/glyph-trace/README.md`.
