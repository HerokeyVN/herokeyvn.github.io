// Round 12 integration evidence: one continuous thread through the whole
// page. Desktop 1440x900 + mobile 390x844 (+ 1280x720 for the glyph exit
// and the career timeline). Adapts scripts/capture-phase-4-motion.mjs:
// bundled Chromium, CDP captureBeyondViewport stage clips for the project
// scenes (never Playwright fullPage screenshots), fixed elements hidden,
// scroll-behavior auto, scrub settle waits. Project mid/final states are
// confirmed against the live data-thread-progress attribute; the glyph
// exit / headline / timeline shots are viewport screenshots at computed
// scroll steps through the site-1 exit drop and the site-2 timeline run.
// Serves the dev server on 4322 (no build needed) when nothing listens
// there yet, matching the round-12 timeline probe.

import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const OUT_DIR = "/home/hatch/workspace/portfolio-check";
const BASE_URL = "http://127.0.0.1:4322";
const SLUGS = ["fb-messenger-e2ee", "sky-sheet-store", "sky-auto-piano"];

fs.mkdirSync(OUT_DIR, { recursive: true });

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

// Poll data-thread-progress until it stops moving (scrub catch-up done)
// or the deadline passes; returns the last read value.
async function settleProgress(page, slug, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  let prev = null;
  let last = null;
  while (Date.now() < deadline) {
    last = await page.evaluate((s) => {
      const stage = document.querySelector(`#${s} [data-project-thread-stage]`);
      return stage ? Number(stage.dataset.threadProgress) : NaN;
    }, slug);
    if (prev !== null && Math.abs(last - prev) < 0.002) return last;
    prev = last;
    await page.waitForTimeout(400);
  }
  return last;
}

async function viewportShot(page, name, scrollY) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), scrollY);
  await page.waitForTimeout(1500);
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file });
  console.log(`${name}: scrollY=${scrollY}`);
}

async function stageShot(page, context, slug, label, suffix, scrollY) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), scrollY);
  await page.waitForTimeout(1800);
  const p = await settleProgress(page, slug);
  const docBox = await page.evaluate((s) => {
    const el = document.querySelector(`#${s} [data-project-thread-stage]`);
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top + scrollY), width: Math.round(r.width), height: Math.round(r.height) };
  }, slug);
  const cdp = await context.newCDPSession(page);
  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    clip: { x: docBox.x, y: docBox.y, width: docBox.width, height: docBox.height, scale: 1 },
    captureBeyondViewport: true,
  });
  const file = path.join(OUT_DIR, `motif8-${slug}-${label}${suffix}.png`);
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  console.log(`${label} ${slug}${suffix}: p=${p} box=${JSON.stringify(docBox)}`);
  return p;
}

async function captureViewport(browser, viewport, suffix, scenes) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(BASE_URL);
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "html{scroll-behavior:auto !important}" });
  await page.addStyleTag({ content: "[data-site-header], .skip-link, a[href='#main-content']{display:none !important}" });
  await page.waitForTimeout(2500);
  const vh = viewport.height;

  // (a) Glyph exit route at several scroll steps: anchor on the About
  // statement (the exit drop starts just below the headline) and step
  // down through the drop and the stadium crossing.
  const stmtTop = await page.evaluate(() => {
    const el = document.querySelector(".about__statement");
    return Math.round(el.getBoundingClientRect().top + scrollY);
  });
  const exitBase = stmtTop - Math.round(vh * 0.55);
  for (let i = 0; i < 4; i++) {
    await viewportShot(page, `motif8-glyph-exit-${i + 1}${suffix}.png`, exitBase + i * 250);
  }

  // (b) Experience headline tracing mid-draw: the heading centred, then
  // one step further into the trace.
  const expTop = await page.evaluate(() => {
    const el = document.querySelector("#experience-title");
    return Math.round(el.getBoundingClientRect().top + scrollY);
  });
  await viewportShot(page, `motif8-exp-headline-mid${suffix}.png`, expTop - Math.round(vh * 0.45));
  await viewportShot(page, `motif8-exp-headline-late${suffix}.png`, expTop - Math.round(vh * 0.45) + 350);

  // (c) Career timeline with both numbered nodes: the milestone list
  // centred in the viewport.
  const tlTop = await page.evaluate(() => {
    const el = document.querySelector(".progression-timeline");
    return Math.round(el.getBoundingClientRect().top + scrollY);
  });
  await viewportShot(page, `motif8-timeline${suffix}.png`, tlTop - Math.round(vh * 0.4));
  await viewportShot(page, `motif8-timeline-late${suffix}.png`, tlTop - Math.round(vh * 0.4) + 300);

  // (d) Each project scene mid and final (CDP stage clips).
  if (scenes) {
    for (const slug of SLUGS) {
      const art = await page.evaluate((s) => {
        const a = document.getElementById(s);
        const r = a.getBoundingClientRect();
        return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY) };
      }, slug);
      const startY = art.top - Math.round(vh * 0.8);
      const endY = art.bottom - Math.round(vh * 0.45);
      const midY = Math.round(startY + (endY - startY) * 0.5);
      const finalY = Math.round(endY + (endY - startY) * 0.05);

      await stageShot(page, context, slug, "mid", suffix, midY);
      await stageShot(page, context, slug, "final", suffix, finalY);
      await stageShot(page, context, slug, "reverse-mid", suffix, midY);
    }
  }

  await context.close();
}

async function run() {
  let serverProcess = null;
  if (!(await waitForServer(BASE_URL, 6))) {
    console.log("Starting dev server on port 4322...");
    // Detached + stdio ignored so the server never holds this script's
    // pipes open (an orphaned server otherwise hangs the shell forever).
    serverProcess = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4322"], { stdio: "ignore", detached: true });
    if (!(await waitForServer(BASE_URL))) throw new Error("Dev server failed to respond.");
  }
  console.log("Server ready.");
  try {
    const browser = await chromium.launch();
    await captureViewport(browser, { width: 1440, height: 900 }, "", true);
    await captureViewport(browser, { width: 390, height: 844 }, "-mobile", true);
    await captureViewport(browser, { width: 1280, height: 720 }, "-1280", false);
    await browser.close();
    console.log("All Round 12 captures done.");
  } finally {
    if (serverProcess) {
      try { process.kill(-serverProcess.pid, "SIGTERM"); } catch {}
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
