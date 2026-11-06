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
      const end = segment === 6 ? path.getPointAtLength(length) : null;
      for (let distance = 0; distance <= length; distance += 4) {
        const point = path.getPointAtLength(distance);
        if (end && Math.hypot(point.x - end.x, point.y - end.y) < 24) continue;
        if (boxes.some((box) => point.x > box.left && point.x < box.right && point.y > box.top && point.y < box.bottom)) {
          hits.push({ segment, distance });
        }
      }
    }
    return hits;
  });

  expect(collisions).toEqual([]);
});

test("keeps each project motif inside its stage and off project content", async ({ page }) => {
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
      const svg = stage.querySelector<SVGSVGElement>(`svg[data-variant="${variant}"]`);
      const path = svg?.querySelector<SVGPathElement>(".project-thread-path");
      const article = stage.closest<HTMLElement>("article[data-project]");
      if (!svg || !path || !article) continue;
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

test("project visuals reach their final storyboard state at full scrub", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "html{scroll-behavior:auto !important}" });

  const scrollToP = async (slug: string, p: number) => {
    const { startY, endY } = await page.evaluate((s) => {
      const a = document.getElementById(s)!;
      const r = a.getBoundingClientRect();
      const vh = window.innerHeight;
      return {
        startY: Math.round(r.top + scrollY - vh * 0.8),
        endY: Math.round(r.bottom + scrollY - vh * 0.45),
      };
    }, slug);
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), Math.round(startY + (endY - startY) * p));
    await page.waitForTimeout(3000);
  };

  // E2EE mid: the Signal label is lit, Device B is still unreadable.
  await scrollToP("fb-messenger-e2ee", 0.5);
  const e2eeMid = await page.evaluate(() => {
    const stage = document.querySelector('[data-project-slug="fb-messenger-e2ee"]')!;
    const opacity = (name: string) => Number(getComputedStyle(stage.querySelector(`[data-el="${name}"]`)!).opacity);
    return { signal: opacity("e2ee-signal-label"), bubbleB: opacity("e2ee-bubble-b") };
  });
  expect(e2eeMid.signal).toBeGreaterThan(0.8);
  expect(e2eeMid.bubbleB).toBe(0);

  // E2EE final: Device B readable, final caption shown. Scroll 5% past the
  // trigger end (not 1%): each project article carries a motion entrance
  // tween (y: 22, data-reveal) that settles after the thread ScrollTrigger
  // measured its positions, so the trigger's cached end sits ~22px low and
  // p would otherwise stop at ~0.99 on mobile. The extra margin reaches
  // true p = 1; it does not loosen the assertions below.
  await scrollToP("fb-messenger-e2ee", 1.05);
  const e2eeFinal = await page.evaluate(() => {
    const stage = document.querySelector('[data-project-slug="fb-messenger-e2ee"]')!;
    const opacity = (name: string) => Number(getComputedStyle(stage.querySelector(`[data-el="${name}"]`)!).opacity);
    return { bubbleB: opacity("e2ee-bubble-b"), caption: opacity("e2ee-final-caption") };
  });
  expect(e2eeFinal.bubbleB).toBe(1);
  expect(e2eeFinal.caption).toBe(1);

  // Sheet Store final: practice view visible, last key (14) highlighted,
  // last timeline dot lit.
  await scrollToP("sky-sheet-store", 1.05);
  const sheetFinal = await page.evaluate(() => {
    const stage = document.querySelector('[data-project-slug="sky-sheet-store"]')!;
    // Two SVGs carry dots (desktop + mobile); only the active variant's
    // dots are driven, so check the visible one - `some` is exact here
    // because the hidden variant's dots are never lit.
    const dot7Lit = [...stage.querySelectorAll('[data-note="7"]')].some((dot) =>
      dot.classList.contains("is-lit"),
    );
    return {
      practice: Number(getComputedStyle(stage.querySelector('[data-scene="sheet-practice"]')!).opacity),
      key14: stage.querySelector('[data-key="14"]')!.classList.contains("is-lit"),
      dot7: dot7Lit,
    };
  });
  expect(sheetFinal.practice).toBe(1);
  expect(sheetFinal.key14).toBe(true);
  expect(sheetFinal.dot7).toBe(true);

  // Piano final: slider full, live time at the 12s total.
  await scrollToP("sky-auto-piano", 1.05);
  const pianoFinal = await page.evaluate(() => {
    const stage = document.querySelector('[data-project-slug="sky-auto-piano"]')!;
    return {
      slider: (stage.querySelector('[data-el="piano-slider-fill"]') as HTMLElement).style.width,
      time: stage.querySelector('[data-el="piano-live-time"]')!.textContent,
    };
  });
  expect(pianoFinal.slider).toBe("100%");
  expect(pianoFinal.time).toBe("0:12");
});

test("project motif threads keep clear of in-stage text and end on their target", async ({ page }) => {
  // Fix-round regression test (honest extension of the collision tests):
  // the Sheet Store detail loop grazed the stat values and a practice dot
  // sat on "2.96"; the Piano entry grazed the timeline label; the mobile
  // detail arc ended beside Share Sheet instead of at Open Player.
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "html{scroll-behavior:auto !important}" });

  const scrollToP = async (slug: string, p: number) => {
    const { startY, endY } = await page.evaluate((s) => {
      const a = document.getElementById(s)!;
      const r = a.getBoundingClientRect();
      const vh = window.innerHeight;
      return {
        startY: Math.round(r.top + scrollY - vh * 0.8),
        endY: Math.round(r.bottom + scrollY - vh * 0.45),
      };
    }, slug);
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), Math.round(startY + (endY - startY) * p));
    await page.waitForTimeout(3000);
  };

  // Min screen-px distance from a thread path's samples to each box matched
  // by `selector`, and how many samples fall inside the first box. The
  // active variant is the SVG whose display is not none.
  const pathClearance = (slug: string, thread: string, selector: string) =>
    page.evaluate(
      ({ s, t, sel }) => {
        const stage = document.querySelector(`[data-project-slug="${s}"]`)!;
        const svg = [...stage.querySelectorAll("svg.project-thread-svg")].find(
          (el) => getComputedStyle(el).display !== "none",
        )!;
        const path = svg.querySelector<SVGPathElement>(`[data-thread="${t}"]`)!;
        const boxes = [...stage.querySelectorAll(sel)].map((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        });
        const first = boxes[0]!;
        const ctm = path.getScreenCTM()!;
        const length = path.getTotalLength();
        let min = Number.POSITIVE_INFINITY;
        let inside = 0;
        for (let d = 0; d <= length; d += 2) {
          const pt = path.getPointAtLength(d);
          const sp = new DOMPoint(pt.x, pt.y).matrixTransform(ctm);
          for (const b of boxes) {
            const dx = Math.max(b.left - sp.x, 0, sp.x - b.right);
            const dy = Math.max(b.top - sp.y, 0, sp.y - b.bottom);
            min = Math.min(min, Math.hypot(dx, dy));
          }
          if (sp.x >= first.left && sp.x <= first.right && sp.y >= first.top && sp.y <= first.bottom) inside++;
        }
        return { min: Math.round(min * 10) / 10, inside };
      },
      { s: slug, t: thread, sel: selector },
    );

  // Sheet Store mid: the detail thread stays clear of every stat value,
  // and the practice dots are hidden until the practice view fades in.
  await scrollToP("sky-sheet-store", 0.5);
  const sheetMid = await pathClearance("sky-sheet-store", "detail", ".sheet-stat__value");
  expect(sheetMid.min).toBeGreaterThanOrEqual(20);
  const dotsHidden = await page.evaluate(() => {
    const stage = document.querySelector('[data-project-slug="sky-sheet-store"]')!;
    const svg = [...stage.querySelectorAll("svg.project-thread-svg")].find(
      (el) => getComputedStyle(el).display !== "none",
    )!;
    return [...svg.querySelectorAll("[data-note]")].every((dot) => getComputedStyle(dot).opacity === "0");
  });
  expect(dotsHidden).toBe(true);

  // Piano mid: the entry thread stays clear of the timeline label and never
  // crosses it.
  await scrollToP("sky-auto-piano", 0.5);
  const pianoMid = await pathClearance("sky-auto-piano", "entry", '[data-el="piano-timeline-label"]');
  expect(pianoMid.min).toBeGreaterThanOrEqual(6);
  expect(pianoMid.inside).toBe(0);

  // Sheet Store final: the practice thread starts exactly on the first
  // timeline note (no connector before the melody), and the detail thread
  // ends inside the Open Player button.
  await scrollToP("sky-sheet-store", 1.05);
  const sheetFinal = await page.evaluate(() => {
    const stage = document.querySelector('[data-project-slug="sky-sheet-store"]')!;
    const svg = [...stage.querySelectorAll("svg.project-thread-svg")].find(
      (el) => getComputedStyle(el).display !== "none",
    )!;
    const toScreen = (el: SVGGeometryElement, x: number, y: number) => {
      const p = new DOMPoint(x, y).matrixTransform(el.getScreenCTM()!);
      return { x: p.x, y: p.y };
    };
    const practice = svg.querySelector<SVGPathElement>('[data-thread="practice"]')!;
    const dot0 = svg.querySelector<SVGCircleElement>('[data-note="0"]')!;
    const start = practice.getPointAtLength(0);
    const startScreen = toScreen(practice, start.x, start.y);
    const dotScreen = toScreen(dot0, Number(dot0.getAttribute("cx")), Number(dot0.getAttribute("cy")));
    const startGap = Math.hypot(startScreen.x - dotScreen.x, startScreen.y - dotScreen.y);
    const detail = svg.querySelector<SVGPathElement>('[data-thread="detail"]')!;
    const end = detail.getPointAtLength(detail.getTotalLength());
    const endScreen = toScreen(detail, end.x, end.y);
    const op = stage.querySelector(".sheet-rail__primary")!.getBoundingClientRect();
    const endInPlayer =
      endScreen.x >= op.left && endScreen.x <= op.right && endScreen.y >= op.top && endScreen.y <= op.bottom;
    return { startGap: Math.round(startGap * 10) / 10, endInPlayer };
  });
  expect(sheetFinal.startGap).toBeLessThanOrEqual(2);
  expect(sheetFinal.endInPlayer).toBe(true);
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

    const connectors = [...document.querySelectorAll<SVGPathElement>("[data-glyph-connector]")];
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
