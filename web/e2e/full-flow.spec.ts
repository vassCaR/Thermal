import { test, expect } from "@playwright/test";
import { onboard } from "./helpers";

/** The core money path: onboard -> deposit -> per-second tip -> withdraw. */
test("full flow: onboard, deposit, tip a creator, withdraw", async ({ page }) => {
  await onboard(page);

  // Fund the private account via the floating "+".
  await page.getByRole("button", { name: "Add funds" }).click();
  await page.getByRole("button", { name: /deposit .*usdc/i }).click();
  await expect(page.getByText(/new balance:/i)).toBeVisible({ timeout: 15_000 });

  // Tip a creator by holding the support button for ~2.6s (3 per-second ticks).
  await page.goto("/creator/ghost:alice");
  const hold = page.getByTestId("hold-support");
  await expect(hold).toBeEnabled();
  await hold.dispatchEvent("pointerdown");
  await page.waitForTimeout(2600);
  await hold.dispatchEvent("pointerup");
  await expect(page.getByTestId("spent")).not.toContainText("0.000000", { timeout: 6_000 });

  // Withdraw the anonymous accrued total from the creator dashboard.
  await page.goto("/dashboard?id=ghost:alice");
  await page.getByTestId("withdraw").click();
  await expect(page.getByText(/arc settlement:/i)).toBeVisible({ timeout: 15_000 });
});
