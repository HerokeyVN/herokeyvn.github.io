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
  hideAfterScroll?: number;
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
  if (!svg || !glyphSvg || paths.length !== 6 || !connectorGroup || !siteEnd || !glyphEnd) return () => undefined;

  gsap.registerPlugin(ScrollTrigger);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let segments: Segment[] = [];
  let resizeFrame = 0;
  let trigger: ScrollTrigger | undefined;
  let s0 = 0;
  let sHandoffEnd = 0;
  let sOccluded = 0;
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

  const render = (currentScroll: number) => {
    if (!segments.length) return;
    if (reduceMotion.matches) {
      segments.forEach(({ element }) => element && gsap.set(element, { strokeDasharray: "none", strokeDashoffset: 0, visibility: "visible" }));
      gsap.set([siteEnd, glyphEnd], { autoAlpha: 0 });
      svg.setAttribute("data-thread-phase", "glyph");
      return;
    }

    // Diagnostic phase contract: hero | handoff | hidden | glyph
    let phase: "hero" | "handoff" | "hidden" | "glyph" = "hero";
    if (currentScroll >= sGlyphStart) {
      phase = "glyph";
    } else if (currentScroll >= sOccluded) {
      phase = "hidden";
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

      // Explicit lifecycle: hide handoff once fully occluded by the compact header
      if (typeof segment.hideAfterScroll === "number" && currentScroll >= segment.hideAfterScroll) {
        segment.element.style.visibility = "hidden";
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

    if (!active || active.segment.kind === "hidden" || !active.segment.element || phase === "hidden") {
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
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const cp1x = from.x + dx * 0.35;
    const cp1y = from.y + dy * 0.05;
    const cp2x = to.x - dx * 0.35;
    const cp2y = to.y - dy * 0.05;
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
    const gapTop = stmt ? botOf(".about__statement") : aboutTop + 400, gapBot = prof ? topOf(".about__profile") : aboutTop + 650, crossY = (gapTop + gapBot) / 2;
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
    const cp1x = startX + dx * 0.35;
    const cp1y = startY + dy * 0.45;
    const cp2x = startX + dx * 0.75;
    const cp2y = startY + dy * 0.85;
    const endX = startX + dx;
    const endY = startY + dy;

    const p1 = document.querySelector("#fb-messenger-e2ee"), p2 = document.querySelector("#sky-sheet-store"), p3 = document.querySelector("#sky-auto-piano");
    const p1Bot = p1 ? botOf("#fb-messenger-e2ee") : projTop + 600, p2Top = p2 ? topOf("#sky-sheet-store") : projTop + 700, p2Bot = p2 ? botOf("#sky-sheet-store") : projTop + 1600, p3Top = p3 ? topOf("#sky-auto-piano") : projTop + 1700;
    const emailBox = document.querySelector(".contact__email-btn")?.getBoundingClientRect();
    const contactTargetX = emailBox ? Math.max(edge, emailBox.left - 24) : width * 0.25, contactTargetY = emailBox ? emailBox.top + scrollY + emailBox.height / 2 : contactTop + 300;
    const pathData = [
      `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`,
      `M ${last.x} ${last.y} C ${last.x + fontSize * 0.35} ${last.y}, ${rightEdge} ${last.y + fontSize * 0.35}, ${rightEdge} ${last.y + fontSize * 0.5} C ${rightEdge} ${gapTop - 40}, ${rightEdge} ${gapTop - 20}, ${rightEdge} ${gapTop} C ${rightEdge} ${crossY}, ${edge} ${crossY}, ${edge} ${gapBot} C ${edge} ${gapBot + 40}, ${edge} ${expTop - 40}, ${edge} ${expTop}`,
      `M ${edge} ${expTop} C ${edge * 0.6} ${expTop + (projTop - expTop) * 0.3}, ${edge * 0.6} ${expTop + (projTop - expTop) * 0.7}, ${edge} ${projTop}`,
      `M ${edge} ${projTop} C ${edge} ${p1Bot - 40}, ${edge} ${p1Bot - 10}, ${edge} ${p1Bot} C ${edge} ${(p1Bot + p2Top) / 2}, ${rightEdge} ${(p1Bot + p2Top) / 2}, ${rightEdge} ${p2Top} C ${rightEdge} ${p2Bot - 40}, ${rightEdge} ${p2Bot - 10}, ${rightEdge} ${p2Bot} C ${rightEdge} ${(p2Bot + p3Top) / 2}, ${edge} ${(p2Bot + p3Top) / 2}, ${edge} ${p3Top} C ${edge} ${skillsTop - 40}, ${edge} ${skillsTop - 10}, ${edge} ${skillsTop}`,
      `M ${edge} ${skillsTop} C ${edge * 0.6} ${skillsTop + (contactTop - skillsTop) * 0.3}, ${edge * 0.6} ${skillsTop + (contactTop - skillsTop) * 0.7}, ${edge} ${contactTop}`,
      `M ${edge} ${contactTop} C ${edge} ${contactTop + 100}, ${contactTargetX - 60} ${contactTargetY - 40}, ${contactTargetX} ${contactTargetY}`,
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
        hideAfterScroll: undefined,
      };
    });

    const headerEl = document.querySelector<HTMLElement>("[data-site-header]");
    let headerHeight = 60;
    if (headerEl) {
      const wasCompact = headerEl.hasAttribute("data-compact");
      const prevTransition = headerEl.style.transition;
      headerEl.style.transition = "none";
      headerEl.setAttribute("data-compact", "");
      headerHeight = headerEl.offsetHeight;
      headerEl.style.transition = prevTransition;
      if (!wasCompact) headerEl.removeAttribute("data-compact");
    }
    const handoffBottom = endY;

    s0 = Math.round(heroHeight * 0.55);
    sHandoffEnd = s0 + (isMobile ? 35 : 50);
    sOccluded = Math.ceil(handoffBottom - headerHeight);
    sGlyphStart = Math.max(sOccluded + (isMobile ? 65 : 85), Math.round(first.y - winHeight * 0.72));
    const s1 = sGlyphStart;

    siteSegments[0]!.hideAfterScroll = sOccluded;
    setTiming(siteSegments[0]!, s0, sHandoffEnd);

    const handoffHiddenSegment: Segment = {
      drawLength: 0,
      weight: Math.max(50, fontSize * 0.8),
      startDistance: 0,
      kind: "hidden",
      layer: "site",
      startScroll: 0,
      endScroll: 1,
    };
    setTiming(handoffHiddenSegment, sOccluded, sGlyphStart);

    s2 = Math.max(s1 + Math.max(480, winHeight * 0.62), Math.round(last.y - winHeight * 0.34));
    const s3 = Math.max(s2 + 160, Math.round(expTop - winHeight * 0.55)), s4 = Math.max(s3 + 60, Math.round(projTop - winHeight * 0.55)), s5 = Math.max(s4 + 60, Math.round(skillsTop - winHeight * 0.55)), s6 = Math.max(s5 + 60, Math.round(contactTop - winHeight * 0.55)), s7 = Math.max(s6 + 60, height - winHeight);
    const headlineWeight = headlineSegments.reduce((sum, segment) => sum + segment.weight, 0); let cursor = s1;
    headlineSegments.forEach((segment) => { const end = cursor + (s2 - s1) * segment.weight / headlineWeight; setTiming(segment, cursor, end); cursor = end; });
    setTiming(siteSegments[1]!, s2, s3); setTiming(siteSegments[2]!, s3, s4); setTiming(siteSegments[3]!, s4, s5); setTiming(siteSegments[4]!, s5, s6); setTiming(siteSegments[5]!, s6, s7);
    segments = [siteSegments[0]!, handoffHiddenSegment, ...headlineSegments, ...siteSegments.slice(1)];
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
