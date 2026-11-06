import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

// Round 7 motion evidence: the hero-to-glyph connector (item 0 gap fix) and
// the per-project thread motifs (items 3-4). Adapted from
// capture-round-6-motion.mjs with two changes: bundled Chromium instead of
// channel "chrome", and the "hidden travel" phase replaced by the visible
// connector phase (hero | handoff | connector | glyph).

const RECORDINGS_DIR = path.resolve("design-explorations/recordings");
const FRAMES_DIR = path.resolve("design-explorations/screenshots/glyph-trace/round-7");

fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
fs.mkdirSync(FRAMES_DIR, { recursive: true });

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

async function smoothScroll(page, startY, endY, durationMs, stepMs = 30) {
  const steps = Math.max(1, Math.round(durationMs / stepMs));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // easeInOutQuad
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const y = Math.round(startY + (endY - startY) * ease);
    await page.evaluate((top) => {
      window.scrollTo({ top, behavior: "instant" });
      window.dispatchEvent(new Event("scroll"));
    }, y);
    await page.waitForTimeout(stepMs);
  }
}

async function recordSequence(browser, viewport, label, size) {
  console.log(`Recording ${label} Round 7 motion...`);
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: RECORDINGS_DIR, size },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4322");
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  const isMobile = viewport.width <= 700;
  const geom = await page.evaluate((mobile) => {
    const hero = document.getElementById("top") || document.querySelector(".hero");
    const heroH = hero ? hero.getBoundingClientRect().height : window.innerHeight;
    const s0 = Math.round(heroH * 0.55);
    const firstGlyph = document.querySelector(".about__glyph");
    const firstY = firstGlyph ? firstGlyph.getBoundingClientRect().top + window.scrollY : heroH + 400;
    // Connector runs sHandoffEnd..sGlyphStart; glyph starts at sGlyphStart.
    const sGlyphStart = Math.round(firstY - window.innerHeight * 0.72);
    const docH = document.documentElement.scrollHeight;
    return { s0, sGlyphStart, docH, mobile };
  }, isMobile);

  console.log(`${label} geometry:`, geom);

  // Hero segment 2 early / mid / late
  const early = isMobile ? 80 : 100;
  const mid = isMobile ? 210 : 260;
  const late = isMobile ? 380 : 440;
  await smoothScroll(page, 0, early, 1000);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(FRAMES_DIR, `round-7-${label}-hero-seg2-early.png`) });
  await smoothScroll(page, early, mid, 1000);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(FRAMES_DIR, `round-7-${label}-hero-seg2-mid.png`) });
  await smoothScroll(page, mid, late, 1000);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(FRAMES_DIR, `round-7-${label}-hero-seg2-late.png`) });

  // Handoff (between s0 and connector start)
  const midB = Math.round((geom.s0 + geom.sGlyphStart) / 2) - 120;
  await smoothScroll(page, late, midB, 800);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(FRAMES_DIR, `round-7-${label}-handoff-b.png`) });

  // Connector: mid-way between handoff end and glyph start, thread visible
  const midC = Math.round((geom.s0 + geom.sGlyphStart) / 2);
  await smoothScroll(page, midB, midC, 600);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(FRAMES_DIR, `round-7-${label}-connector-c.png`) });

  // First glyph active
  const inD = geom.sGlyphStart + 90;
  await smoothScroll(page, midC, inD, 900);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(FRAMES_DIR, `round-7-${label}-glyph-d.png`) });

  // Motif stages: scroll each article to mid-draw and full, capture the stage
  for (const slug of ["fb-messenger-e2ee", "sky-sheet-store", "sky-auto-piano"]) {
    const art = await page.evaluate((s) => {
      const a = document.getElementById(s);
      const r = a.getBoundingClientRect();
      return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY) };
    }, slug);
    const vh = viewport.height;
    const startY = art.top - Math.round(vh * 0.8);
    const endY = art.bottom - Math.round(vh * 0.45);
    const midY = Math.round(startY + (endY - startY) * 0.5);
    await smoothScroll(page, inD, midY, 1200);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(FRAMES_DIR, `round-7-${label}-motif-${slug}-mid.png`) });
    await smoothScroll(page, midY, endY, 1200);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(FRAMES_DIR, `round-7-${label}-motif-${slug}-full.png`) });
  }

  // Reverse back to top
  const maxY = geom.docH - viewport.height;
  await smoothScroll(page, maxY, 0, 2500);
  await page.waitForTimeout(300);

  const video = page.video();
  await page.close();
  await context.close();

  if (video) {
    const videoPath = await video.path();
    const targetPath = path.join(RECORDINGS_DIR, `round-7-${label}-hero-connector-glyph.webm`);
    fs.renameSync(videoPath, targetPath);
    console.log("Saved:", targetPath);
  }
}

async function run() {
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
    console.log("Preview server ready.");

    const browser = await chromium.launch();

    await recordSequence(browser, { width: 1920, height: 927 }, "1920x927", { width: 1920, height: 927 });
    await recordSequence(browser, { width: 390, height: 844 }, "390x844", { width: 390, height: 844 });

    await browser.close();
    console.log("All Round 7 recordings captured successfully.");
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
