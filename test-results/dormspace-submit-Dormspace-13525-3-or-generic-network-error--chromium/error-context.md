# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dormspace-submit.spec.ts >> Dormspace landlord submit >> guest submit completes or shows a clear error (no hang, 413, or generic network error)
- Location: e2e\dormspace-submit.spec.ts:16:7

# Error details

```
Error: Breakpoint: submit shows “Could not reach the server” with no POST /api/dormspaces/submit. Likely cause: handleSubmit builds FormData from e.currentTarget after await compressListingPhotos() — React clears currentTarget after the first await, so FormData throws and the catch shows this message. Fix (app): capture const formEl = e.currentTarget before any await, then new FormData(formEl).
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - generic:
      - generic:
        - img
      - link [ref=e5] [cursor=pointer]:
        - /url: /dormspaces
        - img [ref=e6]
      - link [ref=e9] [cursor=pointer]:
        - /url: /dormspaces
        - text: dormspacers
    - banner [ref=e11]:
      - generic [ref=e12]:
        - link "BahayGo dormspacers" [ref=e14] [cursor=pointer]:
          - /url: /dormspaces
          - img [ref=e15]
          - generic [ref=e18]:
            - generic [ref=e19]:
              - generic [ref=e20]: Bahay
              - generic [ref=e21]: Go
            - generic [ref=e22]: dormspacers
        - navigation [ref=e23]:
          - link "My Listings" [ref=e24] [cursor=pointer]:
            - /url: /dormspaces/dashboard
          - button "Resources ▾" [ref=e26]:
            - text: Resources
            - generic [ref=e27]: ▾
        - link "Sign in / Create account" [ref=e29] [cursor=pointer]:
          - /url: /dormspaces/welcome
          - img [ref=e30]
    - main [ref=e34]:
      - generic [ref=e35]:
        - link "← Back to Dormspaces" [ref=e36] [cursor=pointer]:
          - /url: /dormspaces
        - heading "List your dormspace" [level=1] [ref=e37]
        - paragraph [ref=e38]: Free to list. We verify every landlord with ID and proof of billing before your listing goes live.
      - generic [ref=e39]:
        - generic [ref=e40]:
          - heading "1. Landlord info" [level=2] [ref=e41]
          - generic [ref=e42]:
            - generic [ref=e43]:
              - generic [ref=e44]:
                - text: First name *
                - textbox "First name *" [ref=e45]: E2E
              - generic [ref=e46]:
                - text: Last name *
                - textbox "Last name *" [ref=e47]: Landlord
            - generic [ref=e48]:
              - text: Email *
              - textbox "Email *" [ref=e49]: e2e-dormspace-1780396738605@example.test
            - generic [ref=e50]:
              - text: Phone (PH) *
              - textbox "Phone (PH) *" [ref=e51]:
                - /placeholder: +63 9XX XXX XXXX
                - text: "+639171234567"
        - generic [ref=e52]:
          - heading "2. Verification" [level=2] [ref=e53]
          - generic [ref=e54]:
            - paragraph [ref=e55]: Upload once — we verify your landlord account, not each listing.
            - generic [ref=e56]:
              - text: Valid ID *
              - generic [ref=e57] [cursor=pointer]:
                - img [ref=e58]
                - generic [ref=e61]: valid-id.png
                - button "Valid ID * valid-id.png" [ref=e62]
            - generic [ref=e63]:
              - text: Proof of billing *
              - generic [ref=e64] [cursor=pointer]:
                - img [ref=e65]
                - generic [ref=e68]: proof-billing.png
                - button "Proof of billing * proof-billing.png" [ref=e69]
        - generic [ref=e70]:
          - heading "3. Listing details" [level=2] [ref=e71]
          - generic [ref=e72]:
            - generic [ref=e73]:
              - text: Title *
              - textbox "Title *" [ref=e74]:
                - /placeholder: Cozy bedspace near BGC
                - text: E2E bedspace 1780396738605
            - generic [ref=e75]:
              - text: Description
              - textbox "Description" [ref=e76]
            - generic [ref=e77]:
              - generic [ref=e78]:
                - text: Monthly price (₱) *
                - spinbutton "Monthly price (₱) *" [ref=e79]: "5500"
              - generic [ref=e80]:
                - text: Deposit (months)
                - spinbutton "Deposit (months)" [ref=e81]: "1"
            - generic [ref=e82]:
              - generic [ref=e83]:
                - text: Room type *
                - combobox "Room type *" [ref=e84]:
                  - option "Select…" [disabled]
                  - option "Private room"
                  - option "Shared (2 beds)" [selected]
                  - option "Shared (4 beds)"
                  - option "Shared (6+ beds)"
              - generic [ref=e85]:
                - text: Total beds *
                - spinbutton "Total beds * Defaults from room type; adjust if your space has a different capacity." [ref=e86]: "2"
                - generic [ref=e87]: Defaults from room type; adjust if your space has a different capacity.
              - generic [ref=e88]:
                - text: Gender preference
                - combobox "Gender preference" [ref=e89]:
                  - option "Any" [selected]
                  - option "Male only"
                  - option "Female only"
            - generic [ref=e90]:
              - paragraph [ref=e91]: Address *
              - generic [ref=e92]:
                - textbox "Search address…" [ref=e93]: Taft Avenue, Manila, Metro Manila, Philippines
                - generic "Address map preview" [ref=e94]:
                  - generic [ref=e95]: Map will appear here after selecting an address
            - generic [ref=e96]:
              - text: Near school (optional)
              - textbox "Near school (optional)" [ref=e97]:
                - /placeholder: e.g. Ateneo, DLSU, UP Diliman
        - generic [ref=e98]:
          - heading "4. Amenities" [level=2] [ref=e99]
          - generic [ref=e101]:
            - generic [ref=e102] [cursor=pointer]:
              - checkbox "Wi-Fi" [ref=e103]
              - text: Wi-Fi
            - generic [ref=e104] [cursor=pointer]:
              - checkbox "Aircon" [ref=e105]
              - text: Aircon
            - generic [ref=e106] [cursor=pointer]:
              - checkbox "Kitchen" [ref=e107]
              - text: Kitchen
            - generic [ref=e108] [cursor=pointer]:
              - checkbox "Laundry" [ref=e109]
              - text: Laundry
            - generic [ref=e110] [cursor=pointer]:
              - checkbox "Water included" [ref=e111]
              - text: Water included
            - generic [ref=e112] [cursor=pointer]:
              - checkbox "Electricity included" [ref=e113]
              - text: Electricity included
            - generic [ref=e114] [cursor=pointer]:
              - checkbox "Security" [ref=e115]
              - text: Security
        - generic [ref=e116]:
          - heading "5. Rules" [level=2] [ref=e117]
          - generic [ref=e118]:
            - generic [ref=e119]:
              - text: Curfew (optional)
              - textbox "Curfew (optional)" [ref=e120]:
                - /placeholder: e.g. 10 PM weekdays
            - generic [ref=e121]:
              - text: House rules
              - textbox "House rules" [ref=e122]
        - generic [ref=e123]:
          - heading "6. Photos (3–10)" [level=2] [ref=e124]
          - generic [ref=e126]:
            - paragraph [ref=e127]:
              - text: Listing photos *
              - generic [ref=e128]: (3–10 images)
            - list [ref=e129]:
              - listitem [ref=e130]:
                - button "Remove photo 1" [ref=e131]:
                  - img [ref=e132]
              - listitem [ref=e135]:
                - button "Remove photo 2" [ref=e136]:
                  - img [ref=e137]
              - listitem [ref=e140]:
                - button "Remove photo 3" [ref=e141]:
                  - img [ref=e142]
            - generic [ref=e145] [cursor=pointer]:
              - button "Add more photos JPG, PNG, or WebP · room, bathroom, and common areas 3 / 10 added" [ref=e146]
              - generic [ref=e147]:
                - img [ref=e148]
                - img [ref=e151]
              - generic [ref=e155]: Add more photos
              - generic [ref=e156]: JPG, PNG, or WebP · room, bathroom, and common areas
              - generic [ref=e157]: 3 / 10 added
            - paragraph [ref=e158]: 3 photos ready — looks good.
        - generic [ref=e159]:
          - heading "7. Save your account to manage this listing" [level=2] [ref=e160]
          - generic [ref=e161]:
            - paragraph [ref=e162]: Create a landlord account to manage listings and inquiries from your dashboard.
            - generic [ref=e163]:
              - text: Email
              - textbox [ref=e164]: e2e-dormspace-1780396738605@example.test
            - generic [ref=e165]:
              - text: Password *
              - textbox "Password *" [ref=e166]: E2eTestPass123!
        - paragraph [ref=e167]: Could not reach the server. Check your connection and try again.
        - button "Create account & submit" [ref=e168]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e174] [cursor=pointer]:
    - img [ref=e175]
  - alert [ref=e178]
```

# Test source

```ts
  17  |     page,
  18  |   }) => {
  19  |     const unique = Date.now();
  20  |     const email = `e2e-dormspace-${unique}@example.test`;
  21  |     const password = "E2eTestPass123!";
  22  | 
  23  |     const failedRequests: string[] = [];
  24  |     page.on("requestfailed", (request) => {
  25  |       if (request.url().includes("/api/dormspaces/submit")) {
  26  |         failedRequests.push(
  27  |           `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? "unknown"}`,
  28  |         );
  29  |       }
  30  |     });
  31  | 
  32  |     await page.context().clearCookies();
  33  |     await page.goto("/auth/signout", { waitUntil: "domcontentloaded" });
  34  |     await page.goto("/dormspaces/submit?from=welcome", { waitUntil: "domcontentloaded" });
  35  | 
  36  |     await expect(page.getByRole("heading", { name: /List your dormspace/i })).toBeVisible({
  37  |       timeout: 30_000,
  38  |     });
  39  |     await expect(page.getByText("Loading…")).toBeHidden({ timeout: 60_000 });
  40  | 
  41  |     const form = page.locator("form").filter({ has: page.locator('input[name="title"]') });
  42  |     await expect(form).toBeVisible();
  43  | 
  44  |     const guestLandlordFields = form.locator('input[name="landlord_first_name"]');
  45  |     if (await guestLandlordFields.isVisible()) {
  46  |       await guestLandlordFields.fill("E2E");
  47  |       await form.locator('input[name="landlord_last_name"]').fill("Landlord");
  48  |       await form.locator('input[name="landlord_email"]').fill(email);
  49  |       await form.locator('input[name="landlord_email"]').blur();
  50  |       await page.waitForResponse(
  51  |         (res) =>
  52  |           res.url().includes("/api/dormspaces/check-landlord-email") &&
  53  |           res.request().method() === "POST",
  54  |         { timeout: 30_000 },
  55  |       );
  56  |       await form.locator('input[name="landlord_phone"]').fill("+639171234567");
  57  |     }
  58  | 
  59  |     const verificationSection = form.locator("section").filter({ hasText: "Verification" });
  60  |     if (await verificationSection.isVisible().catch(() => false)) {
  61  |       await verificationSection.locator('input[name="landlord_id"]').setInputFiles(VALID_ID);
  62  |       await verificationSection
  63  |         .locator('input[name="proof_of_billing"]')
  64  |         .setInputFiles(PROOF_BILLING);
  65  |     }
  66  | 
  67  |     await form.locator('input[name="title"]').fill(`E2E bedspace ${unique}`);
  68  |     await form.locator('input[name="monthly_price"]').fill("5500");
  69  |     await form.locator('select[name="room_type"]').selectOption("shared_2");
  70  |     await form.locator('input[name="total_beds"]').fill("2");
  71  | 
  72  |     const addressInput = form.getByPlaceholder(/Search address/i);
  73  |     await addressInput.fill("Taft Avenue, Manila, Metro Manila, Philippines");
  74  |     await addressInput.blur();
  75  |     const pacItem = page.locator(".pac-container .pac-item").first();
  76  |     if (await pacItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
  77  |       await pacItem.click();
  78  |     }
  79  | 
  80  |     const photosSection = form.locator("section").filter({ hasText: "Photos" });
  81  |     await photosSection.locator('input[type="file"]').setInputFiles(LISTING_PHOTOS);
  82  | 
  83  |     const passwordField = form.locator('input[type="password"]');
  84  |     if (await passwordField.isVisible().catch(() => false)) {
  85  |       await passwordField.fill(password);
  86  |     }
  87  | 
  88  |     const submitButton = form.getByRole("button", {
  89  |       name: /Create account & submit|Submit listing|Sign in & submit/i,
  90  |     });
  91  |     await expect(submitButton).toBeEnabled();
  92  | 
  93  |     const submitResponsePromise = page.waitForResponse(
  94  |       (res) =>
  95  |         res.request().method() === "POST" && res.url().includes("/api/dormspaces/submit"),
  96  |       { timeout: SUBMIT_TIMEOUT_MS },
  97  |     );
  98  | 
  99  |     const reachServerErrorPromise = page
  100 |       .getByText(REACH_SERVER_MSG)
  101 |       .waitFor({ state: "visible", timeout: SUBMIT_TIMEOUT_MS })
  102 |       .then(() => "reach-server-error" as const);
  103 | 
  104 |     await submitButton.click();
  105 | 
  106 |     const outcome = await Promise.race([
  107 |       submitResponsePromise.then((res) => ({ kind: "response" as const, res })),
  108 |       reachServerErrorPromise,
  109 |     ]).catch(() => ({ kind: "timeout" as const }));
  110 | 
  111 |     await expect(submitButton).not.toHaveText("Submitting…", { timeout: 30_000 });
  112 | 
  113 |     const errorBanner = page.locator("form p.text-red-600");
  114 |     const errorText = (await errorBanner.textContent().catch(() => ""))?.trim() ?? "";
  115 | 
  116 |     if (outcome.kind === "reach-server-error" || (await page.getByText(REACH_SERVER_MSG).isVisible())) {
> 117 |       throw new Error(
      |             ^ Error: Breakpoint: submit shows “Could not reach the server” with no POST /api/dormspaces/submit. Likely cause: handleSubmit builds FormData from e.currentTarget after await compressListingPhotos() — React clears currentTarget after the first await, so FormData throws and the catch shows this message. Fix (app): capture const formEl = e.currentTarget before any await, then new FormData(formEl).
  118 |         [
  119 |           "Breakpoint: submit shows “Could not reach the server” with no POST /api/dormspaces/submit.",
  120 |           "Likely cause: handleSubmit builds FormData from e.currentTarget after await compressListingPhotos() — React clears currentTarget after the first await, so FormData throws and the catch shows this message.",
  121 |           "Fix (app): capture const formEl = e.currentTarget before any await, then new FormData(formEl).",
  122 |           failedRequests.length ? `Failed requests: ${failedRequests.join("; ")}` : "",
  123 |         ]
  124 |           .filter(Boolean)
  125 |           .join(" "),
  126 |       );
  127 |     }
  128 | 
  129 |     if (outcome.kind === "timeout") {
  130 |       if (errorText) {
  131 |         expect(errorText).not.toMatch(/^Network error/i);
  132 |         throw new Error(`Submit failed without HTTP response: ${errorText}`);
  133 |       }
  134 |       throw new Error(
  135 |         `Submit hung: no POST /api/dormspaces/submit within ${SUBMIT_TIMEOUT_MS / 1000}s`,
  136 |       );
  137 |     }
  138 | 
  139 |     const submitResponse = outcome.res;
  140 |     const status = submitResponse.status();
  141 | 
  142 |     expect(status, "submit must not return 413 Request Entity Too Large").not.toBe(413);
  143 |     expect(status, `submit must not return 5xx (got ${status})`).toBeLessThan(500);
  144 | 
  145 |     if (status >= 400) {
  146 |       expect(errorText, "failed submit should show a visible error message").not.toBe("");
  147 |       expect(
  148 |         errorText,
  149 |         'size/server failures must not show the old generic "Network error" copy',
  150 |       ).not.toMatch(/^Network error/i);
  151 |       throw new Error(`Submit failed with HTTP ${status}: ${errorText || "(no UI message)"}`);
  152 |     }
  153 | 
  154 |     const json = (await submitResponse.json().catch(() => ({}))) as {
  155 |       ok?: boolean;
  156 |       id?: string;
  157 |       error?: { message?: string };
  158 |     };
  159 | 
  160 |     expect(json.ok, "successful submit should return ok: true").toBe(true);
  161 |     expect(json.id, "successful submit should return listing id").toBeTruthy();
  162 | 
  163 |     await expect(page).toHaveURL(/\/dormspaces\/dashboard\/listings/, {
  164 |       timeout: SUBMIT_TIMEOUT_MS,
  165 |     });
  166 |     await expect(page.getByText(new RegExp(`E2E bedspace ${unique}`))).toBeVisible({
  167 |       timeout: 30_000,
  168 |     });
  169 |   });
  170 | });
  171 | 
```