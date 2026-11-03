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
    for (const path of paths) {
      const length = path.getTotalLength();
      for (let distance = 0; distance <= length; distance += 4) {
        const point = path.getPointAtLength(distance);
        if (boxes.some((box) => point.x > box.left && point.x < box.right && point.y > box.top && point.y < box.bottom)) {
          hits.push(distance);
        }
      }
    }
    return hits;
  });

  expect(collisions).toEqual([]);
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
    return Number.parseFloat(path.style.strokeDashoffset || "0") >= path.getTotalLength() - 1;
  });

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForFunction(() => {
    const first = document.querySelector<SVGPathElement>("[data-site-thread-segment='0']")!;
    return Number.parseFloat(first.style.strokeDashoffset || "0") >= first.getTotalLength() - 1;
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

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

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

    const hiddenInfo = await page.evaluate(() => {
      const isMobile = window.innerWidth <= 700;
      const heroExit = document.querySelector<SVGPathElement>(
        isMobile ? "[data-thread-segment-mobile='2']" : "[data-thread-segment='2']",
      )!;
      const p = heroExit.getPointAtLength(heroExit.getTotalLength());
      const m = heroExit.getScreenCTM();
      const hero = document.getElementById("top") || document.querySelector(".hero");
      const heroH = hero ? hero.getBoundingClientRect().height : window.innerHeight;
      const heroEndY = m ? p.x * m.b + p.y * m.d + m.f + scrollY : heroH;
      const targetL = isMobile
        ? Math.min(42, Math.max(34, window.innerWidth * 0.09))
        : Math.min(60, Math.max(50, window.innerWidth * 0.04));
      const dx = isMobile ? -Math.round(targetL / 2.45) : Math.round(targetL / 2.45);
      const dy = Math.round(Math.abs(dx) * 2.18);
      const handoffBottom = heroEndY + dy;
      const header = document.querySelector<HTMLElement>("[data-site-header]");
      let headerH = 60;
      if (header) {
        const wasCompact = header.hasAttribute("data-compact");
        const prevTransition = header.style.transition;
        header.style.transition = "none";
        header.setAttribute("data-compact", "");
        headerH = header.offsetHeight;
        header.style.transition = prevTransition;
        if (!wasCompact) header.removeAttribute("data-compact");
      }
      const sOccluded = Math.ceil(handoffBottom - headerH);
      const firstGlyph = document.querySelector<HTMLElement>(".about__glyph");
      const firstY = firstGlyph ? firstGlyph.getBoundingClientRect().top + window.scrollY : heroH + 400;
      const sGlyphStart = Math.max(sOccluded + (isMobile ? 65 : 85), Math.round(firstY - window.innerHeight * 0.72));

      const midHidden = Math.round((sOccluded + sGlyphStart) / 2);
      window.scrollTo({ top: midHidden, behavior: "instant" });
      window.dispatchEvent(new Event("scroll"));

      const siteEnd = document.querySelector<SVGElement>("[data-site-thread-end]");
      const glyphEnd = document.querySelector<SVGElement>("[data-glyph-thread-end]");
      const handoff = document.querySelector<SVGPathElement>("[data-site-thread-segment='0']");
      const siteEndHidden = !siteEnd || getComputedStyle(siteEnd).opacity === "0" || getComputedStyle(siteEnd).visibility === "hidden";
      const glyphEndHidden = !glyphEnd || getComputedStyle(glyphEnd).opacity === "0" || getComputedStyle(glyphEnd).visibility === "hidden";
      const handoffHidden = !handoff || getComputedStyle(handoff).visibility === "hidden";

      return {
        sOccluded,
        sGlyphStart,
        midHidden,
        siteEndHidden,
        glyphEndHidden,
        handoffHidden,
      };
    });

    expect(hiddenInfo.sGlyphStart - hiddenInfo.sOccluded).toBeGreaterThan(0);
    expect(hiddenInfo.siteEndHidden).toBe(true);
    expect(hiddenInfo.glyphEndHidden).toBe(true);
    expect(hiddenInfo.handoffHidden).toBe(true);

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

      const header = document.querySelector<HTMLElement>("[data-site-header]");
      let headerH = 60;
      if (header) {
        const wasCompact = header.hasAttribute("data-compact");
        const prevTransition = header.style.transition;
        header.style.transition = "none";
        header.setAttribute("data-compact", "");
        headerH = header.offsetHeight;
        header.style.transition = prevTransition;
        if (!wasCompact) header.removeAttribute("data-compact");
      }

      const isMobile = window.innerWidth <= 700;
      const heroExit = document.querySelector<SVGPathElement>(
        isMobile ? "[data-thread-segment-mobile='2']" : "[data-thread-segment='2']",
      )!;
      const p = heroExit.getPointAtLength(heroExit.getTotalLength());
      const m = heroExit.getScreenCTM();
      const heroEndY = m ? p.x * m.b + p.y * m.d + m.f + scrollY : heroH;
      const targetL = isMobile
        ? Math.min(42, Math.max(34, window.innerWidth * 0.09))
        : Math.min(60, Math.max(50, window.innerWidth * 0.04));
      const dx = isMobile ? -Math.round(targetL / 2.45) : Math.round(targetL / 2.45);
      const dy = Math.round(Math.abs(dx) * 2.18);
      const handoffBottom = heroEndY + dy;
      const sOccluded = Math.ceil(handoffBottom - headerH);

      const firstGlyph = document.querySelector<HTMLElement>(isMobile ? ".about__glyph" : ".about__glyph");
      const firstY = firstGlyph ? firstGlyph.getBoundingClientRect().top + window.scrollY : heroH + 400;
      const sGlyphStart = Math.max(sOccluded + (isMobile ? 65 : 85), Math.round(firstY - window.innerHeight * 0.72));

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
        sOccluded,
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
      if (sample.phase === "handoff") {
        expect(sample.handoffVis).not.toBe("hidden");
      }
      if (sample.phase === "hidden") {
        expect(sample.handoffVis).toBe("hidden");
        expect(sample.siteEndVis).toBe(false);
        expect(sample.glyphEndVis).toBe(false);
      }
      if (sample.phase === "glyph") {
        expect(sample.handoffVis).toBe("hidden");
      }
    });

    expect(distinctPhases).toEqual(["hero", "handoff", "hidden", "glyph"]);

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

test("guarantees handoff is fully occluded before hiding", async ({ page }) => {
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

    const occlusionData = await page.evaluate(async () => {
      const isMobile = window.innerWidth <= 700;
      const heroExit = document.querySelector<SVGPathElement>(
        isMobile ? "[data-thread-segment-mobile='2']" : "[data-thread-segment='2']",
      )!;
      const p = heroExit.getPointAtLength(heroExit.getTotalLength());
      const m = heroExit.getScreenCTM();
      const hero = document.getElementById("top") || document.querySelector(".hero");
      const heroH = hero ? hero.getBoundingClientRect().height : window.innerHeight;
      const heroEndY = m ? p.x * m.b + p.y * m.d + m.f + scrollY : heroH;
      const targetL = isMobile
        ? Math.min(42, Math.max(34, window.innerWidth * 0.09))
        : Math.min(60, Math.max(50, window.innerWidth * 0.04));
      const dx = isMobile ? -Math.round(targetL / 2.45) : Math.round(targetL / 2.45);
      const dy = Math.round(Math.abs(dx) * 2.18);
      const handoffBottom = heroEndY + dy;

      const header = document.querySelector<HTMLElement>("[data-site-header]");
      let headerH = 60;
      if (header) {
        const wasCompact = header.hasAttribute("data-compact");
        const prevTransition = header.style.transition;
        header.style.transition = "none";
        header.setAttribute("data-compact", "");
        headerH = header.offsetHeight;
        header.style.transition = prevTransition;
        if (!wasCompact) header.removeAttribute("data-compact");
      }
      const sOccluded = Math.ceil(handoffBottom - headerH);

      const handoff = document.querySelector<SVGPathElement>("[data-site-thread-segment='0']")!;

      window.scrollTo({ top: sOccluded - 1, behavior: "instant" });
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => setTimeout(resolve, 250));

      const beforeVis = getComputedStyle(handoff).visibility;
      const handoffBoxBefore = handoff.getBoundingClientRect();
      const headerBoxBefore = header!.getBoundingClientRect();

      window.scrollTo({ top: sOccluded, behavior: "instant" });
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => setTimeout(resolve, 50));

      const atVis = getComputedStyle(handoff).visibility;
      const handoffBoxAt = handoff.getBoundingClientRect();
      const headerBoxAt = header!.getBoundingClientRect();

      return {
        sOccluded,
        headerH,
        beforeVis,
        handoffBottomBefore: handoffBoxBefore.bottom,
        headerBottomBefore: headerBoxBefore.bottom,
        atVis,
        handoffBottomAt: handoffBoxAt.bottom,
        headerBottomAt: headerBoxAt.bottom,
      };
    });

    expect(occlusionData.beforeVis).not.toBe("hidden");
    expect(occlusionData.handoffBottomBefore).toBeLessThanOrEqual(occlusionData.headerBottomBefore + 1.5);

    expect(occlusionData.atVis).toBe("hidden");
    expect(occlusionData.handoffBottomAt).toBeLessThanOrEqual(occlusionData.headerBottomAt + 0.5);
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
    const vis0 = getComputedStyle(p0).visibility;
    return {
      offset0,
      vis0,
    };
  });

  expect(initial.vis0).toBe("visible");
  expect(initial.offset0).toBeGreaterThan(0.01);
  expect(initial.offset0).toBeLessThan(0.99);

  await page.waitForTimeout(150);
  const afterWait = await page.evaluate(() => {
    const isMobile = window.innerWidth <= 700;
    const selector = isMobile ? "[data-thread-segment-mobile='0']" : "[data-thread-segment='0']";
    const p0 = document.querySelector<SVGPathElement>(selector)!;
    return parseFloat(p0.style.strokeDashoffset || getComputedStyle(p0).strokeDashoffset);
  });
  expect(afterWait).toBe(initial.offset0);

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
    return parseFloat(p0.style.strokeDashoffset || getComputedStyle(p0).strokeDashoffset);
  });
  expect(Math.abs(afterNav - initial.offset0)).toBeLessThan(0.001);

  // 4. Reload page to confirm initial deterministic state
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);

  const afterReload = await page.evaluate(() => {
    const isMobile = window.innerWidth <= 700;
    const selector = isMobile ? "[data-thread-segment-mobile='0']" : "[data-thread-segment='0']";
    const p0 = document.querySelector<SVGPathElement>(selector)!;
    return parseFloat(p0.style.strokeDashoffset || getComputedStyle(p0).strokeDashoffset);
  });
  expect(Math.abs(afterReload - initial.offset0)).toBeLessThan(0.001);
});
