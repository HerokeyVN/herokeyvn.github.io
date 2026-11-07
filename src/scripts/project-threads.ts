import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Round 10: STATIC final-state renderer for the three project visuals.
// Phase 2 of Key's round-10 brief requires complete static compositions
// with NO scroll animation wired yet, so this module does not create any
// ScrollTrigger. Every scene renders its final state from the markup and
// CSS alone (thread paths fully drawn, lit keys authored in the markup);
// initProjectThreads only enforces the fully-drawn state defensively and
// returns a cleanup, keeping the same export shape index.astro expects.
//
// PHASE 4 (after Key approves the statics): re-attach GSAP ScrollTrigger
// scrub here. The pieces to reuse are below: dashSetter (the round-8 CTM
// scale fix - vector-effect: non-scaling-stroke makes Chromium apply the
// dash pattern in screen units, so the dash must be scaled by the live
// CTM), the Round 6 open-path invariant (strokeDasharray "<visible>
// <length>", offset 0, "none" at completion), and the per-scene layer
// hooks (data-layer / data-thread / data-el in ProjectVisual.astro). One
// shared progress value per scene, scrub, ease none, reversible - see
// docs/art-direction-round-10.md "Phase 4 hooks".

// Dash setter for one path, with the round-8 CTM scale fix and the Round 6
// invariant (in screen units). Recomputed on every call so resizes stay
// correct. Kept for Phase 4; the static round only ever calls it with
// progress 1.
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

export function initProjectThreads() {
  if (typeof window === "undefined") return () => undefined;
  gsap.registerPlugin(ScrollTrigger);

  // Static final state: every thread path fully drawn. CSS already renders
  // them that way; this enforces it for any path carrying an inline dash
  // (e.g. from a stale cached build) and keeps the CTM helper exercised.
  const stages = [...document.querySelectorAll<HTMLElement>("[data-project-thread-stage]")];
  stages.forEach((stage) => {
    stage.querySelectorAll<SVGPathElement>(".project-thread-path").forEach((path) => {
      dashSetter(path)(1);
    });
  });

  // No ScrollTriggers in the static round. The returned cleanup is a
  // no-op; index.astro still calls it on pagehide.
  return () => undefined;
}
