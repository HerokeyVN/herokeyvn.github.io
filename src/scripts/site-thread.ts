import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { findTransition, type AnchorPreference, type GlyphTransition } from "../data/about-glyphs";

type Segment = {
  element?: SVGPathElement;
  drawLength: number;
  weight: number;
  startDistance: number;
  kind: "open" | "closed" | "hidden";
  layer: "site" | "glyph";
  startScroll: number;
  endScroll: number;
};
type Junction = { x: number; y: number; distance: number };
type GlyphRecord = { key: string; left: number; top: number; baselineY: number; scale: number; paths: SVGPathElement[]; junctions: Junction[]; lineIndex: number };
const SVG_NS = "http://www.w3.org/2000/svg";

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
  let resizeFrame = 0;
  let trigger: ScrollTrigger | undefined;
  let s0 = 0;
  let sHandoffEnd = 0;
  let sGlyphStart = 0;
  let s2 = 0;

  const topOf = (selector: string) => { const el = document.querySelector<HTMLElement>(selector); return el ? el.getBoundingClientRect().top + scrollY : 0; };
  const botOf = (selector: string) => { const el = document.querySelector<HTMLElement>(selector); return el ? el.getBoundingClientRect().bottom + scrollY : 0; };
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

    if (!active || active.segment.kind === "hidden" || !active.segment.element) {
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
    // The handles are short (8-26px) so the connector stays a small arch
    // or dip inside the inter-letter gap; x stays monotonic because both
    // control points sit on the junctions' verticals.
    const chord = Math.hypot(to.x - from.x, to.y - from.y);
    const handle = Math.min(26, Math.max(8, chord * 0.35));
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
    const rawGlyphs: GlyphRecord[] = [...document.querySelectorAll<HTMLElement>(".about__glyph[data-glyph-key]")].map((element) => {
      const key = element.dataset.glyphKey!;
      const wordIndex = Number(key.split("-")[0]);
      const baseline = document.querySelector<HTMLElement>(`[data-glyph-baseline='${wordIndex}']`)!;
      const box = element.getBoundingClientRect(), baselineBox = baseline.getBoundingClientRect();
      const scale = Number.parseFloat(getComputedStyle(element).fontSize) / 1000;
      const originX = box.left + scrollX, baselineY = baselineBox.top + scrollY;
      const glyphPaths = [...glyphSvg.querySelectorAll<SVGPathElement>(`path[data-glyph-key='${key}']`)].sort((a, b) => Number(a.dataset.glyphContour) - Number(b.dataset.glyphContour));
      glyphPaths.forEach((path) => path.setAttribute("transform", `translate(${originX} ${baselineY}) scale(${scale})`));
      return {
        key,
        left: originX,
        top: box.top + scrollY,
        baselineY,
        scale,
        paths: glyphPaths,
        junctions: [],
        lineIndex: 0,
      };
    });
    const lines: GlyphRecord[][] = [];
    [...rawGlyphs].sort((a, b) => a.top - b.top || a.left - b.left).forEach((glyph) => { const line = lines.find((items) => Math.abs(items[0]!.top - glyph.top) < 4); line ? line.push(glyph) : lines.push([glyph]); });
    lines.forEach((line, lineIndex) => { line.forEach((glyph) => { glyph.lineIndex = lineIndex; }); line.sort((a, b) => a.left - b.left); if (lineIndex % 2 === 0) line.reverse(); });
    const glyphOrder = lines.flat();
    if (!glyphOrder.length) return;

    glyphOrder.forEach((glyph, i) => {
      const prev = glyphOrder[i - 1];
      const next = glyphOrder[i + 1];
      let pref: AnchorPreference | undefined;

      if (next && glyph.lineIndex === next.lineIndex) {
        const trans = findTransition(glyph.key, next.key, isMobile);
        if (trans && trans.visibility === "visible" && trans.fromAnchor) {
          pref = trans.fromAnchor;
        }
      }
      if (!pref && prev && glyph.lineIndex === prev.lineIndex) {
        const trans = findTransition(prev.key, glyph.key, isMobile);
        if (trans && trans.visibility === "visible" && trans.toAnchor) {
          pref = trans.toAnchor;
        }
      }
      if (!pref) {
        pref = { mode: "top" };
      }

      glyph.junctions = glyph.paths.map((path, contourIndex) =>
        findJunction(path, glyph.left, glyph.baselineY, glyph.scale, contourIndex === 0 ? pref : undefined),
      );
    });

    const fontSize = Number.parseFloat(getComputedStyle(document.querySelector<HTMLElement>(".about__glyph")!).fontSize);
    const headlineSegments: Segment[] = [];
    glyphOrder.forEach((glyph, glyphIndex) => {
      glyph.paths.forEach((path, contourIndex) => {
        if (contourIndex > 0) headlineSegments.push({ drawLength: 0, weight: Math.max(18, fontSize * 0.18), startDistance: 0, kind: "hidden", layer: "glyph", startScroll: 0, endScroll: 1 });
        const length = path.getTotalLength();
        headlineSegments.push({ element: path, drawLength: length, weight: length * glyph.scale, startDistance: glyph.junctions[contourIndex]!.distance, kind: "closed", layer: "glyph", startScroll: 0, endScroll: 1 });
        if (contourIndex > 0) headlineSegments.push({ drawLength: 0, weight: Math.max(18, fontSize * 0.18), startDistance: 0, kind: "hidden", layer: "glyph", startScroll: 0, endScroll: 1 });
      });
      const next = glyphOrder[glyphIndex + 1];
      if (next) {
        const sameLine = glyph.lineIndex === next.lineIndex;
        const trans = sameLine ? findTransition(glyph.key, next.key, isMobile) : undefined;
        headlineSegments.push(createConnector(glyph, next, glyph.junctions[0]!, next.junctions[0]!, sameLine, fontSize, trans));
      }
    });

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
    // handoff end down the right gutter, a quarter-turn onto the run, then
    // a straight run into the first glyph junction. Round 11: replaces the
    // two straight L segments and their 90-degree corner (rMin ~62
    // desktop). runY stays below the filled headline line so the approach
    // never crosses copy; where the first junction sits less than 10px
    // under that line, the run drops just below it and rises into the
    // junction. The turn radius (100px desktop) keeps the curve clear of
    // the filled span's expanded box.
    const filledSpan = document.querySelector<HTMLElement>(".about__title > span:first-child");
    const filledBottom = filledSpan ? filledSpan.getBoundingClientRect().bottom + scrollY : aboutTop + 400;
    const runY = Math.max(first.y, filledBottom + 10);
    const connDx = rightEdge - endX;
    const turnY = isMobile ? endY + 0.74 * (runY - endY) : runY - 100;
    const connL1 = (isMobile ? 1.1 : 0.5) * connDx;
    const connCp1x = endX + handoffDir.x * connL1;
    const connCp1y = endY + handoffDir.y * connL1;
    const connCp2x = rightEdge;
    const connCp2y = turnY - 95;
    let connectorD: string;
    if (isMobile) {
      // Mobile: cubic to the gutter, straight gutter run, 10px fillet onto
      // the run (the corridor forces the small radius), horizontal run,
      // then a short rise into the first junction.
      const filletR = 10;
      const filletK = 0.5523 * filletR;
      const riseLen = 4.25 * (runY - first.y);
      connectorD = `M ${endX} ${endY} C ${connCp1x} ${connCp1y}, ${connCp2x} ${connCp2y}, ${rightEdge} ${turnY} L ${rightEdge} ${runY - filletR} C ${rightEdge} ${runY - filletR + filletK}, ${rightEdge - filletR + filletK} ${runY}, ${rightEdge - filletR} ${runY} L ${first.x + riseLen} ${runY} C ${first.x + 1.5 * (runY - first.y)} ${runY}, ${first.x + 0.8 * (runY - first.y)} ${first.y}, ${first.x} ${first.y}`;
    } else {
      const turnR = 100;
      const turnK = 0.5523 * turnR;
      connectorD = `M ${endX} ${endY} C ${connCp1x} ${connCp1y}, ${connCp2x} ${connCp2y}, ${rightEdge} ${turnY} C ${rightEdge} ${turnY + turnK}, ${rightEdge - turnR + turnK} ${runY}, ${rightEdge - turnR} ${runY} L ${first.x} ${runY}`;
    }

    const p1 = document.querySelector("#fb-messenger-e2ee"), p2 = document.querySelector("#sky-sheet-store"), p3 = document.querySelector("#sky-auto-piano");
    const p1Bot = p1 ? botOf("#fb-messenger-e2ee") : projTop + 600, p2Top = p2 ? topOf("#sky-sheet-store") : projTop + 700, p2Bot = p2 ? botOf("#sky-sheet-store") : projTop + 1600, p3Top = p3 ? topOf("#sky-auto-piano") : projTop + 1700;
    const emailBox = document.querySelector(".contact__email-btn")?.getBoundingClientRect();
    const contactTargetX = emailBox ? Math.max(edge, emailBox.left - 24) : width * 0.25, contactTargetY = emailBox ? emailBox.top + scrollY + emailBox.height / 2 : contactTop + 300;

    // Stadium crossing: quarter-turn off the gutter, straight run across,
    // quarter-turn back onto the gutter. Tangents match the vertical gutter
    // runs at both ends (G1); the radius is half the vertical span, so the
    // turn is as gentle as the gap allows (rMin ~36-73 desktop). The
    // fragment continues from the current point (x0, y0) heading down.
    // Round 11: replaces the old single-cubic crossings, which were
    // square brackets with rMin ~3-4 and (contrary to the round-11 brief)
    // already G1 - the defect was curvature, not tangent mismatch.
    const stadium = (x0: number, y0: number, x1: number, y1: number): string => {
      const d = y1 - y0, r = d / 2, k = 0.5523 * r, s = Math.sign(x1 - x0);
      return `C ${x0} ${y0 + k}, ${x0 + s * r - s * k} ${y0 + r}, ${x0 + s * r} ${y0 + r} L ${x1 - s * r} ${y0 + r} C ${x1 - s * r + s * k} ${y0 + r}, ${x1} ${y0 + r + k}, ${x1} ${y1}`;
    };

    // Site-1 exit (round 11): the thread leaves the last glyph junction
    // along the contour's arrival tangent (up the "." left edge) instead of
    // horizontally, so there is no 90deg kink where the glyph tracing ends.
    const lastGlyph = glyphOrder.at(-1)!;
    const lastTan = contourArrival(lastGlyph.paths[0]!, last.distance);
    // lastRight is the travel direction 90deg clockwise from lastTan
    // (screen coords, y down): the direction the exit turns toward.
    const lastRight = { x: -lastTan.y, y: lastTan.x };
    let site1D: string;
    if (isMobile) {
      // Mobile: only ~22px of gutter room, so the exit is a small cap over
      // the top (two quarter-turns, R = half the gutter gap), then a
      // straight gutter run to the statement gap and the stadium crossing.
      const capR = (rightEdge - last.x) / 2;
      const capK = 0.5523 * capR;
      const capMidX = last.x + capR;
      const capMidY = last.y - capR;
      site1D = `M ${last.x} ${last.y} C ${last.x + lastTan.x * capK} ${last.y + lastTan.y * capK}, ${capMidX - lastRight.x * capK} ${capMidY - lastRight.y * capK}, ${capMidX} ${capMidY} C ${capMidX + lastRight.x * capK} ${capMidY + lastRight.y * capK}, ${rightEdge} ${last.y + lastTan.y * capK}, ${rightEdge} ${last.y} C ${rightEdge} ${last.y + 40}, ${rightEdge} ${gapTop - 40}, ${rightEdge} ${gapTop} ${stadium(rightEdge, gapTop, edge, gapBot)} C ${edge} ${gapBot + 40}, ${edge} ${expTop - 40}, ${edge} ${expTop}`;
    } else {
      // Desktop: a quarter-turn up and right, a long sweep right and down,
      // then a run above the statement (B1), a quarter-turn down (B2) and
      // a straight gutter drop; the crossing stadium starts where the exit
      // ends (below the statement gap) and spans to the profile top. The
      // old single B curve cut diagonally through the statement's box, so
      // B1 stays above it (max y ~12px above its expanded top) and B2
      // turns down only once it is inside the right gutter.
      const exitR = 0.2 * fontSize;
      const exitK = 0.5523 * exitR;
      const a1EndX = last.x + exitR * (lastTan.x + lastRight.x);
      const a1EndY = last.y + exitR * (lastTan.y + lastRight.y);
      const a2EndX = rightEdge - 2.45 * fontSize;
      const a2EndY = last.y + 0.65 * fontSize;
      const bEndY = a2EndY + 1.13 * fontSize;
      // A2 ends heading (0.81, 0.33) (its second control point sits
      // 0.81/0.33 fontSize back from the end); B1 leaves along that ray.
      const a2TanX = 0.81 / Math.hypot(0.81, 0.33);
      const a2TanY = 0.33 / Math.hypot(0.81, 0.33);
      const b1EndX = rightEdge - 32;
      const b1EndY = a2EndY + 12;
      const b2R = 32;
      const b2K = 0.5523 * b2R;
      const crossStartY = Math.max(bEndY, gapTop);
      const gutterRun = crossStartY > bEndY
        ? ` C ${rightEdge} ${bEndY + 40}, ${rightEdge} ${crossStartY - 40}, ${rightEdge} ${crossStartY}`
        : "";
      site1D = `M ${last.x} ${last.y} C ${last.x + lastTan.x * exitK} ${last.y + lastTan.y * exitK}, ${a1EndX - lastRight.x * exitK} ${a1EndY - lastRight.y * exitK}, ${a1EndX} ${a1EndY} C ${a1EndX + 0.49 * fontSize} ${a1EndY}, ${a2EndX - 0.81 * fontSize} ${a2EndY - 0.33 * fontSize}, ${a2EndX} ${a2EndY} C ${a2EndX + a2TanX * 0.35 * fontSize} ${a2EndY + a2TanY * 0.35 * fontSize}, ${b1EndX - 0.6 * fontSize} ${b1EndY}, ${b1EndX} ${b1EndY} C ${b1EndX + b2K} ${b1EndY}, ${rightEdge} ${b1EndY + b2R - b2K}, ${rightEdge} ${b1EndY + b2R} L ${rightEdge} ${bEndY}${gutterRun} ${stadium(rightEdge, crossStartY, edge, gapBot)} C ${edge} ${gapBot + 40}, ${edge} ${expTop - 40}, ${edge} ${expTop}`;
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

    const pathData = [
      `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`,
      site1D,
      `M ${edge} ${expTop} C ${edge} ${expTop + (projTop - expTop) * 0.3}, ${edge} ${expTop + (projTop - expTop) * 0.7}, ${edge} ${projTop}`,
      `M ${edge} ${projTop} C ${edge} ${p1Bot - 40}, ${edge} ${p1Bot - 10}, ${edge} ${p1Bot} ${stadium(edge, p1Bot, rightEdge, p2Top)} C ${rightEdge} ${p2Bot - 40}, ${rightEdge} ${p2Bot - 10}, ${rightEdge} ${p2Bot} ${stadium(rightEdge, p2Bot, edge, p3Top)} C ${edge} ${skillsTop - 40}, ${edge} ${skillsTop - 10}, ${edge} ${skillsTop}`,
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
    const s3 = Math.max(s2 + 160, Math.round(expTop - winHeight * 0.55)), s4 = Math.max(s3 + 60, Math.round(projTop - winHeight * 0.55)), s5 = Math.max(s4 + 60, Math.round(skillsTop - winHeight * 0.55)), s6 = Math.max(s5 + 60, Math.round(contactTop - winHeight * 0.55)), s7 = Math.max(s6 + 60, height - winHeight);
    const headlineWeight = headlineSegments.reduce((sum, segment) => sum + segment.weight, 0); let cursor = s1;
    headlineSegments.forEach((segment) => { const end = cursor + (s2 - s1) * segment.weight / headlineWeight; setTiming(segment, cursor, end); cursor = end; });
    setTiming(siteSegments[1]!, s2, s3); setTiming(siteSegments[2]!, s3, s4); setTiming(siteSegments[3]!, s4, s5); setTiming(siteSegments[4]!, s5, s6); setTiming(siteSegments[5]!, s6, s7);
    segments = [siteSegments[0]!, siteSegments[6]!, ...headlineSegments, ...siteSegments.slice(1)];
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
