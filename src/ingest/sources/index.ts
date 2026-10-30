import { ScrapedJobListing } from "./types.js";
import { scrapeNigerianTechJobs } from "./nigerianTech.js";
import { scrapeGitHub2027Internships } from "./github2027.js";
import { scrapeGreenhouseJobs } from "./greenhouse.js";
import { scrapeLeverJobs } from "./lever.js";

export async function fetchAllInternshipSources(): Promise<ScrapedJobListing[]> {
  console.log("==================================================");
  console.log(" 🌐 Running Distributed Internship Scrapers       ");
  console.log("==================================================");

  const results: ScrapedJobListing[] = [];
  const seenUrls = new Set<string>();

  const scrapers = [
    { name: "Nigerian Tech & SIWES", fn: scrapeNigerianTechJobs },
    { name: "GitHub 2027 Repositories", fn: scrapeGitHub2027Internships },
    { name: "Greenhouse Public Boards", fn: scrapeGreenhouseJobs },
    { name: "Lever Public Boards", fn: scrapeLeverJobs },
  ];

  for (const scraper of scrapers) {
    try {
      const items = await scraper.fn();
      for (const item of items) {
        const norm = item.applyUrl.trim().toLowerCase().replace(/\/+$/, "");
        if (!seenUrls.has(norm)) {
          seenUrls.add(norm);
          results.push(item);
        }
      }
    } catch (err: any) {
      console.error(`❌ Scraper [${scraper.name}] failed:`, err?.message || err);
    }
  }

  console.log(`\n📦 Total unique candidate opportunities scraped: ${results.length}`);
  return results;
}
