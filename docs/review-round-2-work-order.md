# Review round 2: glyph-thread visual correction

## Status

**Rejected for visual completion.** Build, accessibility, geometry alignment, and 24 Playwright tests pass, but the submitted screenshots violate the approved art-direction and protected-header requirements.

Do not redesign unrelated portfolio sections. Correct the thread composition, extend the tests, replace the final evidence, and stop for review.

## Verified failures

### 1. Accidental typographic overline

The generic junction logic selects the topmost sampled point for every glyph. Same-line connectors then use a cubic curve with a fixed 2px lift. In completed and mid states, consecutive connectors merge into one nearly horizontal red rule across `USERS` and `DON'T`.

Evidence:

- `design-explorations/screenshots/glyph-trace/desktop-mid.png`
- `design-explorations/screenshots/glyph-trace/desktop-after.png`
- `design-explorations/screenshots/glyph-trace/mobile-mid.png`

Root implementation:

- `src/scripts/site-thread.ts`: `findTopJunction()` and `createConnector()`.

This directly violates `docs/glyph-thread-implementation-spec.md`: connectors must occupy deliberate negative space and must not form a full-word overline.

### 2. Sticky-header visual collision

At submitted `after` positions, completed glyph contours and connectors scroll through the fixed header corridor. The translucent compact header allows red paths to remain visible behind the brand and navigation/menu control.

Measured at the submitted scroll positions:

| Viewport | scrollY | Glyph/connector paths intersecting header band |
|---|---:|---:|
| 1440×900 | 1450 | 22 |
| 390×844 | 1250 | 25 |

Evidence:

- `design-explorations/screenshots/glyph-trace/desktop-after.png`
- `design-explorations/screenshots/glyph-trace/mobile-after.png`

The mobile capture visibly merges the red outline with `HEROKEYVN` and `INDEX`. The desktop capture places the traced headline behind the navigation row.

### 3. Test coverage does not represent the visual requirement

The existing collision test checks only `[data-site-thread-segment]`. It does not sample `[data-glyph-contour]` or `[data-glyph-connector]`, and it explicitly excludes `.site-header`. Therefore 24/24 passing tests do not prove protected-header compliance.

### 4. Evidence report overstates completion

The screenshot README says every state passed and declares no known limitations. Those claims are invalid until this work order passes a new architect review.

## Required design correction

### Art-directed glyph junctions

Replace the universal topmost-junction decision for outer contours with explicit, maintainable art-direction metadata.

Recommended contract:

```ts
type JunctionPreference = {
  mode: "top" | "right" | "bottom" | "left" | "fraction";
  fraction?: number;
};

type GlyphRouteOverride = {
  desktop?: JunctionPreference;
  mobile?: JunctionPreference;
};
```

Requirements:

- Assign route anchors per glyph instance or per adjacency, not only per character; repeated `S` and `E` may need different anchors.
- Preserve the full closed-contour trace. Changing the start distance must rotate the dash, not shorten the outline.
- Alternate top, side, and lower negative-space crossings intentionally so adjacent connectors do not align into a rule.
- Keep connectors short and local to inter-glyph whitespace.
- A connector may become a hidden transition when no clean visible route exists.
- Preserve the hidden transition between rendered text lines.
- Do not introduce a generic automatic obstacle router.

Before coding all fourteen glyphs, tune one desktop line and one mobile line, capture a completed static frame, and verify that the connector rhythm reads as a thread rather than an underline/overline.

### Protected sticky-header corridor

The fixed header must visually occlude scrolled thread geometry. Choose one stable implementation:

1. Preferred: give the compact header an opaque visual backing while keeping its content above both SVG layers.
2. Alternative: add a dedicated fixed header mask/occlusion layer above thread SVGs and below header controls.

Requirements:

- No red contour, connector, or endpoint may remain visible behind brand, nav links, or menu button.
- Preserve the initial transparent Hero header if desired; protection is required once the header is compact or content scrolls beneath it.
- Do not solve this by reducing glyph opacity or hiding the whole thread early.
- Verify both the 83px desktop header band and the 91px mobile header band.

## Required automated checks

Add or amend tests without weakening existing geometry assertions.

### Connector composition

- Assert the implementation uses explicit outer-junction preferences rather than a single topmost strategy for all fourteen instances.
- Assert connector count still adapts to rendered line count.
- Assert no three consecutive visible connectors on one line have both endpoints within the same 4px horizontal band.
- Keep endpoint-to-contour continuity below the current 0.75px threshold.

### Header protection

At desktop `scrollY=1450` and mobile `scrollY=1250`:

- Assert header stacking is above `.glyph-thread` and `.site-thread`.
- Assert the compact header or dedicated occlusion layer has an opaque effective background.
- Assert brand and menu/nav remain readable and unobstructed.
- Add screenshots or focused visual assertions for the header crop; geometry intersection alone is acceptable only when the opaque layer guarantees zero visible overlap.

### Existing behavior

Retain all checks for:

- 14 semantic glyphs and 17 contours;
- direct anchor navigation and resize alignment;
- reverse scroll and rapid direction changes;
- reduced motion and no-JavaScript content;
- no canvas or Three.js;
- global thread clearance from body copy and controls.

## Required evidence replacement

1. Re-capture all ten primary states at 1440×900 and 390×844.
2. Add two header-crop captures at submitted `after` positions.
3. Update the screenshot README with new `scrollY` values and honest limitations.
4. Remove diagnostic PNGs from Git tracking unless a specific image is referenced by the final report. Keep the final evidence set small.
5. Run:

```bash
npm run check
npm run build
npx playwright test
```

## Approval gate

Do not mark complete until all statements are true:

- The full contour of every outlined glyph is traced.
- No word has a continuous accidental red overline.
- Same-line connectors show deliberate variation and negative-space routing.
- No red thread is visible behind sticky-header identity or controls.
- All automated checks pass on desktop and mobile.
- Final screenshots visibly demonstrate the corrections.
- `design-explorations/screenshots/glyph-trace/README.md` no longer claims approval without matching evidence.
