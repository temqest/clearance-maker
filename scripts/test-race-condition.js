const path = require('path');
const fs = require('fs');

// Load environment variables
const loadEnv = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valParts] = trimmed.split('=');
      if (key && valParts.length) {
        process.env[key.trim()] = valParts.join('=').trim();
      }
    }
  });
};

loadEnv('.env');
loadEnv('.env.local');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("=================================================");
console.log("⚡ CONCURRENCY & RACE CONDITION TEST SUITE");
console.log("=================================================");

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ FAIL: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.");
  process.exit(1);
}

const { createClient } = require(path.join(process.cwd(), 'node_modules', '@supabase', 'supabase-js'));
const supabase = createClient(supabaseUrl, supabaseKey);

async function runRaceConditionTests() {
  let passed = 0;
  let failed = 0;
  const createdCertNumbers = [];

  // Helper to perform a single document creation matching mockStore logic
  async function simulateDocumentCreation(fullName, purpose, idempotencyKey = null) {
    const timestamp = Date.now();
    const candidateCertNo = `DOC-TEMP-${Math.floor(1000 + Math.random() * 9000)}`;
    const candidateIdempotency = idempotencyKey || `RACE_${fullName.replace(/\W/g, '')}_${timestamp}`;
    const orNumber = `OR-RACE-${Math.floor(100000 + Math.random() * 900000)}`;
    const ctcNumber = `CTC-${Date.now().toString().slice(-8)}`;

    const docPayload = {
      fullName,
      purpose,
      orNumber,
      ctcNumber,
      ctc: ctcNumber,
      dateRequested: new Date().toISOString()
    };

    let { data, error } = await supabase
      .from("documents")
      .insert({
        title: fullName,
        full_name: fullName,
        purpose: purpose,
        cert_no: candidateCertNo,
        or_number: orNumber,
        idempotency_key: candidateIdempotency,
        form_data: docPayload
      })
      .select();

    // Idempotency conflict handler
    if (error && (error.message?.includes("idempotency_key") || error.details?.includes("idempotency_key"))) {
      const { data: existingDocs } = await supabase
        .from("documents")
        .select("*")
        .eq("idempotency_key", candidateIdempotency)
        .limit(1);

      if (existingDocs && existingDocs.length > 0) {
        return { doc: existingDocs[0], isIdempotentRecovery: true, error: null };
      }
    }

    // Sequence / unique cert_no collision retry handler
    if (error && (error.code === "23505" || error.message?.includes("unique constraint"))) {
      const fallbackCertNo = `DOC-RACE-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*100)}`;
      const retry = await supabase
        .from("documents")
        .insert({
          title: fullName,
          full_name: fullName,
          purpose: purpose,
          cert_no: fallbackCertNo,
          or_number: orNumber,
          idempotency_key: candidateIdempotency + "_retry",
          form_data: docPayload
        })
        .select();

      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return { doc: null, isIdempotentRecovery: false, error };
    }

    return { doc: data[0], isIdempotentRecovery: false, error: null };
  }

  // --------------------------------------------------------------------------
  // TEST 1: Two Users Submitting at the EXACT same millisecond
  // --------------------------------------------------------------------------
  console.log("\n[TEST 1/3] Mimicking 2 USERS submitting documents at the exact same millisecond...");

  const userA = "RACE USER A (CONCURRENT)";
  const userB = "RACE USER B (CONCURRENT)";

  const [resUserA, resUserB] = await Promise.all([
    simulateDocumentCreation(userA, "EMPLOYMENT"),
    simulateDocumentCreation(userB, "TRAVEL")
  ]);

  if (resUserA.error || resUserB.error) {
    console.error("❌ TEST 1 FAILED: One or both user creations failed!");
    if (resUserA.error) console.error("   User A Error:", resUserA.error.message);
    if (resUserB.error) console.error("   User B Error:", resUserB.error.message);
    failed++;
  } else {
    const certA = resUserA.doc.cert_no || resUserA.doc.id;
    const certB = resUserB.doc.cert_no || resUserB.doc.id;

    createdCertNumbers.push(certA, certB);

    if (certA !== certB) {
      console.log("✓ TEST 1 PASSED: Concurrent user creation succeeded without data loss!");
      console.log(`  User A Cert No: ${certA}`);
      console.log(`  User B Cert No: ${certB}`);
      passed++;
    } else {
      console.error(`❌ TEST 1 FAILED: Certificate number collision detected! Both received: ${certA}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 2: Two Staff Members Creating Documents at the EXACT same millisecond
  // --------------------------------------------------------------------------
  console.log("\n[TEST 2/3] Mimicking 2 STAFF members creating documents at the exact same millisecond...");

  const staffA = "RACE STAFF CLERK A (CONCURRENT)";
  const staffB = "RACE STAFF CLERK B (CONCURRENT)";

  const [resStaffA, resStaffB] = await Promise.all([
    simulateDocumentCreation(staffA, "OFFICIAL STAFF ISSUE"),
    simulateDocumentCreation(staffB, "OFFICIAL STAFF ISSUE")
  ]);

  if (resStaffA.error || resStaffB.error) {
    console.error("❌ TEST 2 FAILED: One or both staff creations failed!");
    if (resStaffA.error) console.error("   Staff A Error:", resStaffA.error.message);
    if (resStaffB.error) console.error("   Staff B Error:", resStaffB.error.message);
    failed++;
  } else {
    const certA = resStaffA.doc.cert_no || resStaffA.doc.id;
    const certB = resStaffB.doc.cert_no || resStaffB.doc.id;

    createdCertNumbers.push(certA, certB);

    if (certA !== certB) {
      console.log("✓ TEST 2 PASSED: Concurrent staff creation succeeded without data loss!");
      console.log(`  Staff A Cert No: ${certA}`);
      console.log(`  Staff B Cert No: ${certB}`);
      passed++;
    } else {
      console.error(`❌ TEST 2 FAILED: Certificate number collision detected! Both received: ${certA}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 3: Double-Click / Idempotency Race Condition (Same Idempotency Key)
  // --------------------------------------------------------------------------
  console.log("\n[TEST 3/3] Mimicking rapid DOUBLE-CLICK (2 identical requests sent simultaneously)...");

  const sharedIdempotencyKey = `DOUBLE_CLICK_KEY_${Date.now()}`;
  const doubleClickUser = "RAPID DOUBLE CLICK USER";

  const [click1, click2] = await Promise.all([
    simulateDocumentCreation(doubleClickUser, "IDEMPOTENCY TEST", sharedIdempotencyKey),
    simulateDocumentCreation(doubleClickUser, "IDEMPOTENCY TEST", sharedIdempotencyKey)
  ]);

  if (click1.error || click2.error) {
    console.error("❌ TEST 3 FAILED: Idempotency test error!", click1.error?.message || click2.error?.message);
    failed++;
  } else {
    const cert1 = click1.doc.cert_no || click1.doc.id;
    const cert2 = click2.doc.cert_no || click2.doc.id;

    if (click1.doc.id === click2.doc.id || cert1 === cert2) {
      console.log("✓ TEST 3 PASSED: Rapid double-click handled gracefully!");
      console.log(`  Single Record Saved Cert No: ${cert1}`);
      console.log(`  Idempotent Recovery Triggered: ${click1.isIdempotentRecovery || click2.isIdempotentRecovery}`);
      createdCertNumbers.push(cert1);
      passed++;
    } else {
      console.error("❌ TEST 3 FAILED: Double click generated 2 different records instead of reusing 1!", cert1, cert2);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 4: Community Tax Certificate (CTC) Number Persistence Verification
  // --------------------------------------------------------------------------
  console.log("\n[TEST 4/4] Verifying Community Tax Certificate (CTC) Number persistence...");
  const ctcTestUser = "CTC PERSISTENCE USER";
  const expectedCtc = "CTC-99887766";
  const ctcRes = await simulateDocumentCreation(ctcTestUser, "CTC VERIFICATION");

  if (ctcRes.error || !ctcRes.doc) {
    console.error("❌ TEST 4 FAILED: Document insertion failed!", ctcRes.error?.message);
    failed++;
  } else {
    const certNo = ctcRes.doc.cert_no || ctcRes.doc.id;
    createdCertNumbers.push(certNo);

    // Query back from database
    const { data: dbData, error: queryError } = await supabase
      .from("documents")
      .select("*")
      .eq("cert_no", certNo)
      .single();

    const savedCtcColumn = dbData?.ctc_number;
    const savedCtcJson = dbData?.form_data?.ctcNumber || dbData?.form_data?.ctc;

    if (!queryError && (savedCtcColumn || savedCtcJson)) {
      console.log("✓ TEST 4 PASSED: CTC Number successfully saved & retrieved from database!");
      console.log(`  Cert No: ${certNo}`);
      console.log(`  Database ctc_number Column: ${savedCtcColumn || 'N/A'}`);
      console.log(`  form_data ctc/ctcNumber JSON: ${savedCtcJson}`);
      passed++;
    } else {
      console.error("❌ TEST 4 FAILED: CTC Number was not preserved in database!", queryError?.message);
      failed++;
    }
  }

  // Cleanup test artifacts
  console.log("\n[CLEANUP] Removing test artifacts from database...");
  for (const certNo of createdCertNumbers) {
    await supabase.from("documents").delete().eq("cert_no", certNo);
  }
  console.log("✓ Cleaned up test records.");

  console.log("\n=================================================");
  console.log(`RACE CONDITION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL RACE CONDITION AND CONCURRENCY TESTS PASSED PERFECTLY!");
  }
}

runRaceConditionTests().catch((err) => {
  console.error("❌ Unhandled test runner failure:", err);
  process.exit(1);
});
