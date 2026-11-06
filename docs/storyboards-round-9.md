# Storyboards — Round 9: Meaningful Project Visual Storytelling Through the Red Thread

Date: 2026-11-07. Branch: `feat/project-thread-motifs`. Authority: Key's REDESIGN brief
(2026-11-07 02:26) + the research below. This document is the design authority for the
round-9 implementation. No SVG path is authored before its storyboard state is defined here.

## Standing decisions

- **Screenshot conflict, resolved.** On 2026-11-06 Key decided to remove all project
  screenshots. The round-9 brief explicitly overrides that for Sky Sheet Store: "start with
  an elegant, real product screenshot or a faithful presentation" and "do not sacrifice
  authentic product screenshots merely to showcase abstract SVG art". The new brief wins
  for Sheet Store only. E2EE and Piano stay as minimal editorial representations.
  A clean live screenshot of skysheet.store proved impractical (live Chromium cannot reach
  the site from this VM; a local mirror of the real markup renders but with API content
  partly missing), so Sheet Store uses a **faithful HTML presentation** of the browsing
  experience built from verified live-site data, not a screenshot. Say so in the handoff.
- **What is removed, not polished.** The round-8 motifs are deleted outright: E2EE knot
  centrepiece, Sheet Store staff + vinyl spiral, Piano keyboard serpentine. The knot idea
  survives only as one small element inside the E2EE story (the Signal seal), in a new
  composition and a new role — it is not the motif any more.
- **Concept 03 is kept.** Near-black background, warm off-white type, red thread accent,
  minimal supporting colors, editorial composition, existing layout (title, purpose, one
  strong visual, tech, link). No Three.js. No new dependencies.
- **One shared progress value per project.** All animation states in a project derive from
  one scrubbed proxy `p` (GSAP ScrollTrigger, scrub, ease none, reversible). The thread,
  the message/envelope states, the key highlights and the playhead all read the same `p`.
- **Reduced motion:** every visual fully drawn / final state, static. Decorative SVG
  `aria-hidden`. No crucial information depends on animation; all copy stays in HTML.
- **Honesty labels.** Anything illustrative (not a literal screenshot of the real app) is
  labelled as such in the visual itself, in small mono type.

---

## Research grounding (condensed — full reports in the round-9 task handoff)

### FB-Messenger-E2EE — repo `HerokeyVN/FB-Messenger-E2EE`, v0.1.8, HEAD 446b6af

- **Purpose.** A TypeScript/Bun developer toolkit (not a chat app) that lets a Node/Bun
  program send and receive end-to-end encrypted Facebook Messenger messages. Handles
  device registration, persistent cryptographic state, Signal sessions, prekeys, sender
  keys, encrypted media, binary transport over a Noise websocket.
- **Workflow.** `new FBClient(...)` → `connect()` (auth bootstrap) →
  `connectE2EE("./device-store.json", userId)` (load/create DeviceStore, register device
  via ICDC if new, Noise handshake, prekey sync) → `sendMessage({ threadId, text })`.
  DM: discover recipient devices, fetch prekey bundle, establish a Signal session per
  device (X3DH), Signal-encrypt the payload separately per device (`msg`/`pkmsg`), wrap
  in WA-binary, send over the Noise socket. Group: encrypt once with the group sender
  key (`skmsg`), distribute the Sender Key Distribution Message (SKDM) per device, each
  SKDM itself Signal-encrypted. Receive: Noise frame decrypt → WA-binary → Signal
  decrypt → protobuf decode → `e2ee_message` event with decrypted `text`.
- **Thread role.** The message journey, changing state at each documented layer: loose
  plaintext at Device A → knotted/sealed by Signal → travelling inside a Noise sleeve →
  relay server that only ever holds the sealed thread → unknots at Device B, readable.
- **Must NOT misrepresent.** Signal (X3DH, Double Ratchet, sender keys) is the E2E
  encryption; Noise (`Noise_XX_25519_AESGCM_SHA256`, AES-256-GCM) is ONLY the transport
  between client and Meta's server — never imply Noise alone gives E2E. The server
  terminates Noise to route frames but the Signal ciphertext stays sealed until the
  recipient device decrypts it. No plaintext fallback. Groups are not "one encryption
  for everyone" (one `skmsg` + per-device SKDM). Device identity is persistent
  (`device-store.json`); first contact needs a prekey bundle/session. Do not show a
  verified-certificate moment (`verifyCertChain` is a TODO placeholder). Do not invent
  purposes for `franking` / `trace` / `phash` fields. The repo has no UI, so any
  "user typing" scene is an illustrative stand-in for a developer calling
  `sendMessage`, not a screenshot of the project; label it so.

### Sky Sheet Store — live site https://skysheet.store/ (public pages only; source private)

- **Purpose.** "A web-based community archive and practice application designed for
  players of Sky: Children of the Light. Musicians and transcribers can publish sheet
  arrangements, while players can preview, transpose, and practice songs directly inside
  their web browser." Headline: "Play, Share, and Learn Sky Music Sheets". Independent
  community project by HerokeyVN (contributor Darki9900), not affiliated with
  thatgamecompany. Homepage stats snapshot 2026-11-06: 17K sheets, 29 creators, 7.5K
  downloads, 5.0 rating.
- **Workflow.** Homepage (nav Browse / Library / Requests, search, hero, stats) → browse
  "New Releases" / "Trending Sheets" / "Top Rated" grids or Popular Tags, filter by
  difficulty (Easy, Normal, Hard, Insane), category, instrument → sheet card (cover
  tile: gradient + faint staff grid + floating notes, language badge, duration chip;
  title, artist, "transcribed by", uploader, stars, difficulty pill, tag pills, stat
  line BPM / note count / downloads / "Free") → sheet detail page (big title,
  artist/transcriber, difficulty + language pills, large cover panel with central play
  button, right rail: Open Player, Uploaded by, Download, Share Sheet, Favorite, Report;
  stats strip BPM / Duration / Note Count / Notes/Sec / Unique Keys / Chord Count) →
  in-browser player (play/pause, scrubbable progress, speed 0.25x–2.0x without pitch
  distortion, transpose −12 to +12, key-label toggles 1–15 / solfège / key indexes,
  real-time note timeline, authentic samples for 23 Sky instruments) → Practice Mode
  (step-by-step guided highlighting: playback waits for the user to press the correct
  target key on the interactive 15-key grid before advancing).
- **Verified example sheet (use this one).** "Tìm Em", artist Hngle Ft. Bảo Anh,
  transcribed by DTomi, 292 BPM, 684 notes, 41 downloads, duration 3:51, Notes/Sec 2.96,
  Unique Keys 15/15, Chord Count 89, Chord Ratio 16.5%, Max/Avg Chord 4/1.3. URL
  https://skysheet.store/sheets/c76e4b10-6fbe-451e-9f51-75ba072c9349.
- **Thread role.** The journey of one sheet: enters on its cover tile in the browsing
  grid → pulls the visitor into the sheet detail page → becomes the melody line in the
  player, running along the note timeline and touching each highlighted key on the
  15-key grid as Practice Mode waits for the correct press.
- **Must NOT misrepresent.** Practice Mode is browser-based on a 15-key grid, not the
  in-game instrument. The player UI was verified from the site's own help text, not a
  rendered player screenshot — do not invent its exact layout/colors/timeline design
  beyond what the guides state. Show "Free" only on the specific verified example card,
  not as a product claim. Do not claim all 23 instruments were seen/heard (About page
  claim; 11 named). Cover art varies (generated gradient tiles vs custom uploads). Stats
  are a 2026-11-06 snapshot and will drift. Do not present the site as official.
- **Reference screenshots** (renders of a local mirror of the live site's real
  markup/CSS; API content partly missing, hero photo not loaded — faithful for
  structure and card design, not clean enough to embed):
  `~/workspace/portfolio-check/research/skysheet-home-desktop-1440.png`,
  `skysheet-home-cards-1440.png`, `skysheet-home-full-1440.png`,
  `skysheet-sheet-desktop-1440.png`, `skysheet-home-mobile-390.png`,
  `skysheet-sheet-mobile-390.png`.

### Sky Auto Piano — repo `HerokeyVN/Sky-Auto-Piano`, v1.3.13, HEAD 1b37f5d

- **Purpose.** Electron desktop auto-player (Windows x64) for Sky: Children of the
  Light. Import a music sheet, pick it from a library, press Play (or global shortcut),
  and the app sends the corresponding keyboard presses to the Sky game window so the
  in-game instrument plays the song by itself. Sheet-to-keystroke player, not a
  music-making tool. Library (search, favorites, playlists, recent plays, Store tab
  browsing skysheet.store) plus a sheet editor.
- **Workflow.** Import a file (`.json, .txt, .skysheet, .mid, .midi`) → `SheetCodec.parse()`
  normalises to `songNotes: [{time, key: "1KeyN", hold?}]` (JSON, ABC text, or MIDI
  mapped onto Sky's 15 notes; limits 20,000 notes, 15 min, keys 0–14, BPM default 120)
  → each `1KeyN` maps to one of 15 fixed PC keys (`y u i o p` / `h j k l ;` /
  `n m , . /`) grouped into a keyMap: timestamp → keys pressed together (chords) →
  Play sends the keyMap to the main process; Lite engine (default) sleeps between
  timestamps and calls `sendKey`; Strict engine builds a press/release timeline on a
  song clock scaled by speed; both drive `keysender` synthetic keys to the window
  titled "Sky". Footer shows song name, progress slider (updated once per second via
  `process-bar`), live/total time, speed, long-press toggle, loop.
- **Thread role.** The playback timeline / playhead: the thread runs along the progress
  bar advancing second by second, and continues as the line connecting the editor's
  timestamp columns in order; equivalently, the key-mapping line from sheet note
  (`1KeyN`) to PC key to the highlighted key on the 3×5 keyboard.
- **Must NOT misrepresent.** There is NO piano-roll view in the real app (main player
  has only a progress slider; the editor has a timestamp-column dot grid, 15 dots per
  column, with a 3×5 keyboard below). Any piano-roll visual is **illustrative only**
  and must be labelled as a demonstration. Sustained notes work only with Long-press
  mode ON (default OFF): press lasts `hold − 35 ms` (min 25 ms); with it OFF every
  note is a short tap. Speed is a 0.1×–5× time-scaling multiplier (default 1×); it does
  not change pitch and is not a tempo/BPM rewrite. The app plays no audio and reads no
  game state; it sends synthetic keystrokes and cannot know whether a note sounded. The
  15 keys are fixed (default layout above); do not show a full piano keyboard or WASD.
  No real app screenshots exist in the repo (only the app icon). `autoplay.js` at the
  repo root is a legacy standalone script, not the shipped app. Whether the Sky window
  must be focused is unverified — claim neither.

---

## Storyboard 1 — FB-Messenger-E2EE: The Journey of an Encrypted Message

Thread role: the message itself, changing state at each documented layer.
Stage: 900×560 desktop, 560×560 mobile (stacked). One scrubbed path; all states from
one proxy `p`. Small mono captions carry the honest labels.

**State 1 — Initial (p ≈ 0). "A message is typed."**
Composition: left third, a minimal device outline (phone) labelled "Device A" with a
small readable message bubble beside it showing the text `Hello`. Under it, in mono
type, the real call: `sendMessage({ threadId, text: "Hello" })`. The rest of the stage
is empty dark space with faint, unlit outlines of what is to come (relay, Device B)
at very low opacity, so the journey's geography is legible from the start. Thread:
a short loose line resting at the bubble, head dot visible. Caption (illustrative
label, always visible): "Illustrative interface — the toolkit has no chat UI."
Meaning: the plaintext the user typed, before any cryptography.

**State 2 — Mid (p ≈ 0.5). "Sealed, then sleeved."**
Composition: the thread has left Device A and entered the centre encryption zone.
Two visibly different treatments, side by side, with labels:
(a) **Signal seal** — the thread coils into a tight knot *inside a sealed-envelope
outline* (dim guide). The envelope carries no readable text: the sealed state IS the
representation (no fake cipher symbols, no binary rain). Label under it:
"Signal Protocol — end-to-end encryption · sealed per device".
(b) **Noise sleeve** — the knotted thread exits the envelope into a horizontal tube
(a rounded sleeve outline, dim guide) that carries it across the stage. Label:
"Noise — transport only · AES-256-GCM". Inside the sleeve the thread is already
sealed; the sleeve adds a second layer, it does not re-encrypt the message.
Between the two, a small relay marker (server rack outline) sits on the sleeve with
the label "Relay — sees only the sealed message". The relay never touches an open
thread. Scrub mapping: 0–0.25 thread leaves A; 0.25–0.55 knot forms inside the
envelope; 0.55–0.85 thread travels the sleeve past the relay; 0.85–1 unknots at B.
Meaning: Signal and Noise are different layers with different jobs, and the server
is a relay, not a reader.

**State 3 — Final (p = 1). "Readable at the destination."**
Composition: right third, a second minimal device outline labelled "Device B" with
the same readable bubble `Hello` beside it. The thread has unknotted (straightened)
as it left the sleeve and ends at the bubble; the bubble fades in readable exactly
when the thread arrives. A small mono note under Device B: `e2ee_message → text:
"Hello"` (the documented receive event). The envelope is left behind in the centre,
sealed and empty. Final caption line under the stage: "End-to-end encrypted: only
the intended devices can read it." Meaning: the protected message is readable by
the intended recipient, and by nobody in the middle.

**Thread entry / exit.** Enters at Device A's bubble (left edge of the stage
interior), exits at Device B's bubble (right edge). No loose ends, no decorative
loops outside the three zones.

**Mobile.** Stacked vertically: Device A top, encryption zone middle (envelope above
sleeve, relay to the side), Device B bottom. Labels stay on one line each; the
illustrative-interface label stays visible.

---

## Storyboard 2 — Sky Sheet Store: From Music Discovery to Practice

Thread role: the journey of one sheet — grid → detail → practice.
Stage: panoramic 1440×560 desktop (keeps the full-width stage), 560×560 mobile
(stacked). The visual is a **faithful HTML presentation** (real DOM cards, not SVG
art) with the thread as an SVG overlay that travels through it. One proxy `p`;
0–0.35 browse, 0.35–0.65 detail, 0.65–1 practice.

**State 1 — Initial (p ≈ 0). "Discover."**
Composition: a browsing row of three sheet cards, faithful to the live site's card
design (verified from the research screenshots): each card a cover tile with a
gradient + faint staff grid + a few floating note marks, a language badge (e.g. VN)
top-left, a duration chip (e.g. 3:51) bottom-right; below the tile, title, artist,
"transcribed by" credit, difficulty pill, tag pills, and the stat line
(BPM · notes · downloads · Free). The featured card is the verified real sheet:
**"Tìm Em" — Hngle Ft. Bảo Anh, transcribed by DTomi, 292 BPM, 684 notes,
41 downloads, Free, Hard**. The other two cards use only data read from the research
screenshots of the live Trending Sheets grid — no invented song titles, artists, or
numbers; if a card's data cannot be read cleanly from those screenshots, show fewer
cards rather than inventing data. Above the row, a small section label in the site's
own words: "Trending Sheets". Thread: enters from the left edge and rests on the
featured card's tile; the featured card gets a subtle red outline when the thread
reaches it (selection). Meaning: this is a real community archive; the visitor is
browsing real sheets.

**State 2 — Mid (p ≈ 0.5). "Open a sheet."**
Composition: the grid crossfades/slides away and the featured sheet's detail view
takes the stage, faithful to the live detail page: large cover panel (same gradient
+ staff grid as its tile) with a central play button, big title "Tìm Em",
artist/transcriber line, difficulty + language pills, and the stats strip
(BPM 292 · Duration 3:51 · Note Count 684 · Notes/Sec 2.96 · Unique Keys 15/15 ·
Chord Count 89). Right rail: Open Player, Download, Share Sheet, Favorite (as
labelled buttons/rows, matching the live page's actions). The thread travels from
the card's position into the cover panel and wraps once around the stats strip,
then points at "Open Player". Meaning: one song, selected and ready to play; the
product, not an abstraction, is the visual focus.

**State 3 — Final (p = 1). "Practice."**
Composition: the detail view gives way to the practice view: a real-time note
timeline above a 15-key grid (Sky's instrument layout, keys indexed 0–14), with
the thread running along the timeline as the melody line and touching each
highlighted target key in turn. One target key is highlighted at a time; the thread
is the active phrase. A short original 8-note phrase is used (defined in the
implementation; each timeline note maps to the same key index highlighted on the
grid — internally consistent). Controls shown as in the help guides: speed
(0.25×–2.0×) and a "Practice Mode" label with the documented behaviour in mono
type: "Playback waits for the correct key before advancing." Meaning: the site is
for practising, in the browser, on a 15-key grid — not in the game.
Mobile: cards stack; detail shows cover + title + stats only (rail collapses to
Open Player); practice shows the timeline above a compact 15-key grid.

**Thread entry / exit.** Enters on the featured cover tile, exits at the last
highlighted practice key (bottom-right of the grid). The thread never decorates
empty space; every segment touches a real product element.

---

## Storyboard 3 — Sky Auto Piano: From Sheet Data to Automated Playback

Thread role: playback progress — the playhead, and the note→key mapping line.
Stage: 900×560 desktop, 560×560 mobile (stacked). One proxy `p`; 0–0.3 sheet input,
0.3–0.65 timeline, 0.65–1 keyboard. A small "Illustrative timeline" label is
carried on the timeline scene (see below).

**State 1 — Initial (p ≈ 0). "Sheet in."**
Composition: left side, a minimal library view: a song card (title, author) and a
file chip for the imported sheet — `song.json` with the real format badge
`.json / .txt / .skysheet / .mid / .midi` — plus a small mono snippet of the real
parsed structure: `songNotes: [{ time, key: "1KeyN", hold? }]`. An arrow of thread
leaves the file chip toward the timeline. A caption names the step: "Import →
parse → keyMap: timestamp → keys". Meaning: a sheet file becomes timed key data;
nothing is played yet. No fake audio waveform.

**State 2 — Mid (p ≈ 0.5). "The timeline."**
Composition: the centre of the stage becomes a piano-roll-inspired timeline —
horizontal time axis, note bars whose x-position is timing, length is duration,
stacked bars are simultaneous notes (a chord), and one long bar is a sustained
note. A short original 8-note sequence is used (defined in the implementation),
with exactly one chord (two bars starting together) and exactly one sustained note
(a long bar). The thread is the vertical playhead line travelling left → right
across the timeline; as it passes each bar's start, that bar lights red. Label,
always visible on this scene: "Illustrative timeline — the app shows a progress
slider and an editor dot grid, not a piano roll." A mono caption under the
timeline: `1Key3 → H · 1Key7 → L` (the real note→key mapping, two examples).
Meaning: timing, duration, simultaneity and sustain are all visible in one
structure, and the thread is time itself.

**State 3 — Final (p = 1). "Keys play themselves."**
Composition: the bottom of the stage holds the real 3×5 keyboard from the app's
editor — rows `Y U I O P` / `H J K L ;` / `N M , . /` — with keys lighting red as
the playhead passes their notes; sustained notes stay lit for their full duration
(long bar = long lit key) and the short taps flash briefly. Above the keyboard, the
footer strip from the real app: song name, a progress slider filling left to
right in sync with the same `p`, live/total time, speed `1.0×`, and the
"Long-press mode" toggle shown ON with the caption "Long-press mode on — sustained
notes hold". The thread ends at the last lit key. Meaning: sheet data has become
timed keyboard actions; the app sends keys, it does not play audio or listen to
the game.
Mobile: file chip on top, timeline middle, keyboard bottom, compact; the
illustrative-timeline label stays visible.

**Thread entry / exit.** Enters at the file chip (left), becomes the playhead
across the timeline, exits at the last lit key (keyboard, bottom-right). The
playhead, the bar lighting, the key lighting and the footer slider all derive
from the same `p` — they cannot drift apart.

---

## Cross-project continuity

- The site thread (hero → glyphs → sections) is untouched; each project stage is
  entered by the site thread in the gutter and the motif thread begins inside the
  stage. The three project visuals share the same stage chrome (border, background
  `#060608`, mono labels, red accent) so they read as one portfolio, but their
  internal layouts differ (device journey / product grid / timeline + keyboard).
- No spirals, no sine waves, no orbits, no zigzag arpeggios, no atomic orbitals.
  Every curve in the new visuals is a path between two meaningful objects.
- Captions use only verified facts. Any number shown (292 BPM, 684 notes, 1.0×,
  0.25×–2.0×, 15 keys) comes from the research above.

## QA states to capture (per project, desktop 1440×900 and mobile 390×844)

`motif4-<slug>-initial.png`, `motif4-<slug>-mid.png`, `motif4-<slug>-final.png`
(+ `-mobile` variants). Initial ≈ State 1, mid ≈ State 2, final ≈ State 3.
Review each against: does it explain something meaningful? Does the thread have a
clear purpose? Is the geometry non-arbitrary (every segment joins two real
objects)? Is the composition balanced? Is every label honest?
