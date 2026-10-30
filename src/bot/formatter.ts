import { COURSES, LOCATIONS, STIPENDS } from "../config/taxonomy.js";
import { UserProfileRecord, DigestItem, InternshipRecord } from "../db/queries.js";
import { sanitizeApplyUrl } from "../utils/security.js";

/**
 * Step 1: Course of Study selection message
 */
export function formatStartMessage(name?: string): string {
  const greeting = name ? `Hi <b>${escapeHtml(name)}</b>! ` : "Hi! ";
  return (
    `🎯 <b>2027 Internship Tracker & Daily Digest</b>\n\n` +
    `${greeting}Welcome to your personal opportunity scout for the <b>2027 IT / SIWES & Summer</b> internship intake period.\n\n` +
    `Let's configure your daily dispatch in 3 quick steps.\n\n` +
    `<b>Step 1 of 3: Select your Course of Study</b>\n` +
    `<i>Choose the field matching your background or career target:</i>`
  );
}

/**
 * Prompt user to enter custom course of study
 */
export function formatCustomCoursePrompt(): string {
  return (
    `🎯 <b>2027 Internship Tracker & Daily Digest</b>\n\n` +
    `✏️ <b>Custom Course of Study</b>\n\n` +
    `Please type and send your course of study as a reply:\n\n` +
    `<i>Examples: Mechanical Engineering, Cybersecurity, Information Systems, Civil Engineering, Chemical Engineering, Physics, etc.</i>`
  );
}

/**
 * Step 2: Location preference message
 */
export function formatLocationMessage(courseKey: string, customCourseName?: string): string {
  const course = COURSES[courseKey] || COURSES.cs;
  const courseLabel = customCourseName
    ? `🎓 <b>${escapeHtml(customCourseName)}</b>`
    : `${course.emoji} ${escapeHtml(course.label)}`;

  return (
    `🎯 <b>2027 Internship Tracker & Daily Digest</b>\n\n` +
    `✅ <b>Course:</b> ${courseLabel}\n\n` +
    `<b>Step 2 of 3: Location Preference</b>\n` +
    `<i>Where would you like your internship opportunities based?</i>\n\n` +
    `• 🇳🇬 <b>Nigeria Only:</b> Local onsite, hybrid, and remote roles\n` +
    `• 🌍 <b>Overseas / Remote:</b> Africa and global remote listings\n` +
    `• 🌐 <b>Both:</b> Maximum coverage across local & international roles`
  );
}

/**
 * Step 3: Stipend requirement message
 */
export function formatStipendMessage(courseKey: string, locationKey: string, customCourseName?: string): string {
  const course = COURSES[courseKey] || COURSES.cs;
  const courseLabel = customCourseName
    ? `🎓 <b>${escapeHtml(customCourseName)}</b>`
    : `${course.emoji} ${escapeHtml(course.label)}`;
  const location = LOCATIONS[locationKey] || LOCATIONS.both;

  return (
    `🎯 <b>2027 Internship Tracker & Daily Digest</b>\n\n` +
    `✅ <b>Course:</b> ${courseLabel}\n` +
    `✅ <b>Location:</b> ${location.emoji} ${escapeHtml(location.label)}\n\n` +
    `<b>Step 3 of 3: Stipend Requirement</b>\n` +
    `<i>How should we prioritize paid vs. unpaid positions?</i>\n\n` +
    `• 💰 <b>Strict:</b> Only deliver opportunities with confirmed stipends\n` +
    `• ⭐ <b>Preferred:</b> Rank paid roles at the top, but still show high-prestige unpaid positions`
  );
}

/**
 * Step 4: Summary & Confirmation message
 */
export function formatCompletionMessage(profile: {
  courseKey: string;
  customCourseName?: string;
  locationKey: string;
  stipendKey: string;
  name?: string;
}): string {
  const course = COURSES[profile.courseKey] || COURSES.cs;
  const courseLabel = profile.customCourseName
    ? `🎓 ${escapeHtml(profile.customCourseName)}`
    : `${course.emoji} ${escapeHtml(course.label)}`;
  const location = LOCATIONS[profile.locationKey] || LOCATIONS.both;
  const stipend = STIPENDS[profile.stipendKey] || STIPENDS.preferred;

  return (
    `🎉 <b>Preferences Saved Successfully!</b>\n\n` +
    `Here is your active 2027 opportunity filter profile:\n\n` +
    `• <b>Course:</b> ${courseLabel}\n` +
    `• <b>Location:</b> ${location.emoji} ${escapeHtml(location.label)} (<i>${escapeHtml(location.description)}</i>)\n` +
    `• <b>Compensation:</b> ${stipend.emoji} ${escapeHtml(stipend.label)}\n` +
    `• <b>Target Intake:</b> 🎓 2027 IT / SIWES & Summer Period\n` +
    `• <b>Daily Quota:</b> 📬 Up to 20 curated roles dispatched at 08:00 WAT\n` +
    `• <b>Priority Filter:</b> 🛡️ Zero National ID barrier prioritized\n\n` +
    `🚀 <b>What happens next?</b>\n` +
    `You will receive up to 20 verified opportunities each morning with 1-click status tracking (<b>Applied</b>, <b>Not Eligible</b>, <b>Skip</b>).\n\n` +
    `<i>Tap below to load your matches immediately or adjust settings.</i>`
  );
}

/**
 * Formats a dispatched internship opportunity card for Telegram
 */
export function formatInternshipCard(item: DigestItem, index?: number, total?: number): string {
  const counterPrefix = index && total ? `[${index}/${total}] ` : "";
  const rolloverBadge = item.is_rollover ? `🔄 <i>(Previously sent — still open)</i>\n` : "";

  // Work mode & location formatting
  const modeEmoji = item.work_mode === "remote" ? "💻 Remote" : item.work_mode === "hybrid" ? "🏢 Hybrid" : "📍 Onsite";
  const locText = `${modeEmoji} • ${escapeHtml(item.city_or_country)}`;

  // Compensation
  const stipendBadge = item.has_stipend
    ? `💰 <b>Stipend:</b> Confirmed ${item.stipend_note ? `(${escapeHtml(item.stipend_note)})` : ""}`
    : `⚪ <b>Stipend:</b> Unspecified / Unpaid`;

  // ID Requirement
  const idBadge = item.requires_national_id
    ? `⚠️ <b>National ID:</b> Required (${escapeHtml(item.id_requirement_note || "Passport/National ID needed")})`
    : `🛡️ <b>National ID:</b> Not required (${escapeHtml(item.id_requirement_note || "Zero ID barrier upfront")})`;

  // Timeline
  const deadlineText = item.deadline
    ? `⏰ <b>Deadline:</b> ${item.deadline} ${getDeadlineUrgency(item.deadline)}`
    : `⏰ <b>Deadline:</b> Rolling / Not specified`;
  const startText = item.start_date ? `🚀 <b>Start:</b> ${item.start_date}` : `🚀 <b>Target:</b> 2027 IT / Summer`;

  // Tech stack
  const stack = item.tech_stack && item.tech_stack.length > 0 ? `\n🛠️ <b>Stack:</b> <code>${item.tech_stack.join(", ")}</code>` : "";

  // Bullets
  const bullets =
    item.summary_bullets && item.summary_bullets.length > 0
      ? `\n\n<b>Key Highlights:</b>\n` + item.summary_bullets.map((b) => `• ${escapeHtml(b)}`).join("\n")
      : "";

  return (
    `${counterPrefix}🏢 <b>${escapeHtml(item.company)}</b>\n` +
    `💼 <b>${escapeHtml(item.title)}</b>\n` +
    `${rolloverBadge}\n` +
    `📍 ${locText}\n` +
    `${stipendBadge}\n` +
    `${idBadge}\n` +
    `${startText} | ${deadlineText}` +
    `${stack}` +
    `${bullets}\n\n` +
    `⭐ <i>Priority Score: ${item.priority_score}/100</i>`
  );
}

/**
 * Message shown in place when user marks 'Applied'
 */
export function formatAppliedCard(item: InternshipRecord, appliedAt: Date = new Date()): string {
  const dateStr = appliedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const safeUrl = sanitizeApplyUrl(item.apply_url);
  return (
    `✅ <b>APPLICATION LOGGED!</b>\n\n` +
    `🏢 <b>Company:</b> ${escapeHtml(item.company)}\n` +
    `💼 <b>Role:</b> ${escapeHtml(item.title)}\n` +
    `📅 <b>Applied Date:</b> ${dateStr}\n\n` +
    `🎯 <i>Great job taking action!</i>\n` +
    `🔔 <b>Automated 7-Day Follow-Up:</b> We'll send you a check-in reminder in 7 days to see if you have interview updates or offer news.\n\n` +
    `🔗 <a href="${escapeHtml(safeUrl)}">View Application Reference</a>`
  );
}

/**
 * Message shown in place when user marks 'Not Eligible'
 */
export function formatNotEligibleCard(item: InternshipRecord): string {
  return (
    `❌ <b>MARKED AS NOT ELIGIBLE</b>\n\n` +
    `🏢 <b>${escapeHtml(item.company)}</b> — ${escapeHtml(item.title)}\n\n` +
    `🗑️ This opportunity has been archived from your feed. You won't see it again.\n` +
    `We will continue prioritizing roles that match your eligibility criteria.`
  );
}

/**
 * Message shown in place when user marks 'Skip for Tomorrow'
 */
export function formatSkippedCard(item: InternshipRecord): string {
  return (
    `⏭️ <b>SKIPPED FOR TODAY</b>\n\n` +
    `🏢 <b>${escapeHtml(item.company)}</b> — ${escapeHtml(item.title)}\n\n` +
    `🔄 This opportunity remains active and will rollover into your daily dispatch tomorrow if the deadline is still open.`
  );
}

/**
 * Format follow-up prompt card (7 days post-application)
 */
export function formatFollowupPrompt(item: InternshipRecord, appliedDate?: string): string {
  const appliedInfo = appliedDate ? ` on ${new Date(appliedDate).toLocaleDateString()}` : "";
  return (
    `👋 <b>7-Day Application Check-in!</b>\n\n` +
    `You applied to <b>${escapeHtml(item.company)}</b> for <b>${escapeHtml(item.title)}</b>${appliedInfo}.\n\n` +
    `Have you received any communication from the hiring team? Please update your status below:`
  );
}

/**
 * Format stats overview
 */
export function formatStatsMessage(stats: {
  applied: number;
  notEligible: number;
  pendingAction: number;
  interviewing: number;
  offered: number;
}): string {
  return (
    `📊 <b>Your 2027 Internship Tracking Stats</b>\n\n` +
    `• ✅ <b>Applied:</b> ${stats.applied}\n` +
    `• 🗣️ <b>Interviewing:</b> ${stats.interviewing}\n` +
    `• 🏆 <b>Offers Received:</b> ${stats.offered}\n` +
    `• 🔄 <b>Pending Action / Rollover:</b> ${stats.pendingAction}\n` +
    `• ❌ <b>Archived (Not Eligible):</b> ${stats.notEligible}\n\n` +
    `<i>Keep applying consistently! 20 roles are dispatched daily at 08:00 WAT.</i>`
  );
}

/**
 * View Settings / Profile status message
 */
export function formatSettingsView(profile: UserProfileRecord): string {
  const courseEntry = Object.values(COURSES).find((c) => c.dbValue === profile.course_of_study);
  const courseLabel = courseEntry
    ? `${courseEntry.emoji} ${escapeHtml(courseEntry.label)}`
    : `🎓 <b>${escapeHtml(profile.course_of_study)}</b>`;
  const stipendText = profile.prioritize_stipend ? "⭐ Prioritize Stipend (Preferred)" : "Standard";

  return (
    `⚙️ <b>Your Current Filter Settings</b>\n\n` +
    `• <b>Course:</b> ${courseLabel}\n` +
    `• <b>Preferred Locations:</b> ${profile.preferred_locations.join(", ")}\n` +
    `• <b>Stipend Preference:</b> ${stipendText}\n` +
    `• <b>Target Year:</b> ${profile.target_intake_year} IT / SIWES\n` +
    `• <b>Daily Limit:</b> ${profile.daily_limit} listings/day\n` +
    `• <b>Status:</b> ${profile.is_active ? "Active ✅" : "Paused ⏸️"}\n` +
    `• <b>Last Updated:</b> ${new Date(profile.updated_at).toLocaleString()}`
  );
}

/**
 * Pagination controller message for chunked digest
 */
export function formatDigestPaginationMessage(shownCount: number, totalCount: number): string {
  const remaining = totalCount - shownCount;
  return (
    `📊 <b>Progress: ${shownCount} of ${totalCount} Opportunities Shown</b>\n\n` +
    `<i>You've reviewed the first ${shownCount} matches. Tap below to load the next batch or view all ${remaining} remaining opportunities:</i>`
  );
}

/**
 * All opportunities completed message
 */
export function formatDigestCompleteMessage(totalCount: number): string {
  return (
    `🎉 <b>All ${totalCount} Opportunities Shown!</b>\n\n` +
    `• Tap <b>🔗 Apply on Official Page</b> on your top picks.\n` +
    `• Mark roles as <b>✅ Applied</b> so the bot can track your pipeline and schedule 7-day follow-ups.\n` +
    `• Unacted roles will roll over tomorrow morning at <b>08:00 WAT</b>.\n\n` +
    `<i>Use /stats to monitor your applications or /settings to refine your preferences.</i>`
  );
}

/**
 * Formats a single opportunity card inside the carousel view
 */
export function formatCarouselCard(
  item: DigestItem,
  currentIndex: number,
  totalCount: number
): string {
  const intakeBadge = item.is_rollover
    ? "🔄 <b>Rollover (Unacted)</b>"
    : "🆕 <b>Fresh Match</b>";

  const stipendBadge = item.has_stipend
    ? `💰 <b>Stipend:</b> ${escapeHtml(item.stipend_note || "Paid Placement")}`
    : `💰 <b>Stipend:</b> Unspecified / Unpaid`;

  const idBadge = item.requires_national_id === false
    ? `🛡️ <b>ID Requirement:</b> Zero passport/national ID upfront <i>(Student ID accepted)</i>`
    : `🛡️ <b>ID Requirement:</b> Valid national passport or work authorization required`;

  const urgency = item.deadline ? getDeadlineUrgency(item.deadline) : "";
  const deadlineStr = item.deadline
    ? `📅 <b>Deadline:</b> ${item.deadline} ${urgency}`
    : `📅 <b>Deadline:</b> Rolling Admissions`;

  const startDateStr = item.start_date
    ? `🚀 <b>Expected Start:</b> ${item.start_date}`
    : `🚀 <b>Intake Period:</b> 2027 IT / SIWES & Summer`;

  const bullets =
    item.summary_bullets && item.summary_bullets.length > 0
      ? `<b>Highlights & Responsibilities:</b>\n` +
        item.summary_bullets.map((b) => `• ${escapeHtml(b)}`).join("\n") +
        "\n\n"
      : "";

  const techStack =
    item.tech_stack && item.tech_stack.length > 0
      ? `🛠️ <b>Tech Stack:</b> ${item.tech_stack.map((t) => `<code>${escapeHtml(t)}</code>`).join(", ")}\n\n`
      : "";

  return (
    `💼 <b>${escapeHtml(item.title)}</b>\n` +
    `🏢 <b>${escapeHtml(item.company)}</b>\n\n` +
    `📑 <i>Card ${currentIndex + 1} of ${totalCount} • ${intakeBadge} • Score: ${item.priority_score}/100</i>\n` +
    `──────────────────────────\n` +
    `📍 <b>Location:</b> ${escapeHtml(item.city_or_country)} (${item.work_mode})\n` +
    `${stipendBadge}\n` +
    `${idBadge}\n` +
    `${deadlineStr}\n` +
    `${startDateStr}\n\n` +
    `${techStack}` +
    `${bullets}` +
    `<i>Use buttons below to apply, track, or flip through cards in place:</i>`
  );
}

/**
 * In-place card confirmation when an opportunity is marked as Applied in carousel
 */
export function formatCarouselAppliedConfirmation(
  item: InternshipRecord,
  nextIndex: number | null,
  totalCount: number
): string {
  return (
    `🎉 <b>Application Logged!</b>\n\n` +
    `🏢 <b>${escapeHtml(item.company)}</b>\n` +
    `💼 <i>${escapeHtml(item.title)}</i>\n\n` +
    `✅ We've recorded this in your personal application pipeline.\n` +
    `⏰ An automated follow-up check-in will trigger in <b>7 days</b> to track interview updates.\n\n` +
    (nextIndex !== null && nextIndex < totalCount
      ? `<i>Tap below to continue to opportunity ${nextIndex + 1} of ${totalCount}:</i>`
      : `<i>You've reviewed all opportunities for today!</i>`)
  );
}

/**
 * In-place card confirmation when marked Not Eligible in carousel
 */
export function formatCarouselRejectConfirmation(
  item: InternshipRecord,
  nextIndex: number | null,
  totalCount: number
): string {
  return (
    `❌ <b>Archived as Not Eligible</b>\n\n` +
    `🏢 <b>${escapeHtml(item.company)}</b>\n` +
    `💼 <i>${escapeHtml(item.title)}</i>\n\n` +
    `This opportunity has been archived from your daily queue.\n\n` +
    (nextIndex !== null && nextIndex < totalCount
      ? `<i>Tap below to view opportunity ${nextIndex + 1} of ${totalCount}:</i>`
      : `<i>You've reviewed all opportunities for today!</i>`)
  );
}

/**
 * Completion card when user reaches end of carousel
 */
export function formatCarouselCompleteMessage(totalCount: number): string {
  return (
    `🎉 <b>You've Reviewed All ${totalCount} Opportunities!</b>\n\n` +
    `• Your responses have been saved and your application pipeline is updated.\n` +
    `• Any opportunities you skipped will roll over tomorrow morning at <b>08:00 WAT</b>.\n` +
    `• Fresh postings discovered by our daily scrapers will be added automatically.\n\n` +
    `<i>Use the buttons below to review your stats, restart from Card 1, or adjust your preferences:</i>`
  );
}



function getDeadlineUrgency(deadlineStr: string): string {
  const deadline = new Date(deadlineStr);
  const diffTime = deadline.getTime() - Date.now();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "<i>(Expired)</i>";
  if (diffDays === 0) return "🔥 <b>(Closes TODAY!)</b>";
  if (diffDays <= 3) return `🔥 <b>(Closes in ${diffDays} days!)</b>`;
  if (diffDays <= 14) return `⚡ (Closes in ${diffDays} days)`;
  return `(${diffDays} days left)`;
}

export function escapeHtml(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
