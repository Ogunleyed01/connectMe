import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../config/env.js";
import { LocationCategory, WorkMode } from "../db/queries.js";

export interface ParsedInternshipData {
  title: string;
  company: string;
  course_tags: string[];
  role_category?: string;
  tech_stack: string[];
  location_category: LocationCategory;
  work_mode: WorkMode;
  city_or_country: string;
  has_stipend: boolean;
  stipend_note?: string;
  requires_national_id: boolean;
  id_requirement_note?: string;
  target_year: number;
  start_date?: string;
  deadline?: string;
  summary_bullets: string[];
}

let aiClient: GoogleGenAI | null = null;
if (env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    console.log("[Gemini] Structured parser initialized with Gemini 2.5 Flash.");
  } catch (err) {
    console.warn("[Gemini] Could not initialize GoogleGenAI client:", err);
  }
}

/**
 * Extracts normalized, structured internship metadata using Gemini 2.5 Flash,
 * falling back to deterministic heuristic parsing if no API key is provided.
 */
export async function parseJobPostingWithGemini(
  rawText: string,
  hints?: { defaultCompany?: string; defaultTitle?: string; applyUrl?: string }
): Promise<ParsedInternshipData> {
  if (aiClient) {
    try {
      const prompt = `
Extract structured metadata from this internship listing targeted for 2027 university intake (IT/SIWES or Summer).

Criteria:
- requires_national_id: true ONLY if applicant MUST possess a foreign passport, national ID card, or visa work authorization upfront before interview. False if university ID or student admission letter is sufficient.
- has_stipend: true if paid, has allowance, hourly wage, or monthly salary.
- location_category: one of 'nigeria', 'africa_remote', 'overseas_remote', 'overseas_relocate'.
- work_mode: 'remote', 'onsite', or 'hybrid'.
- course_tags: array from ['computer_science', 'electrical_engineering', 'product_design', 'data_science'].
- target_year: intake year (default 2027).

Job Text:
${rawText}
`;

      const response = await aiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              company: { type: Type.STRING },
              course_tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              role_category: { type: Type.STRING },
              tech_stack: { type: Type.ARRAY, items: { type: Type.STRING } },
              location_category: {
                type: Type.STRING,
                enum: ["nigeria", "africa_remote", "overseas_remote", "overseas_relocate"],
              },
              work_mode: { type: Type.STRING, enum: ["remote", "onsite", "hybrid"] },
              city_or_country: { type: Type.STRING },
              has_stipend: { type: Type.BOOLEAN },
              stipend_note: { type: Type.STRING },
              requires_national_id: { type: Type.BOOLEAN },
              id_requirement_note: { type: Type.STRING },
              target_year: { type: Type.INTEGER },
              start_date: { type: Type.STRING },
              deadline: { type: Type.STRING },
              summary_bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              "title",
              "company",
              "course_tags",
              "location_category",
              "work_mode",
              "has_stipend",
              "requires_national_id",
              "target_year",
            ],
          },
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text) as ParsedInternshipData;
        return parsed;
      }
    } catch (err) {
      console.warn("[Gemini] API parsing call failed, using heuristic parser:", err);
    }
  }

  // Fallback: Deterministic heuristic parser
  return heuristicParse(rawText, hints);
}

function heuristicParse(
  rawText: string,
  hints?: { defaultCompany?: string; defaultTitle?: string; applyUrl?: string }
): ParsedInternshipData {
  const lower = rawText.toLowerCase();

  // Compensation heuristic
  const hasStipend =
    lower.includes("stipend") ||
    lower.includes("paid") ||
    lower.includes("salary") ||
    lower.includes("allowance") ||
    lower.includes("₦") ||
    lower.includes("$") ||
    lower.includes("€") ||
    lower.includes("compensation");

  let stipendNote = hasStipend ? "Paid internship / allowance offered" : undefined;
  const matchMoney = rawText.match(/(?:₦|NGN|\$|USD)\s*[\d,]+(?:\s*\/\s*(?:mo|month|hr|year))?/i);
  if (matchMoney) {
    stipendNote = matchMoney[0];
  }

  // ID Requirement heuristic
  const requiresId =
    lower.includes("must possess a valid passport") ||
    lower.includes("national identity number required") ||
    lower.includes("proof of right to work without sponsorship") ||
    lower.includes("us citizen or green card");

  const idNote = requiresId
    ? "National ID / Passport required upfront"
    : "Zero National ID barrier (Student ID only)";

  // Location & work mode heuristic
  let workMode: WorkMode = "remote";
  if (lower.includes("hybrid")) workMode = "hybrid";
  else if (lower.includes("onsite") || lower.includes("on-site")) workMode = "onsite";

  let locCat: LocationCategory = "overseas_remote";
  if (lower.includes("nigeria") || lower.includes("lagos") || lower.includes("abuja")) {
    locCat = "nigeria";
  } else if (lower.includes("africa")) {
    locCat = "africa_remote";
  } else if (lower.includes("relocation") || lower.includes("relocate")) {
    locCat = "overseas_relocate";
  }

  // Course tags
  const courseTags: string[] = [];
  if (
    lower.includes("software") ||
    lower.includes("developer") ||
    lower.includes("engineer") ||
    lower.includes("frontend") ||
    lower.includes("backend") ||
    lower.includes("fullstack")
  ) {
    courseTags.push("computer_science");
  }
  if (lower.includes("design") || lower.includes("ui") || lower.includes("ux") || lower.includes("figma")) {
    courseTags.push("product_design");
  }
  if (lower.includes("data") || lower.includes("machine learning") || lower.includes("ai") || lower.includes("python")) {
    courseTags.push("data_science");
  }
  if (lower.includes("hardware") || lower.includes("electrical") || lower.includes("embedded") || lower.includes("iot")) {
    courseTags.push("electrical_engineering");
  }
  if (courseTags.length === 0) courseTags.push("computer_science");

  // Summary bullets
  const lines = rawText
    .split("\n")
    .map((l) => l.trim().replace(/^[-*•]\s*/, ""))
    .filter((l) => l.length > 20 && l.length < 150)
    .slice(0, 3);

  return {
    title: hints?.defaultTitle || "2027 Technology Intern",
    company: hints?.defaultCompany || "Partner Tech Organization",
    course_tags: courseTags,
    role_category: "Software & Technology",
    tech_stack: ["Git", "TypeScript", "Problem Solving"],
    location_category: locCat,
    work_mode: workMode,
    city_or_country: locCat === "nigeria" ? "Nigeria" : "Remote",
    has_stipend: hasStipend,
    stipend_note: stipendNote,
    requires_national_id: requiresId,
    id_requirement_note: idNote,
    target_year: 2027,
    summary_bullets: lines.length > 0 ? lines : ["Hands-on engineering experience in active production environment."],
  };
}
