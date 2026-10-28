# Portfolio redesign: technical and design plan

## Audit summary

- The previous site was a single 810-line HTML file styled through Tailwind's CDN runtime.
- Content positioned HerokeyVN as a full-stack developer and included an outdated school timeline, unsupported skills, a placeholder image, and a contact form without a backend.
- There was no package manifest, repeatable build, automated verification, meaningful metadata, or local asset strategy.
- The visual system relied on cyan glow, rounded cards, and repeated hover scaling, which obscured content hierarchy and did not support the requested professional positioning.

## Design direction

**Spatial Aperture** makes identity, role, and a central negative-space volume the primary composition. Warm ivory typography, near-black surfaces, one restrained vermilion accent, large negative space, and fine mono metadata replace the earlier dashboard language.

Daksh Gajjar's public implementation was inspected through rendered pages and delivered frontend assets. The verified principles—not its composition or proprietary code—inform the solution: semantic monumental type, SVG depth layers, glyph-measured geometry, controlled negative space, and one continuous thread. Detailed evidence is recorded in `docs/reference-analysis.md`.

## Architecture decision

Use Astro as a static site generator. It produces indexable HTML, keeps content in typed data, provides component boundaries without shipping a UI framework, and builds to files compatible with GitHub Pages.

- `src/data/portfolio.ts`: factual content source of truth.
- `src/components`: semantic presentation components.
- `src/scripts/motion.ts`: restrained entrance and reveal motion.
- `src/components/SpatialAperture.astro`: static centerpiece and future renderer boundary.
- `src/scripts/hero-thread.ts`: approved, dual-depth Hero thread.
- `src/scripts/site-thread.ts`: segmented, collision-safe section transitions.
- `src/styles/global.css`: tokens, layout, states, and responsive rules.
- `public`: local project imagery, favicon, social preview, and static fallback artwork.

## Interaction and performance strategy

- Preserve native scrolling; no smooth-scroll replacement or scroll hijacking.
- Animate only transforms, opacity, and SVG stroke progress.
- Keep all content visible without JavaScript; motion enhances already-rendered HTML.
- Keep Three.js out of the active page until a later, separately approved phase.
- Preserve the art-directed desktop and mobile Hero path geometry from Concept 03.
- Route the full-site thread through deliberate outer-gutter transition segments, with automated collision sampling against protected content.
- Self-host fonts and project assets; reserve image dimensions to avoid layout shift.

## Delivery phases

1. Repository preparation and audit.
2. Static architecture, design tokens, responsive grid, and typed content.
3. Complete semantic portfolio sections and functional links.
4. Typography-led GSAP choreography and SVG narrative thread.
5. Accessibility, responsive, bundle, and production-build validation.
6. Deployment workflow and implementation documentation.
