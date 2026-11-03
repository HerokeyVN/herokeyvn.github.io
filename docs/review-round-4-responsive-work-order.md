# Review round 4: repair responsive narrative-thread continuity

## Status

**Round 3 is not approved as a complete responsive implementation.** Its sparse glyph-to-glyph connector work is accepted at 1440×900 and 390×844, but user review at a real 1920×927 browser viewport exposed broken Hero-thread drawing and a poor Hero-to-About route. Narrow and breakpoint-adjacent widths were also absent from the visual gate.

This round is a focused correction. Do not redesign the portfolio, change professional copy, add Three.js, or rework the accepted `USERS DON'T SEE.` contour choreography unless a responsive regression is demonstrated.

## User-visible failures to reproduce first

### 1. Completed Hero segments appear disconnected at wide and stretched viewports

At 1920×927, normal-motion screenshots show the red Hero thread as several floating pieces inside and below the aperture. The source paths share endpoints, but the drawn strokes do not reach those endpoints.

Root cause:

- desktop Hero SVGs use `viewBox="0 0 1440 900"` with `preserveAspectRatio="none"`;
- at 1920×927 the SVG transform is non-uniform: approximately 1.333× horizontally and 1.03× vertically;
- `hero-thread.ts` uses each path's untransformed `getTotalLength()` as the dash period;
- a zero dash offset therefore does not guarantee a fully painted transformed path;
- completed segments retain a finite dash pattern, leaving an unpainted tail before the next segment.

Observed diagnostic at 1920×927:

- source endpoints still coincide geometrically;
- segment lengths are about 561.2, 55.9, and 719.5 local units;
- at scrollY 120, segments 0 and 1 report zero offset, yet visible gaps remain;
- `prefers-reduced-motion`, which removes dash patterns, displays one continuous curve and confirms that path geometry itself is not the primary gap.

Do not fix this by multiplying every length by `width / 1440`. Non-uniform transforms make the required scale dependent on path direction.

### 2. Hero-to-About entry is technically connected but visually wrong

`site-thread.ts` creates site segment 0 from:

```text
startX = width × 1138 / 1440
startY = heroHeight
→ right viewport edge
→ first About glyph junction
```

At 1920×927 this produces a roughly 1263px visible path with a bounding box about 565px wide and 604px tall. Its opening portion becomes the long near-horizontal stroke seen at the Hero/About boundary. This violates the established rule against long meaningless horizontal or vertical strokes.

The route must read as a deliberate boundary handoff, not as a cable dragged around the viewport edge.

### 3. Responsive modes disagree

Current thresholds conflict:

- Hero markup/CSS/GSAP switches at 600px;
- About CSS and glyph route mode switch at 700px.

Widths from 601px through 700px therefore combine desktop Hero geometry with mobile About and glyph behavior. The submission also lacks visual evidence immediately on both sides of these thresholds.

## Required implementation

### A. Make Hero draw progress transform-safe

Use a progress model whose 0 and 1 states remain exact after any SVG transform. Recommended implementation:

1. Give Hero paths a normalized path length, for example `pathLength="1"`.
2. Express dash progress in normalized units (`1 1`, offset `1 - progress`) rather than using untransformed local length as a dash period.
3. When a segment reaches progress 1, remove its dash pattern (`strokeDasharray: none`, `strokeDashoffset: 0`). This is a completion invariant, not merely a reduced-motion behavior.
4. Keep physical or screen-space length only for distributing timing. If timing must reflect visual distance, sample the path and transform samples through `getScreenCTM()`; do not reuse local length as screen length.

An equivalent implementation is acceptable only if it proves exact transformed completion at every required viewport. Do not replace the hand-authored curves with a generic random or sine-wave generator.

Preserve the intended layer order:

```text
back segment 0 → front crossing segment 1 → back segment 2
```

### B. Replace the exposed Hero-to-About cable with a short handoff

Split the current single visible site entry into semantic phases:

```text
Hero exit
→ short visible boundary continuation
→ hidden weighted travel through protected/empty depth
→ first About glyph contour
```

Requirements:

- the visible boundary continuation begins at the transformed end of the active Hero route within 1 CSS px;
- it crosses the section boundary once and remains in right-side negative space;
- its visible length is at most `min(220px, 18vw)`;
- no nearly horizontal or vertical run may dominate the boundary composition;
- the hidden phase consumes scroll progress and hides both endpoint markers;
- the first glyph contour still begins at its own resolved junction with no visible teleporting marker;
- no route crosses the Hero role copy, `Enter the system`, About kicker/title fill, navigation, or other protected content.

It is acceptable for site segment 0 to end at the short handoff point rather than at the first glyph, provided an explicit hidden segment completes the narrative route. Update the implementation spec and tests consistently; do not fake continuity with a huge invisible SVG path that still owns a visible marker.

### C. Unify responsive mode ownership

- Use one documented threshold for Hero artwork, Hero GSAP selection, About layout, and glyph transition mode. The current design naturally supports 700px because About already changes there; if another threshold is chosen, update all four consumers together.
- At the exact threshold and one pixel on either side, only one Hero SVG set may be displayed and measured.
- Rebuild geometry after crossing the threshold and render immediately from current `scrollY`.
- Do not introduce a horizontal scrollbar or off-canvas headline at intermediate widths.
- Preserve the empty central aperture at every mode.

### D. Preserve accepted Round 3 work

- Keep all 14 semantic glyphs and 17 contours.
- Keep 2–4 sparse, declared, negative-space glyph connectors.
- Keep hidden travel for unplanned glyph adjacencies and inner counters.
- Keep the opaque compact header and protected-content routing.
- Keep reverse scroll, direct anchors, reduced motion, no-JavaScript content, and no-WebGL behavior.

## Required automated tests

Add focused tests that would fail on the current implementation.

### Hero completion invariant

At each viewport below, advance far enough that Hero segments 0 and 1 are complete while segment 2 is active:

- 1920×927
- 1440×900
- 1024×768
- 701×800
- 700×800
- 601×800
- 600×800
- 576×800
- 390×844

Assert:

- completed paths have no finite dash pattern capable of clipping their tail;
- adjacent transformed endpoints differ by at most 1 CSS px;
- exactly one responsive Hero path set is displayed;
- the active set has no zero-size rendered path boxes;
- same `scrollY` after a resize rebuild yields the same normalized progress.

The test must inspect the active responsive set, not hidden desktop and mobile markup together.

### Boundary handoff contract

At 1920×927, 1440×900, 700×800, 576×800, and 390×844 assert:

- Hero end and visible handoff start meet within 1 CSS px;
- the visible handoff's screen-space sampled length respects `min(220px, 18vw)` with a 2px rendering tolerance;
- its bounding box stays inside the intended right-side negative-space corridor;
- a hidden segment exists between the handoff and first glyph and consumes non-zero scroll duration;
- endpoint markers are hidden during that hidden interval;
- protected-content collision tests still return no hits.

### Breakpoint contract

Resize the same page through 701 → 700 → 601 → 600 → 701 at a mid-Hero scroll position. Assert no stale path set, no duplicate visible route, no horizontal overflow, and no console/page errors.

Do not weaken existing geometry tests or broaden tolerances to make this pass.

## Required visual evidence

Use the production build. Record exact `scrollY` and normal/reduced-motion state in the screenshot README.

### Regression captures

| Viewport | Required frames | Purpose |
|---:|---|---|
| 1920×927 | Hero initial, Hero mid-draw, boundary handoff | Reproduce and close the user's real-browser failures |
| 1440×900 | Hero mid-draw, boundary handoff, completed glyph frame | Preserve approved composition |
| 701×800 | Hero mid-draw, boundary handoff | Desktop side of shared breakpoint |
| 700×800 | Hero mid-draw, boundary handoff | Mobile side of shared breakpoint |
| 576×800 | Hero mid-draw, boundary handoff | Narrow-window regression from user evidence |
| 390×844 | Hero mid-draw, boundary handoff, completed glyph frame | Preserve intentional mobile composition |

Also inspect 1024×768, 601×800, 600×800, 430×820, and 320×700 interactively. They need automated coverage but do not each require a committed screenshot unless a defect appears.

Reject the result if any frame contains:

- floating thread fragments that are not occluded by an actual glyph or foreground object;
- a long boundary cable, dominant edge loop, or arbitrary right-angle route;
- a visible endpoint during hidden travel;
- thread overlap with protected content;
- an off-canvas or clipped primary heading;
- mixed desktop/mobile artwork.

## Completion gate

- The three user-reported compositions are no longer reproducible.
- Normal-motion Hero drawing is continuous at all matrix widths.
- Reduced motion remains a stable complete route, not a special case that hides a normal-motion defect.
- Hero-to-About uses a short art-directed handoff plus explicit hidden travel.
- Responsive thresholds are consistent and rebuild safely across resize.
- Existing glyph-thread, accessibility, collision, reverse-scroll, and no-WebGL tests remain green.
- `npm run check`, `npm run build`, and the full Playwright suite pass.
- Handoff and screenshot README contain new evidence and honest remaining risks.
