import { test, expect } from "@playwright/test";

test("hamburger opens the sidebar with its links", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("link", { name: "About Us" })).toBeVisible();
  await expect(page.getByRole("link", { name: "How It Works" })).toBeVisible();
});

test("'View a Creator' navigates to a creator page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "View a Creator" }).click();
  await expect(page).toHaveURL(/\/creator\//);
  await expect(page.getByTestId("hold-support")).toBeVisible();
});

test("'Creator Dashboard' navigates to the dashboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Creator Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByTestId("creator-total")).toBeVisible();
});
