import { chromium } from "@playwright/test";
import { spawn } from "child_process";

const BASE_URL = "http://127.0.0.1:4322";

async function waitForServer(url, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try { const res = await fetch(url); if (res.ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// Min screen-px distance from every sample of every active thread path to
// each named in-stage text element, plus thread endpoint positions.
async function probe(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(BASE_URL);
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "html{scroll-behavior:auto !important}" });
  await page.waitForTimeout(1500);

  const result = await page.evaluate(() => {
    const out = {};
    const isMobile = window.innerWidth <= 700;
    const variant = isMobile ? "mobile" : "desktop";
    for (const stage of [...document.querySelectorAll("[data-project-thread-stage]")]) {
      const slug = stage.dataset.projectSlug;
      const stageBox = stage.getBoundingClientRect();
      const svgs = [...stage.querySelectorAll(`svg[data-variant="${variant}"]`)];
      const paths = svgs.flatMap((svg) => [...svg.querySelectorAll(".project-thread-path")]);
      const samples = [];
      let outside = 0;
      for (const path of paths) {
        const ctm = path.getScreenCTM();
        const len = path.getTotalLength();
        for (let d = 0; d <= len; d += 2) {
          const pt = path.getPointAtLength(d);
          const sp = ctm ? new DOMPoint(pt.x, pt.y).matrixTransform(ctm) : pt;
          samples.push({ x: sp.x, y: sp.y });
          if (sp.x < stageBox.left - 2 || sp.x > stageBox.right + 2 || sp.y < stageBox.top - 2 || sp.y > stageBox.bottom + 2) outside++;
        }
      }
      // Endpoints: first point of the first front path, last point of the
      // last front path, in stage-relative coords.
      const frontSvg = stage.querySelector(`svg[data-variant="${variant}"][data-layer="thread-front"]`);
      const frontPaths = [...frontSvg.querySelectorAll(".project-thread-path")];
      const first = frontPaths[0];
      const last = frontPaths[frontPaths.length - 1];
      const firstPt = first.getPointAtLength(0);
      const lastPt = last.getPointAtLength(last.getTotalLength());
      const ctmF = first.getScreenCTM();
      const ctmL = last.getScreenCTM();
      const f = new DOMPoint(firstPt.x, firstPt.y).matrixTransform(ctmF);
      const l = new DOMPoint(lastPt.x, lastPt.y).matrixTransform(ctmL);
      const endpoints = {
        first: { x: Math.round(f.x - stageBox.left), y: Math.round(f.y - stageBox.top) },
        last: { x: Math.round(l.x - stageBox.left), y: Math.round(l.y - stageBox.top) },
        stage: { w: Math.round(stageBox.width), h: Math.round(stageBox.height) },
      };
      // Clearance to in-stage text elements.
      const clearance = {};
      const textEls = [...stage.querySelectorAll(".fig-label, .mono-label, .mono-caption, .sheet-card__title, .sheet-card__line, .sheet-stat__value, .sheet-stat__label, .sheet-detail__title, .sheet-detail__artist, .e2ee-letter, .piano-key, .sheet-key")];
      for (const el of textEls) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        let min = Infinity;
        for (const s of samples) {
          const dx = Math.max(r.left - s.x, 0, s.x - r.right);
          const dy = Math.max(r.top - s.y, 0, s.y - r.bottom);
          min = Math.min(min, Math.hypot(dx, dy));
        }
        const key = (el.dataset.el || el.className.split(" ")[0] || el.tagName) + (el.textContent ? ":" + el.textContent.slice(0, 24) : "");
        clearance[key] = Math.round(min * 10) / 10;
      }
      // Sheet Store: distance from the melody start to the first note head.
      let melodyStart = null;
      if (slug === "sky-sheet-store") {
        const note0 = stage.querySelector(".sheet-note-head");
        const melody = frontSvg.querySelectorAll(".project-thread-path")[1];
        if (note0 && melody) {
          const nb = note0.getBoundingClientRect();
          const m0 = melody.getPointAtLength(0);
          const ms = new DOMPoint(m0.x, m0.y).matrixTransform(melody.getScreenCTM());
          melodyStart = Math.round(Math.hypot(ms.x - (nb.left + nb.width / 2), ms.y - (nb.top + nb.height / 2)) * 10) / 10;
        }
      }
      out[slug] = { paths: paths.length, samples: samples.length, outside, endpoints, melodyStart, clearance };
    }
    return out;
  });
  console.log(`\n=== ${viewport.width}x${viewport.height} (${viewport.width <= 700 ? "mobile" : "desktop"}) ===`);
  console.log(JSON.stringify(result, null, 1));
  await context.close();
}

async function run() {
  let serverProcess = null;
  if (!(await waitForServer(BASE_URL, 6))) {
    serverProcess = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4322"], { stdio: "ignore", detached: true });
    if (!(await waitForServer(BASE_URL))) throw new Error("Preview server failed to respond.");
  }
  const browser = await chromium.launch();
  await probe(browser, { width: 1440, height: 900 });
  await probe(browser, { width: 390, height: 844 });
  await browser.close();
  if (serverProcess) { try { process.kill(-serverProcess.pid, "SIGTERM"); } catch {} }
}
run().catch((err) => { console.error(err); process.exit(1); });
