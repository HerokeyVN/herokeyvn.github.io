import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { dashSetter } from "./project-threads";
import { ABOUT_EXIT_JUNCTION_FRACTIONS, findExpTransition, findTransition, type AnchorPreference, type GlyphTransition } from "../data/about-glyphs";

type Segment = {
  element?: SVGPathElement;
  drawLength: number;
  weight: number;
  startDistance: number;
  kind: "open" | "closed" | "hidden";
  layer: "site" | "glyph";
  startScroll: number;
  endScroll: number;
  // Round 12: stage paths are driven by the CTM-scaled dashSetter
  // (round-8 fix) instead of the site thread's user-unit dash, because
  // their SVGs use vector-effect: non-scaling-stroke.
  setDash?: (progress: number) => void;
  // Round 12: a stage path on the thread-back layer runs behind a
  // foreground structure; the head dot hides while it draws, so the dot
  // never floats over a frame the thread passes behind.
  occluded?: boolean;
};
type Junction = { x: number; y: number; distance: number };
type GlyphRecord = { key: string; left: number; top: number; baselineY: number; scale: number; paths: SVGPathElement[]; junctions: Junction[]; lineIndex: number };
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
    lineTo(nx: number, ny: number) { d += ` L ${nx} ${ny}`; x = nx; y = ny; },
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
  // floats at a stage exit the thread has not reached).
  let stageDots: { dot: SVGCircleElement | null; artStart: number; artEnd: number; dotEnd: number }[] = [];
  const updateStageDots = (currentScroll: number, forceFull = false) => {
    for (const { dot, artStart, artEnd, dotEnd } of stageDots) {
      if (!dot) continue;
      if (forceFull) { dot.style.removeProperty("opacity"); continue; }
      const p = gsap.utils.clamp(0, 1, (currentScroll - artStart) / (artEnd - artStart));
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

  // One-sided contour tangents at a junction (closed contour, so the
  // samples wrap). The thread arrives at a junction along contourArrival
  // and leaves along contourDeparture; at a sharp corner they differ, and
  // a centred average would point diagonally across the corner (the "."
  // junction measured 45deg that way, while its true arrival is straight
  // up). Connectors depart along the arrival direction and arrive along
  // the departure direction; the site-1 exit departs along the arrival
  // direction.
  const contourTangentAt = (path: SVGPathElement, distance: number, forward: boolean) => {
    const length = path.getTotalLength();
    if (length <= 0) return { x: 1, y: 0 };
    const eps = Math.min(12, length / 4);
    const at = forward ? distance : (distance - eps + length) % length;
    const to = forward ? (distance + eps) % length : distance;
    const a = pointInSiteSpace(path, at);
    const b = pointInSiteSpace(path, to);
    if (!a || !b) return { x: 1, y: 0 };
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    return len > 0 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };
  };
  const contourArrival = (path: SVGPathElement, distance: number) => contourTangentAt(path, distance, false);
  const contourDeparture = (path: SVGPathElement, distance: number) => contourTangentAt(path, distance, true);
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

  const findJunction = (
    path: SVGPathElement,
    originX: number,
    baselineY: number,
    scale: number,
    pref?: AnchorPreference,
  ): Junction => {
    const length = path.getTotalLength();
    const samples = 120;
    const mode = pref?.mode ?? "top";

    if (mode === "fraction") {
      const distance = length * Math.max(0, Math.min(1, pref?.fraction ?? 0));
      const point = path.getPointAtLength(distance);
      return { x: originX + point.x * scale, y: baselineY + point.y * scale, distance };
    }

    let best = { x: 0, y: 0, distance: 0 };
    let bestMetric = (mode === "top" || mode === "left") ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

    for (let i = 0; i <= samples; i++) {
      const distance = (length * i) / samples;
      const point = path.getPointAtLength(distance);
      const metric = (mode === "top" || mode === "bottom") ? point.y : point.x;
      if (mode === "top" || mode === "left") {
        if (metric < bestMetric) {
          bestMetric = metric;
          best = { x: point.x, y: point.y, distance };
        }
      } else {
        if (metric > bestMetric) {
          bestMetric = metric;
          best = { x: point.x, y: point.y, distance };
        }
      }
    }
    return { x: originX + best.x * scale, y: baselineY + best.y * scale, distance: best.distance };
  };

  const createConnector = (
    fromGlyph: GlyphRecord,
    toGlyph: GlyphRecord,
    from: Junction,
    to: Junction,
    sameLine: boolean,
    fontSize: number,
    trans?: GlyphTransition,
  ): Segment => {
    const isVisible = Boolean(sameLine && trans && trans.visibility === "visible");
    if (!isVisible) {
      return {
        drawLength: 0,
        weight: Math.max(fontSize * 0.22, Math.hypot(to.x - from.x, to.y - from.y) * 0.18),
        startDistance: 0,
        kind: "hidden",
        layer: "glyph",
        startScroll: 0,
        endScroll: 1,
      };
    }
    const element = document.createElementNS(SVG_NS, "path");
    element.dataset.glyphConnector = "";
    element.setAttribute("data-from-glyph", fromGlyph.key);
    element.setAttribute("data-to-glyph", toGlyph.key);
    // Round 11: the connector departs along the from-contour's travel
    // direction at the junction and arrives along the to-contour's travel
    // direction, so it meets each glyph outline tangentially (G1) instead
    // of leaving/arriving horizontally with a ~90deg kink at both ends.
    // The handle scales with the chord (up to 26px): the old 8px minimum
    // made a tall bump over the tiny 7-8px inter-letter gaps (length ratio
    // ~2.0, failing the glyph test's 1.4 cap), and even a 2px floor kept
    // mobile's 3.8px gaps at 1.43, so small gaps now get a shallow arch
    // instead. x stays monotonic because both control points sit on the
    // junctions' verticals.
    const chord = Math.hypot(to.x - from.x, to.y - from.y);
    const handle = Math.min(26, chord * 0.35);
    const vFrom = contourArrival(fromGlyph.paths[0]!, from.distance);
    const vTo = contourDeparture(toGlyph.paths[0]!, to.distance);
    const cp1x = from.x + vFrom.x * handle;
    const cp1y = from.y + vFrom.y * handle;
    const cp2x = to.x - vTo.x * handle;
    const cp2y = to.y - vTo.y * handle;
    element.setAttribute("d", `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`);
    connectorGroup.append(element);
    const length = element.getTotalLength();
    return { element, drawLength: length, weight: length, startDistance: 0, kind: "open", layer: "glyph", startScroll: 0, endScroll: 1 };
  };

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
    // Round 12: glyph collection is shared by the About headline and the
    // Experience headline (same contour/transform/connector mechanism,
    // different span/path selectors and transition plans).
    const collectGlyphs = (
      spanSelector: string,
      keyAttr: string,
      keyDataset: "glyphKey" | "expGlyphKey",
      contourDataset: "glyphContour" | "expGlyphContour",
      baselineAttr: string,
      wordPart: number,
    ): GlyphRecord[] =>
      [...document.querySelectorAll<HTMLElement>(spanSelector)].map((element) => {
        const key = element.dataset[keyDataset]!;
        const wordIndex = Number(key.split("-")[wordPart]);
        const baseline = document.querySelector<HTMLElement>(`[${baselineAttr}='${wordIndex}']`)!;
        const box = docBox(element), baselineBox = docBox(baseline);
        const scale = Number.parseFloat(getComputedStyle(element).fontSize) / 1000;
        const originX = box.left, baselineY = baselineBox.top;
        const glyphPaths = [...glyphSvg.querySelectorAll<SVGPathElement>(`path[${keyAttr}='${key}']`)].sort((a, b) => Number(a.dataset[contourDataset]) - Number(b.dataset[contourDataset]));
        glyphPaths.forEach((path) => path.setAttribute("transform", `translate(${originX} ${baselineY}) scale(${scale})`));
        return {
          key,
          left: originX,
          top: box.top,
          baselineY,
          scale,
          paths: glyphPaths,
          junctions: [],
          lineIndex: 0,
        };
      });
    // Group measured glyphs into rendered lines, resolve each outer
    // contour's junction, and build the ordered contour/connector/hidden
    // segments for one headline. `snake` reverses even lines (About);
    // `lastFractions` overrides the last glyph's junction by key (the
    // About exit corner: "." on two/three lines, "U" on one line).
    const buildGlyphGroup = (
      rawGlyphs: GlyphRecord[],
      groupFontSize: number,
      findTrans: (from: string, to: string, isMobile: boolean) => GlyphTransition | undefined,
      snake: boolean,
      lastFractions?: Record<string, number>,
    ): { order: GlyphRecord[]; segments: Segment[] } => {
      const lines: GlyphRecord[][] = [];
      [...rawGlyphs].sort((a, b) => a.top - b.top || a.left - b.left).forEach((glyph) => { const line = lines.find((items) => Math.abs(items[0]!.top - glyph.top) < 4); line ? line.push(glyph) : lines.push([glyph]); });
      lines.forEach((line, lineIndex) => { line.forEach((glyph) => { glyph.lineIndex = lineIndex; }); line.sort((a, b) => a.left - b.left); if (snake && lineIndex % 2 === 0) line.reverse(); });
      const order = lines.flat();
      order.forEach((glyph, i) => {
        const prev = order[i - 1];
        const next = order[i + 1];
        let pref: AnchorPreference | undefined;

        if (next && glyph.lineIndex === next.lineIndex) {
          const trans = findTrans(glyph.key, next.key, isMobile);
          if (trans && trans.visibility === "visible" && trans.fromAnchor) {
            pref = trans.fromAnchor;
          }
        }
        if (!pref && prev && glyph.lineIndex === prev.lineIndex) {
          const trans = findTrans(prev.key, glyph.key, isMobile);
          if (trans && trans.visibility === "visible" && trans.toAnchor) {
            pref = trans.toAnchor;
          }
        }
        if (lastFractions?.[glyph.key] !== undefined && i === order.length - 1) {
          pref = { mode: "fraction", fraction: lastFractions[glyph.key]! };
        }
        if (!pref) {
          pref = { mode: "top" };
        }

        glyph.junctions = glyph.paths.map((path, contourIndex) =>
          findJunction(path, glyph.left, glyph.baselineY, glyph.scale, contourIndex === 0 ? pref : undefined),
        );
      });

      const segments: Segment[] = [];
      order.forEach((glyph, glyphIndex) => {
        glyph.paths.forEach((path, contourIndex) => {
          if (contourIndex > 0) segments.push({ drawLength: 0, weight: Math.max(18, groupFontSize * 0.18), startDistance: 0, kind: "hidden", layer: "glyph", startScroll: 0, endScroll: 1 });
          const length = path.getTotalLength();
          segments.push({ element: path, drawLength: length, weight: length * glyph.scale, startDistance: glyph.junctions[contourIndex]!.distance, kind: "closed", layer: "glyph", startScroll: 0, endScroll: 1 });
          if (contourIndex > 0) segments.push({ drawLength: 0, weight: Math.max(18, groupFontSize * 0.18), startDistance: 0, kind: "hidden", layer: "glyph", startScroll: 0, endScroll: 1 });
        });
        const next = order[glyphIndex + 1];
        if (next) {
          const sameLine = glyph.lineIndex === next.lineIndex;
          const trans = sameLine ? findTrans(glyph.key, next.key, isMobile) : undefined;
          segments.push(createConnector(glyph, next, glyph.junctions[0]!, next.junctions[0]!, sameLine, groupFontSize, trans));
        }
      });
      return { order, segments };
    };

    const fontSize = Number.parseFloat(getComputedStyle(document.querySelector<HTMLElement>(".about__glyph")!).fontSize);
    const aboutGroup = buildGlyphGroup(
      collectGlyphs(".about__glyph[data-glyph-key]", "data-glyph-key", "glyphKey", "glyphContour", "data-glyph-baseline", 0),
      fontSize,
      findTransition,
      true,
      ABOUT_EXIT_JUNCTION_FRACTIONS,
    );
    const glyphOrder = aboutGroup.order;
    const headlineSegments = aboutGroup.segments;
    if (!glyphOrder.length) return;
    // Round 12: the Experience headline trace (same mechanism, reading
    // order on both lines, no snake reversal). Absent (e.g. a heading
    // without the trace prop) the page simply has no exp segments.
    const expGlyphEl = document.querySelector<HTMLElement>(".exp__glyph");
    const expFontSize = expGlyphEl ? Number.parseFloat(getComputedStyle(expGlyphEl).fontSize) : fontSize;
    const expGroup = expGlyphEl
      ? buildGlyphGroup(
        collectGlyphs(".exp__glyph[data-exp-glyph-key]", "data-exp-glyph-key", "expGlyphKey", "expGlyphContour", "data-exp-glyph-baseline", 1),
        expFontSize,
        findExpTransition,
        false,
      )
      : { order: [] as GlyphRecord[], segments: [] as Segment[] };
    const expOrder = expGroup.order;

    const first = glyphOrder[0]!.junctions[0]!, last = glyphOrder.at(-1)!.junctions[0]!;
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
    const connL1 = (isMobile ? 1.1 : 0.5) * connDx;
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
    const contactHandle = emailGap >= 20 ? 28 : 16;
    const approachCp2x = contactTargetX - Math.cos(contactTheta) * contactHandle;
    const approachCp2y = contactTargetY - Math.sin(contactTheta) * contactHandle;
    const gutterEndY = contactTargetY - 75;
    const site5D = `M ${edge} ${contactTop} C ${edge} ${contactTop + (gutterEndY - contactTop) / 3}, ${edge} ${contactTop + (2 * (gutterEndY - contactTop)) / 3}, ${edge} ${gutterEndY} C ${edge} ${contactTargetY - 31}, ${approachCp2x} ${approachCp2y}, ${contactTargetX} ${contactTargetY}`;

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
      // Narrow (dx <= 22, mobile): start below the title (dy ~24). The
      // short ramp's radius is 8-9 there, and the title clearance is
      // hypot(dx-5, 6) >= 13.
      // Wide (dx > 22): start 7px above the title (dy ~50). The longer
      // run opens the radius to 20+ and the title clearance to 12+.
      // A single geometry cannot satisfy both bars at both ends: the
      // long entry's title clearance drops to ~6.5 at dx=17, and the
      // short entry's radius drops to ~5 at dx=35.
      const dx = mx - edge;
      const yB = dx <= 22 ? titleBottom + 6 : titleTop - 7;
      let exitD: string;
      if (width <= 1024) {
        // Single column (sidebar on top): exit in the gap between the
        // sidebar and the initiatives, so the run never crosses a card.
        const yC = botOf(".experience__sidebar") + 10;
        const yD = topOf(".experience__initiatives") - 10;
        exitD = `L ${mx} ${yC} ${rampV(mx, yC, edge, yD)} L ${edge} ${projTop}`;
      } else {
        // Two columns: exit below the whole dossier, in the clear gap
        // before the Projects section.
        const yC = botOf(".experience__dossier") + 14;
        const yD = projTop - 20;
        exitD = `L ${mx} ${yC} ${rampV(mx, yC, edge, yD)} L ${edge} ${projTop}`;
      }
      site2D = `M ${edge} ${expTop} L ${edge} ${yB} ${rampV(edge, yB, mx, m1.y)} L ${mx} ${m2.y} ${exitD}`;
    } else {
      site2D = `M ${edge} ${expTop} C ${edge} ${expTop + (projTop - expTop) * 0.3}, ${edge} ${expTop + (projTop - expTop) * 0.7}, ${edge} ${projTop}`;
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
      return {
        slug, plan, paths,
        dot: stage.querySelector<SVGCircleElement>(`svg[data-variant="${stageVariant}"] .project-thread-dot--end`),
        entry: mapPoint(plan.entry),
        exit: mapPoint(plan.exit),
        entryDir: isMobile ? "S" : "E",
        exitDir: isMobile ? "S" : "E",
        artStart: artBox.top - 0.8 * winHeight,
        artEnd: Math.max(artBox.top - 0.8 * winHeight + 1, artBox.bottom - 0.45 * winHeight),
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
        const rE = Math.max(6, Math.min(48, gapWest - 6, rTurn));
        route.lineTo(entry.x, midGap);
        route.turn("S", rE);
        route.lineTo(entry.x - rE, entry.y - rE);
        route.turn("E", rE);
        route.lineTo(entry.x, entry.y);
        return;
      }
      route.lineTo(edge + rTurn, midGap);
      route.turn("S", rTurn);
      if (entryDir === "E") {
        const rD = Math.min(60, Math.max(4, entry.x - edge));
        route.lineTo(edge, entry.y - rD);
        route.turn("E", rD);
        route.lineTo(entry.x, entry.y);
      } else {
        // Mobile top entry: gutter -> east along the top margin -> south
        // into the entry point on the stage's top edge.
        const rr = Math.min(16, Math.max(6, (entry.x - edge) / 3));
        route.lineTo(edge, entry.y - 2 * rr);
        route.turn("E", rr);
        route.lineTo(entry.x - rr, entry.y - rr);
        route.turn("S", rr);
        route.lineTo(entry.x, entry.y);
      }
    };
    // Jog from a south-heading stage exit (mobile bottom corridors) to a
    // south run down the right gutter: east below the stage, then south.
    // The jog stays above the article's content column (gap 2.5rem on
    // single-column layouts), so both radii are capped at half that gap.
    const exitJogSouth = (route: ReturnType<typeof makeRoute>, stage: BuiltStage) => {
      const content = contentBoxOf(stage.slug);
      const contentTop = content ? content.top : stage.exit.y + 40;
      const rJ = Math.min(24, Math.max(8, (contentTop - stage.exit.y) / 2 - 4));
      route.turn("E", rJ);
      route.lineTo(rightEdge - rJ, stage.exit.y + rJ);
      route.turn("S", rJ);
      // The turn already ends at (rightEdge, exit.y + 2*rJ) heading south.
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

      // C0: left gutter down to the E2EE entry.
      const c0 = makeRoute(edge, projTop, "S");
      if (e2eeStage.entryDir === "E") {
        const r0 = Math.min(60, Math.max(4, e2eeStage.entry.x - edge));
        c0.lineTo(edge, e2eeStage.entry.y - r0);
        c0.turn("E", r0);
        c0.lineTo(e2eeStage.entry.x, e2eeStage.entry.y);
      } else {
        const rr = Math.min(16, Math.max(6, (e2eeStage.entry.x - edge) / 3));
        c0.lineTo(edge, e2eeStage.entry.y - 2 * rr);
        c0.turn("E", rr);
        c0.lineTo(e2eeStage.entry.x - rr, e2eeStage.entry.y - rr);
        c0.turn("S", rr);
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
        c1.turn("S", rA);
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
        c2.turn("S", rA);
        c2.lineTo(sheetStage.exit.x + rA, g23mid - rG23);
        c2.turn("W", rG23);
      } else {
        exitJogSouth(c2, sheetStage);
        c2.lineTo(rightEdge, g23mid - rG23);
        c2.turn("W", rG23);
      }
      if (twoCol && pianoContent) {
        approachEntry(c2, pianoStage, g23mid, "gap", rG23, pianoStage.entry.x - pianoContent.right);
      } else {
        approachEntry(c2, pianoStage, g23mid, "gutter", rG23);
      }

      // C3: Piano exit -> left gutter -> skillsTop. The stadium crossing
      // mirrors the old site-3 crossing (article bottom -> skills top).
      const c3 = makeRoute(pianoStage.exit.x, pianoStage.exit.y, pianoStage.exitDir);
      let c3DescentX: number;
      if (pianoStage.exitDir === "E") {
        const rA = Math.min(60, Math.max(8, rightEdge - pianoStage.exit.x));
        c3.turn("S", rA);
        c3DescentX = pianoStage.exit.x + rA;
      } else {
        exitJogSouth(c3, pianoStage);
        c3DescentX = rightEdge;
      }
      const p3Bot = botOf("#sky-auto-piano");
      c3.lineTo(c3DescentX, p3Bot);
      const c3d = `${c3.d} ${stadium(c3DescentX, p3Bot, edge, skillsTop)}`;

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

    const pathData = [
      `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`,
      site1D,
      site2D,
      // Round 12: site segment 3 is the C0 connector (gutter run down to
      // the E2EE stage entry); the rest of the project chain (C1, stage
      // paths, C2, C3) is built as segments below. Fallback is the old
      // Projects gutter run, kept so the thread never breaks if a stage
      // is missing.
      chain ? chain.c0d : `M ${edge} ${projTop} C ${edge} ${p1Bot - 40}, ${edge} ${p1Bot - 10}, ${edge} ${p1Bot} ${stadium(edge, p1Bot, rightEdge, p2Top)} C ${rightEdge} ${p2Bot - 40}, ${rightEdge} ${p2Bot - 10}, ${rightEdge} ${p2Bot} ${stadium(rightEdge, p2Bot, edge, p3Top)} C ${edge} ${skillsTop - 40}, ${edge} ${skillsTop - 10}, ${edge} ${skillsTop}`,
      `M ${edge} ${skillsTop} C ${edge} ${skillsTop + (contactTop - skillsTop) * 0.3}, ${edge} ${skillsTop + (contactTop - skillsTop) * 0.7}, ${edge} ${contactTop}`,
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

    s0 = Math.round(heroHeight * 0.55);
    sHandoffEnd = s0 + (isMobile ? 35 : 50);
    sGlyphStart = Math.max(sHandoffEnd + (isMobile ? 65 : 85), Math.round(first.y - winHeight * 0.72));
    const s1 = sGlyphStart;

    setTiming(siteSegments[0]!, s0, sHandoffEnd);
    setTiming(siteSegments[6]!, sHandoffEnd, sGlyphStart);

    s2 = Math.max(s1 + Math.max(480, winHeight * 0.62), Math.round(last.y - winHeight * 0.34));
    const s3 = Math.max(s2 + 160, Math.round(expTop - winHeight * 0.55));
    // Round 12: the Experience headline trace runs between site-1 (which
    // ends at the Experience top) and site-2 (left gutter to Projects).
    // Entry/exit are hidden weighted travel: in from the site-1 end
    // (left edge, expTop) to the first exp junction, out from the last
    // exp junction back to the site-2 start, so the dot never teleports
    // visibly between the headline and the gutter run.
    const expFirst = expOrder[0]?.junctions[0];
    const expLast = expOrder.at(-1)?.junctions[0];
    let expSegments: Segment[] = [];
    let sExp = s3;
    if (expFirst && expLast && expOrder.length) {
      const distTo = (a: Junction, b: Junction) => Math.hypot(b.x - a.x, b.y - a.y);
      const site1End: Junction = { x: edge, y: expTop, distance: 0 };
      const entryWeight = Math.max(fontSize * 0.22, distTo(site1End, expFirst) * 0.18);
      const exitWeight = Math.max(fontSize * 0.22, distTo(expLast, site1End) * 0.18);
      expSegments = [
        { drawLength: 0, weight: entryWeight, startDistance: 0, kind: "hidden", layer: "glyph", startScroll: 0, endScroll: 1 },
        ...expGroup.segments,
        { drawLength: 0, weight: exitWeight, startDistance: 0, kind: "hidden", layer: "glyph", startScroll: 0, endScroll: 1 },
      ];
      sExp = Math.max(s3 + Math.max(480, winHeight * 0.62), Math.round(expLast.y - winHeight * 0.34));
      const expWeight = expSegments.reduce((sum, segment) => sum + segment.weight, 0);
      let expCursor = s3;
      expSegments.forEach((segment) => { const end = expCursor + (sExp - s3) * segment.weight / expWeight; setTiming(segment, expCursor, end); expCursor = end; });
    }
    const s4 = Math.max(sExp + 60, Math.round(projTop - winHeight * 0.55)), s5 = Math.max(s4 + 60, Math.round(skillsTop - winHeight * 0.55)), s6 = Math.max(s5 + 60, Math.round(contactTop - winHeight * 0.55)), s7 = Math.max(s6 + 60, height - winHeight);
    const headlineWeight = headlineSegments.reduce((sum, segment) => sum + segment.weight, 0); let cursor = s1;
    headlineSegments.forEach((segment) => { const end = cursor + (s2 - s1) * segment.weight / headlineWeight; setTiming(segment, cursor, end); cursor = end; });
    setTiming(siteSegments[1]!, s2, s3);
    // Round 12: the project chain tiles [chainStart, chainEnd] gaplessly.
    // C0 runs the gutter while the Projects header scrolls by, each
    // stage's paths tile its article's trigger window (so the thread and
    // the DOM choreography share one progress value), the inter-stage
    // connectors tile the gaps between articles, and C3 lands on
    // skillsTop where site-4 takes over.
    let chainSegments: Segment[] = [];
    if (chain) {
      const chainStart = Math.max(sExp + 1, Math.min(s4, chain.stages[0]!.artStart - 1));
      const chainEnd = Math.max(s5, chain.stages[2]!.artEnd + 1);
      const s6c = Math.max(s6, chainEnd + 60);
      const s7c = Math.max(s7, s6c + 60);
      setTiming(siteSegments[2]!, sExp, chainStart);
      setTiming(siteSegments[3]!, chainStart, chain.stages[0]!.artStart);
      const mkStageSegs = (stage: BuiltStage): Segment[] =>
        stage.paths.map((element, i) => {
          const w = stage.plan.windows[i]!;
          const span = stage.artEnd - stage.artStart;
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
          setTiming(seg, stage.artStart + w[0] * span, stage.artStart + w[1] * span);
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
      const c1Seg = mkConnectorSeg(connectorEls[0]!, chain.stages[0]!.artEnd, chain.stages[1]!.artStart);
      const c2Seg = mkConnectorSeg(connectorEls[1]!, chain.stages[1]!.artEnd, chain.stages[2]!.artStart);
      const c3Seg = mkConnectorSeg(connectorEls[2]!, chain.stages[2]!.artEnd, chainEnd);
      chainSegments = [siteSegments[3]!, ...e2eeSegs, c1Seg, ...sheetSegs, c2Seg, ...pianoSegs, c3Seg];
      stageDots = chain.stages.map((stage) => ({ dot: stage.dot, artStart: stage.artStart, artEnd: stage.artEnd, dotEnd: stage.plan.dotEnd }));
      setTiming(siteSegments[4]!, chainEnd, s6c);
      setTiming(siteSegments[5]!, s6c, s7c);
    } else {
      setTiming(siteSegments[2]!, sExp, s4); setTiming(siteSegments[3]!, s4, s5); setTiming(siteSegments[4]!, s5, s6); setTiming(siteSegments[5]!, s6, s7);
      stageDots = [];
    }
    segments = chain
      ? [siteSegments[0]!, siteSegments[6]!, ...headlineSegments, siteSegments[1]!, ...expSegments, siteSegments[2]!, ...chainSegments, siteSegments[4]!, siteSegments[5]!]
      : [siteSegments[0]!, siteSegments[6]!, ...headlineSegments, siteSegments[1]!, ...expSegments, ...siteSegments.slice(2)];
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
