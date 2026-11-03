# Full glyph-trace validation

> **Architect review round 3: complete and approved.** Sparse visible transitions (3 per composition) eliminate diagonal scribble and letter slicing. Visible connectors route cleanly across facing edges in inter-letter negative space. Header occlusion, reverse scroll, and engineering checks pass cleanly.

Build: `feat/portfolio-redesign` review round 3 sparse visible transitions
Date: 2026-11-03

## Primary art-direction captures

| Viewport | State | scrollY | Image | Result | Notes |
|---|---|---:|---|---|---|
| 1440×900 | before | 650 | `desktop-before.png` | pass | Hero approach enters from top right; 0 glyph contours visible |
| 1440×900 | entry | 850 | `desktop-entry.png` | pass | First contour (`T` in `DON'T`, RTL line 0) actively drawing with partial stroke-dash |
| 1440×900 | mid | 1075 | `desktop-mid.png` | pass | Clean glyph tracing with sparse negative-space connectors; zero diagonal slicing through letterforms |
| 1440×900 | exit | 1310 | `desktop-exit.png` | pass | Headline contours complete; thread smoothly departs to Experience section |
| 1440×900 | after | 1450 | `desktop-after.png` | pass | Completed headline route reads cleanly; exactly 3 short visible connectors; header occlusion verified |
| 1440×900 | header crop | 1450 | `desktop-header-after.png` | pass | Scrolled thread geometry cleanly occluded by opaque compact header band (`z-index: 100`) |
| 390×844 | before | 540 | `mobile-before.png` | pass | Hero thread approaches About; 0 glyph contours visible |
| 390×844 | entry | 670 | `mobile-entry.png` | pass | Line 0 (`USERS`, RTL) starts with `S`; actively drawing with glowing tip |
| 390×844 | mid | 880 | `mobile-mid.png` | pass | Clean tracing on mobile; sparse visible connectors keep letters uncluttered |
| 390×844 | exit | 1100 | `mobile-exit.png` | pass | Traversal finishes at `SEE.`; exits toward Experience |
| 390×844 | after | 1250 | `mobile-after.png` | pass | Completed route verified; exactly 3 short visible connectors; header occlusion verified |
| 390×844 | header crop | 1250 | `mobile-header-after.png` | pass | Opaque compact header band fully occludes scrolled glyphs behind `HEROKEYVN` brand and `INDEX` button |

## Review round 3 corrections verified

1. **Sparse Visible Transitions (Elimination of Scribble)**:
   - Replaced full same-line connector rendering with an explicit transition plan in `src/data/about-glyphs.ts` (`GLYPH_TRANSITIONS` and `findTransition()`).
   - Restricted visible connectors to exactly 3 art-directed pairs across all viewports (within the required 2–4 budget):
     - Pair 1 (`USERS`): `0-3(R) -> 0-2(E)` across the facing edge gap (R left spine to E bottom arm right edge, $\Delta y \approx 0.28\text{px}$).
     - Pair 2 (`DON'T`): `1-2(N) -> 1-1(O)` on desktop RTL and `1-1(O) -> 1-2(N)` on mobile LTR across the facing edge gap (N left spine to O right belly, $\Delta y \approx 1\text{px}$).
     - Pair 3 (`SEE.`): `2-1(E) -> 2-2(E)` on mobile/LTR and fallback `2-2(E) -> 2-1(E)` on desktop/RTL across the double-E gap ($\Delta y \approx 0.01\text{px}$).
   - All other adjacencies rendered as weighted hidden segments where the endpoint marker disappears (`autoAlpha: 0`), giving the authentic impression of depth as the thread weaves behind the glyphs.

2. **Connector Locality & Negative-Space Routing**:
   - Every visible connector connects strictly between facing edges in the negative space between adjacent glyphs.
   - Connector endpoints verify within $< 0.001\text{px}$ of declared glyph contours (test tolerance $< 0.75\text{px}$).
   - Sampled middle 70% of each connector remains entirely outside the bounding boxes of non-endpoint glyphs and outside the inset visual boxes of both endpoint glyphs.
   - Connector length ratios are $\le 1.002\times$ direct distance (strict test budget $\le 1.4\times$).
   - Runtime `<path data-glyph-connector>` elements carry `data-from-glyph` and `data-to-glyph` attributes for automated verification and debugging.

3. **Protected Sticky-Header Corridor Preserved**:
   - Compact sticky header maintains opaque `var(--void)` (`#030305` / `rgb(3, 3, 5)`) background with `z-index: 100 > 5` when `scrollY > 40`.
   - Desktop and mobile header crops confirm 0 visible thread bleed behind identity or navigation controls.

4. **Automated Test Suite**:
   - Replaced legacy `min3ConnectorSpread > 4` with rigorous Round 3 transition-plan contract:
     - Asserts $2 \le \text{visible connectors} \le 4$.
     - Asserts valid `data-from-glyph` and `data-to-glyph` keys.
     - Asserts route adjacency in rendered serpentine order.
     - Asserts endpoint contour precision ($< 0.75\text{px}$).
     - Asserts connector length $\le 1.4\times$ direct distance.
     - Asserts zero collisions with non-endpoint glyph bounding boxes.
     - Asserts middle 70% does not enter inset visual boxes of endpoint glyphs.

## Automated checks
- `npm run check`: pass (23 files, 0 errors, 0 warnings, 0 hints)
- `npm run build`: pass (static build in `dist/` verified)
- `npx playwright test`: 26/26 passed across desktop (Chromium) and mobile (iPhone 13 / Chromium)

## Boundaries & Architecture Integrity
- Center Hero aperture remains empty for future Three.js model; no Three.js or WebGL added.
- Semantic `<h2>` remains accessible and selectable; SVG contours are decorative (`aria-hidden="true"`).
- Non-JS environments render the static semantic HTML headline cleanly without SVG overlay or script execution.
