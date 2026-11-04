import { ScrapedJobListing } from "./types.js";
import { isGenuineInternship } from "../matcher.js";
import { batchVerifyUrls } from "../../utils/urlVerifier.js";

export async function scrapeRemoteTechInternships(): Promise<ScrapedJobListing[]> {
  console.log("🌐 [Scraper: Global Remote APIs] Querying verified remote job feeds...");
  const candidates: ScrapedJobListing[] = [];

  // 1. Jobicy Remote Internship API
  try {
    const res = await fetch("https://jobicy.com/api/v2/remote-jobs?count=25&tag=intern", {
      headers: { "User-Agent": "ConnectMe-InternTracker-Bot/2.0" },
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      const jobs = data.jobs || [];
      for (const j of jobs) {
        const title = (j.jobTitle || "").trim();
        if (!isGenuineInternship(title, j.jobDescription)) continue;

        const company = j.companyName || "Global Tech";
        const applyUrl = j.url;
        if (!applyUrl || !applyUrl.startsWith("http")) continue;

        candidates.push({
          company,
          title,
          source: "jobicy_remote",
          applyUrl,
          locationHint: "Worldwide Remote (Eligible for Africa)",
          rawText: `
Company: ${company}
Title: ${title}
Location: Worldwide Remote
Target Intake: 2027 / 2026 Remote Internship
Application Link: ${applyUrl}
          `.trim(),
        });
      }
    }
  } catch (err: any) {
    console.warn(`[Remote API Scraper] Jobicy query failed: ${err?.message || err}`);
  }

  // Live URL verification step
  console.log(`🌐 [Remote API Scraper] Verifying link liveness for ${candidates.length} candidates...`);
  const verified = await batchVerifyUrls(candidates, 5, 5000);
  console.log(`🌐 [Remote API Scraper] Extracted ${verified.length} verified live remote internships.`);
  return verified;
}
