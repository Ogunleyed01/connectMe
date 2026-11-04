import { ScrapedJobListing } from "./types.js";
import { isGenuineInternship, detectTargetYear } from "../matcher.js";
import { batchVerifyUrls } from "../../utils/urlVerifier.js";

// Top technology companies on Greenhouse with active student internships
const GREENHOUSE_BOARDS = [
  "figma",
  "lyft",
  "cloudflare",
  "canonical",
  "datadog",
  "mongodb",
  "stripe",
  "elastic",
];

export async function scrapeGreenhouseJobs(): Promise<ScrapedJobListing[]> {
  console.log("🌿 [Scraper: Greenhouse] Querying verified company boards for 2027/2026 internships...");
  const candidates: ScrapedJobListing[] = [];

  for (const board of GREENHOUSE_BOARDS) {
    try {
      const url = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, {
        headers: { "User-Agent": "ConnectMe-InternTracker-Bot/2.0" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) continue;

      const data = (await res.json()) as any;
      const jobs = data.jobs || [];

      for (const job of jobs) {
        const title = (job.title || "").trim();

        // Strict qualification: rejects "Internal Auditor", etc.
        if (!isGenuineInternship(title, job.content)) {
          continue;
        }

        const location = job.location?.name || "Global Remote";
        const applyUrl = job.absolute_url;
        if (!applyUrl || typeof applyUrl !== "string") continue;

        const cleanDesc = (job.content || "")
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        const companyName = capitalize(board);
        const targetYear = detectTargetYear(title, cleanDesc);

        candidates.push({
          company: companyName,
          title,
          source: `greenhouse_${board}`,
          applyUrl,
          locationHint: location,
          rawText: `
Company: ${companyName}
Title: ${title}
Location: ${location}
Target Intake: ${targetYear} Summer Internship / IT Placement
Application Link: ${applyUrl}
Description: ${cleanDesc.slice(0, 1500)}
          `.trim(),
        });
      }
    } catch (err: any) {
      console.warn(`[Greenhouse Scraper] Could not fetch ${board}: ${err?.message || err}`);
    }
  }

  // Live URL verification step
  console.log(`🌿 [Greenhouse Scraper] Verifying link liveness for ${candidates.length} candidates...`);
  const verified = await batchVerifyUrls(candidates, 5, 5000);
  console.log(`🌿 [Greenhouse Scraper] Found ${verified.length} verified live internship positions.`);
  return verified;
}

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
