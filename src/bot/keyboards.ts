import { InlineKeyboard } from "grammy";
import { COURSES, LOCATIONS, STIPENDS } from "../config/taxonomy.js";
import { sanitizeApplyUrl } from "../utils/security.js";

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
  const safeUrl = sanitizeApplyUrl(applyUrl);
  return new InlineKeyboard()
    .url("🔗 Apply on Official Page", safeUrl)
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

/**
 * Navigation keyboard for chunked/paginated digest delivery (e.g. 5 first, then view more)
 */
export function buildDigestPaginationKeyboard(
  currentOffset: number,
  pageSize: number,
  totalItems: number
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const nextStart = currentOffset + 1;
  const nextEnd = Math.min(currentOffset + pageSize, totalItems);
  const remainingCount = totalItems - currentOffset;

  if (remainingCount > 0) {
    keyboard.text(`📄 Show Next ${nextEnd - currentOffset} (${nextStart} – ${nextEnd})`, `dg:next:${currentOffset}`);

    if (remainingCount > pageSize) {
      keyboard.row().text(`🚀 View All Remaining (${remainingCount})`, `dg:all:${currentOffset}`);
    }
  }

  return keyboard;
}

/**
 * Single-Card Carousel Keyboard:
 * - Row 1: Flipping buttons: [ ⬅️ Prev ] [ 📍 3 / 20 ] [ Next ➡️ ]
 * - Row 2: Official Apply Link
 * - Row 3: Action buttons: [ ✅ Applied ] [ ❌ Not Eligible ] [ ⏭️ Skip ]
 * - Row 4: Shortcuts: [ 📊 Stats ] [ ⚙️ Filters ]
 */
export function buildCarouselKeyboard(
  currentIndex: number,
  totalCount: number,
  shortId: string,
  applyUrl: string
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const safeUrl = sanitizeApplyUrl(applyUrl);

  // Row 1: Navigation Pager
  const pageLabel = `📍 ${currentIndex + 1} / ${totalCount}`;
  if (totalCount > 1) {
    if (currentIndex > 0) {
      keyboard.text("⬅️ Prev", `car:nav:prev:${currentIndex}`);
    } else {
      keyboard.text("• First", "noop");
    }

    keyboard.text(pageLabel, `car:status:${currentIndex}`);

    if (currentIndex < totalCount - 1) {
      keyboard.text("Next ➡️", `car:nav:next:${currentIndex}`);
    } else {
      keyboard.text("• Last", "noop");
    }
    keyboard.row();
  }

  // Row 2: Official Apply Link
  keyboard.url("🔗 Apply on Official Page", safeUrl).row();

  // Row 3: 1-Click State Actions
  keyboard
    .text("✅ Applied", `car:apply:${shortId}:${currentIndex}`)
    .text("❌ Not Eligible", `car:rej:${shortId}:${currentIndex}`)
    .text("⏭️ Skip", `car:skip:${shortId}:${currentIndex}`)
    .row();

  // Row 4: Utility navigation
  keyboard
    .text("📊 My Stats", "cb:view_stats")
    .text("⚙️ Settings", "cb:view_settings");

  return keyboard;
}

/**
 * Keyboard shown after user records an action (Applied / Not Eligible) in carousel
 */
export function buildCarouselActionConfirmationKeyboard(
  nextIndex: number | null,
  totalCount: number
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  if (nextIndex !== null && nextIndex < totalCount) {
    keyboard.text(`➡️ View Next Opportunity (${nextIndex + 1}/${totalCount})`, `car:jump:${nextIndex}`).row();
  } else {
    keyboard.text("🎉 View Completion Summary", "car:finish").row();
  }
  keyboard
    .text("📊 My Stats", "cb:view_stats")
    .text("⚙️ Settings", "cb:view_settings");

  return keyboard;
}

/**
 * Keyboard when user reaches the end of the carousel
 */
export function buildCarouselCompletedKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 Start Over from Card 1", "car:first")
    .row()
    .text("📊 View My Stats", "cb:view_stats")
    .text("⚙️ Change Preferences", "cb:start");
}


