import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Scroll-driven draw for the three per-project thread motifs.
// Each motif is one authored path inside its exhibit stage. The timeline
// scrubs a proxy value from 0 to 1 and the dash is applied with the
// Round 6 open-path invariant: strokeDasharray "<visible> <length>",
// offset 0, "none" at completion. No offset-shifted pattern is used.

type Boundary = { time: number; x: number; y: number };
type MotifSpec = { boundaries: Boundary[] };

const MOTIFS: Record<string, { desktop: MotifSpec; mobile: MotifSpec }> = {
  "fb-messenger-e2ee": {
    // Straight A 0-0.35, knot 0.35-0.65, straight B 0.65-1.
    desktop: { boundaries: [{ time: 0.35, x: 330, y: 280 }, { time: 0.65, x: 570, y: 280 }] },
    mobile: { boundaries: [{ time: 0.35, x: 200, y: 280 }, { time: 0.65, x: 370, y: 280 }] },
  },
  "sky-sheet-store": {
    // Sine phrase 0-0.55, spiral 0.55-0.85, straight exit 0.85-1.
    desktop: { boundaries: [{ time: 0.55, x: 958, y: 280 }, { time: 0.85, x: 996, y: 280 }] },
    mobile: { boundaries: [{ time: 0.55, x: 438, y: 280 }, { time: 0.85, x: 470, y: 280 }] },
  },
  "sky-auto-piano": {
    // Linear scrub, no part boundaries.
    desktop: { boundaries: [] },
    mobile: { boundaries: [] },
  },
};

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
        const path = svg?.querySelector<SVGPathElement>(".project-thread-path");
        if (!svg || !path) return;
        const slug = svg.dataset.projectThread || "";
        const spec = MOTIFS[slug]?.[variant] ?? { boundaries: [] };
        const article = stage.closest<HTMLElement>("article[data-project]");
        if (!article) return;

        const length = path.getTotalLength();
        const nodes = [...svg.querySelectorAll<SVGCircleElement>("[data-thread-node], [data-thread-dot]")];

        if (reduceMotion) {
          gsap.set(path, { strokeDasharray: "none", strokeDashoffset: 0, visibility: "visible" });
          gsap.set(nodes, { opacity: 1 });
          return;
        }

        const proxy = { p: 0 };
        const applyDash = () => {
          const p = proxy.p;
          if (p <= 0) {
            path.style.strokeDasharray = `0 ${length}`;
            path.style.strokeDashoffset = "0";
            path.style.visibility = "hidden";
          } else if (p >= 1) {
            path.style.strokeDasharray = "none";
            path.style.strokeDashoffset = "0";
            path.style.visibility = "visible";
          } else {
            path.style.strokeDasharray = `${p * length} ${length}`;
            path.style.strokeDashoffset = "0";
            path.style.visibility = "visible";
          }
        };
        gsap.set(nodes, { opacity: 0 });
        applyDash();

        const fractions = spec.boundaries.map((b) => ({ time: b.time, at: fractionAtPoint(path, b.x, b.y) }));
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          onUpdate: applyDash,
          scrollTrigger: {
            trigger: article,
            start: "top 80%",
            end: "bottom 45%",
            scrub: 1,
          },
        });

        // Map timeline time slots to path fractions so each authored part
        // draws in its own scrub range.
        let cursorTime = 0;
        [...fractions, { time: 1, at: 1 }].forEach((mark) => {
          const duration = mark.time - cursorTime;
          if (duration > 0) {
            tl.to(proxy, { p: mark.at, duration }, cursorTime);
          }
          cursorTime = mark.time;
        });

        // Endpoint nodes and accent dots fade in when the draw reaches them.
        nodes.forEach((node) => {
          if (node.dataset.threadNode === "a") {
            tl.to(node, { opacity: 1, duration: 0.02 }, 0);
          } else if (node.dataset.threadNode === "b") {
            tl.to(node, { opacity: 1, duration: 0.02 }, 0.97);
          } else {
            const at = fractionAtPoint(path, Number(node.getAttribute("cx") || 0), Number(node.getAttribute("cy") || 0));
            tl.to(node, { opacity: 1, duration: 0.02 }, at);
          }
        });

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
