import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const RECORDINGS_DIR = path.resolve("design-explorations/recordings");
const FRAMES_DIR = path.resolve("design-explorations/screenshots/glyph-trace/round-6");

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

    // 1. Record 1920x927 normal motion with Hero segment 2 oscillation & full sequence
    console.log("Recording 1920x927 Round 6 motion...");
    {
      const context = await browser.newContext({
        viewport: { width: 1920, height: 927 },
        recordVideo: { dir: RECORDINGS_DIR, size: { width: 1920, height: 927 } },
      });
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:4322");
      await page.waitForLoadState("domcontentloaded");
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);

      const geom = await page.evaluate(() => {
        const hero = document.getElementById("top") || document.querySelector(".hero");
        const heroH = hero ? hero.getBoundingClientRect().height : 927;
        const s0 = Math.round(heroH * 0.55);
        const header = document.querySelector("[data-site-header]");
        const headerH = header ? header.offsetHeight : 60;
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

      // Early segment 2 activation range: oscillate around 80 -> 120 -> 90 -> 140
      await smoothScroll(page, 0, 100, 1000);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-6-1920-hero-seg2-early.png") });

      // Oscillate to verify no backward shrinking suffix
      await smoothScroll(page, 100, 70, 600);
      await page.waitForTimeout(100);
      await smoothScroll(page, 70, 140, 800);
      await page.waitForTimeout(100);
      await smoothScroll(page, 140, 100, 600);
      await page.waitForTimeout(100);

      // Mid segment 2 activation (~250px)
      await smoothScroll(page, 100, 260, 1000);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-6-1920-hero-seg2-mid.png") });

      // Late segment 2 activation (~440px)
      await smoothScroll(page, 260, 440, 1000);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-6-1920-hero-seg2-late.png") });

      // Phase B: Seam handoff
      const midB = Math.round((geom.s0 + geom.sOccluded) / 2);
      await smoothScroll(page, 440, midB, 800);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-6-1920-handoff-b.png") });

      // Phase C: Hidden travel pause
      const midC = Math.round((geom.sOccluded + geom.sGlyphStart) / 2);
      await smoothScroll(page, midB, midC, 600);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-6-1920-hidden-c.png") });

      // Phase D: First glyph active
      const inD = geom.sGlyphStart + 90;
      await smoothScroll(page, midC, inD, 900);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-6-1920-glyph-d.png") });

      // Reverse back: D -> C -> B -> Hero seg 2 -> 0
      await smoothScroll(page, inD, midC, 800);
      await page.waitForTimeout(150);
      await smoothScroll(page, midC, midB, 600);
      await page.waitForTimeout(150);
      await smoothScroll(page, midB, 260, 900);
      await page.waitForTimeout(150);
      await smoothScroll(page, 260, 100, 800);
      await page.waitForTimeout(150);
      await smoothScroll(page, 100, 0, 800);
      await page.waitForTimeout(300);

      const video = page.video();
      await page.close();
      await context.close();

      if (video) {
        const videoPath = await video.path();
        const targetPath = path.join(RECORDINGS_DIR, "round-6-1920x927-hero-open-path.webm");
        fs.renameSync(videoPath, targetPath);
        console.log("Saved:", targetPath);
      }
    }

    // 2. Record 390x844 mobile normal motion with Hero segment 2 oscillation & full sequence
    console.log("Recording 390x844 Round 6 motion...");
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        recordVideo: { dir: RECORDINGS_DIR, size: { width: 390, height: 844 } },
      });
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:4322");
      await page.waitForLoadState("domcontentloaded");
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);

      const geom = await page.evaluate(() => {
        const hero = document.getElementById("top") || document.querySelector(".hero");
        const heroH = hero ? hero.getBoundingClientRect().height : 844;
        const s0 = Math.round(heroH * 0.55);
        const header = document.querySelector("[data-site-header]");
        const headerH = header ? header.offsetHeight : 60;
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

      // Mobile Early segment 2 activation range (~80px)
      await smoothScroll(page, 0, 80, 900);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-6-390-hero-seg2-early.png") });

      // Oscillate to verify no backward shrinking suffix on mobile
      await smoothScroll(page, 80, 50, 500);
      await page.waitForTimeout(100);
      await smoothScroll(page, 50, 110, 600);
      await page.waitForTimeout(100);
      await smoothScroll(page, 110, 80, 500);
      await page.waitForTimeout(100);

      // Mid segment 2 activation (~200px)
      await smoothScroll(page, 80, 210, 900);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-6-390-hero-seg2-mid.png") });

      // Late segment 2 activation (~380px)
      await smoothScroll(page, 210, 380, 900);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-6-390-hero-seg2-late.png") });

      // Phase B: Mobile Seam handoff
      const midB = Math.round((geom.s0 + geom.sOccluded) / 2);
      await smoothScroll(page, 380, midB, 700);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-6-390-handoff-b.png") });

      // Phase C: Mobile Hidden travel pause
      const midC = Math.round((geom.sOccluded + geom.sGlyphStart) / 2);
      await smoothScroll(page, midB, midC, 600);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-6-390-hidden-c.png") });

      // Phase D: Mobile First glyph active
      const inD = geom.sGlyphStart + 80;
      await smoothScroll(page, midC, inD, 800);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(FRAMES_DIR, "round-6-390-glyph-d.png") });

      // Reverse back: D -> C -> B -> Hero seg 2 -> 0
      await smoothScroll(page, inD, midC, 700);
      await page.waitForTimeout(150);
      await smoothScroll(page, midC, midB, 500);
      await page.waitForTimeout(150);
      await smoothScroll(page, midB, 210, 800);
      await page.waitForTimeout(150);
      await smoothScroll(page, 210, 80, 700);
      await page.waitForTimeout(150);
      await smoothScroll(page, 80, 0, 700);
      await page.waitForTimeout(300);

      const video = page.video();
      await page.close();
      await context.close();

      if (video) {
        const videoPath = await video.path();
        const targetPath = path.join(RECORDINGS_DIR, "round-6-1920x927-hero-open-path.webm").replace("1920x927", "390x844");
        fs.renameSync(videoPath, targetPath);
        console.log("Saved:", targetPath);
      }
    }

    await browser.close();
    console.log("All Round 6 recordings captured successfully.");
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
