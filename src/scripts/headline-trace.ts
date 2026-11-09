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
// Bug 9 (2026-11-09): the "leaves the gutter / returns to the gutter"
// above was literal - the entry/exit were hidden segments (no element,
// drawLength 0), so the main thread vanished in the gutter while the
// letters drew red via a separate glyph overlay with a separate head
// dot. Key: the main thread must RUN INTO the letters like the hero.
// traceHeadline now builds VISIBLE entry/exit paths (data-headline-entry
// / data-headline-exit in the glyph connector group): gutter down, then
// into the first junction (direct, or via the inter-line gap when filled
// text precedes the traced word on its line), and out of the last
// junction (its rightmost point, departure south-east) down to a clear
// band below the title, across to the left gutter, and south again.
// The trace IS the main thread: one dot travels gutter -> letters ->
// gutter, and the next site segment starts where the exit ends
// (traceHeadline returns exitEnd for the caller to use).
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
  // their SVGs use vector-effect: non-scaling-stroke. Bug 8: closed
  // glyph contours are driven the same way (closedGlyphDashSetter
  // below) - the site thread's user-unit dash saturated them ~1/scale
  // early, so every letter flipped red at once.
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
  // Section element the heading belongs to (for the exit band: the next
  // content top below the title). Falls back to the heading's own bottom
  // when unset.
  sectionEl?: HTMLElement | null;
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
  // Gutter point the trace leaves from. The trace returns to the gutter
  // too, but at the exit end (see exitEnd), not at the anchor.
  anchor: Junction;
  // Scroll position where the previous segment ends.
  prevEnd: number;
  // Document top of the heading's section.
  headingTop: number;
  winHeight: number;
  // Optional cap on the trace end (Projects: the first article must
  // still start after the trace).
  endCap?: number;
  // Gutter Y where the following site segment starts its own approach
  // (Contact only: site-5's email approach starts at gutterEndY). The
  // exit's final turn shrinks so it ends high enough above this point
  // for the approach cubic to keep radius >= 20 (measured offline:
  // exit end 8356 -> r 3.5, 8344 -> r 27.6 at 1440px).
  gutterEndY?: number;
};

export type HeadlineTraceMeasure = HeadlineTraceGroup & {
  // Visible entry/exit segments (untimed; traceHeadline times them).
  entry: Segment;
  exit: Segment;
  // Document point where the exit ends and the next site segment starts.
  exitEnd: { x: number; y: number };
  // Entry route: "direct" (gutter -> turn -> junction) or "gap" (gutter
  // -> inter-line gap run -> curve into the junction).
  entryKind: "direct" | "gap";
};

export type HeadlineTraceResult = HeadlineTraceGroup & {
  segments: Segment[];
  window: [number, number];
  exitEnd: { x: number; y: number };
};

// Bug 8: CTM-scaled dash setter for CLOSED glyph contours. The render
// loop used to paint these with raw user-unit dashes
// (`${visible} ${drawLength - visible}`, offset -startDistance), but a
// glyph contour lives in 1000-units-per-em space behind a
// translate+scale(fontSize/1000) transform (scale ~0.12 desktop,
// ~0.05 mobile), and the glyph-thread CSS sets vector-effect:
// non-scaling-stroke - which makes Chromium apply the dash pattern in
// SCREEN units (Round 8 Piano finding, verified by pixel checks). A
// dash of `visible` user units therefore painted `visible` screen px of
// a contour only drawLength*scale screen px long, so the painted
// fraction was progress/scale: every contour saturated at progress
// ~0.12, within 1-2px of scroll of its ~10-17px slice (measured:
// Exp desktop, window 240px, total weight ~8700, slices 2-17px), and
// the whole headline flipped red at once while the head dot
// (positioned correctly in local units) had nowhere to travel. Scaling
// the dash by the live CTM - the same fix dashSetter applies to stage
// paths - makes the painted fraction equal progress, so each letter
// draws along its contour and the dot rides the leading edge. The
// offset is scaled too, so the painted run starts at the junction.
export function closedGlyphDashSetter(path: SVGPathElement, startDistance: number) {
  const length = path.getTotalLength();
  return (progress: number) => {
    const ctm = path.getScreenCTM();
    const scale = ctm ? Math.hypot(ctm.a, ctm.b) : 1;
    const screenLength = length * scale;
    if (progress <= 0) {
      path.style.strokeDasharray = `0 ${screenLength}`;
      path.style.strokeDashoffset = String(-startDistance * scale);
      path.style.visibility = "hidden";
    } else if (progress >= 1) {
      path.style.strokeDasharray = "none";
      path.style.strokeDashoffset = "0";
      path.style.visibility = "visible";
    } else {
      path.style.strokeDasharray = `${progress * screenLength} ${screenLength}`;
      path.style.strokeDashoffset = String(-startDistance * scale);
      path.style.visibility = "visible";
    }
  };
}

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
        // Bug 8: closed contours carry the CTM-scaled dash setter, so
        // they draw progressively in screen units instead of saturating
        // ~1/scale early under non-scaling-stroke. Shared by the About
        // headline and all four SectionHeading/Contact traces.
        segments.push({ element: path, drawLength: length, weight: length * glyph.scale, startDistance: glyph.junctions[contourIndex]!.distance, kind: "closed", layer: "glyph", startScroll: 0, endScroll: 1, setDash: closedGlyphDashSetter(path, glyph.junctions[contourIndex]!.distance) });
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

  // Bug 9: visible entry/exit geometry for one headline trace (no
  // timing). The entry runs from the gutter anchor into the first glyph
  // junction; the exit runs out of the last glyph junction to a clear
  // band below the title, across to the left gutter, and south again,
  // ending at exitEnd where the next site segment starts. Both are real
  // open paths in the glyph connector group (site space, scale 1, so
  // the render loop's user-unit open dash paints them exactly), driven
  // by the same head dot as the contours. Returns null when the heading
  // has no traced glyphs (the caller then keeps the old anchor wiring).
  const measureHeadlineTrace = (
    config: HeadlineTraceConfig,
    anchor: Junction,
    isMobile: boolean,
    opts?: { gutterEndY?: number },
  ): HeadlineTraceMeasure | null => {
    const group = collectAndBuild(config, isMobile);
    if (!group.order.length || !group.first || !group.last) return null;
    const firstGlyph = group.order[0]!;
    const lastGlyph = group.order[group.order.length - 1]!;
    const firstPath = firstGlyph.paths[0]!;
    const lastPath = lastGlyph.paths[0]!;
    const qk = 0.5523;
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

    // A contour's ink extent on one rendered line, in site space.
    const lineInk = (lineIndex: number, top: boolean) => {
      let value = top ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      for (const glyph of group.order.filter((g) => g.lineIndex === lineIndex)) {
        const path = glyph.paths[0]!;
        const len = path.getTotalLength();
        for (let s = 0; s <= len; s += Math.max(2, len / 60)) {
          const p = pointInSiteSpace(path, s);
          if (!p) continue;
          value = top ? Math.min(value, p.y) : Math.max(value, p.y);
        }
      }
      return value;
    };

    // --- First junction: TOP by default. The contour departs the TOP
    // junction heading east for exp/proj/skills, so the entry arrives
    // heading east. Contact's Y departs its TOP junction diagonally, so
    // the entry uses the LEFT junction instead (departure east); the
    // contour's start moves with it (no visible connector attaches to
    // the first glyph of any headline, so nothing else references the
    // old junction).
    let firstJ = firstGlyph.junctions[0]!;
    let firstDep = contourDeparture(firstPath, firstJ.distance);
    // Whether the first junction is the glyph's LEFT point (Contact's
    // Y) rather than its TOP point; a LEFT junction's run stays on the
    // junction's y (no other contour point shares it), a TOP junction's
    // run sits 3px above the ink top (the glyph's other peaks do).
    let firstIsLeft = false;
    const hasOutgoingConnector = (key: string) =>
      Boolean(connectorGroup.querySelector(`[data-glyph-connector][data-from-glyph='${key}']`));
    if (!(Math.abs(firstDep.x) > 0.9 && Math.abs(firstDep.y) < 0.15) && !hasOutgoingConnector(firstGlyph.key)) {
      const leftJ = findJunction(firstPath, firstGlyph.left, firstGlyph.baselineY, firstGlyph.scale, { mode: "left" });
      const leftDep = contourDeparture(firstPath, leftJ.distance);
      if (Math.abs(leftDep.x) > 0.9 && Math.abs(leftDep.y) < 0.15) {
        firstJ = leftJ;
        firstDep = leftDep;
        firstIsLeft = true;
        firstGlyph.junctions[0] = leftJ;
        group.first = leftJ;
        const seg = group.segments.find((s) => s.element === firstPath);
        if (seg) { seg.startDistance = leftJ.distance; seg.setDash = closedGlyphDashSetter(firstPath, leftJ.distance); }
      }
    }

    // --- Last junction: the RIGHTMOST point of the "." (all four
    // headlines end with "."). The contour arrives there heading
    // south-east, so the exit leaves south-east, curves south, and drops
    // clear of the title. Same move-the-start treatment as the first
    // junction (no visible connector attaches to the last glyph).
    let lastJ = lastGlyph.junctions[0]!;
    const hasIncomingConnector = (key: string) =>
      Boolean(connectorGroup.querySelector(`[data-glyph-connector][data-to-glyph='${key}']`));
    if (!hasIncomingConnector(lastGlyph.key)) {
      const rightJ = findJunction(lastPath, lastGlyph.left, lastGlyph.baselineY, lastGlyph.scale, { mode: "right" });
      lastJ = rightJ;
      lastGlyph.junctions[0] = rightJ;
      group.last = rightJ;
      const seg = group.segments.find((s) => s.element === lastPath);
      if (seg) { seg.startDistance = rightJ.distance; seg.setDash = closedGlyphDashSetter(lastPath, rightJ.distance); }
    }
    const lastArr = contourArrival(lastPath, lastJ.distance);

    // --- Entry: direct when the horizontal run at the junction's height
    // from the gutter to the junction clears the filled text on that
    // line (Range rects of the heading's filled text node). Blocked when
    // filled text precedes the traced word on its line (exp: IDENTITY
    // before MEETS; skills: the tools line before USED).
    const headingEl = config.headingEl!;
    let directBlocked = false;
    const textNode = [...headingEl.childNodes].find(
      (n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 0,
    );
    if (textNode) {
      // A Range rect spans the font's ascent+descent (~1.2em), which is
      // TALLER than the 0.88 line-height box and overlaps the next
      // line's ink top (proj at 1920: the T's ink top 4202.7 sits inside
      // the filled line's rect [4063.75, 4207.75] although it is on the
      // next line; and at 390 the next line's ink top sits within 2px
      // of the previous line's box bottom). Line boxes cannot tell
      // "same line" from "next line" here, so check per character: a
      // filled character blocks the run only when it sits on the first
      // glyph's own line (its rect top matches the glyph span's top)
      // and its x-range overlaps the run. The span carries the dataset
      // key (data-heading-glyph-key for the SectionHeading headlines),
      // not the contour key attribute.
      const spanAttr = `data-${config.keyDataset.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
      const spanEl = headingEl.querySelector<HTMLElement>(`[${spanAttr}='${firstGlyph.key}']`);
      const firstLineTop = spanEl ? docBox(spanEl).top : firstJ.y;
      const text = textNode as Text;
      for (let i = 0; i < text.length; i++) {
        const range = document.createRange();
        range.setStart(text, i);
        range.setEnd(text, i + 1);
        const rect = range.getClientRects()[0];
        if (!rect) continue;
        const top = rect.top + scrollY, left = rect.left + scrollX, right = rect.right + scrollX;
        if (Math.abs(top - firstLineTop) <= 4 && right > anchor.x + 4 && left < firstJ.x - 4) {
          directBlocked = true;
          break;
        }
      }
    }
    const firstInkTop = lineInk(firstGlyph.lineIndex, true);
    // Direct when the run clears the filled text AND the contour
    // departs east (so the run arrives along the departure). Otherwise
    // the gap route, whose final curve arrives along the departure.
    const eastDep = Math.abs(firstDep.x) > 0.9 && Math.abs(firstDep.y) < 0.15;
    const entryKind: "direct" | "gap" = directBlocked || !eastDep ? "gap" : "direct";
    let entryD: string;
    if (entryKind === "direct") {
      // Gutter down, quarter-turn onto the run, straight into the
      // junction heading east (the contour's departure). The run sits
      // 3px ABOVE the ink top, not on it: a TOP junction's glyph has
      // other peaks sharing the cap height (the M's left peak is at
      // exactly the junction's y, 100px away), so a run on the ink-top
      // line passes through them. A LEFT junction (Contact's Y) has no
      // other contour point at its height on the run, so its run stays
      // on the junction's y. When the junction sits close to the
      // gutter there is no room for a run: the turn flows straight
      // into the final curve, whose drop shrinks so the curve keeps
      // radius >= 4 (a cubic with span S and drop D has min radius
      // ~S*S/(4*D), measured offline).
      const runDrop = firstIsLeft ? 0 : 3;
      const r0 = clamp(firstJ.x - anchor.x - 4, 4, 16);
      const k0 = qk * r0;
      const runY = firstJ.y - runDrop;
      const avail = firstJ.x - (anchor.x + r0);
      if (avail >= 9) {
        const kx = Math.min(24, avail - 2);
        entryD = `M ${anchor.x} ${anchor.y} L ${anchor.x} ${runY - r0} C ${anchor.x} ${runY - r0 + k0}, ${anchor.x + r0 - k0} ${runY}, ${anchor.x + r0} ${runY} L ${firstJ.x - kx} ${runY} C ${firstJ.x - kx / 2} ${runY}, ${firstJ.x - kx / 2} ${firstJ.y}, ${firstJ.x} ${firstJ.y}`;
      } else {
        // Tight: shrink the turn so the final curve has room, then
        // drop into the junction in one curve (no run).
        const r = Math.max(4, firstJ.x - anchor.x - 7);
        const k = qk * r;
        const s = firstJ.x - (anchor.x + r);
        const d = Math.min(runDrop, (s * s) / 18);
        const midX = (anchor.x + r + firstJ.x) / 2;
        const ry = firstJ.y - d;
        entryD = `M ${anchor.x} ${anchor.y} L ${anchor.x} ${ry - r} C ${anchor.x} ${ry - r + k}, ${anchor.x + r - k} ${ry}, ${anchor.x + r} ${ry} C ${midX} ${ry}, ${midX} ${firstJ.y}, ${firstJ.x} ${firstJ.y}`;
      }
    } else {
      // Gap route: gutter down to the inter-line slot between the solid
      // line above and the traced line, east along the slot, then a
      // shallow curve down into the junction arriving east. The slot is
      // centred between the line-above ink bottom (its baseline plus a
      // 0.15em descender allowance) and the traced line's ink top, both
      // live-measured; at desktop the slot is ~20px wide.
      const wordIndex = Number(firstGlyph.key.split("-")[config.wordPart]);
      const baselineEl = headingEl.querySelector<HTMLElement>(`[${config.baselineAttr}='${wordIndex}']`);
      const firstBaseline = baselineEl ? docBox(baselineEl).top : firstJ.y;
      const lineHeightPx = Number.parseFloat(getComputedStyle(headingEl).lineHeight) || group.fontSize * 0.88;
      const headingTop = docBox(headingEl).top;
      const slotTop = firstBaseline - lineHeightPx + 0.15 * group.fontSize;
      const slotBottom = firstInkTop;
      let gapY: number;
      if (firstBaseline - lineHeightPx < headingTop - 2 || slotBottom - slotTop < 4) {
        // No line above (or no usable slot): fall back to the direct run
        // rather than routing into the meta band above the title. The
        // Bug 9 test fails loudly if this ever triggers.
        // eslint-disable-next-line no-console
        console.warn(`[bug9] ${config.id}: no inter-line slot for the entry, using direct run`);
        gapY = firstJ.y;
      } else {
        gapY = clamp((slotTop + slotBottom) / 2, slotTop + 2, slotBottom - 2);
      }
      const r1 = Math.min(clamp((gapY - anchor.y) / 3, 8, 24), Math.max(8, firstJ.x - anchor.x - 6));
      const k1 = qk * r1;
      // The final curve must start ahead of the turn's end: when the
      // junction sits close to the gutter there is no room for a run,
      // so the curve starts at the turn's end (same tight-geometry
      // merge as the direct route).
      const gapAvail = firstJ.x - (anchor.x + r1);
      const kx = Math.min(24, Math.max(4, gapAvail - 2));
      const c2x = firstJ.x - firstDep.x * (kx / 2);
      const c2y = firstJ.y - firstDep.y * (kx / 2);
      entryD = gapAvail >= 6
        ? `M ${anchor.x} ${anchor.y} L ${anchor.x} ${gapY - r1} C ${anchor.x} ${gapY - r1 + k1}, ${anchor.x + r1 - k1} ${gapY}, ${anchor.x + r1} ${gapY} L ${firstJ.x - kx} ${gapY} C ${firstJ.x - kx / 2} ${gapY}, ${c2x} ${c2y}, ${firstJ.x} ${firstJ.y}`
        : `M ${anchor.x} ${anchor.y} L ${anchor.x} ${gapY - r1} C ${anchor.x} ${gapY - r1 + k1}, ${anchor.x + r1 - k1} ${gapY}, ${anchor.x + r1} ${gapY} C ${firstJ.x - kx / 2} ${gapY}, ${c2x} ${c2y}, ${firstJ.x} ${firstJ.y}`;
    }

    // --- Exit: leave the last junction along the contour arrival
    // (south-east), curve south, drop to a clear band below the title,
    // run west to the left gutter, quarter-turn south. The band sits
    // midway between the last line's ink bottom and the next content
    // top below the title, measured live.
    const titleBottom = docBox(headingEl).bottom;
    const lastInkBottom = lineInk(lastGlyph.lineIndex, false);
    let nextTop = Number.POSITIVE_INFINITY;
    if (config.sectionEl) {
      for (const el of config.sectionEl.querySelectorAll("*")) {
        if (headingEl.contains(el)) continue;
        const b = docBox(el);
        if (b.top > titleBottom + 2 && b.bottom - b.top > 4 && b.right - b.left > 4) {
          nextTop = Math.min(nextTop, b.top);
        }
      }
    }
    if (!Number.isFinite(nextTop)) nextTop = titleBottom + 60;
    const bandY = nextTop - lastInkBottom < 16
      ? lastInkBottom + 8
      : clamp((lastInkBottom + nextTop) / 2, lastInkBottom + 8, nextTop - 8);
    // Final turn radius: 16 by default. For Contact the following site
    // segment (site-5) starts its email approach at gutterEndY, so the
    // exit must end high enough above it for the approach cubic to keep
    // radius >= 20 (measured offline: exit end 8356 -> r 3.5, 8344 ->
    // r 27.6 at 1440px); the radius shrinks to the 5px floor when the
    // band sits at or below gutterEndY (a quarter-turn cubic's true min
    // radius is 0.99x its r, so 5 keeps the measured radius >= 4).
    const r3 = opts?.gutterEndY === undefined ? 16 : clamp(opts.gutterEndY - bandY - 18, 5, 16);
    const r2 = 12;
    const avail = bandY - lastJ.y;
    // The first curve leaves along the contour arrival (south-east) and
    // arrives heading south. Its along-arrival extent h1 sets the
    // radius: h1=18 gives r 3.8 when the drop clamps to v1=2 on mobile
    // (measured offline), h1=24 gives r ~4.5.
    const h1 = 24;
    let v1 = 12;
    let rr2 = r2;
    if (lastArr.y * h1 + v1 + 4 + rr2 > avail) v1 = Math.max(2, avail - lastArr.y * h1 - 4 - rr2);
    if (lastArr.y * h1 + v1 + 4 + rr2 > avail) rr2 = Math.max(6, avail - lastArr.y * h1 - v1 - 4);
    const e1x = lastJ.x + lastArr.x * h1;
    const e1y = lastJ.y + lastArr.y * h1 + v1;
    const k2 = qk * rr2;
    const k3 = qk * r3;
    // The second control point sits above E1 by 60% of the drop, so it
    // stays between the junction and E1: a fixed 14px offset goes above
    // the junction when the drop is small (mobile: the band sits close
    // under the title, v1 clamps to 2 and the curve kinks, r 3.1).
    const c2y = e1y - Math.max(2, (e1y - lastJ.y) * 0.6);
    const exitD = `M ${lastJ.x} ${lastJ.y} C ${lastJ.x + lastArr.x * 10} ${lastJ.y + lastArr.y * 10}, ${e1x} ${c2y}, ${e1x} ${e1y} L ${e1x} ${bandY - rr2} C ${e1x} ${bandY - rr2 + k2}, ${e1x - rr2 + k2} ${bandY}, ${e1x - rr2} ${bandY} L ${anchor.x + r3} ${bandY} C ${anchor.x + r3 - k3} ${bandY}, ${anchor.x} ${bandY + r3 - k3}, ${anchor.x} ${bandY + r3}`;
    const exitEnd = { x: anchor.x, y: bandY + r3 };

    const mkPath = (d: string, attr: string, kind?: string) => {
      const el = document.createElementNS(SVG_NS, "path");
      el.setAttribute("d", d);
      el.setAttribute(attr, "");
      el.setAttribute("data-headline-id", config.id);
      if (kind) el.setAttribute("data-entry-kind", kind);
      connectorGroup.append(el);
      return el;
    };
    const entryEl = mkPath(entryD, "data-headline-entry", entryKind);
    const exitEl = mkPath(exitD, "data-headline-exit");
    const entryLen = entryEl.getTotalLength();
    const exitLen = exitEl.getTotalLength();
    // Weights are a fraction of the path lengths: the entry/exit must
    // take a real scroll span (so the user sees the thread travel in
    // and out) without starving the contours. Calibrated against the
    // live scale: the exp trace totals ~8700 weight over a ~240px
    // window at 1440px, so weight 300 buys an ~8px entry span while the
    // Bug 8 M slice stays ~9px (the Bug 8 test needs >= 2 partial
    // states at 4px steps). A full-length weight would take a third of
    // the window each; the 40-60 floor from the first draft would paint
    // in ~1px of scroll.
    const weight = (len: number) => clamp(len * 0.3, 100, 300);
    return {
      ...group,
      entry: { element: entryEl, drawLength: entryLen, weight: weight(entryLen), startDistance: 0, kind: "open", layer: "glyph", startScroll: 0, endScroll: 1 },
      exit: { element: exitEl, drawLength: exitLen, weight: weight(exitLen), startDistance: 0, kind: "open", layer: "glyph", startScroll: 0, endScroll: 1 },
      exitEnd,
      entryKind,
    };
  };

  // Full headline trace: collect + build, wrap with VISIBLE entry/exit
  // travel to and from the gutter anchor, and time the whole group
  // across the Bug-1 window. The caller wires the returned segments into
  // the site-thread chain at the anchor point, and starts the following
  // site segment at exitEnd.
  const traceHeadline = (
    config: HeadlineTraceConfig,
    chain: HeadlineTraceChain,
    isMobile: boolean,
    premeasured?: HeadlineTraceMeasure | null,
  ): HeadlineTraceResult => {
    const m = premeasured ?? measureHeadlineTrace(config, chain.anchor, isMobile, { gutterEndY: chain.gutterEndY });
    if (!m || !m.order.length || !m.first || !m.last) {
      const group = collectAndBuild(config, isMobile);
      return { ...group, segments: [], window: [chain.prevEnd, chain.prevEnd], exitEnd: chain.anchor };
    }
    const window = headlineTraceWindow({
      headingTop: chain.headingTop,
      lastLineBottom: m.lastLineBottom,
      prevEnd: chain.prevEnd,
      winHeight: chain.winHeight,
      endCap: chain.endCap,
    });
    const segments: Segment[] = [m.entry, ...m.segments, m.exit];
    const totalWeight = segments.reduce((sum, segment) => sum + segment.weight, 0);
    let cursor = window[0];
    segments.forEach((segment) => {
      const end = cursor + (window[1] - window[0]) * segment.weight / totalWeight;
      setTiming(segment, cursor, end);
      cursor = end;
    });
    return { ...m, segments, window, exitEnd: m.exitEnd };
  };

  return { collectAndBuild, traceHeadline, measureHeadlineTrace };
}
