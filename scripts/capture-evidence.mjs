import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import path from "path";

const OUT_DIR = path.resolve("design-explorations/screenshots/glyph-trace");

async function waitForServer(url, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} failed to respond.`);
}

async function capture() {
  let serverProcess = null;
  try {
    await fetch("http://127.0.0.1:4322").catch(() => {
      console.log("Starting preview server on port 4322...");
      serverProcess = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4322"], {
        stdio: "inherit",
        detached: false,
      });
    });
    await waitForServer("http://127.0.0.1:4322");
    console.log("Server ready.");

    const browser = await chromium.launch({ channel: "chrome" });

    // Round 4 regression capture matrix
    const matrix = [
      {
        name: "1920",
        viewport: { width: 1920, height: 927 },
        frames: [
          { state: "hero-initial", y: 0 },
          { state: "hero-mid", y: 460 },
          { state: "boundary-handoff", y: 620 },
        ],
      },
      {
        name: "1440",
        viewport: { width: 1440, height: 900 },
        frames: [
          { state: "hero-mid", y: 450 },
          { state: "boundary-handoff", y: 600 },
          { state: "glyph-completed", y: 1450 },
        ],
      },
      {
        name: "701",
        viewport: { width: 701, height: 800 },
        frames: [
          { state: "hero-mid", y: 380 },
          { state: "boundary-handoff", y: 520 },
        ],
      },
      {
        name: "700",
        viewport: { width: 700, height: 800 },
        frames: [
          { state: "hero-mid", y: 380 },
          { state: "boundary-handoff", y: 520 },
        ],
      },
      {
        name: "576",
        viewport: { width: 576, height: 800 },
        frames: [
          { state: "hero-mid", y: 360 },
          { state: "boundary-handoff", y: 510 },
        ],
      },
      {
        name: "390",
        viewport: { width: 390, height: 844 },
        frames: [
          { state: "hero-mid", y: 360 },
          { state: "boundary-handoff", y: 510 },
          { state: "glyph-completed", y: 1250 },
        ],
      },
    ];

    for (const item of matrix) {
      console.log(`Processing ${item.name} (${item.viewport.width}x${item.viewport.height})...`);
      const page = await browser.newPage({
        viewport: item.viewport,
        deviceScaleFactor: 1,
      });
      await page.goto("http://127.0.0.1:4322");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(300);

      for (const frame of item.frames) {
        await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), frame.y);
        await page.waitForFunction((top) => Math.abs(window.scrollY - top) < 2, frame.y);
        await page.waitForTimeout(300);

        const filePath = path.join(OUT_DIR, `${item.name}-${frame.state}.png`);
        await page.screenshot({ path: filePath, fullPage: false });
        console.log(`Saved ${filePath} at scrollY ${frame.y}`);
      }

      await page.close();
    }

    // Also preserve legacy desktop and mobile before/entry/mid/exit/after captures for historical continuity
    const legacyTargets = [
      {
        name: "desktop",
        viewport: { width: 1440, height: 900 },
        scrollStates: [
          { state: "before", y: 650 },
          { state: "entry", y: 850 },
          { state: "mid", y: 1075 },
          { state: "exit", y: 1310 },
          { state: "after", y: 1450 },
        ],
      },
      {
        name: "mobile",
        viewport: { width: 390, height: 844 },
        scrollStates: [
          { state: "before", y: 540 },
          { state: "entry", y: 670 },
          { state: "mid", y: 880 },
          { state: "exit", y: 1100 },
          { state: "after", y: 1250 },
        ],
      },
    ];

    for (const target of legacyTargets) {
      const page = await browser.newPage({
        viewport: target.viewport,
        deviceScaleFactor: 1,
      });
      await page.goto("http://127.0.0.1:4322");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(300);

      for (const { state, y } of target.scrollStates) {
        await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
        await page.waitForFunction((top) => Math.abs(window.scrollY - top) < 2, y);
        await page.waitForTimeout(200);

        const filePath = path.join(OUT_DIR, `${target.name}-${state}.png`);
        await page.screenshot({ path: filePath, fullPage: false });
      }

      const afterY = target.name === "desktop" ? 1450 : 1250;
      await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), afterY);
      await page.waitForFunction((top) => Math.abs(window.scrollY - top) < 2, afterY);
      await page.waitForTimeout(200);

      const headerBox = await page.locator("[data-site-header]").boundingBox();
      if (headerBox) {
        const headerCropPath = path.join(OUT_DIR, `${target.name}-header-after.png`);
        await page.screenshot({
          path: headerCropPath,
          clip: {
            x: 0,
            y: 0,
            width: target.viewport.width,
            height: Math.ceil(headerBox.height + 30),
          },
        });
      }
      await page.close();
    }

    await browser.close();
    console.log("All screenshots captured successfully.");
  } finally {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
  }
}

capture().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
