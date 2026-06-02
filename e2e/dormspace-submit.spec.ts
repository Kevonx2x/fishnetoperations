import { expect, test } from "@playwright/test";
import path from "path";

const FIXTURE_DIR = path.join(__dirname, "fixtures");
const LISTING_PHOTOS = [1, 2, 3].map((n) =>
  path.join(FIXTURE_DIR, "listing-photos", `photo-${n}.png`),
);
const VALID_ID = path.join(FIXTURE_DIR, "verification", "valid-id.png");
const PROOF_BILLING = path.join(FIXTURE_DIR, "verification", "proof-billing.png");

const SUBMIT_TIMEOUT_MS = 120_000;

const REACH_SERVER_MSG = /Could not reach the server/i;

test.describe("Dormspace landlord submit", () => {
  test("guest submit completes or shows a clear error (no hang, 413, or generic network error)", async ({
    page,
  }) => {
    const unique = Date.now();
    const email = `e2e-dormspace-${unique}@example.test`;
    const password = "E2eTestPass123!";

    const failedRequests: string[] = [];
    page.on("requestfailed", (request) => {
      if (request.url().includes("/api/dormspaces/submit")) {
        failedRequests.push(
          `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? "unknown"}`,
        );
      }
    });

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

    await form.locator('input[name="title"]').fill(`E2E bedspace ${unique}`);
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

    const reachServerErrorPromise = page
      .getByText(REACH_SERVER_MSG)
      .waitFor({ state: "visible", timeout: SUBMIT_TIMEOUT_MS })
      .then(() => "reach-server-error" as const);

    await submitButton.click();

    const outcome = await Promise.race([
      submitResponsePromise.then((res) => ({ kind: "response" as const, res })),
      reachServerErrorPromise,
    ]).catch(() => ({ kind: "timeout" as const }));

    await expect(submitButton).not.toHaveText("Submitting…", { timeout: 30_000 });

    const errorBanner = page.locator("form p.text-red-600");
    const errorText = (await errorBanner.textContent().catch(() => ""))?.trim() ?? "";

    if (outcome.kind === "reach-server-error" || (await page.getByText(REACH_SERVER_MSG).isVisible())) {
      throw new Error(
        [
          "Breakpoint: submit shows “Could not reach the server” with no POST /api/dormspaces/submit.",
          "Likely cause: handleSubmit builds FormData from e.currentTarget after await compressListingPhotos() — React clears currentTarget after the first await, so FormData throws and the catch shows this message.",
          "Fix (app): capture const formEl = e.currentTarget before any await, then new FormData(formEl).",
          failedRequests.length ? `Failed requests: ${failedRequests.join("; ")}` : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    }

    if (outcome.kind === "timeout") {
      if (errorText) {
        expect(errorText).not.toMatch(/^Network error/i);
        throw new Error(`Submit failed without HTTP response: ${errorText}`);
      }
      throw new Error(
        `Submit hung: no POST /api/dormspaces/submit within ${SUBMIT_TIMEOUT_MS / 1000}s`,
      );
    }

    const submitResponse = outcome.res;
    const status = submitResponse.status();

    expect(status, "submit must not return 413 Request Entity Too Large").not.toBe(413);
    expect(status, `submit must not return 5xx (got ${status})`).toBeLessThan(500);

    if (status >= 400) {
      expect(errorText, "failed submit should show a visible error message").not.toBe("");
      expect(
        errorText,
        'size/server failures must not show the old generic "Network error" copy',
      ).not.toMatch(/^Network error/i);
      throw new Error(`Submit failed with HTTP ${status}: ${errorText || "(no UI message)"}`);
    }

    const json = (await submitResponse.json().catch(() => ({}))) as {
      ok?: boolean;
      id?: string;
      error?: { message?: string };
    };

    expect(json.ok, "successful submit should return ok: true").toBe(true);
    expect(json.id, "successful submit should return listing id").toBeTruthy();

    await expect(page).toHaveURL(/\/dormspaces\/dashboard\/listings/, {
      timeout: SUBMIT_TIMEOUT_MS,
    });
    await expect(page.getByText(new RegExp(`E2E bedspace ${unique}`))).toBeVisible({
      timeout: 30_000,
    });
  });
});
