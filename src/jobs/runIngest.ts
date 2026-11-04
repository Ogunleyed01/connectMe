import { pathToFileURL } from "node:url";
import { fetchAllInternshipSources } from "../ingest/sources/index.js";
import { parseJobPostingWithGemini } from "../ingest/geminiParser.js";
import { calculatePriorityScore } from "../ingest/scorer.js";
import { upsertInternship, generateUrlHash } from "../db/queries.js";
import { supabase } from "../db/client.js";
import { verifyJobUrl } from "../utils/urlVerifier.js";
import { isPlaceholderOrMockUrl } from "../utils/security.js";

export async function runIngestionPipeline() {
  console.log("==================================================");
  console.log(" 🌐 Ingesting & Normalizing 2027 Internship Feeds ");
  console.log("==================================================");

  // 1. Fetch raw listings across all real-world scrapers
  const feeds = await fetchAllInternshipSources();
  console.log(`\n📋 Evaluating ${feeds.length} candidate postings against existing records...`);

  // 2. Fetch existing url_hashes from Supabase to avoid redundant AI parsing calls
  const existingHashes = new Set<string>();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("internships")
        .select("url_hash");

      if (!error && Array.isArray(data)) {
        data.forEach((r: { url_hash: string }) => existingHashes.add(r.url_hash));
      }
    } catch (err) {
      console.warn("[Ingestion] Could not load existing hashes from DB:", err);
    }
  }

  let newCount = 0;
  let skippedCount = 0;
  let rejectedDeadCount = 0;

  for (const feed of feeds) {
    // 3. Reject any placeholder / mock URLs
    if (isPlaceholderOrMockUrl(feed.applyUrl)) {
      console.warn(`⚠️ Rejected placeholder / mock URL: ${feed.applyUrl}`);
      rejectedDeadCount++;
      continue;
    }

    const hash = generateUrlHash(feed.applyUrl);

    if (existingHashes.has(hash)) {
      skippedCount++;
      continue;
    }

    // 4. Double-check live URL reachability before AI parsing and saving
    const urlCheck = await verifyJobUrl(feed.applyUrl, 5000);
    if (!urlCheck.isValid) {
      console.warn(`❌ Link verification failed for [${feed.company}] - ${feed.title} (${urlCheck.reason}): ${feed.applyUrl}`);
      rejectedDeadCount++;
      continue;
    }

    try {
      console.log(`\n🔍 Parsing Verified Match: [${feed.company}] - ${feed.title}...`);

      const parsed = await parseJobPostingWithGemini(feed.rawText, {
        defaultCompany: feed.company,
        defaultTitle: feed.title,
        applyUrl: feed.applyUrl,
      });

      const priority_score = calculatePriorityScore({
        requires_national_id: parsed.requires_national_id,
        has_stipend: parsed.has_stipend,
        target_year: parsed.target_year || 2027,
        location_category: parsed.location_category,
        deadline: parsed.deadline || feed.deadlineHint,
      });

      const record = await upsertInternship({
        title: parsed.title,
        company: parsed.company,
        source_name: feed.source,
        apply_url: feed.applyUrl,
        url_hash: hash,
        course_tags: parsed.course_tags,
        role_category: parsed.role_category,
        tech_stack: parsed.tech_stack,
        location_category: parsed.location_category,
        work_mode: parsed.work_mode,
        city_or_country: parsed.city_or_country || feed.locationHint || "Remote",
        has_stipend: parsed.has_stipend,
        stipend_note: parsed.stipend_note,
        requires_national_id: parsed.requires_national_id,
        id_requirement_note: parsed.id_requirement_note,
        target_year: parsed.target_year || 2027,
        start_date: parsed.start_date,
        deadline: parsed.deadline || feed.deadlineHint,
        summary_bullets: parsed.summary_bullets,
        priority_score,
        is_active: true,
      });

      existingHashes.add(hash);
      console.log(`✅ Upserted ${record.title} (Short ID: ${record.short_id}, Priority: ${record.priority_score}/100)`);
      newCount++;
    } catch (err: any) {
      console.error(`❌ Ingest failed for ${feed.title}:`, err?.message || err);
    }
  }

  console.log(`\n🏁 Ingestion pipeline complete!`);
  console.log(`   • Newly indexed & scored: ${newCount}`);
  console.log(`   • Already present in DB:  ${skippedCount}`);
  console.log(`   • Rejected dead/mock URLs: ${rejectedDeadCount}`);
}

// Execute if run from CLI
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runIngestionPipeline()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Ingestion failed:", err);
      process.exit(1);
    });
}
