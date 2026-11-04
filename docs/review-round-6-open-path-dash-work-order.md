# Review Round 6: open-path dash topology work order

## Status and scope

Round 5's short handoff, occlusion lifecycle, hidden travel, deterministic Hero resting state, and responsive threshold work are accepted provisionally and must be preserved. The narrative thread is not approved because partially drawn open paths can paint a second, detached interval at the far end.

This is a focused rendering correction. Do not redesign the composition, typography, route geometry, copy, or unrelated sections. Do not add Three.js.

## Reproduction evidence

Primary user evidence:

- `/home/key/Videos/Screencasts/Screencast From 2026-11-04 15-39-10.mp4`
- 1920×1080 screen recording, approximately 7.27 seconds.
- During a small forward/reverse Hero scroll, the intended red prefix grows near the aperture while a detached red suffix is visible near the bottom-right. The suffix contracts toward the path endpoint and disappears as progress increases.

Browser reproduction at viewport 1920×927 on Hero segment 2:

| scrollY | Dash offset | Painted normalized sample groups |
|---:|---:|---|
| 80 | 0.9869 | `0..1`, `83..100` |
| 100 | 0.9410 | `0..4`, `87..100` |
| 120 | 0.8951 | `0..8`, `91..100` |
| 140 | 0.8492 | `0..11`, `96..100` |
| 160 | 0.8033 | `0..15`, `100` |
| 200 | 0.7115 | `0..22` only |

The samples were obtained with `SVGGeometryElement.isPointInStroke()` at 101 evenly spaced distances. The two early intervals are one SVG path, not two authored segments.

## Root cause

Hero paths use normalized `pathLength="1"`. The active partial state currently applies:

```ts
element.style.strokeDasharray = "1 1";
element.style.strokeDashoffset = String(1 - segProgress);
```

Dash patterns repeat. Shifting the `1 1` pattern exposes the intended prefix and wraps another painted part onto the far end of the same open path. The completion invariant removes dashes only at progress 1, so completion tests cannot detect the defect.

The same class of defect may exist in other open-path renderers that use `length length` plus a phase offset. Audit all `kind: "open"` drawing code, including site segments and visible glyph connectors. Do not apply this rule to closed glyph contours: their trace intentionally wraps around a selected junction.

## Required rendering invariant

For every visible open path and every partial progress `0 < p < 1`:

1. Painted geometry is one contiguous interval.
2. The interval begins at normalized path distance 0.
3. It ends at `p`, allowing only a small line-cap tolerance.
4. No sample near normalized distance 1 is painted before the prefix reaches it.
5. Forward and reverse scroll at the same `scrollY` produce identical paint topology.

Recommended normalized implementation:

```ts
if (p <= 0) {
  // hide/reset the path
} else if (p >= 1) {
  path.style.strokeDasharray = "none";
  path.style.strokeDashoffset = "0";
} else {
  path.style.strokeDasharray = `${p} 1`;
  path.style.strokeDashoffset = "0";
}
```

The gap length is at least the remaining normalized path, so the pattern cannot repeat within the one-unit path. An equivalent mask or clip solution is allowed. Do not merely increase a gap or adjust an offset without proving the rendered invariant.

For a path that does not declare `pathLength="1"`, use the same topology in local units: `strokeDasharray = "<localLength * p> <localLength>"` and `strokeDashoffset = "0"`, or normalize the path deliberately. Do not feed a screen-space transformed length into a local SVG dash pattern.

Continue using true screen-space length for segment timing and weights. Paint progress and timing length are separate responsibilities.

## Implementation requirements

- Fix Hero desktop and mobile partial segments.
- Audit and, where necessary, fix every open site-thread segment and visible glyph connector.
- Preserve completed-segment `strokeDasharray: none` behavior.
- Preserve Round 5's `hideAfterScroll`, phase contract, handoff geometry, hidden travel, and static 0.35 Hero resting state.
- Preserve reduced-motion, native scroll, direct-anchor, resize, and no-JavaScript behavior.
- Do not modify closed-contour traversal to satisfy an open-path test.
- Do not hide the detached suffix with clipping local to the reported viewport; the topology must be correct at every supported viewport.

## Automated acceptance tests

Add rendered-topology coverage without weakening existing completion and lifecycle tests.

Test at minimum 1920×927, 1440×900, 700×800, and 390×844:

1. Dynamically locate each visible active open segment at partial progress near `0.02`, `0.10`, `0.25`, `0.50`, `0.75`, and `0.95` where reachable.
2. Sample at least 200 evenly spaced points with `getPointAtLength()` and `isPointInStroke()`.
3. Assert painted indices form exactly one contiguous group beginning at index 0, allowing at most one or two samples for antialiasing/line-cap tolerance.
4. Assert no painted sample exists beyond expected progress plus tolerance.
5. Repeat the same target states in reverse order and compare results at identical `scrollY` values.
6. Include a regression assertion for Hero segment 2 around the currently failing early activation range; the former far-end groups (`83..100`, `87..100`, and `91..100`) must be absent.
7. Exercise `[data-site-thread-segment]` and `[data-glyph-connector]` partial open states as well as Hero paths. Skip hidden elements and distinguish them from visible topology.
8. Retain the existing completed-path and endpoint-alignment tests.

Do not approve based only on CSS property strings. The assertion must inspect the rendered stroke, because a syntactically plausible dash pattern can still wrap.

## Required visual evidence

Record normal-motion forward and reverse evidence at:

- 1920×927
- 390×844

For both viewports:

- slowly oscillate across Hero segment 2's activation range;
- include clearly inspectable early, middle, and late partial frames;
- then continue through the Round 5 Hero → handoff → hidden → glyph sequence;
- inspect frame by frame for detached tails, backward-shrinking suffixes, endpoint flashes, and direction asymmetry.

Add the new recordings and extracted frames to the existing evidence directories and update the screenshot README with exact filenames, viewport, scroll positions, commands, results, and remaining risks.

## Definition of done

- Every partially drawn open path has one contiguous painted prefix and no wrapped suffix.
- The reported Hero segment 2 reproduction is clean in forward and reverse motion.
- Round 5 lifecycle behavior remains intact.
- `npm run check`, `npm run build`, and all desktop/mobile Playwright tests pass.
- Required Round 6 recordings have been manually reviewed frame by frame.
- `docs/agent-handoff.md` and the screenshot README report honest evidence and do not call the thread approved while any detached open-path interval remains.
