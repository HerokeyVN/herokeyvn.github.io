# Full glyph-thread implementation specification

## 1. Target behavior

The outlined phrase `USERS DON'T SEE.` is a semantic HTML heading with a decorative SVG overlay. During scroll, one red narrative thread enters from the Hero, traces every glyph outline in an art-directed order, disappears behind filled typographic regions when required, and exits toward the next section.

The effect must be reversible and deterministic. At any scroll position, visible geometry is a pure function of current layout and `scrollY`; it must not depend on scroll speed or direction.

## 2. DOM and data contract

### Semantic layer

- Keep one `<h2 id="about-title">` with the complete accessible name.
- Each visible character has `.about__glyph[data-glyph-key="wordIndex-charIndex"]`.
- Each nowrap word has one zero-size `[data-glyph-baseline="wordIndex"]` marker at its typographic baseline.
- Preserve normal spaces between word wrappers so wrapping remains browser-driven.
- Apply the known Syne apostrophe-to-T kerning correction in HTML/CSS; do not distort SVG geometry to compensate.

### Decorative layer

- `[data-glyph-thread]` is one full-document, `aria-hidden="true"`, pointer-ignoring SVG.
- Every contour has `data-glyph-key` and zero-based `data-glyph-contour`.
- Outer contour is index `0`; inner counters follow in source order.
- Runtime same-line connectors live in `[data-glyph-connectors]`.
- `[data-glyph-thread-end]` is hidden during non-visible transitions.

### Font source

- Geometry comes from `@fontsource/syne` Syne 700 Latin WOFF.
- Units per em: 1000.
- Static outline data belongs in `src/data/about-glyphs.ts`; do not add a browser font parser.
- Keep SIL Open Font License attribution beside generated SVG paths.

## 3. Coordinate systems

Use document coordinates consistently:

```text
originX   = glyphRect.left + window.scrollX
baselineY = baselineRect.top + window.scrollY
scale     = parsedComputedFontSize / 1000
transform = translate(originX baselineY) scale(scale)
```

Syne paths use negative Y values above the baseline. Do not flip the Y axis.

For the moving endpoint, transform the path-local point through `path.getScreenCTM()`, then into the target SVG coordinate system through `siteSvg.getScreenCTM().inverse()`. Never mix an untransformed font point with document coordinates.

## 4. Rendered-line discovery

Do not assume desktop or mobile line counts. After fonts and layout are stable:

1. Measure every `.about__glyph` top and left.
2. Sort by top, then left.
3. Group glyphs whose tops differ by less than 4 CSS pixels.
4. Sort each line left-to-right.
5. Reverse even-indexed lines and keep odd-indexed lines forward.

Expected routing:

```text
Two lines:   right → left, hidden line break, left → right
One line:    all glyphs right → left
Three lines: right → left, left → right, right → left
```

Visible connector count is `glyphCount - renderedLineCount`; each line break is a hidden weighted transition.

## 5. Junction selection

For every contour:

1. Measure `getTotalLength()` after assigning its transform.
2. Sample at least 120 evenly spaced distances in path-local space.
3. Select the point with the smallest local Y as the top junction.
4. Store local distance plus transformed document-space X/Y.

For outer contours, this junction is both entry and exit of the closed trace. For inner contours, hide the endpoint during transitions to and from the counter.

If the final frame shows an accidental continuous overline, replace generic topmost selection with per-character junction metadata. Art direction takes priority over algorithmic uniformity.

## 6. Segment model

Represent the route as a flat ordered list:

```ts
type Segment = {
  element?: SVGPathElement;
  drawLength: number;
  weight: number;
  startDistance: number;
  kind: "open" | "closed" | "hidden";
  layer: "site" | "glyph";
  startScroll: number;
  endScroll: number;
};
```

- `open`: site paths and visible glyph-to-glyph connectors.
- `closed`: glyph contours; draw from the selected junction once around the full contour.
- `hidden`: line breaks and travel into/out of counters; consumes progress without a line or endpoint.

For a glyph with a counter:

```text
outer contour → hidden in → inner contour → hidden out → connector/line break
```

## 7. Connector geometry

### Same line

- Connect only outer-contour junctions of adjacent glyphs in route order.
- Use one shallow cubic Bézier with handles around 30% of horizontal distance.
- Keep vertical lift minimal and consistent.
- Reject a completed frame that reads as one typographic overline.

### Different lines

- Create a hidden segment weighted from physical distance.
- Do not render a diagonal connector, giant gutter loop, or long vertical stroke.
- Disappearance represents the thread passing behind the typographic block.

### Global continuation

- Site segment 0 terminates exactly on the first routed glyph junction.
- Site segment 1 starts exactly on the final routed glyph junction.
- Lower-page segments retain their protected gutter routes.

## 8. Scroll mapping and drawing

Use one direct scroll controller. Avoid chained tweens that accumulate state.

```text
progress = clamp(0, 1, (scrollY - startScroll) / (endScroll - startScroll))
```

Open path:

```text
strokeDasharray = length length
strokeDashoffset = length - length * progress
```

Closed contour:

```text
visible = length * progress
strokeDasharray = progress === 1 ? none : visible (length - visible)
strokeDashoffset = -startDistance
endpointDistance = (startDistance + visible) % length
```

Distribute headline scroll duration by visual CSS-pixel length:

```text
contour weight   = localPathLength * glyphScale
connector weight = connectorLength
hidden weight    = restrained fixed/physical-distance weight
```

The headline must finish while it remains legible in the viewport. Do not extend the route until early glyphs have scrolled away.

## 9. Lifecycle

Required order:

1. Wait for `document.fonts.ready`.
2. Measure settled HTML layout.
3. Set both SVG size/viewBox values to the full document.
4. Transform glyph paths and rebuild runtime connectors.
5. Rebuild global paths against first/last glyph junctions.
6. Calculate scroll intervals.
7. Render immediately at current `scrollY`.
8. Refresh ScrollTrigger after stable geometry, then render again.

On responsive changes, rebuild after layout settles. Observe the headline or debounce window resize; never observe the full-document SVG if changing its height can retrigger measurement.

Cleanup must cancel pending frames, remove listeners/observers, and kill the owned ScrollTrigger.

## 10. Layering and accessibility

- Site thread stays below the glyph overlay.
- Glyph SVG stays decorative and pointer-transparent.
- Body copy, metadata, navigation, links, buttons, project cards, and education remain protected.
- HTML outline remains visible without JavaScript.
- With reduced motion, show a stable complete route and hide endpoint markers.
- Do not introduce canvas or WebGL.

## 11. Acceptance criteria

Geometry:

- 14 semantic glyph spans and 17 SVG contours.
- Every transform matches glyph X, word-baseline Y, and computed scale within subpixel tolerance.
- Every visible connector endpoint lies on its associated outer contour junction.
- Connector count adapts to actual rendered line count.
- Site entry/exit meet first/last glyph without a visible gap.

Behavior:

- Forward, reverse, rapid direction change, direct anchor navigation, and resize yield the same state for the same `scrollY`.
- No endpoint teleport is visible; endpoint is hidden for hidden segments.
- All contours complete before the Experience section owns the route.

Visual:

- Every outlined letter is visibly traced.
- Completed typography stays readable and balanced.
- No generic diagonal, sine wave, giant gutter loop, or accidental full-width overline.
- No collision with protected content at desktop or mobile.
