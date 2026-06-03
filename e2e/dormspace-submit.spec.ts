import { expect, test } from "@playwright/test";
import path from "path";

const FIXTURE_DIR = path.join(__dirname, "fixtures");
const LISTING_PHOTOS = [1, 2, 3].map((n) =>
  path.join(FIXTURE_DIR, "listing-photos", `photo-${n}.png`),
);
const VALID_ID = path.join(FIXTURE_DIR, "verification", "valid-id.png");
const PROOF_BILLING = path.join(FIXTURE_DIR, "verification", "proof-billing.png");

const SUBMIT_TIMEOUT_MS = 90_000;
const SUCCESS_NAV_TIMEOUT_MS = 30_000;
const LISTINGS_API_TIMEOUT_MS = 30_000;

const REACH_SERVER_MSG = /Could not reach the server/i;
const LISTINGS_URL = /\/dormspaces\/dashboard\/listings/;

test.describe("Dormspace landlord submit", () => {
  test("guest submit completes or shows a clear error (no hang, 413, or generic network error)", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    const unique = Date.now();
    const title = `E2E bedspace ${unique}`;
    const email = `e2e-dormspace-${unique}@example.test`;
    const password = "E2eTestPass123!";

    await page.context().clearCookies();
    await page.goto("/auth/signout", { waitUntil: "domcontentloaded" });
    await page.goto("/dormspaces/submit?from=welcome", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: /List your dormspace/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Loading…")).toBeHidden({ timeout: 60_000 });

    const form = page.locator("form").filter({ has: page.locator('input[name="title"]') });
    await expect(form).toBeVisible();

    const guestLandlordFields = form.locator('input[name="landlord_first_name"]');
    if (await guestLandlordFields.isVisible()) {
      await guestLandlordFields.fill("E2E");
      await form.locator('input[name="landlord_last_name"]').fill("Landlord");
      await form.locator('input[name="landlord_email"]').fill(email);
      await form.locator('input[name="landlord_email"]').blur();
      await page.waitForResponse(
        (res) =>
          res.url().includes("/api/dormspaces/check-landlord-email") &&
          res.request().method() === "POST",
        { timeout: 30_000 },
      );
      await form.locator('input[name="landlord_phone"]').fill("+639171234567");
    }

    const verificationSection = form.locator("section").filter({ hasText: "Verification" });
    if (await verificationSection.isVisible().catch(() => false)) {
      await verificationSection.locator('input[name="landlord_id"]').setInputFiles(VALID_ID);
      await verificationSection
        .locator('input[name="proof_of_billing"]')
        .setInputFiles(PROOF_BILLING);
    }

    await form.locator('input[name="title"]').fill(title);
    await form.locator('input[name="monthly_price"]').fill("5500");
    await form.locator('select[name="room_type"]').selectOption("shared_2");
    await form.locator('input[name="total_beds"]').fill("2");

    const addressInput = form.getByPlaceholder(/Search address/i);
    await addressInput.fill("Taft Avenue, Manila, Metro Manila, Philippines");
    await addressInput.blur();
    const pacItem = page.locator(".pac-container .pac-item").first();
    if (await pacItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await pacItem.click();
    }

    const photosSection = form.locator("section").filter({ hasText: "Photos" });
    await photosSection.locator('input[type="file"]').setInputFiles(LISTING_PHOTOS);

    const passwordField = form.locator('input[type="password"]');
    if (await passwordField.isVisible().catch(() => false)) {
      await passwordField.fill(password);
    }

    const submitButton = form.getByRole("button", {
      name: /Create account & submit|Submit listing|Sign in & submit/i,
    });
    await expect(submitButton).toBeEnabled();

    const submitResponsePromise = page.waitForResponse(
      (res) =>
        res.request().method() === "POST" && res.url().includes("/api/dormspaces/submit"),
      { timeout: SUBMIT_TIMEOUT_MS },
    );
    await submitButton.click();

    const submitResponse = await submitResponsePromise;

    if (page.url().includes("/dormspaces/submit")) {
      await expect(submitButton).not.toHaveText("Submitting…", { timeout: 15_000 });
      if (await page.getByText(REACH_SERVER_MSG).isVisible().catch(() => false)) {
        throw new Error("Submit shows “Could not reach the server” with no successful POST.");
      }
    }

    const status = submitResponse.status();
    expect(status, "submit must not return 413 Request Entity Too Large").not.toBe(413);
    expect(status, `submit must not return 5xx (got ${status})`).toBeLessThan(500);

    if (status >= 400) {
      const errorText =
        (await page.locator("form p.text-red-600").textContent().catch(() => ""))?.trim() ?? "";
      expect(errorText, "failed submit should show a visible error message").not.toBe("");
      expect(errorText).not.toMatch(/^Network error/i);
      throw new Error(`Submit failed with HTTP ${status}: ${errorText || "(no UI message)"}`);
    }

    const json = (await submitResponse.json().catch(() => ({}))) as {
      ok?: boolean;
      id?: string;
    };
    expect(json.ok, "successful submit should return ok: true").toBe(true);
    expect(json.id, "successful submit should return listing id").toBeTruthy();

    const listingsHeading = page.getByRole("heading", { name: title, level: 2 });

    await page.waitForURL(LISTINGS_URL, { timeout: SUCCESS_NAV_TIMEOUT_MS, waitUntil: "commit" });
    expect(page.url(), "post-submit should not bounce to BahayGo login").not.toMatch(/\/auth\/login/);

    await page
      .waitForResponse(
        (res) =>
          res.request().method() === "GET" &&
          res.url().includes("/api/dormspaces/landlord/listings") &&
          res.ok(),
        { timeout: LISTINGS_API_TIMEOUT_MS },
      )
      .catch(() => undefined);

    await expect(listingsHeading).toBeVisible({ timeout: LISTINGS_API_TIMEOUT_MS });
  });
});
