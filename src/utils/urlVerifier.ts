import { isValidHttpsUrl, isPlaceholderOrMockUrl } from "./security.js";

export interface UrlVerificationResult {
  isValid: boolean;
  status?: number;
  reason?: string;
  finalUrl?: string;
}

const COMMON_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/**
  * Tests if a candidate internship application link is live, reachable,
  * and not returning 404/error or pointing to a placeholder domain.
  */
export async function verifyJobUrl(
  url: string,
  timeoutMs: number = 6000
): Promise<UrlVerificationResult> {
  if (!url || typeof url !== "string") {
    return { isValid: false, reason: "Empty or invalid URL string" };
  }

  const cleanUrl = url.trim();

  // 1. Basic security & placeholder validation
  if (!isValidHttpsUrl(cleanUrl)) {
    return { isValid: false, reason: "Insecure protocol or blocked hostname" };
  }

  if (isPlaceholderOrMockUrl(cleanUrl)) {
    return { isValid: false, reason: "Placeholder or mock domain" };
  }

  // Known invalid/mock patterns in paths
  const lowerUrl = cleanUrl.toLowerCase();
  if (
    lowerUrl.includes("example.com") ||
    lowerUrl.includes("/internships-2027") ||
    lowerUrl.includes("/cloud-intern-2027") ||
    lowerUrl.includes("/design-intern-2027") ||
    lowerUrl.includes("/product-design-intern-2027") ||
    lowerUrl.includes("/data-intern-2027") ||
    lowerUrl.includes("/interns-2027") ||
    lowerUrl.includes("/it-intern-2027") ||
    lowerUrl.includes("/2027-adc-swe") ||
    lowerUrl.includes("frontend-intern-2027")
  ) {
    return { isValid: false, reason: "Matches known fake/mock URL pattern" };
  }

  // 2. Perform live network verification
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      // First try HEAD (efficient, no body downloaded)
      res = await fetch(cleanUrl, {
        method: "HEAD",
        headers: COMMON_HEADERS,
        signal: controller.signal,
        redirect: "follow",
      });

      // Some ATS/job boards reject HEAD with 405 Method Not Allowed or 403 Forbidden
      if (res.status === 405 || res.status === 403 || res.status === 400) {
        res = await fetch(cleanUrl, {
          method: "GET",
          headers: COMMON_HEADERS,
          signal: controller.signal,
          redirect: "follow",
        });
      }
    } catch {
      // Retry with GET on error
      res = await fetch(cleanUrl, {
        method: "GET",
        headers: COMMON_HEADERS,
        signal: controller.signal,
        redirect: "follow",
      });
    } finally {
      clearTimeout(timer);
    }

    // 404 Not Found, 410 Gone, 500 Internal Error = INVALID
    if (res.status === 404 || res.status === 410 || res.status >= 500) {
      return {
        isValid: false,
        status: res.status,
        reason: `HTTP ${res.status} response`,
      };
    }

    // Final URL check after redirects
    if (res.url) {
      const redirectedUrl = res.url.toLowerCase();
      if (
        redirectedUrl.includes("example.com") ||
        redirectedUrl.includes("/404") ||
        redirectedUrl.includes("/not-found") ||
        redirectedUrl.includes("/expired") ||
        redirectedUrl.includes("/closed")
      ) {
        return {
          isValid: false,
          status: res.status,
          reason: `Redirected to dead-end URL: ${res.url}`,
        };
      }
    }

    // Accept 200..399 and 401/403 (some portals like Workday or LinkedIn require auth headers but are live)
    return {
      isValid: true,
      status: res.status,
      finalUrl: res.url || cleanUrl,
    };
  } catch (err: any) {
    // Network abort, DNS failure, connection refused
    return {
      isValid: false,
      reason: err?.name === "AbortError" ? "Request timed out" : (err?.message || "Network error"),
    };
  }
}

/**
 * Verifies a collection of URLs with bounded concurrency to prevent socket exhaustion.
 */
export async function batchVerifyUrls<T extends { applyUrl: string }>(
  items: T[],
  concurrency: number = 5,
  timeoutMs: number = 6000
): Promise<T[]> {
  const verified: T[] = [];
  const queue = [...items];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const check = await verifyJobUrl(item.applyUrl, timeoutMs);
      if (check.isValid) {
        verified.push(item);
      } else {
        console.warn(`[URL Verifier] Filtered out invalid URL (${check.reason}): ${item.applyUrl}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  return verified;
}
