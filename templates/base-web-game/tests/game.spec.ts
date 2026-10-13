import { test, expect } from "@playwright/test";
import fs from "node:fs";

test("game loads, responds to input, and captures screenshot", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailed: string[] = [];
  const warnings: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
    if (msg.type() === "warning") warnings.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("requestfailed", (req) =>
    requestFailed.push(
      `${req.method()} ${req.url()} ${req.failure()?.errorText || "request failed"}`,
    ),
  );

  await page.goto("/");
  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("#game")).toBeVisible();
  await expect(page.locator("#startBtn")).toBeVisible();
  await page.click("#startBtn");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Space");
  await page.waitForTimeout(1200);

  fs.mkdirSync("test-results/screenshots", { recursive: true });
  fs.writeFileSync(
    "test-results/runtime_errors.json",
    JSON.stringify(
      {
        console_errors: consoleErrors,
        page_errors: pageErrors,
        request_failed: requestFailed,
        warnings,
        warning_count: warnings.length,
      },
      null,
      2,
    ),
  );
  await page.screenshot({
    path: "test-results/screenshots/main.png",
    fullPage: true,
  });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(requestFailed).toEqual([]);
});
