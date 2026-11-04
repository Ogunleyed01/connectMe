/**
 * Strict classifier for tech internships and Industrial Training opportunities.
 * Rejects false positives like "Internal Auditor", "International Sales",
 * "Engineering Manager", etc.
 */

const POSITIVE_INTERN_REGEX =
  /\b(intern|internship|internships|co-op|coop|apprentice|apprenticeship|siwes|industrial training|it placement|it student|student trainee|graduate trainee)\b/i;

const FALSE_POSITIVE_INTERNAL_REGEX =
  /\b(internal auditor|internal audit|international sales|international trade|internet operations|internist)\b/i;

const SENIOR_ROLE_EXCLUSIONS =
  /\b(senior manager|engineering manager|director of|vp of|vice president|chief|head of|lead architect)\b/i;

export function isGenuineInternship(title?: string | null, rawText?: string): boolean {
  if (!title || typeof title !== "string") return false;

  const cleanTitle = title.trim();

  // 1. Must match positive internship signals
  if (!POSITIVE_INTERN_REGEX.test(cleanTitle)) {
    // If title doesn't say intern, check if rawText strongly indicates a SIWES/IT placement
    if (rawText) {
      const lowerRaw = rawText.toLowerCase();
      const hasPlacementTerms =
        lowerRaw.includes("industrial training") ||
        lowerRaw.includes("siwes placement") ||
        lowerRaw.includes("student internship");
      if (!hasPlacementTerms) return false;
    } else {
      return false;
    }
  }

  // 2. Reject obvious false positives like "Internal Auditor"
  if (FALSE_POSITIVE_INTERNAL_REGEX.test(cleanTitle)) {
    return false;
  }

  // 3. Reject senior executive / manager roles that happen to contain "intern"
  if (SENIOR_ROLE_EXCLUSIONS.test(cleanTitle)) {
    return false;
  }

  return true;
}

export function detectTargetYear(title?: string, text?: string): number {
  const combined = `${title || ""} ${text || ""}`;
  if (combined.includes("2027")) return 2027;
  if (combined.includes("2026")) return 2026;
  if (combined.includes("2028")) return 2028;
  return 2027; // Default intake target
}
