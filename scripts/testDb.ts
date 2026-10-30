import { supabase } from "../src/db/client.js";
import { env } from "../src/config/env.js";

async function verifyDatabase() {
  console.log("==================================================");
  console.log(" 🔍 Supabase Connection & Schema Verifier         ");
  console.log("==================================================");

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("\n❌ [Missing Supabase Credentials]");
    console.error("Please add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env file.");
    process.exit(1);
  }

  if (!supabase) {
    console.error("❌ Failed to initialize Supabase client.");
    process.exit(1);
  }

  console.log(`📡 Connecting to: ${env.SUPABASE_URL} ...\n`);

  try {
    // 1. Check 'users' table
    process.stdout.write("Checking 'users' table... ");
    const { count: usersCount, error: usersErr } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });
    if (usersErr) throw new Error(`users table error: ${usersErr.message}`);
    console.log(`✅ OK (Row count: ${usersCount ?? 0})`);

    // 2. Check 'internships' table
    process.stdout.write("Checking 'internships' table... ");
    const { count: internCount, error: internErr } = await supabase
      .from("internships")
      .select("*", { count: "exact", head: true });
    if (internErr) throw new Error(`internships table error: ${internErr.message}`);
    console.log(`✅ OK (Row count: ${internCount ?? 0})`);

    // 3. Check 'user_applications' table
    process.stdout.write("Checking 'user_applications' table... ");
    const { count: appCount, error: appErr } = await supabase
      .from("user_applications")
      .select("*", { count: "exact", head: true });
    if (appErr) throw new Error(`user_applications table error: ${appErr.message}`);
    console.log(`✅ OK (Row count: ${appCount ?? 0})`);

    // 4. Check RPC function 'get_daily_user_digest'
    process.stdout.write("Checking RPC function 'get_daily_user_digest'... ");
    const { error: rpcErr } = await supabase.rpc("get_daily_user_digest", {
      p_telegram_id: 1,
      p_limit: 1,
    });
    if (rpcErr) throw new Error(`RPC error: ${rpcErr.message}`);
    console.log("✅ OK");

    console.log("\n🎉 Supabase database and schema are 100% verified and operational!");
  } catch (err: any) {
    console.error("\n❌ Database verification failed:");
    console.error(err.message || err);
    console.error("\n💡 Tip: Did you paste and execute the entire contents of 'supabase/schema.sql' in the Supabase SQL Editor?");
    process.exit(1);
  }
}

verifyDatabase().catch((err) => {
  console.error("Fatal verification error:", err);
  process.exit(1);
});
