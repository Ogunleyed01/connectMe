import { Bot, Context } from "grammy";
import { env } from "../config/env.js";
import {
  buildCourseKeyboard,
  buildLocationKeyboard,
  buildStipendKeyboard,
  buildCompletedKeyboard,
  buildOpportunityKeyboard,
  buildFollowupKeyboard,
  buildCustomCoursePromptKeyboard,
  buildDigestPaginationKeyboard,
  buildCarouselKeyboard,
  buildCarouselActionConfirmationKeyboard,
  buildCarouselCompletedKeyboard,
} from "./keyboards.js";
import {
  formatStartMessage,
  formatCustomCoursePrompt,
  formatLocationMessage,
  formatStipendMessage,
  formatCompletionMessage,
  formatSettingsView,
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
} from "./formatter.js";
import {
  upsertUserProfile,
  getUserProfile,
  getDailyUserDigest,
  getInternshipByShortId,
  updateApplicationStatus,
  markInternshipDispatched,
  getUserStats,
  seedSampleInternships,
  DigestItem,
} from "../db/queries.js";

// Cached active daily digest items per user for step-by-step pagination (5 first, then view more)
const userDigestSessions = new Map<number, { items: DigestItem[]; timestamp: number }>();

export function createBot(token: string = env.BOT_TOKEN): Bot<Context> {
  if (!token) {
    throw new Error(
      "BOT_TOKEN is empty! Please set BOT_TOKEN in your .env file or pass it to createBot()."
    );
  }

  const bot = new Bot(token);

  // In-flight custom course onboarding sessions per user
  const userSessions = new Map<number, { awaitingCustomCourse?: boolean; courseKey?: string; customCourseName?: string }>();

  // Global error handler
  bot.catch((err) => {
    console.error("[Bot Error]", err.error);
  });

  // /start command: triggers the interactive onboarding flow
  bot.command("start", async (ctx) => {
    if (ctx.from) userSessions.delete(ctx.from.id);
    const firstName = ctx.from?.first_name;
    await ctx.reply(formatStartMessage(firstName), {
      parse_mode: "HTML",
      reply_markup: buildCourseKeyboard(),
    });
  });

  // Text message listener for custom course entry
  bot.on("message:text", async (ctx, next) => {
    if (!ctx.from) return next();
    const session = userSessions.get(ctx.from.id);

    if (session?.awaitingCustomCourse && !ctx.message.text.startsWith("/")) {
      const customName = ctx.message.text.trim();
      if (customName.length < 2) {
        await ctx.reply("Please enter a valid course of study (at least 2 letters):");
        return;
      }

      session.awaitingCustomCourse = false;
      session.customCourseName = customName;
      session.courseKey = "other";
      userSessions.set(ctx.from.id, session);

      await ctx.reply(formatLocationMessage("other", customName), {
        parse_mode: "HTML",
        reply_markup: buildLocationKeyboard("other"),
      });
      return;
    }

    return next();
  });

  // /digest command: fetches today's daily 20 matches & dispatches them
  bot.command("digest", async (ctx) => {
    if (!ctx.from) return;
    await sendUserDailyDigest(ctx, ctx.from.id);
  });

  // /stats command: shows application numbers & pipeline status
  bot.command("stats", async (ctx) => {
    if (!ctx.from) return;
    const stats = await getUserStats(ctx.from.id);
    await ctx.reply(formatStatsMessage(stats), {
      parse_mode: "HTML",
      reply_markup: buildCompletedKeyboard(),
    });
  });

  // /settings or /filter command: inspect or reconfigure
  bot.command(["settings", "filter"], async (ctx) => {
    if (!ctx.from) return;
    const profile = await getUserProfile(ctx.from.id);
    if (!profile) {
      await ctx.reply(formatStartMessage(ctx.from.first_name), {
        parse_mode: "HTML",
        reply_markup: buildCourseKeyboard(),
      });
      return;
    }

    await ctx.reply(formatSettingsView(profile), {
      parse_mode: "HTML",
      reply_markup: buildCompletedKeyboard(),
    });
  });

  // /help command
  bot.command("help", async (ctx) => {
    const text =
      `🤖 <b>2027 Internship Tracker Bot Menu</b>\n\n` +
      `Commands:\n` +
      `• /start - Launch interactive onboarding & select preferences\n` +
      `• /digest - Receive today's matched 2027 opportunities now\n` +
      `• /stats - View your applied, interviewing, and queued counts\n` +
      `• /settings - Review and adjust your filters\n` +
      `• /help - Display this command overview\n\n` +
      `<i>Daily batch of up to 20 roles is dispatched automatically at 08:00 WAT. Unacted roles rollover each morning.</i>`;

    await ctx.reply(text, { parse_mode: "HTML" });
  });

  // Callback query: Restart flow
  bot.callbackQuery("cb:start", async (ctx) => {
    if (ctx.from) userSessions.delete(ctx.from.id);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(formatStartMessage(ctx.from?.first_name), {
      parse_mode: "HTML",
      reply_markup: buildCourseKeyboard(),
    });
  });

  // Callback query: Trigger Daily Digest
  bot.callbackQuery("cb:get_digest", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Fetching your 2027 opportunities..." });
    if (!ctx.from) return;
    await sendUserDailyDigest(ctx, ctx.from.id);
  });

  // Callback query: Trigger Stats View
  bot.callbackQuery("cb:view_stats", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;
    const stats = await getUserStats(ctx.from.id);
    await ctx.reply(formatStatsMessage(stats), {
      parse_mode: "HTML",
      reply_markup: buildCompletedKeyboard(),
    });
  });

  // Callback query: Step 1 -> Course chosen
  bot.callbackQuery(/^cb:c:(.+)$/, async (ctx) => {
    const courseKey = ctx.match[1];
    await ctx.answerCallbackQuery();

    if (courseKey === "other") {
      if (ctx.from) {
        userSessions.set(ctx.from.id, {
          awaitingCustomCourse: true,
          courseKey: "other",
        });
      }
      await ctx.editMessageText(formatCustomCoursePrompt(), {
        parse_mode: "HTML",
        reply_markup: buildCustomCoursePromptKeyboard(),
      });
      return;
    }

    if (ctx.from) {
      userSessions.set(ctx.from.id, {
        awaitingCustomCourse: false,
        courseKey,
      });
    }

    await ctx.editMessageText(formatLocationMessage(courseKey), {
      parse_mode: "HTML",
      reply_markup: buildLocationKeyboard(courseKey),
    });
  });

  // Callback query: Step 2 -> Location chosen
  bot.callbackQuery(/^cb:l:([^:]+):([^:]+)$/, async (ctx) => {
    const courseKey = ctx.match[1];
    const locationKey = ctx.match[2];
    const session = ctx.from ? userSessions.get(ctx.from.id) : undefined;
    const customCourseName = session?.customCourseName;

    await ctx.answerCallbackQuery({ text: `Location selected!` });

    await ctx.editMessageText(formatStipendMessage(courseKey, locationKey, customCourseName), {
      parse_mode: "HTML",
      reply_markup: buildStipendKeyboard(courseKey, locationKey),
    });
  });

  // Callback query: Step 3 -> Stipend chosen (Final onboarding step)
  bot.callbackQuery(/^cb:s:([^:]+):([^:]+):([^:]+)$/, async (ctx) => {
    const courseKey = ctx.match[1];
    const locationKey = ctx.match[2];
    const stipendKey = ctx.match[3];
    const session = ctx.from ? userSessions.get(ctx.from.id) : undefined;
    const customCourseName = session?.customCourseName;

    if (!ctx.from) {
      await ctx.answerCallbackQuery({ text: "Error identifying user." });
      return;
    }

    await ctx.answerCallbackQuery({ text: "Saving your preferences..." });

    // Persist to Supabase / store
    await upsertUserProfile({
      telegramId: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      courseKey,
      customCourseName,
      locationKey,
      stipendKey,
    });

    await ctx.editMessageText(
      formatCompletionMessage({
        courseKey,
        customCourseName,
        locationKey,
        stipendKey,
        name: ctx.from.first_name,
      }),
      {
        parse_mode: "HTML",
        reply_markup: buildCompletedKeyboard(),
      }
    );
  });

  // Callback query: Navigation Back to Step 1
  bot.callbackQuery("cb:b:start", async (ctx) => {
    if (ctx.from) userSessions.delete(ctx.from.id);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(formatStartMessage(ctx.from?.first_name), {
      parse_mode: "HTML",
      reply_markup: buildCourseKeyboard(),
    });
  });

  // Callback query: Navigation Back to Step 2
  bot.callbackQuery(/^cb:b:loc:(.+)$/, async (ctx) => {
    const courseKey = ctx.match[1];
    const session = ctx.from ? userSessions.get(ctx.from.id) : undefined;
    const customCourseName = session?.customCourseName;

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(formatLocationMessage(courseKey, customCourseName), {
      parse_mode: "HTML",
      reply_markup: buildLocationKeyboard(courseKey),
    });
  });

  // Callback query: View settings
  bot.callbackQuery("cb:view_settings", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;
    const profile = await getUserProfile(ctx.from.id);
    if (profile) {
      await ctx.reply(formatSettingsView(profile), {
        parse_mode: "HTML",
        reply_markup: buildCompletedKeyboard(),
      });
    } else {
      await ctx.reply("No saved profile found. Tap below to start:", {
        reply_markup: buildCourseKeyboard(),
      });
    }
  });

  // =========================================================================
  // INTERNSHIP ACTION BUTTONS (State Machine)
  // =========================================================================

  // Action: User clicked "✅ Applied"
  bot.callbackQuery(/^app:apply:(.+)$/, async (ctx) => {
    const shortId = ctx.match[1];
    if (!ctx.from) return;

    const internship = await getInternshipByShortId(shortId);
    if (!internship) {
      await ctx.answerCallbackQuery({ text: "Internship details not found." });
      return;
    }

    await ctx.answerCallbackQuery({ text: "Awesome! Application recorded. 🎉" });

    // Update state to 'applied' & schedule 7-day follow-up
    await updateApplicationStatus(ctx.from.id, shortId, "applied", {
      telegramMessageId: ctx.callbackQuery.message?.message_id,
    });

    // Update message card in-place
    await ctx.editMessageText(formatAppliedCard(internship), {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  });

  // Action: User clicked "❌ Not Eligible"
  bot.callbackQuery(/^app:reject:(.+)$/, async (ctx) => {
    const shortId = ctx.match[1];
    if (!ctx.from) return;

    const internship = await getInternshipByShortId(shortId);
    if (!internship) {
      await ctx.answerCallbackQuery({ text: "Internship details not found." });
      return;
    }

    await ctx.answerCallbackQuery({ text: "Archived as not eligible." });

    // Update state to 'not_eligible'
    await updateApplicationStatus(ctx.from.id, shortId, "not_eligible", {
      telegramMessageId: ctx.callbackQuery.message?.message_id,
    });

    // Update message card in-place
    await ctx.editMessageText(formatNotEligibleCard(internship), {
      parse_mode: "HTML",
    });
  });

  // Action: User clicked "⏭️ Skip for Tomorrow"
  bot.callbackQuery(/^app:skip:(.+)$/, async (ctx) => {
    const shortId = ctx.match[1];
    if (!ctx.from) return;

    const internship = await getInternshipByShortId(shortId);
    if (!internship) {
      await ctx.answerCallbackQuery({ text: "Internship details not found." });
      return;
    }

    await ctx.answerCallbackQuery({ text: "Skipped for today. Kept in queue." });

    // Remains in 'sent' state for next day's rollover
    await updateApplicationStatus(ctx.from.id, shortId, "sent", {
      telegramMessageId: ctx.callbackQuery.message?.message_id,
    });

    // Update message card in-place
    await ctx.editMessageText(formatSkippedCard(internship), {
      parse_mode: "HTML",
    });
  });

  // Follow-up check-in response buttons
  bot.callbackQuery(/^fup:([a-z]+):(.+)$/, async (ctx) => {
    const action = ctx.match[1];
    const shortId = ctx.match[2];
    if (!ctx.from) return;

    const internship = await getInternshipByShortId(shortId);
    const company = internship ? internship.company : "the company";

    let statusText = "";
    if (action === "int") {
      await updateApplicationStatus(ctx.from.id, shortId, "interviewing");
      statusText = `🎉 Congrats on securing an interview with ${company}! Best of luck!`;
    } else if (action === "off") {
      await updateApplicationStatus(ctx.from.id, shortId, "offered");
      statusText = `🏆 Huge congratulations on your offer from ${company}!`;
    } else if (action === "rej") {
      await updateApplicationStatus(ctx.from.id, shortId, "rejected");
      statusText = `Noted. Rejections are part of the journey. Keep pushing forward!`;
    } else {
      statusText = `Got it! We'll check in with you again closer to the start date.`;
    }

    await ctx.answerCallbackQuery({ text: "Status updated!" });
    await ctx.editMessageText(`✅ <b>Status Update Recorded</b>\n\n${statusText}`, {
      parse_mode: "HTML",
    });
  });

  // Callback query: View stats
  bot.callbackQuery(["cb:view_stats", "cb:stats"], async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;
    const stats = await getUserStats(ctx.from.id);
    await ctx.reply(formatStatsMessage(stats), {
      parse_mode: "HTML",
      reply_markup: buildCompletedKeyboard(),
    });
  });

  // Callback query: Load Next 5 opportunities
  bot.callbackQuery(/^dg:next:(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const offset = parseInt(ctx.match[1], 10);
    const telegramId = ctx.from.id;

    let session = userDigestSessions.get(telegramId);
    let items = session?.items;

    if (!items || items.length === 0) {
      items = await getDailyUserDigest(telegramId, 20);
      userDigestSessions.set(telegramId, { items, timestamp: Date.now() });
    }

    if (!items || offset >= items.length) {
      await ctx.answerCallbackQuery({ text: "All opportunities already shown!" });
      return;
    }

    await ctx.answerCallbackQuery({ text: "Loading next batch... 📄" });

    // Update the controller message to remove its buttons and mark progress
    try {
      await ctx.editMessageText(
        `✅ <i>Reviewed opportunities 1 to ${offset}</i>`,
        { parse_mode: "HTML" }
      );
    } catch {
      // Ignore if message could not be modified
    }

    const nextBatchEnd = Math.min(offset + 5, items.length);

    for (let idx = offset; idx < nextBatchEnd; idx++) {
      const item = items[idx];
      const text = formatInternshipCard(item, idx + 1, items.length);
      const keyboard = buildOpportunityKeyboard(item.short_id, item.apply_url);

      const sentMsg = await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      });

      await markInternshipDispatched(telegramId, item.id, sentMsg.message_id);
      await new Promise((r) => setTimeout(r, 80));
    }

    if (nextBatchEnd < items.length) {
      await ctx.reply(formatDigestPaginationMessage(nextBatchEnd, items.length), {
        parse_mode: "HTML",
        reply_markup: buildDigestPaginationKeyboard(nextBatchEnd, 5, items.length),
      });
    } else {
      await ctx.reply(formatDigestCompleteMessage(items.length), {
        parse_mode: "HTML",
        reply_markup: buildCompletedKeyboard(),
      });
    }
  });

  // Callback query: View All Remaining opportunities
  bot.callbackQuery(/^dg:all:(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const offset = parseInt(ctx.match[1], 10);
    const telegramId = ctx.from.id;

    let session = userDigestSessions.get(telegramId);
    let items = session?.items;

    if (!items || items.length === 0) {
      items = await getDailyUserDigest(telegramId, 20);
      userDigestSessions.set(telegramId, { items, timestamp: Date.now() });
    }

    if (!items || offset >= items.length) {
      await ctx.answerCallbackQuery({ text: "All opportunities already shown!" });
      return;
    }

    const remainingCount = items.length - offset;
    await ctx.answerCallbackQuery({ text: `Loading all remaining ${remainingCount} opportunities... 🚀` });

    try {
      await ctx.editMessageText(
        `✅ <i>Loading remaining ${remainingCount} opportunities...</i>`,
        { parse_mode: "HTML" }
      );
    } catch {
      // Ignore
    }

    for (let idx = offset; idx < items.length; idx++) {
      const item = items[idx];
      const text = formatInternshipCard(item, idx + 1, items.length);
      const keyboard = buildOpportunityKeyboard(item.short_id, item.apply_url);

      const sentMsg = await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      });

      await markInternshipDispatched(telegramId, item.id, sentMsg.message_id);
      await new Promise((r) => setTimeout(r, 80));
    }

    await ctx.reply(formatDigestCompleteMessage(items.length), {
      parse_mode: "HTML",
      reply_markup: buildCompletedKeyboard(),
    });
  });

  // =========================================================================
  // SINGLE-CARD INTERACTIVE CAROUSEL HANDLERS (Dynamic In-Place Pager)
  // =========================================================================

  // No-op for disabled page boundaries
  bot.callbackQuery("noop", async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  // Tap on page counter badge
  bot.callbackQuery(/^car:status:(\d+)$/, async (ctx) => {
    const idx = parseInt(ctx.match[1], 10);
    await ctx.answerCallbackQuery({ text: `Viewing opportunity ${idx + 1}` });
  });

  // Flip through cards: Previous / Next
  bot.callbackQuery(/^car:nav:(prev|next):(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const direction = ctx.match[1];
    const currentIndex = parseInt(ctx.match[2], 10);
    const telegramId = ctx.from.id;

    let session = userDigestSessions.get(telegramId);
    let items = session?.items;

    if (!items || items.length === 0) {
      items = await getDailyUserDigest(telegramId, 20);
      userDigestSessions.set(telegramId, { items, timestamp: Date.now() });
    }

    if (!items || items.length === 0) {
      await ctx.answerCallbackQuery({ text: "No active opportunities." });
      return;
    }

    const targetIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex < 0 || targetIndex >= items.length) {
      await ctx.answerCallbackQuery({ text: "Reached the end of the carousel." });
      return;
    }

    await ctx.answerCallbackQuery();

    const targetItem = items[targetIndex];
    await ctx.editMessageText(
      formatCarouselCard(targetItem, targetIndex, items.length),
      {
        parse_mode: "HTML",
        reply_markup: buildCarouselKeyboard(
          targetIndex,
          items.length,
          targetItem.short_id,
          targetItem.apply_url
        ),
        link_preview_options: { is_disabled: true },
      }
    );

    await markInternshipDispatched(telegramId, targetItem.id, ctx.callbackQuery.message?.message_id);
  });

  // Direct Jump to a specific opportunity index
  bot.callbackQuery(/^car:jump:(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const targetIndex = parseInt(ctx.match[1], 10);
    const telegramId = ctx.from.id;

    let session = userDigestSessions.get(telegramId);
    let items = session?.items;

    if (!items || items.length === 0) {
      items = await getDailyUserDigest(telegramId, 20);
      userDigestSessions.set(telegramId, { items, timestamp: Date.now() });
    }

    if (!items || targetIndex >= items.length) {
      await ctx.answerCallbackQuery({ text: "All opportunities reviewed!" });
      return;
    }

    await ctx.answerCallbackQuery();

    const targetItem = items[targetIndex];
    await ctx.editMessageText(
      formatCarouselCard(targetItem, targetIndex, items.length),
      {
        parse_mode: "HTML",
        reply_markup: buildCarouselKeyboard(
          targetIndex,
          items.length,
          targetItem.short_id,
          targetItem.apply_url
        ),
        link_preview_options: { is_disabled: true },
      }
    );

    await markInternshipDispatched(telegramId, targetItem.id, ctx.callbackQuery.message?.message_id);
  });

  // Carousel Action: User clicked Applied
  bot.callbackQuery(/^car:apply:([^:]+):(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const shortId = ctx.match[1];
    const currentIndex = parseInt(ctx.match[2], 10);
    const telegramId = ctx.from.id;

    const internship = await getInternshipByShortId(shortId);
    if (!internship) {
      await ctx.answerCallbackQuery({ text: "Opportunity not found." });
      return;
    }

    await ctx.answerCallbackQuery({ text: "🎉 Application recorded! Saved to your pipeline." });

    await updateApplicationStatus(telegramId, shortId, "applied", {
      telegramMessageId: ctx.callbackQuery.message?.message_id,
    });

    let session = userDigestSessions.get(telegramId);
    const totalCount = session?.items?.length || 20;
    const nextIndex = currentIndex + 1 < totalCount ? currentIndex + 1 : null;

    await ctx.editMessageText(
      formatCarouselAppliedConfirmation(internship, nextIndex, totalCount),
      {
        parse_mode: "HTML",
        reply_markup: buildCarouselActionConfirmationKeyboard(nextIndex, totalCount),
      }
    );
  });

  // Carousel Action: User clicked Not Eligible
  bot.callbackQuery(/^car:rej:([^:]+):(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const shortId = ctx.match[1];
    const currentIndex = parseInt(ctx.match[2], 10);
    const telegramId = ctx.from.id;

    const internship = await getInternshipByShortId(shortId);
    if (!internship) {
      await ctx.answerCallbackQuery({ text: "Opportunity not found." });
      return;
    }

    await ctx.answerCallbackQuery({ text: "Archived as not eligible." });

    await updateApplicationStatus(telegramId, shortId, "not_eligible", {
      telegramMessageId: ctx.callbackQuery.message?.message_id,
    });

    let session = userDigestSessions.get(telegramId);
    const totalCount = session?.items?.length || 20;
    const nextIndex = currentIndex + 1 < totalCount ? currentIndex + 1 : null;

    await ctx.editMessageText(
      formatCarouselRejectConfirmation(internship, nextIndex, totalCount),
      {
        parse_mode: "HTML",
        reply_markup: buildCarouselActionConfirmationKeyboard(nextIndex, totalCount),
      }
    );
  });

  // Carousel Action: User clicked Skip for Tomorrow
  bot.callbackQuery(/^car:skip:([^:]+):(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const shortId = ctx.match[1];
    const currentIndex = parseInt(ctx.match[2], 10);
    const telegramId = ctx.from.id;

    const internship = await getInternshipByShortId(shortId);
    if (internship) {
      await updateApplicationStatus(telegramId, shortId, "sent", {
        telegramMessageId: ctx.callbackQuery.message?.message_id,
      });
    }

    let session = userDigestSessions.get(telegramId);
    let items = session?.items;

    if (!items || items.length === 0) {
      items = await getDailyUserDigest(telegramId, 20);
      userDigestSessions.set(telegramId, { items, timestamp: Date.now() });
    }

    const nextIndex = currentIndex + 1;
    if (items && nextIndex < items.length) {
      await ctx.answerCallbackQuery({ text: "Skipped for today. Showing next..." });
      const nextItem = items[nextIndex];
      await ctx.editMessageText(
        formatCarouselCard(nextItem, nextIndex, items.length),
        {
          parse_mode: "HTML",
          reply_markup: buildCarouselKeyboard(
            nextIndex,
            items.length,
            nextItem.short_id,
            nextItem.apply_url
          ),
          link_preview_options: { is_disabled: true },
        }
      );
      await markInternshipDispatched(telegramId, nextItem.id, ctx.callbackQuery.message?.message_id);
    } else {
      await ctx.answerCallbackQuery({ text: "You've reviewed all opportunities!" });
      await ctx.editMessageText(
        formatCarouselCompleteMessage(items ? items.length : 20),
        {
          parse_mode: "HTML",
          reply_markup: buildCarouselCompletedKeyboard(),
        }
      );
    }
  });

  // Carousel Action: Start Over from Card 1
  bot.callbackQuery("car:first", async (ctx) => {
    if (!ctx.from) return;
    const telegramId = ctx.from.id;

    let session = userDigestSessions.get(telegramId);
    let items = session?.items;

    if (!items || items.length === 0) {
      items = await getDailyUserDigest(telegramId, 20);
      userDigestSessions.set(telegramId, { items, timestamp: Date.now() });
    }

    if (!items || items.length === 0) {
      await ctx.answerCallbackQuery({ text: "No opportunities to show." });
      return;
    }

    await ctx.answerCallbackQuery({ text: "Restarting from Card 1" });
    const firstItem = items[0];
    await ctx.editMessageText(
      formatCarouselCard(firstItem, 0, items.length),
      {
        parse_mode: "HTML",
        reply_markup: buildCarouselKeyboard(0, items.length, firstItem.short_id, firstItem.apply_url),
        link_preview_options: { is_disabled: true },
      }
    );
  });

  // Carousel Action: View completion summary
  bot.callbackQuery("car:finish", async (ctx) => {
    if (!ctx.from) return;
    const session = userDigestSessions.get(ctx.from.id);
    const totalCount = session?.items?.length || 20;

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      formatCarouselCompleteMessage(totalCount),
      {
        parse_mode: "HTML",
        reply_markup: buildCarouselCompletedKeyboard(),
      }
    );
  });

  return bot;
}

/**
 * Dispatches the daily matched internships to the user using the Single-Card Carousel (Zero-Clutter)
 */
async function sendUserDailyDigest(ctx: Context, telegramId: number) {
  let profile = await getUserProfile(telegramId);
  if (!profile) {
    await ctx.reply(
      "Please set up your preferences first so we can tailor the 2027 opportunities for you!",
      {
        parse_mode: "HTML",
        reply_markup: buildCourseKeyboard(),
      }
    );
    return;
  }

  // Ensure samples are seeded
  await seedSampleInternships();

  const items = await getDailyUserDigest(telegramId, profile.daily_limit || 20);

  if (items.length === 0) {
    await ctx.reply(
      `📬 <b>No new matches found today for your current criteria.</b>\n\n` +
      `We scour sources every morning at 08:00 WAT. As new 2027 listings open, they will be dispatched straight to your inbox!\n\n` +
      `<i>Use /settings if you'd like to widen your location or course filters.</i>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // Cache user's daily items for lightning-fast carousel flipping
  userDigestSessions.set(telegramId, { items, timestamp: Date.now() });

  // Send EXACTLY ONE message: The first opportunity card in the interactive carousel
  const firstItem = items[0];
  const text = formatCarouselCard(firstItem, 0, items.length);
  const keyboard = buildCarouselKeyboard(
    0,
    items.length,
    firstItem.short_id,
    firstItem.apply_url
  );

  const sentMsg = await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
    link_preview_options: { is_disabled: true },
  });

  // Record that this card was dispatched
  await markInternshipDispatched(telegramId, firstItem.id, sentMsg.message_id);
}
