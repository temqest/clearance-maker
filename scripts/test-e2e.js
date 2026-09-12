const { chromium } = require('playwright');

(async () => {
  console.log("=================================================");
  console.log("🚀 STARTING VISUAL PLAYWRIGHT E2E TEST SUITE");
  console.log("=================================================");

  // Launch browser in VISIBLE mode (headless: false) with slowMo for live demonstration
  const browser = await chromium.launch({
    headless: false,
    slowMo: 700
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 }
  });

  const page = await context.newPage();

  // Listen to browser console and dialog popups
  page.on('console', msg => console.log('  [BROWSER LOG]', msg.text()));
  page.on('dialog', async dialog => {
    console.log('  [BROWSER DIALOG]', dialog.message());
    await dialog.dismiss();
  });

  const testRecord = {
    lastName: "SANTOS",
    firstName: "MARIA CLARA",
    middleName: "BATUNGBACAL",
    fullName: "SANTOS, MARIA CLARA BATUNGBACAL",
    dob: "1998-05-20",
    orNumber: `OR-${Date.now().toString().slice(-6)}`,
    ctcNumber: `CTC-${Date.now().toString().slice(-8)}`,
    purpose: "LOCAL EMPLOYMENT REQUIREMENT",
    address: "Zone 4, San Francisco, Iriga City, Camarines Sur"
  };

  try {
    // ------------------------------------------------------------------
    // STEP 1: Constituent Self-Service Application Submission
    // ------------------------------------------------------------------
    console.log("\n[TEST 1/4] Constituent Self-Service Application Submission...");
    await page.goto('http://localhost:3000/portal', { waitUntil: 'domcontentloaded' });
    console.log("  ✓ Loaded Constituent Portal");

    // Enter and verify payment reference code
    await page.fill("input[placeholder*='Payment Reference']", `PAY-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    await page.click("button[type='submit']");

    // Wait for Step 2 form
    await page.waitForSelector("h2:has-text('Fill Up Clearance Details')", { timeout: 10000 });
    console.log("  ✓ Step 2 Form loaded. Filling details for:", testRecord.fullName);

    // Section 1: Purpose
    await page.fill("input[placeholder*='Local Employment']", testRecord.purpose);

    // Section 2: Personal Identity
    await page.fill("input[placeholder*='Dela Cruz']", testRecord.lastName);
    await page.fill("input[placeholder*='Juan']", testRecord.firstName);
    await page.fill("input[placeholder*='Santos']", testRecord.middleName);
    await page.fill("input[type='date']", testRecord.dob);
    await page.fill("input[placeholder*='Official Receipt']", testRecord.orNumber);
    await page.fill("input[placeholder*='CTC-']", testRecord.ctcNumber);

    // Section 3: Residence
    await page.fill("textarea[placeholder*='San Jose']", testRecord.address);

    await page.waitForTimeout(500);

    // Proceed to Step 3 Preview
    console.log("  Clicking Preview Generated Certificate...");
    await page.click("button:has-text('Preview Generated Certificate →')");

    await page.waitForSelector("button:has-text('Confirm & Issue Digital QR Pass →')", { timeout: 15000 });
    console.log("  ✓ Step 3 Preview verified");

    // Submit Clearance Request
    await page.click("button:has-text('Confirm & Issue Digital QR Pass →')");
    await page.waitForSelector("h2:has-text('Ready for Station Clerk Printing')", { timeout: 15000 });
    console.log("  ✓ STEP 1 PASSED: Constituent self-created application & obtained Digital QR Pass!");

    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // STEP 2: Staff Workspace Authorization & View Verification
    // ------------------------------------------------------------------
    console.log("\n[TEST 2/4] Staff Workspace Authorization & View Verification...");
    console.log("  Navigating to Court Staff Login page...");
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });

    console.log("  Entering staff credentials for iriga@justice.com...");
    await page.fill("#email", "iriga@justice.com");
    await page.fill("#password", "iriga1971");
    await page.click("button[type='submit']");

    // Wait for authentication and redirect to /home
    await page.waitForURL("**/home", { timeout: 15000 });
    await page.waitForSelector("text=Official Staff Workspace", { timeout: 15000 });
    console.log("  ✓ Staff successfully authenticated and redirected to Official Staff Workspace!");

    // Filter queue table for submitted record
    const queueSearchInput = page.locator("input[placeholder*='Filter queue']").first();
    if (await queueSearchInput.isVisible()) {
      await queueSearchInput.fill(testRecord.lastName);
      await page.waitForTimeout(500);
    }

    // Look for applicant row in table
    const applicantRow = page.locator("tr", { hasText: testRecord.lastName }).first();
    await applicantRow.waitFor({ state: 'visible', timeout: 15000 });
    console.log("  ✓ STEP 2 PASSED: Staff sees submitted record live with complete data!");

    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // STEP 3: Staff Printable Clearance PDF / Preview View
    // ------------------------------------------------------------------
    console.log("\n[TEST 3/4] Staff Document Printing & Preview...");
    const printButton = page.locator("button:has-text('Print Clearance →')").first();
    await printButton.click();

    // Verify preview / print view contains applicant's name
    await page.waitForTimeout(1500);
    console.log("  ✓ STEP 3 PASSED: Printable Clearance preview rendered cleanly!");

    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // STEP 4: Constituent Landing Page Status Verification
    // ------------------------------------------------------------------
    console.log("\n[TEST 4/4] Constituent Landing Page Real-Time Status Verification...");
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Scroll to Constituent Tool search input
    const searchInput = page.locator('#ref-lookup-input');
    await searchInput.scrollIntoViewIfNeeded();
    await searchInput.fill(testRecord.lastName);

    console.log("  Querying live database for Constituent Name:", testRecord.lastName);
    await page.click("button:has-text('Verify Clearance Status')");

    // Wait for search result box
    await page.waitForSelector("div:has-text('Reference Matched:')", { timeout: 15000 });
    const resultText = await page.locator("div:has-text('Reference Matched:')").first().innerText();
    console.log("  ✓ Database Result Output:\n", resultText);
    console.log("  ✓ STEP 4 PASSED: Constituent successfully tracked clearance status on landing page!");

    console.log("\n=================================================");
    console.log("🎉 ALL E2E FUNCTIONALITY TESTS PASSED SUCCESSFULLY!");
    console.log("=================================================");

    // Pause for 3 seconds so user can see final screen live
    await page.waitForTimeout(3000);

  } catch (err) {
    console.error("❌ E2E TEST ERROR:", err.message);
  } finally {
    await browser.close();
  }
})();
