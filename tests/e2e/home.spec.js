import { test, expect } from "@playwright/test";

test("home page renders branding", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/BookCar/i).first()).toBeVisible();
});
