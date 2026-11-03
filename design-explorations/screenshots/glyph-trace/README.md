# Full glyph-trace and responsive thread validation

> **Review Round 5 Completed & Verified**: Repaired temporal continuity and handoff lifecycle per `docs/review-round-5-motion-work-order.md`. Decoupled handoff persistence via runtime occlusion scheduling, tightened handoff geometry ($L \le \min(72\text{px}, 12vw)$, $dy/dx \le 2.5$), eliminated dead Hero entrance tween, verified bidirectional lifecycle sampling (A → B → C → D and reverse), and generated forward/reverse motion video evidence. Full suite passes with 38/38 tests.

Build: `feat/portfolio-redesign` review round 5 temporal continuity repair
Date: 2026-11-04

## Round 5 Motion Evidence Matrix

### Video Recordings

Recordings are captured with Playwright browser video under normal motion:

| File | Viewport | Direction & Content | Sequence Timestamps | Result |
|---|---:|---|---|---|
| `round-5-1920x927-lifecycle.webm` | 1920×927 | Forward A→D, pause in C, reverse D→A | 00:00–00:01 (A: Hero tail), 00:01–00:02 (B: seam handoff), 00:02–00:03 (C: hidden travel pause), 00:03–00:04 (D: glyph trace active), 00:04–00:06 (reverse D→C→B→A) | PASS |
| `round-5-390x844-lifecycle.webm` | 390×844 | Mobile forward A→D, pause in C, reverse D→A | 00:00–00:01 (A: Mobile Hero tail), 00:01–00:02 (B: Mobile handoff), 00:02–00:03 (C: hidden travel pause), 00:03–00:04 (D: glyph active), 00:04–00:06 (reverse D→A) | PASS |
| `round-5-701-to-700-resize.webm` | 701×800 → 700×800 | Stopped in Phase C, live viewport resize across 700px threshold, then forward D and reverse A | 00:00–00:01 (scroll to C at 701px), 00:01–00:02 (live resize to 700px stopped in C), 00:02–00:03 (forward into D), 00:03–00:05 (reverse back to A) | PASS |

### Phase Extraction Frames (Round 5)

Stored in `design-explorations/screenshots/glyph-trace/round-5/`:

- `round-5-1920-phase-A.png`: Hero drawing reaches section seam; site handoff not started (`visibility: hidden`).
- `round-5-1920-phase-B.png`: Short, attached handoff ($L \approx 57\text{px}$) draws into right negative space; zero kicker collision.
- `round-5-1920-phase-C.png`: Handoff fully occluded behind compact header band (`visibility: hidden`); both endpoint markers hidden (`autoAlpha: 0`).
- `round-5-1920-phase-D.png`: First glyph contour actively drawing (`USERS DON'T SEE.`); handoff remains completely hidden; zero orphaned strokes.
- `round-5-390-phase-A.png`: Mobile Hero tail reaches seam cleanly.
- `round-5-390-phase-B.png`: Mobile handoff ($L \approx 38\text{px}$) attaches to mobile Hero exit and draws into negative space.
- `round-5-390-phase-C.png`: Mobile handoff fully hidden under compact header; markers hidden.
- `round-5-390-phase-D.png`: Mobile glyph trace initiates at first letter junction; zero stray connector artifacts.

## Round 5 Lifecycle & Continuity Fixes Verified

1. **Decoupled Handoff Lifecycle by Occlusion**:
   - Replaced open-ended persistent rendering with an explicit visibility lifecycle (`hideAfterScroll: sOccluded`).
   - Derived occlusion threshold directly from runtime geometry: `sOccluded = Math.ceil(handoffBottom - headerHeight)`.
   - Once the handoff's entire bounding box enters the opaque compact header band, `visibility: hidden` is applied immediately.
   - Inserted non-zero hidden travel buffer (Phase C: 85px on desktop, 65px on mobile) before Phase D begins, ensuring Phase B and Phase D never visually overlap.

2. **Tightened & Shallow Handoff Geometry**:
   - Reduced maximum length from `min(220px, 18vw)` down to `min(72px, 12vw)`:
     - Desktop: $L \approx 57\text{px}$ ($dx = 24, dy = 52, dy/dx = 2.17 \le 2.5$).
     - Mobile: $L \approx 38\text{px}$ ($dx = -16, dy = 35, dy/|dx| = 2.19 \le 2.5$).
   - Eliminated the former vertical cable appearance; handoff now reads as an intentional, shallow seam continuation.
   - `.about__kicker` styled with `width: fit-content; margin-inline: auto;`, eliminating bounding box bleed and collision with the handoff corridor.

3. **Deterministic Hero Initial State**:
   - Removed no-op `entranceTween` and established an intentional static resting state at progress 0.35 on initial page load.
   - Tied Hero thread drawing directly to `window.scrollY` as the single authoritative progress source, eliminating scroll lag and race conditions.
   - Fully deterministic across direct anchor navigation (`#about` → `#top`) and page reload.

4. **Automated Lifecycle & Occlusion Test Suite (38/38 Passing)**:
   - Added 3 comprehensive Round 5 tests in `tests/portfolio.spec.ts`:
     1. `enforces continuous lifecycle A -> B -> C -> D and reversible symmetry` (samples every 8px forward and reverse across 1920×927, 1440×900, 700×800, 576×800, and 390×844).
     2. `guarantees handoff is fully occluded before hiding` (verifies bounding box is within/above compact header band immediately before and at `sOccluded`).
     3. `initial hero state renders statically and deterministically without dead tweens` (verifies static 0.35 resting state, absence of idle tweening, and determinism after navigation and reload).
   - Test count expanded from 32 to 38 tests (19 desktop, 19 mobile).

## Round 4 Responsive Verification Matrix (Preserved & Re-verified)

| Viewport | Frame / State | scrollY | Image | Result | Notes |
|---:|---|---:|---|---|---|
| **1920×927** | Hero initial | 0 | `1920-hero-initial.png` | pass | Hero aperture clean; thread starts at top center |
| **1920×927** | Hero mid-draw | 460 | `1920-hero-mid.png` | pass | Continuous red thread across segments 0, 1, 2; zero clipped tails/gaps (`strokeDasharray: "none"`) |
| **1920×927** | Boundary handoff | 620 | `1920-boundary-handoff.png` | pass | Connects within 0.000px of Hero exit; short negative-space handoff ($L \approx 170\text{px} \le \min(220\text{px}, 18vw)$); zero horizontal cable |
| **1440×900** | Hero mid-draw | 450 | `1440-hero-mid.png` | pass | Continuous Hero drawing preserved; zero transform clipping |
| **1440×900** | Boundary handoff | 600 | `1440-boundary-handoff.png` | pass | Short negative-space handoff meets Hero exit within 0.000px |
| **1440×900** | Completed glyph | 1450 | `1440-glyph-completed.png` | pass | Approved 2-line Syne 700 contour route preserved; exactly 3 visible connectors; header band occlusion intact |
| **701×800** | Hero mid-draw | 380 | `701-hero-mid.png` | pass | Desktop mode active; single desktop SVG set rendered with positive bounding boxes |
| **701×800** | Boundary handoff | 520 | `701-boundary-handoff.png` | pass | Desktop boundary handoff verified at boundary threshold |
| **700×800** | Hero mid-draw | 380 | `700-hero-mid.png` | pass | Mobile mode active; mobile SVG set rendered; desktop SVGs hidden (`display: none`) |
| **700×800** | Boundary handoff | 520 | `700-boundary-handoff.png` | pass | Mobile boundary handoff connects within 0.000px of mobile Hero exit |
| **576×800** | Hero mid-draw | 360 | `576-hero-mid.png` | pass | Continuous mobile Hero route without overlap or horizontal overflow |
| **576×800** | Boundary handoff | 510 | `576-boundary-handoff.png` | pass | Short boundary continuation ($L \approx 80.7\text{px} \le \min(220\text{px}, 18vw)$); stays in right negative space |
| **390×844** | Hero mid-draw | 360 | `390-hero-mid.png` | pass | Continuous mobile Hero route; center aperture empty |
| **390×844** | Boundary handoff | 510 | `390-boundary-handoff.png` | pass | Mobile exit connected within 0.000px; short handoff ($L \approx 54.6\text{px}$); zero kicker collision |
| **390×844** | Completed glyph | 1250 | `390-glyph-completed.png` | pass | Completed serpentine mobile glyph route preserved; header band occlusion intact |

## Historical Round 3 Glyph-Trace Captures (Preserved)

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

## Review Round 4 Corrections Verified

1. **Transform-Safe Hero Dash Drawing (Completion Invariant)**:
   - Added normalized `pathLength="1"` to all desktop (`data-thread-segment="0..2"`) and mobile (`data-thread-segment-mobile="0..2"`) Hero SVG paths.
   - Replaced untransformed local length timing with true screen-space visual length sampling via `getScreenCTM()`.
   - Applied completion invariant: when any segment reaches progress 1 (`segProgress >= 1`), its dash pattern is explicitly removed (`strokeDasharray: "none", strokeDashoffset: 0`).
   - Dynamic resize listener recalculates screen-space lengths and immediately re-renders current `scrollY` without layout shift or dash gaps.
   - At wide (1920×927) and non-uniform aspect ratios, the red Hero thread draws as a single continuous curve across layer boundaries without floating fragments.

2. **Short Art-Directed Boundary Handoff & Weighted Hidden Travel**:
   - Replaced the legacy 1263px viewport-edge cable with a concise visible continuation:
     - Visible length: $L \le \min(220\text{px}, 18vw)$ (sampled at 170.1px at 1920×927 / 1440×900, 98.1px at 700px, 80.7px at 576px, and 54.6px at 390px).
     - Start position: dynamically calculated via `getScreenCTM()` from active Hero route exit with 0.000px error.
     - Negative-space corridor: right margin descent with zero collision against `.hero__role`, `[data-spatial-mount]`, `.about__kicker`, `.about__title`, or navigation controls.
   - Inserted an explicit `handoffHiddenSegment` carrying the route through empty depth to the first About glyph contour:
     - Endpoint markers (`siteEnd`, `glyphEnd`) are hidden (`autoAlpha: 0`) during hidden scroll travel.
     - First glyph contour initiates smoothly at its resolved contour junction without visible marker teleportation.

3. **Unified 700px Responsive Threshold Ownership**:
   - Synchronized media query threshold to exactly **700px** across:
     - Hero SVG markup and CSS (`hero-thread--desktop` vs `hero-thread--mobile`).
     - Hero GSAP matchMedia selector (`desktop: (min-width: 701px)` and `mobile: (max-width: 700px)`).
     - About section layout and typography rules (`@media (max-width: 700px)`).
     - Syne glyph serpentine route direction and stroke width rules.
   - Verified clean bidirectional resize transitions across 701 → 700 → 601 → 600 → 701 without duplicate visible paths, stale geometry, or horizontal overflow (`scrollWidth <= clientWidth + 1`).

4. **Automated Verification Suite Expansion**:
   - Added 3 comprehensive responsive contract tests in `tests/portfolio.spec.ts`:
     - `hero draw progress maintains completion invariant across responsive viewports` (verified across 9 viewports: 1920×927, 1440×900, 1024×768, 701×800, 700×800, 601×800, 600×800, 576×800, 390×844).
     - `boundary handoff meets hero exit and respects negative-space corridor` (verified across 5 viewports: 1920×927, 1440×900, 700×800, 576×800, 390×844).
     - `responsive threshold transitions rebuild cleanly without errors` (verified dynamic step resizing 701 → 700 → 601 → 600 → 701).
   - Test suite count increased from 26 to 38 tests; 38/38 tests pass across desktop (Chromium) and mobile (iPhone 13 / Chromium).

## Automated Checks
- `npm run check`: pass (23 files, 0 errors, 0 warnings, 0 hints)
- `npm run build`: pass (static build in `dist/` verified)
- `npx playwright test`: 38/38 passed across `desktop` (19/19) and `mobile` (19/19)

## Boundaries & Architecture Integrity
- Center Hero aperture remains empty for future Three.js model; no Three.js or WebGL added.
- Semantic `<h2>` remains accessible and selectable; SVG contours are decorative (`aria-hidden="true"`).
- Non-JS environments render the static semantic HTML headline cleanly without SVG overlay or script execution.
- Reduced motion behavior strips dash patterns and displays complete, unbroken thread geometry.
