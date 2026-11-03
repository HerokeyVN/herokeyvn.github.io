# Review round 5: repair temporal continuity and handoff lifecycle

## Status

**Round 4 is rejected for motion completion.** Its transform-safe Hero dash fix, unified 700px responsive threshold, sparse glyph connectors, and static geometry checks remain accepted. Its Hero-to-About handoff is not visually approved.

The Round 4 evidence set proved isolated coordinates and static frames. It did not prove that the visible thread remains coherent while the viewport moves. The user's screen recording exposes a perceptual reset that all 32 automated tests missed.

Do not redesign unrelated sections, change professional copy, add Three.js, or regress the accepted glyph-outline work.

## Evidence reviewed

Source recording:

```text
/home/key/Videos/Screencasts/Screencast From 2026-11-04 00-16-05.mp4
```

- duration: 17.43 seconds;
- recording size: 1920×1080;
- browser content viewport: approximately 1920×927;
- interaction: continuous forward movement from Hero through About toward Experience;
- normal motion is enabled.

Frame review shows three visually separate events:

```text
Hero curve
→ isolated upper-right About stroke
→ glyph-outline tracing
```

The middle stroke does not transfer attention between the two scenes. It enters near the top/right, terminates in empty space, remains after its marker disappears, and is still partly exposed when glyph tracing begins.

## Confirmed runtime cause

At 1920×927, browser instrumentation against the Round 4 implementation produced:

| scrollY | About top | Site handoff | Site marker | Glyph activity |
|---:|---:|---|---:|---|
| 510 | 417 | hidden / not started | 0 | none |
| 520 | 407 | partial, visible | 1 | none |
| 660 | 267 | nearly complete, visible | 1 | none |
| 680 | 247 | complete, still visible | 0 | none |
| 850 | 77 | complete, still visible | 0 | none |
| 900 | 27 | complete, visible from viewport y≈27–194 | 0 | first glyph active |

At scrollY≈900 the opaque compact header hides only the top of the 170px handoff. Roughly 130px remains exposed below it while the glyph route has already started. This is the orphaned stroke in the video.

The underlying code behavior is explicit:

- `handoffHiddenSegment` hides endpoint markers but has no element of its own;
- `render()` leaves every completed open path visible forever with zero dash offset;
- `siteSegments[0]` therefore persists throughout hidden travel and into glyph activity;
- `sHandoffEnd` is an arbitrary 45% of the interval from `s0` to `s1`, unrelated to viewport occlusion;
- the Round 4 test checks length, start-point coincidence, and negative-space bounds at one state, but never samples presentation lifecycle across the interval.

There is also a separate Hero entrance defect: `effectiveProgress` is clamped to at least `0.35 + scrollProgress * 0.65`, so at scrollY 0 it is already 0.35. The `entranceTween` from 0 to 0.35 cannot visibly change the initial render. Either make this entrance animation real or remove the dead tween and define an intentional static initial state.

## Art direction

The handoff must be a seam event, not a small version of the former viewport-edge cable.

Required sequence:

```text
A. Hero tail reaches the Hero/About seam
→ B. one short attached seam continuation draws
→ C. that continuation becomes fully occluded, then hidden travel owns the route
→ D. one endpoint reappears on the first actively drawing glyph contour
```

Rules:

- States B and D must never overlap visually.
- A completed B path must not remain exposed during C.
- B must not disappear while floating in open space. It may be removed only after it is fully behind the opaque header, outside the viewport, or behind a deliberate existing occluder.
- C must hide both endpoint markers and every inter-scene path element.
- D must begin on the first contour junction; no marker may travel across the empty About field.
- Reverse scroll must replay D → C → B → A with identical geometry and visibility at the same scroll position.

## Required implementation

### 1. Give visible segments an explicit lifecycle

Extend the segment model or equivalent rendering state so completion and persistence are separate concepts. A segment needs enough information to express:

```ts
type VisibilityLifecycle = {
  persistAfterComplete: boolean;
  hideAfterScroll?: number;
};
```

This type is illustrative; an equivalent clear model is acceptable.

For the Hero-to-About handoff:

- draw it during B;
- allow it to persist only while it remains attached to the visible seam;
- once the complete path is fully occluded, set the path itself to hidden during C—not only its marker;
- restore it deterministically during reverse scroll.

Do not globally hide all completed paths. Glyph contours and lower-page routes have different persistence needs.

### 2. Shorten and reshape the handoff

The Round 4 limit of `min(220px, 18vw)` was too permissive. Use:

```text
maximum visible screen-space length = min(72px, 12vw)
```

Target ranges:

- desktop: 48–72 CSS px;
- mobile: 32–48 CSS px.

The current 1920px path is approximately 170px tall with only 30px horizontal change and reads as a vertical loose end. The replacement must be a shallow directional continuation:

- endpoint vertical displacement must be no more than 2.5× its horizontal displacement;
- it must cross the section seam once;
- it must stay in protected right-side negative space;
- it must not form a vertical cable, hook, loop, or decorative sine wave;
- it must not collide with Hero role copy, CTA, About kicker/title, header, or navigation.

If no short visible continuation survives motion review, omit the separate site handoff and let the Hero tail terminate cleanly at the seam before hidden travel. A clean disappearance at a real boundary is preferable to an orphaned connector.

### 3. Schedule by occlusion, not by an arbitrary percentage

Do not calculate the handoff's lifecycle end as `s0 + (s1 - s0) * 0.45`.

Derive the hide threshold from rendered geometry:

```text
handoff document-space bottom - current scrollY <= compact header bottom
```

Only then may state C hide the completed path. Delay the first glyph start when necessary so C has a non-zero interval after occlusion and before D. A practical hidden interval is 60–120px of scroll, provided the headline remains legible and the trace still completes before it leaves the viewport.

The final values must be selected from visual review, not merely from these suggested numbers.

### 4. Resolve the dead Hero entrance tween

Choose one intentional behavior:

- animated entrance: initial progress truly begins at 0 and advances to the designed resting fraction; scroll progress may take over without a jump; or
- static entrance: render the designed initial fraction immediately and remove the no-op tween.

Do not keep an animation object whose progress cannot affect pixels. Reduced motion must remain static and complete.

### 5. Preserve accepted work

- Keep transform-safe normalized Hero dash drawing and completed-segment invariants.
- Keep the shared 700px responsive threshold and resize rebuild.
- Keep all 14 glyphs, 17 contours, and 2–4 sparse visible glyph connectors.
- Keep the empty aperture, semantic text, no-JavaScript content, no-WebGL boundary, and protected-content routing.
- Keep native scrolling; do not introduce scroll hijacking or a pinned full-screen scene to conceal the lifecycle defect.

## Required automated tests

### Continuous lifecycle sampling

At 1920×927, 1440×900, 700×800, 576×800, and 390×844:

1. Determine the Hero-complete scroll position and the first-glyph-active position from runtime geometry.
2. Sample every 8px of scroll across that entire interval in both forward and reverse order.
3. At each sample classify the page as A, B, C, or D.
4. Assert that only legal transitions occur: `A → B → C → D` forward and the exact inverse in reverse.

Required invariants:

- During B, the handoff is attached to the seam and the site endpoint is on its partial path.
- During C, site handoff, site endpoint, and glyph endpoint are all visually hidden.
- During D, no handoff pixels are exposed below the compact header and the glyph endpoint lies on the active contour.
- The same `scrollY` produces the same phase, path visibility, dash state, and marker visibility regardless of travel direction.
- No frame contains a path component whose two exposed ends both terminate in empty space.

Tests may add a stable `data-thread-phase="hero|handoff|hidden|glyph"` diagnostic contract to the decorative SVG. The attribute must be derived from the same pure render state; it must not become a second state machine.

### Occlusion assertion

When the handoff changes from visible to hidden, prove that immediately before hiding either:

- its complete rendered bounding box is above or within the opaque compact header band; or
- it is outside the viewport; or
- an explicitly documented existing mask fully occludes it.

Do not satisfy this test by expanding the header or adding an unrelated decorative cover.

### Initial Hero state

Add a test matching the chosen entrance behavior. If animated, verify a real monotonic pixel-state change from 0 to the resting fraction without a scroll event. If static, verify no entrance tween is created and the initial state is deterministic after direct navigation and reload.

### Preserve existing tests

Keep all Round 4 responsive, geometry, collision, accessibility, reverse-scroll, reduced-motion, and no-WebGL tests. Tighten or replace only assertions that incorrectly treated a static frame as motion approval.

## Required visual evidence

Screenshots remain useful for geometry but cannot approve this round.

Record normal-motion videos for:

- 1920×927: slow forward A→D, pause briefly in C, then reverse D→A;
- 390×844: the same sequence;
- 701×800 → 700×800 live resize while stopped in C, followed by forward and reverse continuation.

For each recording:

- show the complete browser content area and scrollbar;
- record viewport dimensions, direction, and approximate A/B/C/D timestamps in the evidence README;
- extract at least one frame per phase for review;
- inspect the transition frame by frame, not only at playback speed.

Reject the result if:

- a completed handoff remains visible after its marker disappears;
- an upper-right stroke floats below the header while glyph tracing is active;
- the Hero, handoff, and glyph trace read as separate animations;
- the handoff vanishes in uncovered empty space;
- forward and reverse frames differ at the same scrollY;
- a screenshot passes but the recording still shows a perceptual reset.

## Completion gate

- User-reported video failure is no longer reproducible.
- Runtime lifecycle sampling passes at every required viewport in both directions.
- Motion recordings clearly show A → B → C → D and reverse without orphaned strokes.
- Round 4 transform and responsive fixes remain intact.
- Full automated suite, `npm run check`, and `npm run build` pass.
- Handoff and evidence README report motion results honestly.
- Do not mark Round 5 approved from static screenshots or test counts alone; architect/user motion review is required.
