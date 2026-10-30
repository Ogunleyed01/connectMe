import { InlineKeyboard } from "grammy";
import { COURSES, LOCATIONS, STIPENDS } from "../config/taxonomy.js";

/**
 * Builds the Step 1 keyboard: Course of Study selection
 */
export function buildCourseKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const courseList = Object.values(COURSES);

  courseList.forEach((c, index) => {
    keyboard.text(`${c.emoji} ${c.label}`, `cb:c:${c.id}`);
    if (index < courseList.length - 1) {
      keyboard.row();
    }
  });

  return keyboard;
}

/**
 * Builds the keyboard when waiting for custom course text input
 */
export function buildCustomCoursePromptKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("⬅️ Back to Courses", "cb:b:start");
}

/**
 * Builds the Step 2 keyboard: Location Preference selection
 */
export function buildLocationKeyboard(courseKey: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  Object.values(LOCATIONS).forEach((loc) => {
    keyboard.text(`${loc.emoji} ${loc.label}`, `cb:l:${courseKey}:${loc.id}`).row();
  });

  keyboard.text("⬅️ Back to Courses", "cb:b:start");

  return keyboard;
}

/**
 * Builds the Step 3 keyboard: Stipend Requirement selection
 */
export function buildStipendKeyboard(courseKey: string, locationKey: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  Object.values(STIPENDS).forEach((stipend) => {
    keyboard.text(`${stipend.emoji} ${stipend.label}`, `cb:s:${courseKey}:${locationKey}:${stipend.id}`).row();
  });

  keyboard.text("⬅️ Back to Location", `cb:b:loc:${courseKey}`);

  return keyboard;
}

/**
 * Builds the confirmation / completion keyboard
 */
export function buildCompletedKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📬 View Today's Digest", "cb:get_digest")
    .row()
    .text("⚙️ Change Preferences", "cb:start")
    .text("📊 My Stats", "cb:view_stats");
}

/**
 * Action keyboard attached to every dispatched internship card:
 * - Apply link
 * - State machine buttons: Applied, Not Eligible, Skip for Tomorrow
 */
export function buildOpportunityKeyboard(shortId: string, applyUrl: string): InlineKeyboard {
  return new InlineKeyboard()
    .url("🔗 Apply on Official Page", applyUrl)
    .row()
    .text("✅ Applied", `app:apply:${shortId}`)
    .text("❌ Not Eligible", `app:reject:${shortId}`)
    .row()
    .text("⏭️ Skip for Tomorrow", `app:skip:${shortId}`);
}

/**
 * Keyboard for post-application follow-up check-ins (7 days / pre-deadline)
 */
export function buildFollowupKeyboard(shortId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("🗣️ Interviewing", `fup:int:${shortId}`)
    .text("🏆 Received Offer", `fup:off:${shortId}`)
    .row()
    .text("⏳ Still Waiting", `fup:wait:${shortId}`)
    .text("❌ Not Selected", `fup:rej:${shortId}`);
}
