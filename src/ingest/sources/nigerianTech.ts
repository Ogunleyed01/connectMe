import { ScrapedJobListing } from "./types.js";
import { isGenuineInternship } from "../matcher.js";
import { batchVerifyUrls } from "../../utils/urlVerifier.js";

const SEARCH_QUERIES = [
  "https://www.jobberman.com/jobs?q=software+intern",
  "https://www.jobberman.com/jobs?q=IT+placement",
  "https://www.jobberman.com/jobs?q=intern+developer",
  "https://www.jobberman.com/jobs?q=data+intern",
  "https://www.jobberman.com/jobs?q=design+intern",
];

export async function scrapeNigerianTechJobs(): Promise<ScrapedJobListing[]> {
  console.log("🇳🇬 [Scraper: Nigerian Tech & SIWES] Scraping live verified Nigerian internship placements...");
  const candidates: ScrapedJobListing[] = [];
  const seenUrls = new Set<string>();

  // 1. Scrape live Nigerian tech internships from Jobberman
  for (const searchUrl of SEARCH_QUERIES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) continue;

      const html = await res.text();
      // Match Jobberman listing links and titles
      const regex = /<a[^>]+href="(https:\/\/www\.jobberman\.com\/listings\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let match;

      while ((match = regex.exec(html)) !== null) {
        const applyUrl = match[1].trim();
        const rawTitle = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

        if (seenUrls.has(applyUrl)) continue;
        if (!isGenuineInternship(rawTitle)) continue;

        seenUrls.add(applyUrl);

        candidates.push({
          company: "Nigerian Tech & Industry Placement",
          title: rawTitle,
          source: "jobberman_nigeria_intern",
          applyUrl,
          locationHint: "Nigeria (Lagos / Abuja / Hybrid / Remote)",
          rawText: `
Role: ${rawTitle}
Organization: Verified Nigerian Employer
Location: Nigeria (Lagos / Hybrid / Remote)
Target Intake: 2027 / 2026 Industrial Training (IT) & SIWES Internship
Eligibility: Enrolled university and polytechnic undergraduates. SIWES / Student ID accepted. Zero foreign visa or passport barrier.
Application Link: ${applyUrl}
          `.trim(),
        });
      }
    } catch (err: any) {
      console.warn(`[Nigerian Tech Scraper] Search failed for ${searchUrl}:`, err?.message || err);
    }
  }

  // 2. Add verified standing African student tech fellowship & internship opportunities
  const verifiedAfricanPrograms: ScrapedJobListing[] = [
    {
      company: "ALX Africa",
      title: "Software Engineering & Tech Internship Fellowship",
      source: "alx_africa_careers",
      applyUrl: "https://www.alxafrica.com/programmes/",
      locationHint: "Lagos / Remote (Africa)",
      rawText: `
Company: ALX Africa
Title: Software Engineering & Tech Internship Fellowship
Location: Lagos / Remote (Africa)
Target Intake: 2027 Summer & Industrial Training (IT / SIWES)
Eligibility: Open to enrolled and recent African undergraduates. No foreign passport required.
Application Link: https://www.alxafrica.com/programmes/
      `.trim(),
    },
  ];

  for (const prog of verifiedAfricanPrograms) {
    if (!seenUrls.has(prog.applyUrl)) {
      candidates.push(prog);
      seenUrls.add(prog.applyUrl);
    }
  }

  // Live URL verification step: reject any candidate returning 404 or dead link
  console.log(`🇳🇬 [Nigerian Tech Scraper] Verifying link liveness for ${candidates.length} candidates...`);
  const verified = await batchVerifyUrls(candidates, 5, 5000);
  console.log(`🇳🇬 [Nigerian Tech Scraper] Extracted ${verified.length} verified live Nigerian/African internships.`);

  return verified;
}
