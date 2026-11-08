# Round 12 - Project Scene Anchor Contract

For the integration agent: the stage `thread-back` / `thread-front` SVGs are
the rendering layers for the ONE continuous site thread. The per-project
timelines and `ThreadPlan`s are gone (`src/scripts/project-threads.ts` now
drives DOM choreography only; the thread dashes are driven by the
site-thread system in `site-thread.ts`). This file lists every remaining
`.project-thread-path` element per scene and variant, in travel order, with
its role, so the site thread can chain them into one continuous path.

All coordinates are stage viewBox coordinates. Map a viewBox point to page
coordinates via the stage element's bounding rect (`[data-project-thread-stage]`,
`[data-project-slug="<slug>"]`) and the SVG's CTM: the stage keeps the
viewBox aspect exactly (`aspect-ratio: 900 / 560`, panoramic `1440 / 560`),
so `pageX = rect.left + (vx / vbW) * rect.width` and
`pageY = rect.top + (vy / vbH) * rect.height`. Selectors below are relative
to the stage element.

Travel order across the whole page is the DOM order of the stages
(E2EE -> Sheet Store -> Piano), and inside a stage it is: back paths and
front paths interleaved by the travel sequence given per scene. The thread
enters each stage at its entry point and exits at its exit point; between
stages the site thread runs down the right edge (see the site-thread
contract for the inter-stage route).

Geometry was measured live 2026-11-08 (Playwright, reduced motion,
preview server) and verified analytically (exact cubic curvature, ink
strike tests). Waypoint boxes are element bounding boxes in viewBox
coordinates.

## 1. fb-messenger-e2ee - Encrypted Transmission

Story shape: message path A -> relay -> B. The thread enters left, passes
in front of frame 1, behind frame 2, in front of frame 3, behind frame 4,
runs straight through the sealed core under the HELLO message, and exits
right. No knot anywhere: the round-11 Lissajous seal coil is deleted
entirely (see "Removed" below).

### Desktop - viewBox `0 0 900 560`

| # | Layer | Selector | `d` | Role |
|---|-------|----------|-----|------|
| 1 | thread-front | `svg[data-layer="thread-front"][data-variant="desktop"] .project-thread-path:nth-child(1)` | `M 0 280 C 36 280, 72 272, 108 280 C 144 288, 180 280, 216 280` | entry, in front of frame 1 |
| 2 | thread-back | `svg[data-layer="thread-back"][data-variant="desktop"] .project-thread-path:nth-child(1)` | `M 216 280 L 351 280` | behind frame 2 |
| 3 | thread-front | `... thread-front ... :nth-child(2)` | `M 351 280 C 387 280, 423 288, 459 280 C 495 272, 540 280, 576 280` | in front of frame 3 |
| 4 | thread-back | `... thread-back ... :nth-child(2)` | `M 576 280 L 714 280` | behind frame 4, into the core |
| 5 | thread-front | `... thread-front ... :nth-child(3)` | `M 714 280 C 734 280, 742 304, 764 304 L 856 304 C 872 304, 886 280, 900 280` | straight through the sealed core (shallow G1 dip under HELLO), exit |
| - | thread-front | `.project-thread-dot--end` | `cx=896 cy=280 r=4` | end dot |

- Entry point: `(0, 280)`. Exit point: `(900, 280)`.
- Waypoints: frame 1 x 18-171, frame 2 x 216-351, frame 3 x 414-549,
  frame 4 x 576-711 (all centred on y=280). Sealed core x 683.1-844.5,
  y 168.7-391.3. Seal ring centre `(763.8, 280)`, radius ~27.4. HELLO
  message centre `(763.8, 280)`; ink x 675.2-850.2, y 270-290. Relay box
  x 468-576, y 459.2-515.2, centre `(522, 487.2)`.
- The through-path (row 5): descent from `(714, 280)` to a flat at y=304,
  flat to x=856, rise back to y=280 at `(900, 280)`. Joints G1 (0 deg),
  start/end tangents 0 deg, analytic min radius 12.3 (at the rise end).
  The flat clears the message ink bottom (290) by 14 and crosses the seal
  ring's lower arcs. Deliberate exception: the entry point `(714, 280)`
  sits mid-E, so the descent contacts E's lower-left strokes for ~25
  viewBox units (94/603 canvas samples at R=1, all confined to x 700-740);
  H, L, L, O are untouched. A straight y=280 line would strike all five
  letters (92/201 samples) and was rejected.
- Round-12 integration fix: the two front wave segments (rows 1 and 3)
  were single cubics whose end tangents ran at ~6deg to the straight back
  segments (front0 -> back0 6.3deg, back0 -> front1 6.1deg, front1 -> back1
  6.1deg). A single cubic cannot wave with horizontal end tangents (both
  control-point y values would have to equal 280, collapsing it to a
  straight line), so each wave is now TWO cubics with horizontal end
  tangents and a G1 mid joint (12.5deg both sides). Shape preserved:
  front-1 rises then falls, front-3 falls then rises, amplitude ~3px,
  same as before.

### Mobile - viewBox `0 0 560 560`

| # | Layer | Selector | `d` | Role |
|---|-------|----------|-----|------|
| 1 | thread-front | `svg[data-layer="thread-front"][data-variant="mobile"] .project-thread-path:nth-child(1)` | `M 280 0 L 280 280` | entry top, in front of frame 1 |
| 2 | thread-back | `svg[data-layer="thread-back"][data-variant="mobile"] .project-thread-path:nth-child(1)` | `M 280 280 L 280 336` | behind frame 2 |
| 3 | thread-front | `... thread-front ... :nth-child(2)` | `M 280 336 L 280 440 C 280 462, 348 448, 348 472 L 348 500 C 348 520, 280 514, 280 534` | jog right around the sealed message, back to the centre line |
| 4 | thread-front | `... thread-front ... :nth-child(3)` | `M 280 534 L 280 560` | exit bottom |
| - | thread-front | `.project-thread-dot--end` | `cx=280 cy=556 r=4` | end dot |

- Entry point: `(280, 0)`. Exit point: `(280, 560)`.
- Waypoints: frame 1 y 202-257.7, frame 2 y 280-335.7, frame 3 y 357.9-413.6
  (all x 168.6-391.4); frame 4 is `display: none` on mobile. Sealed core
  x 168.6-391.4, y 424.8-513.9. Seal ring centre `(280, 469.3)`, radius
  37.85. HELLO ink x 223.2-333.9, y 463-475.6. Jog rightmost x=348.
- The jog (row 3): joints G1, start/end tangents vertical (90 deg),
  analytic min radius 8.1. Zero ink strikes at R=1 and R=2 (a straight
  x=280 line grazes the middle L's stem: 5 strikes at R=1). The message is
  wider than the ring, so no vertical through-ring route can avoid the
  ink; the jog is the mobile analogue of the desktop dip.

### Removed (E2EE)

- `knotPath` helper, `E2EE_COIL`, the `[motif] E2EE seal coil crossings`
  console.log, the coil path in `E2EE_FRONT_D` (was index 2,
  `data-el="e2ee-seal"`), and the mobile S-coil in
  `E2EE_FRONT_D_MOBILE` (was index 1, `data-el="e2ee-seal"`). The seal
  ring (`.e2ee-seal-ring`) stays; it is not a thread path.

## 2. sky-sheet-store - Living Music Archive

Story shape: fan -> play button -> staff notes -> key 14, one line. The
thread enters left across the fan top to the play button, dives behind the
detail panel as one clean connector to the melody start, runs the melody
through the 8 staff note heads, descends to key 14, and exits right. No
loop anywhere: the round-11 looped back path is deleted (see "Removed"
below). There was no literal vinyl spiral in the code - the round-8
spiral was deleted in round 9; the looped back path was the tangle.

### Desktop - viewBox `0 0 1440 560` (panoramic stage)

| # | Layer | Selector | `d` | Role |
|---|-------|----------|-----|------|
| 1 | thread-front | `svg[data-layer="thread-front"][data-variant="desktop"] .project-thread-path:nth-child(1)` | `M 0 68 L 878 68 C 1000 68, 1232 66, 1192 104` | entry across the fan top to the play button |
| 2 | thread-back | `svg[data-layer="thread-back"][data-variant="desktop"] .project-thread-path:nth-child(1)` | `M 1192 104 C 916.5 365.8, 878.3 366.7, 850 395 C 786.4 458.6, 776.1 398.4, 806 396` | connector: play-button area down to melody start (note 0) |
| 3 | thread-front | `... thread-front ... :nth-child(2)` | `M 806 396 C 819 395, 858.1 391.8, 884.1 389.7 C 910.2 387.6, 936.3 386, 962.3 383.4 C 988.4 380.8, 1014.4 376.6, 1040.4 374 C 1066.5 371.4, 1092.6 369.8, 1118.6 367.7 C 1144.6 365.6, 1170.7 363, 1196.7 361.4 C 1222.8 359.8, 1248.9 359.9, 1274.9 358.3 C 1301 356.7, 1340 353.1, 1353 352` | melody through the 8 staff note heads (Catmull-Rom, generated) |
| 4 | thread-front | `... thread-front ... :nth-child(3)` | `M 1353 352 C 1390 349, 1385 400, 1370 440 C 1358 472, 1347 490, 1347 522` | descent to key 14 |
| 5 | thread-front | `... thread-front ... :nth-child(4)` | `M 1347 522 L 1440 522` | exit |
| - | thread-front | `.project-thread-dot--end` | `cx=1436 cy=520 r=4` | end dot |

- Entry point: `(0, 68)`. Exit point: `(1440, 522)`.
- Waypoints: play button centre `(1169.7, 92.5)` (box 1144.9-1194.4 x
  67.7-117.2). Staff notes: `(806, 396)`, `(884.1, 389.7)`,
  `(962.3, 383.4)`, `(1040.4, 374)`, `(1118.6, 367.7)`,
  `(1196.7, 361.4)`, `(1274.9, 358.3)`, `(1353, 352)`. Staff lines
  y 352-396, x 780-1400. Key 14 centre `(1344.1, 521)`. Featured card
  (fan-0) x 585.4-883.3, y 29.6-340.7. Detail panel x 973.7-1372.2,
  y 27.8-342.4. Open Player x 996.9-1359.7, y 320.8-355.7. Detail stats
  x 993.8-1358.8, y 233.3-331.3. Practice strip top y 436.8.
- The connector (row 2) is ONE path element with two cubic segments: the
  dive from the panel to a joint at `(850, 395)` heading 135 deg, then a
  shallow scoop under the staff (bottom y 424.1) rising into note 0. Start
  tangent 136.4 deg (matches the entry's arrival), end tangent -4.6 deg
  (matches the melody's departure), joint G1 (0 deg), analytic min radius
  10.7 (scoop bottom). Clearances: featured card 24, its shadow 8.7, Open
  Player 29.4, practice strip 12.6. The connector exits the detail
  panel's left edge at ~(981, 277); the part inside the panel is hidden
  behind the opaque panel. It crosses the faint staff lines diagonally
  once while descending (x ~730-780), as the melody does.
- Why two segments, not one cubic: a single G1 cubic from the play button
  to note 0 must reverse x-direction (left from the panel, then right
  into the melody, a ~140-220 deg direction change). Grid search over
  handle lengths found every single-cubic variant collapses to a
  near-cusp at the tail (best analytic min radius 0.85 desktop). The
  two-segment form is the minimal clean connector; it is not a hook or a
  loop (no retrace at the tail; the sweep is 146 units wide with radius
  10.7, vs the old hook's 5.4).

### Mobile - viewBox `0 0 560 560`

| # | Layer | Selector | `d` | Role |
|---|-------|----------|-----|------|
| 1 | thread-front | `svg[data-layer="thread-front"][data-variant="mobile"] .project-thread-path:nth-child(1)` | `M 34 0 L 34 210 C 34 236, 58 246, 90 246 L 150 246 C 172 246, 185 258, 185 280 L 185 300` | entry down the left edge to the play button |
| 2 | thread-back | `svg[data-layer="thread-back"][data-variant="mobile"] .project-thread-path:nth-child(1)` | `M 185 300 C 185 340, 95 340, 35 340 C 15 340, 15 382.7, 56 380` | connector: play-button area down to melody start (note 0) |
| 3 | thread-front | `... thread-front ... :nth-child(2)` | `M 56 380 C 66.7 379.3, 98.7 377.1, 120 375.7 C 141.3 374.3, 162.7 373.2, 184 371.4 C 205.3 369.6, 226.7 366.8, 248 365 C 269.3 363.2, 290.7 362.1, 312 360.7 C 333.3 359.3, 354.7 357.5, 376 356.4 C 397.3 355.3, 418.7 355.4, 440 354.3 C 461.3 353.2, 493.3 350.7, 504 350` | melody through the 8 staff note heads (Catmull-Rom, generated) |
| 4 | thread-front | `... thread-front ... :nth-child(3)` | `M 504 350 C 540 348, 520 400, 520 440 C 520 470, 484 480, 484 507` | descent to key 14 |
| 5 | thread-front | `... thread-front ... :nth-child(4)` | `M 484 507 L 484 560` | exit |
| - | thread-front | `.project-thread-dot--end` | `cx=484 cy=556 r=4` | end dot |

- Entry point: `(34, 0)`. Exit point: `(484, 560)`.
- Waypoints: play button centre `(130.6, 246.6)`. Staff notes: `(56, 380)`,
  `(120, 375.7)`, `(184, 371.4)`, `(248, 365)`, `(312, 360.7)`,
  `(376, 356.4)`, `(440, 354.3)`, `(504, 350)`. Staff lines y 350-380,
  x 28-532. Key 14 centre `(483.6, 507)`. Featured card x 29.4-530.6,
  y 35-168.6. Detail strip x 29.4-530.6, y 179.7-313.4. Open Player
  x 246-513.2, y 273.3-299.1. Practice header x 29.4-144.6, y 345.7-364.8;
  speed label x 114.6-260.1, y 345.7-363.2. Practice grid top y 388.6.
- The connector (row 2) is ONE path element with two cubic segments: a
  straight dive at x=185 to y=340, a leftward run at y=340, a drop at
  x~22, and a rightward run into note 0. Start tangent 90 deg (straight
  down, matches the entry's arrival), end tangent -3.7 deg (matches the
  melody's departure, measured -3.8 deg, 0.1 deg off), joint G1 (0 deg),
  analytic min radius 11.5. Clearances: practice header 3.6 (the run at
  y=340 passes just above it), speed label 8.3, practice grid 8.5. The
  drop at x~22 runs left of the header and the staff lines, so the
  connector crosses no label text. Same single-cubic impossibility as
  desktop (grid-search best min radius 1.59).

### Removed (Sheet Store)

- Desktop back path `M 1192 104 C 1144 150, 1080 290, 960 340 C 864 380,
  800 340, 760 372 C 730 396, 768 399, 806 396` (looped hook under the
  detail panel, analytic min radius 5.4 at the hook).
- Mobile back path `M 185 300 C 185 345, 40 310, 40 355 C 40 368, 44 381,
  56 380` (same hook, min radius 11.0).
- The separate motif thread is gone with the per-project thread system
  (see section 4).

## 3. sky-auto-piano - Kinetic Playback Machine

Story shape: the belt. Entry -> H dip -> under the bridge -> L dip ->
exit (desktop); down the left edge, across the mid tier, down the right
edge (mobile). Belt paths are UNCHANGED from round 11 - verified correct,
kept exactly as authored.

### Desktop - viewBox `0 0 900 560`

| # | Layer | Selector | `d` | Role |
|---|-------|----------|-----|------|
| 1 | thread-front | `svg[data-layer="thread-front"][data-variant="desktop"] .project-thread-path:nth-child(1)` | `M 0 250 L 280 250 C 305 250, 305 284, 330 284 C 355 284, 355 250, 380 250 L 408 250` | entry + H dip |
| 2 | thread-back | `svg[data-layer="thread-back"][data-variant="desktop"] .project-thread-path:nth-child(1)` | `M 408 250 L 552 250` | under the bridge |
| 3 | thread-front | `... thread-front ... :nth-child(2)` | `M 552 250 L 622 250 C 647 250, 647 284, 672 284 C 697 284, 697 250, 722 250 L 900 250` | L dip + exit |
| - | thread-front | `.project-thread-dot--end` | `cx=896 cy=250 r=4` | end dot |

- Entry point: `(0, 250)`. Exit point: `(900, 250)`.
- Waypoints: H key centre `(349.3, 299.4)` (dip bottom y=284 under it);
  L key centre `(661.9, 292)` (dip bottom y=284 under it). Bridge span
  x 407.8-551.4, y 240.4-268.3, centre `(479.6, 254.4)`; the belt passes
  under it (thread-back) between the two dips.

### Mobile - viewBox `0 0 560 560`

| # | Layer | Selector | `d` | Role |
|---|-------|----------|-----|------|
| 1 | thread-front | `svg[data-layer="thread-front"][data-variant="mobile"] .project-thread-path:nth-child(1)` | `M 30 0 L 30 135 C 30 150, 40 163, 55 163 C 72 163, 72 191, 90 191 C 108 191, 108 163, 125 163 L 340 163 C 357 163, 357 191, 375 191 C 393 191, 393 163, 410 163 L 470 163 C 490 163, 500 173, 500 193` | down the left edge, across the mid tier (H dip, L dip) |
| 2 | thread-back | `svg[data-layer="thread-back"][data-variant="mobile"] .project-thread-path:nth-child(1)` | `M 500 193 L 500 320` | behind the front tier |
| 3 | thread-front | `... thread-front ... :nth-child(2)` | `M 500 320 L 500 560` | down the right edge, exit |
| - | thread-front | `.project-thread-dot--end` | `cx=500 cy=556 r=4` | end dot |

- Entry point: `(30, 0)`. Exit point: `(500, 560)`.
- Waypoints: H key centre `(96.2, 176.7)`; L key centre `(371.9, 167.5)`.

## 4. What changed in the thread system (for the integration agent)

- `src/scripts/project-threads.ts`: `ThreadPlan`, `svgPaths`, `svgDot`,
  and `applyThread` are deleted. `dashSetter` is KEPT and still exported
  (Round 6 invariant + round-8 CTM scale fix intact) for the site-thread
  system to use; nothing in this file calls it anymore. `apply(p)` drives
  DOM choreography only, with all DOM windows unchanged from Phase 4, so
  `p = 1` still equals the approved static except for the removed coil /
  loop. The E2EE coil window (0.44-0.68) and the Sheet back-path window
  (0.2-0.32) disappeared with the thread; the DOM windows aligned to them
  (core assembly 0.45-0.65, note flash 0.32-0.62) stay as authored.
  `data-thread-progress` is still published per stage.
- `src/components/ProjectVisual.astro`: coil/loop paths removed as listed
  above; `r1` and `melodyPath` still used; seal ring, core message, relay,
  frames, labels, fan, detail panel, practice strip, all verified facts
  untouched.
- No `.project-thread-path` element has a `data-el` marker anymore.
- Stage viewBoxes: E2EE `0 0 900 560` desktop / `0 0 560 560` mobile;
  Sheet Store `0 0 1440 560` desktop / `0 0 560 560` mobile; Piano
  `0 0 900 560` desktop / `0 0 560 560` mobile. Mobile SVGs are
  `display: none` above 700px and vice versa; the active variant is the
  one with a non-zero rendered size.

## 5. Test impacts (integration agent: these assertions need updating)

- `tests/portfolio.spec.ts` ~302-305: static test asserts the E2EE seal
  coil length > 100 via `[data-el="e2ee-seal"]`. The coil and the marker
  are gone; the test must be re-pointed at the new through-path (row 5
  above) or deleted. (Done by the integration agent: re-pointed at the
  through-path, desktop front path 3 / mobile front path 2, still > 100.)
- Same file, scrub tests (~335, ~448): comments / assertions referencing
  "E2EE seal coil undrawn" at mid scrub no longer apply. (Done: re-pointed
  at the through-path, which draws in the old coil window.)
- Geometry test: Sheet joint measurements assume the old travel order
  `front0 -> back0, back0 -> melody, melody -> descent, descent -> exit`
  with <= 2 deg tolerance. The new connector changes the `back0 -> melody`
  joint: desktop start tangent 136.4 deg (unchanged - the entry is
  untouched) and end tangent -4.6 deg (matches the melody); mobile start
  90 deg, end -3.7 deg. The per-segment min-radius floors from round 11
  (handoff 20, site-1 8, site-3 10, site-6 4, contact 20) still hold for
  the new paths except where noted: E2EE mobile jog min radius 8.1 (above
  the site-1 floor of 8), Sheet desktop connector 10.7 (above the site-3
  floor of 10), Sheet mobile connector 11.5.
- Re-measured by the integration agent (round 12): the -4.6 deg / -3.7 deg
  figures are the connector's ABSOLUTE end tangents, not the joint
  mismatch. The melody departs at the same angle (-4.6 deg desktop,
  -3.8 deg mobile), so the actual `back0 -> melody` mismatch is ~0.0 deg
  desktop / ~0.1 deg mobile, inside the 2 deg tolerance. No geometry fix
  was needed; the geometry test now asserts the mismatch directly. The
  same re-measurement caught the real defect above: the E2EE front wave
  seams were ~6 deg and are now fixed with two-cubic waves.
