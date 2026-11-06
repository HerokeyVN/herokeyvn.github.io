import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

// Round 8 motif evidence: fresh mid-draw and fully-drawn captures of the
// three redesigned project thread motifs, desktop 1440x900 and mobile
// 390x844. Mid shots use a normal viewport scrolled to the scrub midpoint
// (real scroll-driven state). Full shots use a full-page capture clipped to
// the stage: the tall viewport puts every motif at scrub progress 1, so the
// whole stage is in frame even for the tall panoramic article.

const OUT_DIR = "/home/hatch/workspace/portfolio-check";
const BASE_URL = "http://127.0.0.1:4322";

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

async function captureViewport(browser, viewport, label) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(BASE_URL);
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);
  // Disable smooth scrolling: the capture scrolls must land instantly so
  // the scrub playhead settles at the intended progress before the shot.
  await page.addStyleTag({ content: "html{scroll-behavior:auto !important}" });
  // Hide fixed chrome for the captures: CDP captureBeyondViewport paints
  // fixed elements (sticky header, skip link) into the captured region.
  // They are out of flow, so hiding them does not move the motifs.
  await page.addStyleTag({ content: "[data-site-header], .skip-link, a[href='#main-content']{display:none !important}" });
  await page.waitForTimeout(400);
  const vh = viewport.height;

  for (const slug of ["fb-messenger-e2ee", "sky-sheet-store", "sky-auto-piano"]) {
    const art = await page.evaluate((s) => {
      const a = document.getElementById(s);
      const r = a.getBoundingClientRect();
      return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY) };
    }, slug);
    const startY = art.top - Math.round(vh * 0.8);
    const endY = art.bottom - Math.round(vh * 0.45);
    const midY = Math.round(startY + (endY - startY) * 0.5);

    // Mid-draw: real scrub state at the midpoint, stage clipped from viewport.
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), midY);
    await page.waitForTimeout(2500);
    const stage = page.locator(`#${slug} [data-project-thread-stage]`);
    const box = await stage.boundingBox();
    if (box) {
      await page.screenshot({ path: path.join(OUT_DIR, `motif3-${slug}-mid${label}.png`), clip: box });
      console.log(`mid ${slug} ${label} box`, JSON.stringify(box));
    } else {
      console.log(`mid ${slug} ${label}: stage not visible, full viewport shot`);
      await page.screenshot({ path: path.join(OUT_DIR, `motif3-${slug}-mid${label}.png`) });
    }

    // Full: scroll past the trigger end so the motif is complete, then
    // capture the stage's document region with CDP captureBeyondViewport.
    // (Playwright's fullPage screenshot resizes the viewport, which
    // re-lays-out the page, recomputes ScrollTrigger progress, and smears
    // fixed elements across the capture. CDP captures the region at the
    // current scroll state with no resize.)
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), endY + 100);
    await page.waitForTimeout(2500);
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
    fs.writeFileSync(path.join(OUT_DIR, `motif3-${slug}-full${label}.png`), Buffer.from(shot.data, "base64"));
    console.log(`full ${slug} ${label} docBox`, JSON.stringify(docBox));
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
    console.log("All Round 8 motif captures done.");
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
