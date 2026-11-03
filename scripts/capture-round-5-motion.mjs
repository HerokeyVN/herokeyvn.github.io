import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const RECORDINGS_DIR = path.resolve("design-explorations/recordings");
const FRAMES_DIR = path.resolve("design-explorations/screenshots/glyph-trace/round-5");

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

    const browser = await chromium.launch({ channel: "chrome" });

    // 1. Record 1920x927 normal motion A -> D -> pause in C -> reverse D -> A
    console.log("Recording 1920x927 motion...");
    {
      const context = await browser.newContext({
        viewport: { width: 1920, height: 927 },
        recordVideo: { dir: RECORDINGS_DIR, size: { width: 1920, height: 927 } },
      });
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:4322");
      await page.waitForLoadState("domcontentloaded");
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);

      const geom = await page.evaluate(() => {
        const hero = document.getElementById("top") || document.querySelector(".hero");
        const heroH = hero ? hero.getBoundingClientRect().height : 927;
        const s0 = Math.round(heroH * 0.55);
        const header = document.querySelector("[data-site-header]");
        const headerH = header ? header.offsetHeight : 52;
        const heroExit = document.querySelector("[data-thread-segment='2']");
        const p = heroExit.getPointAtLength(heroExit.getTotalLength());
        const m = heroExit.getScreenCTM();
        const heroEndY = m ? p.x * m.b + p.y * m.d + m.f + scrollY : heroH;
        const targetL = Math.min(60, Math.max(50, window.innerWidth * 0.04));
        const dx = Math.round(targetL / 2.45);
        const dy = Math.round(Math.abs(dx) * 2.18);
        const handoffBottom = heroEndY + dy;
        const sOccluded = Math.ceil(handoffBottom - headerH);
        const firstGlyph = document.querySelector(".about__glyph");
        const firstY = firstGlyph ? firstGlyph.getBoundingClientRect().top + window.scrollY : heroH + 400;
        const sGlyphStart = Math.max(sOccluded + 85, Math.round(firstY - window.innerHeight * 0.72));
        return { s0, sOccluded, sGlyphStart };
      });

      console.log("1920 geometry:", geom);

      // Phase A: Scroll from 0 to s0
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-5-1920-phase-A.png") });
      await smoothScroll(page, 0, geom.s0, 1200);

      // Phase B: Scroll to mid handoff (s0 + sOccluded)/2
      const midB = Math.round((geom.s0 + geom.sOccluded) / 2);
      await smoothScroll(page, geom.s0, midB, 800);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-5-1920-phase-B.png") });

      // Phase C: Scroll to mid hidden travel (sOccluded + sGlyphStart)/2
      const midC = Math.round((geom.sOccluded + geom.sGlyphStart) / 2);
      await smoothScroll(page, midB, midC, 800);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-5-1920-phase-C.png") });
      await page.waitForTimeout(600); // pause briefly in C per work order

      // Phase D: Scroll to active glyph
      const glyphD = geom.sGlyphStart + 140;
      await smoothScroll(page, midC, glyphD, 1200);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-5-1920-phase-D.png") });

      // Reverse D -> A
      await smoothScroll(page, glyphD, midC, 1000);
      await page.waitForTimeout(300);
      await smoothScroll(page, midC, midB, 700);
      await smoothScroll(page, midB, 0, 1200);
      await page.waitForTimeout(500);

      const video = page.video();
      await page.close();
      await context.close();
      if (video) {
        const videoPath = await video.path();
        const dest = path.join(RECORDINGS_DIR, "round-5-1920x927-lifecycle.webm");
        fs.renameSync(videoPath, dest);
        console.log("Saved video to:", dest);
      }
    }

    // 2. Record 390x844 mobile normal motion A -> D -> pause in C -> reverse D -> A
    console.log("Recording 390x844 motion...");
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        recordVideo: { dir: RECORDINGS_DIR, size: { width: 390, height: 844 } },
      });
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:4322");
      await page.waitForLoadState("domcontentloaded");
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);

      const geom = await page.evaluate(() => {
        const hero = document.getElementById("top") || document.querySelector(".hero");
        const heroH = hero ? hero.getBoundingClientRect().height : 844;
        const s0 = Math.round(heroH * 0.55);
        const header = document.querySelector("[data-site-header]");
        const headerH = header ? header.offsetHeight : 52;
        const heroExit = document.querySelector("[data-thread-segment-mobile='2']");
        const p = heroExit.getPointAtLength(heroExit.getTotalLength());
        const m = heroExit.getScreenCTM();
        const heroEndY = m ? p.x * m.b + p.y * m.d + m.f + scrollY : heroH;
        const targetL = Math.min(42, Math.max(34, window.innerWidth * 0.09));
        const dx = -Math.round(targetL / 2.45);
        const dy = Math.round(Math.abs(dx) * 2.18);
        const handoffBottom = heroEndY + dy;
        const sOccluded = Math.ceil(handoffBottom - headerH);
        const firstGlyph = document.querySelector(".about__glyph");
        const firstY = firstGlyph ? firstGlyph.getBoundingClientRect().top + window.scrollY : heroH + 400;
        const sGlyphStart = Math.max(sOccluded + 65, Math.round(firstY - window.innerHeight * 0.72));
        return { s0, sOccluded, sGlyphStart };
      });

      console.log("390 geometry:", geom);

      // Phase A: Scroll from 0 to s0
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-5-390-phase-A.png") });
      await smoothScroll(page, 0, geom.s0, 1000);

      // Phase B: Scroll to mid handoff (s0 + sOccluded)/2
      const midB = Math.round((geom.s0 + geom.sOccluded) / 2);
      await smoothScroll(page, geom.s0, midB, 700);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-5-390-phase-B.png") });

      // Phase C: Scroll to mid hidden travel (sOccluded + sGlyphStart)/2
      const midC = Math.round((geom.sOccluded + geom.sGlyphStart) / 2);
      await smoothScroll(page, midB, midC, 700);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-5-390-phase-C.png") });
      await page.waitForTimeout(600); // pause in C

      // Phase D: Scroll to active glyph
      const glyphD = geom.sGlyphStart + 120;
      await smoothScroll(page, midC, glyphD, 1000);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-5-390-phase-D.png") });

      // Reverse D -> A
      await smoothScroll(page, glyphD, midC, 900);
      await page.waitForTimeout(300);
      await smoothScroll(page, midC, midB, 600);
      await smoothScroll(page, midB, 0, 1000);
      await page.waitForTimeout(500);

      const video = page.video();
      await page.close();
      await context.close();
      if (video) {
        const videoPath = await video.path();
        const dest = path.join(RECORDINGS_DIR, "round-5-390x844-lifecycle.webm");
        fs.renameSync(videoPath, dest);
        console.log("Saved video to:", dest);
      }
    }

    // 3. Record 701x800 -> 700x800 resize stopped in C
    console.log("Recording 701 -> 700 resize motion...");
    {
      const context = await browser.newContext({
        viewport: { width: 701, height: 800 },
        recordVideo: { dir: RECORDINGS_DIR, size: { width: 701, height: 800 } },
      });
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:4322");
      await page.waitForLoadState("domcontentloaded");
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);

      // Scroll to C at 701
      const sC = await page.evaluate(() => {
        const hero = document.getElementById("top") || document.querySelector(".hero");
        const heroH = hero ? hero.getBoundingClientRect().height : 800;
        const heroExit = document.querySelector("[data-thread-segment='2']");
        const p = heroExit.getPointAtLength(heroExit.getTotalLength());
        const m = heroExit.getScreenCTM();
        const heroEndY = m ? p.x * m.b + p.y * m.d + m.f + scrollY : heroH;
        const targetL = Math.min(60, Math.max(50, window.innerWidth * 0.04));
        const dx = Math.round(targetL / 2.45);
        const dy = Math.round(Math.abs(dx) * 2.18);
        const handoffBottom = heroEndY + dy;
        const header = document.querySelector("[data-site-header]");
        const headerH = header ? header.offsetHeight : 52;
        const sOccluded = Math.ceil(handoffBottom - headerH);
        return sOccluded + 30;
      });

      await smoothScroll(page, 0, sC, 1200);
      await page.waitForTimeout(800); // stopped in C

      // Live resize 701 -> 700
      console.log("Resizing to 700x800 while stopped in C...");
      await page.setViewportSize({ width: 700, height: 800 });
      await page.waitForTimeout(800); // verify stopped in C after resize

      // Forward into D
      await smoothScroll(page, sC, sC + 200, 1000);
      await page.waitForTimeout(400);

      // Reverse back to A
      await smoothScroll(page, sC + 200, sC, 800);
      await smoothScroll(page, sC, 0, 1200);
      await page.waitForTimeout(500);

      const video = page.video();
      await page.close();
      await context.close();
      if (video) {
        const videoPath = await video.path();
        const dest = path.join(RECORDINGS_DIR, "round-5-701-to-700-resize.webm");
        fs.renameSync(videoPath, dest);
        console.log("Saved video to:", dest);
      }
    }

    await browser.close();
    console.log("All Round 5 recordings and frame extracts completed successfully.");
  } finally {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
  }
}

run().catch((err) => {
  console.error("Recording error:", err);
  process.exit(1);
});
