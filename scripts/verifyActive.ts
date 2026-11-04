import { supabase } from "../src/db/client.js";
import { verifyJobUrl } from "../src/utils/urlVerifier.js";

async function verifyAllActive() {
  const { data } = await supabase
    .from("internships")
    .select("id, title, company, apply_url, source_name")
    .eq("is_active", true);

  if (!data) return;
  console.log(`Checking ${data.length} active listings...`);

  let invalidCount = 0;
  for (const item of data) {
    const res = await verifyJobUrl(item.apply_url, 4000);
    if (!res.isValid) {
      console.log(`[DEACTIVATING INVALID] ${item.company} - ${item.title} (${res.status || res.reason}): ${item.apply_url}`);
      await supabase.from("internships").update({ is_active: false }).eq("id", item.id);
      await supabase.from("user_applications").delete().eq("internship_id", item.id).in("status", ["queued", "sent"]);
      invalidCount++;
    }
  }

  const { count: finalActive } = await supabase
    .from("internships")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  console.log(`\nDeactivated ${invalidCount} newly detected dead links.`);
  console.log(`Total 100% verified active listings remaining: ${finalActive}`);
}

verifyAllActive().catch(console.error);
