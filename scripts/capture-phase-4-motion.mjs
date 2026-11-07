import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

// Phase 4 motion evidence: initial / mid / final scrub states plus one
// reverse-scroll state per project scene, desktop 1440x900 and mobile
// 390x844. Adapts scripts/capture-round-8-motifs.mjs: bundled Chromium,
// CDP captureBeyondViewport with a document-coordinate clip (never
// Playwright fullPage screenshots - they resize the viewport and smear
// fixed elements), fixed elements hidden, scroll-behavior auto injected,
// and a long settle wait for the scrub:1 playhead. Each captured state is
// confirmed against the live data-thread-progress attribute published by
// apply() in src/scripts/project-threads.ts - scroll position alone is
// not trusted, because the scrub tween lags the scroll by up to ~1s and
// the trigger positions shift ~22px while the page entrance settles.

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

async function captureState(page, context, slug, label, suffix, scrollY) {
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
  const file = path.join(OUT_DIR, `motif7-${slug}-${label}${suffix}.png`);
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  console.log(`${label} ${slug}${suffix}: p=${p} box=${JSON.stringify(docBox)}`);
  return p;
}

async function captureViewport(browser, viewport, suffix) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(BASE_URL);
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "html{scroll-behavior:auto !important}" });
  await page.addStyleTag({ content: "[data-site-header], .skip-link, a[href='#main-content']{display:none !important}" });
  // Let the page entrance (motion.ts, y 24) settle and the thread
  // ScrollTriggers re-measure (project-threads.ts refreshes 1200ms after
  // fonts.ready); otherwise trigger positions are ~22px off.
  await page.waitForTimeout(2500);
  const vh = viewport.height;

  for (const slug of SLUGS) {
    const art = await page.evaluate((s) => {
      const a = document.getElementById(s);
      const r = a.getBoundingClientRect();
      return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY) };
    }, slug);
    const startY = art.top - Math.round(vh * 0.8);
    const endY = art.bottom - Math.round(vh * 0.45);
    const midY = Math.round(startY + (endY - startY) * 0.5);
    // 5% past the trigger end, matching the test's p = 1.05 scroll.
    const finalY = Math.round(endY + (endY - startY) * 0.05);

    await captureState(page, context, slug, "initial", suffix, startY);
    await captureState(page, context, slug, "mid", suffix, midY);
    await captureState(page, context, slug, "final", suffix, finalY);
    // Reversibility: scroll back down to the midpoint after reaching
    // full scrub and confirm p returns to ~0.5 with the mid state
    // re-rendered.
    await captureState(page, context, slug, "reverse-mid", suffix, midY);
  }

  await context.close();
}

async function run() {
  let serverProcess = null;
  if (!(await waitForServer(BASE_URL, 6))) {
    console.log("Starting preview server on port 4322...");
    // Detached + stdio ignored so the server never holds this script's
    // pipes open (an orphaned server otherwise hangs the shell forever).
    serverProcess = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4322"], { stdio: "ignore", detached: true });
    if (!(await waitForServer(BASE_URL))) throw new Error("Preview server failed to respond.");
  }
  console.log("Preview server ready.");
  try {
    const browser = await chromium.launch();
    await captureViewport(browser, { width: 1440, height: 900 }, "");
    await captureViewport(browser, { width: 390, height: 844 }, "-mobile");
    await browser.close();
    console.log("All Phase 4 motion captures done.");
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
