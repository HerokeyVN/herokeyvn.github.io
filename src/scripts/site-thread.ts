import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { dashSetter } from "./project-threads";
import { ABOUT_EXIT_JUNCTION_FRACTIONS, findExpTransition, findTransition } from "../data/about-glyphs";
// Round 12.1: the glyph/headline machinery (Segment, Junction,
// GlyphRecord, collectGlyphs, buildGlyphGroup, findJunction,
// createConnector) moved to src/scripts/headline-trace.ts, the shared
// helper that traces all four headlines (About, Experience, Projects,
// Skills, Contact). site-thread.ts keeps the site chain, the stage
// windows, and the headline window/chain wiring. Bug 9: every headline
// trace now enters and leaves through VISIBLE entry/exit paths
// (headline-trace.ts), so the trace IS the main thread - gutter ->
// letters -> gutter - and each following site segment starts where the
// previous trace's exit ends.
import { createHeadlineTracer, type Segment } from "./headline-trace";
const SVG_NS = "http://www.w3.org/2000/svg";

// Round 12: per-scene stage geometry for the unified thread. Entry/exit
// points and travel orders are B's anchor contract
// (docs/round-12-project-anchors.md); the p-windows are the Phase 4
// ThreadPlan windows, with the deleted E2EE coil window merged into the
// through-path (desktop [0.44, 0.8]) so the thread seals the core while
// the plates assemble, and the mobile jog drawing in the old S-coil
// window ([0.42, 0.68]). Desktop entries/exits run east, mobile
// entries/exits run south (top -> bottom corridors).
type StagePlan = {
  vbW: number; vbH: number;
  entry: [number, number]; exit: [number, number];
  order: [("front" | "back"), number][];
  windows: [number, number][];
  dotEnd: number;
};
const STAGE_PLANS: Record<string, { desktop: StagePlan; mobile: StagePlan }> = {
  "fb-messenger-e2ee": {
    desktop: {
      vbW: 900, vbH: 560, entry: [0, 280], exit: [900, 280],
      order: [["front", 0], ["back", 0], ["front", 1], ["back", 1], ["front", 2]],
      windows: [[0, 0.12], [0.12, 0.22], [0.22, 0.34], [0.34, 0.44], [0.44, 0.8]],
      dotEnd: 0.8,
    },
    mobile: {
      vbW: 560, vbH: 560, entry: [280, 0], exit: [280, 560],
      order: [["front", 0], ["back", 0], ["front", 1], ["front", 2]],
      windows: [[0, 0.3], [0.3, 0.42], [0.42, 0.68], [0.68, 0.8]],
      dotEnd: 0.8,
    },
  },
  "sky-sheet-store": {
    desktop: {
      vbW: 1440, vbH: 560, entry: [0, 68], exit: [1440, 522],
      order: [["front", 0], ["back", 0], ["front", 1], ["front", 2], ["front", 3]],
      windows: [[0, 0.2], [0.2, 0.32], [0.32, 0.62], [0.62, 0.78], [0.78, 0.86]],
      dotEnd: 0.86,
    },
    mobile: {
      vbW: 560, vbH: 560, entry: [34, 0], exit: [484, 560],
      order: [["front", 0], ["back", 0], ["front", 1], ["front", 2], ["front", 3]],
      windows: [[0, 0.2], [0.2, 0.32], [0.32, 0.62], [0.62, 0.78], [0.78, 0.86]],
      dotEnd: 0.86,
    },
  },
  "sky-auto-piano": {
    desktop: {
      vbW: 900, vbH: 560, entry: [0, 250], exit: [900, 250],
      order: [["front", 0], ["back", 0], ["front", 1]],
      windows: [[0, 0.3], [0.3, 0.42], [0.42, 0.85]],
      dotEnd: 0.85,
    },
    mobile: {
      vbW: 560, vbH: 560, entry: [30, 0], exit: [500, 560],
      order: [["front", 0], ["back", 0], ["front", 1]],
      windows: [[0, 0.5], [0.5, 0.65], [0.65, 0.85]],
      dotEnd: 0.85,
    },
  },
};

type RouteDir = "N" | "E" | "S" | "W";
const ROUTE_DIR_V: Record<RouteDir, { x: number; y: number }> = {
  N: { x: 0, y: -1 }, E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 },
};
// Minimal path builder for the site-space project connectors: straight
// runs and quarter-turn cubics only, so every joint is G1 by
// construction. A 90deg turn from heading u to heading v ends at
// start + u*r + v*r, with control points 0.5523*r along each tangent.
const makeRoute = (startX: number, startY: number, startDir: RouteDir) => {
  let d = `M ${startX} ${startY}`;
  let x = startX, y = startY, dir = startDir;
  return {
    // Round 12.2 (G1): skip a zero-length run. A zero-length `L` has no
    // tangent, and the geometry test's parseD startTangent normalises
    // its (0,0) direction to (0,0), so angleBetween against the previous
    // cubic's end tangent returns acos(0) = 90deg. That is exactly what
    // the trailing `lineTo(entry)` was: the quarter-turn before it
    // already ends at the entry point, so the run is zero-length -
    // always on the mobile top-entry jog (the S turn ends at the entry)
    // and on the gap-mode E turn, and on desktop whenever the turn
    // radius is capped by the entry's distance from the gutter
    // (r0/rD == entry.x - edge, so the turn ends at entry.x). Skipping
    // it changes no geometry: the path already ends at the target, with
    // the turn's real end tangent (E on desktop, S on mobile), which is
    // the tangent the next stage path starts with. The epsilon covers
    // float error in the turn endpoint (edge + r0 vs entry.x); every
    // real run in the chain is >= 4px, so 1e-6 cannot skip one.
    lineTo(nx: number, ny: number) {
      if (Math.hypot(nx - x, ny - y) < 1e-6) return;
      d += ` L ${nx} ${ny}`; x = nx; y = ny;
    },
    turn(to: RouteDir, r: number) {
      const u = ROUTE_DIR_V[dir], v = ROUTE_DIR_V[to];
      const k = 0.5523 * r;
      const ex = x + u.x * r + v.x * r, ey = y + u.y * r + v.y * r;
      d += ` C ${x + u.x * k} ${y + u.y * k}, ${ex - v.x * k} ${ey - v.y * k}, ${ex} ${ey}`;
      x = ex; y = ey; dir = to;
    },
    get d() { return d; },
    get x() { return x; },
    get y() { return y; },
    get dir() { return dir; },
  };
};

export function initSiteThread() {
  const svg = document.querySelector<SVGSVGElement>("[data-site-thread]");
  const glyphSvg = document.querySelector<SVGSVGElement>("[data-glyph-thread]");
  const paths = [...document.querySelectorAll<SVGPathElement>("[data-site-thread-segment]")].sort((a, b) => Number(a.dataset.siteThreadSegment) - Number(b.dataset.siteThreadSegment));
  const connectorGroup = document.querySelector<SVGGElement>("[data-glyph-connectors]");
  const siteEnd = document.querySelector<SVGCircleElement>("[data-site-thread-end]");
  const glyphEnd = document.querySelector<SVGCircleElement>("[data-glyph-thread-end]");
  if (!svg || !glyphSvg || paths.length !== 7 || !connectorGroup || !siteEnd || !glyphEnd) return () => undefined;

  gsap.registerPlugin(ScrollTrigger);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let segments: Segment[] = [];
  // Round 12: one entry per project stage, for the end-dot fade (the dot
  // fades in as the stage's exit path completes, exactly as the old
  // per-project applyThread did; before that it stays hidden so no dot
  // floats at a stage exit the thread has not reached). The fade runs on
  // the stage's THREAD span, not its article span, so a delayed or
  // early-ended thread still gets its dot exactly as its exit path
  // completes (round 12.2: the connector-span funding re-maps both ends
  // of the thread span, see the chain timing below).
  let stageDots: { dot: SVGCircleElement | null; threadStart: number; threadEnd: number; dotEnd: number }[] = [];
  const updateStageDots = (currentScroll: number, forceFull = false) => {
    for (const { dot, threadStart, threadEnd, dotEnd } of stageDots) {
      if (!dot) continue;
      if (forceFull) { dot.style.removeProperty("opacity"); continue; }
      const p = gsap.utils.clamp(0, 1, (currentScroll - threadStart) / (threadEnd - threadStart));
      const t = gsap.utils.clamp(0, 1, (p - (dotEnd - 0.03)) / 0.05);
      if (t >= 1) dot.style.removeProperty("opacity");
      else dot.style.setProperty("opacity", String(t));
    }
  };
  let resizeFrame = 0;
  let trigger: ScrollTrigger | undefined;
  let s0 = 0;
  let sHandoffEnd = 0;
  let sGlyphStart = 0;
  let s2 = 0;

  // Document-space box with reveal offsets removed. Reveal tweens
  // (motion.ts) translate [data-reveal] ancestors by up to 34px until
  // they play; getBoundingClientRect includes that offset, so geometry
  // measured at load would go stale by the offset once the reveal
  // completes (mobile Experience heading: +34px at load, 0 after play;
  // mobile statement: +22px). Subtracting the pure translate of every
  // ancestor measures final layout coordinates at any point in the
  // animation, because the rendered rect always carries the current
  // offset. (Where no reveal applies, e.g. desktop, this is a no-op.)
  const docBox = (el: Element) => {
    const r = el.getBoundingClientRect();
    let dx = 0, dy = 0;
    let node: Element | null = el;
    while (node) {
      const t = getComputedStyle(node).transform;
      if (t && t !== "none") {
        const m = new DOMMatrix(t);
        if (m.a === 1 && m.d === 1 && m.b === 0 && m.c === 0) { dx += m.e; dy += m.f; }
      }
      node = node.parentElement;
    }
    return { left: r.left + scrollX - dx, right: r.right + scrollX - dx, top: r.top + scrollY - dy, bottom: r.bottom + scrollY - dy };
  };
  const topOf = (selector: string) => { const el = document.querySelector<HTMLElement>(selector); return el ? docBox(el).top : 0; };
  const botOf = (selector: string) => { const el = document.querySelector<HTMLElement>(selector); return el ? docBox(el).bottom : 0; };
  const setTiming = (segment: Segment, start: number, end: number) => { segment.startScroll = start; segment.endScroll = Math.max(start + 1, end); };

  const pointInSiteSpace = (element: SVGPathElement, distance: number) => {
    const point = element.getPointAtLength(distance);
    const pathMatrix = element.getScreenCTM();
    const siteMatrix = svg.getScreenCTM();
    if (!pathMatrix || !siteMatrix) return undefined;
    return new DOMPoint(point.x, point.y).matrixTransform(pathMatrix).matrixTransform(siteMatrix.inverse());
  };

  // Round 12.1: the one-sided contour tangents (contourArrival /
  // contourDeparture) moved to headline-trace.ts with the connector
  // builder that uses them.
  // End tangent of a hero segment. getTotalLength() returns the real length
  // in user units (measured 719.5 for seg-2: pathLength="1" does NOT
  // rescale it in this browser), so the samples are the last few absolute
  // px; the path is open, so nothing wraps. The old code sampled at 0.99
  // and 1.0, which are 0.99px and 1px from the START, returning the start
  // tangent (32.8deg) instead of the end tangent (84.5deg).
  const heroEndTangent = (path: SVGPathElement) => {
    const length = path.getTotalLength();
    if (length <= 0) return { x: 0, y: 1 };
    const eps = Math.min(4, length / 4);
    const a = pointInSiteSpace(path, length - eps);
    const b = pointInSiteSpace(path, length);
    if (!a || !b) return { x: 0, y: 1 };
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    return len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 1 };
  };

  const render = (currentScroll: number) => {
    if (!segments.length) return;
    if (reduceMotion.matches) {
      segments.forEach(({ element }) => element && gsap.set(element, { strokeDasharray: "none", strokeDashoffset: 0, visibility: "visible" }));
      gsap.set([siteEnd, glyphEnd], { autoAlpha: 0 });
      updateStageDots(currentScroll, true);
      svg.setAttribute("data-thread-phase", "glyph");
      return;
    }

    // Diagnostic phase contract: hero | handoff | connector | glyph
    // The connector keeps the thread visible from the handoff end to the
    // first glyph junction. There is no hidden phase: the earlier hidden
    // travel read as a missing thread segment (gap probe 2026-11-06).
    let phase: "hero" | "handoff" | "connector" | "glyph" = "hero";
    if (currentScroll >= sGlyphStart) {
      phase = "glyph";
    } else if (currentScroll > sHandoffEnd) {
      phase = "connector";
    } else if (currentScroll > s0) {
      phase = "handoff";
    } else {
      phase = "hero";
    }
    svg.setAttribute("data-thread-phase", phase);

    let active: { segment: Segment; progress: number } | undefined;
    segments.forEach((segment) => {
      const progress = gsap.utils.clamp(0, 1, (currentScroll - segment.startScroll) / (segment.endScroll - segment.startScroll));
      if (progress > 0 && progress < 1) active = { segment, progress };
      if (!segment.element) return;

      // Round 12: stage paths are driven by the CTM-scaled dashSetter
      // (round-8 fix) instead of the site thread's user-unit dash,
      // because their SVGs use vector-effect: non-scaling-stroke.
      if (segment.setDash) {
        segment.setDash(progress);
        return;
      }

      const visible = segment.drawLength * progress;
      if (segment.kind === "closed") {
        // Bug 8 fallback only: closed glyph contours now arrive with a
        // CTM-scaled setDash (headline-trace.ts) and return above, so
        // this branch no longer runs for them. It still uses raw
        // user-unit dashes, which saturate ~1/scale early under
        // non-scaling-stroke - do not route glyph contours through here.
        gsap.set(segment.element, {
          strokeDasharray: progress >= 1 ? "none" : `${visible} ${Math.max(0.01, segment.drawLength - visible)}`,
          strokeDashoffset: -segment.startDistance,
          visibility: progress > 0 ? "visible" : "hidden",
        });
      } else {
        if (progress <= 0) {
          segment.element.style.strokeDasharray = `0 ${segment.drawLength}`;
          segment.element.style.strokeDashoffset = "0";
          segment.element.style.visibility = "hidden";
        } else if (progress >= 1) {
          segment.element.style.strokeDasharray = "none";
          segment.element.style.strokeDashoffset = "0";
          segment.element.style.visibility = "visible";
        } else {
          segment.element.style.strokeDasharray = `${visible} ${segment.drawLength}`;
          segment.element.style.strokeDashoffset = "0";
          segment.element.style.visibility = "visible";
        }
      }
    });

    updateStageDots(currentScroll);

    // The head dot hides while the thread travels behind a foreground
    // structure (round-12 stage back paths), exactly as the moving marker
    // hides during hidden glyph travel.
    if (!active || active.segment.kind === "hidden" || !active.segment.element || active.segment.occluded) {
      gsap.set([siteEnd, glyphEnd], { autoAlpha: 0 });
      return;
    }
    const { segment, progress } = active;
    const element = segment.element!;
    const distance = segment.kind === "closed" ? (segment.startDistance + segment.drawLength * progress) % segment.drawLength : segment.drawLength * progress;
    const point = pointInSiteSpace(element, distance);
    if (!point) return;
    const activeEnd = segment.layer === "glyph" ? glyphEnd : siteEnd;
    const inactiveEnd = segment.layer === "glyph" ? siteEnd : glyphEnd;
    activeEnd.setAttribute("cx", String(point.x)); activeEnd.setAttribute("cy", String(point.y));
    gsap.set(activeEnd, { autoAlpha: 1 }); gsap.set(inactiveEnd, { autoAlpha: 0 });
  };

  // Round 12.1: findJunction and createConnector moved to
  // headline-trace.ts with the rest of the glyph machinery.


  const build = () => {
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.scrollHeight;
    const winHeight = innerHeight;
    const heroHeight = document.querySelector<HTMLElement>("#top")?.offsetHeight ?? winHeight;
    const aboutTop = topOf("#about"), expTop = topOf("#experience"), projTop = topOf("#projects"), skillsTop = topOf("#skills"), contactTop = topOf("#contact");
    const edge = Math.max(6, Math.min(18, width * 0.014));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`); svg.style.height = `${height}px`;
    glyphSvg.setAttribute("viewBox", `0 0 ${width} ${height}`); glyphSvg.style.height = `${height}px`;
    connectorGroup.replaceChildren();

    const isMobile = width <= 700;
    // Round 12.1: the shared headline tracer (headline-trace.ts) owns
    // glyph collection, line grouping, junction resolution and the
    // contour/connector segments for every headline. The span attribute
    // is the shared data-heading-glyph-key (SectionHeading / Contact
    // emit it for every traced headline); the contour attribute stays
    // per-headline (data-exp-glyph-key, data-proj-glyph-key, ...). The
    // baseline lookup is scoped to the heading element: baseline word
    // indices repeat across headlines, so a document-wide lookup would
    // resolve every headline against Experience's baselines.
    const tracer = createHeadlineTracer({ glyphSvg, connectorGroup, docBox, pointInSiteSpace });

    const aboutGroup = tracer.collectAndBuild(
      {
        id: "about",
        headingEl: document.querySelector<HTMLElement>("#about-title"),
        spanClass: ".about__glyph",
        keyDataset: "glyphKey",
        keyAttr: "data-glyph-key",
        contourDataset: "glyphContour",
        baselineAttr: "data-glyph-baseline",
        wordPart: 0,
        findTransition,
        snake: true,
        exitJunctionFractions: ABOUT_EXIT_JUNCTION_FRACTIONS,
      },
      isMobile,
    );
    const glyphOrder = aboutGroup.order;
    const headlineSegments = aboutGroup.segments;
    if (!glyphOrder.length) return;
    const first = aboutGroup.first!;
    const last = aboutGroup.last!;

    // Round 12.1: the About headline window is computed here, right
    // after the About group, because the Experience trace window starts
    // from s2 and the trace must be built before the site-1 path that
    // leaves its exit. (Unchanged formulas: the glyph window ends when
    // the last glyph sits at 34% viewport height.)
    s0 = Math.round(heroHeight * 0.55);
    sHandoffEnd = s0 + (isMobile ? 35 : 50);
    sGlyphStart = Math.max(sHandoffEnd + (isMobile ? 65 : 85), Math.round(first.y - winHeight * 0.72));
    const s1 = sGlyphStart;
    s2 = Math.max(s1 + Math.max(480, winHeight * 0.62), Math.round(last.y - winHeight * 0.34));

    // Round 12.1 (Bug 1): the Experience trace window comes from the
    // shared headlineTraceWindow: it ends when the last line's bottom
    // reaches 72% viewport height, so the trace completes while the
    // headline is still framed, instead of at 34% (by which time the
    // headline top had scrolled 230-280px above the viewport). Same
    // mechanism as Round 12, reading order on both lines, no snake
    // reversal. Absent (a heading without the trace prop) there are no
    // exp segments and site-1 keeps its old end.
    const expTrace = tracer.traceHeadline(
      {
        id: "exp",
        headingEl: document.querySelector<HTMLElement>("#experience-title"),
        spanClass: ".heading__glyph",
        keyDataset: "headingGlyphKey",
        keyAttr: "data-exp-glyph-key",
        contourDataset: "expGlyphContour",
        baselineAttr: "data-heading-glyph-baseline",
        wordPart: 1,
        findTransition: findExpTransition,
        sectionEl: document.querySelector<HTMLElement>("#experience"),
      },
      { anchor: { x: edge, y: expTop, distance: 0 }, prevEnd: s2, headingTop: expTop, winHeight },
      isMobile,
    );
    let s3 = expTrace.window[0];
    let sExp = expTrace.window[1];
    if (!expTrace.segments.length) {
      s3 = Math.max(s2 + 160, Math.round(expTop - winHeight * 0.55));
      sExp = s3;
    }
    const expSegments = expTrace.segments;
    // Round 12.1 (Bug 9): the Projects trace is measured here, before
    // the project chain is built, so C0 can start where the trace's
    // exit ends (the gutter point below the TANGIBLE. headline). The
    // full traceHeadline call below reuses this measurement (it must not
    // re-create the entry/exit paths).
    const projConfig = {
      id: "proj",
      headingEl: document.querySelector<HTMLElement>("#projects-title"),
      spanClass: ".heading__glyph",
      keyDataset: "headingGlyphKey",
      keyAttr: "data-proj-glyph-key",
      contourDataset: "projGlyphContour",
      baselineAttr: "data-heading-glyph-baseline",
      wordPart: 1,
      sectionEl: document.querySelector<HTMLElement>("#projects"),
    };
    const projMeasured = tracer.measureHeadlineTrace(projConfig, { x: edge, y: projTop, distance: 0 }, isMobile);

    const stmt = document.querySelector(".about__statement"), prof = document.querySelector(".about__profile");
    const gapTop = stmt ? botOf(".about__statement") : aboutTop + 400, gapBot = prof ? topOf(".about__profile") : aboutTop + 650;
    const rightEdge = width - edge;

    const heroExitPath = document.querySelector<SVGPathElement>(
      isMobile ? "[data-thread-segment-mobile='2']" : "[data-thread-segment='2']",
    );
    let startX = isMobile ? width * (308 / 390) : width * (1138 / 1440);
    let startY = heroHeight;
    if (heroExitPath) {
      const p = heroExitPath.getPointAtLength(heroExitPath.getTotalLength());
      const m = heroExitPath.getScreenCTM();
      if (m) {
        startX = p.x * m.a + p.y * m.c + m.e;
        startY = p.x * m.b + p.y * m.d + m.f + scrollY;
      }
    }

    const targetL = isMobile
      ? Math.min(42, Math.max(34, width * 0.09))
      : Math.min(60, Math.max(50, width * 0.04));
    const dx = isMobile ? -Math.round(targetL / 2.45) : Math.round(targetL / 2.45);
    const dy = Math.round(Math.abs(dx) * 2.18);
    const endX = startX + dx;
    const endY = startY + dy;

    // Round 11: the handoff is one elongated cubic whose control points
    // follow the tangents at both ends - cp1 leaves along the hero exit
    // tangent, cp2 arrives along the handoff's overall direction of travel.
    // Endpoints and length are unchanged, so the handoff timing test still
    // holds; the bend is smooth (rMin ~50 desktop) instead of kinked.
    const heroTan = heroExitPath ? heroEndTangent(heroExitPath) : { x: 0, y: 1 };
    const handoffLen = Math.hypot(endX - startX, endY - startY) || 1;
    const handoffDir = { x: (endX - startX) / handoffLen, y: (endY - startY) / handoffLen };
    const handoffK = 0.42 * handoffLen;
    const cp1x = startX + heroTan.x * handoffK;
    const cp1y = startY + heroTan.y * handoffK;
    const cp2x = endX - handoffDir.x * handoffK;
    const cp2y = endY - handoffDir.y * handoffK;

    // Hero-to-glyph connector: one continuous elongated cubic from the
    // handoff end to the right gutter, a vertical gutter run, a
    // quarter-turn onto the run, then a straight run into the first glyph
    // junction. Round 11: replaces the two straight L segments and their
    // 90-degree corner (rMin ~62 desktop). runY stays below the filled
    // headline line so the approach never crosses copy; where the first
    // junction sits less than 10px under that line, the run drops just
    // below it and rises into the junction. The turn radius (100px
    // desktop) keeps the curve clear of the filled span's expanded box.
    // Round 11 fix: the first cubic used to end at the gutter at turnY,
    // descending diagonally across the filled "BUILT FOR THE PARTS" span
    // at 1280 wide (the span wraps to a tall box reaching x 1232). The
    // cubic now ends on the gutter at gutterTopY, above the span's top
    // edge, and a vertical run continues down to turnY, so the thread
    // never cuts across the filled line.
    const filledSpan = document.querySelector<HTMLElement>(".about__title > span:first-child");
    const filledBox = filledSpan ? docBox(filledSpan) : undefined;
    const filledTop = filledBox ? filledBox.top : aboutTop;
    const filledBottom = filledBox ? filledBox.bottom : aboutTop + 400;
    const runY = Math.max(first.y, filledBottom + 10);
    const connDx = rightEdge - endX;
    // Desktop quarter-turn radius: the turn must not overshoot the first
    // junction's x. At 1280 the one-line layout puts the first junction
    // only 95px left of the gutter, so a 100px turn ends 4.6px past it
    // and the final run reverses (a 180deg kink). Clamp the radius so
    // the run keeps at least 8px of leftward travel; the turn stays
    // circular (turnY follows turnR).
    const turnR = Math.min(100, Math.max(12, rightEdge - first.x - 8));
    const turnY = isMobile ? endY + 0.74 * (runY - endY) : runY - turnR;
    const gutterTopY = Math.min(turnY, Math.max(endY + 60, filledTop - 40));
    // Round 12.2 spec-105: the mobile cubic's control handle is shortened
    // (1.1 -> 0.85) so the curve swings right of the About kicker's
    // top-right corner, which it grazed by ~2px in the shifted
    // (unrevealed) frame. Start tangent unchanged, so G1 holds.
    const connL1 = (isMobile ? 0.85 : 0.5) * connDx;
    const connCp1x = endX + handoffDir.x * connL1;
    const connCp1y = endY + handoffDir.y * connL1;
    const connCp2x = rightEdge;
    const connCp2y = Math.min(gutterTopY - 10, Math.max(connCp1y, gutterTopY - 95));
    let connectorD: string;
    if (isMobile) {
      // Mobile: cubic to the gutter, straight gutter run, 10px fillet onto
      // the run (the corridor forces the small radius), horizontal run,
      // then a short rise into the first junction.
      const filletR = 10;
      const filletK = 0.5523 * filletR;
      const riseLen = 4.25 * (runY - first.y);
      connectorD = `M ${endX} ${endY} C ${connCp1x} ${connCp1y}, ${connCp2x} ${connCp2y}, ${rightEdge} ${gutterTopY} L ${rightEdge} ${turnY} L ${rightEdge} ${runY - filletR} C ${rightEdge} ${runY - filletR + filletK}, ${rightEdge - filletR + filletK} ${runY}, ${rightEdge - filletR} ${runY} L ${first.x + riseLen} ${runY} C ${first.x + 1.5 * (runY - first.y)} ${runY}, ${first.x + 0.8 * (runY - first.y)} ${first.y}, ${first.x} ${first.y}`;
    } else {
      const turnK = 0.5523 * turnR;
      connectorD = `M ${endX} ${endY} C ${connCp1x} ${connCp1y}, ${connCp2x} ${connCp2y}, ${rightEdge} ${gutterTopY} L ${rightEdge} ${turnY} C ${rightEdge} ${turnY + turnK}, ${rightEdge - turnR + turnK} ${runY}, ${rightEdge - turnR} ${runY} L ${first.x} ${runY}`;
    }

    const p1 = document.querySelector("#fb-messenger-e2ee"), p2 = document.querySelector("#sky-sheet-store"), p3 = document.querySelector("#sky-auto-piano");
    const p1Bot = p1 ? botOf("#fb-messenger-e2ee") : projTop + 600, p2Top = p2 ? topOf("#sky-sheet-store") : projTop + 700, p2Bot = p2 ? botOf("#sky-sheet-store") : projTop + 1600, p3Top = p3 ? topOf("#sky-auto-piano") : projTop + 1700;
    const emailEl = document.querySelector(".contact__email-btn");
    const emailBox = emailEl ? docBox(emailEl) : undefined;
    const contactTargetX = emailBox ? Math.max(edge, emailBox.left - 24) : width * 0.25, contactTargetY = emailBox ? (emailBox.top + emailBox.bottom) / 2 : contactTop + 300;
    // Round 12.1 (Bug 9): the Contact trace is measured here, before
    // site-5 is built, so site-5 can start where the trace's exit ends
    // (the gutter point below the YOUR PRODUCT NEEDS. headline). The
    // gutterEndY is where site-5 starts its email approach; the exit's
    // final turn shrinks to end high enough above it (see
    // measureHeadlineTrace). The full traceHeadline call below reuses
    // this measurement.
    const contactConfig = {
      id: "contact",
      headingEl: document.querySelector<HTMLElement>("#contact-title"),
      spanClass: ".heading__glyph",
      keyDataset: "headingGlyphKey",
      keyAttr: "data-contact-glyph-key",
      contourDataset: "contactGlyphContour",
      baselineAttr: "data-heading-glyph-baseline",
      wordPart: 1,
      sectionEl: document.querySelector<HTMLElement>("#contact"),
    };
    const contactMeasured = tracer.measureHeadlineTrace(contactConfig, { x: edge, y: contactTop, distance: 0 }, isMobile, { gutterEndY: contactTargetY - 75 });

    // Stadium crossing: quarter-turn off the gutter, straight run across,
    // quarter-turn back onto the gutter. Tangents match the vertical gutter
    // runs at both ends (G1); the radius is half the vertical span, so the
    // turn is as gentle as the gap allows (rMin ~36-73 desktop). The
    // fragment continues from the current point (x0, y0) heading down.
    // Round 11: replaces the old single-cubic crossings, which were
    // square brackets with rMin ~3-4 and (contrary to the round-11 brief)
    // already G1 - the defect was curvature, not tangent mismatch.
    const stadium = (x0: number, y0: number, x1: number, y1: number): string => {
      const d = y1 - y0;
      // Cap the turn radius so the straight run never reverses when the
      // horizontal gap is narrower than the vertical span (round 12: a
      // one-line exit drops close to the left edge while the crossing
      // spans ~190px vertically). Unchanged for all current crossings,
      // where the gap is far wider than the span.
      const r = Math.min(d / 2, Math.max(4, Math.abs(x1 - x0) / 2 - 4)), k = 0.5523 * r, s = Math.sign(x1 - x0);
      const turns = `C ${x0} ${y0 + k}, ${x0 + s * r - s * k} ${y0 + r}, ${x0 + s * r} ${y0 + r} L ${x1 - s * r} ${y0 + r} C ${x1 - s * r + s * k} ${y0 + r}, ${x1} ${y0 + r + k}, ${x1} ${y0 + 2 * r}`;
      return 2 * r >= d ? turns : `${turns} L ${x1} ${y1}`;
    };

    // Site-1 exit (round 12): the thread leaves the last glyph junction
    // (top-right corner, so the contour departure heads straight down)
    // and drops vertically through the clear channel below the glyphs
    // instead of sweeping right to the gutter. Which glyph is last
    // depends on the rendered line count: "." on two/three lines, "U"
    // when the whole phrase fits one line (1280). The drop runs in the
    // gap between the statement node and the note on desktop (1440:
    // node ends x 724, note starts x 1247, drop x ~865) and ends above
    // the profile, so it never reaches the profile copy; the stadium
    // crossing below the statement then carries it to the left edge.
    // When the drop x would hit statement text it jogs into the
    // node/note channel above the text (run 14px above the topmost
    // text): at 1280 the "." drop (~1184) would hit the note and the
    // "U" drop (~190) would hit the first paragraph. On mobile the
    // statement spans the full width, so the drop jogs right into the
    // gutter above the statement top (two R=6.15 quarter-turns, the
    // tightest the 12px jog allows). Every joint is G1: the drop leaves
    // along the contour departure, the jog turns are quarter-turn
    // cubics, the stadium starts heading down. The drop crosses only
    // the statement's 1px top rule, never its text.
    const lastJ = last;
    const dropX = lastJ.x;
    const crossY0 = gapTop;
    // Optional jog around the one obstacle the vertical drop would hit.
    let jog: { jogY: number; channelX: number; dir: number; r: number } | undefined;
    if (!isMobile) {
      const noteEl = document.querySelector(".about__note");
      const nodeEl = document.querySelector(".about__node");
      const p1El = document.querySelector(".about__statement > p:first-child");
      const note = noteEl ? docBox(noteEl) : undefined;
      const node = nodeEl ? docBox(nodeEl) : undefined;
      const p1 = p1El ? docBox(p1El) : undefined;
      const hit = (b: { left: number; right: number; top: number; bottom: number } | undefined) =>
        b && dropX > b.left - 10 && dropX < b.right + 10 && b.top < crossY0 && b.bottom > lastJ.y;
      if (hit(note) || hit(node) || hit(p1)) {
        const channelX = node && note ? (node.right + note.left) / 2 : dropX - 300;
        const r = Math.min(32, Math.abs(channelX - dropX) / 2);
        const clearTop = Math.min(note?.top ?? Infinity, node?.top ?? Infinity, p1?.top ?? Infinity);
        jog = { jogY: clearTop - 14 - r, channelX, dir: Math.sign(channelX - dropX) || -1, r };
      }
    } else {
      const stmtBox = stmt ? docBox(stmt) : undefined;
      if (stmtBox && dropX > stmtBox.left - 10 && dropX < stmtBox.right + 10 && stmtBox.top < crossY0 && stmtBox.bottom > lastJ.y) {
        const r = (rightEdge - dropX) / 2;
        jog = { jogY: stmtBox.top - 14 - r, channelX: rightEdge, dir: 1, r };
      }
    }
    const jogEndY = jog ? jog.jogY + 2 * jog.r : lastJ.y;
    const crossY = Math.min(Math.max(crossY0, jogEndY + 20), gapBot - 40);
    const qk = 0.5523;
    let site1D: string;
    if (!jog) {
      site1D = `M ${lastJ.x} ${lastJ.y} L ${dropX} ${crossY} ${stadium(dropX, crossY, edge, gapBot)} C ${edge} ${gapBot + 40}, ${edge} ${expTop - 40}, ${edge} ${expTop}`;
    } else {
      const { jogY, channelX, dir, r } = jog;
      const kk = qk * r;
      const turn1EndX = dropX + dir * r;
      const turn1EndY = jogY + r;
      const turn2StartX = channelX - dir * r;
      const turn2EndY = jogY + 2 * r;
      const run = Math.abs(turn2StartX - turn1EndX) > 0.5 ? ` L ${turn2StartX} ${turn1EndY}` : "";
      site1D = `M ${lastJ.x} ${lastJ.y} L ${dropX} ${jogY} C ${dropX} ${jogY + kk}, ${turn1EndX - dir * kk} ${turn1EndY}, ${turn1EndX} ${turn1EndY}${run} C ${turn2StartX + dir * kk} ${turn1EndY}, ${channelX} ${turn2EndY - kk}, ${channelX} ${turn2EndY} L ${channelX} ${crossY} ${stadium(channelX, crossY, edge, gapBot)} C ${edge} ${gapBot + 40}, ${edge} ${expTop - 40}, ${edge} ${expTop}`;
    }

    // Site-5 contact approach (round 11): straight gutter run, then a
    // short sweep into the email button arriving at 60deg (desktop) or
    // 75deg (mobile, where the button sits at the left edge). The old
    // control point sat 41px off-canvas and the approach snapped with
    // r=13; the new one stays on-canvas (min x 12.5 desktop, 4.2 mobile)
    // with rMin ~33-35. The end sits left of the button, vertically
    // centred on it.
    const emailGap = emailBox ? emailBox.left - edge : 24;
    const contactTheta = ((emailGap >= 20 ? 60 : 75) * Math.PI) / 180;
    // Round 12.2 (chain G1): the arrival handle is 20, not 28. The
    // single-cubic approach below now starts 6px lower (straight lead-in),
    // and with the old 28 handle its radius measured 17.7, below the
    // site-5 floor of 20; 20 keeps it at ~26. The arrival angle is
    // unchanged (the handle stays on the same 60deg / 75deg ray).
    const contactHandle = emailGap >= 20 ? 20 : 16;
    const approachCp2x = contactTargetX - Math.cos(contactTheta) * contactHandle;
    const approachCp2y = contactTargetY - Math.sin(contactTheta) * contactHandle;
    const gutterEndY = contactTargetY - 75;
    // Bug 9: site-5 starts where the Contact trace's exit ends (the
    // gutter point below the headline), not at the headline top. The
    // exit band sits below gutterEndY (the email button is only ~50px
    // under the title), so the vertical gutter leg is skipped and the
    // approach cubic starts directly from the exit end; the exit's
    // final turn shrinks to keep this cubic's radius >= 20 (see
    // measureHeadlineTrace). When the exit ends above gutterEndY the
    // old vertical leg is kept.
    const c5Start = contactMeasured?.exitEnd ?? { x: edge, y: contactTop };
    const site5D = c5Start.y <= gutterEndY
      ? `M ${edge} ${c5Start.y} C ${edge} ${c5Start.y + (gutterEndY - c5Start.y) / 3}, ${edge} ${c5Start.y + (2 * (gutterEndY - c5Start.y)) / 3}, ${edge} ${gutterEndY} C ${edge} ${contactTargetY - 31}, ${approachCp2x} ${approachCp2y}, ${contactTargetX} ${contactTargetY}`
      // Round 12.2 (chain G1): straight 6px south lead-in, so the chain's
      // 4px secant reads south at the joint (the approach cubic used to
      // bend west inside its first 4 units, +3.8deg / +4.3deg). The first
      // control point moves down by the same 6 to keep the handle length.
      : `M ${edge} ${c5Start.y} L ${edge} ${c5Start.y + 6} C ${edge} ${contactTargetY - 31 + 6}, ${approachCp2x} ${approachCp2y}, ${contactTargetX} ${contactTargetY}`;

    // Site-2 career timeline (round 12, point 3): the thread leaves the
    // left gutter below the "Career Milestones" title, ramps onto the
    // milestone line and runs vertically through both numbered marker
    // centres (chronological: Intern 01, Fresher 02), then ramps back to
    // the gutter and down to Projects. The run coincides with the CSS
    // timeline line (.timeline-steps::before, same x, same 2px width),
    // which stays as the no-JS fallback; the thread draws over it.
    // Both ramps are elongated cubics with vertical tangents at both
    // ends (G1 with the gutter run above and the marker run below, and
    // with the gutter run at Projects). The entry ramp starts above or
    // below the title depending on the gutter gap (see the branch below)
    // so the move right happens only where the step text sits 15px right
    // of the marker centre; the exit ramp runs in the clear
    // gap below the sidebar (single column) or below the dossier
    // (two columns), never across initiative cards. Handles are capped
    // at 0.45*dy so the control-point y values stay ordered and the
    // ramps stay monotonic in x and y (no S, no loop).
    const rampV = (x0: number, y0: number, x1: number, y1: number): string => {
      const k = Math.min(0.42 * Math.hypot(x1 - x0, y1 - y0), 0.45 * Math.abs(y1 - y0));
      return `C ${x0} ${y0 + k}, ${x1} ${y1 - k}, ${x1} ${y1}`;
    };
    const markerEls = [...document.querySelectorAll<HTMLElement>(".step-marker")];
    const markerCentres = markerEls.map((el) => { const b = docBox(el); return { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 }; });
    const titleTop = topOf(".timeline-title");
    const titleBottom = botOf(".timeline-title");
    let site2D: string;
    if (markerCentres.length >= 2 && titleTop > expTop && titleBottom + 6 < markerCentres[0]!.y) {
      const m1 = markerCentres[0]!, m2 = markerCentres[1]!;
      const mx = m1.x;
      // Entry branch on the gutter-to-marker gap dx = mx - edge.
      // Round 12.2: ALWAYS start 7px above the title (dy ~50), even
      // narrow (dx <= 22, mobile). The old narrow branch started below
      // the title (dy ~24) and its radius measured 9.4, below the
      // spec-2161 site-2 floor of 20 - and no south-to-south jog can do
      // better in 24px of vertical: the two-arc optimum for a (17,24)
      // jog is ~12.7. The long entry's radius is 42.2; its closest
      // approach to the title is 4.3px west of the title's bottom-left
      // corner, which is the geometric max for any radius >= 20 path
      // here. The thread does not cross the title text (a span, not a
      // spec-105 protected element), it passes just left of it.
      // Bug 9: the run starts where the Experience trace's exit ends
      // (the gutter point below the headline), not at the headline top.
      // The ramp start yB is below that point in practice; guard the
      // monotone gutter run if a layout ever puts it above.
      const yB0 = titleTop - 7;
      const yB = Math.max(yB0, expTrace.exitEnd.y + 20);
      let exitD: string;
      if (width <= 1024) {
        // Single column (sidebar on top): exit in the gap between the
        // sidebar and the initiatives, so the run never crosses a card.
        // Round 12.2: 4px margins, not 10. The gap is only 48px and the
        // exit ramp needs dy 40 for radius 23.8 (the old dy 28 measured
        // 12.5, below the site-2 floor of 20). The nearest protected
        // content is the first initiative card, 58px below the ramp end.
        const yC = botOf(".experience__sidebar") + 4;
        const yD = topOf(".experience__initiatives") - 4;
        exitD = `L ${mx} ${yC} ${rampV(mx, yC, edge, yD)} L ${edge} ${projTop}`;
      } else {
        // Two columns: exit below the whole dossier, in the clear gap
        // before the Projects section.
        const yC = botOf(".experience__dossier") + 14;
        const yD = projTop - 20;
        exitD = `L ${mx} ${yC} ${rampV(mx, yC, edge, yD)} L ${edge} ${projTop}`;
      }
      site2D = `M ${expTrace.exitEnd.x} ${expTrace.exitEnd.y} L ${edge} ${yB} ${rampV(edge, yB, mx, m1.y)} L ${mx} ${m2.y} ${exitD}`;
    } else {
      site2D = `M ${expTrace.exitEnd.x} ${expTrace.exitEnd.y} C ${edge} ${expTrace.exitEnd.y + (projTop - expTrace.exitEnd.y) * 0.3}, ${edge} ${expTrace.exitEnd.y + (projTop - expTrace.exitEnd.y) * 0.7}, ${edge} ${projTop}`;
    }

    // --- Round 12 project chain -----------------------------------------
    // One continuous thread through the three project stages, replacing
    // the old Projects gutter run (stadium crossings between articles).
    // The stage thread-back/thread-front SVGs stay as the rendering
    // layers for the one site thread (they are what let the filament pass
    // behind the E2EE frames and in front of the other structures); there
    // is no separate thread system anymore. The site thread's render()
    // drives the stage paths' dashes via dashSetter (Round 6 invariant +
    // round-8 CTM scale fix). Each stage path draws inside its article's
    // ScrollTrigger window (the DOM choreography's p-windows, so thread
    // and DOM share one progress value); the site-space connectors tile
    // the scroll gaps between the articles' windows.
    //
    // Route (travel order): gutter run down to the E2EE stage entry ->
    // E2EE stage paths -> connector to the Sheet Store stage entry ->
    // Sheet paths -> connector to the Piano stage entry -> Piano belt
    // paths -> gutter run to skillsTop. All connectors are gutter/gap
    // runs joined by quarter-turn cubics (see makeRoute), so every
    // junction is G1. Two layout axes decide the shape, measured live:
    // the stage variant (desktop SVG entries run east, mobile top/bottom
    // corridors run south) and the exhibit columns (two columns above
    // 1024px, single column below, so the Piano entry must be approached
    // down the inter-column gap on two-column layouts and from the left
    // gutter otherwise). If any stage is missing the chain is skipped
    // and the old gutter run is kept, so the thread never breaks.
    const twoCol = width > 1024;
    const stageVariant = isMobile ? "mobile" : "desktop";
    const stageBoxOf = (slug: string) => {
      const stage = document.querySelector<HTMLElement>(`[data-project-slug="${slug}"]`);
      return stage ? { stage, box: docBox(stage) } : null;
    };
    const contentBoxOf = (slug: string) => {
      const el = document.querySelector<HTMLElement>(`#${slug} .project-exhibit__content`);
      return el ? docBox(el) : null;
    };
    type BuiltStage = {
      slug: string; plan: StagePlan;
      paths: SVGPathElement[];
      dot: SVGCircleElement | null;
      entry: { x: number; y: number }; exit: { x: number; y: number };
      entryDir: "E" | "S"; exitDir: "E" | "S";
      artStart: number; artEnd: number;
      // Round 12.2 (spec 378): the scroll span the stage thread tiles.
      // Normally the full article trigger window [artStart, artEnd], so
      // thread and DOM share one progress value; a later stage's
      // threadStart moves later to fund its entry connector's scroll
      // span, and a previous stage's threadEnd moves earlier to fund
      // the same connector from the other end (see the chain timing
      // below).
      threadStart: number; threadEnd: number;
    };
    const buildStage = (slug: string): BuiltStage | null => {
      const found = stageBoxOf(slug);
      const plan = STAGE_PLANS[slug]?.[stageVariant];
      if (!found || !plan) return null;
      const { stage, box } = found;
      const layerPaths = (layer: "front" | "back") =>
        [...stage.querySelectorAll<SVGPathElement>(`svg[data-variant="${stageVariant}"][data-layer="thread-${layer}"] .project-thread-path`)];
      const fronts = layerPaths("front"), backs = layerPaths("back");
      const paths = plan.order.map(([layer, i]) => (layer === "front" ? fronts[i] : backs[i])!).filter(Boolean);
      if (paths.length !== plan.order.length) return null;
      const article = stage.closest<HTMLElement>("article[data-project]");
      if (!article) return null;
      const artBox = docBox(article);
      const mapPoint = (pt: [number, number]) => ({
        x: box.left + (pt[0] / plan.vbW) * (box.right - box.left),
        y: box.top + (pt[1] / plan.vbH) * (box.bottom - box.top),
      });
      const artStart = artBox.top - 0.8 * winHeight;
      const artEnd = Math.max(artStart + 1, artBox.bottom - 0.45 * winHeight);
      return {
        slug, plan, paths,
        dot: stage.querySelector<SVGCircleElement>(`svg[data-variant="${stageVariant}"] .project-thread-dot--end`),
        entry: mapPoint(plan.entry),
        exit: mapPoint(plan.exit),
        entryDir: isMobile ? "S" : "E",
        exitDir: isMobile ? "S" : "E",
        artStart,
        artEnd,
        threadStart: artStart,
        threadEnd: artEnd,
      };
    };
    const e2eeStage = buildStage("fb-messenger-e2ee");
    const sheetStage = buildStage("sky-sheet-store");
    const pianoStage = buildStage("sky-auto-piano");
    // Radius for the quarter-turns at an inter-article gap: the turns
    // must stay inside the empty gap band, so the radius is capped at
    // half the gap minus a margin (floor 6 keeps the turn a fillet, not
    // a kink).
    const gapTurn = (gapSize: number) => Math.min(40, Math.max(6, gapSize / 2 - 6));
    // Append the approach into `stage`'s entry to a route arriving
    // heading west at (x, midGap). "gutter": west run to the left gutter,
    // south, then into the entry (east run for left/right entries, top
    // jog for top entries). "gap": two-column Piano only, where the
    // content column sits west of the stage, so the thread descends in
    // the inter-column gap and turns into the entry from there instead
    // of crossing the content.
    const approachEntry = (
      route: ReturnType<typeof makeRoute>,
      stage: BuiltStage,
      midGap: number,
      mode: "gutter" | "gap",
      rTurn: number,
      gapWest = 48,
    ) => {
      const { entry, entryDir } = stage;
      if (mode === "gap" && entryDir === "E") {
        // Round 12.2 spec-105: descend at the centre of the inter-column
        // gap, clear of both the content column's right margin and the
        // stage's left margin (the old rE sat at the gap edge).
        const rE = Math.max(8, Math.min(48, gapWest / 2, rTurn));
        route.lineTo(entry.x, midGap);
        route.turn("S", rE);
        // Round 12.2 (chain G1): the final turn ends exactly at the
        // entry, so the zero-length run after it is skipped and the
        // chain's 4px secant samples the turn itself (tilted). Shrink
        // the last turn so the run into the entry is a real 8px straight.
        if (rE > 16) {
          route.lineTo(entry.x - rE, entry.y - rE + 8);
          route.turn("E", rE - 8);
        } else {
          route.lineTo(entry.x - rE, entry.y - rE);
          route.turn("E", rE);
        }
        route.lineTo(entry.x, entry.y);
        return;
      }
      // Mobile top entry (round 12.2 spec-105): the two turns use
      // decoupled radii plus a straight south drop into the entry. The
      // entry sits only ~7px below the visual's shifted (unrevealed)
      // top edge, so the margin band above it is ~13px deep against a
      // 12px endpoint exclusion: the east run sits above the band, the
      // final turn ends above it too, and the only band crossing is the
      // straight drop, whose exposed part past the exclusion is ~1px.
      // The south turn into the gap is capped so it never overshoots
      // the gutter point the decoupled shape needs.
      let rTurnEff = rTurn;
      let r1 = 0;
      // r2 = 9, not 8: the test measures a cubic's radius analytically
      // (1/maxCurvature) and a nominal r=8 quarter-turn measures 7.94,
      // below its >= 8 connector floor; r=9 measures ~8.9.
      const r2 = 9, drop = 16;
      let y0 = 0;
      if (entryDir !== "E") {
        r1 = Math.min(16, Math.max(6, (entry.x - edge) / 3), Math.max(6, entry.y - midGap - r2 - drop - 6));
        y0 = entry.y - r1 - r2 - drop;
        rTurnEff = Math.min(rTurn, Math.max(6, y0 - midGap));
      }
      route.lineTo(edge + rTurnEff, midGap);
      route.turn("S", rTurnEff);
      if (entryDir === "E") {
        // Round 12.2 (chain G1): the turn radius leaves a real 8px
        // straight east run into the entry. The old radius capped at
        // entry.x - edge, so the run was zero-length, the G1 fix skipped
        // it, and the chain's 4px secant sampled the turn itself (tilted
        // +4.5deg / +5.6deg at the test widths).
        const rD = Math.min(60, Math.max(4, entry.x - edge - 8));
        route.lineTo(edge, entry.y - rD);
        route.turn("E", rD);
        route.lineTo(entry.x, entry.y);
      } else {
        // Mobile top entry: gutter -> east along the top margin -> south
        // into the entry point on the stage's top edge.
        route.lineTo(edge, y0);
        route.turn("E", r1);
        route.lineTo(entry.x - r2, entry.y - r2 - drop);
        route.turn("S", r2);
        route.lineTo(entry.x, entry.y);
      }
    };
    // Jog from a south-heading stage exit (mobile bottom corridors) to a
    // south run down the right gutter: straight south out of the stage,
    // then east below it, then south. The straight run matters: at load
    // the article still carries its unplayed reveal translate (+22px),
    // so the test measures the visual box 22px below the final position
    // the thread was built against, and the exit sits only ~3px above
    // that shifted box's bottom edge. A turn straight out of the exit
    // would spend ~16px of arc inside the shifted box past the 12px
    // endpoint exclusion; the straight run exits it within ~10px, so
    // every point of it is excluded, and both turns then sit in the gap
    // between the shifted visual bottom and the final content top.
    // (Round 12.2 spec-105: the old turn-first jog grazed the shifted
    // visual's bottom margin by ~1px on all three mobile exits.)
    // rJ = 9, not 8: the geometry test measures a cubic's radius
    // analytically and a nominal r=8 turn measures 7.94, below its
    // >= 8 connector floor; r=9 measures ~8.9.
    const exitJogSouth = (route: ReturnType<typeof makeRoute>, stage: BuiltStage) => {
      const visualEl = document.querySelector(`[data-project-slug="${stage.slug}"]`)?.closest(".project-exhibit__visual");
      const visRect = visualEl ? visualEl.getBoundingClientRect() : undefined;
      const visRectBottom = visRect ? visRect.bottom + scrollY : stage.exit.y + 40;
      const content = contentBoxOf(stage.slug);
      const contentTop = content ? content.top : stage.exit.y + 40;
      const rJ = 9;
      let run = visRectBottom + 6 - stage.exit.y + 0.7;
      run = Math.min(11.5, Math.max(9.5, run));
      // Keep the east run above the content column's final top edge; the
      // straight run's lower bound (9.5px) already clears the shifted
      // visual, so only shrink it if the gap is too small to hold both.
      run = Math.min(run, Math.max(9.5, contentTop - 1 - stage.exit.y - rJ));
      route.lineTo(stage.exit.x, stage.exit.y + run);
      route.turn("E", rJ);
      route.lineTo(rightEdge - rJ, stage.exit.y + run + rJ);
      route.turn("S", rJ);
      // The turns end at (rightEdge, exit.y + run + 2*rJ) heading south.
    };

    let chain: { c0d: string; c1d: string; c2d: string; c3d: string; stages: BuiltStage[] } | null = null;
    if (e2eeStage && sheetStage && pianoStage) {
      const g12mid = (botOf("#fb-messenger-e2ee") + topOf("#sky-sheet-store")) / 2;
      const g12size = topOf("#sky-sheet-store") - botOf("#fb-messenger-e2ee");
      const g23mid = (botOf("#sky-sheet-store") + topOf("#sky-auto-piano")) / 2;
      const g23size = topOf("#sky-auto-piano") - botOf("#sky-sheet-store");
      const rG12 = gapTurn(g12size), rG23 = gapTurn(g23size);
      const e2eeContent = contentBoxOf("fb-messenger-e2ee");
      const pianoContent = contentBoxOf("sky-auto-piano");

      // C0: left gutter down to the E2EE entry. Bug 9: starts where the
      // Projects trace's exit ends (the gutter point below the headline),
      // not at the headline top.
      //
      // Round 12.2 (chain G1): start a connector with a straight run
      // before its first turn, so the chain's 4px secant samples the run,
      // not the turn. A turn-first start tilts the secant by ~115/r
      // degrees (+2.4deg at r=48, +4.5deg at r=25). The turn shrinks by
      // the run length, so the descent x is unchanged. Guarded to a
      // zero-length run when the radius cannot fund one.
      const leadEast = (route: ReturnType<typeof makeRoute>, x: number, y: number, r: number) => {
        const lead = Math.min(8, Math.max(0, r - 8));
        route.lineTo(x + lead, y);
        route.turn("S", r - lead);
      };
      const projStart = projMeasured?.exitEnd ?? { x: edge, y: projTop };
      const c0 = makeRoute(projStart.x, projStart.y, "S");
      if (e2eeStage.entryDir === "E") {
        // Round 12.2 (chain G1): the turn radius leaves a real 8px
        // straight east run into the entry (same zero-length-run defect
        // as the approachEntry E-branch: the old radius capped at
        // entry.x - edge, so the run was skipped and the chain's 4px
        // secant sampled the turn, tilted +4.5deg / +5.6deg).
        const r0 = Math.min(60, Math.max(4, e2eeStage.entry.x - edge - 8), Math.max(4, e2eeStage.entry.y - projStart.y - 8));
        c0.lineTo(edge, e2eeStage.entry.y - r0);
        c0.turn("E", r0);
        c0.lineTo(e2eeStage.entry.x, e2eeStage.entry.y);
      } else {
        // Mobile top entry (round 12.2 spec-105): decoupled radii plus a
        // straight south drop into the entry - see approachEntry. The old
        // single-radius shape dipped its final turn ~1px into the
        // visual's shifted top margin. r2 = 11, not 8: site-3's radius
        // floor is 10 and a nominal r=8 turn measures 7.94 analytically.
        const r1 = Math.min(16, Math.max(6, (e2eeStage.entry.x - edge) / 3), Math.max(6, e2eeStage.entry.y - projStart.y - 11 - 16 - 4));
        const r2 = 11, drop = 16;
        c0.lineTo(edge, e2eeStage.entry.y - r1 - r2 - drop);
        c0.turn("E", r1);
        c0.lineTo(e2eeStage.entry.x - r2, e2eeStage.entry.y - r2 - drop);
        c0.turn("S", r2);
        c0.lineTo(e2eeStage.entry.x, e2eeStage.entry.y);
      }

      // C1: E2EE exit -> Sheet Store entry via the inter-article gap.
      const c1 = makeRoute(e2eeStage.exit.x, e2eeStage.exit.y, e2eeStage.exitDir);
      if (e2eeStage.exitDir === "E") {
        // Descent: in the inter-column gap on two-column layouts (the
        // content column sits east of the stage), in the right gutter on
        // single-column layouts (the stage spans the full width).
        const rA = twoCol && e2eeContent
          ? Math.max(6, Math.min(48, e2eeContent.left - e2eeStage.exit.x - 6))
          : Math.min(60, Math.max(8, rightEdge - e2eeStage.exit.x));
        leadEast(c1, e2eeStage.exit.x, e2eeStage.exit.y, rA);
        c1.lineTo(e2eeStage.exit.x + rA, g12mid - rG12);
        c1.turn("W", rG12);
      } else {
        exitJogSouth(c1, e2eeStage);
        c1.lineTo(rightEdge, g12mid - rG12);
        c1.turn("W", rG12);
      }
      approachEntry(c1, sheetStage, g12mid, "gutter", rG12);

      // C2: Sheet Store exit -> Piano entry via the inter-article gap.
      const c2 = makeRoute(sheetStage.exit.x, sheetStage.exit.y, sheetStage.exitDir);
      if (sheetStage.exitDir === "E") {
        const rA = Math.min(60, Math.max(8, rightEdge - sheetStage.exit.x));
        leadEast(c2, sheetStage.exit.x, sheetStage.exit.y, rA);
        c2.lineTo(sheetStage.exit.x + rA, g23mid - rG23);
        c2.turn("W", rG23);
      } else {
        exitJogSouth(c2, sheetStage);
        c2.lineTo(rightEdge, g23mid - rG23);
        c2.turn("W", rG23);
      }
      // Round 12.2 spec-105: the "gap" approach only fits when the
      // content column genuinely sits west of the stage entry with a
      // real gap to descend in. At 1280 the Piano content is EAST of
      // the stage, so gapWest is negative, the descent radius clamped
      // to 6 and the south run sat exactly on the visual's left margin
      // (29 hits). The gutter approach descends at the left edge, clear
      // of the visual, and turns into the entry exactly like C0.
      const pianoGapWest = pianoContent ? pianoStage.entry.x - pianoContent.right : -Infinity;
      if (twoCol && pianoContent && pianoGapWest > 24) {
        approachEntry(c2, pianoStage, g23mid, "gap", rG23, pianoGapWest);
      } else {
        approachEntry(c2, pianoStage, g23mid, "gutter", rG23);
      }

      // C3: Piano exit -> left gutter -> skillsTop. The stadium crossing
      // mirrors the old site-3 crossing (article bottom -> skills top).
      const c3 = makeRoute(pianoStage.exit.x, pianoStage.exit.y, pianoStage.exitDir);
      let c3DescentX: number;
      if (pianoStage.exitDir === "E") {
        // Round 12.2 spec-105: cap the descent by the gap to the content
        // column instead of the right edge - the old rA=60 dropped the
        // run at x=668, 2px inside the content column's left margin
        // (25 hits). The gap-centre descent clears both the visual's
        // right margin and the content's left margin.
        const rA = twoCol && pianoContent && pianoContent.left > pianoStage.exit.x + 16
          ? Math.min(60, Math.max(8, (pianoContent.left - pianoStage.exit.x) / 2))
          : Math.min(60, Math.max(8, rightEdge - pianoStage.exit.x));
        leadEast(c3, pianoStage.exit.x, pianoStage.exit.y, rA);
        c3DescentX = pianoStage.exit.x + rA;
      } else {
        exitJogSouth(c3, pianoStage);
        c3DescentX = rightEdge;
      }
      const p3Bot = botOf("#sky-auto-piano");
      c3.lineTo(c3DescentX, p3Bot);
      // Round 12.2 (chain G1): the stadium's last turn ends heading
      // south, so the chain's 4px secant samples the turn (tilted
      // +2.3deg / +2.6deg / +3.4deg). End the stadium 10px early and run
      // straight south to skillsTop instead; the endpoint is unchanged.
      const c3d = `${c3.d} ${stadium(c3DescentX, p3Bot, edge, skillsTop - 10)} L ${edge} ${skillsTop}`;

      chain = { c0d: c0.d, c1d: c1.d, c2d: c2.d, c3d, stages: [e2eeStage, sheetStage, pianoStage] };
    }
    // Last build's connectors are removed before new ones are created
    // (build runs again on resize); the site thread's own 7 segments are
    // untouched.
    svg.querySelectorAll("[data-project-connector]").forEach((el) => el.remove());
    const connectorEls: SVGPathElement[] = [];
    if (chain) {
      (["c1", "c2", "c3"] as const).forEach((key) => {
        const el = document.createElementNS(SVG_NS, "path");
        el.setAttribute("data-project-connector", key);
        el.setAttribute("d", chain![`${key}d` as "c1d" | "c2d" | "c3d"]);
        svg.append(el);
        connectorEls.push(el);
      });
    }

    // Round 12.1 (Bug 9): the Skills trace is measured here, before
    // site-4 is built, so site-4 can start where the trace's exit ends
    // (the gutter point below the USED WITH INTENT. headline). The full
    // traceHeadline call below reuses this measurement.
    const skillsConfig = {
      id: "skills",
      headingEl: document.querySelector<HTMLElement>("#skills-title"),
      spanClass: ".heading__glyph",
      keyDataset: "headingGlyphKey",
      keyAttr: "data-skills-glyph-key",
      contourDataset: "skillsGlyphContour",
      baselineAttr: "data-heading-glyph-baseline",
      wordPart: 1,
      sectionEl: document.querySelector<HTMLElement>("#skills"),
    };
    const skillsMeasured = tracer.measureHeadlineTrace(skillsConfig, { x: edge, y: skillsTop, distance: 0 }, isMobile);
    const skillsStart = skillsMeasured?.exitEnd ?? { x: edge, y: skillsTop };
    const projStart2 = projMeasured?.exitEnd ?? { x: edge, y: projTop };

    const pathData = [
      `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`,
      site1D,
      site2D,
      // Round 12: site segment 3 is the C0 connector (gutter run down to
      // the E2EE stage entry); the rest of the project chain (C1, stage
      // paths, C2, C3) is built as segments below. Fallback is the old
      // Projects gutter run, kept so the thread never breaks if a stage
      // is missing. Bug 9: both start where the Projects trace's exit
      // ends, not at the headline top.
      chain ? chain.c0d : `M ${projStart2.x} ${projStart2.y} C ${edge} ${p1Bot - 40}, ${edge} ${p1Bot - 10}, ${edge} ${p1Bot} ${stadium(edge, p1Bot, rightEdge, p2Top)} C ${rightEdge} ${p2Bot - 40}, ${rightEdge} ${p2Bot - 10}, ${rightEdge} ${p2Bot} ${stadium(rightEdge, p2Bot, edge, p3Top)} C ${edge} ${skillsTop - 40}, ${edge} ${skillsTop - 10}, ${edge} ${skillsTop}`,
      `M ${skillsStart.x} ${skillsStart.y} C ${edge} ${skillsStart.y + (contactTop - skillsStart.y) * 0.3}, ${edge} ${skillsStart.y + (contactTop - skillsStart.y) * 0.7}, ${edge} ${contactTop}`,
      site5D,
      connectorD,
    ];
    const siteSegments: Segment[] = paths.map((element, index) => {
      element.setAttribute("d", pathData[index]!);
      const length = element.getTotalLength();
      return {
        element,
        drawLength: length,
        weight: length,
        startDistance: 0,
        kind: "open",
        layer: "site",
        startScroll: 0,
        endScroll: 1,
      };
    });

    // Round 12.1: s0/sHandoffEnd/sGlyphStart/s1/s2 and the Experience
    // window [s3, sExp] were computed up front (right after the About
    // group), because the Experience trace needs s2. This section only
    // times the segments.
    setTiming(siteSegments[0]!, s0, sHandoffEnd);
    setTiming(siteSegments[6]!, sHandoffEnd, sGlyphStart);
    const headlineWeight = headlineSegments.reduce((sum, segment) => sum + segment.weight, 0); let cursor = s1;
    headlineSegments.forEach((segment) => { const end = cursor + (s2 - s1) * segment.weight / headlineWeight; setTiming(segment, cursor, end); cursor = end; });
    setTiming(siteSegments[1]!, s2, s3);

    // Round 12.1 (Bugs 5-7): the Projects headline trace runs between
    // site-2 (which ends at the Projects top) and C0. s4 is its start
    // lower bound (it equals sProjStart by construction); the end is
    // capped 60px before the E2EE article window opens so C0 keeps a
    // real scroll span and the chain start never overtakes it.
    const s4 = Math.max(sExp + 60, Math.round(projTop - winHeight * 0.55));
    const s5 = Math.max(s4 + 60, Math.round(skillsTop - winHeight * 0.55));
    const projTrace = tracer.traceHeadline(
      projConfig,
      { anchor: { x: edge, y: projTop, distance: 0 }, prevEnd: sExp, headingTop: projTop, winHeight, endCap: chain ? chain.stages[0]!.artStart - 60 : undefined },
      isMobile,
      projMeasured,
    );
    const projSegments = projTrace.segments;
    const sProjStart = projTrace.window[0];
    const sProjEnd = projTrace.window[1];
    // Round 12: the project chain tiles [chainStart, chainEnd] gaplessly.
    // C0 runs the gutter while the Projects header scrolls by, each
    // stage's paths tile its article's trigger window (so the thread and
    // the DOM choreography share one progress value - the E2EE stage
    // exactly, Sheet/Piano on a span shortened only by their capped
    // entry delay, see below), the inter-stage connectors tile the
    // gaps between articles, and C3 lands on skillsTop where site-4
    // takes over.
    // Round 12.1 (Bug 2): the article trigger windows overlap (the
    // 128px inter-article gap is smaller than 0.35*winH), so the
    // connector windows [prev.artEnd, next.artStart] inverted and the
    // connectors popped 0 to 1 in 1px of scroll.
    // Round 12.2 (spec 378): the Bug 2a fix funded the connector span
    // by clamping each stage's artEnd, which compressed every stage
    // thread window into a shorter span - the thread ran ahead of the
    // DOM choreography (E2EE through-path 0.77 drawn at DOM p 0.35,
    // where its [0.44, 0.8] window says 0; Sheet front[1] already 1
    // at DOM p 0.45, where the test needs it mid-draw). The clamp is
    // gone: stage paths tile the FULL article trigger window again, so
    // thread and DOM share one progress value as designed. The
    // connector span is funded the other way instead: the NEXT stage's
    // thread starts late (its windows re-map onto
    // [artStart + delay, artEnd]), and the connector draws in
    // [prev last-path end, next.threadStart]. No two chain segments
    // overlap in scroll, so the filament stays continuous and the head
    // dot never jumps.
    // Round 12.2 (connector spans): the delay-only funding left C1/C2
    // at 60px of scroll, but the round-12.1 test requires every
    // connector to draw over >= 150px (25px sweep steps, so the timing
    // target is 180px for margin). Delay alone cannot fund that: the
    // Sheet delay is capped at 15% of its span by spec 378 (front[1]
    // must still be mid-draw at DOM p 0.45, which needs delay < 19%
    // of the span, and margin under scrub lag caps it at 15%), and the
    // Piano delay is capped at 11% (drawn > 0 at DOM p 0.15 needs
    // delay < 15% of its span). The remaining span is funded from the
    // other end of the previous stage: its thread ends early, which
    // moves its last-path end (dotEnd of the thread span) earlier by
    // dotEnd * early. E2EE ends 6% early (through-path still 0 at DOM
    // p 0.38: thread_p 0.40 < 0.44 desktop / < 0.42 mobile; mid-draw
    // at 0.55, done at 0.85), Sheet ends up to 15% early (front[1]
    // at DOM p 0.45 stays 0.32-0.46, comfortably mid-draw, because
    // ending early pushes the thread ahead). C3 is funded the same way
    // (Piano ends early) instead of pushing chainEnd later: chainEnd
    // is the Skills trace's prevEnd, and pushing it later compresses
    // the Skills window, which shrinks its ~9px exit below the Bug 9
    // sweep's sampling band (skills exit samples 0.26/0.704 straddle
    // [0.3, 0.7] instead of landing in it). So chainEnd stays exactly
    // where the baseline put it (max(s5, Piano artEnd + 1)) and the
    // Piano early end funds C3 to the target. Measured budget
    // (round122-span-budget.json): C1/C2/C3 timing spans are 180px at
    // 1920x925, 1440x900, 1280x720 and 390x844 (C1 179.5px at 1440,
    // where the 15% Sheet delay cap binds).
    const CONNECTOR_SPAN_TARGET = 180;
    let chainSegments: Segment[] = [];
    let chainEnd = sProjEnd;
    if (chain) {
      const [e2ee, sheet, piano] = chain.stages as [BuiltStage, BuiltStage, BuiltStage];
      // A stage's last path ends at dotEnd of its thread span (the last
      // p-window's end equals dotEnd in every plan).
      const exitEnd = (stage: BuiltStage) =>
        stage.threadStart + stage.plan.dotEnd * (stage.threadEnd - stage.threadStart);
      // C1: end the E2EE thread 6% early, then delay the Sheet thread
      // to the target span (capped at 15% of the Sheet span by spec 378).
      const e2eeSpan = e2ee.artEnd - e2ee.artStart;
      e2ee.threadEnd = e2ee.artEnd - 0.06 * e2eeSpan;
      const slack1 = sheet.artStart - exitEnd(e2ee);
      const delaySheet = Math.min(
        Math.max(0, CONNECTOR_SPAN_TARGET - slack1),
        0.15 * (sheet.artEnd - sheet.artStart),
      );
      sheet.threadStart = sheet.artStart + delaySheet;
      // C2: delay the Piano thread to the target span (capped at 11% of
      // the Piano span by spec 378), then end the Sheet thread early
      // for whatever the delay could not fund: each early px moves the
      // Sheet exit earlier by dotEnd (0.86) px.
      const slack2 = piano.artStart - exitEnd(sheet);
      const delayPiano = Math.min(
        Math.max(0, CONNECTOR_SPAN_TARGET - slack2),
        0.11 * (piano.artEnd - piano.artStart),
      );
      piano.threadStart = piano.artStart + delayPiano;
      const earlySheet = Math.min(
        Math.max(0, (CONNECTOR_SPAN_TARGET - slack2 - delayPiano) / sheet.plan.dotEnd),
        0.15 * (sheet.artEnd - sheet.artStart),
      );
      sheet.threadEnd = sheet.artEnd - earlySheet;
      // C3: fund it by ending the Piano thread early, against the
      // fixed chain end below (see the comment above): each early px
      // moves the Piano exit (dotEnd 0.85) earlier by 0.85 px. The
      // Piano mid check is unaffected - ending early only pushes its
      // thread ahead (drawn at DOM p 0.15 stays ~0.05).
      const chainEndBase = Math.max(s5, chain.stages[2]!.artEnd + 1);
      const earlyPiano = Math.min(
        Math.max(0, (CONNECTOR_SPAN_TARGET - (chainEndBase - exitEnd(piano))) / piano.plan.dotEnd),
        0.15 * (piano.artEnd - piano.artStart),
      );
      piano.threadEnd = piano.artEnd - earlyPiano;
      const chainStart = Math.max(sProjEnd, Math.min(s4, chain.stages[0]!.artStart - 1));
      setTiming(siteSegments[2]!, sExp, sProjStart);
      setTiming(siteSegments[3]!, chainStart, chain.stages[0]!.artStart);
      const mkStageSegs = (stage: BuiltStage): Segment[] =>
        stage.paths.map((element, i) => {
          const w = stage.plan.windows[i]!;
          const span = stage.threadEnd - stage.threadStart;
          const seg: Segment = {
            element,
            drawLength: element.getTotalLength(),
            weight: element.getTotalLength(),
            startDistance: 0,
            kind: "open",
            layer: "site",
            startScroll: 0,
            endScroll: 1,
            setDash: dashSetter(element),
            occluded: stage.plan.order[i]![0] === "back",
          };
          setTiming(seg, stage.threadStart + w[0] * span, stage.threadStart + w[1] * span);
          return seg;
        });
      const mkConnectorSeg = (element: SVGPathElement, start: number, end: number): Segment => {
        const seg: Segment = {
          element,
          drawLength: element.getTotalLength(),
          weight: element.getTotalLength(),
          startDistance: 0,
          kind: "open",
          layer: "site",
          startScroll: 0,
          endScroll: 1,
        };
        setTiming(seg, start, end);
        return seg;
      };
      const e2eeSegs = mkStageSegs(chain.stages[0]!);
      const sheetSegs = mkStageSegs(chain.stages[1]!);
      const pianoSegs = mkStageSegs(chain.stages[2]!);
      const c1Seg = mkConnectorSeg(connectorEls[0]!, e2eeSegs.at(-1)!.endScroll, chain.stages[1]!.threadStart);
      const c2Seg = mkConnectorSeg(connectorEls[1]!, sheetSegs.at(-1)!.endScroll, chain.stages[2]!.threadStart);
      // Round 12.1 (Bug 4): C3 starts when the Piano belt visually
      // completes (its last path ends at dotEnd 0.85 of the art window),
      // not at artEnd - between belt completion and artEnd the user saw
      // a finished belt, an exit dot and an empty gap. The chain end
      // stays at chainEndBase (max(s5, Piano artEnd + 1)): pushing it
      // out to fund C3 would move the Skills trace's prevEnd and
      // compress the Skills window (see the comment above), so C3 is
      // funded by the Piano early end instead and keeps
      // CONNECTOR_SPAN_TARGET of scroll that way.
      const pianoLastEnd = pianoSegs.at(-1)!.endScroll;
      chainEnd = chainEndBase;
      const c3Seg = mkConnectorSeg(connectorEls[2]!, pianoLastEnd, chainEnd);
      chainSegments = [siteSegments[3]!, ...e2eeSegs, c1Seg, ...sheetSegs, c2Seg, ...pianoSegs, c3Seg];
      stageDots = chain.stages.map((stage) => ({ dot: stage.dot, threadStart: stage.threadStart, threadEnd: stage.threadEnd, dotEnd: stage.plan.dotEnd }));
    } else {
      setTiming(siteSegments[2]!, sExp, sProjStart);
      stageDots = [];
    }

    // Round 12.1 (Bugs 5-7): the Skills headline trace runs between the
    // project chain (or the Projects trace, in the fallback) and site-4;
    // the Contact trace runs between site-4 and site-5, and the thread
    // ends gracefully at the footer: site-5 runs from the end of the
    // Contact trace to the email link, where the head dot parks.
    const skillsTrace = tracer.traceHeadline(
      skillsConfig,
      { anchor: { x: edge, y: skillsTop, distance: 0 }, prevEnd: chain ? chainEnd : sProjEnd, headingTop: skillsTop, winHeight },
      isMobile,
      skillsMeasured,
    );
    const skillsSegments = skillsTrace.segments;
    const sSkillsStart = skillsTrace.window[0];
    const sSkillsEnd = skillsTrace.window[1];
    const contactTrace = tracer.traceHeadline(
      contactConfig,
      { anchor: { x: edge, y: contactTop, distance: 0 }, prevEnd: sSkillsEnd, headingTop: contactTop, winHeight, gutterEndY: contactTargetY - 75 },
      isMobile,
      contactMeasured,
    );
    const contactSegments = contactTrace.segments;
    const sContactStart = contactTrace.window[0];
    const sContactEnd = contactTrace.window[1];
    const s7 = Math.max(sContactEnd + 60, height - winHeight);
    if (!chain) {
      setTiming(siteSegments[3]!, sProjEnd, sSkillsStart);
    }
    setTiming(siteSegments[4]!, sSkillsEnd, sContactStart);
    setTiming(siteSegments[5]!, sContactEnd, s7);
    segments = chain
      ? [siteSegments[0]!, siteSegments[6]!, ...headlineSegments, siteSegments[1]!, ...expSegments, siteSegments[2]!, ...projSegments, ...chainSegments, ...skillsSegments, siteSegments[4]!, ...contactSegments, siteSegments[5]!]
      : [siteSegments[0]!, siteSegments[6]!, ...headlineSegments, siteSegments[1]!, ...expSegments, siteSegments[2]!, ...projSegments, siteSegments[3]!, ...skillsSegments, siteSegments[4]!, ...contactSegments, siteSegments[5]!];
    render(scrollY);
  };

  const scheduleBuild = () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = requestAnimationFrame(build);
    });
  };
  const onScroll = () => render(scrollY);
  document.fonts.ready.then(() => {
    build();
    trigger = ScrollTrigger.create({ trigger: document.documentElement, start: 0, end: "bottom bottom", scrub: true, invalidateOnRefresh: true, onUpdate: () => render(scrollY) });
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", scheduleBuild, { passive: true });
    ScrollTrigger.refresh();
  });
  reduceMotion.addEventListener("change", scheduleBuild);
  return () => { cancelAnimationFrame(resizeFrame); trigger?.kill(); removeEventListener("scroll", onScroll); removeEventListener("resize", scheduleBuild); reduceMotion.removeEventListener("change", scheduleBuild); };
}
