import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { GLYPH_TRANSITIONS } from "../src/data/about-glyphs";

test("communicates the professional position and exposes working destinations", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: /HerokeyVN/i })).toBeVisible();
  await expect(page.getByText(/builds Node\.js and TypeScript services/i)).toBeVisible();
  await page.locator("#experience").scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: /Working where identity/i })).toBeVisible();
  await page.locator("#projects").scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: /Systems made/i })).toBeVisible();
  await expect(page.locator("article[data-project]")).toHaveCount(3);

  await expect(page.getByRole("link", { name: /View repository/i })).toHaveCount(2);
  await expect(page.getByRole("link", { name: /Visit live website/i })).toHaveAttribute("href", "https://skysheet.store/");
  await expect(page.getByRole("link", { name: /herokey2018@gmail.com/i }).first()).toHaveAttribute("href", "mailto:herokey2018@gmail.com");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://herokeyvn.github.io/");

  expect(errors).toEqual([]);
});

test("supports keyboard navigation and the responsive menu", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();

  if (testInfo.project.name === "mobile") {
    const menu = page.getByRole("banner").getByRole("button", { name: /Index Menu|Menu/i });
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  }
});

test("keeps content available when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Systems made/i })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /HerokeyVN/i })).toBeVisible();
});

test("has no automatically detectable accessibility violations", async ({ page }) => {
  test.slow();
  await page.goto("/");
  await page.getByRole("heading", { level: 1, name: /HerokeyVN/i }).waitFor();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("renders all essential portfolio content without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseURL || "http://127.0.0.1:4322/");

  await expect(page.getByRole("heading", { level: 1, name: /HerokeyVN/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Working where identity/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Systems made/i })).toBeVisible();
  await expect(page.locator("article[data-project]")).toHaveCount(3);
  await expect(page.getByRole("link", { name: /herokey2018@gmail.com/i }).first()).toBeVisible();

  await context.close();
});

test("does not load or require WebGL", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("script[src*='three']")).toHaveCount(0);
  await expect(page.locator("[data-spatial-mount]")).toHaveCount(1);
});

test("preserves the approved hero thread layering", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() =>
    document.querySelector<SVGPathElement>("[data-thread-segment='1']")?.getTotalLength(),
  );

  const result = await page.evaluate(() => {
    return {
      backLength: document.querySelector<SVGPathElement>("[data-thread-segment='0']")!.getTotalLength(),
      frontLength: document.querySelector<SVGPathElement>("[data-thread-segment='1']")!.getTotalLength(),
      backDepth: getComputedStyle(document.querySelector("[data-hero-thread='back']")!).zIndex,
      titleDepth: getComputedStyle(document.querySelector(".hero__identity")!).zIndex,
      frontDepth: getComputedStyle(document.querySelector("[data-hero-thread='front']")!).zIndex,
    };
  });

  expect(result.backLength).toBeGreaterThan(400);
  expect(result.frontLength).toBeGreaterThan(30);
  expect(Number(result.backDepth)).toBeLessThan(Number(result.titleDepth));
  expect(Number(result.frontDepth)).toBeGreaterThan(Number(result.titleDepth));
});

test("keeps the site thread outside protected content", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() =>
    [...document.querySelectorAll<SVGPathElement>("[data-site-thread-segment]")]
      .reduce((total, path) => total + path.getTotalLength(), 0) > 1000,
  );

  const collisions = await page.evaluate(() => {
    const paths = [...document.querySelectorAll<SVGPathElement>("[data-site-thread-segment]")];
    // Headings, project content and exhibit stages are protected. The
    // About heading itself is excluded: its outline span holds the glyphs
    // and the connector (segment 6) is designed to enter it from the right
    // gutter to meet the first glyph junction. The filled "BUILT FOR THE
    // PARTS" span and the kicker are still protected for every segment, so
    // the connector may only touch the outline area on its final approach.
    const protectedElements = [
      ...document.querySelectorAll<HTMLElement>(
        "p, a, button, nav, .initiative-card, .skill-row, .education, h1, h2, h3, .project-name, .project-description, .tech-tag, .project-exhibit, .project-exhibit__visual, .about__kicker",
      ),
      document.querySelector<HTMLElement>(".about__title > span:first-child"),
    ]
      .filter((element): element is HTMLElement => Boolean(element))
      .filter((element) => !element.closest("#top") && !element.closest(".site-header"))
      .filter((element) => !element.classList.contains("about__title"));
    const boxes = protectedElements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left - 6,
        right: box.right + 6,
        top: box.top + scrollY - 6,
        bottom: box.bottom + scrollY + 6,
      };
    });
    const hits: { segment: number; distance: number }[] = [];
    for (const path of paths) {
      const segment = Number(path.dataset.siteThreadSegment || 0);
      const length = path.getTotalLength();
      // Segment 6 is the connector whose endpoint is designed to meet the
      // first glyph junction. On mobile that junction sits 4 px below the
      // filled headline span, inside its 6 px margin, so samples within
      // 24 px of the endpoint are excluded: the connector may only touch
      // protected content at its designed junction, never along its run.
      // Round 12: segment 3 is the C0 connector, whose endpoint meets
      // the E2EE stage entry on the exhibit/visual edge by design, so
      // samples within 12 px of it are excluded the same way.
      const end = segment === 6 || segment === 3 ? path.getPointAtLength(length) : null;
      const endSkip = segment === 6 ? 24 : segment === 3 ? 12 : 0;
      for (let distance = 0; distance <= length; distance += 4) {
        const point = path.getPointAtLength(distance);
        if (end && Math.hypot(point.x - end.x, point.y - end.y) < endSkip) continue;
        if (boxes.some((box) => point.x > box.left && point.x < box.right && point.y > box.top && point.y < box.bottom)) {
          hits.push({ segment, distance });
        }
      }
    }
    // Round 12: the project connectors (C1-C3) are site-space paths too
    // and run in the gutters and the inter-article gaps, so they are
    // sampled here as well. Two differences from the site segments: the
    // coarse .project-exhibit box is not protection for them (the
    // connectors legitimately travel inside it, down the inter-column
    // gaps and up to the stage edges), so only the real content elements
    // are protected; and samples within 12 px of either endpoint are
    // skipped (the endpoints meet the stage edges by design, so the runs
    // themselves are what this checks).
    const connBoxes = [...document.querySelectorAll<HTMLElement>(
      "p, a, button, nav, .initiative-card, .skill-row, .education, h1, h2, h3, .project-name, .project-description, .tech-tag, .project-exhibit__visual, .about__kicker",
    )]
      .filter((element): element is HTMLElement => Boolean(element))
      .filter((element) => !element.closest("#top") && !element.closest(".site-header"))
      .filter((element) => !element.classList.contains("about__title"))
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          left: box.left - 6,
          right: box.right + 6,
          top: box.top + scrollY - 6,
          bottom: box.bottom + scrollY + 6,
        };
      });
    const connectors = [...document.querySelectorAll<SVGPathElement>("[data-project-connector]")];
    connectors.forEach((path, i) => {
      const length = path.getTotalLength();
      const start = path.getPointAtLength(0);
      const end = path.getPointAtLength(length);
      for (let distance = 0; distance <= length; distance += 4) {
        const point = path.getPointAtLength(distance);
        if (Math.hypot(point.x - start.x, point.y - start.y) < 12) continue;
        if (Math.hypot(point.x - end.x, point.y - end.y) < 12) continue;
        if (connBoxes.some((box) => point.x > box.left && point.x < box.right && point.y > box.top && point.y < box.bottom)) {
          hits.push({ segment: 100 + i, distance });
        }
      }
    });
    return hits;
  });

  expect(collisions).toEqual([]);
});

test("keeps each project motif inside its stage and off project content", async ({ page }) => {
  // Round 10: the thread is split across two SVG overlays (thread-back
  // behind foreground structures, thread-front in front of background
  // ones), so every .project-thread-path in BOTH overlays of the active
  // variant is sampled, not just the first path.
  await page.goto("/");
  await page.waitForFunction(() =>
    [...document.querySelectorAll<SVGPathElement>(".project-thread-path")]
      .reduce((total, path) => total + path.getTotalLength(), 0) > 1000,
  );

  const result = await page.evaluate(() => {
    const isMobile = window.innerWidth <= 700;
    const variant = isMobile ? "mobile" : "desktop";
    const stages = [...document.querySelectorAll<HTMLElement>("[data-project-thread-stage]")];
    const outsideStage: { slug: string; x: number; y: number }[] = [];
    const contentHits: { slug: string; selector: string }[] = [];
    for (const stage of stages) {
      const svgs = [...stage.querySelectorAll<SVGSVGElement>(`svg[data-variant="${variant}"]`)];
      const paths = svgs.flatMap((svg) => [...svg.querySelectorAll<SVGPathElement>(".project-thread-path")]);
      const article = stage.closest<HTMLElement>("article[data-project]");
      if (paths.length === 0 || !article) continue;
      const slug = article.id;
      const stageBox = stage.getBoundingClientRect();
      const contentBoxes = [...article.querySelectorAll<HTMLElement>(".project-name, .project-description, .tech-tag, a, button, .project-exhibit__content")].map(
        (element) => {
          const box = element.getBoundingClientRect();
          return {
            selector: element.className || element.tagName,
            left: box.left - 6,
            right: box.right + 6,
            top: box.top + scrollY - 6,
            bottom: box.bottom + scrollY + 6,
          };
        },
      );
      for (const path of paths) {
        const length = path.getTotalLength();
        for (let distance = 0; distance <= length; distance += 4) {
          const point = path.getPointAtLength(distance);
          const matrix = path.getScreenCTM();
          const screen = matrix ? new DOMPoint(point.x, point.y).matrixTransform(matrix) : point;
          const x = screen.x;
          const y = screen.y + scrollY;
          if (x < stageBox.left - 2 || x > stageBox.right + 2 || y < stageBox.top + scrollY - 2 || y > stageBox.bottom + scrollY + 2) {
            outsideStage.push({ slug, x: Math.round(x), y: Math.round(y) });
          }
          const hit = contentBoxes.find((box) => x > box.left && x < box.right && y > box.top && y < box.bottom);
          if (hit) contentHits.push({ slug, selector: String(hit.selector) });
        }
      }
    }
    return { outsideStage: outsideStage.slice(0, 10), contentHits: contentHits.slice(0, 10) };
  });

  expect(result.outsideStage).toEqual([]);
  expect(result.contentHits).toEqual([]);
});

test("keeps each project motif's DOM scenes inside its stage", async ({ page }) => {
  // Round 9 added real DOM scenes (cards, detail rail, practice grid,
  // keyboard, footer) inside the stages. A mis-positioned scene would be
  // clipped by the stage's overflow, so every descendant must sit inside
  // the stage box. Display-none variant markup is skipped (zero rect).
  await page.goto("/");
  await page.waitForFunction(() =>
    [...document.querySelectorAll<SVGPathElement>(".project-thread-path")]
      .reduce((total, path) => total + path.getTotalLength(), 0) > 1000,
  );

  const result = await page.evaluate(() => {
    const outside: { slug: string; el: string; box: string }[] = [];
    for (const stage of [...document.querySelectorAll<HTMLElement>("[data-project-thread-stage]")]) {
      const slug = stage.closest<HTMLElement>("article[data-project]")?.id || "";
      const stageBox = stage.getBoundingClientRect();
      const top = stageBox.top + scrollY;
      for (const el of [stage, ...stage.querySelectorAll<HTMLElement>("*")]) {
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        if (
          box.left < stageBox.left - 2 ||
          box.right > stageBox.right + 2 ||
          box.top + scrollY < top - 2 ||
          box.bottom + scrollY > stageBox.bottom + scrollY + 2
        ) {
          outside.push({
            slug,
            el: el.tagName.toLowerCase() + (el.dataset.el ? `[data-el="${el.dataset.el}"]` : `.${String(el.className).split(" ")[0]}`),
            box: JSON.stringify({ l: Math.round(box.left), r: Math.round(box.right), t: Math.round(box.top), b: Math.round(box.bottom) }),
          });
        }
      }
    }
    return outside.slice(0, 10);
  });

  expect(result).toEqual([]);
});

test("project visuals render their complete static composition without scrolling", async ({ page }) => {
  // Round 10: the scenes are static (no ScrollTrigger is wired yet - Phase
  // 4 comes after Key approves the statics), so the final state must hold
  // with NO scrolling at all. Every thread path is fully drawn, the lit
  // states are authored in the markup, and every layer is visible.
  // Reduced motion is emulated because the page-level stage entrance
  // (motion.ts, autoAlpha 0 until the project scrolls into view) would
  // otherwise hide the stages below the fold; reduced motion is exactly
  // the static state this test asserts, and the motif itself has no
  // scroll-driven transformation to hide behind.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);

  const state = await page.evaluate(() => {
    const isMobile = window.innerWidth <= 700;
    const variant = isMobile ? "mobile" : "desktop";
    const out: Record<string, { paths: number; notDrawn: number; layers: { layer: string; visible: boolean }[] }> = {};
    for (const stage of [...document.querySelectorAll<HTMLElement>("[data-project-thread-stage]")]) {
      const slug = stage.dataset.projectSlug!;
      const svgs = [...stage.querySelectorAll<SVGSVGElement>(`svg[data-variant="${variant}"]`)];
      const paths = svgs.flatMap((svg) => [...svg.querySelectorAll<SVGPathElement>(".project-thread-path")]);
      const notDrawn = paths.filter((p) => {
        const cs = getComputedStyle(p);
        return cs.strokeDasharray !== "none" || cs.visibility !== "visible";
      }).length;
      // Only the active variant's layers: the inactive variant's SVGs are
      // display:none (zero rect) by design, not missing layers.
      const layers = [...stage.querySelectorAll<HTMLElement>("[data-layer]")]
        .filter((el) => getComputedStyle(el).display !== "none")
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { layer: el.dataset.layer ?? "", visible: r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" };
        });
      out[slug] = { paths: paths.length, notDrawn, layers };
    }
    const sheet = document.querySelector('[data-project-slug="sky-sheet-store"]')!;
    const piano = document.querySelector('[data-project-slug="sky-auto-piano"]')!;
    const e2ee = document.querySelector('[data-project-slug="fb-messenger-e2ee"]')!;
    // Round 12: the seal coil is gone (deleted with the round-11 knot).
    // The through-path that replaced it runs straight through the sealed
    // core under the HELLO message (desktop front path 3, the shallow G1
    // dip, ~180 viewBox units; mobile front path 2, the jog around the
    // sealed message, ~255). Its length is in viewBox units, > 100 on
    // both variants.
    const through = e2ee.querySelectorAll<SVGPathElement>(
      `svg[data-variant="${variant}"][data-layer="thread-front"] .project-thread-path`,
    )[isMobile ? 1 : 2]!;
    return {
      stages: out,
      key14Lit: sheet.querySelector('[data-key="14"]')!.classList.contains("is-lit"),
      hLit: piano.querySelector('[data-pkey="H"]')!.classList.contains("is-lit"),
      hPressed: piano.querySelector('[data-pkey="H"]')!.classList.contains("is-pressed"),
      lLit: piano.querySelector('[data-pkey="L"]')!.classList.contains("is-lit"),
      lHeld: piano.querySelector('[data-pkey="L"]')!.classList.contains("is-held"),
      throughLength: through ? through.getTotalLength() : 0,
    };
  });

  for (const slug of ["fb-messenger-e2ee", "sky-sheet-store", "sky-auto-piano"]) {
    const s = state.stages[slug]!;
    expect(s.paths).toBeGreaterThan(0);
    expect(s.notDrawn).toBe(0);
    for (const layer of s.layers) expect(layer.visible).toBe(true);
  }
  expect(state.key14Lit).toBe(true);
  expect(state.hLit).toBe(true);
  expect(state.hPressed).toBe(true);
  expect(state.lLit).toBe(true);
  expect(state.lHeld).toBe(true);
  expect(state.throughLength as number).toBeGreaterThan(100);
});

test("project visuals choreograph through scrub and reach their final state at full scrub", async ({ page }) => {
  // Phase 4: one scrubbed timeline per scene (trigger article, top 80% ->
  // bottom 45%, scrub 1). At mid scrub the thread is partly drawn and the
  // structural beats the belt has not reached yet are still in their start
  // state (Piano H unpressed, Sheet key 14 unlit, E2EE through-path
  // undrawn). Scrolled 5% past the trigger end (round-9 lesson: the
  // motion.ts stage entrance settles ~22px after the triggers first
  // measure), p = 1: the approved static, every path fully drawn, keys
  // lit/pressed/held, gauge at 88%. The mid-scrub assertions tolerate the
  // ~0.02 progress shift that entrance causes; the windows they check are
  // far from their edges. Round 12: the thread through the stages is the
  // one site thread now (site-thread.ts drives the stage dashes), so the
  // fractions below read the same dash state the unified thread produces;
  // the DOM choreography and its p-windows are unchanged.
  test.slow();
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);

  // Scroll so the scene's ScrollTrigger sits at progress p (p >= 1 scrolls
  // 5% past the trigger end), then wait for the scrub playhead to catch
  // up: apply() publishes the live progress on data-thread-progress.
  const scrollToProgress = async (slug: string, p: number) => {
    await page.evaluate(
      ({ slug, p }) => {
        const stage = document.querySelector(`[data-project-slug="${slug}"]`)!;
        const article = stage.closest("article[data-project]")!;
        const rect = article.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        const range = rect.height + 0.35 * window.innerHeight;
        const start = top - 0.8 * window.innerHeight;
        const overshoot = p >= 1 ? 0.05 : 0;
        window.scrollTo({ top: start + (p + overshoot) * range, behavior: "instant" });
      },
      { slug, p },
    );
    const target = p >= 1 ? 0.999 : p - 0.03;
    await page.waitForFunction(
      ({ slug, target }) =>
        Number(
          document.querySelector(`[data-project-slug="${slug}"]`)!.getAttribute("data-thread-progress") ?? 0,
        ) >= target,
      { slug, target },
      { timeout: 10000 },
    );
    await page.waitForTimeout(1200);
  };

  const readScene = async (slug: string) =>
    page.evaluate((slug) => {
      const stage = document.querySelector(`[data-project-slug="${slug}"]`)!;
      const isMobile = window.innerWidth <= 700;
      const variant = isMobile ? "mobile" : "desktop";
      const fracOf = (path: SVGPathElement) => {
        const cs = getComputedStyle(path);
        if (cs.strokeDasharray === "none") return 1;
        if (cs.visibility === "hidden") return 0;
        const nums = cs.strokeDasharray.split(/[\s,]+/).map(Number.parseFloat).filter((n) => !Number.isNaN(n));
        if (!nums.length) return 0;
        const ctm = path.getScreenCTM();
        const scale = ctm ? Math.hypot(ctm.a, ctm.b) : 1;
        return Math.min(1, (nums[0] ?? 0) / (path.getTotalLength() * scale));
      };
      const front = [...stage.querySelectorAll<SVGPathElement>(
        `svg[data-variant="${variant}"][data-layer="thread-front"] .project-thread-path`,
      )];
      const back = [...stage.querySelectorAll<SVGPathElement>(
        `svg[data-variant="${variant}"][data-layer="thread-back"] .project-thread-path`,
      )];
      const all = [...front, ...back];
      const drawn = all.reduce((sum, path) => sum + fracOf(path), 0) / Math.max(1, all.length);
      const dot = stage.querySelector(`svg[data-variant="${variant}"] .project-thread-dot--end`);
      const tyOf = (transform: string) => {
        const m = transform.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
        return m ? Number(m[1]) : Number.NaN;
      };
      const out: Record<string, unknown> = {
        progress: Number(stage.getAttribute("data-thread-progress") ?? 0),
        isMobile,
        drawn,
        front: front.map(fracOf),
        back: back.map(fracOf),
        dotOpacity: dot ? Number(getComputedStyle(dot).opacity) : 0,
      };
      if (slug === "fb-messenger-e2ee") {
        out.frames = [...stage.querySelectorAll(".e2ee-frame")]
          .filter((el) => (el as HTMLElement).getBoundingClientRect().width > 0)
          .map((el) => Number(getComputedStyle(el).opacity));
        const msg = stage.querySelector(".e2ee-core-message")!;
        out.coreMessage = Number(getComputedStyle(msg).opacity);
        const labels = [...stage.querySelectorAll<HTMLElement>("[data-el$='-label'], [data-el$='-fig']")];
        out.labels = Object.fromEntries(
          labels.map((el) => [el.dataset.el ?? "", Number(getComputedStyle(el).opacity)]),
        );
      }
      if (slug === "sky-sheet-store") {
        const key14 = stage.querySelector('[data-key="14"]')!;
        out.key14Lit = key14.classList.contains("is-lit");
        out.key14Bg = getComputedStyle(key14).backgroundColor;
        const practice = stage.querySelector('[data-el="sheet-practice"]')!;
        out.practice = Number(getComputedStyle(practice).opacity);
      }
      if (slug === "sky-auto-piano") {
        const h = stage.querySelector('[data-pkey="H"]')!;
        const l = stage.querySelector('[data-pkey="L"]')!;
        out.hPressed = h.classList.contains("is-pressed");
        out.hTy = tyOf(getComputedStyle(h).transform);
        out.hBg = getComputedStyle(h).backgroundImage;
        out.lHeld = l.classList.contains("is-held");
        out.lBg = getComputedStyle(l).backgroundImage;
        const after = getComputedStyle(l, "::after");
        out.sustainWidth = Number.parseFloat(after.width);
        out.sustainTransform = after.transform;
        const gauge = stage.querySelector(".piano-gauge")!;
        const fill = stage.querySelector(".piano-gauge__fill")!;
        out.gauge = fill.getBoundingClientRect().width / gauge.getBoundingClientRect().width;
      }
      return out;
    }, slug);

  // E2EE mid (p 0.35): entry + frame crossings drawn, through-path not
  // started (it draws in the old seal-coil window, [0.44, 0.8] desktop /
  // [0.42, 0.68] mobile, while the core assembles), frames and core
  // message still settling in.
  await scrollToProgress("fb-messenger-e2ee", 0.35);
  const e2eeMid = await readScene("fb-messenger-e2ee");
  expect(e2eeMid.progress as number).toBeGreaterThanOrEqual(0.3);
  expect(e2eeMid.progress as number).toBeLessThan(0.5);
  expect(e2eeMid.drawn as number).toBeGreaterThan(0);
  expect(e2eeMid.drawn as number).toBeLessThan(1);
  const e2eeThrough = (e2eeMid.front as number[])[(e2eeMid.isMobile as boolean) ? 1 : 2]!;
  expect(e2eeThrough).toBe(0);
  for (const opacity of e2eeMid.frames as number[]) expect(opacity).toBeLessThan(1);
  expect(e2eeMid.coreMessage as number).toBeLessThan(1);

  // E2EE full: every path drawn, end dot in, labels and message at full opacity.
  await scrollToProgress("fb-messenger-e2ee", 1);
  const e2eeFull = await readScene("fb-messenger-e2ee");
  expect(e2eeFull.progress as number).toBe(1);
  expect(e2eeFull.drawn as number).toBe(1);
  expect(e2eeFull.dotOpacity as number).toBe(1);
  for (const opacity of e2eeFull.frames as number[]) expect(opacity).toBe(1);
  expect(e2eeFull.coreMessage as number).toBe(1);
  for (const opacity of Object.values(e2eeFull.labels as Record<string, number>)) {
    expect(opacity).toBe(1);
  }

  // Sheet Store mid (p 0.45): melody partly drawn, practice strip still
  // hidden, key 14 still unlit.
  await scrollToProgress("sky-sheet-store", 0.45);
  const sheetMid = await readScene("sky-sheet-store");
  expect(sheetMid.progress as number).toBeGreaterThanOrEqual(0.4);
  expect(sheetMid.progress as number).toBeLessThan(0.55);
  expect(sheetMid.drawn as number).toBeGreaterThan(0);
  expect(sheetMid.drawn as number).toBeLessThan(1);
  expect((sheetMid.front as number[])[1]!).toBeGreaterThan(0);
  expect((sheetMid.front as number[])[1]!).toBeLessThan(1);
  expect(sheetMid.practice as number).toBe(0);
  expect(sheetMid.key14Bg as string).toBe("rgb(20, 20, 22)");

  // Sheet Store full: every path drawn, end dot in, key 14 lit red.
  await scrollToProgress("sky-sheet-store", 1);
  const sheetFull = await readScene("sky-sheet-store");
  expect(sheetFull.progress as number).toBe(1);
  expect(sheetFull.drawn as number).toBe(1);
  expect(sheetFull.dotOpacity as number).toBe(1);
  expect(sheetFull.key14Lit as boolean).toBe(true);
  expect(sheetFull.key14Bg as string).toBe("rgb(255, 60, 26)");
  expect(sheetFull.practice as number).toBe(1);

  // Piano mid (p 0.15): belt partly drawn, H not yet pressed, gauge just starting.
  await scrollToProgress("sky-auto-piano", 0.15);
  const pianoMid = await readScene("sky-auto-piano");
  expect(pianoMid.progress as number).toBeGreaterThanOrEqual(0.1);
  expect(pianoMid.progress as number).toBeLessThan(0.25);
  expect(pianoMid.drawn as number).toBeGreaterThan(0);
  expect(pianoMid.drawn as number).toBeLessThan(1);
  expect(pianoMid.hTy as number).toBe(0);
  expect(pianoMid.hBg as string).toContain("rgb(28, 28, 32)");
  expect(pianoMid.gauge as number).toBeLessThan(0.1);

  // Piano half (p 0.5): H pressed and sunk, L not yet held.
  await scrollToProgress("sky-auto-piano", 0.5);
  const pianoHalf = await readScene("sky-auto-piano");
  expect(pianoHalf.progress as number).toBeGreaterThanOrEqual(0.45);
  expect(pianoHalf.progress as number).toBeLessThan(0.6);
  expect(pianoHalf.hPressed as boolean).toBe(true);
  expect(pianoHalf.hTy as number).toBe(6);
  expect(pianoHalf.hBg as string).toContain("rgb(179, 37, 15)");
  expect(pianoHalf.lBg as string).toContain("rgb(28, 28, 32)");

  // Piano full: every path drawn, end dot in, H pressed, L held with its
  // sustain bar grown, gauge at 88%.
  await scrollToProgress("sky-auto-piano", 1);
  const pianoFull = await readScene("sky-auto-piano");
  expect(pianoFull.progress as number).toBe(1);
  expect(pianoFull.drawn as number).toBe(1);
  expect(pianoFull.dotOpacity as number).toBe(1);
  expect(pianoFull.hPressed as boolean).toBe(true);
  expect(pianoFull.hTy as number).toBe(6);
  expect(pianoFull.hBg as string).toContain("rgb(179, 37, 15)");
  expect(pianoFull.lHeld as boolean).toBe(true);
  expect(pianoFull.lBg as string).toContain("rgb(255, 90, 56)");
  expect(pianoFull.sustainWidth as number).toBeGreaterThan(0);
  expect(pianoFull.gauge as number).toBeCloseTo(0.88, 2);
});

test("project motif threads enter and exit at the stage edges, land on their targets, and keep clear of in-stage text", async ({ page }) => {
  // Round 10 (static, no scrolling): the thread enters at one stage edge
  // and exits at the opposite edge, the Sheet Store melody starts on the
  // first staff note and the descent lands on key 14, the Piano belt dips
  // onto H and L, and the front thread keeps clear of in-stage text.
  // Thresholds are from measured geometry (scripts/probe-round-10-geometry.mjs,
  // desktop + mobile); tightest measured values are E2EE mobile NOISE 10.3px,
  // Sheet Store desktop first stat row 8.2px, Piano mobile front-tier exit
  // 10.9px below the tier (39px desktop) and mobile FIG label 9.2px.
  // Deliberate exceptions (NOT asserted): the E2EE thread crosses the
  // background HELLO letters (the word is the protected message); the Sheet
  // Store back thread runs behind the opaque detail panel to the first
  // note; the descent crosses the panel's second stat row and the right
  // practice-grid column on its way down to key 14; the Piano belt crosses
  // the whole mid tier (it is a belt, H and L are its dip points).
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);

  const result = await page.evaluate(() => {
    const isMobile = window.innerWidth <= 700;
    const variant = isMobile ? "mobile" : "desktop";
    const out: Record<string, unknown> = {};
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    const center = (r: { left: number; right: number; top: number; bottom: number }) => ({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 });
    const minDistToBoxes = (pts: { x: number; y: number }[], boxes: { left: number; right: number; top: number; bottom: number }[]) => {
      let min = Number.POSITIVE_INFINITY;
      for (const p of pts) for (const b of boxes) {
        const dx = Math.max(b.left - p.x, 0, p.x - b.right);
        const dy = Math.max(b.top - p.y, 0, p.y - b.bottom);
        min = Math.min(min, Math.hypot(dx, dy));
      }
      return min;
    };
    const boxes = (stage: Element, sel: string) => [...stage.querySelectorAll(sel)]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }));
    const frontPathsOf = (stage: Element) => [...stage.querySelectorAll<SVGPathElement>(`svg[data-variant="${variant}"][data-layer="thread-front"] .project-thread-path`)];
    const frontSamples = (stage: Element) => {
      const pts: { x: number; y: number }[] = [];
      for (const path of frontPathsOf(stage)) {
        const ctm = path.getScreenCTM()!;
        const len = path.getTotalLength();
        for (let d = 0; d <= len; d += 2) {
          const pt = path.getPointAtLength(d);
          const sp = new DOMPoint(pt.x, pt.y).matrixTransform(ctm);
          pts.push({ x: sp.x, y: sp.y });
        }
      }
      return pts;
    };

    for (const stage of [...document.querySelectorAll<HTMLElement>("[data-project-thread-stage]")]) {
      const slug = stage.dataset.projectSlug!;
      const stageBox = stage.getBoundingClientRect();
      const frontPaths = frontPathsOf(stage);
      const first = frontPaths[0]!;
      const last = frontPaths[frontPaths.length - 1]!;
      const f0 = first.getPointAtLength(0);
      const l1 = last.getPointAtLength(last.getTotalLength());
      const f = new DOMPoint(f0.x, f0.y).matrixTransform(first.getScreenCTM()!);
      const l = new DOMPoint(l1.x, l1.y).matrixTransform(last.getScreenCTM()!);
      // Entry/exit: left/right edges on desktop, top/bottom edges on mobile.
      out[slug + ":entry"] = isMobile ? Math.round(f.y - stageBox.top) : Math.round(f.x - stageBox.left);
      out[slug + ":exit"] = isMobile ? Math.round(stageBox.bottom - l.y) : Math.round(stageBox.right - l.x);
      const pts = frontSamples(stage);
      if (slug === "fb-messenger-e2ee") {
        out["e2ee:labels"] = Math.round(minDistToBoxes(pts, boxes(stage, '[data-el="e2ee-fig"], [data-el="e2ee-signal-label"], [data-el="e2ee-noise-label"], [data-el="e2ee-relay-label"]')) * 10) / 10;
        // Frames are near-opaque panels, so the back thread is genuinely
        // occluded behind frames 2 and 4 (desktop) / frame 2 (mobile).
        const frame = stage.querySelector(".e2ee-frame")!;
        const bg = getComputedStyle(frame).backgroundColor;
        out["e2ee:frameAlpha"] = Number(bg.match(/rgba?\([^,]+,[^,]+,[^,]+,?\s*([\d.]+)?\)/)?.[1] ?? 1);
      }
      if (slug === "sky-sheet-store") {
        out["sheet:labels"] = Math.round(minDistToBoxes(pts, boxes(stage, ".sheet-card__title, [data-el='sheet-fig'], [data-el='sheet-trending-label'], [data-el='sheet-data-label'], [data-el='sheet-practice-note']")) * 10) / 10;
        // First stat row only (292 / 3:51 / 684); the descent deliberately
        // crosses the second row on its way down to key 14.
        const firstRow = boxes(stage, ".sheet-stat__value").slice(0, 3);
        out["sheet:stats1"] = Math.round(minDistToBoxes(pts, firstRow) * 10) / 10;
        // Melody starts on the first VISIBLE staff note head.
        const note0 = [...stage.querySelectorAll(".sheet-note-head")].find((el) => (el as SVGElement).getBoundingClientRect().width > 0)!;
        const nb = note0.getBoundingClientRect();
        const melody = frontPaths[1]!;
        const m0 = melody.getPointAtLength(0);
        const ms = new DOMPoint(m0.x, m0.y).matrixTransform(melody.getScreenCTM()!);
        out["sheet:melodyStart"] = Math.round(dist(ms, center(nb)) * 10) / 10;
        // Descent (second-to-last front path) ends on key 14.
        const descent = frontPaths[frontPaths.length - 2]!;
        const dEnd = descent.getPointAtLength(descent.getTotalLength());
        const de = new DOMPoint(dEnd.x, dEnd.y).matrixTransform(descent.getScreenCTM()!);
        const key14 = stage.querySelector('[data-key="14"]')!.getBoundingClientRect();
        out["sheet:key14"] = Math.round(dist(de, center(key14)) * 10) / 10;
      }
      if (slug === "sky-auto-piano") {
        out["piano:topTier"] = Math.round(minDistToBoxes(pts, boxes(stage, ".piano-tier--0 .piano-key")) * 10) / 10;
        out["piano:frontTier"] = Math.round(minDistToBoxes(pts, boxes(stage, ".piano-tier--2 .piano-key")) * 10) / 10;
        out["piano:labels"] = Math.round(minDistToBoxes(pts, boxes(stage, '[data-el="piano-fig"], [data-el="piano-mapping"], [data-el="piano-speed-label"], [data-el="piano-song-label"], [data-el="piano-lp-label"], .piano-plate .mono-caption')) * 10) / 10;
        // The belt dips onto H and L: the front paths touch both key boxes,
        // and the dip drops at least 20 viewBox units below the belt level.
        const hBox = stage.querySelector('[data-pkey="H"]')!.getBoundingClientRect();
        const lBox = stage.querySelector('[data-pkey="L"]')!.getBoundingClientRect();
        const touches = (b: { left: number; right: number; top: number; bottom: number }) => pts.some((p) => p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom);
        out["piano:dipH"] = touches(hBox);
        out["piano:dipL"] = touches(lBox);
        let maxLocalY = Number.NEGATIVE_INFINITY;
        let entryLocalY = 0;
        frontPaths.forEach((path, i) => {
          const len = path.getTotalLength();
          for (let d = 0; d <= len; d += 2) {
            const y = path.getPointAtLength(d).y;
            maxLocalY = Math.max(maxLocalY, y);
            if (i === 0 && d === 0) entryLocalY = y;
          }
        });
        out["piano:dipDepth"] = Math.round((maxLocalY - entryLocalY) * 10) / 10;
      }
    }
    return out;
  });

  // Thread enters at one stage edge and exits at the opposite edge.
  for (const slug of ["fb-messenger-e2ee", "sky-sheet-store", "sky-auto-piano"]) {
    expect(result[slug + ":entry"] as number).toBeLessThanOrEqual(4);
    expect(result[slug + ":exit"] as number).toBeLessThanOrEqual(4);
  }
  expect(result["e2ee:labels"] as number).toBeGreaterThanOrEqual(6);
  expect(result["e2ee:frameAlpha"] as number).toBeGreaterThanOrEqual(0.9);
  expect(result["sheet:labels"] as number).toBeGreaterThanOrEqual(6);
  expect(result["sheet:stats1"] as number).toBeGreaterThanOrEqual(6);
  expect(result["sheet:melodyStart"] as number).toBeLessThanOrEqual(2);
  expect(result["sheet:key14"] as number).toBeLessThanOrEqual(2);
  expect(result["piano:topTier"] as number).toBeGreaterThanOrEqual(10);
  // Front tier: the belt's exit emerges from behind the front tier, so the
  // closest front-thread approach is the exit line ~11px below the tier on
  // mobile (39px desktop) - clear of it, not crossing it.
  expect(result["piano:frontTier"] as number).toBeGreaterThanOrEqual(8);
  // Labels: tightest measured is the mobile FIG label, 9.2px from the
  // thread entry (the entry runs at x 30, the label starts at x 45) -
  // the 6px safety margin used elsewhere in this suite.
  expect(result["piano:labels"] as number).toBeGreaterThanOrEqual(6);
  expect(result["piano:dipH"]).toBe(true);
  expect(result["piano:dipL"]).toBe(true);
  expect(result["piano:dipDepth"] as number).toBeGreaterThanOrEqual(20);
});

test("builds a continuous thread system around every outlined glyph", async ({ page }) => {
  // Assert explicit transition plan defines sparse, art-directed visible transitions
  expect(GLYPH_TRANSITIONS.length).toBeGreaterThanOrEqual(3);
  const visiblePlan = GLYPH_TRANSITIONS.filter((t) => t.visibility === "visible");
  expect(visiblePlan.length).toBeGreaterThanOrEqual(3);
  for (const trans of visiblePlan) {
    expect(trans.from).toMatch(/^\d+-\d+$/);
    expect(trans.to).toMatch(/^\d+-\d+$/);
    expect(trans.fromAnchor).toBeDefined();
    expect(trans.toAnchor).toBeDefined();
  }

  await page.goto("/");
  await page.waitForFunction(() => {
    const contours = document.querySelectorAll("[data-glyph-contour]");
    const connectors = document.querySelectorAll("[data-glyph-connector]");
    return contours.length === 17 && connectors.length >= 2;
  });

  const continuity = await page.evaluate(() => {
    const screenPoint = (path: SVGPathElement, distance: number) => {
      const point = path.getPointAtLength(distance);
      const matrix = path.getScreenCTM();
      if (!matrix) return point;
      return new DOMPoint(point.x, point.y).matrixTransform(matrix);
    };

    const glyphElements = [...document.querySelectorAll<HTMLElement>(".about__glyph[data-glyph-key]")];
    const rawGlyphs = glyphElements.map((el) => {
      const key = el.dataset.glyphKey!;
      const box = el.getBoundingClientRect();
      return {
        key,
        top: box.top + scrollY,
        left: box.left + scrollX,
        box,
      };
    });

    const lines: typeof rawGlyphs[] = [];
    [...rawGlyphs].sort((a, b) => a.top - b.top || a.left - b.left).forEach((glyph) => {
      const line = lines.find((items) => Math.abs(items[0]!.top - glyph.top) < 4);
      line ? line.push(glyph) : lines.push([glyph]);
    });
    lines.forEach((line, lineIndex) => {
      line.sort((a, b) => a.left - b.left);
      if (lineIndex % 2 === 0) line.reverse();
    });
    const renderedOrder = lines.flat().map((g) => g.key);

    const outerContours = [...document.querySelectorAll<SVGPathElement>("[data-glyph-contour='0']")];
    const contourSampleMap = new Map<string, DOMPoint[]>();
    for (const path of outerContours) {
      const key = path.dataset.glyphKey!;
      const length = path.getTotalLength();
      const pts = Array.from({ length: 121 }, (_, index) => screenPoint(path, (length * index) / 120));
      contourSampleMap.set(key, pts);
    }

    const distanceToContour = (point: DOMPoint | SVGPoint, key: string) => {
      const samples = contourSampleMap.get(key);
      if (!samples) return 999;
      return Math.min(...samples.map((s) => Math.hypot(point.x - s.x, point.y - s.y)));
    };

    // Round 12: the connector budget (2-4) is per traced composition.
    // The Experience headline adds its own 3 connectors, so the About
    // connectors are counted separately from the exp ones.
    const connectors = [...document.querySelectorAll<SVGPathElement>("[data-glyph-connector]")].filter(
      (c) => !c.getAttribute("data-from-glyph")!.startsWith("exp-"),
    );
    const expConnectorCount = document.querySelectorAll<SVGPathElement>(
      "[data-glyph-connector][data-from-glyph^='exp-']",
    ).length;
    const sitePaths = [...document.querySelectorAll<SVGPathElement>("[data-site-thread-segment]")];

    const connectorDetails = connectors.map((connector) => {
      const fromKey = connector.getAttribute("data-from-glyph") || "";
      const toKey = connector.getAttribute("data-to-glyph") || "";
      const length = connector.getTotalLength();
      const pStart = screenPoint(connector, 0);
      const pEnd = screenPoint(connector, length);
      const directDist = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
      const lengthRatio = directDist > 0 ? length / directDist : 1;

      const fromIdx = renderedOrder.indexOf(fromKey);
      const toIdx = renderedOrder.indexOf(toKey);
      const isAdjacent = fromIdx !== -1 && toIdx === fromIdx + 1;

      const startDistToFromContour = distanceToContour(pStart, fromKey);
      const endDistToToContour = distanceToContour(pEnd, toKey);

      const fromPath = document.querySelector<SVGPathElement>(`path[data-glyph-key='${fromKey}'][data-glyph-contour='0']`)!;
      const toPath = document.querySelector<SVGPathElement>(`path[data-glyph-key='${toKey}'][data-glyph-contour='0']`)!;
      const fromBox = fromPath ? fromPath.getBoundingClientRect() : { left: 0, right: 0, top: 0, bottom: 0 };
      const toBox = toPath ? toPath.getBoundingClientRect() : { left: 0, right: 0, top: 0, bottom: 0 };

      const inset = 1;
      const isInside = (pt: DOMPoint | SVGPoint, b: { left: number; right: number; top: number; bottom: number }, ins = 0) => {
        return pt.x > b.left + ins && pt.x < b.right - ins && pt.y > b.top + ins && pt.y < b.bottom - ins;
      };

      const otherGlyphBoxes = rawGlyphs
        .filter((g) => g.key !== fromKey && g.key !== toKey)
        .map((g) => {
          const p = document.querySelector<SVGPathElement>(`path[data-glyph-key='${g.key}'][data-glyph-contour='0']`);
          return p ? p.getBoundingClientRect() : g.box;
        });

      let entersNonEndpointBox = false;
      let entersEndpointInsetBox = false;
      const sampleCount = 40;
      for (let i = 0; i <= sampleCount; i++) {
        const d = length * (0.15 + 0.7 * (i / sampleCount));
        const pt = screenPoint(connector, d);
        if (otherGlyphBoxes.some((b) => isInside(pt, b, 0))) {
          entersNonEndpointBox = true;
        }
        if (isInside(pt, fromBox, inset) || isInside(pt, toBox, inset)) {
          entersEndpointInsetBox = true;
        }
      }

      return {
        fromKey,
        toKey,
        isAdjacent,
        length,
        directDist,
        lengthRatio,
        startDistToFromContour,
        endDistToToContour,
        entersNonEndpointBox,
        entersEndpointInsetBox,
      };
    });

    const allSamples = outerContours.flatMap((path) => {
      const len = path.getTotalLength();
      return Array.from({ length: 121 }, (_, index) => screenPoint(path, (len * index) / 120));
    });
    const distanceToAnyOutline = (point: DOMPoint | SVGPoint) =>
      Math.min(...allSamples.map((sample) => Math.hypot(point.x - sample.x, point.y - sample.y)));

    const glyphExitJunctionError = distanceToAnyOutline(screenPoint(sitePaths[1]!, 0));

    return {
      glyphCount: document.querySelectorAll(".about__glyph").length,
      lineCount: lines.length,
      contourCount: document.querySelectorAll("[data-glyph-contour]").length,
      connectorCount: connectors.length,
      expConnectorCount,
      zeroLengthPaths: [...outerContours, ...connectors, ...sitePaths].filter((path) => path.getTotalLength() <= 0).length,
      connectorDetails,
      glyphExitJunctionError,
    };
  });

  expect(continuity.glyphCount).toBe(14);
  expect(continuity.contourCount).toBe(17);
  expect(continuity.zeroLengthPaths).toBe(0);
  expect(continuity.connectorCount).toBeGreaterThanOrEqual(2);
  expect(continuity.connectorCount).toBeLessThanOrEqual(4);
  expect(continuity.expConnectorCount).toBeGreaterThanOrEqual(2);
  expect(continuity.expConnectorCount).toBeLessThanOrEqual(4);
  expect(continuity.glyphExitJunctionError).toBeLessThan(0.75);

  for (const detail of continuity.connectorDetails) {
    expect(detail.fromKey).toBeTruthy();
    expect(detail.toKey).toBeTruthy();
    expect(detail.isAdjacent).toBe(true);
    expect(detail.startDistToFromContour).toBeLessThan(0.75);
    expect(detail.endDistToToContour).toBeLessThan(0.75);
    expect(detail.lengthRatio).toBeLessThanOrEqual(1.4);
    expect(detail.entersNonEndpointBox).toBe(false);
    expect(detail.entersEndpointInsetBox).toBe(false);
  }
});

test("protects the sticky header corridor from scrolled thread geometry", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.waitForFunction(() => document.querySelectorAll("[data-glyph-contour]").length === 17);

  const targetScrollY = testInfo.project.name === "mobile" ? 1250 : 1450;
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), targetScrollY);
  await page.waitForFunction((expectedY) => Math.abs(window.scrollY - expectedY) < 2, targetScrollY);
  await page.waitForFunction(() => {
    const header = document.querySelector<HTMLElement>("[data-site-header]");
    return header && header.hasAttribute("data-compact") && getComputedStyle(header).backgroundColor === "rgb(3, 3, 5)";
  });

  const headerCheck = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>("[data-site-header]")!;
    const glyphThread = document.querySelector<SVGElement>("[data-glyph-thread]")!;
    const siteThread = document.querySelector<SVGElement>("[data-site-thread]")!;
    const brand = document.querySelector<HTMLElement>(".brand-mark")!;
    const headerStyle = getComputedStyle(header);
    const glyphZ = Number.parseInt(getComputedStyle(glyphThread).zIndex || "0", 10);
    const siteZ = Number.parseInt(getComputedStyle(siteThread).zIndex || "0", 10);
    const headerZ = Number.parseInt(headerStyle.zIndex || "0", 10);

    const headerBox = header.getBoundingClientRect();
    const isCompact = header.hasAttribute("data-compact");
    const bg = headerStyle.backgroundColor;

    return {
      isCompact,
      headerZ,
      glyphZ,
      siteZ,
      bg,
      headerHeight: headerBox.height,
      brandVisible: brand.offsetWidth > 0 && brand.offsetHeight > 0,
    };
  });

  expect(headerCheck.isCompact).toBe(true);
  expect(headerCheck.headerZ).toBeGreaterThan(headerCheck.glyphZ);
  expect(headerCheck.headerZ).toBeGreaterThan(headerCheck.siteZ);
  expect(headerCheck.bg).toBe("rgb(3, 3, 5)");
  expect(headerCheck.brandVisible).toBe(true);

  if (testInfo.project.name === "mobile") {
    await expect(page.locator("[data-menu-toggle]")).toBeVisible();
  } else {
    await expect(page.locator("[data-site-nav]")).toBeVisible();
  }
});

test("aligns all generated Syne contours with the semantic About heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: /users don't see/i })).toBeVisible();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-glyph-contour]")]
      .every((path) => path.getAttribute("transform")?.includes("scale(")),
  );

  const alignment = await page.evaluate(() => {
    const errors: number[] = [];
    const transforms = [...document.querySelectorAll<SVGPathElement>("[data-glyph-contour]")].map((path) => {
      const key = path.dataset.glyphKey!;
      const target = document.querySelector<HTMLElement>(`.about__glyph[data-glyph-key='${key}']`)!;
      const wordIndex = key.split("-")[0];
      const baseline = document.querySelector<HTMLElement>(`[data-glyph-baseline='${wordIndex}']`)!;
      const match = path.getAttribute("transform")?.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/);
      if (!match) return false;
      const expectedX = target.getBoundingClientRect().left + scrollX;
      const expectedY = baseline.getBoundingClientRect().top + scrollY;
      const expectedScale = Number.parseFloat(getComputedStyle(target).fontSize) / 1000;
      errors.push(Math.abs(Number(match[1]) - expectedX));
      errors.push(Math.abs(Number(match[2]) - expectedY));
      errors.push(Math.abs(Number(match[3]) - expectedScale));
      return true;
    });

    return {
      glyphCount: document.querySelectorAll(".about__glyph").length,
      contourCount: transforms.length,
      allTransformsValid: transforms.every(Boolean),
      maxError: Math.max(...errors),
      ariaHidden: document.querySelector("[data-glyph-thread]")?.getAttribute("aria-hidden"),
    };
  });

  expect(alignment.glyphCount).toBe(14);
  expect(alignment.contourCount).toBe(17);
  expect(alignment.allTransformsValid).toBe(true);
  expect(alignment.ariaHidden).toBe("true");
  expect(alignment.maxError).toBeLessThan(0.001);
});

test("keeps every glyph contour aligned after direct navigation and resizing", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    location.hash = "experience";
  });
  await page.waitForFunction(() => {
    const paths = [...document.querySelectorAll<SVGPathElement>("[data-glyph-contour]")];
    return window.scrollY > 0 && paths.length === 17 && paths.every((path) => path.getAttribute("transform")?.includes("scale("));
  });
  await page.waitForFunction(() => {
    return [...document.querySelectorAll<SVGPathElement>("[data-glyph-contour]")]
      .every((path) => path.style.strokeDasharray === "none");
  });

  const transformBefore = await page.locator("[data-glyph-contour]").first().getAttribute("transform");
  const viewport = page.viewportSize()!;
  await page.setViewportSize(viewport.width > 700 ? { width: 1180, height: 760 } : { width: 430, height: 820 });
  await page.waitForFunction((previous) => {
    return document.querySelector("[data-glyph-contour]")?.getAttribute("transform") !== previous;
  }, transformBefore);
  await page.waitForFunction(() => {
    return [...document.querySelectorAll<SVGPathElement>("[data-glyph-contour]")].every((path) => {
      const key = path.dataset.glyphKey!;
      const target = document.querySelector<HTMLElement>(`.about__glyph[data-glyph-key='${key}']`)!;
      const baseline = document.querySelector<HTMLElement>(`[data-glyph-baseline='${key.split("-")[0]}']`)!;
      const match = path.getAttribute("transform")?.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/);
      if (!match) return false;
      return Math.abs(Number(match[1]) - (target.getBoundingClientRect().left + scrollX)) < 0.01
        && Math.abs(Number(match[2]) - (baseline.getBoundingClientRect().top + scrollY)) < 0.01
        && Math.abs(Number(match[3]) - Number.parseFloat(getComputedStyle(target).fontSize) / 1000) < 0.00001;
    });
  });

  const maxError = await page.evaluate(() => {
    const errors = [...document.querySelectorAll<SVGPathElement>("[data-glyph-contour]")].flatMap((path) => {
      const key = path.dataset.glyphKey!;
      const target = document.querySelector<HTMLElement>(`.about__glyph[data-glyph-key='${key}']`)!;
      const baseline = document.querySelector<HTMLElement>(`[data-glyph-baseline='${key.split("-")[0]}']`)!;
      const match = path.getAttribute("transform")!.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/)!;
      return [
        Math.abs(Number(match[1]) - (target.getBoundingClientRect().left + scrollX)),
        Math.abs(Number(match[2]) - (baseline.getBoundingClientRect().top + scrollY)),
        Math.abs(Number(match[3]) - Number.parseFloat(getComputedStyle(target).fontSize) / 1000),
      ];
    });
    return Math.max(...errors);
  });

  expect(maxError).toBeLessThan(0.001);
});

test("synchronizes the full glyph trace with scroll position and reverses cleanly", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => {
    const contours = document.querySelectorAll("[data-glyph-contour]");
    const connectors = document.querySelectorAll("[data-glyph-connector]");
    return contours.length === 17 && connectors.length >= 2;
  });

  const initiallyVisible = await page.locator("[data-glyph-contour]").evaluateAll((paths) =>
    paths.filter((path) => (path as SVGPathElement).style.visibility !== "hidden").length,
  );
  expect(initiallyVisible).toBe(0);

  await page.locator("#experience").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const contours = [...document.querySelectorAll<SVGPathElement>("[data-glyph-contour]")];
    const connectors = [...document.querySelectorAll<SVGPathElement>("[data-glyph-connector]")];
    return contours.every((path) => path.style.strokeDasharray === "none")
      && connectors.every((path) => Math.abs(Number.parseFloat(path.style.strokeDashoffset || "1")) < 0.01);
  });
  await expect(page.locator("[data-glyph-contour]")).toHaveCount(17);

  await page.locator("#projects").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const path = document.querySelector<SVGPathElement>("[data-site-thread-segment='2']")!;
    return Math.abs(Number.parseFloat(path.style.strokeDashoffset || "1")) < 0.01;
  });

  await page.locator("#about").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const path = document.querySelector<SVGPathElement>("[data-site-thread-segment='2']")!;
    return path.style.visibility === "hidden" || Number.parseFloat(path.style.strokeDasharray?.split(" ")[0] || "1") < 0.01;
  });

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForFunction(() => {
    const first = document.querySelector<SVGPathElement>("[data-site-thread-segment='0']")!;
    return first.style.visibility === "hidden" || Number.parseFloat(first.style.strokeDasharray?.split(" ")[0] || "1") < 0.01;
  });
  const visibleAtTop = await page.locator("[data-glyph-contour]").evaluateAll((paths) =>
    paths.filter((path) => (path as SVGPathElement).style.visibility !== "hidden").length,
  );
  expect(visibleAtTop).toBe(0);
});

test("hero draw progress maintains completion invariant across responsive viewports", async ({ page }) => {
  const viewports = [
    { width: 1920, height: 927 },
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 701, height: 800 },
    { width: 700, height: 800 },
    { width: 601, height: 800 },
    { width: 600, height: 800 },
    { width: 576, height: 800 },
    { width: 390, height: 844 },
  ];

  // One page load for all nine viewports: resizing re-measures the hero
  // thread through its resize listener and switches the gsap.matchMedia
  // context, so a fresh navigation per viewport is redundant. Nine gotos
  // pushed this test to the 30 s timeout under full-suite load even though
  // every assertion held; resizing keeps the same invariants with headroom.
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  for (const vp of viewports) {
    await page.setViewportSize(vp);

    await page.evaluate(() => {
      const hero = document.getElementById("top") || document.querySelector(".hero");
      const heroH = hero ? hero.getBoundingClientRect().height : window.innerHeight;
      window.scrollTo({ top: heroH * 0.55, behavior: "instant" });
    });

    await page.waitForFunction(() => {
      const isMobile = window.innerWidth <= 700;
      const p0 = document.querySelector<SVGPathElement>(isMobile ? "[data-thread-segment-mobile='0']" : "[data-thread-segment='0']");
      const p1 = document.querySelector<SVGPathElement>(isMobile ? "[data-thread-segment-mobile='1']" : "[data-thread-segment='1']");
      return p0 && p1 && p0.style.strokeDasharray === "none" && p1.style.strokeDasharray === "none";
    });

    const check = await page.evaluate(() => {
      const isMobile = window.innerWidth <= 700;
      const activeSelector = isMobile ? "[data-thread-segment-mobile]" : "[data-thread-segment]";
      const activeSvgs = isMobile
        ? [...document.querySelectorAll(".hero-thread--mobile")]
        : [...document.querySelectorAll(".hero-thread--desktop")];
      const inactiveSvgs = isMobile
        ? [...document.querySelectorAll(".hero-thread--desktop")]
        : [...document.querySelectorAll(".hero-thread--mobile")];

      const activeSvgsDisplayed = activeSvgs.every((svg) => getComputedStyle(svg).display !== "none");
      const inactiveSvgsHidden = inactiveSvgs.every((svg) => getComputedStyle(svg).display === "none");

      const rawActive = [...document.querySelectorAll<SVGPathElement>(activeSelector)];
      const activePaths = rawActive.sort((a, b) => {
        const idxA = Number(a.dataset.threadSegment || a.dataset.threadSegmentMobile || 0);
        const idxB = Number(b.dataset.threadSegment || b.dataset.threadSegmentMobile || 0);
        return idxA - idxB;
      });

      const p0 = activePaths[0]!;
      const p1 = activePaths[1]!;
      const p2 = activePaths[2]!;

      const p0Dash = p0.style.strokeDasharray;
      const p1Dash = p1.style.strokeDasharray;
      const p0Offset = Number.parseFloat(p0.style.strokeDashoffset || "0");
      const p1Offset = Number.parseFloat(p1.style.strokeDashoffset || "0");
      const dashSafe = p0Dash === "none" && p1Dash === "none" && p0Offset === 0 && p1Offset === 0;

      const transformPoint = (path: SVGPathElement, pt: DOMPoint | SVGPoint) => {
        const m = path.getScreenCTM();
        if (!m) return { x: pt.x, y: pt.y };
        return {
          x: pt.x * m.a + pt.y * m.c + m.e,
          y: pt.x * m.b + pt.y * m.d + m.f,
        };
      };

      const p0End = transformPoint(p0, p0.getPointAtLength(p0.getTotalLength()));
      const p1Start = transformPoint(p1, p1.getPointAtLength(0));
      const p1End = transformPoint(p1, p1.getPointAtLength(p1.getTotalLength()));
      const p2Start = transformPoint(p2, p2.getPointAtLength(0));

      const d01 = Math.hypot(p0End.x - p1Start.x, p0End.y - p1Start.y);
      const d12 = Math.hypot(p1End.x - p2Start.x, p1End.y - p2Start.y);

      const nonZeroBoxes = activePaths.every((p) => {
        const box = p.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      });

      return {
        activeSvgsDisplayed,
        inactiveSvgsHidden,
        dashSafe,
        d01,
        d12,
        nonZeroBoxes,
      };
    });

    expect(check.activeSvgsDisplayed).toBe(true);
    expect(check.inactiveSvgsHidden).toBe(true);
    expect(check.dashSafe).toBe(true);
    expect(check.d01).toBeLessThanOrEqual(1.0);
    expect(check.d12).toBeLessThanOrEqual(1.0);
    expect(check.nonZeroBoxes).toBe(true);

    const p2OffsetBefore = await page.evaluate(() => {
      const isMobile = window.innerWidth <= 700;
      const p2 = document.querySelector<SVGPathElement>(isMobile ? "[data-thread-segment-mobile='2']" : "[data-thread-segment='2']")!;
      return Number.parseFloat(p2.style.strokeDashoffset || "0");
    });
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    const p2OffsetAfter = await page.evaluate(() => {
      const isMobile = window.innerWidth <= 700;
      const p2 = document.querySelector<SVGPathElement>(isMobile ? "[data-thread-segment-mobile='2']" : "[data-thread-segment='2']")!;
      return Number.parseFloat(p2.style.strokeDashoffset || "0");
    });
    expect(Math.abs(p2OffsetBefore - p2OffsetAfter)).toBeLessThan(0.005);
  }
});

test("boundary handoff meets hero exit and respects negative-space corridor", async ({ page }) => {
  const viewports = [
    { width: 1920, height: 927 },
    { width: 1440, height: 900 },
    { width: 700, height: 800 },
    { width: 576, height: 800 },
    { width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForFunction(() => {
      const p0 = document.querySelector<SVGPathElement>("[data-site-thread-segment='0']");
      return p0 && p0.getTotalLength() > 0;
    });

    const handoffCheck = await page.evaluate(() => {
      const isMobile = window.innerWidth <= 700;
      const heroExit = document.querySelector<SVGPathElement>(
        isMobile ? "[data-thread-segment-mobile='2']" : "[data-thread-segment='2']",
      )!;
      const heroEndLocal = heroExit.getPointAtLength(heroExit.getTotalLength());
      const m = heroExit.getScreenCTM()!;
      const heroEnd = {
        x: heroEndLocal.x * m.a + heroEndLocal.y * m.c + m.e,
        y: heroEndLocal.x * m.b + heroEndLocal.y * m.d + m.f + window.scrollY,
      };

      const handoffPath = document.querySelector<SVGPathElement>("[data-site-thread-segment='0']")!;
      const handoffStart = handoffPath.getPointAtLength(0);
      const heroHandoffDist = Math.hypot(heroEnd.x - handoffStart.x, heroEnd.y - handoffStart.y);

      const length = handoffPath.getTotalLength();
      let sampledLen = 0;
      let prev = handoffPath.getPointAtLength(0);
      const samples = 40;
      for (let i = 1; i <= samples; i++) {
        const curr = handoffPath.getPointAtLength((length * i) / samples);
        sampledLen += Math.hypot(curr.x - prev.x, curr.y - prev.y);
        prev = curr;
      }

      const box = handoffPath.getBoundingClientRect();
      const inNegativeSpace = box.left > window.innerWidth * 0.45 && box.right <= window.innerWidth + 2;

      const pStart = handoffPath.getPointAtLength(0);
      const pEnd = handoffPath.getPointAtLength(length);
      const dx = Math.abs(pEnd.x - pStart.x);
      const dy = Math.abs(pEnd.y - pStart.y);
      const displacementRatio = dx > 0 ? dy / dx : 0;

      return {
        heroHandoffDist,
        sampledLen,
        inNegativeSpace,
        displacementRatio,
        box,
      };
    });

    expect(handoffCheck.heroHandoffDist).toBeLessThanOrEqual(1.0);
    const maxAllowedLen = Math.min(72, vp.width * 0.12) + 2;
    expect(handoffCheck.sampledLen).toBeLessThanOrEqual(maxAllowedLen);
    expect(handoffCheck.inNegativeSpace).toBe(true);
    expect(handoffCheck.displacementRatio).toBeLessThanOrEqual(2.5);

    const connectorInfo = await page.evaluate(() => {
      const isMobile = window.innerWidth <= 700;
      const hero = document.getElementById("top") || document.querySelector(".hero");
      const heroH = hero ? hero.getBoundingClientRect().height : window.innerHeight;
      const s0 = Math.round(heroH * 0.55);
      const sHandoffEnd = s0 + (isMobile ? 35 : 50);
      const firstGlyph = document.querySelector<HTMLElement>(".about__glyph");
      const firstY = firstGlyph ? firstGlyph.getBoundingClientRect().top + window.scrollY : heroH + 400;
      const sGlyphStart = Math.max(sHandoffEnd + (isMobile ? 65 : 85), Math.round(firstY - window.innerHeight * 0.72));

      const midConnector = Math.round((sHandoffEnd + sGlyphStart) / 2);
      window.scrollTo({ top: midConnector, behavior: "instant" });
      window.dispatchEvent(new Event("scroll"));

      const svg = document.querySelector<SVGElement>("svg[data-site-thread]")!;
      const siteEnd = document.querySelector<SVGElement>("[data-site-thread-end]");
      const glyphEnd = document.querySelector<SVGElement>("[data-glyph-thread-end]");
      const handoff = document.querySelector<SVGPathElement>("[data-site-thread-segment='0']");
      const connector = document.querySelector<SVGPathElement>("[data-site-thread-segment='6']");
      const siteEndVisible = !!siteEnd && getComputedStyle(siteEnd).opacity !== "0" && getComputedStyle(siteEnd).visibility !== "hidden";
      const glyphEndHidden = !glyphEnd || getComputedStyle(glyphEnd).opacity === "0" || getComputedStyle(glyphEnd).visibility === "hidden";
      const handoffCompleted = !!handoff && getComputedStyle(handoff).visibility !== "hidden" && handoff.style.strokeDasharray === "none";
      const connectorDash = connector ? connector.style.strokeDasharray : "";
      const connectorPrefix = connectorDash && connectorDash !== "none" ? Number.parseFloat(connectorDash.split(" ")[0] || "0") : 0;
      const connectorLength = connector ? connector.getTotalLength() : 0;

      return {
        sHandoffEnd,
        sGlyphStart,
        midConnector,
        phase: svg.getAttribute("data-thread-phase"),
        siteEndVisible,
        glyphEndHidden,
        handoffCompleted,
        connectorPrefix,
        connectorLength,
      };
    });

    expect(connectorInfo.sGlyphStart - connectorInfo.sHandoffEnd).toBeGreaterThan(0);
    expect(connectorInfo.phase).toBe("connector");
    expect(connectorInfo.handoffCompleted).toBe(true);
    expect(connectorInfo.connectorPrefix).toBeGreaterThan(0);
    expect(connectorInfo.connectorPrefix).toBeLessThan(connectorInfo.connectorLength);
    expect(connectorInfo.siteEndVisible).toBe(true);
    expect(connectorInfo.glyphEndHidden).toBe(true);

    const collisions = await page.evaluate(() => {
      const handoffPath = document.querySelector<SVGPathElement>("[data-site-thread-segment='0']")!;
      const protectedElements = [...document.querySelectorAll<HTMLElement>("p, a, button, nav, .initiative-card, .skill-row, .education")]
        .filter((element) => !element.closest("#top") && !element.closest(".site-header"));
      const boxes = protectedElements.map((element) => {
        const box = element.getBoundingClientRect();
        return {
          left: box.left - 6,
          right: box.right + 6,
          top: box.top + scrollY - 6,
          bottom: box.bottom + scrollY + 6,
        };
      });
      const hits: number[] = [];
      const length = handoffPath.getTotalLength();
      for (let distance = 0; distance <= length; distance += 4) {
        const point = handoffPath.getPointAtLength(distance);
        if (boxes.some((box) => point.x > box.left && point.x < box.right && point.y > box.top && point.y < box.bottom)) {
          hits.push(distance);
        }
      }
      return hits;
    });
    expect(collisions).toEqual([]);
  }
});

test("responsive threshold transitions rebuild cleanly without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.setViewportSize({ width: 701, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  await page.evaluate(() => {
    const hero = document.getElementById("top") || document.querySelector(".hero");
    const heroH = hero ? hero.getBoundingClientRect().height : 800;
    window.scrollTo({ top: heroH * 0.4, behavior: "instant" });
  });

  const widths = [701, 700, 601, 600, 701];

  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50))));

    const state = await page.evaluate(() => {
      const isMobile = window.innerWidth <= 700;
      const activeSvgs = isMobile
        ? [...document.querySelectorAll(".hero-thread--mobile")]
        : [...document.querySelectorAll(".hero-thread--desktop")];
      const inactiveSvgs = isMobile
        ? [...document.querySelectorAll(".hero-thread--desktop")]
        : [...document.querySelectorAll(".hero-thread--mobile")];

      const noHorizontalOverflow = document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
      const activeDisplayed = activeSvgs.every((svg) => getComputedStyle(svg).display !== "none");
      const inactiveHidden = inactiveSvgs.every((svg) => getComputedStyle(svg).display === "none");

      const activePaths = isMobile
        ? [...document.querySelectorAll<SVGPathElement>("[data-thread-segment-mobile]")]
        : [...document.querySelectorAll<SVGPathElement>("[data-thread-segment]")];
      const allPathsRendered = activePaths.every((p) => p.getBoundingClientRect().width > 0);

      return {
        noHorizontalOverflow,
        activeDisplayed,
        inactiveHidden,
        allPathsRendered,
      };
    });

    expect(state.noHorizontalOverflow).toBe(true);
    expect(state.activeDisplayed).toBe(true);
    expect(state.inactiveHidden).toBe(true);
    expect(state.allPathsRendered).toBe(true);
  }

  expect(errors).toEqual([]);
});

test("enforces continuous lifecycle A -> B -> C -> D and reversible symmetry", async ({ page }) => {
  const viewports = [
    { width: 1920, height: 927 },
    { width: 1440, height: 900 },
    { width: 700, height: 800 },
    { width: 576, height: 800 },
    { width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.evaluate(() => document.fonts.ready);

    const samplingResult = await page.evaluate(async () => {
      const hero = document.getElementById("top") || document.querySelector(".hero");
      const heroH = hero ? hero.getBoundingClientRect().height : window.innerHeight;
      const s0 = Math.round(heroH * 0.55);
      const sHandoffEnd = s0 + (window.innerWidth <= 700 ? 35 : 50);

      const firstGlyph = document.querySelector<HTMLElement>(".about__glyph");
      const firstY = firstGlyph ? firstGlyph.getBoundingClientRect().top + window.scrollY : heroH + 400;
      const sGlyphStart = Math.max(sHandoffEnd + (window.innerWidth <= 700 ? 65 : 85), Math.round(firstY - window.innerHeight * 0.72));

      const svg = document.querySelector<SVGElement>("svg[data-site-thread]")!;
      const handoff = document.querySelector<SVGPathElement>("[data-site-thread-segment='0']")!;
      const siteEnd = document.querySelector<SVGElement>("[data-site-thread-end]")!;
      const glyphEnd = document.querySelector<SVGElement>("[data-glyph-thread-end]")!;

      const startScroll = Math.max(0, s0 - 48);
      const endScroll = sGlyphStart + 48;

      type Sample = {
        y: number;
        phase: string;
        handoffVis: string;
        siteEndVis: boolean;
        glyphEndVis: boolean;
      };

      const forwardSamples: Sample[] = [];
      for (let y = startScroll; y <= endScroll; y += 8) {
        window.scrollTo({ top: y, behavior: "instant" });
        window.dispatchEvent(new Event("scroll"));

        const phase = svg.getAttribute("data-thread-phase") || "unknown";
        const handoffVis = getComputedStyle(handoff).visibility;
        const siteEndVis = getComputedStyle(siteEnd).opacity !== "0" && getComputedStyle(siteEnd).visibility !== "hidden";
        const glyphEndVis = getComputedStyle(glyphEnd).opacity !== "0" && getComputedStyle(glyphEnd).visibility !== "hidden";

        forwardSamples.push({ y, phase, handoffVis, siteEndVis, glyphEndVis });
      }

      const reverseYList = [...forwardSamples.map((s) => s.y)].reverse();
      const reverseSamples: Sample[] = [];
      for (const y of reverseYList) {
        window.scrollTo({ top: y, behavior: "instant" });
        window.dispatchEvent(new Event("scroll"));

        const phase = svg.getAttribute("data-thread-phase") || "unknown";
        const handoffVis = getComputedStyle(handoff).visibility;
        const siteEndVis = getComputedStyle(siteEnd).opacity !== "0" && getComputedStyle(siteEnd).visibility !== "hidden";
        const glyphEndVis = getComputedStyle(glyphEnd).opacity !== "0" && getComputedStyle(glyphEnd).visibility !== "hidden";

        reverseSamples.push({ y, phase, handoffVis, siteEndVis, glyphEndVis });
      }

      return {
        s0,
        sHandoffEnd,
        sGlyphStart,
        forwardSamples,
        reverseSamples,
      };
    });

    const { forwardSamples, reverseSamples } = samplingResult;

    const distinctPhases: string[] = [];
    forwardSamples.forEach((sample, idx) => {
      if (idx === 0 || sample.phase !== forwardSamples[idx - 1]!.phase) {
        distinctPhases.push(sample.phase);
      }
      if (sample.phase === "hero") {
        expect(sample.handoffVis).toBe("hidden");
        expect(sample.siteEndVis).toBe(false);
        expect(sample.glyphEndVis).toBe(false);
      }
      if (sample.phase === "handoff") {
        expect(sample.handoffVis).not.toBe("hidden");
        expect(sample.siteEndVis).toBe(true);
      }
      if (sample.phase === "connector") {
        expect(sample.handoffVis).not.toBe("hidden");
        expect(sample.siteEndVis).toBe(true);
        expect(sample.glyphEndVis).toBe(false);
      }
      if (sample.phase === "glyph") {
        expect(sample.handoffVis).not.toBe("hidden");
      }
    });

    expect(distinctPhases).toEqual(["hero", "handoff", "connector", "glyph"]);

    const reverseByY = new Map(reverseSamples.map((s) => [s.y, s]));
    for (const fSample of forwardSamples) {
      const rSample = reverseByY.get(fSample.y);
      expect(rSample).toBeDefined();
      expect(rSample!.phase).toBe(fSample.phase);
      expect(rSample!.handoffVis).toBe(fSample.handoffVis);
      expect(rSample!.siteEndVis).toBe(fSample.siteEndVis);
      expect(rSample!.glyphEndVis).toBe(fSample.glyphEndVis);
    }
  }
});

test("connector bridges handoff end to first glyph junction without a gap", async ({ page }) => {
  const viewports = [
    { width: 1920, height: 927 },
    { width: 1440, height: 900 },
    { width: 700, height: 800 },
    { width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.evaluate(() => document.fonts.ready);

    const bridge = await page.evaluate(async () => {
      const isMobile = window.innerWidth <= 700;
      const hero = document.getElementById("top") || document.querySelector(".hero");
      const heroH = hero ? hero.getBoundingClientRect().height : window.innerHeight;
      const s0 = Math.round(heroH * 0.55);
      const sHandoffEnd = s0 + (isMobile ? 35 : 50);

      // First glyph in rendered order: group by top, reverse even lines.
      const glyphEls = [...document.querySelectorAll<HTMLElement>(".about__glyph[data-glyph-key]")];
      const raw = glyphEls.map((el) => {
        const box = el.getBoundingClientRect();
        return { key: el.dataset.glyphKey!, top: box.top + scrollY, left: box.left + scrollX };
      });
      const lines: typeof raw[] = [];
      [...raw].sort((a, b) => a.top - b.top || a.left - b.left).forEach((g) => {
        const line = lines.find((items) => Math.abs(items[0]!.top - g.top) < 4);
        line ? line.push(g) : lines.push([g]);
      });
      lines.forEach((line, lineIndex) => {
        line.sort((a, b) => a.left - b.left);
        if (lineIndex % 2 === 0) line.reverse();
      });
      const firstKey = lines.flat()[0]!.key;
      const firstPath = document.querySelector<SVGPathElement>(`path[data-glyph-key='${firstKey}'][data-glyph-contour='0']`)!;
      const pathLen = firstPath.getTotalLength();
      let junction = { x: 0, y: Number.POSITIVE_INFINITY };
      for (let i = 0; i <= 120; i++) {
        const pt = firstPath.getPointAtLength((pathLen * i) / 120);
        const m = firstPath.getScreenCTM()!;
        const x = pt.x * m.a + pt.y * m.c + m.e;
        const y = pt.x * m.b + pt.y * m.d + m.f + scrollY;
        if (y < junction.y) junction = { x, y };
      }

      const handoff = document.querySelector<SVGPathElement>("[data-site-thread-segment='0']")!;
      const connector = document.querySelector<SVGPathElement>("[data-site-thread-segment='6']")!;
      const handoffEnd = handoff.getPointAtLength(handoff.getTotalLength());
      const connectorStart = connector.getPointAtLength(0);
      const connectorEnd = connector.getPointAtLength(connector.getTotalLength());
      const connectorLen = connector.getTotalLength();

      const firstGlyph = document.querySelector<HTMLElement>(".about__glyph");
      const firstY = firstGlyph ? firstGlyph.getBoundingClientRect().top + window.scrollY : heroH + 400;
      const sGlyphStart = Math.max(sHandoffEnd + (isMobile ? 65 : 85), Math.round(firstY - window.innerHeight * 0.72));
      const midConnector = Math.round((sHandoffEnd + sGlyphStart) / 2);
      window.scrollTo({ top: midConnector, behavior: "instant" });
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => setTimeout(resolve, 50));

      const siteEnd = document.querySelector<SVGCircleElement>("[data-site-thread-end]")!;
      const dotX = Number.parseFloat(siteEnd.getAttribute("cx") || "0");
      const dotY = Number.parseFloat(siteEnd.getAttribute("cy") || "0");
      let dotDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i <= 100; i++) {
        const pt = connector.getPointAtLength((connectorLen * i) / 100);
        dotDist = Math.min(dotDist, Math.hypot(pt.x - dotX, pt.y - dotY));
      }

      return {
        handoffToConnector: Math.hypot(handoffEnd.x - connectorStart.x, handoffEnd.y - connectorStart.y),
        connectorToJunction: Math.hypot(connectorEnd.x - junction.x, connectorEnd.y - junction.y),
        connectorLen,
        dotDist,
        dotVisible: getComputedStyle(siteEnd).opacity !== "0",
      };
    });

    expect(bridge.handoffToConnector).toBeLessThanOrEqual(1.0);
    expect(bridge.connectorToJunction).toBeLessThanOrEqual(1.0);
    expect(bridge.connectorLen).toBeGreaterThan(100);
    expect(bridge.dotVisible).toBe(true);
    expect(bridge.dotDist).toBeLessThanOrEqual(3);
  }
});

test("initial hero state renders statically and deterministically without dead tweens", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);

  const initial = await page.evaluate(() => {
    const isMobile = window.innerWidth <= 700;
    const selector = isMobile ? "[data-thread-segment-mobile='0']" : "[data-thread-segment='0']";
    const p0 = document.querySelector<SVGPathElement>(selector)!;
    const offset0 = parseFloat(p0.style.strokeDashoffset || getComputedStyle(p0).strokeDashoffset);
    const dash0 = p0.style.strokeDasharray || getComputedStyle(p0).strokeDasharray;
    const progress0 = parseFloat(dash0.split(" ")[0] || "0");
    const vis0 = getComputedStyle(p0).visibility;
    return {
      offset0,
      progress0,
      vis0,
    };
  });

  expect(initial.vis0).toBe("visible");
  expect(initial.offset0).toBe(0);
  expect(initial.progress0).toBeGreaterThan(0.01);
  expect(initial.progress0).toBeLessThan(0.99);

  await page.waitForTimeout(150);
  const afterWait = await page.evaluate(() => {
    const isMobile = window.innerWidth <= 700;
    const selector = isMobile ? "[data-thread-segment-mobile='0']" : "[data-thread-segment='0']";
    const p0 = document.querySelector<SVGPathElement>(selector)!;
    const dash0 = p0.style.strokeDasharray || getComputedStyle(p0).strokeDasharray;
    return parseFloat(dash0.split(" ")[0] || "0");
  });
  expect(afterWait).toBe(initial.progress0);

  // 3. Navigate directly to #about and back to #top to ensure determinism
  await page.locator("#about").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.scrollY > 200);

  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    window.dispatchEvent(new Event("scroll"));
  });
  await page.waitForFunction(() => window.scrollY === 0);
  await page.waitForTimeout(50);

  const afterNav = await page.evaluate(() => {
    const isMobile = window.innerWidth <= 700;
    const selector = isMobile ? "[data-thread-segment-mobile='0']" : "[data-thread-segment='0']";
    const p0 = document.querySelector<SVGPathElement>(selector)!;
    const dash0 = p0.style.strokeDasharray || getComputedStyle(p0).strokeDasharray;
    return parseFloat(dash0.split(" ")[0] || "0");
  });
  expect(Math.abs(afterNav - initial.progress0)).toBeLessThan(0.001);

  // 4. Reload page to confirm initial deterministic state
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);

  const afterReload = await page.evaluate(() => {
    const isMobile = window.innerWidth <= 700;
    const selector = isMobile ? "[data-thread-segment-mobile='0']" : "[data-thread-segment='0']";
    const p0 = document.querySelector<SVGPathElement>(selector)!;
    const dash0 = p0.style.strokeDasharray || getComputedStyle(p0).strokeDasharray;
    return parseFloat(dash0.split(" ")[0] || "0");
  });
  expect(Math.abs(afterReload - initial.progress0)).toBeLessThan(0.001);
});

test("hero segment 2 eliminates dash-wrap suffix and paints single contiguous prefix across early activation", async ({ page }) => {
  const viewports = [
    { width: 1920, height: 927 },
    { width: 1440, height: 900 },
    { width: 700, height: 800 },
    { width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.evaluate(() => document.fonts.ready);

    // Test early activation scroll positions where Round 5 suffered from wrapped suffix
    const scrollPositions = [80, 100, 120, 140, 160, 200];

    for (const scrollY of scrollPositions) {
      // Forward scroll to scrollY
      await page.evaluate((y) => {
        window.scrollTo({ top: y, behavior: "instant" });
        window.dispatchEvent(new Event("scroll"));
      }, scrollY);

      const forwardTopology = await page.evaluate(() => {
        const isMobile = window.innerWidth <= 700;
        const selector = isMobile ? "[data-thread-segment-mobile='2']" : "[data-thread-segment='2']";
        const p2 = document.querySelector<SVGPathElement>(selector);
        if (!p2) return null;

        const vis = getComputedStyle(p2).visibility;
        const dash = p2.style.strokeDasharray || getComputedStyle(p2).strokeDasharray;
        const offset = p2.style.strokeDashoffset || getComputedStyle(p2).strokeDashoffset;

        const total = p2.getTotalLength();
        const N = 200;
        const painted: number[] = [];
        for (let i = 0; i <= N; i++) {
          const pt = p2.getPointAtLength((total * i) / N);
          if (p2.isPointInStroke(pt)) {
            painted.push(i);
          }
        }

        const groups: { start: number; end: number; len: number }[] = [];
        let curStart = -1;
        for (let i = 0; i <= N; i++) {
          if (painted.includes(i)) {
            if (curStart === -1) curStart = i;
          } else {
            if (curStart !== -1) {
              groups.push({ start: curStart, end: i - 1, len: i - curStart });
              curStart = -1;
            }
          }
        }
        if (curStart !== -1) {
          groups.push({ start: curStart, end: N, len: N - curStart + 1 });
        }

        const farEndPainted = painted.some((idx) => idx >= N * 0.75);

        return {
          vis,
          dash,
          offset,
          paintedCount: painted.length,
          groups,
          farEndPainted,
          firstIndex: painted[0] ?? -1,
          lastIndex: painted.at(-1) ?? -1,
        };
      });

      if (forwardTopology && forwardTopology.vis === "visible" && forwardTopology.paintedCount > 0) {
        // Must be exactly one contiguous group
        expect(forwardTopology.groups.length).toBe(1);
        // Must start at index 0 (path distance 0)
        expect(forwardTopology.firstIndex).toBe(0);
        // Dash offset must be 0 (no phase wrap)
        expect(Number.parseFloat(forwardTopology.offset)).toBe(0);
        // No detached suffix at the far end (indices >= 150 out of 200)
        expect(forwardTopology.farEndPainted).toBe(false);
      }

      // Reverse symmetry check: scroll down further, then scroll back to scrollY
      await page.evaluate((y) => {
        window.scrollTo({ top: y + 80, behavior: "instant" });
        window.dispatchEvent(new Event("scroll"));
      }, scrollY);

      await page.evaluate((y) => {
        window.scrollTo({ top: y, behavior: "instant" });
        window.dispatchEvent(new Event("scroll"));
      }, scrollY);

      const reverseTopology = await page.evaluate(() => {
        const isMobile = window.innerWidth <= 700;
        const selector = isMobile ? "[data-thread-segment-mobile='2']" : "[data-thread-segment='2']";
        const p2 = document.querySelector<SVGPathElement>(selector);
        if (!p2) return null;

        const total = p2.getTotalLength();
        const N = 200;
        const painted: number[] = [];
        for (let i = 0; i <= N; i++) {
          const pt = p2.getPointAtLength((total * i) / N);
          if (p2.isPointInStroke(pt)) {
            painted.push(i);
          }
        }

        const groups: { start: number; end: number; len: number }[] = [];
        let curStart = -1;
        for (let i = 0; i <= N; i++) {
          if (painted.includes(i)) {
            if (curStart === -1) curStart = i;
          } else {
            if (curStart !== -1) {
              groups.push({ start: curStart, end: i - 1, len: i - curStart });
              curStart = -1;
            }
          }
        }
        if (curStart !== -1) {
          groups.push({ start: curStart, end: N, len: N - curStart + 1 });
        }

        return {
          paintedCount: painted.length,
          groups,
          firstIndex: painted[0] ?? -1,
          lastIndex: painted.at(-1) ?? -1,
        };
      });

      if (forwardTopology && reverseTopology) {
        expect(reverseTopology.paintedCount).toBe(forwardTopology.paintedCount);
        expect(reverseTopology.firstIndex).toBe(forwardTopology.firstIndex);
        expect(reverseTopology.lastIndex).toBe(forwardTopology.lastIndex);
        expect(reverseTopology.groups.length).toBe(forwardTopology.groups.length);
      }
    }
  }
});

test("verifies contiguous open-path topology across hero, handoff, glyph connectors, and responsive viewports", async ({ page }) => {
  const viewports = [
    { width: 1920, height: 927 },
    { width: 1440, height: 900 },
    { width: 700, height: 800 },
    { width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.evaluate(() => document.fonts.ready);

    // 1. Hero open paths at distinct partial fractions (0.10, 0.25, 0.50, 0.75, 0.95)
    const heroH = await page.evaluate(() => {
      const hero = document.getElementById("top") || document.querySelector(".hero");
      return hero ? hero.getBoundingClientRect().height : window.innerHeight;
    });
    const maxHeroScroll = Math.round(heroH * 0.55);
    const heroTestFractions = [0.1, 0.25, 0.5, 0.75, 0.95];

    for (const frac of heroTestFractions) {
      const targetScroll = Math.round(maxHeroScroll * frac);

      const checkHero = async (y: number) => {
        await page.evaluate((topY) => {
          window.scrollTo({ top: topY, behavior: "instant" });
          window.dispatchEvent(new Event("scroll"));
        }, y);

        return page.evaluate(() => {
          const isMobile = window.innerWidth <= 700;
          const selector = isMobile ? "[data-thread-segment-mobile]" : "[data-thread-segment]";
          const paths = [...document.querySelectorAll<SVGPathElement>(selector)].sort((a, b) => {
            const idxA = Number(a.dataset.threadSegment || a.dataset.threadSegmentMobile || 0);
            const idxB = Number(b.dataset.threadSegment || b.dataset.threadSegmentMobile || 0);
            return idxA - idxB;
          });

          const activePath = paths.find((p) => {
            const vis = getComputedStyle(p).visibility;
            const dash = p.style.strokeDasharray;
            return vis === "visible" && dash && dash !== "none";
          });

          if (!activePath) return null;

          const total = activePath.getTotalLength();
          const N = 200;
          const painted: number[] = [];
          for (let i = 0; i <= N; i++) {
            const pt = activePath.getPointAtLength((total * i) / N);
            if (activePath.isPointInStroke(pt)) painted.push(i);
          }

          const groups: { start: number; end: number }[] = [];
          let curStart = -1;
          for (let i = 0; i <= N; i++) {
            if (painted.includes(i)) {
              if (curStart === -1) curStart = i;
            } else {
              if (curStart !== -1) {
                groups.push({ start: curStart, end: i - 1 });
                curStart = -1;
              }
            }
          }
          if (curStart !== -1) groups.push({ start: curStart, end: N });

          return {
            pathIndex: paths.indexOf(activePath),
            paintedCount: painted.length,
            groups,
            firstIndex: painted[0] ?? -1,
            lastIndex: painted.at(-1) ?? -1,
            offset: activePath.style.strokeDashoffset,
          };
        });
      };

      const forwardState = await checkHero(targetScroll);
      if (forwardState && forwardState.paintedCount > 0) {
        expect(forwardState.groups.length).toBe(1);
        expect(forwardState.firstIndex).toBe(0);
        expect(Number.parseFloat(forwardState.offset)).toBe(0);

        // Verify reverse symmetry at identical scrollY
        await page.evaluate((topY) => {
          window.scrollTo({ top: topY + 50, behavior: "instant" });
          window.dispatchEvent(new Event("scroll"));
        }, targetScroll);

        const reverseState = await checkHero(targetScroll);
        expect(reverseState?.groups.length).toBe(1);
        expect(reverseState?.firstIndex).toBe(0);
        expect(reverseState?.paintedCount).toBe(forwardState.paintedCount);
      }
    }

    // 2. Handoff open path ([data-site-thread-segment='0']) during Phase B
    const s0 = Math.round(heroH * 0.55);
    const isMobileVp = vp.width <= 700;
    const sHandoffEnd = s0 + (isMobileVp ? 35 : 50);

    for (const frac of [0.25, 0.5, 0.75]) {
      const handoffScroll = Math.round(s0 + (sHandoffEnd - s0) * frac);

      const sampleHandoff = async (y: number) => {
        await page.evaluate((topY) => {
          window.scrollTo({ top: topY, behavior: "instant" });
          window.dispatchEvent(new Event("scroll"));
        }, y);

        return page.evaluate(() => {
          const handoff = document.querySelector<SVGPathElement>("[data-site-thread-segment='0']");
          if (!handoff) return null;
          const vis = getComputedStyle(handoff).visibility;
          if (vis === "hidden") return null;

          const total = handoff.getTotalLength();
          const N = 200;
          const painted: number[] = [];
          for (let i = 0; i <= N; i++) {
            const pt = handoff.getPointAtLength((total * i) / N);
            if (handoff.isPointInStroke(pt)) painted.push(i);
          }

          const groups: { start: number; end: number }[] = [];
          let curStart = -1;
          for (let i = 0; i <= N; i++) {
            if (painted.includes(i)) {
              if (curStart === -1) curStart = i;
            } else {
              if (curStart !== -1) {
                groups.push({ start: curStart, end: i - 1 });
                curStart = -1;
              }
            }
          }
          if (curStart !== -1) groups.push({ start: curStart, end: N });

          return {
            paintedCount: painted.length,
            groups,
            firstIndex: painted[0] ?? -1,
            lastIndex: painted.at(-1) ?? -1,
            offset: handoff.style.strokeDashoffset,
          };
        });
      };

      const forwardHandoff = await sampleHandoff(handoffScroll);
      if (forwardHandoff && forwardHandoff.paintedCount > 0) {
        expect(forwardHandoff.groups.length).toBe(1);
        expect(forwardHandoff.firstIndex).toBe(0);
        expect(Number.parseFloat(forwardHandoff.offset)).toBe(0);

        // Reverse check
        await page.evaluate((topY) => {
          window.scrollTo({ top: topY + 20, behavior: "instant" });
          window.dispatchEvent(new Event("scroll"));
        }, handoffScroll);

        const reverseHandoff = await sampleHandoff(handoffScroll);
        expect(reverseHandoff?.groups.length).toBe(1);
        expect(reverseHandoff?.firstIndex).toBe(0);
        expect(reverseHandoff?.paintedCount).toBe(forwardHandoff.paintedCount);
      }
    }

    // 3. Visible glyph connectors ([data-glyph-connector])
    const connectorTopology = await page.evaluate(() => {
      const connectors = [...document.querySelectorAll<SVGPathElement>("[data-glyph-connector]")];
      let activeSample: {
        y: number;
        paintedCount: number;
        groups: { start: number; end: number }[];
        firstIndex: number;
        lastIndex: number;
        offset: string;
      } | null = null;

      // Scan About section scroll range to find a partially drawing connector
      for (let y = 800; y < 2200; y += 12) {
        window.scrollTo({ top: y, behavior: "instant" });
        window.dispatchEvent(new Event("scroll"));

        for (const conn of connectors) {
          const vis = getComputedStyle(conn).visibility;
          const dash = conn.style.strokeDasharray;
          if (vis === "visible" && dash && dash !== "none") {
            const parts = dash.split(/[ ,]+/).map(Number);
            const dashLength = parts[0] ?? 0;
            const gapLength = parts[1] ?? 0;
            if (dashLength > 0 && dashLength < gapLength) {
              const total = conn.getTotalLength();
              const N = 200;
              const painted: number[] = [];
              for (let i = 0; i <= N; i++) {
                const pt = conn.getPointAtLength((total * i) / N);
                if (conn.isPointInStroke(pt)) painted.push(i);
              }

              const groups: { start: number; end: number }[] = [];
              let curStart = -1;
              for (let i = 0; i <= N; i++) {
                if (painted.includes(i)) {
                  if (curStart === -1) curStart = i;
                } else {
                  if (curStart !== -1) {
                    groups.push({ start: curStart, end: i - 1 });
                    curStart = -1;
                  }
                }
              }
              if (curStart !== -1) groups.push({ start: curStart, end: N });

              activeSample = {
                y,
                paintedCount: painted.length,
                groups,
                firstIndex: painted[0] ?? -1,
                lastIndex: painted.at(-1) ?? -1,
                offset: conn.style.strokeDashoffset,
              };
              break;
            }
          }
        }
        if (activeSample) break;
      }
      return activeSample;
    });

    if (connectorTopology && connectorTopology.paintedCount > 0) {
      expect(connectorTopology.groups.length).toBe(1);
      expect(connectorTopology.firstIndex).toBe(0);
      expect(Number.parseFloat(connectorTopology.offset)).toBe(0);
    }

    // 4. Hero-to-glyph connector ([data-site-thread-segment='6']) during its draw range
    const firstGlyphEl = await page.evaluate(() => {
      const firstGlyph = document.querySelector<HTMLElement>(".about__glyph");
      return firstGlyph ? firstGlyph.getBoundingClientRect().top + window.scrollY : 0;
    });
    const sGlyphStart = Math.max(sHandoffEnd + (isMobileVp ? 65 : 85), Math.round(firstGlyphEl - vp.height * 0.72));

    for (const frac of [0.25, 0.5, 0.75]) {
      const connectorScroll = Math.round(sHandoffEnd + (sGlyphStart - sHandoffEnd) * frac);

      const sampleConnector = async (y: number) => {
        await page.evaluate((topY) => {
          window.scrollTo({ top: topY, behavior: "instant" });
          window.dispatchEvent(new Event("scroll"));
        }, y);

        return page.evaluate(() => {
          const connector = document.querySelector<SVGPathElement>("[data-site-thread-segment='6']");
          if (!connector) return null;
          const vis = getComputedStyle(connector).visibility;
          if (vis === "hidden") return null;

          const total = connector.getTotalLength();
          const N = 200;
          const painted: number[] = [];
          for (let i = 0; i <= N; i++) {
            const pt = connector.getPointAtLength((total * i) / N);
            if (connector.isPointInStroke(pt)) painted.push(i);
          }

          const groups: { start: number; end: number }[] = [];
          let curStart = -1;
          for (let i = 0; i <= N; i++) {
            if (painted.includes(i)) {
              if (curStart === -1) curStart = i;
            } else {
              if (curStart !== -1) {
                groups.push({ start: curStart, end: i - 1 });
                curStart = -1;
              }
            }
          }
          if (curStart !== -1) groups.push({ start: curStart, end: N });

          return {
            paintedCount: painted.length,
            groups,
            firstIndex: painted[0] ?? -1,
            lastIndex: painted.at(-1) ?? -1,
            offset: connector.style.strokeDashoffset,
          };
        });
      };

      const forwardConnector = await sampleConnector(connectorScroll);
      if (forwardConnector && forwardConnector.paintedCount > 0) {
        expect(forwardConnector.groups.length).toBe(1);
        expect(forwardConnector.firstIndex).toBe(0);
        expect(Number.parseFloat(forwardConnector.offset)).toBe(0);

        // Reverse check
        await page.evaluate((topY) => {
          window.scrollTo({ top: topY + 20, behavior: "instant" });
          window.dispatchEvent(new Event("scroll"));
        }, connectorScroll);

        const reverseConnector = await sampleConnector(connectorScroll);
        expect(reverseConnector?.groups.length).toBe(1);
        expect(reverseConnector?.firstIndex).toBe(0);
        expect(reverseConnector?.paintedCount).toBe(forwardConnector.paintedCount);
      }
    }
  }
});

test("round 11: thread geometry is G1-continuous with controlled curvature", async ({ page }) => {
  // Guards the round-11 thread redesign: every joint between consecutive
  // cubics (within a segment and across the hero/handoff/connector/site
  // boundaries) is tangent-continuous, every cubic keeps a minimum radius
  // of curvature, glyph connectors leave/arrive along the contour
  // tangents, the contact approach stays on-canvas, and the site-1 exit
  // stays clear of the About statement and profile text. Thresholds sit
  // below the measured values with margin (worst measured joint mismatch
  // 0.6deg, worst cubic radius 5px on the tiny mobile connector rise);
  // they do not chase the measurements. Round 12: clearances are measured
  // against the TEXT elements, not the section boxes, because the new
  // site-1 drop deliberately runs through the statement box's empty
  // channel; the guard is that it never touches actual text. Round 12
  // integration: the old 1->2->3->4->5 cross-segment loop is replaced by
  // the project chain (site-2 -> C0 -> stage paths -> C1/C2/C3 -> site-4
  // -> site-5, compared in site space via CTM sampling), the stage paths
  // get their own joint/radius checks in travel order (viewBox space),
  // and the Sheet connector -> melody joint is re-measured as the actual
  // angle between the two tangents, not the absolute end angle.
  const viewports = [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() =>
      [...document.querySelectorAll<SVGPathElement>("[data-site-thread-segment]")].reduce(
        (t, p) => t + p.getTotalLength(),
        0,
      ) > 1000,
    );
    // Clearances are measured in the REVEALED state: reveal tweens shift
    // the statement (+22px) and the Experience heading (+34px) on mobile
    // until they play, and the thread is built in final layout
    // coordinates, so measuring at scrollY 0 would overstate mobile
    // clearances by the offset.
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      document.querySelector(".about__statement")!.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(2500);

    const geom = await page.evaluate(() => {
      type Pt = { x: number; y: number };
      type Cmd = { cmd: string; from: Pt; c1?: Pt; c2?: Pt; p: Pt };
      const parseD = (d: string): Cmd[] => {
        const tokens = d.match(/[MLC]|[-+]?\d*\.?\d+/g) || [];
        const cmds: Cmd[] = [];
        let i = 0;
        let cmd = "";
        let cur: Pt = { x: 0, y: 0 };
        while (i < tokens.length) {
          const t = tokens[i]!;
          if (t === "M" || t === "L" || t === "C") {
            cmd = t;
            i++;
            continue;
          }
          const x = Number.parseFloat(tokens[i]!);
          const y = Number.parseFloat(tokens[i + 1]!);
          i += 2;
          if (cmd === "M") {
            cur = { x, y };
            cmds.push({ cmd: "M", from: cur, p: { x, y } });
            cmd = "L";
          } else if (cmd === "L") {
            cmds.push({ cmd: "L", from: cur, p: { x, y } });
            cur = { x, y };
          } else if (cmd === "C") {
            const c1 = { x, y };
            const c2 = { x: Number.parseFloat(tokens[i]!), y: Number.parseFloat(tokens[i + 1]!) };
            const p = { x: Number.parseFloat(tokens[i + 2]!), y: Number.parseFloat(tokens[i + 3]!) };
            i += 4;
            cmds.push({ cmd: "C", from: cur, c1, c2, p });
            cur = p;
          }
        }
        return cmds;
      };
      const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
      const norm = (v: Pt): Pt => {
        const l = Math.hypot(v.x, v.y) || 1;
        return { x: v.x / l, y: v.y / l };
      };
      const angleBetween = (a: Pt, b: Pt) =>
        (Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y))) * 180) / Math.PI;
      const startTangent = (c: Cmd): Pt => (c.cmd === "L" ? norm(sub(c.p, c.from)) : norm(sub(c.c1!, c.from)));
      const endTangent = (c: Cmd): Pt => (c.cmd === "L" ? norm(sub(c.p, c.from)) : norm(sub(c.p, c.c2!)));
      // Max curvature along a cubic by sampling the analytic derivative.
      const maxCurvature = (c: Cmd): number => {
        if (c.cmd !== "C") return 0;
        let max = 0;
        for (let k = 0; k <= 40; k++) {
          const t = k / 40;
          const mt = 1 - t;
          const dx =
            3 * mt * mt * (c.c1!.x - c.from.x) + 6 * mt * t * (c.c2!.x - c.c1!.x) + 3 * t * t * (c.p.x - c.c2!.x);
          const dy =
            3 * mt * mt * (c.c1!.y - c.from.y) + 6 * mt * t * (c.c2!.y - c.c1!.y) + 3 * t * t * (c.p.y - c.c2!.y);
          const ddx = 6 * mt * (c.c2!.x - 2 * c.c1!.x + c.from.x) + 6 * t * (c.p.x - 2 * c.c2!.x + c.c1!.x);
          const ddy = 6 * mt * (c.c2!.y - 2 * c.c1!.y + c.from.y) + 6 * t * (c.p.y - 2 * c.c2!.y + c.c1!.y);
          const sp = Math.hypot(dx, dy);
          if (sp < 1e-6) continue;
          max = Math.max(max, Math.abs(dx * ddy - dy * ddx) / (sp * sp * sp));
        }
        return max;
      };

      const sitePaths = [...document.querySelectorAll<SVGPathElement>("[data-site-thread-segment]")].sort(
        (a, b) => Number(a.dataset.siteThreadSegment) - Number(b.dataset.siteThreadSegment),
      );
      const siteCmds = sitePaths.map((p) => parseD(p.getAttribute("d") || ""));

      // Internal joints + per-cubic min radius for every site segment.
      const maxJointMismatch = { value: 0 };
      const minRadius: (number | null)[] = [];
      siteCmds.forEach((cmds) => {
        let segMin: number | null = null;
        for (let i = 1; i < cmds.length; i++) {
          const prev = cmds[i - 1]!;
          const cur = cmds[i]!;
          if (prev.cmd === "M") continue;
          maxJointMismatch.value = Math.max(
            maxJointMismatch.value,
            angleBetween(endTangent(prev), startTangent(cur)),
          );
        }
        cmds
          .filter((c) => c.cmd === "C")
          .forEach((c) => {
            const k = maxCurvature(c);
            if (k > 0) segMin = segMin === null ? 1 / k : Math.min(segMin, 1 / k);
          });
        minRadius.push(segMin);
      });

      // Round 12: the project chain. Travel order through Projects is
      // site-2 -> C0 -> E2EE stage paths -> C1 -> Sheet paths -> C2 ->
      // Piano paths -> C3 -> site-4 -> site-5. Consecutive elements are
      // compared in site space via CTM sampling, so paths from different
      // SVGs (site space vs stage viewBoxes) are compared in one frame.
      // The old 1->2->3->4->5 loop is subsumed: site-3 is now the C0
      // connector and the stage paths sit between site-3 and site-4.
      const isMobile = window.innerWidth <= 700;
      const siteSvg = sitePaths[0]!.ownerSVGElement!;
      const toSiteSpace = (el: SVGPathElement, distance: number): Pt | null => {
        const pt = el.getPointAtLength(distance);
        const pathMatrix = el.getScreenCTM();
        const siteMatrix = siteSvg.getScreenCTM();
        if (!pathMatrix || !siteMatrix) return null;
        const q = new DOMPoint(pt.x, pt.y).matrixTransform(pathMatrix).matrixTransform(siteMatrix.inverse());
        return { x: q.x, y: q.y };
      };
      const endTanSite = (el: SVGPathElement): Pt | null => {
        const len = el.getTotalLength();
        if (len <= 0) return null;
        const eps = Math.min(4, len / 4);
        const a = toSiteSpace(el, len - eps);
        const b = toSiteSpace(el, len);
        return a && b ? norm(sub(b, a)) : null;
      };
      const startTanSite = (el: SVGPathElement): Pt | null => {
        const len = el.getTotalLength();
        if (len <= 0) return null;
        const eps = Math.min(4, len / 4);
        const a = toSiteSpace(el, 0);
        const b = toSiteSpace(el, eps);
        return a && b ? norm(sub(b, a)) : null;
      };
      const chainMismatch = { value: 0 };
      const chainPair = (a: SVGPathElement, b: SVGPathElement) => {
        const ta = endTanSite(a), tb = startTanSite(b);
        if (ta && tb) chainMismatch.value = Math.max(chainMismatch.value, angleBetween(ta, tb));
      };
      const stagePathsInOrder = (slug: string, order: [string, number][]): SVGPathElement[] => {
        const stage = document.querySelector<HTMLElement>(`[data-project-slug="${slug}"]`)!;
        const byLayer = (layer: string) => [...stage.querySelectorAll<SVGPathElement>(`svg[data-variant="${isMobile ? "mobile" : "desktop"}"][data-layer="thread-${layer}"] .project-thread-path`)];
        const fronts = byLayer("front"), backs = byLayer("back");
        return order.map(([layer, i]) => (layer === "front" ? fronts[i] : backs[i])!).filter(Boolean);
      };
      const e2eePaths = stagePathsInOrder("fb-messenger-e2ee", isMobile
        ? [["front", 0], ["back", 0], ["front", 1], ["front", 2]]
        : [["front", 0], ["back", 0], ["front", 1], ["back", 1], ["front", 2]]);
      const sheetPaths = stagePathsInOrder("sky-sheet-store", [["front", 0], ["back", 0], ["front", 1], ["front", 2], ["front", 3]]);
      const pianoPaths = stagePathsInOrder("sky-auto-piano", [["front", 0], ["back", 0], ["front", 1]]);
      const connectorPaths = [...document.querySelectorAll<SVGPathElement>("[data-project-connector]")];
      const chainEls = [sitePaths[2]!, sitePaths[3]!, ...e2eePaths, connectorPaths[0]!, ...sheetPaths, connectorPaths[1]!, ...pianoPaths, connectorPaths[2]!, sitePaths[4]!, sitePaths[5]!]
        .filter((el): el is SVGPathElement => Boolean(el));
      const sheetDescent = sheetPaths[sheetPaths.length - 2]!;
      const sheetExit = sheetPaths[sheetPaths.length - 1]!;
      for (let i = 0; i < chainEls.length - 1; i++) {
        const a = chainEls[i]!, b = chainEls[i + 1]!;
        // Documented exception (round 11): the Sheet descent ends
        // heading straight down into key 14 and the exit leaves
        // horizontally — a deliberate 90deg touch-point turn, not a kink.
        if (a === sheetDescent && b === sheetExit) continue;
        chainPair(a, b);
      }
      // Site-1 end vs site-2 start meet at (edge, expTop) with the exp
      // headline trace travelling between them (hidden); the geometric
      // joint still holds.
      chainPair(sitePaths[1]!, sitePaths[2]!);

      // Stage paths: internal joints and per-cubic min radius, measured
      // in viewBox units (every path of one scene shares its viewBox, so
      // consecutive paths are directly comparable there). The Sheet
      // connector -> melody joint is reported separately: B's -4.6deg /
      // -3.7deg are the ABSOLUTE end tangents, not the mismatch — the
      // melody departs at the same angle, so the joint itself is ~0deg.
      let maxStageJointMismatch = 0;
      let minStageRadius: number | null = null;
      let sheetConnectorMelody = 0;
      const checkStagePaths = (paths: SVGPathElement[], slug: string) => {
        const cmdsList = paths.map((p) => parseD(p.getAttribute("d") || ""));
        cmdsList.forEach((cmds) => {
          for (let i = 1; i < cmds.length; i++) {
            const prev = cmds[i - 1]!, cur = cmds[i]!;
            if (prev.cmd === "M") continue;
            maxStageJointMismatch = Math.max(maxStageJointMismatch, angleBetween(endTangent(prev), startTangent(cur)));
          }
          cmds.filter((c) => c.cmd === "C").forEach((c) => {
            const k = maxCurvature(c);
            if (k > 0) minStageRadius = minStageRadius === null ? 1 / k : Math.min(minStageRadius, 1 / k);
          });
        });
        for (let i = 0; i < paths.length - 1; i++) {
          const a = cmdsList[i]!, b = cmdsList[i + 1]!;
          // The 90deg touch-point turn, same exception as above.
          if (slug === "sky-sheet-store" && i === paths.length - 2) continue;
          const mismatch = angleBetween(endTangent(a[a.length - 1]!), startTangent(b.find((c) => c.cmd !== "M")!));
          maxStageJointMismatch = Math.max(maxStageJointMismatch, mismatch);
          if (slug === "sky-sheet-store" && i === 1) sheetConnectorMelody = mismatch;
        }
      };
      checkStagePaths(e2eePaths, "fb-messenger-e2ee");
      checkStagePaths(sheetPaths, "sky-sheet-store");
      checkStagePaths(pianoPaths, "sky-auto-piano");

      // Project connectors (C1-C3): internal joints + per-cubic min
      // radius, in site space.
      let minConnectorRadius: number | null = null;
      connectorPaths.forEach((p) => {
        const cmds = parseD(p.getAttribute("d") || "");
        for (let i = 1; i < cmds.length; i++) {
          const prev = cmds[i - 1]!, cur = cmds[i]!;
          if (prev.cmd === "M") continue;
          maxJointMismatch.value = Math.max(maxJointMismatch.value, angleBetween(endTangent(prev), startTangent(cur)));
        }
        cmds.filter((c) => c.cmd === "C").forEach((c) => {
          const k = maxCurvature(c);
          if (k > 0) minConnectorRadius = minConnectorRadius === null ? 1 / k : Math.min(minConnectorRadius, 1 / k);
        });
      });

      // Hero exit -> handoff start. getTotalLength() returns real user
      // units (pathLength="1" does not rescale it), so the end tangent is
      // sampled over the last 4 absolute px, with no wrap (open path).
      const heroExit = document.querySelector<SVGPathElement>(
        isMobile ? "[data-thread-segment-mobile='2']" : "[data-thread-segment='2']",
      )!;
      const heroLen = heroExit.getTotalLength();
      const heroA = toSiteSpace(heroExit, heroLen - 4)!;
      const heroB = toSiteSpace(heroExit, heroLen)!;
      const heroExitTan = norm(sub(heroB, heroA));
      const handoffFirst = siteCmds[0]!.find((c) => c.cmd !== "M")!;
      maxJointMismatch.value = Math.max(
        maxJointMismatch.value,
        angleBetween(heroExitTan, startTangent(handoffFirst)),
      );

      // Handoff end -> connector start.
      const s0End = siteCmds[0]![siteCmds[0]!.length - 1]!;
      const s6First = siteCmds[6]!.find((c) => c.cmd !== "M")!;
      maxJointMismatch.value = Math.max(
        maxJointMismatch.value,
        angleBetween(endTangent(s0End), startTangent(s6First)),
      );

      // Glyph connectors: depart along the from-contour arrival tangent,
      // arrive along the to-contour departure tangent.
      let maxConnectorMismatch = 0;
      const connectors = [...document.querySelectorAll<SVGPathElement>("[data-glyph-connector]")];
      for (const conn of connectors) {
        const fromKey = conn.getAttribute("data-from-glyph")!;
        const toKey = conn.getAttribute("data-to-glyph")!;
        const connCmds = parseD(conn.getAttribute("d") || "");
        const connFirst = connCmds.find((c) => c.cmd !== "M")!;
        const connLast = connCmds[connCmds.length - 1]!;
        const contourTangentAt = (key: string, pt: Pt, forward: boolean): Pt => {
          const contour = document.querySelector<SVGPathElement>(
            `path[data-glyph-key='${key}'][data-glyph-contour='0'], path[data-exp-glyph-key='${key}'][data-exp-glyph-contour='0']`,
          )!;
          const len = contour.getTotalLength();
          // Closest sample to the junction point, in site space.
          let bestD = 0;
          let bestDist = Number.POSITIVE_INFINITY;
          for (let s = 0; s <= len; s += len / 240) {
            const q = toSiteSpace(contour, s)!;
            const dist = Math.hypot(q.x - pt.x, q.y - pt.y);
            if (dist < bestDist) {
              bestDist = dist;
              bestD = s;
            }
          }
          const eps = Math.min(12, len / 4);
          const at = forward ? bestD : (bestD - eps + len) % len;
          const to = forward ? (bestD + eps) % len : bestD;
          const a = toSiteSpace(contour, at)!;
          const b = toSiteSpace(contour, to)!;
          return norm(sub(b, a));
        };
        const fromPt = connCmds[0]!.p;
        const toPt = connLast.p;
        maxConnectorMismatch = Math.max(
          maxConnectorMismatch,
          angleBetween(contourTangentAt(fromKey, fromPt, false), startTangent(connFirst)),
          angleBetween(contourTangentAt(toKey, toPt, true), endTangent(connLast)),
        );
      }

      // Site-5 (contact approach) must stay on-canvas.
      let site5MinX = Number.POSITIVE_INFINITY;
      {
        const s5 = sitePaths[5]!;
        const len = s5.getTotalLength();
        for (let s = 0; s <= len; s += 2) {
          site5MinX = Math.min(site5MinX, s5.getPointAtLength(s).x);
        }
      }

      // Site-1 exit must stay clear of the About statement and profile
      // TEXT (the drop runs through the statement box's empty channel, so
      // the box itself is not the guard; the node is display:none on
      // mobile and is skipped there).
      const distToBox = (p: Pt, b: { left: number; right: number; top: number; bottom: number }) => {
        const dx = Math.max(b.left - p.x, 0, p.x - b.right);
        const dy = Math.max(b.top - p.y, 0, p.y - b.bottom);
        return Math.hypot(dx, dy);
      };
      const minDistPathToBox = (path: SVGPathElement, box: { left: number; right: number; top: number; bottom: number } | null) => {
        if (!box) return null;
        const len = path.getTotalLength();
        let min = Number.POSITIVE_INFINITY;
        for (let s = 0; s <= len; s += 2) {
          min = Math.min(min, distToBox(path.getPointAtLength(s), box));
        }
        return min;
      };
      const rectOf = (sel: string) => {
        const el = document.querySelector(sel)!;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return null;
        return { left: r.left, right: r.right, top: r.top + scrollY, bottom: r.bottom + scrollY };
      };
      const site1Clearance = {
        stmtP1: minDistPathToBox(sitePaths[1]!, rectOf(".about__statement > p:first-child")),
        note: minDistPathToBox(sitePaths[1]!, rectOf(".about__note")),
        node: minDistPathToBox(sitePaths[1]!, rectOf(".about__node")),
        lead: minDistPathToBox(sitePaths[1]!, rectOf(".about__lead")),
        copy: minDistPathToBox(sitePaths[1]!, rectOf(".about__copy")),
      };

      return {
        maxJointMismatch: Math.round(maxJointMismatch.value * 10) / 10,
        maxConnectorMismatch: Math.round(maxConnectorMismatch * 10) / 10,
        minRadius: minRadius.map((r) => (r === null ? null : Math.round(r * 10) / 10)),
        site5MinX: Math.round(site5MinX * 10) / 10,
        site1Clearance: Object.fromEntries(
          Object.entries(site1Clearance).map(([k, v]) => [k, v === null ? null : Math.round(v * 10) / 10]),
        ),
        chainLength: chainEls.length,
        maxChainJointMismatch: Math.round(chainMismatch.value * 10) / 10,
        maxStageJointMismatch: Math.round(maxStageJointMismatch * 10) / 10,
        sheetConnectorMelody: Math.round(sheetConnectorMelody * 10) / 10,
        minStageRadius: minStageRadius === null ? null : Math.round(minStageRadius * 10) / 10,
        minConnectorRadius: minConnectorRadius === null ? null : Math.round(minConnectorRadius * 10) / 10,
      };
    });

    expect(geom.maxJointMismatch, `worst joint mismatch at ${vp.width}px`).toBeLessThanOrEqual(2);
    expect(geom.maxConnectorMismatch, `worst connector mismatch at ${vp.width}px`).toBeLessThanOrEqual(2);
    // The chain is complete: site-2 + C0 + stage paths + C1 + stage paths
    // + C2 + stage paths + C3 + site-4 + site-5 (20 desktop, 19 mobile -
    // the mobile E2EE corridor has one fewer path).
    expect(geom.chainLength, `project chain length at ${vp.width}px`).toBe(vp.width <= 700 ? 19 : 20);
    expect(geom.maxChainJointMismatch, `worst chain joint mismatch at ${vp.width}px`).toBeLessThanOrEqual(2);
    expect(geom.maxStageJointMismatch, `worst stage joint mismatch at ${vp.width}px`).toBeLessThanOrEqual(2);
    // Re-measured round 12: B reported the Sheet connector -> melody
    // joint as -4.6deg desktop / -3.7deg mobile, but those are the
    // absolute end tangents; the melody departs at the same angle, so the
    // joint mismatch itself is ~0deg. The geometry needed no fix; the
    // measurement did.
    expect(geom.sheetConnectorMelody, `Sheet connector -> melody joint at ${vp.width}px`).toBeLessThanOrEqual(2);
    expect(geom.minStageRadius, `stage min radius at ${vp.width}px`).not.toBeNull();
    expect(geom.minStageRadius!, `stage min radius at ${vp.width}px`).toBeGreaterThanOrEqual(5);
    expect(geom.minConnectorRadius, `connector min radius at ${vp.width}px`).not.toBeNull();
    expect(geom.minConnectorRadius!, `connector min radius at ${vp.width}px`).toBeGreaterThanOrEqual(8);
    // Per-segment min radius: handoff 20, site-1 exit 5 (mobile jog
    // R=6.15, forced by the 12px gutter jog; a smooth quarter-turn
    // fillet, not a kink), site-3 C0 connector 10 (desktop R=60 turn,
    // mobile R=16 jog), site-6 4 (tiny mobile rise), contact approach
    // 20. Site-2/4 are straight runs (null); any cubic there must still
    // be >= 20.
    const radiusFloor = [20, 5, 20, 10, 20, 20, 4];
    geom.minRadius.forEach((r, i) => {
      if (r !== null) expect(r, `site-${i} min radius at ${vp.width}px`).toBeGreaterThanOrEqual(radiusFloor[i]!);
    });
    expect(geom.site5MinX, `site-5 min x at ${vp.width}px`).toBeGreaterThanOrEqual(0);
    for (const [key, value] of Object.entries(geom.site1Clearance)) {
      if (value !== null) expect(value, `site-1 ${key} clearance at ${vp.width}px`).toBeGreaterThanOrEqual(10);
    }
  }
});

test("round 12: glyph exit descends straight and Experience headline is traced", async ({ page }) => {
  // Guards the round-12 site-thread work: the site-1 exit leaves the last
  // About glyph junction heading straight down (G1 along the contour
  // arrival tangent, vertical first drop), the Experience headline
  // letters MEETS INFRASTRUCTURE. are traced on their outlines
  // (transform alignment in the revealed state), the exp trace completes
  // at full Experience scroll, and the exp connectors never cut the
  // solid title lines above them ("WORKING WHERE IDENTITY").
  const viewports = [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() =>
      [...document.querySelectorAll<SVGPathElement>("[data-site-thread-segment]")].reduce(
        (t, p) => t + p.getTotalLength(),
        0,
      ) > 1000,
    );
    // Measure in the REVEALED state: reveal tweens shift the Experience
    // heading (+34px) on mobile until it plays, and the thread is built
    // in final layout coordinates.
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      document.querySelector("#experience-title")!.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(2500);

    const geom = await page.evaluate(() => {
      type Pt = { x: number; y: number };
      const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
      const norm = (v: Pt): Pt => {
        const l = Math.hypot(v.x, v.y) || 1;
        return { x: v.x / l, y: v.y / l };
      };
      const angleBetween = (a: Pt, b: Pt) =>
        (Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y))) * 180) / Math.PI;

      // Exp contour transform alignment (same method as the About test).
      const errors: number[] = [];
      [...document.querySelectorAll<SVGPathElement>("[data-exp-glyph-contour]")].forEach((path) => {
        const key = path.dataset.expGlyphKey!;
        const target = document.querySelector<HTMLElement>(`#experience-title .heading__glyph[data-heading-glyph-key='${key}']`)!;
        const wordIndex = key.split("-")[1];
        const baseline = document.querySelector<HTMLElement>(`#experience-title [data-heading-glyph-baseline='${wordIndex}']`)!;
        const match = path.getAttribute("transform")?.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/);
        if (!match) {
          errors.push(Number.POSITIVE_INFINITY);
          return;
        }
        errors.push(Math.abs(Number(match[1]) - (target.getBoundingClientRect().left + scrollX)));
        errors.push(Math.abs(Number(match[2]) - (baseline.getBoundingClientRect().top + scrollY)));
        errors.push(Math.abs(Number(match[3]) - Number.parseFloat(getComputedStyle(target).fontSize) / 1000));
      });

      // Site-1 exit departure: first segment vs the one-sided FORWARD
      // tangent of the last-glyph contour at the exit junction. The
      // junction is a sharp corner, so the closest sample is snapped to
      // the nearest path vertex first: an eps chord straddling the corner
      // reads diagonal (90deg). The last traced glyph depends on the
      // rendered line count ("." on 2-line layouts, "U" on the 1-line
      // 1280 layout), so the contour is found by proximity, not by key.
      const site1 = document.querySelector<SVGPathElement>("[data-site-thread-segment='1']")!;
      const siteSvg = site1.ownerSVGElement!;
      const toSiteSpace = (el: SVGPathElement, distance: number): Pt | null => {
        const pt = el.getPointAtLength(distance);
        const pathMatrix = el.getScreenCTM();
        const siteMatrix = siteSvg.getScreenCTM();
        if (!pathMatrix || !siteMatrix) return null;
        const q = new DOMPoint(pt.x, pt.y).matrixTransform(pathMatrix).matrixTransform(siteMatrix.inverse());
        return { x: q.x, y: q.y };
      };
      const parseD = (d: string) => {
        const tokens = d.match(/[MLC]|[-+]?\d*\.?\d+/g) || [];
        const cmds: { cmd: string; from: Pt; c1?: Pt; c2?: Pt; p: Pt }[] = [];
        let i = 0;
        let cmd = "";
        let cur: Pt = { x: 0, y: 0 };
        while (i < tokens.length) {
          const t = tokens[i]!;
          if (t === "M" || t === "L" || t === "C") {
            cmd = t;
            i++;
            continue;
          }
          const x = Number.parseFloat(tokens[i]!);
          const y = Number.parseFloat(tokens[i + 1]!);
          i += 2;
          if (cmd === "M") {
            cur = { x, y };
            cmds.push({ cmd: "M", from: cur, p: { x, y } });
            cmd = "L";
          } else if (cmd === "L") {
            cmds.push({ cmd: "L", from: cur, p: { x, y } });
            cur = { x, y };
          } else if (cmd === "C") {
            const c1 = { x, y };
            const c2 = { x: Number.parseFloat(tokens[i]!), y: Number.parseFloat(tokens[i + 1]!) };
            const p = { x: Number.parseFloat(tokens[i + 2]!), y: Number.parseFloat(tokens[i + 3]!) };
            i += 4;
            cmds.push({ cmd: "C", from: cur, c1, c2, p });
            cur = p;
          }
        }
        return cmds;
      };
      const site1Cmds = parseD(site1.getAttribute("d") || "");
      const junction = site1Cmds[0]!.p;
      const first = site1Cmds.find((c) => c.cmd !== "M")!;
      const departTan = first.cmd === "L" ? norm(sub(first.p, first.from)) : norm(sub(first.c1!, first.from));
      const dropDx = first.cmd === "L" ? Math.abs(first.p.x - first.from.x) : null;
      let exitDepartMismatch = Number.POSITIVE_INFINITY;
      {
        let lastGlyphKey: string | null = null;
        let bestKeyDist = Number.POSITIVE_INFINITY;
        for (const p of document.querySelectorAll<SVGPathElement>("[data-glyph-thread] path[data-glyph-key]")) {
          const len = p.getTotalLength();
          for (let s = 0; s <= len; s += len / 60) {
            const q = toSiteSpace(p, s)!;
            const dd = Math.hypot(q.x - junction.x, q.y - junction.y);
            if (dd < bestKeyDist) {
              bestKeyDist = dd;
              lastGlyphKey = p.getAttribute("data-glyph-key");
            }
          }
        }
        const dot = document.querySelector<SVGPathElement>(
          `path[data-glyph-key='${lastGlyphKey}'][data-glyph-contour='0']`,
        )!;
        const dotLen = dot.getTotalLength();
        let bestD = 0;
        let bestDist = Number.POSITIVE_INFINITY;
        for (let s = 0; s <= dotLen; s += dotLen / 240) {
          const q = toSiteSpace(dot, s)!;
          const dd = Math.hypot(q.x - junction.x, q.y - junction.y);
          if (dd < bestDist) {
            bestDist = dd;
            bestD = s;
          }
        }
        // Vertex distances along the contour (endpoints of each command;
        // Q segments sampled so the cumulative length stays accurate).
        const dotCmds = parseD(dot.getAttribute("d") || "");
        const verts = [0];
        {
          let acc = 0;
          let prev: Pt | null = null;
          for (const c of dotCmds) {
            if (c.cmd === "M") {
              prev = c.p;
              continue;
            }
            if (c.cmd === "L") {
              acc += Math.hypot(c.p.x - prev!.x, c.p.y - prev!.y);
            } else {
              let qprev = prev!;
              for (let k = 1; k <= 20; k++) {
                const t = k / 20;
                const mt = 1 - t;
                const q = {
                  x: mt * mt * prev!.x + 2 * mt * t * c.c1!.x + t * t * c.p.x,
                  y: mt * mt * prev!.y + 2 * mt * t * c.c1!.y + t * t * c.p.y,
                };
                acc += Math.hypot(q.x - qprev.x, q.y - qprev.y);
                qprev = q;
              }
            }
            verts.push(acc);
            prev = c.p;
          }
        }
        const snapD = verts.reduce((a, b) => (Math.abs(b - bestD) < Math.abs(a - bestD) ? b : a), verts[0]!);
        const eps = Math.min(12, dotLen / 4);
        const depA = toSiteSpace(dot, snapD)!;
        const depB = toSiteSpace(dot, (snapD + eps) % dotLen)!;
        exitDepartMismatch = angleBetween(norm(sub(depB, depA)), departTan);
      }

      // Exp connectors must clear the solid title lines above them.
      const title = document.querySelector("#experience-title")!;
      const range = document.createRange();
      const textNode = [...title.childNodes].find((n) => n.nodeType === 3);
      const solidBoxes: { left: number; right: number; top: number; bottom: number }[] = [];
      if (textNode) {
        const full = textNode.textContent || "";
        const i0 = full.indexOf("Working where identity");
        if (i0 >= 0) {
          range.setStart(textNode, i0);
          range.setEnd(textNode, i0 + "Working where identity".length);
          for (const r of range.getClientRects()) {
            solidBoxes.push({ left: r.left, right: r.right, top: r.top + scrollY, bottom: r.bottom + scrollY });
          }
        }
      }
      let minSolid = Number.POSITIVE_INFINITY;
      for (const conn of document.querySelectorAll<SVGPathElement>(
        "[data-glyph-connector][data-from-glyph^='exp-']",
      )) {
        const len = conn.getTotalLength();
        for (let s = 0; s <= len; s += 2) {
          const q = toSiteSpace(conn, s)!;
          for (const b of solidBoxes) {
            const dx = Math.max(b.left - q.x, 0, q.x - b.right);
            const dy = Math.max(b.top - q.y, 0, q.y - b.bottom);
            minSolid = Math.min(minSolid, Math.hypot(dx, dy));
          }
        }
      }

      return {
        maxExpAlignError: Math.max(...errors),
        expContourCount: document.querySelectorAll("[data-exp-glyph-contour]").length,
        expGlyphCount: document.querySelectorAll("#experience-title .heading__glyph").length,
        expConnectorCount: document.querySelectorAll("[data-glyph-connector][data-from-glyph^='exp-']").length,
        exitDepartMismatch: Math.round(exitDepartMismatch * 10) / 10,
        dropDx: dropDx === null ? null : Math.round(dropDx * 10) / 10,
        expConnectorSolidClearance: minSolid === Number.POSITIVE_INFINITY ? null : Math.round(minSolid * 10) / 10,
      };
    });

    expect(geom.expGlyphCount, `exp glyph spans at ${vp.width}px`).toBe(20);
    expect(geom.expContourCount, `exp contours at ${vp.width}px`).toBe(24);
    expect(geom.expConnectorCount, `exp connectors at ${vp.width}px`).toBe(3);
    expect(geom.maxExpAlignError, `exp alignment error at ${vp.width}px`).toBeLessThan(0.001);
    expect(geom.exitDepartMismatch, `site-1 exit departure at ${vp.width}px`).toBeLessThanOrEqual(2);
    if (geom.dropDx !== null) expect(geom.dropDx, `site-1 drop verticality at ${vp.width}px`).toBeLessThanOrEqual(0.01);
    expect(geom.expConnectorSolidClearance, `exp connector solid clearance at ${vp.width}px`).not.toBeNull();
    expect(geom.expConnectorSolidClearance!, `exp connector solid clearance at ${vp.width}px`).toBeGreaterThanOrEqual(10);

    // Scroll through Experience: all 24 exp contours must complete.
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, document.querySelector("#projects")!.getBoundingClientRect().top + scrollY - 100);
    });
    await page.waitForFunction(() =>
      [...document.querySelectorAll<SVGPathElement>("[data-exp-glyph-contour]")].every(
        (p) => p.style.strokeDasharray === "none",
      ),
    );
    const completion = await page.evaluate(() => ({
      total: document.querySelectorAll("[data-exp-glyph-contour]").length,
      done: [...document.querySelectorAll<SVGPathElement>("[data-exp-glyph-contour]")].filter(
        (p) => p.style.strokeDasharray === "none",
      ).length,
    }));
    expect(completion.total, `exp contours at ${vp.width}px`).toBe(24);
    expect(completion.done, `exp trace completion at ${vp.width}px`).toBe(24);
  }
});

test("round 12.1: headline traces complete while framed, connectors paint, key-14 joint is smooth", async ({ page }) => {
  // Guards the round-12.1 fixes: (Bug 1) the Experience trace completes
  // while the headline is still framed; (Bug 2/4) the C1/C2/C3
  // connectors actually paint (computed stroke, not "none") and draw
  // over a real scroll span instead of popping in over 1px; (Bug 3)
  // the Sheet key-14 joint is a quarter-turn fillet, not a 90deg kink;
  // (Bugs 5-7) the Projects/Skills/Contact headlines are traced on
  // their outlines (true span/contour counts) and complete while framed.
  // NOTE on the Skills count: the task text says 13/13 letters, but the
  // true count is 15 spans / 16 contours ("USED WITH INTENT." is 17
  // chars incl. spaces, 15 non-space letters; D has 2 contours).
  const viewports = [
    { width: 1920, height: 925 },
    { width: 1440, height: 900 },
  ];
  const headlines = [
    {
      id: "exp", heading: "#experience-title", keyPrefix: "exp-",
      contourAttr: "data-exp-glyph-key", contourDataset: "expGlyphKey",
      contourCountAttr: "data-exp-glyph-contour",
      spans: 20, contours: 24,
    },
    {
      id: "proj", heading: "#projects-title", keyPrefix: "proj-",
      contourAttr: "data-proj-glyph-key", contourDataset: "projGlyphKey",
      contourCountAttr: "data-proj-glyph-contour",
      spans: 9, contours: 12,
    },
    {
      id: "skills", heading: "#skills-title", keyPrefix: "skills-",
      contourAttr: "data-skills-glyph-key", contourDataset: "skillsGlyphKey",
      contourCountAttr: "data-skills-glyph-contour",
      spans: 15, contours: 16,
    },
    {
      id: "contact", heading: "#contact-title", keyPrefix: "contact-",
      contourAttr: "data-contact-glyph-key", contourDataset: "contactGlyphKey",
      contourCountAttr: "data-contact-glyph-contour",
      spans: 17, contours: 24,
    },
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() =>
      [...document.querySelectorAll<SVGPathElement>("[data-site-thread-segment]")].reduce(
        (t, p) => t + p.getTotalLength(),
        0,
      ) > 1000,
    );
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
    });

    // Bug 2/4: the runtime-created connectors must actually paint.
    const paint = await page.evaluate(() => {
      const out: Record<string, { stroke: string; width: string; fill: string }> = {};
      for (const key of ["c1", "c2", "c3"]) {
        const el = document.querySelector<SVGPathElement>(`[data-project-connector='${key}']`)!;
        const cs = getComputedStyle(el);
        out[key] = { stroke: cs.stroke, width: cs.strokeWidth, fill: cs.fill };
      }
      return out;
    });
    for (const key of ["c1", "c2", "c3"]) {
      expect(paint[key]!.stroke, `${key} computed stroke at ${vp.width}x${vp.height}`).not.toBe("none");
      expect(paint[key]!.width, `${key} computed stroke width at ${vp.width}x${vp.height}`).toBe("2px");
      expect(paint[key]!.fill, `${key} computed fill at ${vp.width}x${vp.height}`).toBe("none");
    }

    // Bug 3: the Sheet key-14 joint is a quarter-turn fillet (G1), not a
    // 90deg kink. Front paths 2 (descent) and 3 (exit) of the desktop
    // front SVG must meet end-to-start, leave along the same tangent,
    // and turn through a 20-30 unit quarter-turn.
    const joint = await page.evaluate(() => {
      type Pt = { x: number; y: number };
      const paths = [...document.querySelectorAll<SVGPathElement>(
        `[data-project-slug="sky-sheet-store"] svg[data-variant="desktop"][data-layer="thread-front"] .project-thread-path`,
      )];
      const parseD = (d: string) => {
        const tokens = d.match(/[MLC]|[-+]?\d*\.?\d+/g) || [];
        const cmds: { cmd: string; from: Pt; c1?: Pt; c2?: Pt; p: Pt }[] = [];
        let i = 0;
        let cmd = "";
        let cur: Pt = { x: 0, y: 0 };
        while (i < tokens.length) {
          const t = tokens[i]!;
          if (t === "M" || t === "L" || t === "C") {
            cmd = t;
            i++;
            continue;
          }
          const x = Number.parseFloat(tokens[i]!);
          const y = Number.parseFloat(tokens[i + 1]!);
          i += 2;
          if (cmd === "M") {
            cur = { x, y };
            cmds.push({ cmd: "M", from: cur, p: { x, y } });
            cmd = "L";
          } else if (cmd === "L") {
            cmds.push({ cmd: "L", from: cur, p: { x, y } });
            cur = { x, y };
          } else if (cmd === "C") {
            const c1 = { x, y };
            const c2 = { x: Number.parseFloat(tokens[i]!), y: Number.parseFloat(tokens[i + 1]!) };
            const p = { x: Number.parseFloat(tokens[i + 2]!), y: Number.parseFloat(tokens[i + 3]!) };
            i += 4;
            cmds.push({ cmd: "C", from: cur, c1, c2, p });
            cur = p;
          }
        }
        return cmds;
      };
      const descent = parseD(paths[2]!.getAttribute("d") || "");
      const exit = parseD(paths[3]!.getAttribute("d") || "");
      const lastDescent = descent[descent.length - 1]!;
      const firstExit = exit.find((c) => c.cmd !== "M")!;
      const exitStart = exit[0]!.p;
      const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
      const norm = (v: Pt): Pt => {
        const l = Math.hypot(v.x, v.y) || 1;
        return { x: v.x / l, y: v.y / l };
      };
      const endTan = norm(sub(lastDescent.p, lastDescent.c2!));
      const startTan = norm(sub(firstExit.p, firstExit.from));
      const angle = (Math.acos(Math.max(-1, Math.min(1, endTan.x * startTan.x + endTan.y * startTan.y))) * 180) / Math.PI;
      return {
        continuous: Math.hypot(lastDescent.p.x - exitStart.x, lastDescent.p.y - exitStart.y),
        angleDeg: Math.round(angle * 10) / 10,
        turnRx: lastDescent.p.x - lastDescent.from.x,
        turnRy: lastDescent.p.y - lastDescent.from.y,
        approachVertical: Math.abs(lastDescent.c1!.x - lastDescent.from.x),
        departHorizontal: Math.abs(lastDescent.c2!.y - lastDescent.p.y),
      };
    });
    expect(joint.continuous, `key-14 joint continuity at ${vp.width}x${vp.height}`).toBeLessThanOrEqual(0.01);
    expect(joint.angleDeg, `key-14 joint angle at ${vp.width}x${vp.height}`).toBeLessThanOrEqual(2);
    expect(joint.turnRx, `key-14 fillet radius x at ${vp.width}x${vp.height}`).toBeGreaterThanOrEqual(20);
    expect(joint.turnRx, `key-14 fillet radius x at ${vp.width}x${vp.height}`).toBeLessThanOrEqual(30);
    expect(joint.turnRy, `key-14 fillet radius y at ${vp.width}x${vp.height}`).toBeGreaterThanOrEqual(20);
    expect(joint.turnRy, `key-14 fillet radius y at ${vp.width}x${vp.height}`).toBeLessThanOrEqual(30);
    expect(joint.approachVertical, `key-14 approach verticality at ${vp.width}x${vp.height}`).toBeLessThanOrEqual(0.01);
    expect(joint.departHorizontal, `key-14 departure horizontality at ${vp.width}x${vp.height}`).toBeLessThanOrEqual(0.01);

    // Bug 2/4: each connector must draw over a real scroll span
    // (at least 150px), not pop 0 to 1 in 1px. One sweep reads all
    // three dasharrays per step.
    const readConnectorProgress = () =>
      page.evaluate(() => {
        const out: Record<string, number> = {};
        for (const key of ["c1", "c2", "c3"]) {
          const el = document.querySelector<SVGPathElement>(`[data-project-connector='${key}']`)!;
          const dash = el.style.strokeDasharray;
          const len = el.getTotalLength();
          if (dash === "none") out[key] = 1;
          else if (!dash || dash.startsWith("0 ")) out[key] = 0;
          else out[key] = Math.min(1, Number.parseFloat(dash.split(" ")[0]!) / len);
        }
        return out;
      });
    const spans: Record<string, { start: number | null; end: number | null }> = {
      c1: { start: null, end: null },
      c2: { start: null, end: null },
      c3: { start: null, end: null },
    };
    for (let y = 3800; y <= 7200; y += 25) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(40);
      const prog = await readConnectorProgress();
      for (const key of ["c1", "c2", "c3"]) {
        const s = spans[key]!;
        if (s.start === null && prog[key]! > 0) s.start = y;
        if (s.start !== null && s.end === null && prog[key]! >= 1) s.end = y;
      }
    }
    for (const key of ["c1", "c2", "c3"]) {
      const s = spans[key]!;
      expect(s.start, `${key} draw start at ${vp.width}x${vp.height}`).not.toBeNull();
      expect(s.end, `${key} draw end at ${vp.width}x${vp.height}`).not.toBeNull();
      expect(s.end! - s.start!, `${key} draw span at ${vp.width}x${vp.height}`).toBeGreaterThanOrEqual(150);
    }

    // The sweep scrolled every section through the viewport, so all
    // reveals have played after one wait; alignment is measured in the
    // revealed state.
    await page.waitForTimeout(2500);

    for (const h of headlines) {
      // Counts, alignment (same method as the round-12 exp check, scoped
      // to this heading), and zero visible inter-letter connectors.
      const geom = await page.evaluate((hh) => {
        const errors: number[] = [];
        [...document.querySelectorAll<SVGPathElement>(`[${hh.contourCountAttr}]`)].forEach((path) => {
          const key = (path.dataset as Record<string, string | undefined>)[hh.contourDataset]!;
          const target = document.querySelector<HTMLElement>(
            `${hh.heading} .heading__glyph[data-heading-glyph-key='${key}']`,
          )!;
          const wordIndex = key.split("-")[1];
          const baseline = document.querySelector<HTMLElement>(
            `${hh.heading} [data-heading-glyph-baseline='${wordIndex}']`,
          )!;
          const match = path.getAttribute("transform")?.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/);
          if (!match) {
            errors.push(Number.POSITIVE_INFINITY);
            return;
          }
          errors.push(Math.abs(Number(match[1]) - (target.getBoundingClientRect().left + scrollX)));
          errors.push(Math.abs(Number(match[2]) - (baseline.getBoundingClientRect().top + scrollY)));
          errors.push(Math.abs(Number(match[3]) - Number.parseFloat(getComputedStyle(target).fontSize) / 1000));
        });
        return {
          maxAlignError: Math.max(...errors),
          contourCount: document.querySelectorAll(`[${hh.contourCountAttr}]`).length,
          spanCount: document.querySelectorAll(`${hh.heading} .heading__glyph`).length,
          connectorCount: document.querySelectorAll(
            `[data-glyph-connector][data-from-glyph^='${hh.keyPrefix}']`,
          ).length,
        };
      }, h);
      expect(geom.spanCount, `${h.id} glyph spans at ${vp.width}x${vp.height}`).toBe(h.spans);
      expect(geom.contourCount, `${h.id} contours at ${vp.width}x${vp.height}`).toBe(h.contours);
      expect(geom.connectorCount, `${h.id} visible connectors at ${vp.width}x${vp.height}`).toBe(0);
      expect(geom.maxAlignError, `${h.id} alignment error at ${vp.width}x${vp.height}`).toBeLessThan(0.001);

      // Bugs 1, 5-7: the trace must complete while the headline is
      // still framed (headline top still inside the viewport).
      const headingTop = await page.evaluate(
        (sel) => document.querySelector<HTMLElement>(sel)!.getBoundingClientRect().top + scrollY,
        h.heading,
      );
      let completedWhileFramed = false;
      let doneAtEnd = 0;
      for (let y = Math.max(0, Math.floor(headingTop - vp.height + 100)); y <= headingTop + 300; y += 100) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(40);
        const state = await page.evaluate((hh) => ({
          done: [...document.querySelectorAll<SVGPathElement>(`[${hh.contourCountAttr}]`)].filter(
            (p) => p.style.strokeDasharray === "none",
          ).length,
          total: document.querySelectorAll(`[${hh.contourCountAttr}]`).length,
          headingTopViewport: document.querySelector<HTMLElement>(hh.heading)!.getBoundingClientRect().top,
        }), h);
        doneAtEnd = state.done;
        if (state.done === state.total && state.headingTopViewport > 0) {
          completedWhileFramed = true;
          break;
        }
      }
      expect(completedWhileFramed, `${h.id} trace completes while framed at ${vp.width}x${vp.height}`).toBe(true);
      expect(doneAtEnd, `${h.id} trace completion at ${vp.width}x${vp.height}`).toBe(h.contours);
    }
  }
});

test("bug 8: headline glyph contours draw progressively and the head dot rides the contour", async ({ page }) => {
  // Guards the Bug 8 fix: closed glyph contours used to be painted with
  // raw user-unit dashes under vector-effect: non-scaling-stroke, so the
  // dash saturated at progress ~scale (0.12 desktop) and every contour
  // flipped hidden -> fully red within 1-2px of scroll of its slice -
  // the whole headline flipped at once and the head dot had nowhere to
  // travel. The CTM-scaled dash makes the painted fraction equal the
  // scroll progress, so a fine sweep must observe several genuinely
  // partial states (never a dash overshoot past 1), and the head dot
  // must sit on the contour at the leading edge of the painted run.
  await page.setViewportSize({ width: 1920, height: 925 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    [...document.querySelectorAll<SVGPathElement>("[data-site-thread-segment]")].reduce(
      (t, p) => t + p.getTotalLength(),
      0,
    ) > 1000,
  );
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
  });

  const headingTop = await page.evaluate(
    () => document.querySelector<HTMLElement>("#experience-title")!.getBoundingClientRect().top + scrollY,
  );
  const y0 = Math.max(0, Math.floor(headingTop - 925 * 0.55));
  let partialCount = 0;
  let maxFrac = 0;
  let dotCapture: { dist: number; opacity: number } | null = null;
  for (let y = y0; y <= y0 + 400; y += 4) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(40);
    const read = await page.evaluate(() => {
      const path = document.querySelector<SVGPathElement>(
        "path[data-exp-glyph-key='exp-0-0'][data-exp-glyph-contour='0']",
      )!;
      const len = path.getTotalLength();
      const ctm = path.getScreenCTM();
      const scale = ctm ? Math.hypot(ctm.a, ctm.b) : 1;
      const dash = path.style.strokeDasharray;
      let frac: number;
      if (dash === "none") frac = 1;
      else if (!dash || dash.startsWith("0 ")) frac = 0;
      else frac = Number.parseFloat(dash.split(" ")[0]!) / (len * scale);
      let dot: { dist: number; opacity: number } | null = null;
      if (frac >= 0.3 && frac <= 0.7) {
        // Junction for M is its topmost point (no transition anchors
        // apply to M -> E): sample the contour like findJunction does.
        let startD = 0;
        let bestY = Number.POSITIVE_INFINITY;
        for (let s = 0; s <= len; s += len / 240) {
          const pt = path.getPointAtLength(s);
          if (pt.y < bestY) {
            bestY = pt.y;
            startD = s;
          }
        }
        const siteSvg = document.querySelector<SVGSVGElement>("[data-site-thread]")!;
        const toSiteSpace = (distance: number) => {
          const pt = path.getPointAtLength(distance);
          const pathMatrix = path.getScreenCTM();
          const siteMatrix = siteSvg.getScreenCTM();
          if (!pathMatrix || !siteMatrix) return null;
          const q = new DOMPoint(pt.x, pt.y).matrixTransform(pathMatrix).matrixTransform(siteMatrix.inverse());
          return { x: q.x, y: q.y };
        };
        const expected = toSiteSpace((startD + len * frac) % len);
        const dotEl = document.querySelector<SVGCircleElement>("[data-glyph-thread-end]")!;
        const dx = Number(dotEl.getAttribute("cx"));
        const dy = Number(dotEl.getAttribute("cy"));
        const opacity = Number.parseFloat(getComputedStyle(dotEl).opacity);
        if (expected) dot = { dist: Math.hypot(dx - expected.x, dy - expected.y), opacity };
      }
      return { frac, dot };
    });
    if (read.frac > 0.05 && read.frac < 0.95) partialCount++;
    if (read.frac > maxFrac) maxFrac = read.frac;
    if (!dotCapture && read.dot) dotCapture = read.dot;
  }
  // Before the fix the M contour showed zero partial states at 4px
  // steps (it saturated within ~2px of scroll) and the dash overshot to
  // ~2x the screen length; after the fix its ~17px slice yields
  // several partial states and the fraction never exceeds 1.
  expect(partialCount, "partially-drawn states for the M contour at 1920x925").toBeGreaterThanOrEqual(2);
  expect(maxFrac, "max painted fraction for the M contour at 1920x925").toBeLessThanOrEqual(1.05);
  expect(dotCapture, "head dot captured mid-draw at 1920x925").not.toBeNull();
  expect(dotCapture!.opacity, "head dot visible mid-draw at 1920x925").toBeGreaterThan(0.9);
  expect(dotCapture!.dist, "head dot distance from the contour leading edge at 1920x925").toBeLessThanOrEqual(6);
});

