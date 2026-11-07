# Art Direction — Round 10: Cinematic Kinetic Art Installations

Date: 2026-11-07. Branch: `feat/project-thread-motifs`. Authority: Key's round-10
brief (2026-11-07 10:32) + this document. Scope of THIS task: Phases 1-3 only
(research, static art direction, visual refinement). Phase 4 (GSAP motion) comes
only after Key approves these static compositions. No scroll animation is wired
in this round: every scene renders its complete final state statically.

## Standing decisions

- **Round 9 is superseded as art direction, not as research.** The round-9
  literal product showcase (phone outlines, JSON panels, piano roll, workflow
  diagrams) is explicitly banned by the round-10 brief and is removed outright.
  The round-9 VERIFIED facts still stand and must not be contradicted:
  `docs/storyboards-round-9.md` remains the fact authority (Signal vs Noise
  roles, Piano key mappings, Sheet Store card/detail data). No invented
  features, metrics, or technical claims.
- **Concept 03 is kept.** Near-black background, warm off-white type, one red
  accent, minimal supporting colors, editorial composition, existing layout
  (title, purpose, one strong visual, tech, link). No Three.js, no WebGL, no
  excessive blur or glow. No new dependencies.
- **Static first.** Each scene is a complete static composition at desktop
  resolution. It must look exceptional in a still screenshot; motion (Phase 4)
  enhances it later, it never compensates for it.
- **Layer model (all three scenes).** Every scene is built from the same five
  layers, in this z-order:
  1. `bg` — giant display typography + faint line-art + gradient wash
     (opacity 0.08-0.30, "fog" depth).
  2. `mid` — translucent structural panels in CSS 3D perspective
     (opacity ~0.6, `translateZ` steps).
  3. `thread-back` — the red thread SVG layer that passes BEHIND foreground
     structures.
  4. `fg` — the primary focal structure, full opacity.
  5. `thread-front` — the red thread SVG layer that passes IN FRONT of
     background/mid structures.
  6. `labels` — Piergorelli-style mono spec annotations (`FIG. 0X · ...`),
     always on top, small, honest (they describe the artwork or verified
     facts, never fake specs).
- **Thread discipline.** One continuous red filament per scene, fully drawn in
  the static state, with a small number of deliberate interactions (enter,
  pass behind/in front of one structure, touch one focal element, exit). Never
  a random scribble, never forced through every object. It enters at the
  stage's left edge (desktop) and exits at the right edge, so the page-level
  site thread stays continuous through Projects. Mobile: entry top, exit
  bottom.
- **Thread occlusion is real.** The thread is split across two SVG overlays
  (back / front) at different z-indexes, so it genuinely disappears behind a
  foreground panel and re-emerges — not a fake dashed gap.
- **Fog-as-depth (from daoism, translated to 2.5D).** Background line-art at
  25-30% opacity, mid layers near 60%, foreground at 100%. No WebGL, no blur.
- **Split thread layers (from daksh).** Per daksh: one thread layer behind the
  display title, one in front of body copy. Adopted as thread-back /
  thread-front above.
- **Motif-as-story-order (from daksh).** Each project composes thin-line SVG
  artifacts arranged in narrative order; the thread visits them in that order.
  Adopted: E2EE readable → sealed → readable; Sheet Store archive → selected
  sheet → practice; Piano input → mechanism → lit keys.
- **Tilted micro-cards (from daksh).** Small mono-labeled cards at 2-4 degree
  rotations overlapping a giant title's lower edge, giving 2.5D depth with
  pure CSS transforms. Adopted in Sheet Store (fanned cards) and Piano
  (machine plate).
- **Self-annotating spec labels (from piergorelli).** Tiny mono annotations at
  the margins (`FIG. 01`, measurements, honest labels) that make each project
  feel engineered. Adopted in all three scenes.
- **One-accent-contour-among-grey (from piergorelli).** Thin parallel guide
  lines in white 0.12-0.20; exactly one line is the accent red — the "live"
  filament. Adopted: every scene carries 2-4 faint grey filaments; only the
  red thread is live.
- **Clip-path wipes + lerped scroll (from daoism / piergorelli).** NOTED for
  Phase 4 motion only. Not implemented in this round.
- **Reduced motion / accessibility.** The static composition IS the reduced-
  motion state. All copy stays in HTML; decorative SVG is `aria-hidden`;
  links functional; no crucial information depends on animation.
- **Stage chrome unchanged.** `.project-thread-stage` keeps `aspect-ratio`
  900/560 (Sheet Store panoramic 1440/560, mobile 1/1), `container-type:
  inline-size`, cqw units, background `#060608`, border
  `var(--border-subtle)`. DOM scenes are positioned in % and scale with the
  stage exactly like the SVG viewBox.
- **What is removed, not polished.** Round-9 scenes are deleted outright:
  E2EE phone outlines + bubbles, Sheet Store browse/detail/practice scene
  crossfade, Piano library card + JSON snippet + piano-roll timeline + footer
  slider. The verified DATA survives (card contents, key mappings, "Hello",
  stats, speeds); the literal UI survives only where the brief allows it
  (Sheet Store cards as fanned archive artifacts, Piano keys as machine
  tiers, E2EE "Hello" as fragmented typography).

## Reference techniques adopted (Phase 1 summary)

Studied via headless-Chromium mirror renders + fetched page text (screenshots
in `~/workspace/portfolio-check/references/`; the live browser was not used).
Daksh rendered fully; Piergorelli rendered fully; Daoism's loader reached 99
("CREATING THE SCENE") but never completed under headless SwiftShader, so its
findings combine loader captures + DOM/code inspection + fetched text. No
artwork was cloned. Full per-site report in the round-10 task handoff.

- dakshgajjar.com: giant title as mid-layer with thin-line SVG art behind it
  and tilted cards overlapping its lower edge; extreme negative space; one
  focal element per screen; mono corner labels; one accent (#FF3B12) on a
  two-tone field; thread as per-section absolute SVGs with split z-index.
- daoism.systems: real 3D (banned here) translated to 2.5D fog layering and
  staged-loader thinking; Lenis lerped scroll noted for Phase 4.
- piergorelli.com: blueprint layering (hairline rules, graph-paper grids,
  contour lines, one blue contour among grey); self-annotating mono spec
  labels; clip-path inset wipes; calm one-section-per-screen pacing.

Cross-site pattern: exactly one accent color on a two-tone field, and motion
kept cheap (SVG / GSAP / clip-path) except daoism's WebGL outlier.

---

## Scene 1 — FB-Messenger-E2EE: Encrypted Transmission

**Focal point.** A sealed core at centre-right: a stack of 3 offset
translucent glass plates, the red filament weaving between them and coiling
once inside the core (a compact seal — 2-3 crossings, NOT an orbital).

**Silhouette.** A horizontal corridor of 4 receding rectangular frames: wide
at the left, narrowing to the centre, opening again at the right. The thread
enters left, passes through the frames, exits right.

**Layers.**
- `bg`: giant Syne 800 "HELLO" split into 5 letter spans with different
  opacity/clip — letters 1-2 readable (0.5), letters 3-4 fragmented and
  clipped (0.15, one rotated 8deg, one clip-path inset), letter 5 readable
  again (0.5). The readable → protected → readable transformation, told by
  typography. Plus a faint dot grid (white 0.05).
- `mid`: 4 translucent frames in a perspective wrapper (`perspective:
  1100px`, `rotateY(-8deg)`, `translateZ` steps 0/-60/-120/-180px), borders
  1px white 0.14, fills white 0.02-0.04. Two thin grey filaments (white
  0.12) run parallel to the thread as "dead" lines.
- `fg`: the sealed core (3 plates, offsets 0/10/20px, glass
  `rgba(18,18,21,0.7)`, border-highlight on the front plate) + the filament
  coil inside it + a small relay plate (slotted, like round 9's rack) sitting
  on the corridor floor, labelled so it reads as a relay, not a reader.
- `labels`: "FIG. 01 · CIPHER LAYERS" (top-left), "SIGNAL — X3DH · DOUBLE
  RATCHET · SENDER KEYS" (under the core), "NOISE — TRANSPORT ONLY ·
  AES-256-GCM" (above the corridor, right), "RELAY — SEES ONLY THE SEALED
  MESSAGE" (under the relay plate).

**Thread.** Enters left edge (0, 280), runs through the frames (behind frame
2 via thread-back, in front of frame 3 via thread-front), coils once inside
the core, exits right edge (900, 280). End dot at the exit. Exactly one
coil; no other loops.

**Negative space.** Top-right and bottom-left kept empty except micro-labels.
The corridor occupies the middle band (y 30-75%).

**Mobile (560x560).** Vertical corridor: frames stack top-to-bottom, "HELLO"
letters stack in two rows, core centre, thread top → bottom. Secondary
labels hidden if they collide; "FIG. 01" and the Signal/Noise labels stay.

**Facts used.** Signal (X3DH, Double Ratchet, sender keys) = E2E encryption;
Noise (`Noise_XX_25519_AESGCM_SHA256`, AES-256-GCM) = transport only; the
server terminates Noise to route frames but the Signal ciphertext stays
sealed until the recipient device decrypts it; "Hello" is the round-9
example message. Nothing else is claimed.

---

## Scene 2 — Sky Sheet Store: Living Music Archive

**Focal point.** A fanned deck of 3 verified sheet cards at centre-left,
rotated -4deg / 0deg / +4deg in a perspective wrapper, the front card the
verified "Tìm Em" card, the two behind it receding (smaller, partially
occluded, fogged to 60% by a translucent overlay, not by opacity on white).

**Silhouette.** A diagonal cascade: cards fan from top-left to bottom-right
like a dealt hand; a tilted detail sheet floats front-right; a 15-key
practice strip anchors the bottom. The eye travels the cascade.

**Layers.**
- `bg`: giant outlined Syne "SHEETS" as a VERTICAL spine down the left
  gutter (writing-mode vertical-rl, upright letters, 3.5cqw, stroke white
  0.25) - the horizontal version was hidden behind the fan and the detail
  panel, so the spine is the visible form. 5 faint staff lines spanning
  the stage (white 0.12), 8 note heads on the staff at the round-9 phrase
  positions (keys [0,2,4,7,9,11,12,14] mapped to staff height, white
  0.35, small).
- `mid`: the fanned cards (real card design from the live site, verified in
  round 9: gradient cover tile + faint staff grid + floating notes + VN
  badge + duration chip + title/artist/transcriber + difficulty pill +
  stats). Card 2 "truoc khi em ton tai" (520 BPM · 345 notes · 47
  downloads), card 3 "luu nien" (750 BPM · 953 notes · 42 downloads ·
  Insane). A second grey filament runs behind the fan.
- `fg`: the selected-sheet panel front-right (tilted -2deg): cover with play
  button, title "Tìm Em", artist/transcriber line, pills, stats strip (292
  BPM / 3:51 / 684 notes / 2.96 / 15/15 / 89), Open Player button. Below it,
  the practice strip: 15-key grid (keys 0-14), key 14 lit red, melody line
  above it. The practice strip is a machine plate, not a screenshot.
- `labels`: "FIG. 02 · LIVING ARCHIVE" (top-left), "TRENDING SHEETS"
  (above the fan), "PRACTICE MODE — WAITS FOR THE CORRECT KEY" (above the
  grid), "DATA 2026-11-06" (honesty micro-label, bottom-right).

**Thread.** Enters left edge on the featured tile, threads the fan (behind
the middle card via thread-back, in front of the back card via
thread-front), becomes the melody line through the 8 staff note heads,
descends to the lit key 14, exits right edge at the grid. Every segment
touches a real product element; no decoration in empty space.

**Negative space.** Top-right corner (above the detail panel) and the gap
between fan and detail panel are kept clear; the staff lines breathe there.

**Mobile (560x560).** Vertical cascade: cards stack top-to-bottom (fan
becomes a vertical deck, front card full width), detail panel below, practice
strip bottom; thread top → bottom; staff lines stay; the "SHEETS" spine
stays on the left gutter at 3.2cqw.

**Facts used.** All card/detail data from round-9 verification (live site
2026-11-06). "Free" only on the verified example card. Practice Mode is
browser-based on a 15-key grid, not in-game. Speed 0.25x-2.0x. Stats are a
2026-11-06 snapshot (labelled). The site is an independent community
project, not official — no official claim is made anywhere.

---

## Scene 3 — Sky Auto Piano: Kinetic Playback Machine

**Focal point.** A terraced key machine — 3 tiers of 5 key blocks in a
perspective wrapper (`rotateX(18deg)`), forming a ziggurat: back tier
(Y U I O P) highest and smallest, mid tier (H J K L ;) middle, front tier
(N M , . /) lowest and widest. Key blocks have a lighter top face and a
darker front face (gradient + border, no blur). H is pressed (translated
down 6px, red-lit); L is held (red-lit, full height). These are the only
two verified note→key mappings (`1Key3 → H`, `1Key7 → L`).

**Silhouette.** A stepped pyramid, wider at the bottom, centred slightly
right; negative space top-left holds the giant type.

**Layers.**
- `bg`: giant key-letter field "YUIOP / HJKL; / NM,./" in Syne 800,
  clipped by a mask (`clip-path: inset(0 55% 0 0)` on the left block and a
  second block right, both opacity 0.08), plus fine horizontal rules (white
  0.06) and one large faint circle behind the machine (thin stroke white
  0.08, the "cylinder" hint).
- `mid`: machine side rails — vertical columns of small repeated rectangles
  (the frame) on the left and right edges, white 0.14 borders, 3 columns of
  6 modules each; a thin red progress hairline gauge at the bottom (88%
  fill) as a machine gauge, labelled "song.json · 0:10 / 0:12 · 1.0× ·
  LONG-PRESS ON".
- `fg`: the terraced tiers + the drive belt (thread) + a small tilted
  machine plate (2deg) carrying the honesty label: "ILLUSTRATIVE MECHANISM
  — THE APP SENDS KEYSTROKES; IT PLAYS NO AUDIO".
- `labels`: "FIG. 03 · PLAYBACK MACHINE" (top-left), "1Key3 → H · 1Key7 →
  L" (above the mid tier), "SPEED 1.0× · 0.1×–5×" (right rail),
  "LONG-PRESS ON — SUSTAINED NOTES HOLD" (under the gauge).

**Thread.** Enters left edge, runs along the back tier like a drive belt,
dips down to press H, runs to L (held), exits right edge at the front tier.
It passes behind the mid tier (thread-back) and in front of the front tier
(thread-front). A red head dot sits on the belt at L.

**Negative space.** Top-left (giant type field) and bottom-left (rails only)
stay quiet; the machine occupies centre-right.

**Mobile (560x560).** Tiers stack vertically with reduced perspective
(rotateX 8deg); keys stay 3 rows of 5 but smaller; rails collapse to one
column; belt simplified to a vertical run down the right side; thread top →
bottom.

**Facts used.** 15 fixed PC keys in 3 rows of 5 (verified rows); only the
two verified mappings are shown; sustained notes hold only with Long-press
mode ON (default OFF) — the gauge shows it ON, labelled; speed is a
0.1x-5x time-scaling multiplier (default 1x), not pitch; the app plays no
audio and reads no game state; the mechanism is illustrative, labelled as
such — it is NOT the app's internal architecture. No piano roll, no JSON
panel, no timeline.

---

## Responsive strategy (all scenes)

- Breakpoint 700px (shared with the rest of the site). Desktop: horizontal
  compositions in the 900x560 / 1440x560 viewBoxes. Mobile: 1/1 stage, the
  same layers stacked vertically in story order, perspective reduced
  (smaller rotate/translateZ), background type kept but smaller, secondary
  mono labels hidden only when they would collide (never the FIG. label or
  the honesty label).
- The thread has a separate authored mobile SVG variant per scene (as in
  rounds 8-9), running top → bottom.
- cqw units throughout so DOM layers scale with the stage exactly like the
  SVG viewBox.

## Phase 4 hooks (NOT implemented in this round)

- Every layer carries `data-layer="bg|mid|fg|thread-back|thread-front|
  labels"`; every thread path keeps a `data-thread` name; focal structures
  carry `data-el` hooks. `src/scripts/project-threads.ts` is a static
  final-state renderer in this round; it keeps the CTM-scaled dash helper
  (`dashSetter`) and the Round 6 dash invariant so Phase 4 can re-attach
  GSAP ScrollTrigger scrub to the same paths and layer hooks.
- Intended Phase 4 motion (one structural transformation per scene, all
  reversible, scrub, ease none, one shared progress value per scene):
  - E2EE: frames converge around the core while the "HELLO" letters
    fragment, then the composition opens to the readable letter.
  - Sheet Store: the fan separates (cards drift apart along their
    translateZ) and re-stacks as the thread travels tile → detail → grid.
  - Piano: tiers rise into position, H/L press in rhythm, the belt advances
    with the playhead.
- Phase 4 must re-verify: thread clearance (no crossing of in-stage text),
  mobile legibility, and the full suite. It must NOT reintroduce the banned
  literal UI (phones, JSON, piano roll).

## QA states to capture (per project, desktop 1440x900 and mobile 390x844)

`motif5-<slug>-static.png` (+ `-mobile` variants) plus detail crops where a
layer needs a closer look. Review each against the brief's quality bar:
convincing spatial layering; sufficient organized detail; immediately
recognizable focal point; specifically designed for the project; deliberate
typography/geometry/spacing/color; the project's general character readable
without dense labels; all three feel like one portfolio.
