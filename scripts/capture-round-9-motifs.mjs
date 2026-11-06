import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

// Round 9 motif evidence: initial / mid / final captures of the three
// rebuilt project visuals (meaningful thread storytelling), desktop
// 1440x900 and mobile 390x844. Initial = storyboard State 1 (p ~ 0),
// mid = State 2 (p = 0.5), final = State 3 (p = 1). All shots use CDP
// captureBeyondViewport with a document-coordinate clip of the stage:
// Playwright fullPage screenshots resize the viewport and smear fixed
// elements, and the stage is not always in the viewport at p ~ 0.

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
    const positions = {
      initial: startY + 5,
      mid: Math.round(startY + (endY - startY) * 0.5),
      // Piano final is p ~ 0.92, not p = 1: at p = 1 the song is over and
      // no key is lit (taps flash briefly by design); at 0.92 the last
      // note (L at 10.5s) is sounding and the L key is lit.
      final: slug === "sky-auto-piano"
        ? Math.round(startY + (endY - startY) * 0.92)
        : endY + 100,
    };

    for (const [state, y] of Object.entries(positions)) {
      await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: "instant" }), y);
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
      fs.writeFileSync(path.join(OUT_DIR, `motif4-${slug}-${state}${label}.png`), Buffer.from(shot.data, "base64"));
      console.log(`${state} ${slug} ${label} scrollY=${y} docBox`, JSON.stringify(docBox));
    }
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
    console.log("All Round 9 motif captures done.");
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
