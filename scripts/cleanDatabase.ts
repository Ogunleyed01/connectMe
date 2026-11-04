import { supabase } from "../src/db/client.js";
import { verifyJobUrl } from "../src/utils/urlVerifier.js";
import { isPlaceholderOrMockUrl } from "../src/utils/security.js";
import { isGenuineInternship } from "../src/ingest/matcher.js";

async function cleanDatabase() {
  console.log("==================================================");
  console.log(" 🧹 Cleaning & Sanitizing Internships Database   ");
  console.log("==================================================");

  if (!supabase) {
    console.error("Supabase client is not available.");
    return;
  }

  const { data: internships, error } = await supabase
    .from("internships")
    .select("id, short_id, title, company, apply_url, source_name, is_active");

  if (error || !internships) {
    console.error("Failed to query internships:", error);
    return;
  }

  console.log(`Auditing ${internships.length} database entries...`);

  const idsToDeactivate: string[] = [];
  const idsToDelete: string[] = [];

  for (let i = 0; i < internships.length; i++) {
    const item = internships[i];
    const url = item.apply_url || "";
    const title = item.title || "";

    // 1. Is it a mock or test item?
    if (
      isPlaceholderOrMockUrl(url) ||
      item.source_name === "test" ||
      url.includes("example.com")
    ) {
      idsToDelete.push(item.id);
      continue;
    }

    // 2. Is it a false positive title? (e.g. Internal Auditor)
    if (!isGenuineInternship(title)) {
      console.log(`[False positive title] ${item.company} - ${title}`);
      idsToDeactivate.push(item.id);
      continue;
    }

    // 3. Known fake URLs
    if (
      url.includes("/internships-2027") ||
      url.includes("/cloud-intern-2027") ||
      url.includes("/2027-adc-swe") ||
      url.includes("/it-intern-2027") ||
      url.includes("/data-intern-2027") ||
      url.includes("/design-intern-2027")
    ) {
      console.log(`[Known fake URL] ${item.company} - ${title}: ${url}`);
      idsToDeactivate.push(item.id);
      continue;
    }

    // 4. Live network check
    const check = await verifyJobUrl(url, 4000);
    if (!check.isValid) {
      console.log(`[Dead URL ${check.status || check.reason}] ${item.company} - ${title}: ${url}`);
      idsToDeactivate.push(item.id);
    }
  }

  console.log(`\nFound:`);
  console.log(`  • Mock/Test IDs to Delete: ${idsToDelete.length}`);
  console.log(`  • 404/Dead/False-positive IDs to Deactivate: ${idsToDeactivate.length}`);

  if (idsToDelete.length > 0) {
    // Delete test applications first
    await supabase.from("user_applications").delete().in("internship_id", idsToDelete);
    const { error: delErr } = await supabase.from("internships").delete().in("id", idsToDelete);
    if (delErr) console.error("Error deleting test items:", delErr);
    else console.log(`🗑️ Deleted ${idsToDelete.length} mock/test entries.`);
  }

  if (idsToDeactivate.length > 0) {
    // Mark as inactive
    const { error: deactErr } = await supabase
      .from("internships")
      .update({ is_active: false })
      .in("id", idsToDeactivate);
    if (deactErr) console.error("Error deactivating items:", deactErr);
    else console.log(`🔒 Deactivated ${idsToDeactivate.length} dead/broken entries.`);

    // Clear unacted/sent applications for deactivated entries so users aren't stuck with 404 cards
    const { error: appErr } = await supabase
      .from("user_applications")
      .delete()
      .in("internship_id", idsToDeactivate)
      .in("status", ["queued", "sent"]);
    if (appErr) console.warn("Notice: user applications cleanup:", appErr.message);
  }

  // Count remaining active listings
  const { count: activeCount } = await supabase
    .from("internships")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  console.log(`\n✅ Database sanitization complete! Active verified listings remaining: ${activeCount ?? 0}`);
}

cleanDatabase().catch(console.error);
