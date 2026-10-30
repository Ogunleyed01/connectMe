import { ScrapedJobListing } from "./types.js";

// Tech companies on Greenhouse with global remote / EMEA technical internship programs
const GREENHOUSE_BOARDS = [
  "canonical",
  "cloudflare",
  "gitlab",
  "automattic",
  "datadog",
  "mongodb",
];

export async function scrapeGreenhouseJobs(): Promise<ScrapedJobListing[]> {
  console.log("🌿 [Scraper: Greenhouse] Querying public company boards...");
  const listings: ScrapedJobListing[] = [];

  for (const board of GREENHOUSE_BOARDS) {
    try {
      const url = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, {
        headers: { "User-Agent": "ConnectMe-InternTracker-Bot/1.0" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) continue;

      const data = (await res.json()) as any;
      const jobs = data.jobs || [];

      for (const job of jobs) {
        const title = (job.title || "").trim();
        const lowerTitle = title.toLowerCase();

        // Check if role is an internship
        if (
          lowerTitle.includes("intern") ||
          lowerTitle.includes("internship") ||
          lowerTitle.includes("co-op") ||
          lowerTitle.includes("student") ||
          lowerTitle.includes("apprentice")
        ) {
          const location = job.location?.name || "Global Remote";
          const applyUrl = job.absolute_url;

          // Strip HTML tags for clean rawText
          const cleanDesc = (job.content || "")
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          const companyName = capitalize(board);

          listings.push({
            company: companyName,
            title,
            source: `greenhouse_${board}`,
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
      console.warn(`[Greenhouse Scraper] Could not fetch ${board}: ${err?.message || err}`);
    }
  }

  console.log(`🌿 [Greenhouse Scraper] Found ${listings.length} verified internship positions.`);
  return listings;
}

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
