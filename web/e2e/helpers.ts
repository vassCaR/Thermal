import { type Page, expect } from "@playwright/test";

/** Create the private fan account from the home page (idempotent within a context). */
export async function onboard(page: Page) {
  await page.goto("/");
  const btn = page.getByRole("button", { name: /create my private account/i });
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
  }
  await expect(page.getByText(/private account ready/i)).toBeVisible({ timeout: 15_000 });
}
