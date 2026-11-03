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

  const targets = [
    {
      name: "desktop",
      viewport: { width: 1440, height: 900 },
      isMobile: false,
    },
    {
      name: "mobile",
      viewport: { width: 390, height: 844 },
      isMobile: true,
    },
  ];

  for (const target of targets) {
    console.log(`Processing ${target.name}...`);
    const page = await browser.newPage({
      viewport: target.viewport,
      deviceScaleFactor: 1,
    });
    await page.goto("http://127.0.0.1:4322");
    await page.waitForFunction(() => document.querySelectorAll("[data-glyph-contour]").length === 17);
    await page.waitForTimeout(500);

    const timing = await page.evaluate(() => {
      const contours = [...document.querySelectorAll("[data-glyph-contour]")];
      const connectors = [...document.querySelectorAll("[data-glyph-connector]")];
      const paths = [...document.querySelectorAll("[data-site-thread-segment]")];
      return {
        contourCount: contours.length,
        connectorCount: connectors.length,
        pathCount: paths.length,
      };
    });
    console.log(`${target.name} elements:`, timing);

    // Let us find the exact scroll values for the 5 states
    // In our spec and previous run:
    // desktop: before=650, entry=850, mid=1075, exit=1310, after=1450
    // mobile: before=540, entry=670, mid=880, exit=1100, after=1250
    const scrollStates = target.name === "desktop"
      ? [
          { state: "before", y: 650 },
          { state: "entry", y: 850 },
          { state: "mid", y: 1075 },
          { state: "exit", y: 1310 },
          { state: "after", y: 1450 },
        ]
      : [
          { state: "before", y: 540 },
          { state: "entry", y: 670 },
          { state: "mid", y: 880 },
          { state: "exit", y: 1100 },
          { state: "after", y: 1250 },
        ];

    for (const { state, y } of scrollStates) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
      await page.waitForFunction((top) => Math.abs(window.scrollY - top) < 2, y);
      await page.waitForTimeout(300);

      const filePath = path.join(OUT_DIR, `${target.name}-${state}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`Saved ${filePath} at scrollY ${y}`);
    }

    // Capture header crop at submitted after state
    const afterY = target.name === "desktop" ? 1450 : 1250;
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), afterY);
    await page.waitForFunction((top) => Math.abs(window.scrollY - top) < 2, afterY);
    await page.waitForTimeout(300);

    const headerBox = await page.locator("[data-site-header]").boundingBox();
    console.log(`${target.name} header bounding box:`, headerBox);
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
    console.log(`Saved header crop ${headerCropPath}`);

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
