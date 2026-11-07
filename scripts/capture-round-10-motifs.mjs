import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

// Round 10 static art-direction evidence: one complete static composition
// per project (no scroll animation is wired yet - Phase 2), desktop
// 1440x900 and mobile 390x844, plus a detail crop of each focal point.
// All shots use CDP captureBeyondViewport with a document-coordinate clip
// of the stage: Playwright fullPage screenshots resize the viewport and
// smear fixed elements.

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

// Focal-point crops, as fractions of the stage box (desktop viewBox coords
// mapped to the rendered stage). E2EE: sealed core. Sheet Store: the fan.
// Piano: the terraced tiers.
const CROPS = {
  "fb-messenger-e2ee": { x: 0.6, y: 0.15, w: 0.4, h: 0.7 },
  "sky-sheet-store": { x: 0.0, y: 0.0, w: 0.65, h: 0.75 },
  "sky-auto-piano": { x: 0.25, y: 0.1, w: 0.75, h: 0.7 },
};

async function captureViewport(browser, viewport, label) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(BASE_URL);
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "html{scroll-behavior:auto !important}" });
  // Hide fixed chrome for the captures: CDP captureBeyondViewport paints
  // fixed elements (sticky header, skip link) into the captured region.
  await page.addStyleTag({ content: "[data-site-header], .skip-link, a[href='#main-content']{display:none !important}" });
  await page.waitForTimeout(400);

  for (const slug of ["fb-messenger-e2ee", "sky-sheet-store", "sky-auto-piano"]) {
    // Scroll the stage into the middle of the viewport so the article
    // entrance tween has settled, then wait for it.
    await page.evaluate((s) => {
      const el = document.querySelector(`#${s} [data-project-thread-stage]`);
      el.scrollIntoView({ block: "center", behavior: "instant" });
    }, slug);
    await page.waitForTimeout(2000);
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
    fs.writeFileSync(path.join(OUT_DIR, `motif5-${slug}-static${label}.png`), Buffer.from(shot.data, "base64"));
    console.log(`static ${slug} ${label} docBox`, JSON.stringify(docBox));

    const crop = CROPS[slug];
    const cropClip = {
      x: Math.round(docBox.x + docBox.width * crop.x),
      y: Math.round(docBox.y + docBox.height * crop.y),
      width: Math.round(docBox.width * crop.w),
      height: Math.round(docBox.height * crop.h),
      scale: 1,
    };
    const cropShot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      clip: cropClip,
      captureBeyondViewport: true,
    });
    fs.writeFileSync(path.join(OUT_DIR, `motif5-${slug}-detail${label}.png`), Buffer.from(cropShot.data, "base64"));
    console.log(`detail ${slug} ${label} clip`, JSON.stringify(cropClip));
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
    console.log("All Round 10 static captures done.");
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
