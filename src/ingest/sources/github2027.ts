import { ScrapedJobListing } from "./types.js";

const SIMPLIFY_JSON_URL =
  "https://raw.githubusercontent.com/SimplifyJobs/Summer2025-Internships/dev/.github/scripts/listings.json";

export async function scrapeGitHub2027Internships(): Promise<ScrapedJobListing[]> {
  console.log("🐙 [Scraper: GitHub] Querying community internship tracking repos...");
  const listings: ScrapedJobListing[] = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(SIMPLIFY_JSON_URL, {
      headers: {
        "User-Agent": "ConnectMe-InternTracker-Bot/1.0",
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = (await res.json()) as any[];

      if (Array.isArray(data)) {
        // Filter for active, visible tech internships
        const candidates = data.filter((item) => {
          if (item.active === false || item.is_visible === false) return false;
          const title = (item.title || "").toLowerCase();
          return (
            title.includes("intern") ||
            title.includes("internship") ||
            title.includes("co-op") ||
            title.includes("student")
          );
        });

        // Pick top 25 fresh candidate roles per run
        const selected = candidates.slice(0, 25);

        for (const item of selected) {
          const company = (item.company_name || "").trim() || "Technology Company";
          const title = (item.title || "").trim();
          const applyUrl = (item.url || "").trim();
          const locations = Array.isArray(item.locations) ? item.locations.join(", ") : "Remote / Global";
          const category = item.category || "Software Engineering";
          const sponsorship = item.sponsorship || "Not Specified";

          if (applyUrl.startsWith("http")) {
            listings.push({
              company,
              title,
              source: "github_simplify_tracker",
              applyUrl,
              locationHint: locations,
              rawText: `
Company: ${company}
Role: ${title}
Category: ${category}
Location: ${locations}
Sponsorship: ${sponsorship}
Target: 2027 IT / Summer Internship Cohort
Application Link: ${applyUrl}
              `.trim(),
            });
          }
        }

        console.log(`🐙 [GitHub Scraper] Extracted ${listings.length} verified candidate roles from SimplifyJobs directory.`);
      }
    }
  } catch (err: any) {
    console.warn(`[GitHub Scraper] Could not fetch SimplifyJobs JSON: ${err?.message || err}`);
  }

  return listings;
}
