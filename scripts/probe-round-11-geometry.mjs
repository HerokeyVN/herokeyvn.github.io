// Round 11 workstream A diagnostic probe: tangent / curvature audit of every
// thread path (hero, site segments, glyph connectors, project motifs).
// Diagnostic only - deleted before committing. Usage: node scripts/probe-round-11-geometry.mjs
import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import fs from "fs";

const OUT = "/home/hatch/workspace/portfolio-check/thread11-probe.json";
const BASE_URL = "http://127.0.0.1:4322";

async function waitForServer(url, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const PROBE_FN = () => {
  // --- path parsing helpers (run in page) ---
  const parseD = (d) => {
    const tokens = d.match(/[MLC]|[-+]?\d*\.?\d+/g) || [];
    const cmds = [];
    let i = 0;
    let cmd = null;
    let cur = null;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === "M" || t === "L" || t === "C") {
        cmd = t;
        i++;
        continue;
      }
      const x = parseFloat(tokens[i]);
      const y = parseFloat(tokens[i + 1]);
      i += 2;
      if (cmd === "M") {
        cur = { x, y };
        cmds.push({ cmd: "M", p: { x, y } });
        cmd = "L"; // subsequent pairs are implicit linetos (not used here)
      } else if (cmd === "L") {
        cmds.push({ cmd: "L", from: cur, p: { x, y } });
        cur = { x, y };
      } else if (cmd === "C") {
        const c1 = { x, y };
        const c2 = { x: parseFloat(tokens[i]), y: parseFloat(tokens[i + 1]) };
        const p = { x: parseFloat(tokens[i + 2]), y: parseFloat(tokens[i + 3]) };
        i += 4;
        cmds.push({ cmd: "C", from: cur, c1, c2, p });
        cur = p;
      }
    }
    return cmds;
  };
  const ang = (v) => (Math.atan2(v.y, v.x) * 180) / Math.PI;
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const norm = (v) => {
    const l = Math.hypot(v.x, v.y) || 1;
    return { x: v.x / l, y: v.y / l };
  };
  const angleBetween = (a, b) => {
    const d = Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y)));
    return (d * 180) / Math.PI;
  };
  const startTangent = (c) => {
    if (c.cmd === "L") return norm(sub(c.p, c.from));
    return norm(sub(c.c1, c.from));
  };
  const endTangent = (c) => {
    if (c.cmd === "L") return norm(sub(c.p, c.from));
    return norm(sub(c.p, c.c2));
  };
  const startCurvature = (c) => {
    if (c.cmd !== "C") return 0;
    const a = sub(c.c1, c.from);
    const b = sub(c.c2, c.c1);
    const la = Math.hypot(a.x, a.y);
    if (la < 0.001) return 0;
    const cross = Math.abs(a.x * b.y - a.y * b.x);
    return ((2 / 3) * cross) / (la * la * la); // 1/px; radius = 1/k
  };
  const endCurvature = (c) => {
    if (c.cmd !== "C") return 0;
    const a = sub(c.p, c.c2);
    const b = sub(c.c2, c.c1);
    const la = Math.hypot(a.x, a.y);
    if (la < 0.001) return 0;
    const cross = Math.abs(a.x * b.y - a.y * b.x);
    return ((2 / 3) * cross) / (la * la * la);
  };
  // Max curvature along a cubic by sampling the analytic derivative.
  const maxCurvature = (c) => {
    if (c.cmd !== "C") return 0;
    let max = 0;
    for (let k = 0; k <= 40; k++) {
      const t = k / 40;
      const mt = 1 - t;
      const dx =
        3 * mt * mt * (c.c1.x - c.from.x) + 6 * mt * t * (c.c2.x - c.c1.x) + 3 * t * t * (c.p.x - c.c2.x);
      const dy =
        3 * mt * mt * (c.c1.y - c.from.y) + 6 * mt * t * (c.c2.y - c.c1.y) + 3 * t * t * (c.p.y - c.c2.y);
      const ddx =
        6 * mt * (c.c2.x - 2 * c.c1.x + c.from.x) + 6 * t * (c.p.x - 2 * c.c2.x + c.c1.x);
      const ddy =
        6 * mt * (c.c2.y - 2 * c.c1.y + c.from.y) + 6 * t * (c.p.y - 2 * c.c2.y + c.c1.y);
      const sp = Math.hypot(dx, dy);
      if (sp < 1e-6) continue;
      const kcur = Math.abs(dx * ddy - dy * ddx) / (sp * sp * sp);
      max = Math.max(max, kcur);
    }
    return max;
  };
  const auditPath = (d, label) => {
    const cmds = parseD(d);
    const joints = [];
    for (let i = 1; i < cmds.length; i++) {
      const prev = cmds[i - 1];
      const cur = cmds[i];
      if (prev.cmd === "M") continue;
      const mismatch = angleBetween(endTangent(prev), startTangent(cur));
      joints.push({
        at: { x: Math.round(cur.from.x * 10) / 10, y: Math.round(cur.from.y * 10) / 10 },
        inAngle: Math.round(ang(endTangent(prev)) * 10) / 10,
        outAngle: Math.round(ang(startTangent(cur)) * 10) / 10,
        mismatchDeg: Math.round(mismatch * 10) / 10,
        kInEnd: Math.round(endCurvature(prev) * 10000) / 10000,
        kOutStart: Math.round(startCurvature(cur) * 10000) / 10000,
      });
    }
    const cubics = cmds
      .filter((c) => c.cmd === "C")
      .map((c) => ({
        from: { x: Math.round(c.from.x), y: Math.round(c.from.y) },
        kStart: Math.round(startCurvature(c) * 10000) / 10000,
        rStart: startCurvature(c) > 0 ? Math.round(1 / startCurvature(c)) : null,
        kEnd: Math.round(endCurvature(c) * 10000) / 10000,
        rEnd: endCurvature(c) > 0 ? Math.round(1 / endCurvature(c)) : null,
        kMax: Math.round(maxCurvature(c) * 10000) / 10000,
        rMin: maxCurvature(c) > 0 ? Math.round(1 / maxCurvature(c)) : null,
      }));
    return { label, d, joints, cubics };
  };
  const distToBox = (p, b) => {
    const dx = Math.max(b.left - p.x, 0, p.x - b.right);
    const dy = Math.max(b.top - p.y, 0, p.y - b.bottom);
    return Math.hypot(dx, dy);
  };
  const minDistPathToBox = (path, box) => {
    const len = path.getTotalLength();
    let min = Infinity;
    for (let s = 0; s <= len; s += 2) {
      const pt = path.getPointAtLength(s);
      min = Math.min(min, distToBox(pt, box));
    }
    return Math.round(min * 10) / 10;
  };
  const rectOf = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY) };
  };

  const out = { width: innerWidth, height: innerHeight };

  // --- layout anchors ---
  out.layout = {
    heroHeight: document.querySelector("#top")?.offsetHeight,
    aboutTop: Math.round((document.querySelector("#about")?.getBoundingClientRect().top ?? 0) + scrollY),
    expTop: Math.round((document.querySelector("#experience")?.getBoundingClientRect().top ?? 0) + scrollY),
    projTop: Math.round((document.querySelector("#projects")?.getBoundingClientRect().top ?? 0) + scrollY),
    skillsTop: Math.round((document.querySelector("#skills")?.getBoundingClientRect().top ?? 0) + scrollY),
    contactTop: Math.round((document.querySelector("#contact")?.getBoundingClientRect().top ?? 0) + scrollY),
    kicker: rectOf(".about__kicker"),
    filledSpan: rectOf(".about__title > span:first-child"),
    statement: rectOf(".about__statement"),
    profile: rectOf(".about__profile"),
    emailBtn: rectOf(".contact__email-btn"),
    docHeight: document.documentElement.scrollHeight,
  };

  // --- hero paths (viewBox coords) ---
  const isMobile = innerWidth <= 700;
  const heroSel = isMobile ? "[data-thread-segment-mobile]" : "[data-thread-segment]";
  out.hero = [...document.querySelectorAll(`.hero-thread ${heroSel}`)]
    .sort((a, b) => Number(a.dataset.threadSegment ?? a.dataset.threadSegmentMobile) - Number(b.dataset.threadSegment ?? b.dataset.threadSegmentMobile))
    .map((p) => auditPath(p.getAttribute("d"), `hero-seg-${p.dataset.threadSegment ?? p.dataset.threadSegmentMobile}`));
  // Hero cross-segment joints (end tangent of seg i vs start tangent of seg i+1)
  const heroCmds = out.hero.map((h) => parseD(h.d));
  out.heroJoints = [];
  for (let i = 0; i < heroCmds.length - 1; i++) {
    const a = heroCmds[i][heroCmds[i].length - 1];
    const b = heroCmds[i + 1][0];
    // b is the M command; the next command carries the start tangent
    const bFirst = heroCmds[i + 1].find((c) => c.cmd !== "M");
    out.heroJoints.push({
      between: `${i}->${i + 1}`,
      mismatchDeg: Math.round(angleBetween(endTangent(a), startTangent(bFirst)) * 10) / 10,
      inAngle: Math.round(ang(endTangent(a)) * 10) / 10,
      outAngle: Math.round(ang(startTangent(bFirst)) * 10) / 10,
    });
  }

  // --- site segments ---
  const sitePaths = [...document.querySelectorAll("[data-site-thread-segment]")].sort(
    (a, b) => Number(a.dataset.siteThreadSegment) - Number(b.dataset.siteThreadSegment),
  );
  out.site = sitePaths.map((p, i) => auditPath(p.getAttribute("d"), `site-${i}`));
  // Handoff exit tangent (site-0 end) vs connector start tangent (site-6 start)
  {
    const s0 = parseD(sitePaths[0].getAttribute("d"));
    const s6 = parseD(sitePaths[6].getAttribute("d"));
    const s0End = s0[s0.length - 1];
    const s6First = s6.find((c) => c.cmd !== "M");
    out.handoffToConnector = {
      mismatchDeg: Math.round(angleBetween(endTangent(s0End), startTangent(s6First)) * 10) / 10,
      inAngle: Math.round(ang(endTangent(s0End)) * 10) / 10,
      outAngle: Math.round(ang(startTangent(s6First)) * 10) / 10,
    };
    // Connector clearance vs kicker + filled span
    const conn = sitePaths[6];
    out.connectorClearance = {
      kicker: minDistPathToBox(conn, out.layout.kicker),
      filledSpan: minDistPathToBox(conn, out.layout.filledSpan),
    };
    // Site-1 clearance vs statement/profile
    out.site1Clearance = {
      statement: minDistPathToBox(sitePaths[1], out.layout.statement),
      profile: minDistPathToBox(sitePaths[1], out.layout.profile),
    };
    // Site-5 end vs email button
    const s5 = sitePaths[5];
    const end5 = s5.getPointAtLength(s5.getTotalLength());
    out.site5End = {
      end: { x: Math.round(end5.x), y: Math.round(end5.y) },
      emailLeft: out.layout.emailBtn?.left,
      emailTop: out.layout.emailBtn?.top,
      emailBottom: out.layout.emailBtn?.bottom,
      distToEmail: minDistPathToBox(s5, out.layout.emailBtn),
    };
  }

  // --- first/last glyph junctions + contour tangents (for site-1 exit) ---
  {
    const glyphOf = (key) => {
      const path = glyphSvg.querySelector(`path[data-glyph-key="${key}"][data-glyph-contour="0"]`);
      return path;
    };
    // First/last junctions are the connector endpoints; recover them from
    // site-6 end (first) and site-1 start (last).
    const s6 = sitePaths[6];
    const s1 = sitePaths[1];
    const firstPt = s6.getPointAtLength(s6.getTotalLength());
    const lastPt = s1.getPointAtLength(0);
    const contourDirAt = (pt, side) => {
      const glyphSvgLocal = document.querySelector("[data-glyph-thread]");
      // Find the glyph contour whose outline passes nearest to pt.
      let best = null;
      for (const path of glyphSvgLocal.querySelectorAll('path[data-glyph-contour="0"]')) {
        const tr = path.getAttribute("transform") || "";
        const m = tr.match(/translate\(([\d.-]+) ([\d.-]+)\) scale\(([\d.]+)\)/);
        if (!m) continue;
        const ox = parseFloat(m[1]);
        const by = parseFloat(m[2]);
        const s = parseFloat(m[3]);
        const lx = (pt.x - ox) / s;
        const ly = (pt.y - by) / s;
        const len = path.getTotalLength();
        for (let i = 0; i <= 240; i++) {
          const dist = (len * i) / 240;
          const p = path.getPointAtLength(dist);
          const dd = Math.hypot(p.x - lx, p.y - ly);
          if (!best || dd < best.dd) best = { dd, dist, len, path, key: path.dataset.glyphKey };
        }
      }
      if (!best || best.dd > 5) return { key: best?.key, errLocal: best?.dd, angleDeg: null };
      const eps = 3;
      const pA = best.path.getPointAtLength((best.dist - eps + best.len) % best.len);
      const pB = best.path.getPointAtLength((best.dist + eps) % best.len);
      const dir = side === "from" ? sub({ x: pB.x, y: pB.y }, pA) : sub(pB, pA);
      // For the LAST junction the thread arrives along the contour (travel
      // direction at the junction = p(dist) - p(dist-eps)); for the FIRST
      // junction the trace departs along p(dist+eps) - p(dist). Both are
      // the same direction for a smooth contour; report both sides.
      const dirIn = sub(best.path.getPointAtLength(best.dist), pA);
      const dirOut = sub(pB, best.path.getPointAtLength(best.dist));
      return {
        key: best.key,
        errLocal: Math.round(best.dd * 10) / 10,
        inAngle: Math.round(ang(norm(dirIn)) * 10) / 10,
        outAngle: Math.round(ang(norm(dirOut)) * 10) / 10,
      };
    };
    out.glyphEnds = {
      first: { pt: { x: Math.round(firstPt.x), y: Math.round(firstPt.y) }, ...contourDirAt(firstPt, "from") },
      last: { pt: { x: Math.round(lastPt.x), y: Math.round(lastPt.y) }, ...contourDirAt(lastPt, "from") },
    };
  }

  // --- cross-path site joints (1->2, 2->3, 3->4, 4->5) ---
  {
    out.siteJoints = [];
    for (let i = 1; i <= 4; i++) {
      const a = parseD(sitePaths[i].getAttribute("d"));
      const b = parseD(sitePaths[i + 1].getAttribute("d"));
      const aLast = a[a.length - 1];
      const bFirst = b.find((c) => c.cmd !== "M");
      out.siteJoints.push({
        between: `${i}->${i + 1}`,
        mismatchDeg: Math.round(angleBetween(endTangent(aLast), startTangent(bFirst)) * 10) / 10,
        inAngle: Math.round(ang(endTangent(aLast)) * 10) / 10,
        outAngle: Math.round(ang(startTangent(bFirst)) * 10) / 10,
      });
    }
    // hero exit -> handoff start
    const heroExit = document.querySelector(isMobile ? "[data-thread-segment-mobile='2']" : "[data-thread-segment='2']");
    if (heroExit) {
      const len = heroExit.getTotalLength();
      const m = heroExit.getScreenCTM();
      const pEnd = heroExit.getPointAtLength(len);
      const pPre = heroExit.getPointAtLength(Math.max(0, len - 2));
      let t = { x: pEnd.x - pPre.x, y: pEnd.y - pPre.y };
      if (m) t = { x: t.x * m.a + t.y * m.c, y: t.x * m.b + t.y * m.d };
      const s0 = parseD(sitePaths[0].getAttribute("d"));
      const s0First = s0.find((c) => c.cmd !== "M");
      out.heroToHandoff = {
        mismatchDeg: Math.round(angleBetween(norm(t), startTangent(s0First)) * 10) / 10,
        heroExitAngle: Math.round(ang(norm(t)) * 10) / 10,
        handoffStartAngle: Math.round(ang(startTangent(s0First)) * 10) / 10,
      };
    }
    // site-5 min x (off-canvas check)
    const s5 = sitePaths[5];
    const len5 = s5.getTotalLength();
    let minX = Infinity;
    for (let s = 0; s <= len5; s += 2) minX = Math.min(minX, s5.getPointAtLength(s).x);
    out.site5MinX = Math.round(minX * 10) / 10;
  }

  // --- glyph connectors: junction tangents ---
  const glyphSvg = document.querySelector("[data-glyph-thread]");
  const connectors = [...document.querySelectorAll("[data-glyph-connector]")];
  out.connectors = connectors.map((el) => {
    const d = el.getAttribute("d");
    const cmds = parseD(d);
    const first = cmds.find((c) => c.cmd !== "M");
    const last = cmds[cmds.length - 1];
    const fromKey = el.dataset.fromGlyph;
    const toKey = el.dataset.toGlyph;
    const contourTangent = (key, point, side) => {
      const path = glyphSvg.querySelector(`path[data-glyph-key="${key}"][data-glyph-contour="0"]`);
      if (!path) return null;
      const tr = path.getAttribute("transform") || "";
      const m = tr.match(/translate\(([\d.-]+) ([\d.-]+)\) scale\(([\d.]+)\)/);
      if (!m) return null;
      const ox = parseFloat(m[1]);
      const by = parseFloat(m[2]);
      const s = parseFloat(m[3]);
      const lx = (point.x - ox) / s;
      const ly = (point.y - by) / s;
      // nearest distance on the contour to the local point
      const len = path.getTotalLength();
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i <= 240; i++) {
        const dist = (len * i) / 240;
        const p = path.getPointAtLength(dist);
        const dd = Math.hypot(p.x - lx, p.y - ly);
        if (dd < bestD) {
          bestD = dd;
          best = dist;
        }
      }
      const eps = 3;
      const pA = path.getPointAtLength((best - eps + len) % len);
      const pB = path.getPointAtLength((best + eps) % len);
      // travel direction: increasing distance. Arrival direction at the
      // junction (from) = p(best) - p(best-eps); departure direction at the
      // target junction (to) = p(best+eps) - p(best).
      const dir = side === "from" ? sub({ x: lx, y: ly }, pA) : sub(pB, { x: lx, y: ly });
      return {
        angleDeg: Math.round(ang(norm(dir)) * 10) / 10,
        nearestErrLocal: Math.round(bestD * 10) / 10,
      };
    };
    const fromPt = cmds[0].p;
    const toPt = last.p;
    const fromTan = contourTangent(fromKey, fromPt, "from");
    const toTan = contourTangent(toKey, toPt, "to");
    const outTan = startTangent(first);
    const inTan = endTangent(last);
    return {
      from: fromKey,
      to: toKey,
      d,
      fromJunction: { x: Math.round(fromPt.x), y: Math.round(fromPt.y) },
      toJunction: { x: Math.round(toPt.x), y: Math.round(toPt.y) },
      contourFromAngle: fromTan?.angleDeg,
      connectorOutAngle: Math.round(ang(outTan) * 10) / 10,
      departMismatchDeg: fromTan ? Math.round(angleBetween(norm({ x: Math.cos((fromTan.angleDeg * Math.PI) / 180), y: Math.sin((fromTan.angleDeg * Math.PI) / 180) }), outTan) * 10) / 10 : null,
      contourToAngle: toTan?.angleDeg,
      connectorInAngle: Math.round(ang(inTan) * 10) / 10,
      arriveMismatchDeg: toTan ? Math.round(angleBetween(norm({ x: Math.cos((toTan.angleDeg * Math.PI) / 180), y: Math.sin((toTan.angleDeg * Math.PI) / 180) }), inTan) * 10) / 10 : null,
    };
  });

  // --- project motifs: joints between consecutive paths (shared viewBox) ---
  out.projects = {};
  for (const stage of [...document.querySelectorAll("[data-project-thread-stage]")]) {
    const slug = stage.dataset.projectSlug;
    for (const variant of ["desktop", "mobile"]) {
      const svgs = [...stage.querySelectorAll(`svg[data-variant="${variant}"]`)];
      const paths = svgs.flatMap((svg) => [...svg.querySelectorAll(".project-thread-path")].map((p) => ({ layer: svg.dataset.layer, d: p.getAttribute("d") })));
      const audited = paths.map((p, i) => auditPath(p.d, `${slug}/${variant}/${p.layer}[${i}]`));
      // joints between consecutive paths in document order (back then front
      // per layer grouping is DOM order: back svg paths, then front svg paths)
      const joints = [];
      const allCmds = paths.map((p) => parseD(p.d));
      for (let i = 0; i < allCmds.length - 1; i++) {
        const a = allCmds[i][allCmds[i].length - 1];
        const bFirst = allCmds[i + 1].find((c) => c.cmd !== "M");
        const bM = allCmds[i + 1][0];
        // Only report joints where the next path starts where this one ends
        const aEnd = a.cmd === "L" ? a.p : a.p;
        const gap = Math.hypot(bM.p.x - aEnd.x, bM.p.y - aEnd.y);
        joints.push({
          between: `${i}->${i + 1}`,
          gap: Math.round(gap * 10) / 10,
          mismatchDeg: Math.round(angleBetween(endTangent(a), startTangent(bFirst)) * 10) / 10,
          inAngle: Math.round(ang(endTangent(a)) * 10) / 10,
          outAngle: Math.round(ang(startTangent(bFirst)) * 10) / 10,
        });
      }
      out.projects[`${slug}/${variant}`] = { paths: audited, joints };
    }
  }
  return out;
};

async function run() {
  let serverProcess = null;
  if (!(await waitForServer(BASE_URL, 6))) {
    console.log("Starting preview server on port 4322...");
    serverProcess = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4322"], { stdio: "ignore", detached: true, cwd: "/home/hatch/workspace/herokeyvn.github.io" });
    if (!(await waitForServer(BASE_URL))) throw new Error("Preview server failed to respond.");
  }
  console.log("Preview server ready.");
  const browser = await chromium.launch();
  const result = {};
  try {
    for (const [label, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto(BASE_URL);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() =>
        [...document.querySelectorAll("[data-site-thread-segment]")].reduce((t, p) => t + p.getTotalLength(), 0) > 1000,
      );
      await page.waitForTimeout(500);
      result[label] = await page.evaluate(PROBE_FN);
      console.log(`probed ${label}`);
      await context.close();
    }
  } finally {
    await browser.close();
    if (serverProcess) {
      try { process.kill(-serverProcess.pid, "SIGTERM"); } catch {}
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log("Wrote", OUT);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
