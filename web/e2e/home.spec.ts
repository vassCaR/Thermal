import { test, expect } from "@playwright/test";

test("hero loads with title, logo and subtitle", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ghost Tips" })).toBeVisible();
  await expect(page.getByAltText("Ghost Tips")).toBeVisible();
  await expect(page.getByText(/support anyone, by the second/i)).toBeVisible();
});

test("primary navigation buttons are present", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "View a Creator" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Creator Dashboard" })).toBeVisible();
});

test("no severe console errors on load", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await page.waitForTimeout(2500);
  expect(errors, errors.join("\n")).toEqual([]);
});
