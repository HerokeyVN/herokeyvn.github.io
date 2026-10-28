# Daksh Gajjar reference analysis

Analysis date: 2026-10-28. Source inspected: the public HTML, CSS, JavaScript bundles, and rendered pages delivered by `https://dakshgajjar.com/`.

## Verified implementation findings

- The site is delivered by Next.js on Vercel. No official public repository for this portfolio was found through GitHub repository search.
- The public build uses Archivo Variable for display typography and IBM Plex Mono for small labels and supporting copy.
- The Hero thread is SVG, not Canvas. It is split across two full-section SVG layers: one behind the heading and one in front.
- Ten connected path segments alternate between the two depth layers. This creates the woven effect without converting the accessible heading text into outlines.
- The implementation waits for `document.fonts.ready`, then measures selected characters with DOM `Range#getBoundingClientRect()` and the rendered heading lines with `getBoundingClientRect()`.
- Its Bézier control points are calculated from selected glyph measurements rather than from section rectangles alone. The paths are rebuilt through a `ResizeObserver` and orientation-change handling.
- Stroke-dash drawing uses each path's measured `getTotalLength()`. A global scroll-driven SVG continues the narrative after the Hero.
- The desktop Hero uses three extremely tight uppercase lines, very large negative letter spacing, an ivory/black/vermilion palette, and a small mono footer. Mobile keeps the three-line hierarchy but scales the type and reduces the thread width.
- The delivered bundles do not expose source maps. These findings therefore describe observable public implementation behavior, not unpublished source intent.

## Principles applied to HerokeyVN

- Preserve semantic, selectable HTML typography.
- Use original HerokeyVN geometry and composition, with deliberately selected glyph anchors.
- Keep informational copy and links in a protected footer corridor.
- Use alternating SVG depth only where the thread meets display typography.
- Keep Three.js entirely out of the active page until the typography-led design is independently complete.
