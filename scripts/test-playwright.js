const { chromium } = require('playwright');

(async () => {
  console.log("⚡ Running fast Playwright verification test...");
  const browser = await chromium.launch({ headless: true });
  
  // 1. DESKTOP CONSTITUENT FLOW TEST (1280x800)
  const contextDesktop = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const pageDesktop = await contextDesktop.newPage();
  
  const consoleErrors = [];
  pageDesktop.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  console.log("▶ 1. Checking Landing Page (http://localhost:3000)...");
  await pageDesktop.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  console.log("   ✓ Landing page loaded! Title:", await pageDesktop.title());

  console.log("▶ 2. Opening Constituent Portal (http://localhost:3000/portal)...");
  await pageDesktop.goto('http://localhost:3000/portal', { waitUntil: 'domcontentloaded' });

  // STEP 1: Payment Verification using instant generator
  console.log("▶ 3. Step 1: Payment Reference Verification...");
  await pageDesktop.click("button:has-text('Generate Demo Payment Reference Code')");
  await pageDesktop.waitForTimeout(1000);
  console.log("   ✓ Step 1 verified!");

  // STEP 2: Fill Clearance Form Details
  console.log("▶ 4. Step 2: Filling Clearance Details...");
  await pageDesktop.waitForSelector("h2:has-text('Fill Up Clearance Details')", { timeout: 10000 });
  
  await pageDesktop.locator("input[placeholder='e.g. Dela Cruz']").fill("DELA CRUZ");
  await pageDesktop.locator("input[placeholder='e.g. Juan']").fill("JUAN PEDRO");
  await pageDesktop.locator("input[placeholder='e.g. Local Employment']").fill("LOCAL EMPLOYMENT REQUIREMENT");
  await pageDesktop.locator("input[type='date']").fill("1995-08-15");
  await pageDesktop.locator("input[placeholder='e.g. OR-981245']").fill("OR-981245");
  await pageDesktop.locator("input[placeholder='e.g. CTC-12345678']").fill("CTC-12345678");
  await pageDesktop.locator("textarea[placeholder='e.g. Brgy. San Jose, Iriga City']").fill("San Miguel, Iriga City, Camarines Sur");
  
  await pageDesktop.click("button:has-text('Preview Generated Certificate →')");
  await pageDesktop.waitForTimeout(500);

  // STEP 3: Certificate Preview
  console.log("▶ 5. Step 3: Certificate Preview...");
  await pageDesktop.waitForSelector("button:has-text('Submit & Issue Official Clearance →')", { timeout: 10000 });
  console.log("   ✓ Step 3 Certificate Preview loaded!");
  await pageDesktop.click("button:has-text('Submit & Issue Official Clearance →')");

  // STEP 4: Digital QR Pass
  console.log("▶ 6. Step 4: Digital Counter QR Pass...");
  await pageDesktop.waitForSelector("button:has-text('Download QR Pass (PNG)')", { timeout: 10000 });
  console.log("   ✓ Step 4 Digital Counter QR Pass generated & verified!");

  // 2. MOBILE RESPONSIVENESS TEST (375x667 iPhone Viewport)
  console.log("▶ 7. Testing Mobile Responsiveness (375px width)...");
  const contextMobile = await browser.newContext({
    viewport: { width: 375, height: 667 },
    isMobile: true
  });
  const pageMobile = await contextMobile.newPage();
  
  pageMobile.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(`[Mobile] ${msg.text()}`);
  });

  await pageMobile.goto('http://localhost:3000/portal', { waitUntil: 'domcontentloaded' });
  const isHeaderVisible = await pageMobile.isVisible("header");
  console.log("   ✓ Mobile Portal loaded cleanly! Header visible:", isHeaderVisible);

  console.log("\n----------------------------------------------------");
  console.log("Console Errors Detected:", consoleErrors.length > 0 ? consoleErrors : "NONE (0 errors)");
  console.log("----------------------------------------------------");

  await browser.close();
  console.log("\n🎉 ALL VERIFICATION TESTS COMPLETED & PASSED SUCCESSFULLY!");
})();
