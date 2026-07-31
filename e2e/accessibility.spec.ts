import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicRoutes = ["/", "/login", "/privacy", "/terms"] as const;

for (const route of publicRoutes) {
  test(`${route} has no serious accessibility violations`, async ({
    page,
  }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);
  });
}

test("public navigation and registration are keyboard operable", async ({
  page,
}) => {
  await page.goto("/login");
  await page.keyboard.press("Tab");
  const firstFocus = await page.locator(":focus").evaluate((element) => ({
    tag: element.tagName,
    text: element.textContent?.trim(),
  }));
  expect(firstFocus.tag).toMatch(/A|BUTTON/);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel("Enter your full name")).toBeVisible();
  await page.getByLabel("Enter your full name").focus();
  await page.keyboard.press("Tab");
  const nextFocusId = await page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.id ?? "",
  );
  expect(nextFocusId).toBe("signup-email");
});

test("pages do not introduce viewport overflow", async ({ page }) => {
  for (const route of publicRoutes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();
    const sizes = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1);
  }
});
