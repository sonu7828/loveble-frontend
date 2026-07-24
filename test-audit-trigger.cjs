const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf-8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l.includes('=')).map(l => l.split('=').map(s => s.trim().replace(/^"|"$/g, ''))));
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase URL or service role key");
  process.exit(1);
}

const supa = createClient(supabaseUrl, supabaseKey);

async function testAuditTrigger() {
  console.log("Testing HIPAA Audit Trigger (Service Role)...");

  // 1. Insert a dummy audit log
  const { data: inserted, error: insErr } = await supa.from("clinical_audit_log").insert({
    resource_type: 'gfe',
    resource_id: '00000000-0000-0000-0000-000000000000',
    action: 'view',
    metadata: { test: true }
  }).select("id").single();

  if (insErr) {
    console.error("Failed to insert dummy audit log:", insErr.message);
    process.exit(1);
  }

  console.log("Successfully inserted dummy audit log ID:", inserted.id);

  // 2. Try to update it
  console.log("Attempting to UPDATE dummy audit log...");
  const { error: updErr } = await supa.from("clinical_audit_log")
    .update({ action: 'create' })
    .eq("id", inserted.id);

  if (updErr) {
    console.log("✅ UPDATE blocked as expected! Error:", updErr.message);
  } else {
    console.error("❌ UPDATE succeeded! Trigger did NOT block it.");
    process.exit(1);
  }

  // 3. Try to delete it
  console.log("Attempting to DELETE dummy audit log...");
  const { error: delErr } = await supa.from("clinical_audit_log")
    .delete()
    .eq("id", inserted.id);

  if (delErr) {
    console.log("✅ DELETE blocked as expected! Error:", delErr.message);
  } else {
    console.error("❌ DELETE succeeded! Trigger did NOT block it.");
    process.exit(1);
  }

  console.log("HIPAA triggers verified successfully.");
}

testAuditTrigger();
