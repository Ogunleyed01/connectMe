/**
 * Security and sanitization utilities for ConnectMe
 */

// Disallowed private/local IP ranges and hostnames
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "metadata.google.internal",
  "169.254.169.254", // Cloud metadata service IP
]);

/**
 * Validates that a candidate URL is a safe, publicly resolvable HTTPS address.
 * Prevents SSRF, javascript: execution, data: URI exploitation, and local network probes.
 */
export function isValidHttpsUrl(urlString?: string | null): boolean {
  if (!urlString || typeof urlString !== "string") return false;
  if (urlString.length > 2048) return false;

  try {
    const parsed = new URL(urlString.trim());

    // Only allow secure HTTPS protocol
    if (parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block known loopback and cloud metadata endpoints
    if (BLOCKED_HOSTNAMES.has(hostname)) {
      return false;
    }

    // Block private/internal domains
    if (
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".lan") ||
      hostname.endsWith(".home")
    ) {
      return false;
    }

    // Block private RFC 1918 IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Regex);
    if (ipMatch) {
      const octet1 = parseInt(ipMatch[1], 10);
      const octet2 = parseInt(ipMatch[2], 10);

      if (octet1 === 10) return false;
      if (octet1 === 127) return false;
      if (octet1 === 169 && octet2 === 254) return false;
      if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return false;
      if (octet1 === 192 && octet2 === 168) return false;
      if (octet1 === 0) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures an apply URL is safe; returns fallback if invalid or insecure
 */
export function sanitizeApplyUrl(url: string, fallback: string = "https://t.me"): string {
  if (isValidHttpsUrl(url)) {
    return url.trim();
  }
  return fallback;
}

/**
 * Bounds and trims untrusted text input to prevent memory exhaustion
 */
export function boundString(input: unknown, maxLength: number = 256): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, maxLength);
}
