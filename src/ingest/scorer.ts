export interface ScorableInternship {
  requires_national_id: boolean;
  has_stipend: boolean;
  target_year: number;
  location_category: "nigeria" | "africa_remote" | "overseas_remote" | "overseas_relocate";
  deadline?: string | null; // ISO Date YYYY-MM-DD
}

/**
 * Deterministic Priority Scoring (0 - 100)
 * According to SPEC.md:
 * - No National ID Required: +35 pts
 * - Stipend Confirmed: +25 pts
 * - 2027 Intake Match: +20 pts
 * - Location Accessibility:
 *     - Nigeria (Onsite/Hybrid/Remote) or Overseas Remote: +15 pts
 *     - Overseas Relocate (Visa sponsorship): +10 pts
 * - Urgency Bonus (Deadline within 14 days): +5 pts
 */
export function calculatePriorityScore(item: ScorableInternship, referenceDate: Date = new Date()): number {
  let score = 0;

  // 1. National ID requirement (+35)
  if (item.requires_national_id === false) {
    score += 35;
  }

  // 2. Stipend confirmed (+25)
  if (item.has_stipend === true) {
    score += 25;
  }

  // 3. 2027 Intake Year match (+20)
  if (item.target_year === 2027) {
    score += 20;
  }

  // 4. Location Accessibility (+15 or +10)
  if (
    item.location_category === "nigeria" ||
    item.location_category === "africa_remote" ||
    item.location_category === "overseas_remote"
  ) {
    score += 15;
  } else if (item.location_category === "overseas_relocate") {
    score += 10;
  }

  // 5. Urgency Bonus: Deadline within 14 days (+5)
  if (item.deadline) {
    const deadlineDate = new Date(item.deadline);
    const diffTime = deadlineDate.getTime() - referenceDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= 14) {
      score += 5;
    }
  }

  return Math.min(100, Math.max(0, score));
}
