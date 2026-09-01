const path = require('path');
const fs = require('fs');

// 1. Load environment variables from .env and .env.local
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
console.log("🧪 PRODUCTION DATABASE INTEGRATION TEST SUITE");
console.log("=================================================");

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ FAIL: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.");
  process.exit(1);
}

console.log("✓ Environment variables detected.");
console.log("  URL:", supabaseUrl);

const { createClient } = require(path.join(process.cwd(), 'node_modules', '@supabase', 'supabase-js'));
const supabase = createClient(supabaseUrl, supabaseKey);

async function runDatabaseTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: Public Anonymous Constituent Submission (No owner_id)
  console.log("\n[TEST 1/3] Testing public anonymous constituent document submission...");
  const testCertNo = `TEST-DOC-${Date.now()}`;
  const testOrNo = `TEST-OR-${Date.now()}`;
  
  const testPayload = {
    title: "AUTOMATED TEST CONSTITUENT",
    full_name: "AUTOMATED TEST CONSTITUENT",
    purpose: "INTEGRATION VERIFICATION",
    cert_no: testCertNo,
    or_number: testOrNo,
    form_data: {
      fullName: "AUTOMATED TEST CONSTITUENT",
      purpose: "INTEGRATION VERIFICATION",
      testTimestamp: new Date().toISOString()
    }
  };

  const { data: insertData, error: insertError } = await supabase
    .from("documents")
    .insert(testPayload)
    .select();

  if (insertError) {
    console.error("❌ TEST 1 FAILED: Could not insert document into Supabase!");
    console.error("   Error Code:", insertError.code);
    console.error("   Message:", insertError.message);
    if (insertError.message.includes("owner_id")) {
      console.error("   💡 FIX: Execute `ALTER TABLE public.documents ALTER COLUMN owner_id DROP NOT NULL;` in Supabase SQL Editor.");
    }
    failed++;
  } else {
    console.log("✓ TEST 1 PASSED: Public document successfully inserted to Supabase!");
    console.log("  Inserted ID:", insertData[0]?.id || insertData[0]?.cert_no);
    passed++;
  }

  // Test 2: Court Staff Cross-Device Lookup (Select policy verification)
  console.log("\n[TEST 2/3] Testing court staff cross-device document lookup...");
  const { data: selectData, error: selectError } = await supabase
    .from("documents")
    .select("*")
    .eq("cert_no", testCertNo);

  if (selectError) {
    console.error("❌ TEST 2 FAILED: Query returned error!", selectError.message);
    failed++;
  } else if (!selectData || selectData.length === 0) {
    console.error("❌ TEST 2 FAILED: Document was inserted but SELECT returned 0 rows!");
    console.error("   💡 FIX: Check RLS SELECT policy in `supabase/rls-policies.sql`.");
    failed++;
  } else {
    console.log("✓ TEST 2 PASSED: Court staff can query and verify registered documents across devices!");
    console.log("  Retrieved Full Name:", selectData[0].full_name);
    passed++;
  }

  // Test 3: Cleanup Test Artifacts
  console.log("\n[TEST 3/3] Cleaning up test records from database...");
  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("cert_no", testCertNo);

  if (deleteError) {
    console.warn("⚠️ TEST 3 WARNING: Clean up request returned notice:", deleteError.message);
  } else {
    console.log("✓ TEST 3 PASSED: Test records cleaned up cleanly.");
    passed++;
  }

  console.log("\n=================================================");
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("🚀 ALL PRODUCTION DATABASE INTEGRATION TESTS PASSED!");
  }
}

runDatabaseTests().catch((err) => {
  console.error("❌ Unhandled test runner failure:", err);
  process.exit(1);
});
