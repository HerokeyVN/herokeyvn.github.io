# Agent handoff: full outlined-glyph narrative thread & responsive continuity

## Architect review status

**Round 8 In Progress (redesign implemented, verification in progress).** Key judged all three round-7 motifs ugly ("Cả 3 đều xấu, làm lại hết", 2026-11-07 01:09) and asked for a full redo. The redesign is implemented on branch `feat/project-thread-motifs` (uncommitted). A real rendering bug found during round-8 capture (vector-effect dash scale, see Round 8 section) is fixed and verified; the full Playwright suite and the re-capture are running.

**Round 7 In Progress (implementation complete, full verification blocked by environment).** Items 0-5 of the red-thread fix list are implemented and committed on branch `feat/project-thread-motifs`. Full re-verification (item 6) is blocked by an intermittent host filesystem fault (see EPERM blocker below).

Round 7 changes:
- Gap fix (4089831): new 7th site-thread segment (index 6), a visible connector from hero handoff end to first glyph junction; phase contract now `hero | handoff | connector | glyph`; hidden phase removed. The thread is continuous from the hero exit point to the first glyph junction, with no scroll range where all segments are hidden.
- Playwright config (74ece43): local runs use bundled Chromium by default; Google Chrome only behind an env var.
- Motifs (ea0b584): `src/components/ProjectVisual.astro` rewritten (three thread stages, desktop + mobile SVG variants); project images deleted; new `src/scripts/project-threads.ts` (one gsap.timeline per motif, trigger article, start `top 80%`, end `bottom 45%`, scrub 1, ease none; Round 6 dash invariant). E2EE knot has 4 self-crossings; Sheet Store wave + 3-turn spiral + exit; Piano 15 steps with accent dots at steps 3, 8, 12 on the peaks.
- Motion retarget + accent rename (d9acbad): `src/scripts/motion.ts` retargeted from `[data-project-visual]` to the motif stage selector; `--accent-cyan` renamed to `--accent-red` (identical value #ff3c1a); unused `--accent-cyan-glow` deleted; dead `.project-exhibit--reversed` grid rule removed.
- Collision tests (1c7df2d): extended to headings, `.project-name`, `.project-description`, `.tech-tag`, `.project-exhibit`, `.project-exhibit__visual`, kicker; new motif containment test (motif stays inside its stage, off project content). All 4 tests pass.
- Flaky test fix (ad3692d): `tests/portfolio.spec.ts:572` "hero draw progress maintains completion invariant across responsive viewports" - root cause is the 30 s default test timeout: 9 `goto` calls in one test take ~26 s, exceeding 30 s under full-suite load. Fix: one `goto`, then `setViewportSize` per viewport (same assertions). Per-viewport cost ~500 ms is the gsap.matchMedia context switch, not waitForFunction polling. Verified in isolation 6/6 passes, ~5 s per run. Do NOT fix by raising timeouts or relaxing tolerances.
- Panoramic decision: KEEP Sheet Store full-width stage, motif authored for it (1440 viewBox). Known observation: Sheet Store motif completes off-screen on short viewports (stage at top of a tall article) - noted for handoff, spec unchanged.

**EPERM blocker (environment, not a code defect).** Since 2026-11-06 17:36, intermittent write failures (`EPERM: operation not permitted, write`) affect shell-spawned processes writing varied/high-entropy content (npm, Astro, Playwright, Python, tar, cp) across all filesystems (btrfs /home/hatch, tmpfs /tmp). Files are created/truncated to 0 bytes, then the data write fails. Small writes and highly repetitive content sometimes succeed; failures come and go within seconds. Cause unknown; seccomp is active (4 filters); root is overlayfs with `metacopy=on`. A diagnostic `cp` during this investigation corrupted `node_modules/astro/dist/core/sync/index.js` to 0 bytes; it was restored byte-for-byte from the npm cache tarball (astro 7.3.8, SHA256 2fa0dab9c4cf5358ba5e11424cc27ea4bc61f1571cb92569c6c44f8a9fb514f7, 9581 bytes). Because of this blocker, the item-6 full re-verification (`npm run check`, `npm run build`, full Playwright suite with CI=true, gap probe re-run, visual QA Round 7 capture) could not be completed in this session and must be re-run once the filesystem fault clears.

**Round 6 Completed & Verified.** All requirements in `docs/review-round-6-open-path-dash-work-order.md` are fully met and verified. The open-path dash topology defect has been repaired:
- Partial open-path drawing in `src/scripts/hero-thread.ts` now enforces `strokeDashoffset = "0"` with `strokeDasharray = "${segProgress} 2"`, preventing dash pattern wrap under non-uniform viewBox stretch (`preserveAspectRatio="none"` with `vector-effect: non-scaling-stroke`).
- Partial open-path drawing in `src/scripts/site-thread.ts` (site gutters, Hero-to-About handoff, visible glyph connectors) now enforces `strokeDashoffset = "0"` with `strokeDasharray = "${visible} ${segment.drawLength}"` and `strokeDasharray = "none"` upon completion (`progress >= 1`).
- Closed glyph contours retain their junction-wrap behavior (`strokeDashoffset = -segment.startDistance`).
- Rendered stroke topology verified via `SVGGeometryElement.isPointInStroke()` and `getPointAtLength()` over 200 samples per active segment: every partial open path paints exactly one contiguous group starting at distance 0, with zero detached suffixes.
- Dedicated Hero segment 2 regression test proves former far-end sample groups (`83..100` at scrollY 80..160) are completely eliminated across 1920×927, 1440×900, 700×800, and 390×844.
- Automated Playwright suite expanded to 42/42 passing tests (21 desktop, 21 mobile).
- Round 6 normal-motion recordings (`round-6-1920x927-hero-open-path.webm`, `round-6-390x844-hero-open-path.webm`) captured with slow oscillation through Hero segment 2 early, middle, and late states and continuation through the full Hero → handoff → hidden → glyph sequence.

Round 5 work that is preserved:
- Handoff lifecycle is decoupled and explicitly scheduled by occlusion (`sOccluded = Math.ceil(handoffBottom - headerHeight)`), setting `siteSegments[0]` to `visibility: "hidden"` during hidden travel (Phase C) once occluded by the opaque compact header.
- Handoff geometry is shortened to $L \le \min(72\text{px}, 12vw)$ with directional continuation $dy \le 2.5 \times |dx|$, crossing the seam into right-side negative space with zero collisions.
- The dead Hero entrance tween was removed, establishing a deterministic static 0.35 initial resting fraction driven authoritatively by `window.scrollY`.
- Diagnostic phase contract `data-thread-phase="hero|handoff|hidden|glyph"` preserved on the decorative SVG.

## Mission

Maintain narrative thread temporal continuity, open-path paint topology, and responsive integrity from Hero tail through hidden travel into the first About glyph while preserving accepted Round 4-5 geometry and Concept 03 composition. Do not add Three.js or redesign other sections.

## Current repository state

Changed implementation files:

- `src/scripts/hero-thread.ts`:
  - Enforced zero dash offset on partial draws (`strokeDashoffset = "0"`).
  - Set `strokeDasharray = "${segProgress} 2"` to ensure the unpainted gap exceeds the remaining physical stroke under non-uniform viewport stretch.
  - Reset to `strokeDasharray = "0 2"` and `visibility: "hidden"` when unstarted (`segProgress <= 0`).
  - Preserved completion invariant (`strokeDasharray = "none"` when `segProgress >= 1`).
- `src/scripts/site-thread.ts`:
  - Applied single-prefix topology for all open segments (`siteSegments` and `glyphConnectors`): `strokeDashoffset = "0"`, `strokeDasharray = "${visible} ${segment.drawLength}"`.
  - Applied completion invariant for open segments: `strokeDasharray = "none"`, `strokeDashoffset = "0"`, `visibility = "visible"`.
  - Preserved junction-wrap traversal for closed glyph contours (`kind === "closed"`).
  - Preserved `hideAfterScroll = sOccluded` lifecycle on handoff.
- `tests/portfolio.spec.ts`:
  - Added dedicated regression test `hero segment 2 eliminates dash-wrap suffix and paints single contiguous prefix across early activation`.
  - Added comprehensive topology test `verifies contiguous open-path topology across hero, handoff, glyph connectors, and responsive viewports`.
  - Total test count expanded to 42 tests (21 desktop, 21 mobile); all 42 pass.
- `scripts/capture-round-6-motion.mjs`:
  - Captures normal-motion video recordings oscillating through Hero segment 2 activation range and through the complete sequence at 1920×927 and 390×844.
- `design-explorations/recordings/`:
  - `round-6-1920x927-hero-open-path.webm` (7.5M)
  - `round-6-390x844-hero-open-path.webm` (2.0M)
- `design-explorations/screenshots/glyph-trace/round-6/`:
  - Contains 12 extracted frames across early, mid, late Hero segment 2 and Phases B, C, D at 1920×927 and 390×844.
- `design-explorations/recordings/`:
  - Contains normal-motion video captures:
    - `round-5-1920x927-lifecycle.webm`
    - `round-5-390x844-lifecycle.webm`
    - `round-5-701-to-700-resize.webm`
- `design-explorations/screenshots/glyph-trace/round-5/`:
  - Contains 8 phase frame extracts (`round-5-1920-phase-[A-D].png`, `round-5-390-phase-[A-D].png`).

## Verified facts from current implementation

- Headline glyph count: 14 (`USERS` 5, `DON'T` 5, `SEE.` 4).
- SVG contour count: 17 because `R`, `D`, and `O` each have an inner contour.
- Exactly 3 visible connectors are rendered in each composition (budget: 2–4).
- All unplanned adjacencies are weighted hidden segments; moving marker is hidden (`autoAlpha: 0`) during hidden travel to create depth behind letterforms.
- Syne glyph coordinates use 1000 units per em; runtime scale is `computedFontSize / 1000`.
- The glyph overlay is decorative (`aria-hidden="true"`). The real `<h2>` remains selectable and exposes `Built for the parts — Users don't see.` to assistive technology.
- Completed Hero segments strip dash patterns and retain their transformed endpoints. This completion behavior is accepted, but it does not validate partial open-path paint topology; Round 6 covers that separate defect.
- Hero-to-About handoff meets the active Hero exit path within $< 0.001\text{px}$, respects $L \le \min(72\text{px}, 12vw)$, and stays entirely in right-side negative space.
- Responsive threshold unified at 700px across markup, CSS, GSAP, and glyph routing.
- `npm run check` and `npm run build` pass cleanly (0 errors, 0 warnings, 0 hints).
- All 42 Playwright tests pass across both `desktop` and `mobile` projects (21 desktop, 21 mobile).

## Round 7 verification status (partial, blocked by EPERM)

- `npm run check` 0 errors and `npm run build` pass at 2026-11-06 17:20 (before the EPERM fault).
- Full suite 2026-11-06 17:20: 42 passed, 2 failed (flaky test, both projects) - the flaky test fixed by ad3692d.
- Full suite 2026-11-06 17:33: 33 passed, 11 failed (all mobile, cause undetermined, error-context files empty - possibly EPERM-related). Desktop 22/22 in that run.
- Targeted desktop tests for the gap fix, motifs, collision, and flaky-test fix pass.
- Flaky-test fix verified in isolation: 6/6 passes, ~5 s per run (was ~26 s).
- Gap probe (desktop 1440x900, before the fix): thread vanished scrollY ~550-1000. After the fix (4089831): no gap at scrollY 500-1000. Full gap-probe re-run (100 px steps, 0-1600, all phases/dots) is pending the EPERM clearing.
- Round 7 capture script `scripts/capture-round-7-motion.mjs` (1920x927 and 390x844 forward/reverse recordings, motif frames) is written but not yet run (blocked by EPERM).
- Screenshot README update and final commit of the capture script are pending the visual QA run.

## Round 8: all three motifs redesigned (Key: "Cả 3 đều xấu, làm lại hết")

Key judged all three round-7 motifs ugly (2026-11-07 01:09). Diagnosis: sparse abstract geometry in a thin band in the middle of big empty black stages - E2EE knot small like a scribble with long empty straights, Sheet Store sine wave repetitive like generic audio, Piano staircase plain. The reference thread draws recognizable story elements that fill the stage. Redesign direction: each motif fills ~85% of stage width and height and reads instantly at a glance. Root cause of the thin band: the stage used min-height, so the SVG viewBox (900x560) rendered with default `meet` fit and only occupied the middle ~59% of the stage height. Fix: the stage now uses `aspect-ratio` matching its viewBox (900/560, panoramic 1440/560, mobile 1/1), so the motif fills the stage exactly.

New designs (`src/components/ProjectVisual.astro`, `src/scripts/project-threads.ts`):
- E2EE (900x560): straight from A, big dense knot centrepiece (one period of a perturbed 3:2 Lissajous, centre (450,280), A=210, B=190, 7 self-crossings, bbox ~447x399), straight to B through the ball. Endpoint nodes r=7 with A/B labels. HTML phase captions: Plaintext / Encrypted / Decrypted. Existing Signal Protocol / Noise transport captions kept.
- Sky Sheet Store (panoramic 1440x560): melody line on a faint staff (5 thin dim staff lines, white 0.16 opacity, background guides not the thread), red thread weaves across the staff through 11 melody notes with note-head loops at 4 peaks, then a 5-turn Archimedean spiral (vinyl record, r 8-195) with faint record circles, then a short straight exit toward the button. Mobile stacks staff on top, record below.
- Sky Auto Piano (900x560): real keyboard outline in one continuous serpentine (12 keys, x 60-840, y 430-520), tall bouncing steps that dip down to press 3 keys (red dots on the keys), large arpeggio zigzag to the top-right corner. Mobile: 10 keys.

E2EE scrub-boundary fix: the old 0.3 boundary point (240,280) is shared by straight-A end, knot start, knot end, and through-line start, so the closest-sample search resolved it to the knot END (fraction 0.848) instead of the knot start (0.046), and the whole knot drew in the first 30% of the timeline. Fixed with unambiguous points: 0.3 boundary (248,257), 0.7 boundary (240,324); mobile (148,257) and (140,311). After the fix the probe reads E2EE mid frac 0.445, boundary fractions b03 0.053, b07 0.835; Sheet b05 0.34, b09 0.985; Piano 0.50.

Vector-effect dash-scale bug (Piano mid paradox, found 2026-11-07 during round-8 capture): the Piano mid screenshot showed the thread drawn to path fraction ~0.71 while the DOM dash read exactly 0.5 ("2411.78, 4823.56"). Root cause: the motif paths use `vector-effect: non-scaling-stroke`, which keeps the stroke at a constant 2px but also makes Chromium apply the dash pattern in screen units instead of viewBox units. A dash of `p * length` paints `p * length` screen px of a path whose screen length is `length * scale`, so the render shows p / scale (Piano stage scale 0.712, so 0.5 rendered as 0.71). The site thread is unaffected (its viewBox is 1:1 with document px, scale 1). The DOM APIs (`getTotalLength`, `getPointAtLength`, `isPointInStroke`) all agreed with the renderer, so the bug was invisible to the automated tests, which verify the DOM dash. Fix in `src/scripts/project-threads.ts` `applyDash`: scale the dash by the live CTM (`path.getScreenCTM()`, `Math.hypot(ctm.a, ctm.b)`), so the dash is `p * length * scale` / `length * scale`. The Round 6 invariant is preserved in screen units. Verified: Piano mid now renders exactly 0.5 (dash "1708.57, 3417.14", scale 0.708, pixel check (260,120) not red, (160,328) red, red px 2564 vs 3607 before). The same inflation affected E2EE (scale 0.6, 1.67x) and Sheet Store (scale 0.94, 1.06x); all mids were re-captured after the fix. Cross-browser note: if a browser interprets the dash in user units even with non-scaling-stroke, the scaled dash would under-draw by the scale factor; Chromium (and Firefox, which matches) use screen units. Revisit if a Firefox/Safari check shows under-draw.

Mobile top-label overlap (found in round-8 mobile fulls): on a 354px stage the two top labels together are wider than the stage, so E2EE "Signal Protocol / Key state" collided with "Noise transport / Encrypted flow", and Sheet Store "02 / Live platform" collided with "Discovery · Sharing · Practice". Fix: `.visual-label--top-right` is `display: none` below 700px; the left label, the motif, and (E2EE) the phase captions carry the story on mobile.

Capture lessons (`scripts/capture-round-8-motifs.mjs`): do not use Playwright fullPage screenshots (they resize the viewport and smear fixed elements); use CDP captureBeyondViewport with a document-coordinate clip. Hide fixed elements (sticky header, skip link) with an injected style tag before a CDP capture. Spawn the preview server detached with stdio:ignore and kill the process group (a stdio:inherit spawn hangs the shell). Never `pkill -f "astro preview"` (matches the agent's own shell). Inject `scroll-behavior:auto!important` and wait 2500ms for the scrub playhead to settle.

Round 8 verification status (2026-11-07, after the dash-scale fix and the mobile label fix):
- `npm run check` 0 errors, 0 warnings, 2 hints; `npm run build` passes (knot crossings desktop=7 mobile=7).
- Targeted Playwright tests (site thread outside protected content, motif inside stage, connector gap, hero completion invariant, hero segment 2 dash-wrap, contiguous open-path topology): 6/6 desktop and 6/6 mobile pass.
- Full Playwright suite with CI=true: 44 passed in 3.9m (2026-11-07 ~19:07 UTC). The 11 mobile failures from the round-7 17:33 run do not reproduce; they were EPERM-related.
- Gap probe re-run (desktop 1440x900, 100px steps, scrollY 0-1600): thread visible at every step. Hero thread draws at 0-400, handoff at 500, connector at 600-800, glyph tracing from 900. No gap.
- Fresh motif3 screenshots (desktop 1440x900 and mobile 390x844, mid and full per motif) re-captured after the dash-scale fix and the mobile label fix: 12 files in `~/workspace/portfolio-check/`, all verified by pixel checks (E2EE mid through-line not drawn, Sheet mid melody complete with spiral just starting, Piano mid exactly 0.5). See the screenshot README in that folder.
- Diagnostic probe scripts (`scripts/probe-*.mjs`, `scripts/gap-probe-r8.mjs`) are not deliverables; deleted before committing.

## Automated verification evidence

- Verification commands:
  ```bash
  npm run check
  npm run build
  npx playwright test
  ```
- Automated Test Results: 42/42 passed across `desktop` (21/21) and `mobile` (21/21).
- Visual motion recordings in `design-explorations/recordings/`:
  - `round-6-1920x927-hero-open-path.webm` (Hero segment 2 oscillation, forward through glyph D, reverse to 0)
  - `round-6-390x844-hero-open-path.webm` (Mobile Hero segment 2 oscillation, forward through glyph D, reverse to 0)
  - `round-5-1920x927-lifecycle.webm` (preserved lifecycle record)
  - `round-5-390x844-lifecycle.webm` (preserved mobile lifecycle record)
  - `round-5-701-to-700-resize.webm` (preserved resize record)
- Phase extract frames in `design-explorations/screenshots/glyph-trace/round-6/`:
  - `round-6-1920-hero-seg2-early.png` (scrollY 100, clean prefix, zero suffix)
  - `round-6-1920-hero-seg2-mid.png` (scrollY 260, contiguous prefix)
  - `round-6-1920-hero-seg2-late.png` (scrollY 440, approaching exit seam)
  - `round-6-1920-handoff-b.png`, `round-6-1920-hidden-c.png`, `round-6-1920-glyph-d.png`
  - `round-6-390-hero-seg2-early.png` (mobile scrollY 80, clean prefix)
  - `round-6-390-hero-seg2-mid.png` (mobile scrollY 210)
  - `round-6-390-hero-seg2-late.png` (mobile scrollY 380)
  - `round-6-390-handoff-b.png`, `round-6-390-hidden-c.png`, `round-6-390-glyph-d.png`
- Static visual evidence matrix in `design-explorations/screenshots/glyph-trace/` (15 frames) preserved and re-verified.

## Remaining risks & boundaries

- **Motion review gate**: Round 6 recordings prove no wrapped dash suffix occurs during forward/reverse motion or resize. Final sign-off requires user/architect video review.
- **Center Aperture**: Kept strictly empty for a future procedural Three.js sculpture; no Three.js or WebGL added.
- **Identity**: Identity strictly preserved as `HerokeyVN`.
- **Public facts**: All facts sourced from `src/data/portfolio.ts`; no invented facts or metrics.
- **Git Boundaries**: Changes committed locally only; no push or deploy. Unrelated user changes (`pnpm-lock.yaml`) preserved.
