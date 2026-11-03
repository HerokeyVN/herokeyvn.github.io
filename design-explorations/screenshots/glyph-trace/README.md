# Full glyph-trace validation

Build: `feat/portfolio-redesign` review round 2 visual corrections
Date: 2026-11-03

## Primary art-direction captures

| Viewport | State | scrollY | Image | Result | Notes |
|---|---|---:|---|---|---|
| 1440×900 | before | 650 | `desktop-before.png` | pass | Hero approach enters from top right; 0 glyph contours visible |
| 1440×900 | entry | 850 | `desktop-entry.png` | pass | First contour (`T` in `DON'T`, RTL line 0) actively drawing with partial stroke-dash |
| 1440×900 | mid | 1075 | `desktop-mid.png` | pass | ~50% headline route complete; dynamic negative-space connectors alternate without overlines |
| 1440×900 | exit | 1310 | `desktop-exit.png` | pass | Line 1 (`SEE.`) near completion; 14 contours finished, 15th contour actively drawing |
| 1440×900 | after | 1450 | `desktop-after.png` | pass | All 17 contours & 12 connectors complete; continuation toward Experience underway |
| 1440×900 | header crop | 1450 | `desktop-header-after.png` | pass | Scrolled thread geometry cleanly occluded by opaque compact header band (`z-index: 100`) |
| 390×844 | before | 540 | `mobile-before.png` | pass | Hero thread approaches About; 0 glyph contours visible |
| 390×844 | entry | 670 | `mobile-entry.png` | pass | Line 0 (`USERS`, RTL) starts with `S`; actively drawing with glowing tip |
| 390×844 | mid | 880 | `mobile-mid.png` | pass | Line 0 complete, hidden transition complete, Line 1 `D` in `DON'T` actively drawing with inner counter |
| 390×844 | exit | 1100 | `mobile-exit.png` | pass | 14 contours complete, final glyphs in `SEE.` actively drawing |
| 390×844 | after | 1250 | `mobile-after.png` | pass | All 17 contours & 12 connectors complete; thread exits period `.` down right gutter |
| 390×844 | header crop | 1250 | `mobile-header-after.png` | pass | Opaque compact header band fully occludes scrolled glyphs behind `HEROKEYVN` brand and `INDEX` button |

## Review round 2 corrections verified

1. **Elimination of Accidental Overlines**:
   - Replaced universal topmost junctions with explicit `GLYPH_JUNCTION_PREFERENCES` in `src/data/about-glyphs.ts`.
   - Alternated anchors across `top`, `bottom`, and `right` per glyph instance (repeated `S` instances alternate bottom/top; repeated `E` instances alternate top/bottom).
   - Replaced flat 2px lift connectors with organic cubic bezier S-curves through inter-glyph whitespace.
   - Verified that no 3 consecutive visible connectors on any line lie within a 4px horizontal band (measured vertical spread is > 40px across all windows).

2. **Protected Sticky-Header Corridor**:
   - Toggled `data-compact` on `.site-header` in `src/components/SiteHeader.astro` whenever `scrollY > 40`.
   - Updated `.site-header[data-compact]` to use opaque `background: var(--void)` (`#030305` / `rgb(3, 3, 5)`) with stacking `z-index: 100 > 5`.
   - Scrolled glyph contours passing underneath the 83px desktop and 91px mobile corridors are fully occluded, preventing visual collision with brand identity, navigation links, and the index menu button.

3. **Extended Automated Test Suite**:
   - Asserted that `GLYPH_JUNCTION_PREFERENCES` contains explicit diverse outer-junction modes and distinct preferences for repeated glyphs.
   - Asserted that 3-consecutive connector endpoint vertical spread is strictly greater than 4px.
   - Asserted that sticky header is compact, opaque (`rgb(3, 3, 5)`), and stacked above both thread SVG layers at `scrollY=1450` (desktop) and `scrollY=1250` (mobile).

## Automated checks
- `npm run check`: pass (22 files, 0 errors, 0 warnings, 0 hints)
- `npm run build`: pass (static build in `dist/` verified)
- `npx playwright test`: 26/26 passed across desktop (Chromium) and mobile (iPhone 13 / Chromium)

## Known limitations & boundaries
- Center Hero aperture remains empty for future Three.js model; no Three.js or WebGL added.
- Non-JS environments render the static semantic HTML headline cleanly without SVG overlay or script execution.
