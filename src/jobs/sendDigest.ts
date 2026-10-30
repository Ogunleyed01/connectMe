import { env } from "../config/env.js";
import { createBot } from "../bot/index.js";
import { supabase } from "../db/client.js";
import {
  getDailyUserDigest,
  markInternshipDispatched,
  seedSampleInternships,
} from "../db/queries.js";
import { formatInternshipCard, formatDigestPaginationMessage } from "../bot/formatter.js";
import { buildOpportunityKeyboard, buildDigestPaginationKeyboard } from "../bot/keyboards.js";

async function runDailyDigestJob() {
  console.log("⏰ [Cron Job] Starting 08:00 WAT Daily 20 Digest dispatch...");

  if (!env.BOT_TOKEN) {
    console.error("❌ BOT_TOKEN is missing. Cannot dispatch digests.");
    process.exit(1);
  }

  await seedSampleInternships();
  const bot = createBot(env.BOT_TOKEN);

  // Retrieve all active users
  let activeUsers: Array<{ telegram_id: number; daily_limit: number }> = [];

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("telegram_id, daily_limit")
        .eq("is_active", true);

      if (!error && data) {
        activeUsers = data as any;
      }
    } catch (err) {
      console.error("[Cron Job] Failed to load users from Supabase:", err);
    }
  }

  console.log(`📋 Found ${activeUsers.length} active users to dispatch digest.`);

  for (const user of activeUsers) {
    try {
      const items = await getDailyUserDigest(user.telegram_id, user.daily_limit || 20);
      if (items.length === 0) continue;

      const rollovers = items.filter((i) => i.is_rollover).length;
      const fresh = items.length - rollovers;
      const initialBatch = Math.min(5, items.length);

      await bot.api.sendMessage(
        user.telegram_id,
        `📬 <b>Your 2027 Daily Internship Digest (08:00 WAT)</b>\n\n` +
        `Found <b>${items.length}</b> prioritized opportunities for today:\n` +
        `• 🔄 <b>Rollover (Unacted):</b> ${rollovers}\n` +
        `• 🆕 <b>Fresh Matches:</b> ${fresh}\n\n` +
        (items.length > 5
          ? `<i>Displaying top 5 matches first. Tap below to browse at your own pace:</i>`
          : `<i>Filtered for 2027 IT/SIWES intake period:</i>`),
        { parse_mode: "HTML" }
      );

      for (let idx = 0; idx < initialBatch; idx++) {
        const item = items[idx];
        const text = formatInternshipCard(item, idx + 1, items.length);
        const keyboard = buildOpportunityKeyboard(item.short_id, item.apply_url);

        const msg = await bot.api.sendMessage(user.telegram_id, text, {
          parse_mode: "HTML",
          reply_markup: keyboard,
          link_preview_options: { is_disabled: true },
        });

        await markInternshipDispatched(user.telegram_id, item.id, msg.message_id);

        // Telegram rate limit safe spacing (100ms)
        await new Promise((r) => setTimeout(r, 100));
      }

      // If more than 5 exist, render pagination controller
      if (items.length > 5) {
        await bot.api.sendMessage(
          user.telegram_id,
          formatDigestPaginationMessage(5, items.length),
          {
            parse_mode: "HTML",
            reply_markup: buildDigestPaginationKeyboard(5, 5, items.length),
          }
        );
      }

      console.log(`✅ Dispatched initial batch of ${initialBatch}/${items.length} roles to user ${user.telegram_id}`);
    } catch (err: any) {
      console.error(`❌ Failed to send digest to user ${user.telegram_id}:`, err?.message || err);
    }
  }

  console.log("🏁 Daily digest dispatch complete.");
}

import { pathToFileURL } from "node:url";

// Execute if invoked directly from CLI
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDailyDigestJob()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Digest job failure:", err);
      process.exit(1);
    });
}

export { runDailyDigestJob };
