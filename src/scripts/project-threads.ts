import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Scroll-driven storytelling for the three per-project visuals (round 9).
// Each project has ONE shared proxy value `p` (GSAP ScrollTrigger, scrub,
// ease none, reversible). A single apply(p) per project drives the thread
// dash, the DOM scene states, the key/bar lighting and the playhead, so
// they cannot drift apart. The thread dash keeps the Round 6 open-path
// invariant (strokeDasharray "<visible> <length>", offset 0, "none" at
// completion) and the round-8 dash-scale fix (the dash is scaled by the live
// CTM, because vector-effect: non-scaling-stroke makes Chromium apply the
// dash pattern in screen units).

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ramp = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

// Normalized path distance (0-1) of the point on `path` closest to (x, y).
const fractionAtPoint = (path: SVGPathElement, x: number, y: number, samples = 400) => {
  const length = path.getTotalLength();
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= samples; i++) {
    const pt = path.getPointAtLength((length * i) / samples);
    const dist = Math.hypot(pt.x - x, pt.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = i / samples;
    }
  }
  return best;
};

type Boundary = { time: number; x: number; y: number };

// Path-fraction boundaries per motif: at scrub time `time` the draw must
// have reached the authored point (x, y). The E2EE knot loop returns to its
// start point, so its boundaries use unambiguous early/late loop points,
// never the shared start/end point (round-8 lesson).
const MOTIFS: Record<string, { desktop: Boundary[]; mobile: Boundary[] }> = {
  "fb-messenger-e2ee": {
    desktop: [
      { time: 0.25, x: 423, y: 226 },
      { time: 0.55, x: 409, y: 294 },
      { time: 0.85, x: 760, y: 260 },
    ],
    mobile: [
      { time: 0.25, x: 236, y: 206 },
      { time: 0.55, x: 225, y: 264 },
      { time: 0.85, x: 280, y: 428 },
    ],
  },
  // Sheet Store uses three per-scene thread paths (browse / detail /
  // practice) with independent dash + opacity instead of one path with
  // boundaries, so no boundary spec is needed for it.
  "sky-sheet-store": { desktop: [], mobile: [] },
  "sky-auto-piano": { desktop: [], mobile: [] },
};

// Sheet Store practice phrase keys (mirrors SHEET_PHRASE in
// ProjectVisual.astro): the 8 notes' grid keys in time order.
const SHEET_PHRASE_KEYS = [0, 2, 4, 7, 9, 11, 12, 14];

const setOpacity = (el: Element | null, value: number) => {
  if (el instanceof HTMLElement) el.style.opacity = String(value);
};

export function initProjectThreads() {
  if (typeof window === "undefined") return () => undefined;
  gsap.registerPlugin(ScrollTrigger);
  const media = gsap.matchMedia();

  media.add(
    {
      desktop: "(min-width: 701px)",
      mobile: "(max-width: 700px)",
      reduceMotion: "(prefers-reduced-motion: reduce)",
    },
    (context) => {
      const { desktop, reduceMotion } = context.conditions as { desktop: boolean; reduceMotion: boolean };
      const variant = desktop ? "desktop" : "mobile";
      const timelines: gsap.core.Timeline[] = [];

      const stages = [...document.querySelectorAll<HTMLElement>("[data-project-thread-stage]")];
      stages.forEach((stage) => {
        const svg = stage.querySelector<SVGSVGElement>(`svg[data-variant="${variant}"]`);
        if (!svg) return;
        const slug = svg.dataset.projectThread || "";
        const article = stage.closest<HTMLElement>("article[data-project]");
        if (!article) return;
        const el = (name: string) => stage.querySelector<HTMLElement>(`[data-el="${name}"]`);

        // Dash setter for one path, with the round-8 CTM scale fix and the
        // Round 6 invariant (in screen units). Recomputed on every call so
        // resizes and the stage entrance transform stay correct.
        const dashSetter = (path: SVGPathElement | SVGLineElement) => {
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

        // Piecewise scrub-time -> path-fraction mapping for one main path.
        const boundaryProgress = (path: SVGPathElement) => {
          const spec = MOTIFS[slug]?.[variant] ?? [];
          const marks = spec.map((b) => ({ time: b.time, at: fractionAtPoint(path, b.x, b.y) }));
          marks.push({ time: 1, at: 1 });
          return (p: number) => {
            let prev = { time: 0, at: 0 };
            for (const mark of marks) {
              if (p <= mark.time) {
                const t = mark.time === prev.time ? 1 : (p - prev.time) / (mark.time - prev.time);
                return prev.at + (mark.at - prev.at) * t;
              }
              prev = mark;
            }
            return 1;
          };
        };

        let apply: (p: number) => void;

        if (slug === "fb-messenger-e2ee") {
          const path = svg.querySelector<SVGPathElement>(".project-thread-path");
          if (!path) return;
          const setDash = dashSetter(path);
          const progress = boundaryProgress(path);
          apply = (p: number) => {
            setDash(progress(p));
            setOpacity(el("e2ee-label-b"), 0.15 + 0.85 * ramp(p, 0.85, 1));
            setOpacity(el("e2ee-bubble-b"), ramp(p, 0.85, 0.97));
            setOpacity(el("e2ee-mono-b"), ramp(p, 0.9, 1));
            setOpacity(el("e2ee-signal-label"), 0.4 + 0.6 * ramp(p, 0.25, 0.55));
            setOpacity(el("e2ee-noise-label"), 0.4 + 0.6 * ramp(p, 0.55, 0.85));
            setOpacity(el("e2ee-relay-label"), 0.25 + 0.75 * ramp(p, 0.55, 0.85));
            setOpacity(el("e2ee-final-caption"), ramp(p, 0.85, 1));
          };
        } else if (slug === "sky-sheet-store") {
          // Three per-scene thread paths, not one continuous path: each
          // fades with its scene, so at p = 1 only the practice melody is
          // visible (a single path would leave the detail loop floating as
          // an empty rectangle once the stats it circled have faded out).
          // Each path draws linearly within its own scrub segment.
          const browsePath = svg.querySelector<SVGPathElement>('[data-thread="browse"]');
          const detailPath = svg.querySelector<SVGPathElement>('[data-thread="detail"]');
          const practicePath = svg.querySelector<SVGPathElement>('[data-thread="practice"]');
          if (!browsePath || !detailPath || !practicePath) return;
          const setBrowseDash = dashSetter(browsePath);
          const setDetailDash = dashSetter(detailPath);
          const setPracticeDash = dashSetter(practicePath);
          const setPathOpacity = (path: SVGPathElement, value: number) => {
            path.style.opacity = String(value);
          };
          const dots = [...svg.querySelectorAll<SVGCircleElement>("[data-note]")];
          const keys = [...stage.querySelectorAll<HTMLElement>("[data-key]")];
          apply = (p: number) => {
            setBrowseDash(clamp01(p / 0.35));
            setDetailDash(clamp01((p - 0.35) / 0.3));
            setPracticeDash(clamp01((p - 0.65) / 0.35));
            setPathOpacity(browsePath, 1 - ramp(p, 0.35, 0.42));
            setPathOpacity(detailPath, ramp(p, 0.35, 0.5) * (1 - ramp(p, 0.65, 0.8)));
            setPathOpacity(practicePath, ramp(p, 0.65, 0.8));
            setOpacity(stage.querySelector('[data-scene="sheet-browse"]'), 1 - ramp(p, 0.35, 0.42));
            setOpacity(
              stage.querySelector('[data-scene="sheet-detail"]'),
              ramp(p, 0.35, 0.5) * (1 - ramp(p, 0.65, 0.8)),
            );
            setOpacity(stage.querySelector('[data-scene="sheet-practice"]'), ramp(p, 0.65, 0.8));
            setOpacity(el("sheet-featured-outline"), ramp(p, 0.05, 0.3) * (1 - ramp(p, 0.35, 0.42)));
            // Practice: one target key highlighted at a time; timeline dots
            // light as the thread passes them and stay lit.
            const note = p < 0.65 ? -1 : Math.min(7, Math.floor(((p - 0.65) / 0.35) * 8));
            // The timeline dots belong to the practice scene: keep them
            // hidden until the practice view fades in (same 0.65-0.8 ramp
            // as the practice path), so their hollow outlines never sit on
            // the browse cards or the detail stats - at mid scrub a dot
            // sat on the "2.96" stat value.
            const dotOpacity = ramp(p, 0.65, 0.8);
            dots.forEach((dot, i) => {
              dot.classList.toggle("is-lit", p >= 0.65 + (i / 7) * 0.35);
              dot.style.opacity = String(dotOpacity);
            });
            keys.forEach((key) => {
              key.classList.toggle("is-lit", note >= 0 && Number(key.dataset.key) === SHEET_PHRASE_KEYS[note]);
            });
          };
        } else if (slug === "sky-auto-piano") {
          const entry = svg.querySelector<SVGPathElement>('[data-thread="entry"]');
          const exit = svg.querySelector<SVGPathElement>('[data-thread="exit"]');
          const playhead = svg.querySelector<SVGLineElement>('[data-thread="playhead"]');
          if (!entry || !exit || !playhead) return;
          const setEntry = dashSetter(entry);
          const setExit = dashSetter(exit);
          const bars = [...stage.querySelectorAll<HTMLElement>("[data-bar]")].map((bar) => ({
            el: bar,
            start: Number(bar.dataset.start || 0),
            end: Number(bar.dataset.end || 0),
            pkey: bar.dataset.pkey || "",
          }));
          const total = Number(stage.dataset.total || 12);
          const pianoKeys = [...stage.querySelectorAll<HTMLElement>("[data-pkey]")].filter(
            (key) => key.classList.contains("piano-key"),
          );
          // Playhead geometry per variant (viewBox coords).
          const x0 = desktop ? 60 : 30;
          const x1 = desktop ? 840 : 530;
          const sliderFill = el("piano-slider-fill");
          const liveTime = el("piano-live-time");
          let lastTime = "";
          const formatTime = (seconds: number) => {
            const s = Math.floor(seconds);
            return `0:${String(s).padStart(2, "0")}`;
          };
          apply = (p: number) => {
            // One song time for the whole project: the sequence plays once
            // across the timeline and keyboard phases (p 0.3-1). Bars,
            // keys, playhead, slider and live time all read it.
            const songT = clamp01((p - 0.3) / 0.7) * total;
            setEntry(ramp(p, 0, 0.3));
            setExit(ramp(p, 0.65, 0.9125));
            const headX = x0 + (songT / total) * (x1 - x0);
            playhead.setAttribute("x1", String(headX));
            playhead.setAttribute("x2", String(headX));
            playhead.style.visibility = p >= 0.3 ? "visible" : "hidden";
            playhead.style.opacity = String(ramp(p, 0.3, 0.35));
            setOpacity(stage.querySelector('[data-scene="piano-library"]'), 1 - 0.65 * ramp(p, 0.3, 0.45));
            setOpacity(stage.querySelector('[data-scene="piano-timeline"]'), 0.25 + 0.75 * ramp(p, 0.3, 0.45));
            setOpacity(stage.querySelector('[data-scene="piano-keyboard"]'), 0.25 + 0.75 * ramp(p, 0.55, 0.7));
            // The song only plays once the timeline phase begins (p > 0.3);
            // in the library phase (p <= 0.3) no bar or key is lit, even
            // though songT is 0 and the first note starts at 0.0s.
            const playing = p > 0.3;
            bars.forEach((bar) => bar.el.classList.toggle("is-lit", playing && songT >= bar.start));
            pianoKeys.forEach((key) => {
              const lit =
                playing &&
                bars.some(
                  (bar) => bar.pkey === key.dataset.pkey && songT >= bar.start && songT <= bar.end,
                );
              key.classList.toggle("is-lit", lit);
            });
            if (sliderFill) sliderFill.style.width = `${(songT / total) * 100}%`;
            const text = formatTime(songT);
            if (liveTime && text !== lastTime) {
              liveTime.textContent = text;
              lastTime = text;
            }
          };
        } else {
          return;
        }

        if (reduceMotion) {
          apply(1);
          return;
        }

        apply(0);
        const proxy = { p: 0 };
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          onUpdate: () => apply(proxy.p),
          scrollTrigger: {
            trigger: article,
            start: "top 80%",
            end: "bottom 45%",
            scrub: 1,
          },
        });
        tl.to(proxy, { p: 1, duration: 1 }, 0);
        timelines.push(tl);
      });

      document.fonts.ready.then(() => ScrollTrigger.refresh());

      return () => {
        timelines.forEach((tl) => {
          tl.scrollTrigger?.kill();
          tl.kill();
        });
      };
    },
  );

  return () => media.revert();
}
