import { test, expect } from "@playwright/test";
import { onboard } from "./helpers";

test("creates a private fan account", async ({ page }) => {
  await onboard(page);
  await expect(page.getByText(/private account ready/i)).toBeVisible();
});

test("'+' deposit without an account prompts to create one", async ({ page }) => {
  await page.goto("/"); // fresh context => no account in localStorage
  await page.getByRole("button", { name: "Add funds" }).click();
  await page.getByRole("button", { name: /deposit .*usdc/i }).click();
  await expect(page.getByText(/create a private account first/i)).toBeVisible();
});

test("deposit after onboarding shows a new balance", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Add funds" }).click();
  await page.getByRole("button", { name: /deposit .*usdc/i }).click();
  await expect(page.getByText(/new balance:/i)).toBeVisible({ timeout: 15_000 });
});
