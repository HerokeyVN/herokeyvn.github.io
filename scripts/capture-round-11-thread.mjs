// Round 11 workstream A capture: BEFORE/AFTER screenshots of the narrative
// thread at every scroll state where its geometry is visible, desktop
// 1440x900 and mobile 390x844. Viewport screenshots (not fullPage - that
// smears fixed elements). Usage:
//   node scripts/capture-round-11-thread.mjs before
//   node scripts/capture-round-11-thread.mjs after
import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const OUT_DIR = "/home/hatch/workspace/portfolio-check";
const BASE_URL = "http://127.0.0.1:4322";
const SUFFIX = process.argv[2] === "after" ? "after" : "before";

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

// Scroll states, computed live from layout so they track the real geometry.
const STATES_FN = () => {
  const topOf = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.getBoundingClientRect().top + scrollY : 0;
  };
  const botOf = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.getBoundingClientRect().bottom + scrollY : 0;
  };
  const heroHeight = document.querySelector("#top")?.offsetHeight ?? innerHeight;
  const aboutTop = topOf("#about");
  const expTop = topOf("#experience");
  const projTop = topOf("#projects");
  const skillsTop = topOf("#skills");
  const contactTop = topOf("#contact");
  const stmt = document.querySelector(".about__statement");
  const prof = document.querySelector(".about__profile");
  const gapTop = stmt ? botOf(".about__statement") : aboutTop + 400;
  const gapBot = prof ? topOf(".about__profile") : aboutTop + 650;
  const crossY = (gapTop + gapBot) / 2;
  const p1Bot = botOf("#fb-messenger-e2ee");
  const p2Top = topOf("#sky-sheet-store");
  const p2Bot = botOf("#sky-sheet-store");
  const p3Top = topOf("#sky-auto-piano");
  const firstGlyph = document.querySelector("[data-site-thread-segment='6']");
  const docHeight = document.documentElement.scrollHeight;
  const maxScroll = docHeight - innerHeight;
  const clamp = (y) => Math.max(0, Math.min(maxScroll, Math.round(y)));
  return [
    { name: "hero-top", y: 0 },
    { name: "hero-mid", y: clamp(heroHeight * 0.3) },
    { name: "handoff", y: clamp(heroHeight * 0.55 + 25) },
    { name: "connector", y: clamp(heroHeight * 0.55 + 110) },
    { name: "glyphs", y: clamp(aboutTop + 700) },
    { name: "about-gap", y: clamp(crossY - innerHeight / 2) },
    { name: "experience", y: clamp(expTop - 100) },
    { name: "proj-e2ee", y: clamp(topOf("#fb-messenger-e2ee") + 150) },
    { name: "proj-cross1", y: clamp((p1Bot + p2Top) / 2 - innerHeight / 2) },
    { name: "proj-sheet", y: clamp(topOf("#sky-sheet-store") + 150) },
    { name: "proj-cross2", y: clamp((p2Bot + p3Top) / 2 - innerHeight / 2) },
    { name: "proj-piano", y: clamp(topOf("#sky-auto-piano") + 150) },
    { name: "skills", y: clamp(skillsTop - 100) },
    { name: "contact", y: clamp(maxScroll) },
  ];
};

async function captureViewport(browser, viewport, label) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(BASE_URL);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-site-thread-segment]")].reduce((t, p) => t + p.getTotalLength(), 0) > 1000,
  );
  await page.addStyleTag({ content: "html{scroll-behavior:auto !important}" });
  const states = await page.evaluate(STATES_FN);
  for (const state of states) {
    await page.evaluate((y) => scrollTo(0, y), state.y);
    await page.waitForTimeout(1300); // scrub playhead settles
    const actualY = await page.evaluate(() => Math.round(scrollY));
    const file = path.join(OUT_DIR, `thread11-${state.name}-${label}-${SUFFIX}.png`);
    await page.screenshot({ path: file });
    console.log(`${state.name} ${label} requested=${state.y} actual=${actualY} -> ${path.basename(file)}`);
  }
  await context.close();
}

async function run() {
  let serverProcess = null;
  if (!(await waitForServer(BASE_URL, 6))) {
    console.log("Starting preview server on port 4322...");
    serverProcess = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4322"], { stdio: "ignore", detached: true, cwd: "/home/hatch/workspace/herokeyvn.github.io" });
    if (!(await waitForServer(BASE_URL))) throw new Error("Preview server failed to respond.");
  }
  console.log("Preview server ready.");
  try {
    const browser = await chromium.launch();
    await captureViewport(browser, { width: 1440, height: 900 }, "desktop");
    await captureViewport(browser, { width: 390, height: 844 }, "mobile");
    await browser.close();
    console.log(`All Round 11 ${SUFFIX} captures done.`);
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
