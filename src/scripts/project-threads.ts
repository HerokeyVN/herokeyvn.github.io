import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Phase 4: GSAP ScrollTrigger scrub for the three project visuals. Key
// approved the round-11 statics (2026-11-07), so this is motion only - the
// static compositions in ProjectVisual.astro are untouched.
//
// One shared progress value p per scene, one gsap.timeline per scene, the
// ScrollTrigger on the timeline only (trigger: the project article, start
// "top 80%", end "bottom 45%", scrub 1, ease none). The timeline drives a
// single proxy tween {p: 0 -> 1}; its onUpdate calls one apply(p) per
// scene, which drives DOM states, key/bar lighting and the playhead
// together, so nothing drifts and everything is fully reversible.
// No tween is created per scroll event.
//
// Round 12: this file no longer draws the thread. The stage paths are
// one continuous thread for the whole page, and their dashes are driven
// by the site-thread system (site-thread.ts). apply(p) drives DOM
// choreography only; the DOM windows are unchanged from Phase 4, so p = 1
// still equals the approved static (minus the removed E2EE seal coil and
// Sheet Store loop, which were thread paths, not DOM).
//
// The Round 6 dash invariant and the round-8 CTM scale fix live in
// dashSetter (unchanged): strokeDasharray "<visible> <length>", offset 0,
// "none" at completion, dash scaled by the live CTM because
// vector-effect: non-scaling-stroke makes Chromium apply dashes in screen
// units. dashSetter stays exported for the site-thread system, which is
// its only caller now.
//
// p = 1 MUST equal the approved static exactly. Every animated property
// is an inline style / CSS variable whose removal restores the authored
// value, and apply() removes each override the moment its window
// completes, so at p = 1 no inline override remains and the markup + CSS
// alone render the static. Reduced motion: no ScrollTriggers, apply(1).
// No-JS default: the fully-drawn static (CSS stroke-dasharray none, lit
// classes in markup).
//
// SAFE TRANSFORM RULES: elements with an authored CSS transform are never
// GSAP-tweened on `transform`. Their animated component lives in a CSS
// variable used inside the authored transform (see --ring-scale,
// --frame-x / --frame-y, --fan-*, --detail-*, --play-scale, --sustain,
// --note-a, --led-o in ProjectVisual.astro), or is driven by opacity
// only. Elements with no authored transform (machine container, gauge
// fill, labels, dots) are driven with plain inline styles.
//
// The proxy tween is a fromTo with explicit from {p: 0}: on
// invalidateOnRefresh the start value is re-recorded from the from vars,
// not from the proxy's current value, so a refresh mid-scrub (resize,
// font settle) cannot corrupt the p mapping.
//
// Diagnostic: apply() writes the current p to the stage's
// data-thread-progress attribute, so tests can wait for a scrub position
// instead of guessing at the scrub:1 catch-up lag.
//
// Refresh: the page-level stage entrance (motion.ts, y 24) settles after
// the thread ScrollTriggers first measure, shifting trigger positions
// ~22px (round-9 lesson). Triggers are re-measured after
// document.fonts.ready plus a 1200ms settle. Tests scroll 5% past the
// trigger end to reach p = 1.

// Dash setter for one path, with the round-8 CTM scale fix and the Round 6
// invariant (in screen units). Recomputed on every call so resizes stay
// correct.
export const dashSetter = (path: SVGPathElement | SVGLineElement) => {
  const length = path.getTotalLength();
  return (progress: number) => {
    const ctm = path.getScreenCTM();
    const scale = ctm ? Math.hypot(ctm.a, ctm.b) : 1;
    const screenLength = length * scale;
    if (progress <= 0) {
      path.style.strokeDasharray = `0 ${screenLength}`;
      path.style.strokeDashoffset = "0";
      path.style.visibility = "hidden";
    } else if (progress >= 1) {
      path.style.strokeDasharray = "none";
      path.style.strokeDashoffset = "0";
      path.style.visibility = "visible";
    } else {
      path.style.strokeDasharray = `${progress * screenLength} ${screenLength}`;
      path.style.strokeDashoffset = "0";
      path.style.visibility = "visible";
    }
  };
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
// Progress of p inside the window [a, b]: 0 before, 1 after, linear in
// between (the scrub timeline itself is ease none).
const win = (p: number, a: number, b: number) =>
  b <= a ? (p >= b ? 1 : 0) : clamp01((p - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type RGBA = [number, number, number, number];
const parseColor = (c: string): RGBA => {
  const s = c.trim();
  if (s.startsWith("#")) {
    const h = s.slice(1);
    const v = h.length === 3 ? h.split("").map((ch) => ch + ch).join("") : h;
    return [
      parseInt(v.slice(0, 2), 16),
      parseInt(v.slice(2, 4), 16),
      parseInt(v.slice(4, 6), 16),
      1,
    ];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1]!.split(",").map((x) => Number(x.trim()));
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts.length > 3 ? parts[3]! : 1];
  }
  return [0, 0, 0, 1];
};
const lerpColor = (a: string, b: string, t: number): string => {
  const ca = parseColor(a);
  const cb = parseColor(b);
  const r = Math.round(lerp(ca[0], cb[0], t));
  const g = Math.round(lerp(ca[1], cb[1], t));
  const b2 = Math.round(lerp(ca[2], cb[2], t));
  const al = +lerp(ca[3], cb[3], t).toFixed(3);
  return `rgba(${r}, ${g}, ${b2}, ${al})`;
};

// Inline-style helpers. Every helper removes the property once its window
// is done (done === true), so the authored CSS value shows again and p = 1
// leaves no inline override behind.
const setProp = (el: Element | null | undefined, prop: string, value: string | null) => {
  if (!el) return;
  if (value === null) (el as HTMLElement).style.removeProperty(prop);
  else (el as HTMLElement).style.setProperty(prop, value);
};
// Opacity ramp 0 -> 1 (t is the window progress).
const setOpacity = (el: Element | null | undefined, t: number) => {
  setProp(el, "opacity", t >= 1 ? null : String(clamp01(t)));
};
// CSS-variable component of an authored transform.
const setVar = (el: Element | null | undefined, name: string, value: string, done: boolean) => {
  setProp(el, name, done ? null : value);
};
// Plain transform, for elements with NO authored transform.
const setTransform = (el: Element | null | undefined, value: string, done: boolean) => {
  setProp(el, "transform", done ? null : value);
};

// --- Key lighting -------------------------------------------------------
// Piano keys keep their lit classes in the markup; apply() overrides the
// authored values with inline styles until the press/hold window
// completes, then removes them so the class values show (and STAY).
const KEY_UNLIT_TOP = "#1c1c20";
const KEY_UNLIT_BOTTOM = "#0c0c0f";
const KEY_UNLIT_COLOR = "#b0ada7"; // --text-secondary
const KEY_UNLIT_SHADOW =
  "inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 -4px 0 rgba(0, 0, 0, 0.45)";
const H_PRESSED_BG: [string, string] = ["#b3250f", "#8f1d0a"];
const H_PRESSED_SHADOW =
  "inset 0 6px 10px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08)";
const L_HELD_BG: [string, string] = ["#ff5a38", "#e8320f"];
const L_HELD_SHADOW =
  "inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 0 0 2px rgba(255, 60, 26, 0.35), 0 6px 20px rgba(255, 60, 26, 0.4)";

const pressKey = (
  key: HTMLElement | null | undefined,
  t: number,
  bg: [string, string],
  shadow: string,
  sink: boolean,
) => {
  if (!key) return;
  if (t >= 1) {
    ["transform", "background", "border-color", "color", "box-shadow"].forEach((prop) =>
      key.style.removeProperty(prop),
    );
    return;
  }
  if (sink) key.style.transform = `translateY(${(6 * t).toFixed(2)}px)`;
  key.style.background = `linear-gradient(180deg, ${lerpColor(KEY_UNLIT_TOP, bg[0], t)}, ${lerpColor(KEY_UNLIT_BOTTOM, bg[1], t)})`;
  key.style.borderColor = lerpColor("rgba(239, 237, 230, 0.16)", "#ff3c1a", t);
  key.style.color = lerpColor(KEY_UNLIT_COLOR, "#ffffff", t);
  key.style.boxShadow = t >= 0.5 ? shadow : KEY_UNLIT_SHADOW;
};

// Sheet Store key 14: same pattern, unlit -> .is-lit values.
const lightSheetKey = (key: HTMLElement | null | undefined, t: number) => {
  if (!key) return;
  if (t >= 1) {
    ["background", "border-color", "border-bottom-color", "color", "box-shadow"].forEach(
      (prop) => key.style.removeProperty(prop),
    );
    return;
  }
  key.style.background = lerpColor("#141416", "#ff3c1a", t);
  key.style.borderColor = lerpColor("rgba(241, 238, 230, 0.16)", "#ff3c1a", t);
  key.style.borderBottomColor = lerpColor("#000000", "#7f1d0d", t);
  key.style.color = lerpColor("#95938c", "#ffffff", t);
  key.style.boxShadow = `inset 0 1px 0 rgba(255, 255, 255, ${lerp(0.08, 0.35, t).toFixed(3)}), 0 2px 8px rgba(255, 60, 26, ${lerp(0, 0.35, t).toFixed(3)})`;
};

// --- Scene builders -----------------------------------------------------
// Each builder closes over its elements and returns apply(p). p = 0 states
// keep every descendant inside the stage box (offsets are small and inward
// of the stage edges); p = 1 removes every override.

const buildE2EE = (stage: HTMLElement) => {
  const q = <T extends Element>(sel: string) => stage.querySelector<T>(sel);
  const frames = [1, 2, 3, 4].map((i) => q<HTMLElement>(`[data-el="e2ee-frame-${i}"]`));
  const core = q<HTMLElement>('[data-el="e2ee-core"]');
  const plateBack = stage.querySelector<HTMLElement>(".e2ee-plate--back");
  const plateMid = stage.querySelector<HTMLElement>(".e2ee-plate--mid");
  const plateFront = stage.querySelector<HTMLElement>(".e2ee-plate--front");
  const ring = stage.querySelector<HTMLElement>(".e2ee-seal-ring");
  const message = stage.querySelector<HTMLElement>(".e2ee-core-message");
  const relay = q<HTMLElement>('[data-el="e2ee-relay"]');
  const readLetters = [...stage.querySelectorAll<HTMLElement>(".e2ee-letter--read")];
  const fragA = [...stage.querySelectorAll<HTMLElement>(".e2ee-letter--frag-a")];
  const fragB = [...stage.querySelectorAll<HTMLElement>(".e2ee-letter--frag-b")];
  const fig = q<HTMLElement>('[data-el="e2ee-fig"]');
  const noise = q<HTMLElement>('[data-el="e2ee-noise-label"]');
  const signal = q<HTMLElement>('[data-el="e2ee-signal-label"]');
  const relayLabel = q<HTMLElement>('[data-el="e2ee-relay-label"]');

  return (p: number) => {
    const mobile = window.innerWidth <= 700;
    // Frames converge (start offset outward ~10px x, opacity 0.55) p 0.05-0.45.
    const tFrames = win(p, 0.05, 0.45);
    const deltas = mobile ? [-8, -4, 8, 0] : [-10, -5, 5, 10];
    frames.forEach((frame, i) => {
      const off = lerp(deltas[i] ?? 0, 0, tFrames);
      if (mobile) setVar(frame, "--frame-y", `${off.toFixed(2)}px`, tFrames >= 1);
      else setVar(frame, "--frame-x", `${off.toFixed(2)}px`, tFrames >= 1);
      setOpacity(frame, lerp(0.55, 1, tFrames));
    });
    // Core plates assemble (opacity stagger + core scale 0.96 -> 1) p 0.45-0.65.
    const tCore = win(p, 0.45, 0.65);
    setTransform(core, `scale(${lerp(0.96, 1, tCore).toFixed(3)})`, tCore >= 1);
    setOpacity(plateBack, lerp(0.35, 1, win(p, 0.45, 0.55)));
    setOpacity(plateMid, lerp(0.35, 1, win(p, 0.5, 0.6)));
    setOpacity(plateFront, lerp(0.35, 1, win(p, 0.55, 0.65)));
    // Seal ring scales in p 0.55-0.75; core HELLO resolves dim -> solid
    // p 0.5-0.75; relay LED pulses as the thread passes the relay region
    // p 0.55-0.7.
    const tRing = win(p, 0.55, 0.75);
    setVar(ring, "--ring-scale", tRing.toFixed(3), tRing >= 1);
    setOpacity(message, lerp(0.25, 1, win(p, 0.5, 0.75)));
    const tLed = win(p, 0.55, 0.7);
    setVar(relay, "--led-o", lerp(0.15, 1, tLed).toFixed(3), tLed >= 1);
    // Background HELLO letters brighten toward their authored opacities
    // p 0.3-0.7.
    const tLetters = win(p, 0.3, 0.7);
    readLetters.forEach((el) => setOpacity(el, lerp(0.3, 0.62, tLetters)));
    fragA.forEach((el) => setOpacity(el, lerp(0.12, 0.5, tLetters)));
    fragB.forEach((el) => setOpacity(el, lerp(0.18, 0.65, tLetters)));
    // Labels staggered: FIG early, NOISE ~0.25, SIGNAL ~0.6, RELAY ~0.7.
    setOpacity(fig, win(p, 0, 0.1));
    setOpacity(noise, win(p, 0.2, 0.3));
    setOpacity(signal, win(p, 0.55, 0.65));
    setOpacity(relayLabel, win(p, 0.65, 0.75));
  };
};

const buildSheet = (stage: HTMLElement) => {
  const q = <T extends Element>(sel: string) => stage.querySelector<T>(sel);
  const fan = [0, 1, 2].map((i) => stage.querySelector<HTMLElement>(`.sheet-card--fan-${i}`));
  const deck = q<HTMLElement>('[data-el="sheet-deck"]');
  const detail = q<HTMLElement>('[data-el="sheet-detail"]');
  const play = stage.querySelector<HTMLElement>(".sheet-detail__play");
  const noteGroups = [...stage.querySelectorAll<SVGSVGElement>(".sheet-bg-svg")].map((svg) => [
    ...svg.querySelectorAll<SVGEllipseElement>(".sheet-note-head"),
  ]);
  const practice = q<HTMLElement>('[data-el="sheet-practice"]');
  const gridKeys = [...stage.querySelectorAll<HTMLElement>(".sheet-key")];
  const key14 = stage.querySelector<HTMLElement>('[data-key="14"]');
  const fig = q<HTMLElement>('[data-el="sheet-fig"]');
  const trending = q<HTMLElement>('[data-el="sheet-trending-label"]');
  const dataLabel = q<HTMLElement>('[data-el="sheet-data-label"]');

  return (p: number) => {
    const mobile = window.innerWidth <= 700;
    // Fan cards fan out (rotation 0 -> authored, scale 0.99/0.98 ->
    // authored, y +10 -> 0) p 0.05-0.4; mobile deck tabs fade in with it.
    const tFan = win(p, 0.05, 0.4);
    const rotTargets = mobile ? [0, 0, 0] : [-2, 1, -5];
    fan.forEach((card, i) => {
      setVar(card, "--fan-y", `${lerp(10, 0, tFan).toFixed(2)}px`, tFan >= 1);
      setVar(card, "--fan-rot", `${lerp(0, rotTargets[i] ?? 0, tFan).toFixed(2)}deg`, tFan >= 1);
    });
    setVar(fan[1], "--fan-scale", lerp(0.99, 0.97, tFan).toFixed(3), tFan >= 1);
    setVar(fan[2], "--fan-scale", lerp(0.98, 0.94, tFan).toFixed(3), tFan >= 1);
    setOpacity(deck, tFan);
    // Detail panel settles (y +8 -> 0, opacity 0.7 -> 1, rotate 0 ->
    // -2deg) p 0.15-0.4; play button scales 0.7 -> 1 p 0.3-0.4.
    const tDetail = win(p, 0.15, 0.4);
    setVar(detail, "--detail-y", `${lerp(8, 0, tDetail).toFixed(2)}px`, tDetail >= 1);
    setVar(detail, "--detail-rot", `${lerp(0, mobile ? 0 : -2, tDetail).toFixed(2)}deg`, tDetail >= 1);
    setOpacity(detail, lerp(0.7, 1, tDetail));
    const tPlay = win(p, 0.3, 0.4);
    setVar(play, "--play-scale", lerp(0.7, 1, tPlay).toFixed(3), tPlay >= 1);
    // Each note head flashes (fill alpha 0.35 -> 0.95 -> 0.35) as the
    // melody passes it p 0.32-0.62; the final red note is untouched.
    noteGroups.forEach((heads) => {
      heads.forEach((head, i) => {
        if (head.classList.contains("sheet-note-head--final")) return;
        const c = 0.32 + (i / 7) * 0.3;
        const a = 0.35 + 0.6 * Math.max(0, 1 - Math.abs(p - c) / 0.035);
        setProp(head, "--note-a", a <= 0.351 ? null : a.toFixed(3));
      });
    });
    // Practice strip fades in p 0.6-0.7, grid keys stagger in p 0.62-0.72.
    setOpacity(practice, win(p, 0.6, 0.7));
    gridKeys.forEach((key, idx) => {
      const s = 0.62 + (idx / 14) * 0.06;
      setOpacity(key, win(p, s, s + 0.04));
    });
    // Key 14 lights p 0.78-0.86 and STAYS lit (class values take over).
    lightSheetKey(key14, win(p, 0.78, 0.86));
    // Labels staggered: FIG early, TRENDING ~0.15, DATA ~0.9.
    setOpacity(fig, win(p, 0, 0.1));
    setOpacity(trending, win(p, 0.1, 0.2));
    setOpacity(dataLabel, win(p, 0.85, 0.95));
  };
};

const buildPiano = (stage: HTMLElement) => {
  const q = <T extends Element>(sel: string) => stage.querySelector<T>(sel);
  const machine = q<HTMLElement>('[data-el="piano-machine"]');
  const tiers = [0, 1, 2].map((i) => stage.querySelector<HTMLElement>(`.piano-tier--${i}`));
  const hKey = stage.querySelector<HTMLElement>('[data-pkey="H"]');
  const lKey = stage.querySelector<HTMLElement>('[data-pkey="L"]');
  const bridge = q<HTMLElement>('[data-el="piano-bridge"]');
  const gaugeFill = stage.querySelector<HTMLElement>(".piano-gauge__fill");
  const railLeft = q<HTMLElement>('[data-el="piano-rail-left"]');
  const railRight = q<HTMLElement>('[data-el="piano-rail-right"]');
  const giantRows = [...stage.querySelectorAll<HTMLElement>(".piano-giant__row")];
  const fig = q<HTMLElement>('[data-el="piano-fig"]');
  const mapping = q<HTMLElement>('[data-el="piano-mapping"]');
  const speed = q<HTMLElement>('[data-el="piano-speed-label"]');
  const song = q<HTMLElement>('[data-el="piano-song-label"]');
  const lp = q<HTMLElement>('[data-el="piano-lp-label"]');
  const plate = q<HTMLElement>('[data-el="piano-plate"]');

  return (p: number) => {
    // Machine container settles into place p 0-0.25. Desktop: from above
    // (y -14 -> 0). The spec's +14 rise from below cannot be used: at
    // p = 0 it pushes the back tier down onto the belt (topTier clearance
    // 0, needs >= 10). Mobile: a scale 0.97 -> 1 settle, NO vertical
    // travel. The mobile front tier sits in a ~30px slot between the
    // belt's mid-tier run above and the exit below (only 11px clearance
    // at the bottom), so any vertical shift beyond ~3px breaks the 8px
    // clearance floor: +14 overlaps the exit, -14 puts the tier top 6.4px
    // from the belt's right-end curve. The scale shrinks the tier box
    // ~1.3px per side instead, keeping every clearance >= 9.7px.
    const mobile = window.innerWidth <= 700;
    const tMachine = win(p, 0, 0.25);
    if (mobile) {
      setTransform(machine, `scale(${lerp(0.97, 1, tMachine).toFixed(3)})`, tMachine >= 1);
    } else {
      setTransform(machine, `translateY(${lerp(-14, 0, tMachine).toFixed(2)}px)`, tMachine >= 1);
    }
    setOpacity(tiers[0], lerp(0.5, 1, win(p, 0.05, 0.15)));
    setOpacity(tiers[1], lerp(0.5, 1, win(p, 0.15, 0.25)));
    setOpacity(tiers[2], lerp(0.5, 1, win(p, 0.25, 0.35)));
    // H presses as the belt dips p 0.22-0.32 and STAYS pressed; L
    // presses + holds p 0.62-0.72.
    pressKey(hKey, win(p, 0.22, 0.32), H_PRESSED_BG, H_PRESSED_SHADOW, true);
    pressKey(lKey, win(p, 0.62, 0.72), L_HELD_BG, L_HELD_SHADOW, false);
    // Sustain bar grows via --sustain p 0.68-0.85.
    const tSustain = win(p, 0.68, 0.85);
    setVar(lKey, "--sustain", tSustain.toFixed(3), tSustain >= 1);
    // Bridge settles (y -4 -> 0, opacity) p 0.35-0.45.
    const tBridge = win(p, 0.35, 0.45);
    setTransform(bridge, `translateY(${lerp(-4, 0, tBridge).toFixed(2)}px)`, tBridge >= 1);
    setOpacity(bridge, lerp(0.5, 1, tBridge));
    // Gauge fill width 0% -> 88% p 0.15-0.95 (the ::after playhead dot
    // rides the fill end).
    const tGauge = win(p, 0.15, 0.95);
    setProp(gaugeFill, "width", tGauge >= 1 ? null : `${(88 * tGauge).toFixed(2)}%`);
    // Rails fade in p 0-0.15; giant letter rows fade in staggered p 0-0.3.
    setOpacity(railLeft, win(p, 0, 0.15));
    setOpacity(railRight, win(p, 0, 0.15));
    giantRows.forEach((row, i) => setOpacity(row, win(p, i * 0.1, i * 0.1 + 0.1)));
    // Labels staggered: FIG early, mapping ~0.65, speed ~0.75,
    // song ~0.85, LP ~0.9, plate ~0.8.
    setOpacity(fig, win(p, 0, 0.1));
    setOpacity(mapping, win(p, 0.6, 0.7));
    setOpacity(speed, win(p, 0.7, 0.8));
    setOpacity(song, win(p, 0.8, 0.9));
    setOpacity(lp, win(p, 0.85, 0.95));
    setOpacity(plate, win(p, 0.75, 0.85));
  };
};

interface Scene {
  slug: string;
  stage: HTMLElement;
  article: HTMLElement;
  apply: (p: number) => void;
}

export function initProjectThreads() {
  if (typeof window === "undefined") return () => undefined;
  gsap.registerPlugin(ScrollTrigger);

  const builders: Record<string, (stage: HTMLElement) => (p: number) => void> = {
    "fb-messenger-e2ee": buildE2EE,
    "sky-sheet-store": buildSheet,
    "sky-auto-piano": buildPiano,
  };
  const scenes: Scene[] = [];
  for (const stage of [...document.querySelectorAll<HTMLElement>("[data-project-thread-stage]")]) {
    const slug = stage.dataset.projectSlug ?? "";
    const build = builders[slug];
    const article = stage.closest<HTMLElement>("article[data-project]");
    if (!build || !article) continue;
    scenes.push({ slug, stage, article, apply: build(stage) });
  }
  if (scenes.length === 0) return () => undefined;

  const applyScene = (scene: Scene, p: number) => {
    scene.stage.dataset.threadProgress = p.toFixed(3);
    scene.apply(p);
  };

  // Reduced motion: no ScrollTriggers, render the final state. The
  // existing test "project visuals render their complete static
  // composition without scrolling" emulates this and must keep passing.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    scenes.forEach((scene) => applyScene(scene, 1));
    return () => undefined;
  }

  const timelines: gsap.core.Timeline[] = [];
  for (const scene of scenes) {
    const proxy = { p: 0 };
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: scene.article,
        start: "top 80%",
        end: "bottom 45%",
        scrub: 1,
        invalidateOnRefresh: true,
        onRefresh: () => applyScene(scene, proxy.p),
      },
    });
    tl.fromTo(
      proxy,
      { p: 0 },
      {
        p: 1,
        duration: 1,
        ease: "none",
        onUpdate: () => applyScene(scene, proxy.p),
      },
    );
    applyScene(scene, 0);
    timelines.push(tl);
  }

  // The page-level stage entrance (motion.ts, y 24) settles after the
  // thread ScrollTriggers first measure, shifting trigger positions ~22px
  // (round-9 lesson). Re-measure once fonts are in and the entrance has
  // settled. Tests scroll 5% past the trigger end to reach p = 1.
  document.fonts.ready.then(() => {
    window.setTimeout(() => ScrollTrigger.refresh(), 1200);
  });

  return () => {
    timelines.forEach((tl) => {
      tl.scrollTrigger?.kill();
      tl.kill();
    });
  };
}
