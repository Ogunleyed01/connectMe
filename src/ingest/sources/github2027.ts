import { ScrapedJobListing } from "./types.js";
import { isGenuineInternship, detectTargetYear } from "../matcher.js";
import { batchVerifyUrls } from "../../utils/urlVerifier.js";

const SIMPLIFY_2027_JSON_URL =
  "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json";

export async function scrapeGitHub2027Internships(): Promise<ScrapedJobListing[]> {
  console.log("🐙 [Scraper: GitHub 2027] Querying verified Summer 2027 community directory...");
  const candidates: ScrapedJobListing[] = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(SIMPLIFY_2027_JSON_URL, {
      headers: {
        "User-Agent": "ConnectMe-InternTracker-Bot/2.0",
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = (await res.json()) as any[];

      if (Array.isArray(data)) {
        // Filter for active, visible tech internships targeting 2027 / Summer
        const filtered = data.filter((item) => {
          if (item.active === false || item.is_visible === false) return false;
          if (!item.url || typeof item.url !== "string" || !item.url.startsWith("http")) return false;

          const title = item.title || "";
          if (!isGenuineInternship(title)) return false;

          // Check terms: prioritize 2027, 2026/2027
          const terms = Array.isArray(item.terms) ? item.terms.join(" ") : "";
          const is2027 =
            terms.includes("2027") ||
            terms.includes("2026") ||
            title.includes("2027") ||
            (item.date_posted && item.date_posted > 1700000000);

          return is2027;
        });

        // Sort by newest date_posted first
        filtered.sort((a, b) => (b.date_posted || 0) - (a.date_posted || 0));

        // Take top 40 candidates for live URL verification
        const pool = filtered.slice(0, 40);

        for (const item of pool) {
          const company = (item.company_name || "").trim() || "Technology Organization";
          const title = (item.title || "").trim();
          const applyUrl = item.url.trim();
          const locations = Array.isArray(item.locations) ? item.locations.join(", ") : "Remote / Global";
          const category = item.category || "Software Engineering";
          const sponsorship = item.sponsorship || "Not Specified";
          const targetYear = detectTargetYear(title, `${termsText(item.terms)} 2027`);

          candidates.push({
            company,
            title,
            source: "github_simplify_2027",
            applyUrl,
            locationHint: locations,
            rawText: `
Company: ${company}
Title: ${title}
Category: ${category}
Location: ${locations}
Sponsorship: ${sponsorship}
Target Cohort: ${targetYear} Summer / Industrial Training
Application Link: ${applyUrl}
            `.trim(),
          });
        }
      }
    }
  } catch (err: any) {
    console.warn(`[GitHub Scraper] Could not fetch Summer 2027 JSON: ${err?.message || err}`);
  }

  // Live URL verification: reject any candidate whose apply link is broken or 404
  console.log(`🐙 [GitHub Scraper] Verifying link liveness for ${candidates.length} candidate listings...`);
  const verifiedListings = await batchVerifyUrls(candidates, 5, 5000);
  console.log(`🐙 [GitHub Scraper] Verified ${verifiedListings.length} live active 2027 internships.`);

  return verifiedListings;
}

function termsText(terms: any): string {
  if (Array.isArray(terms)) return terms.join(" ");
  return typeof terms === "string" ? terms : "";
}
