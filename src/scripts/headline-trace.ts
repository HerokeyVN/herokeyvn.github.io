// Shared headline-tracing helper (Round 12.1).
//
// One mechanism traces every outlined headline on the page - About,
// Experience, Projects, Skills and Contact - instead of a separate
// implementation per heading. The glyph machinery (contour collection,
// line grouping, junction resolution, inter-letter connectors) moved
// here verbatim from site-thread.ts; the caller (site-thread.ts) owns
// the site segments and the scroll-timing chain, and wires each headline
// trace into it: the active site segment leaves the gutter (hidden
// travel), traces the outlined word, and returns to the gutter, so the
// thread never teleports between the headline and the gutter run.
//
// Timing model (Bug 1 fix, shared by all four SectionHeading/Contact
// traces): a trace starts once its heading top has reached 55% viewport
// height and completes when the last line's bottom reaches ~72%
// viewport height, with a minimum span so it never completes in a few
// px of scroll. The trace therefore always completes while the headline
// is still framed, instead of finishing after it has scrolled past.
import type { AnchorPreference, GlyphTransition } from "../data/about-glyphs";

export type Segment = {
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
export type Junction = { x: number; y: number; distance: number };
export type GlyphRecord = {
  key: string;
  left: number;
  top: number;
  bottom: number;
  baselineY: number;
  scale: number;
  paths: SVGPathElement[];
  junctions: Junction[];
  lineIndex: number;
};

const SVG_NS = "http://www.w3.org/2000/svg";

export type HeadlineTraceConfig = {
  id: string;
  // The heading element; span and baseline queries are scoped to it, so
  // several traced headings can share one baseline attribute.
  headingEl: HTMLElement | null;
  // Span class inside the heading, e.g. ".about__glyph" or ".heading__glyph".
  spanClass: string;
  // Contour-path data attribute, e.g. "data-glyph-key", "data-exp-glyph-key".
  keyAttr: string;
  // Span dataset key, e.g. "glyphKey", "expGlyphKey", "headingGlyphKey".
  keyDataset: string;
  // Contour dataset key, e.g. "glyphContour", "expGlyphContour".
  contourDataset: string;
  // Baseline data attribute, e.g. "data-glyph-baseline".
  baselineAttr: string;
  // Index of the word index inside key.split("-").
  wordPart: number;
  // Visible inter-letter transitions; unset means every hop is hidden
  // travel (the default for the Round 12.1 headlines).
  findTransition?: (from: string, to: string, isMobile: boolean) => GlyphTransition | undefined;
  // Reverse even lines (About only).
  snake?: boolean;
  // Override the last glyph's junction by key.
  exitJunctionFractions?: Record<string, number>;
};

export type HeadlineTraceGroup = {
  order: GlyphRecord[];
  segments: Segment[];
  first: Junction | undefined;
  last: Junction | undefined;
  lastLineBottom: number;
  fontSize: number;
};

export type HeadlineTraceChain = {
  // Gutter point the trace leaves from and returns to.
  anchor: Junction;
  // Scroll position where the previous segment ends.
  prevEnd: number;
  // Document top of the heading's section.
  headingTop: number;
  winHeight: number;
  // Optional cap on the trace end (Projects: the first article must
  // still start after the trace).
  endCap?: number;
};

export type HeadlineTraceResult = HeadlineTraceGroup & {
  segments: Segment[];
  window: [number, number];
};

// Round 12.1 (Bug 1): the trace completes while the headline is framed.
export function headlineTraceWindow(opts: {
  headingTop: number;
  lastLineBottom: number;
  prevEnd: number;
  winHeight: number;
  endCap?: number;
}): [number, number] {
  const { headingTop, lastLineBottom, prevEnd, winHeight } = opts;
  const start = Math.max(prevEnd + 60, Math.round(headingTop - winHeight * 0.55));
  const minSpan = Math.max(240, winHeight * 0.26);
  const end = Math.min(
    opts.endCap ?? Number.POSITIVE_INFINITY,
    Math.max(start + minSpan, Math.round(lastLineBottom - winHeight * 0.72)),
  );
  return [start, Math.max(start + 1, end)];
}

export type HeadlineTracerDeps = {
  glyphSvg: SVGSVGElement;
  connectorGroup: SVGGElement;
  docBox: (el: Element) => { left: number; right: number; top: number; bottom: number };
  // Site-space point lookup owned by site-thread.ts (shared with the
  // hero exit tangent, so there is exactly one definition).
  pointInSiteSpace: (element: SVGPathElement, distance: number) => DOMPoint | undefined;
};

export function createHeadlineTracer(deps: HeadlineTracerDeps) {
  const { glyphSvg, connectorGroup, docBox, pointInSiteSpace } = deps;

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

  // Glyph collection is shared by every traced headline (same
  // contour/transform/connector mechanism, different span/path selectors
  // and transition plans). Span and baseline queries are scoped to the
  // heading element, so several traced headings can share one baseline
  // attribute.
  const collectGlyphs = (config: HeadlineTraceConfig): GlyphRecord[] => {
    if (!config.headingEl) return [];
    // Scoped to the heading element: every span with the class inside
    // this heading is one of this headline's glyphs (the span attribute
    // is the shared data-heading-glyph-key; the per-headline attribute
    // lives on the contour paths, matched by key below).
    const spans = [...config.headingEl.querySelectorAll<HTMLElement>(config.spanClass)];
    return spans.map((element) => {
      const key = (element.dataset as Record<string, string | undefined>)[config.keyDataset]!;
      const wordIndex = Number(key.split("-")[config.wordPart]);
      const baseline = config.headingEl!.querySelector<HTMLElement>(`[${config.baselineAttr}='${wordIndex}']`)!;
      const box = docBox(element), baselineBox = docBox(baseline);
      const scale = Number.parseFloat(getComputedStyle(element).fontSize) / 1000;
      const originX = box.left, baselineY = baselineBox.top;
      const glyphPaths = [...glyphSvg.querySelectorAll<SVGPathElement>(`path[${config.keyAttr}='${key}']`)].sort((a, b) => Number((a.dataset as Record<string, string | undefined>)[config.contourDataset]) - Number((b.dataset as Record<string, string | undefined>)[config.contourDataset]));
      glyphPaths.forEach((path) => path.setAttribute("transform", `translate(${originX} ${baselineY}) scale(${scale})`));
      return {
        key,
        left: originX,
        top: box.top,
        bottom: box.bottom,
        baselineY,
        scale,
        paths: glyphPaths,
        junctions: [],
        lineIndex: 0,
      };
    });
  };

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
    isMobile: boolean,
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

  const setTiming = (segment: Segment, start: number, end: number) => {
    segment.startScroll = start;
    segment.endScroll = Math.max(start + 1, end);
  };

  const noTransition = (): GlyphTransition | undefined => undefined;

  const collectAndBuild = (config: HeadlineTraceConfig, isMobile: boolean): HeadlineTraceGroup => {
    const rawGlyphs = collectGlyphs(config);
    const firstEl = config.headingEl?.querySelector<HTMLElement>(config.spanClass);
    const fontSize = firstEl ? Number.parseFloat(getComputedStyle(firstEl).fontSize) : 0;
    const { order, segments } = buildGlyphGroup(
      rawGlyphs,
      fontSize,
      config.findTransition ?? noTransition,
      config.snake ?? false,
      isMobile,
      config.exitJunctionFractions,
    );
    const lastLine = order.length ? Math.max(...order.map((g) => g.lineIndex)) : 0;
    const lastLineBottom = order.length
      ? Math.max(...order.filter((g) => g.lineIndex === lastLine).map((g) => g.bottom))
      : 0;
    return {
      order,
      segments,
      first: order[0]?.junctions[0],
      last: order.at(-1)?.junctions[0],
      lastLineBottom,
      fontSize,
    };
  };

  // Full headline trace: collect + build, wrap with hidden entry/exit
  // travel to and from the gutter anchor, and time the whole group
  // across the Bug-1 window. The caller wires the returned segments into
  // the site-thread chain at the anchor point.
  const traceHeadline = (config: HeadlineTraceConfig, chain: HeadlineTraceChain, isMobile: boolean): HeadlineTraceResult => {
    const group = collectAndBuild(config, isMobile);
    if (!group.order.length || !group.first || !group.last) {
      return { ...group, segments: [], window: [chain.prevEnd, chain.prevEnd] };
    }
    const window = headlineTraceWindow({
      headingTop: chain.headingTop,
      lastLineBottom: group.lastLineBottom,
      prevEnd: chain.prevEnd,
      winHeight: chain.winHeight,
      endCap: chain.endCap,
    });
    const distTo = (a: Junction, b: Junction) => Math.hypot(b.x - a.x, b.y - a.y);
    const entryWeight = Math.max(group.fontSize * 0.22, distTo(chain.anchor, group.first) * 0.18);
    const exitWeight = Math.max(group.fontSize * 0.22, distTo(group.last, chain.anchor) * 0.18);
    const segments: Segment[] = [
      { drawLength: 0, weight: entryWeight, startDistance: 0, kind: "hidden", layer: "glyph", startScroll: 0, endScroll: 1 },
      ...group.segments,
      { drawLength: 0, weight: exitWeight, startDistance: 0, kind: "hidden", layer: "glyph", startScroll: 0, endScroll: 1 },
    ];
    const totalWeight = segments.reduce((sum, segment) => sum + segment.weight, 0);
    let cursor = window[0];
    segments.forEach((segment) => {
      const end = cursor + (window[1] - window[0]) * segment.weight / totalWeight;
      setTiming(segment, cursor, end);
      cursor = end;
    });
    return { ...group, segments, window };
  };

  return { collectAndBuild, traceHeadline };
}
