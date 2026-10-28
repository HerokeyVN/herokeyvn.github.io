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
