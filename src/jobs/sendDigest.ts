import { env } from "../config/env.js";
import { createBot } from "../bot/index.js";
import { supabase } from "../db/client.js";
import {
  getDailyUserDigest,
  markInternshipDispatched,
  seedSampleInternships,
} from "../db/queries.js";
import { formatCarouselCard } from "../bot/formatter.js";
import { buildCarouselKeyboard } from "../bot/keyboards.js";

async function runDailyDigestJob() {
  console.log("⏰ [Cron Job] Starting 08:00 WAT Daily 20 Digest dispatch (Single-Card Carousel)...");

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

      const firstItem = items[0];
      const text = formatCarouselCard(firstItem, 0, items.length);
      const keyboard = buildCarouselKeyboard(
        0,
        items.length,
        firstItem.short_id,
        firstItem.apply_url
      );

      const msg = await bot.api.sendMessage(user.telegram_id, text, {
        parse_mode: "HTML",
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      });

      await markInternshipDispatched(user.telegram_id, firstItem.id, msg.message_id);

      console.log(`✅ Dispatched carousel digest (1 card, ${items.length} opportunities) to user ${user.telegram_id}`);

      // Telegram rate limit safe spacing (100ms between users)
      await new Promise((r) => setTimeout(r, 100));
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
