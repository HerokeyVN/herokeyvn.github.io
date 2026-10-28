# Architecture and delivery notes

## Why Astro

The previous repository had no build system and placed presentation, behavior, and content in one HTML file. Astro adds static component composition and typed content without turning the portfolio into a client-rendered application. The deployed result is ordinary HTML, CSS, images, and isolated JavaScript chunks.

React or Next.js would add runtime and deployment complexity without providing a benefit for this single-page, content-first site. Astro preserves GitHub Pages compatibility while giving the redesign maintainable boundaries.

## Content model

`src/data/portfolio.ts` contains professional facts and project metadata. Components consume that data but do not invent metrics, roles, or expertise. Professional work, personal projects, skills, and education remain visually and semantically distinct.

## Motion architecture

Motion is separated by responsibility: `motion.ts` owns entrance and content reveals, `hero-thread.ts` owns the approved Hero path, and `site-thread.ts` owns the safe transition segments between sections. Each module reverts its GSAP contexts, observers, and ScrollTrigger instances on page exit.

The Hero uses two SVG layers around semantic HTML text. The long segments sit behind the title and a short bridge reappears in front. Desktop and mobile retain the manually approved Concept 03 geometry. The site route uses a small set of responsive transition compositions and outer gutters, leaving paragraphs, links, controls, and project details unobstructed.

Native scrolling is preserved. There are no pinned narratives, custom cursors, smooth-scroll replacements, or input-blocking sequences.

## WebGL status

Three.js development is paused. The active page contains no canvas, dependency, or Three.js import and is visually complete without WebGL. `src/components/SpatialAperture.astro` owns the central alignment, clipping boundary, responsive dimensions, depth plane, and `[data-spatial-mount]` element. A future renderer can mount there and receive normalized scroll/pointer state without owning the Hero layout.

## Visual verification

The production build is captured at 1440×900, 820×1000, and 390×844. Checks cover the initial Hero, partial and reverse scroll states, the Hero/About transition, section continuity, and the full page. A geometry check samples the site path and verifies zero intersections with protected content at desktop and mobile sizes.

## Accessibility

- Semantic landmarks and ordered heading levels.
- Skip link, visible focus, keyboard-operable responsive menu, and Escape dismissal.
- WCAG-oriented color contrast and non-color status cues.
- Motion disabled through `prefers-reduced-motion`.
- Project imagery has descriptive alternatives; conceptual visuals include appropriate descriptions or are hidden when decorative.
- Automated Playwright tests cover desktop, mobile, reduced motion, no-JavaScript rendering, axe-core violations, thread depth, aperture presence, and protected-content clearance.

## Deployment

The workflow in `.github/workflows/deploy.yml` installs from `package-lock.json`, validates types, builds static output, and publishes `dist/` through GitHub Pages. The repository's Pages source must be set to **GitHub Actions** after the branch is merged.

No push, merge, or Pages setting change is performed by this implementation.
