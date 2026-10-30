import { env } from "../config/env.js";
import { createBot } from "../bot/index.js";
import { supabase } from "../db/client.js";
import { formatFollowupPrompt } from "../bot/formatter.js";
import { buildFollowupKeyboard } from "../bot/keyboards.js";
import { InternshipRecord } from "../db/queries.js";

async function runFollowupJob() {
  console.log("⏰ [Cron Job] Starting 7-day post-application follow-up check-ins...");

  if (!env.BOT_TOKEN) {
    console.error("❌ BOT_TOKEN is missing. Cannot dispatch follow-ups.");
    process.exit(1);
  }

  const bot = createBot(env.BOT_TOKEN);

  if (!supabase) {
    console.log("ℹ️ Supabase not configured. Skipping persistent follow-up scan.");
    return;
  }

  try {
    const now = new Date().toISOString();
    const { data: followups, error } = await supabase
      .from("user_applications")
      .select(`
        id,
        user_id,
        applied_at,
        followup_count,
        users!inner(telegram_id),
        internships!inner(id, short_id, title, company, apply_url)
      `)
      .in("status", ["applied", "interviewing"])
      .lte("next_followup_at", now);

    if (error) {
      console.error("[Follow-up Error] Error querying pending follow-ups:", error.message);
      return;
    }

    if (!followups || followups.length === 0) {
      console.log("✅ No applications due for follow-up today.");
      return;
    }

    console.log(`📋 Found ${followups.length} applications due for follow-up check-in.`);

    for (const item of followups as any[]) {
      const telegramId = item.users?.telegram_id;
      const internship = item.internships as InternshipRecord;

      if (!telegramId || !internship) continue;

      try {
        const text = formatFollowupPrompt(internship, item.applied_at);
        const keyboard = buildFollowupKeyboard(internship.short_id);

        await bot.api.sendMessage(telegramId, text, {
          parse_mode: "HTML",
          reply_markup: keyboard,
        });

        // Reschedule next follow-up for 7 days later
        const nextDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await supabase
          .from("user_applications")
          .update({
            followup_count: (item.followup_count || 0) + 1,
            next_followup_at: nextDate,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        console.log(`✅ Sent follow-up to user ${telegramId} for ${internship.company}`);
      } catch (sendErr: any) {
        console.error(`❌ Failed to send follow-up to ${telegramId}:`, sendErr?.message || sendErr);
      }
    }
  } catch (err) {
    console.error("❌ Fatal error during follow-up run:", err);
  }

  console.log("🏁 Follow-up check-in job complete.");
}

import { pathToFileURL } from "node:url";

// Execute if invoked directly from CLI
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFollowupJob()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Follow-up job failure:", err);
      process.exit(1);
    });
}

export { runFollowupJob };
