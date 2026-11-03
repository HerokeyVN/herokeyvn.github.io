# Review round 3: remove glyph-connector scribble

## Status

**Round 2 rejected for visual completion.** Header occlusion and engineering checks pass, but the connector composition changed from an accidental overline into a zig-zag network that cuts through glyph interiors.

Fix only the glyph-to-glyph transition choreography. Preserve the accepted opaque compact header, full contour tracing, semantic heading, scroll behavior, accessibility, and verified professional content.

## Accepted Round 2 work — do not regress

- Compact sticky header uses an opaque `var(--void)` background above both thread layers.
- Desktop and mobile header crops contain no visible red thread behind identity or controls.
- All 14 semantic glyphs and 17 contours align after resize and direct navigation.
- Full contour drawing, inner-counter hidden travel, reverse scroll, reduced motion, and no-JavaScript content work.
- Build and 26 Playwright tests pass.
- Diagnostic screenshots are no longer tracked.

## Rejected Round 2 work

### Mechanical top/bottom alternation

`GLYPH_JUNCTION_PREFERENCES` alternates nearly every instance between `top` and `bottom`. This creates vertical variation but is not art direction. The implementation defines `right`, `left`, and `fraction` modes yet the submitted route uses only `top` and `bottom`.

### Direct interpolation through letterforms

`createConnector()` draws a cubic directly between distant top/bottom extrema. Its handles remain close to the straight chord between endpoints, so the connector exits and enters through glyph interiors. The completed phrase reads as a red zig-zag or spiderweb.

Evidence:

- `design-explorations/screenshots/glyph-trace/desktop-mid.png`
- `design-explorations/screenshots/glyph-trace/desktop-after.png`
- `design-explorations/screenshots/glyph-trace/mobile-mid.png`

The most obvious failures are the diagonal chains across `R → S → D → O → N → T` on desktop and across `USERS` on mobile.

### Misleading automated assertion

The current `min3ConnectorSpread > 4` assertion proves only that connectors have different Y positions. It rewards large zig-zags and does not prove that a connector occupies negative space.

## Required choreography

### Use sparse visible transitions

- Do not render a visible connector between every adjacent glyph.
- Keep only **2 to 4 visible glyph-to-glyph connectors per rendered composition**.
- Represent every other adjacency as a weighted hidden segment.
- During hidden travel, hide the endpoint marker; the thread disappears behind the glyph and reappears at the next contour.
- Desktop and mobile may use different visible pairs when wrapping changes.

This remains one coherent narrative thread: hidden travel represents depth, not teleportation.

### Pair glyphs deliberately

A visible connector should join a two-glyph pair:

```text
hidden entry → trace glyph A → short visible connector → trace glyph B → hidden exit
```

Avoid giving one glyph visible incoming and outgoing connectors at different anchors. A closed contour returns to its starting junction, so one art-directed junction per glyph should serve the selected visible pair cleanly.

Choose pairs only after inspecting actual desktop and mobile geometry. Good candidates have a genuine inter-letter gap and compatible facing edges. Do not select pairs simply to distribute connectors evenly.

### Separate contour preferences from transition plans

Replace the checkerboard preference table with an explicit transition plan. Suggested contract:

```ts
type AnchorPreference = {
  mode: "top" | "right" | "bottom" | "left" | "fraction";
  fraction?: number;
};

type GlyphTransition = {
  from: string;
  to: string;
  visibility: "visible" | "hidden";
  fromAnchor?: AnchorPreference;
  toAnchor?: AnchorPreference;
  desktop?: boolean;
  mobile?: boolean;
};
```

Requirements:

- Store stable `from`/`to` glyph keys for visible connectors.
- Set `data-from-glyph` and `data-to-glyph` on runtime connector paths for testing and debugging.
- Use side-facing or carefully sampled anchors nearest the inter-letter gap.
- Use `fraction` when extrema do not produce a clean tangent.
- Keep contour start rotation deterministic and preserve the complete closed path.

### Visible connector geometry

- A visible connector must stay local to the gap between its two glyphs.
- Its departure tangent must point away from glyph A; arrival tangent must approach glyph B from outside.
- Connector length should remain close to direct gap distance; reject decorative loops.
- Middle 70% of a connector must not enter any glyph's visual box.
- Do not cross counters, stems, bowls, diagonals, or the interior of another letter.
- Do not route a visible connector through body text, header, metadata, rules, or CTA regions.

If a pair cannot satisfy these conditions, make the transition hidden.

## Implementation guidance

1. Keep line discovery and serpentine contour order.
2. Build an adjacency list from the actual rendered glyph order.
3. Resolve a desktop/mobile transition plan against that adjacency list.
4. For planned visible pairs, calculate the specified anchors and create one short connector.
5. For every unplanned adjacency, create a hidden weighted segment.
6. Keep global Hero entry and About exit paths continuous with first/last glyph junctions.
7. Render direct from current `scrollY`; do not add stateful chained tweens.

Do not build a generic obstacle-routing algorithm. This composition has fourteen glyphs and should remain manually maintainable.

## Required test changes

Remove the `min3ConnectorSpread > 4` acceptance rule. Replace it with assertions that match the design intent.

### Transition-plan contract

- Visible connector count is between 2 and 4 for 1440×900 and 390×844.
- Every visible connector exposes valid `data-from-glyph` and `data-to-glyph` keys.
- Every visible pair is adjacent in the current rendered route.
- All remaining adjacencies still consume progress as hidden segments.

### Connector locality

For each visible connector:

- verify both endpoints remain within 0.75px of their declared glyph contours;
- sample the connector from 15% through 85%;
- assert sampled points do not enter any non-endpoint glyph bounding box;
- assert the middle 70% is outside the inset visual boxes of both endpoint glyphs;
- assert connector length is no more than 1.4× endpoint distance unless a documented pair-specific exception exists.

Bounding-box checks are only a guardrail. Passing them does not replace screenshot review.

### Preserve accepted checks

- Keep header opacity/stacking tests unchanged.
- Keep 14-glyph, 17-contour, alignment, reverse-scroll, resize, accessibility, reduced-motion, no-JS, and no-WebGL tests.
- Adapt connector-count assertions; visible count is no longer `glyphCount - lineCount`.

## Visual evidence gate

Before running the full capture script, produce only:

- one 1440×900 completed headline frame;
- one 390×844 completed headline frame.

Inspect these two frames. Continue only if:

- the phrase reads clearly without a spiderweb;
- no visible connector cuts across a glyph interior;
- visible links look like intentional depth moments;
- hidden transitions do not show endpoint jumps;
- the thread remains secondary to the typography.

After that review, replace the full ten-state set and two header crops. Do not label screenshots `pass` merely because their runtime state matches the requested scroll position.

## Completion gate

- Only 2–4 carefully selected visible connectors remain.
- No full-word overline and no zig-zag chain exists.
- No connector crosses any glyph interior or protected content.
- Hidden travel is visually clean in forward and reverse scroll.
- Sticky-header correction remains intact.
- All automated checks pass on desktop and mobile.
- Desktop/mobile static frames are visually approved before the full evidence set is marked complete.
