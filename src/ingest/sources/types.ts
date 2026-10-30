export interface ScrapedJobListing {
  company: string;
  title: string;
  source: string;
  applyUrl: string;
  rawText: string;
  locationHint?: string;
  deadlineHint?: string;
}
