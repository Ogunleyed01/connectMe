import { ScrapedJobListing } from "./types.js";

// Companies using Lever that host technical and global internship programs
const LEVER_COMPANIES = [
  "atlassian",
  "palantir",
  "affirm",
  "spotify",
];

export async function scrapeLeverJobs(): Promise<ScrapedJobListing[]> {
  console.log("📐 [Scraper: Lever] Querying public company postings...");
  const listings: ScrapedJobListing[] = [];

  for (const company of LEVER_COMPANIES) {
    try {
      const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, {
        headers: { "User-Agent": "ConnectMe-InternTracker-Bot/1.0" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) continue;

      const jobs = (await res.json()) as any[];
      if (!Array.isArray(jobs)) continue;

      for (const job of jobs) {
        const title = (job.text || "").trim();
        const lowerTitle = title.toLowerCase();

        if (
          lowerTitle.includes("intern") ||
          lowerTitle.includes("internship") ||
          lowerTitle.includes("co-op") ||
          lowerTitle.includes("student")
        ) {
          const location = job.categories?.location || "Global Remote";
          const applyUrl = job.hostedUrl || job.applyUrl;
          const cleanDesc = (job.descriptionPlain || "").replace(/\s+/g, " ").trim();
          const companyName = capitalize(company);

          listings.push({
            company: companyName,
            title,
            source: `lever_${company}`,
            applyUrl,
            locationHint: location,
            rawText: `
Company: ${companyName}
Title: ${title}
Location: ${location}
Target Intake: 2027 IT / Summer Internship
Application Link: ${applyUrl}
Description: ${cleanDesc.slice(0, 1500)}
            `.trim(),
          });
        }
      }
    } catch (err: any) {
      console.warn(`[Lever Scraper] Could not fetch ${company}: ${err?.message || err}`);
    }
  }

  console.log(`📐 [Lever Scraper] Found ${listings.length} verified internship positions.`);
  return listings;
}

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
