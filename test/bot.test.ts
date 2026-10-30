import assert from "node:assert/strict";
import {
  buildCourseKeyboard,
  buildLocationKeyboard,
  buildStipendKeyboard,
  buildOpportunityKeyboard,
  buildFollowupKeyboard,
  buildDigestPaginationKeyboard,
  buildCarouselKeyboard,
  buildCarouselActionConfirmationKeyboard,
  buildCarouselCompletedKeyboard,
} from "../src/bot/keyboards.js";
import {
  formatStartMessage,
  formatLocationMessage,
  formatStipendMessage,
  formatCompletionMessage,
  formatInternshipCard,
  formatAppliedCard,
  formatNotEligibleCard,
  formatSkippedCard,
  formatStatsMessage,
  formatDigestPaginationMessage,
  formatDigestCompleteMessage,
  formatCarouselCard,
  formatCarouselAppliedConfirmation,
  formatCarouselRejectConfirmation,
  formatCarouselCompleteMessage,
} from "../src/bot/formatter.js";
import { COURSES, LOCATIONS, STIPENDS } from "../src/config/taxonomy.js";
import {
  upsertUserProfile,
  getUserProfile,
  upsertInternship,
  getDailyUserDigest,
  updateApplicationStatus,
  markInternshipDispatched,
  getUserStats,
  DigestItem,
} from "../src/db/queries.js";
import { calculatePriorityScore } from "../src/ingest/scorer.js";

async function runTests() {
  console.log("🧪 Running Comprehensive Test Suite for 2027 Internship Bot...\n");

  // 1. Verify Taxonomy
  console.log("1️⃣ Verifying taxonomy definitions...");
  assert.ok(COURSES.cs, "Computer science course must exist");
  assert.ok(COURSES.eee, "Electrical engineering course must exist");
  assert.ok(COURSES.design, "Product design course must exist");
  assert.ok(LOCATIONS.ng, "Nigeria location must exist");
  assert.ok(LOCATIONS.remote, "Remote location must exist");
  assert.ok(LOCATIONS.both, "Both location must exist");
  assert.ok(STIPENDS.strict, "Strict stipend must exist");
  assert.ok(STIPENDS.preferred, "Preferred stipend must exist");
  console.log("   ✅ Taxonomy validated.");

  // 2. Verify Keyboards
  console.log("2️⃣ Verifying inline keyboards...");
  const courseKb = buildCourseKeyboard();
  assert.strictEqual(courseKb.inline_keyboard.length, 5, "Course keyboard should have 5 rows (4 presets + Other)");

  const locKb = buildLocationKeyboard("cs");
  assert.strictEqual(locKb.inline_keyboard.length, 4, "Location keyboard should have 3 options + 1 back button");

  const stipendKb = buildStipendKeyboard("cs", "both");
  assert.strictEqual(stipendKb.inline_keyboard.length, 3, "Stipend keyboard should have 2 options + 1 back button");

  const oppKb = buildOpportunityKeyboard("abcd1234", "https://example.com/apply");
  assert.strictEqual(oppKb.inline_keyboard.length, 3, "Opportunity keyboard should have URL row, action row, skip row");

  const fupKb = buildFollowupKeyboard("abcd1234");
  assert.strictEqual(fupKb.inline_keyboard.length, 2, "Follow-up keyboard should have 2 rows");

  const pageKb = buildDigestPaginationKeyboard(5, 5, 20);
  assert.strictEqual(pageKb.inline_keyboard.length, 2, "Pagination keyboard with remaining > 5 should have 2 rows");
  assert.ok(pageKb.inline_keyboard[0][0].text.includes("6 – 10"), "Should show next 5 range");
  assert.strictEqual(pageKb.inline_keyboard[0][0].callback_data, "dg:next:5");
  assert.ok(pageKb.inline_keyboard[1][0].text.includes("Remaining (15)"), "Should show all remaining option");
  assert.strictEqual(pageKb.inline_keyboard[1][0].callback_data, "dg:all:5");

  const lastPageKb = buildDigestPaginationKeyboard(15, 5, 20);
  assert.strictEqual(lastPageKb.inline_keyboard.length, 1, "Last page keyboard should only have 1 row (no duplicate view all)");

  // Carousel Keyboards
  const carKbFirst = buildCarouselKeyboard(0, 20, "abcd1234", "https://example.com");
  assert.strictEqual(carKbFirst.inline_keyboard.length, 4, "Carousel keyboard should have 4 rows");
  assert.ok(carKbFirst.inline_keyboard[0][1].text.includes("1 / 20"), "Pager should show card 1/20");
  assert.strictEqual(carKbFirst.inline_keyboard[0][2].callback_data, "car:nav:next:0");

  const carKbMiddle = buildCarouselKeyboard(5, 20, "abcd1234", "https://example.com");
  assert.strictEqual(carKbMiddle.inline_keyboard[0][0].callback_data, "car:nav:prev:5");
  assert.strictEqual(carKbMiddle.inline_keyboard[0][2].callback_data, "car:nav:next:5");

  const carConfirmKb = buildCarouselActionConfirmationKeyboard(1, 20);
  assert.strictEqual(carConfirmKb.inline_keyboard.length, 2, "Action confirmation should have next and utility rows");

  const carCompletedKb = buildCarouselCompletedKeyboard();
  assert.strictEqual(carCompletedKb.inline_keyboard.length, 2, "Completed keyboard should have 2 rows");
  console.log("   ✅ Keyboards structure (including Single-Card Carousel) validated.");

  // 3. Verify Deterministic Priority Scoring
  console.log("3️⃣ Verifying deterministic priority scorer...");
  // Item 1: No ID (+35), Has Stipend (+25), 2027 (+20), Nigeria (+15), Deadline in 5 days (+5) = 100 pts
  const refDate = new Date("2026-11-01T00:00:00Z");
  const perfectScore = calculatePriorityScore(
    {
      requires_national_id: false,
      has_stipend: true,
      target_year: 2027,
      location_category: "nigeria",
      deadline: "2026-11-06",
    },
    refDate
  );
  assert.strictEqual(perfectScore, 100, "Perfect match should score 100 points");

  // Item 2: Needs ID (0), Unpaid (0), 2027 (+20), Overseas Relocate (+10), No urgent deadline = 30 pts
  const lowScore = calculatePriorityScore(
    {
      requires_national_id: true,
      has_stipend: false,
      target_year: 2027,
      location_category: "overseas_relocate",
      deadline: "2027-04-01",
    },
    refDate
  );
  assert.strictEqual(lowScore, 30, "Low priority match should score 30 points");
  console.log("   ✅ Priority scoring validated.");

  // 4. Verify Formatted Messages & Cards
  console.log("4️⃣ Verifying message & card formatting...");
  const startMsg = formatStartMessage("Alice");
  assert.ok(startMsg.includes("Alice"), "Start message should include user name");
  assert.ok(startMsg.includes("2027"), "Start message should highlight 2027 intake");

  const mockItem: DigestItem = {
    id: "int-123",
    short_id: "s1234567",
    title: "2027 Software Engineer Intern",
    company: "Google Africa",
    source_name: "test",
    apply_url: "https://careers.google.com",
    url_hash: "hash123",
    course_tags: ["computer_science"],
    tech_stack: ["Go", "Python"],
    location_category: "nigeria",
    work_mode: "hybrid",
    city_or_country: "Lagos, Nigeria",
    has_stipend: true,
    stipend_note: "₦400,000/mo",
    requires_national_id: false,
    id_requirement_note: "Zero ID upfront",
    target_year: 2027,
    deadline: "2027-01-31",
    summary_bullets: ["Develop high scale systems", "Work directly with core engineering team"],
    priority_score: 95,
    is_active: true,
    is_rollover: false,
    sent_count: 0,
  };

  const cardHtml = formatInternshipCard(mockItem, 1, 20);
  assert.ok(cardHtml.includes("Google Africa"), "Card should display company");
  assert.ok(cardHtml.includes("₦400,000/mo"), "Card should display stipend");
  assert.ok(cardHtml.includes("Zero ID upfront"), "Card should display ID status");

  const appliedHtml = formatAppliedCard(mockItem);
  assert.ok(appliedHtml.includes("APPLICATION LOGGED!"), "Applied card confirms submission");
  assert.ok(appliedHtml.toLowerCase().includes("7-day"), "Applied card mentions 7-day follow-up");

  const notEligibleHtml = formatNotEligibleCard(mockItem);
  assert.ok(notEligibleHtml.includes("NOT ELIGIBLE"), "Not eligible card confirms archiving");

  const skippedHtml = formatSkippedCard(mockItem);
  assert.ok(skippedHtml.includes("SKIPPED FOR TODAY"), "Skipped card confirms rollover");

  // Custom Course Formatter Check
  const customLocMsg = formatLocationMessage("other", "Mechanical Engineering");
  assert.ok(customLocMsg.includes("Mechanical Engineering"), "Custom course should display in location message");

  const customCompMsg = formatCompletionMessage({
    courseKey: "other",
    customCourseName: "Biomedical Engineering",
    locationKey: "both",
    stipendKey: "preferred",
  });
  assert.ok(customCompMsg.includes("Biomedical Engineering"), "Custom course should display in completion message");

  const paginationMsg = formatDigestPaginationMessage(5, 20);
  assert.ok(paginationMsg.includes("5 of 20"), "Pagination message should display count");
  assert.ok(paginationMsg.includes("15 remaining"), "Pagination message should display remaining count");

  const completeMsg = formatDigestCompleteMessage(20);
  assert.ok(completeMsg.includes("All 20 Opportunities Shown"), "Complete message should confirm finish");

  // Carousel Card Formatters
  const carCardHtml = formatCarouselCard(mockItem, 0, 20);
  assert.ok(carCardHtml.includes("Card 1 of 20"), "Carousel card should display position");
  assert.ok(carCardHtml.includes("Google Africa"), "Carousel card should display company");

  const carAppliedHtml = formatCarouselAppliedConfirmation(mockItem, 1, 20);
  assert.ok(carAppliedHtml.includes("Application Logged!"), "Carousel applied confirms submission");

  const carRejectHtml = formatCarouselRejectConfirmation(mockItem, 1, 20);
  assert.ok(carRejectHtml.includes("Archived as Not Eligible"), "Carousel reject confirms archive");

  const carCompleteHtml = formatCarouselCompleteMessage(20);
  assert.ok(carCompleteHtml.includes("You've Reviewed All 20 Opportunities"), "Carousel completion confirms review");

  console.log("   ✅ Formatters, card templates, pagination, carousel, and custom courses validated.");

  // 5. Verify Rollover Queue & State Transitions
  console.log("5️⃣ Verifying Daily 20 Rollover Queue & User State Machine...");
  const testUserId = 7770001;

  // Verify custom course upsert
  const customUser = await upsertUserProfile({
    telegramId: 8881234,
    username: "custom_user",
    courseKey: "other",
    customCourseName: "Cybersecurity",
    locationKey: "both",
    stipendKey: "strict",
  });
  assert.strictEqual(customUser.course_of_study, "Cybersecurity", "Custom course title should be saved directly");

  // Set user profile
  await upsertUserProfile({
    telegramId: testUserId,
    username: "coder_bob",
    firstName: "Bob",
    courseKey: "cs",
    locationKey: "both",
    stipendKey: "preferred",
  });

  // Seed two internships
  const opp1 = await upsertInternship({
    title: "2027 Backend Intern",
    company: "Moniepoint",
    source_name: "test",
    apply_url: "https://example.com/role-1",
    course_tags: ["computer_science"],
    tech_stack: ["Node.js"],
    location_category: "nigeria",
    work_mode: "remote",
    city_or_country: "Lagos",
    has_stipend: true,
    requires_national_id: false,
    target_year: 2027,
    summary_bullets: ["Great role"],
    is_active: true,
  });

  const opp2 = await upsertInternship({
    title: "2027 Frontend Intern",
    company: "Paystack",
    source_name: "test",
    apply_url: "https://example.com/role-2",
    course_tags: ["computer_science"],
    tech_stack: ["React"],
    location_category: "nigeria",
    work_mode: "hybrid",
    city_or_country: "Lagos",
    has_stipend: true,
    requires_national_id: false,
    target_year: 2027,
    summary_bullets: ["Great role"],
    is_active: true,
  });

  // Simulate Day 1: opp1 was dispatched yesterday (so it qualifies as a rollover today)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await markInternshipDispatched(testUserId, opp1.id, 1001, yesterday);

  // User takes no action on opp1 -> stays 'sent'
  // When getDailyUserDigest runs for Day 2:
  const digestDay2 = await getDailyUserDigest(testUserId, 20);
  const foundOpp1 = digestDay2.find((i) => i.id === opp1.id);
  assert.ok(foundOpp1, "Unacted role should be included in digest");
  assert.strictEqual(foundOpp1?.is_rollover, true, "Unacted role must be flagged as rollover");

  // User marks opp1 as Applied
  await updateApplicationStatus(testUserId, opp1.short_id, "applied");

  // When getDailyUserDigest runs again:
  const digestDay3 = await getDailyUserDigest(testUserId, 20);
  const opp1AfterApply = digestDay3.find((i) => i.id === opp1.id);
  assert.strictEqual(opp1AfterApply, undefined, "Applied roles should NOT be resent in daily digest");

  // Check stats
  const stats = await getUserStats(testUserId);
  assert.strictEqual(stats.applied, 1, "Stats should show 1 applied");
  console.log("   ✅ Daily 20 rollover queue and state machine validated.");

  console.log("\n🎉 All 5 test suites passed flawlessly!");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
