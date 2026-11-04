# Full glyph-trace and responsive thread validation

> **Review Round 6 Completed & Verified**: Resolved open-path dash-wrap defect per `docs/review-round-6-open-path-dash-work-order.md`. Replaced repeating dashoffset animation on partial open paths with normalized `strokeDashoffset = "0"` and stretched gap `strokeDasharray = "${progress} 2"` in `hero-thread.ts` (protecting against non-scaling-stroke viewport stretch) and `${visible} ${length}` in `site-thread.ts`. Dense stroke topology sampling (`isPointInStroke()` at 200 points) proves single contiguous prefix starting at 0 with zero detached suffixes across 1920×927, 1440×900, 700×800, and 390×844. Suite passes 42/42 tests. Normal-motion video evidence captured at 1920×927 and 390×844 with 12 extracted frames.

Build: `feat/portfolio-redesign` review round 6 open-path dash topology repair
Date: 2026-11-04

## Round 6 Motion Evidence Matrix

### Video Recordings

Recordings are captured with Playwright browser video under normal motion:

| File | Viewport | Direction & Content | Sequence Timestamps | Result |
|---|---:|---|---|---|
| `round-6-1920x927-hero-open-path.webm` | 1920×927 | Hero seg 2 oscillation, forward through glyph D, reverse to 0 | 00:00–00:03 (slow oscillation across seg 2: scrollY 80 → 180 → 90 → 260 → 440), 00:03–00:05 (forward seam handoff B → hidden C → glyph D), 00:05–00:08 (reverse scroll D → C → B → Hero seg 2 → 0) | PASS |
| `round-6-390x844-hero-open-path.webm` | 390×844 | Mobile Hero seg 2 oscillation, forward through glyph D, reverse to 0 | 00:00–00:03 (mobile oscillation across seg 2: scrollY 70 → 160 → 80 → 210 → 380), 00:03–00:05 (forward mobile handoff B → hidden C → glyph D), 00:05–00:08 (reverse scroll D → C → B → Hero seg 2 → 0) | PASS |

### Phase Extraction Frames (Round 6)

Stored in `design-explorations/screenshots/glyph-trace/round-6/`:

- `round-6-1920-hero-seg2-early.png`: Desktop scrollY 100. Hero segment 2 early activation: aperture loop clean, exactly one prefix growing from start, zero painted suffix near bottom-right.
- `round-6-1920-hero-seg2-mid.png`: Desktop scrollY 260. Hero segment 2 mid activation: smooth contiguous prefix continuing downward.
- `round-6-1920-hero-seg2-late.png`: Desktop scrollY 440. Hero segment 2 approaching section seam cleanly.
- `round-6-1920-handoff-b.png`: Desktop Phase B seam handoff ($L \approx 57\text{px}$) drawing into right negative space.
- `round-6-1920-hidden-c.png`: Desktop Phase C hidden travel: handoff occluded behind compact header, endpoint markers hidden (`autoAlpha: 0`).
- `round-6-1920-glyph-d.png`: Desktop Phase D glyph trace actively outlining `USERS DON'T SEE.`.
- `round-6-390-hero-seg2-early.png`: Mobile scrollY 80. Mobile Hero segment 2 early activation: single growing prefix, zero detached suffix.
- `round-6-390-hero-seg2-mid.png`: Mobile scrollY 210. Mobile mid activation cleanly descending.
- `round-6-390-hero-seg2-late.png`: Mobile scrollY 380. Mobile segment 2 reaching bottom seam.
- `round-6-390-handoff-b.png`: Mobile Phase B handoff ($L \approx 38\text{px}$) attached to mobile exit.
- `round-6-390-hidden-c.png`: Mobile Phase C hidden travel under compact header.
- `round-6-390-glyph-d.png`: Mobile Phase D glyph trace starting at first letter contour.

## Round 6 Open-Path Topology Fixes Verified

1. **Elimination of Dash-Wrap Suffix on Stretched Viewports**:
   - Replaced repeating dashoffset animation (`strokeDasharray: "1 1"`, `strokeDashoffset: 1 - progress`) in `src/scripts/hero-thread.ts` with zero offset and stretched gap: `strokeDashoffset = "0"` and `strokeDasharray = "${segProgress} 2"`.
   - Identified and resolved non-uniform viewBox stretch pitfall: with `viewBox="0 0 1440 900"`, `preserveAspectRatio="none"`, and `vector-effect: non-scaling-stroke`, the physical screen length at 1920×927 is $1.333\times$ the author user units. A gap of `1.0` in normalized coordinates left the final $150\text{px}$ exposed to a repeating dash at normalized position 0.83. Setting the gap to `2` guarantees the unpainted gap exceeds any stretched stroke length across all viewports up to 2560px+.
   - Unstarted segments (`segProgress <= 0`) set `strokeDasharray = "0 2"`, `strokeDashoffset = "0"`, and `visibility = "hidden"`.
   - Completed segments (`segProgress >= 1`) strip dash styling (`strokeDasharray = "none"`, `strokeDashoffset = "0"`).

2. **Zero-Offset Contiguous Topology on Site-Thread and Connectors**:
   - Audited all open-path renderers in `src/scripts/site-thread.ts` (`siteSegments` and `glyphConnectors`).
   - Enforced zero dashoffset with local SVG path lengths: partial state uses `strokeDashoffset = "0"` and `strokeDasharray = "${visible} ${segment.drawLength}"`.
   - Unstarted state sets `visibility: "hidden"` and `strokeDasharray = "0 ${segment.drawLength}"`.
   - Completed state sets `visibility: "visible"` and `strokeDasharray = "none"`.
   - Closed glyph contours retain their intentional junction-wrap behavior (`kind === "closed"` with `strokeDashoffset = -segment.startDistance`).

3. **Dense Rendered-Topology Verification (42/42 Passing Tests)**:
   - Added `hero segment 2 eliminates dash-wrap suffix and paints single contiguous prefix across early activation` to `tests/portfolio.spec.ts`.
   - Added `verifies contiguous open-path topology across hero, handoff, glyph connectors, and responsive viewports`.
   - Samples 200 evenly spaced points with `SVGGeometryElement.isPointInStroke()` and `getPointAtLength()` along active partial paths across 1920×927, 1440×900, 700×800, and 390×844.
   - Asserts painted indices form exactly 1 contiguous group starting at index 0, with zero samples painted in the far-end interval (`83..100` completely eliminated), and confirms reverse scroll produces identical topology.
   - Expanded total automated suite from 38 to 42 tests (21 desktop, 21 mobile).

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
   - Test suite count increased from 26 to 42 tests; 42/42 tests pass across desktop (Chromium) and mobile (iPhone 13 / Chromium).

## Automated Checks
- `npm run check`: pass (24 files, 0 errors, 0 warnings, 0 hints)
- `npm run build`: pass (static build in `dist/` verified)
- `npx playwright test`: 42/42 passed across `desktop` (21/21) and `mobile` (21/21)

## Boundaries & Architecture Integrity
- Center Hero aperture remains empty for future Three.js model; no Three.js or WebGL added.
- Semantic `<h2>` remains accessible and selectable; SVG contours are decorative (`aria-hidden="true"`).
- Non-JS environments render the static semantic HTML headline cleanly without SVG overlay or script execution.
- Reduced motion behavior strips dash patterns and displays complete, unbroken thread geometry.
