import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
  await page.goto("/");
  await page.waitForFunction(() =>
    document.querySelectorAll("[data-glyph-connector]").length >= 12,
  );

  const continuity = await page.evaluate(() => {
    const screenPoint = (path: SVGPathElement, distance: number) => {
      const point = path.getPointAtLength(distance);
      const matrix = path.getScreenCTM();
      if (!matrix) return point;
      return new DOMPoint(point.x, point.y).matrixTransform(matrix);
    };
    const outerContours = [...document.querySelectorAll<SVGPathElement>("[data-glyph-contour='0']")];
    const samples = outerContours.flatMap((path) => {
      const length = path.getTotalLength();
      return Array.from({ length: 121 }, (_, index) => screenPoint(path, length * index / 120));
    });
    const distanceToOutline = (point: DOMPoint | SVGPoint) => Math.min(...samples.map((sample) =>
      Math.hypot(point.x - sample.x, point.y - sample.y),
    ));
    const connectors = [...document.querySelectorAll<SVGPathElement>("[data-glyph-connector]")];
    const sitePaths = [...document.querySelectorAll<SVGPathElement>("[data-site-thread-segment]")];
    const junctions = connectors.flatMap((path) => [
      screenPoint(path, 0),
      screenPoint(path, path.getTotalLength()),
    ]);
    junctions.push(screenPoint(sitePaths[0]!, sitePaths[0]!.getTotalLength()));
    junctions.push(screenPoint(sitePaths[1]!, 0));

    return {
      glyphCount: document.querySelectorAll(".about__glyph").length,
      lineCount: new Set([...document.querySelectorAll(".about__glyph")].map((glyph) => Math.round(glyph.getBoundingClientRect().top))).size,
      contourCount: document.querySelectorAll("[data-glyph-contour]").length,
      connectorCount: connectors.length,
      zeroLengthPaths: [...outerContours, ...connectors, ...sitePaths].filter((path) => path.getTotalLength() <= 0).length,
      maxJunctionError: Math.max(...junctions.map(distanceToOutline)),
    };
  });

  expect(continuity.glyphCount).toBe(14);
  expect(continuity.contourCount).toBe(17);
  expect(continuity.connectorCount).toBe(continuity.glyphCount - continuity.lineCount);
  expect(continuity.zeroLengthPaths).toBe(0);
  expect(continuity.maxJunctionError).toBeLessThan(0.75);
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
  await page.waitForFunction(() =>
    document.querySelectorAll("[data-glyph-connector]").length >= 12,
  );

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
