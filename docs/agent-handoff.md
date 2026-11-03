# Agent handoff: full outlined-glyph narrative thread

## Mission

Finish and validate the red narrative thread around every outlined character in the About headline `USERS DON'T SEE.`. Preserve the approved Concept 03 composition. Do not add Three.js or redesign other sections.

The working tree already contains an incomplete implementation. Treat it as a candidate, not as accepted production code. Inspect the diff before changing anything.

## Current repository state

Changed implementation files:

- `src/components/About.astro`: splits the outlined heading into semantic per-glyph spans and baseline markers.
- `src/data/about-glyphs.ts`: stores exact Syne 700 outline data for ten unique characters and expands them to fourteen glyph instances.
- `src/pages/index.astro`: renders the decorative glyph SVG, connector group, and moving endpoint.
- `src/scripts/site-thread.ts`: measures glyphs, orders lines, draws contours/connectors, and synchronizes the full-site thread to scroll.
- `tests/portfolio.spec.ts`: replaces former E-only assertions with full-glyph geometry and scroll tests.
- `design-explorations/screenshots/glyph-trace/`: contains mixed old and diagnostic captures; it is not yet a clean final evidence set.

Verified facts from the current implementation:

- Headline glyph count: 14 (`USERS` 5, `DON'T` 5, `SEE.` 4).
- SVG contour count: 17 because `R`, `D`, and `O` each have an inner contour.
- At 1440×900 and 390×844 the headline forms two rendered lines, so 12 visible same-line connectors are expected; the line break is a hidden transition.
- At Playwright's default desktop viewport (1280×720), the headline may fit on one line, producing 13 visible connectors. Tests must derive connector count from actual line count.
- Syne glyph coordinates use 1000 units per em; runtime scale is `computedFontSize / 1000`.
- The glyph overlay is decorative. The real `<h2>` remains selectable and exposes `Built for the parts — Users don't see.` to assistive technology.
- `npm run check` and `npm run build` passed cleanly (0 errors, 0 warnings, 0 hints).
- All 24 Playwright tests passed across both desktop (Chromium) and mobile (iPhone 13 / Chromium) projects.
- The mobile resize-alignment defect was diagnosed and resolved at the source: `#about-title` previously carried a legacy GSAP `[data-reveal]` tween (`y: 34` over 1.05s). On direct anchor navigation followed by viewport resize, `build()` captured a transient Y translation, leaving the SVG transform offset by ~9.7px from the settled DOM baseline. Removing `data-reveal` and `data-display-heading` from `#about-title` guarantees deterministic, purely scroll-governed static geometry that matches the semantic text exactly at all viewports, transitions, and resizes.

## Current visual direction

- Trace the first rendered line right-to-left, then the next line left-to-right. This serpentine order avoids a long return route.
- Draw the entire outer contour of every character.
- Draw inner counters for `R`, `D`, and `O`; hide the endpoint while it transitions through glyph fill.
- Connect adjacent glyphs only within the same rendered line using restrained short curves near the top contour.
- At a line break, let the thread disappear behind the typographic block and reappear on the next line. Do not draw a diagonal or page-edge loop across the headline.
- Continue from the Hero into the first traced glyph, and from the final glyph into the existing About-to-Experience route.
- The completed static frame must still read as intentional typography; connector strokes must not become an accidental overline spanning the whole phrase.

## Required execution order

1. Read `docs/glyph-thread-implementation-spec.md` and inspect the current diff.
2. Reproduce the mobile resize failure in isolation; record actual and expected transforms per glyph.
3. Fix measurement lifecycle or test synchronization at the source. Do not merely increase timeouts.
4. Run the glyph-specific tests on both Playwright projects.
5. Run the complete test suite.
6. Capture the ten final screenshots described in `docs/visual-qa-playbook.md`.
7. Inspect every screenshot manually; correct collisions, awkward connector lines, clipping, and endpoint jumps.
8. Replace stale diagnostic screenshots or clearly separate them from final evidence.
9. Update this handoff with commands, results, known limitations, and final screenshot paths.

## Likely resize defect to investigate

The SVG transform is generated from `target.getBoundingClientRect()` and a zero-size per-word baseline marker. After viewport resize, layout, smooth anchor scrolling, ScrollTrigger refresh, and the thread rebuild may occur in different frames. A transform can therefore be rebuilt against a transient layout and remain several pixels behind the final DOM position.

Investigate in this order:

1. Disable smooth behavior only inside the test before hash navigation; do not remove native CSS behavior from production without a design reason.
2. Log each glyph key, its transform origin, DOM origin, error, `scrollY`, viewport, font size, and line top after resize.
3. Confirm `document.fonts.ready` has resolved before the first build.
4. Confirm the rebuild runs after final responsive reflow, not only after the first `resize` event.
5. Prefer one stable mechanism: a guarded `ResizeObserver` on the headline or a debounced rebuild after layout settles. Prevent feedback by observing HTML, not the full-page SVG whose own height changes.
6. Call `ScrollTrigger.refresh()` only after geometry is stable, then render the current scroll position again.
7. Keep transform tolerance geometry-based (subpixel scale), not a loose multi-pixel threshold.

## Prohibited shortcuts

- Do not revert to tracing only the final `E`.
- Do not convert the semantic heading into SVG text or paths.
- Do not hide all connectors to make tests pass.
- Do not hardcode a two-line layout or fixed connector count.
- Do not use screenshot success as a substitute for reverse-scroll and resize verification.
- Do not add runtime font-parsing dependencies; committed static paths are sufficient.
- Do not implement Three.js in this phase.

## Verification & Completion Evidence

- Verification commands:
  ```bash
  npm run check
  npm run build
  npx playwright test
  ```
- Automated Test Results: 24/24 tests passed across `desktop` (12/12) and `mobile` (12/12).
- Visual evidence captured per `docs/visual-qa-playbook.md`:
  - `design-explorations/screenshots/glyph-trace/desktop-before.png` (scrollY 650)
  - `design-explorations/screenshots/glyph-trace/desktop-entry.png` (scrollY 850)
  - `design-explorations/screenshots/glyph-trace/desktop-mid.png` (scrollY 1075)
  - `design-explorations/screenshots/glyph-trace/desktop-exit.png` (scrollY 1310)
  - `design-explorations/screenshots/glyph-trace/desktop-after.png` (scrollY 1450)
  - `design-explorations/screenshots/glyph-trace/mobile-before.png` (scrollY 540)
  - `design-explorations/screenshots/glyph-trace/mobile-entry.png` (scrollY 670)
  - `design-explorations/screenshots/glyph-trace/mobile-mid.png` (scrollY 880)
  - `design-explorations/screenshots/glyph-trace/mobile-exit.png` (scrollY 1100)
  - `design-explorations/screenshots/glyph-trace/mobile-after.png` (scrollY 1250)
- Diagnostic captures separated into `design-explorations/screenshots/glyph-trace/diagnostics/`.
- Full documentation in `design-explorations/screenshots/glyph-trace/README.md`.
