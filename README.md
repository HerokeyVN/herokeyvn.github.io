# HerokeyVN portfolio

A static, editorial portfolio for a backend developer, built with Astro, TypeScript, GSAP, and typography-aware SVG motion.

## Local development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run check
npm run build
npm run test:e2e
```

## Architecture

- Astro renders the complete portfolio to static HTML for GitHub Pages, SEO, and no-JavaScript resilience.
- Portfolio facts live in `src/data/portfolio.ts`; components only present that data.
- `src/scripts/motion.ts`, `hero-thread.ts`, and `site-thread.ts` separate entrance choreography, the approved Hero thread, and the section-transition thread segments.
- The active page does not load WebGL. Three.js is intentionally paused until a later visual-review phase.
- `src/components/SpatialAperture.astro` owns the stable visual and mounting boundary reserved for a future renderer.
- The Hero thread uses the approved Concept 03 geometry, split behind and in front of selectable HTML typography.
- The section thread disappears and reappears at deliberate transitions, stays in protected corridors, and is tested against important content.
- Project imagery is local. The Sky Sheet Store image is an authentic capture of the live product; the other project visuals are explicitly conceptual.

## Deployment

The GitHub Pages workflow builds `dist/` on pushes to `main`. The repository must use **GitHub Actions** as its Pages source. No server runtime is required.

## Design and implementation notes

See [the implementation plan](docs/implementation-plan.md) and [reference analysis](docs/reference-analysis.md) for the audit, verified research, and architectural decisions.
