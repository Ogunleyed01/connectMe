import { ScrapedJobListing } from "./types.js";
import { isGenuineInternship, detectTargetYear } from "../matcher.js";
import { batchVerifyUrls } from "../../utils/urlVerifier.js";

const LEVER_COMPANIES = ["atlassian", "palantir", "affirm", "spotify"];

export async function scrapeLeverJobs(): Promise<ScrapedJobListing[]> {
  console.log("📐 [Scraper: Lever] Querying public company postings for internships...");
  const candidates: ScrapedJobListing[] = [];

  for (const company of LEVER_COMPANIES) {
    try {
      const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, {
        headers: { "User-Agent": "ConnectMe-InternTracker-Bot/2.0" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) continue;

      const jobs = (await res.json()) as any[];
      if (!Array.isArray(jobs)) continue;

      for (const job of jobs) {
        const title = (job.text || "").trim();

        // Strict qualification: rejects "Internal Auditor", etc.
        if (!isGenuineInternship(title, job.descriptionPlain)) {
          continue;
        }

        const location = job.categories?.location || "Global Remote";
        const applyUrl = job.hostedUrl || job.applyUrl;
        if (!applyUrl || typeof applyUrl !== "string") continue;

        const cleanDesc = (job.descriptionPlain || "").replace(/\s+/g, " ").trim();
        const companyName = capitalize(company);
        const targetYear = detectTargetYear(title, cleanDesc);

        candidates.push({
          company: companyName,
          title,
          source: `lever_${company}`,
          applyUrl,
          locationHint: location,
          rawText: `
Company: ${companyName}
Title: ${title}
Location: ${location}
Target Intake: ${targetYear} Summer Internship
Application Link: ${applyUrl}
Description: ${cleanDesc.slice(0, 1500)}
          `.trim(),
        });
      }
    } catch (err: any) {
      console.warn(`[Lever Scraper] Could not fetch ${company}: ${err?.message || err}`);
    }
  }

  // Live URL verification step
  console.log(`📐 [Lever Scraper] Verifying link liveness for ${candidates.length} candidates...`);
  const verified = await batchVerifyUrls(candidates, 5, 5000);
  console.log(`📐 [Lever Scraper] Found ${verified.length} verified live internship positions.`);
  return verified;
}

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
