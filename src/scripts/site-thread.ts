import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { GLYPH_JUNCTION_PREFERENCES, type JunctionPreference } from "../data/about-glyphs";

type Segment = { element?: SVGPathElement; drawLength: number; weight: number; startDistance: number; kind: "open" | "closed" | "hidden"; layer: "site" | "glyph"; startScroll: number; endScroll: number };
type Junction = { x: number; y: number; distance: number };
type GlyphRecord = { key: string; left: number; top: number; scale: number; paths: SVGPathElement[]; junctions: Junction[]; lineIndex: number };
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
      return;
    }
    let active: { segment: Segment; progress: number } | undefined;
    segments.forEach((segment) => {
      const progress = gsap.utils.clamp(0, 1, (currentScroll - segment.startScroll) / (segment.endScroll - segment.startScroll));
      if (progress > 0 && progress < 1) active = { segment, progress };
      if (!segment.element) return;
      const visible = segment.drawLength * progress;
      if (segment.kind === "closed") {
        gsap.set(segment.element, { strokeDasharray: progress >= 1 ? "none" : `${visible} ${Math.max(0.01, segment.drawLength - visible)}`, strokeDashoffset: -segment.startDistance, visibility: progress > 0 ? "visible" : "hidden" });
      } else {
        gsap.set(segment.element, { strokeDasharray: `${segment.drawLength} ${segment.drawLength}`, strokeDashoffset: segment.drawLength - visible, visibility: progress > 0 ? "visible" : "hidden" });
      }
    });
    if (!active || active.segment.kind === "hidden" || !active.segment.element) { gsap.set([siteEnd, glyphEnd], { autoAlpha: 0 }); return; }
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
    pref?: JunctionPreference,
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

  const createConnector = (from: Junction, to: Junction, sameLine: boolean, fontSize: number): Segment => {
    if (!sameLine) {
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
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const cp1x = from.x + dx * 0.45;
    const cp1y = from.y + dy * 0.1;
    const cp2x = to.x - dx * 0.45;
    const cp2y = to.y - dy * 0.1;
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
    const glyphRecords: GlyphRecord[] = [...document.querySelectorAll<HTMLElement>(".about__glyph[data-glyph-key]")].map((element) => {
      const key = element.dataset.glyphKey!;
      const wordIndex = Number(key.split("-")[0]);
      const baseline = document.querySelector<HTMLElement>(`[data-glyph-baseline='${wordIndex}']`)!;
      const box = element.getBoundingClientRect(), baselineBox = baseline.getBoundingClientRect();
      const scale = Number.parseFloat(getComputedStyle(element).fontSize) / 1000;
      const originX = box.left + scrollX, baselineY = baselineBox.top + scrollY;
      const glyphPaths = [...glyphSvg.querySelectorAll<SVGPathElement>(`path[data-glyph-key='${key}']`)].sort((a, b) => Number(a.dataset.glyphContour) - Number(b.dataset.glyphContour));
      glyphPaths.forEach((path) => path.setAttribute("transform", `translate(${originX} ${baselineY}) scale(${scale})`));
      const rawPref = GLYPH_JUNCTION_PREFERENCES[key];
      const pref: JunctionPreference | undefined = rawPref
        ? ("mode" in rawPref ? rawPref : (isMobile && rawPref.mobile ? rawPref.mobile : rawPref.desktop ?? rawPref.mobile))
        : undefined;
      return {
        key,
        left: originX,
        top: box.top + scrollY,
        scale,
        paths: glyphPaths,
        junctions: glyphPaths.map((path, contourIndex) => findJunction(path, originX, baselineY, scale, contourIndex === 0 ? pref : undefined)),
        lineIndex: 0,
      };
    });
    const lines: GlyphRecord[][] = [];
    [...glyphRecords].sort((a, b) => a.top - b.top || a.left - b.left).forEach((glyph) => { const line = lines.find((items) => Math.abs(items[0]!.top - glyph.top) < 4); line ? line.push(glyph) : lines.push([glyph]); });
    lines.forEach((line, lineIndex) => { line.forEach((glyph) => { glyph.lineIndex = lineIndex; }); line.sort((a, b) => a.left - b.left); if (lineIndex % 2 === 0) line.reverse(); });
    const glyphOrder = lines.flat();
    if (!glyphOrder.length) return;
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
      if (next) headlineSegments.push(createConnector(glyph.junctions[0]!, next.junctions[0]!, glyph.lineIndex === next.lineIndex, fontSize));
    });

    const first = glyphOrder[0]!.junctions[0]!, last = glyphOrder.at(-1)!.junctions[0]!;
    const stmt = document.querySelector(".about__statement"), prof = document.querySelector(".about__profile");
    const gapTop = stmt ? botOf(".about__statement") : aboutTop + 400, gapBot = prof ? topOf(".about__profile") : aboutTop + 650, crossY = (gapTop + gapBot) / 2;
    const rightEdge = width - edge, startX = width * (1138 / 1440), startY = heroHeight;
    const p1 = document.querySelector("#fb-messenger-e2ee"), p2 = document.querySelector("#sky-sheet-store"), p3 = document.querySelector("#sky-auto-piano");
    const p1Bot = p1 ? botOf("#fb-messenger-e2ee") : projTop + 600, p2Top = p2 ? topOf("#sky-sheet-store") : projTop + 700, p2Bot = p2 ? botOf("#sky-sheet-store") : projTop + 1600, p3Top = p3 ? topOf("#sky-auto-piano") : projTop + 1700;
    const emailBox = document.querySelector(".contact__email-btn")?.getBoundingClientRect();
    const contactTargetX = emailBox ? Math.max(edge, emailBox.left - 24) : width * 0.25, contactTargetY = emailBox ? emailBox.top + scrollY + emailBox.height / 2 : contactTop + 300;
    const pathData = [
      `M ${startX} ${startY} C ${rightEdge} ${startY + 20}, ${rightEdge} ${startY + 50}, ${rightEdge} ${startY + 70} C ${rightEdge} ${first.y - fontSize * 0.35}, ${first.x + fontSize * 0.35} ${first.y - fontSize * 0.18}, ${first.x} ${first.y}`,
      `M ${last.x} ${last.y} C ${last.x + fontSize * 0.35} ${last.y}, ${rightEdge} ${last.y + fontSize * 0.35}, ${rightEdge} ${last.y + fontSize * 0.5} C ${rightEdge} ${gapTop - 40}, ${rightEdge} ${gapTop - 20}, ${rightEdge} ${gapTop} C ${rightEdge} ${crossY}, ${edge} ${crossY}, ${edge} ${gapBot} C ${edge} ${gapBot + 40}, ${edge} ${expTop - 40}, ${edge} ${expTop}`,
      `M ${edge} ${expTop} C ${edge * 0.6} ${expTop + (projTop - expTop) * 0.3}, ${edge * 0.6} ${expTop + (projTop - expTop) * 0.7}, ${edge} ${projTop}`,
      `M ${edge} ${projTop} C ${edge} ${p1Bot - 40}, ${edge} ${p1Bot - 10}, ${edge} ${p1Bot} C ${edge} ${(p1Bot + p2Top) / 2}, ${rightEdge} ${(p1Bot + p2Top) / 2}, ${rightEdge} ${p2Top} C ${rightEdge} ${p2Bot - 40}, ${rightEdge} ${p2Bot - 10}, ${rightEdge} ${p2Bot} C ${rightEdge} ${(p2Bot + p3Top) / 2}, ${edge} ${(p2Bot + p3Top) / 2}, ${edge} ${p3Top} C ${edge} ${skillsTop - 40}, ${edge} ${skillsTop - 10}, ${edge} ${skillsTop}`,
      `M ${edge} ${skillsTop} C ${edge * 0.6} ${skillsTop + (contactTop - skillsTop) * 0.3}, ${edge * 0.6} ${skillsTop + (contactTop - skillsTop) * 0.7}, ${edge} ${contactTop}`,
      `M ${edge} ${contactTop} C ${edge} ${contactTop + 100}, ${contactTargetX - 60} ${contactTargetY - 40}, ${contactTargetX} ${contactTargetY}`,
    ];
    const siteSegments = paths.map((element, index) => { element.setAttribute("d", pathData[index]!); const length = element.getTotalLength(); return { element, drawLength: length, weight: length, startDistance: 0, kind: "open", layer: "site", startScroll: 0, endScroll: 1 } satisfies Segment; });
    const s0 = Math.round(heroHeight * 0.55), s1 = Math.max(s0 + 80, Math.round(first.y - winHeight * 0.72));
    const s2 = Math.max(s1 + Math.max(480, winHeight * 0.62), Math.round(last.y - winHeight * 0.34));
    const s3 = Math.max(s2 + 160, Math.round(expTop - winHeight * 0.55)), s4 = Math.max(s3 + 60, Math.round(projTop - winHeight * 0.55)), s5 = Math.max(s4 + 60, Math.round(skillsTop - winHeight * 0.55)), s6 = Math.max(s5 + 60, Math.round(contactTop - winHeight * 0.55)), s7 = Math.max(s6 + 60, height - winHeight);
    setTiming(siteSegments[0]!, s0, s1);
    const headlineWeight = headlineSegments.reduce((sum, segment) => sum + segment.weight, 0); let cursor = s1;
    headlineSegments.forEach((segment) => { const end = cursor + (s2 - s1) * segment.weight / headlineWeight; setTiming(segment, cursor, end); cursor = end; });
    setTiming(siteSegments[1]!, s2, s3); setTiming(siteSegments[2]!, s3, s4); setTiming(siteSegments[3]!, s4, s5); setTiming(siteSegments[4]!, s5, s6); setTiming(siteSegments[5]!, s6, s7);
    segments = [siteSegments[0]!, ...headlineSegments, ...siteSegments.slice(1)];
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
