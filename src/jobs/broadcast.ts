import { env } from "../config/env.js";
import { supabase } from "../db/client.js";
import { Bot, InlineKeyboard } from "grammy";
import { pathToFileURL } from "node:url";
import { sanitizeApplyUrl } from "../utils/security.js";
import { escapeHtml } from "../bot/formatter.js";

export interface BroadcastResult {
  total: number;
  successCount: number;
  failureCount: number;
  failedUsers: number[];
}

/**
 * Dispatches an announcement message to all active registered subscribers.
 */
export async function broadcastMessage(
  rawMessage: string,
  options?: {
    showDigestButton?: boolean;
    buttonText?: string;
    buttonUrl?: string;
  }
): Promise<BroadcastResult> {
  if (!env.BOT_TOKEN) {
    throw new Error("BOT_TOKEN is missing. Cannot broadcast.");
  }

  const bot = new Bot(env.BOT_TOKEN);

  // Retrieve active users from Supabase
  let activeUsers: Array<{ telegram_id: number }> = [];

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("telegram_id")
        .eq("is_active", true);

      if (!error && data) {
        activeUsers = data as any;
      }
    } catch (err) {
      console.error("[Broadcast] Failed to fetch users from Supabase:", err);
    }
  }

  // Fallback to admin if no users returned
  if (activeUsers.length === 0 && env.ADMIN_TELEGRAM_ID) {
    activeUsers = [{ telegram_id: env.ADMIN_TELEGRAM_ID }];
  }

  const cleanMessage = rawMessage.trim();
  const formattedHtml =
    `📢 <b>Announcement • 2027 Internship Tracker</b>\n\n` +
    `${escapeHtml(cleanMessage)}\n\n` +
    `<i>— Team ConnectMe</i>`;

  const keyboard = new InlineKeyboard();
  if (options?.buttonText && options?.buttonUrl) {
    const safeUrl = sanitizeApplyUrl(options.buttonUrl);
    keyboard.url(options.buttonText, safeUrl).row();
  }
  if (options?.showDigestButton !== false) {
    keyboard.text("📬 View Today's Digest", "cb:get_digest");
  }

  let successCount = 0;
  let failureCount = 0;
  const failedUsers: number[] = [];

  console.log(`📡 Broadcasting to ${activeUsers.length} subscribers...`);

  for (const user of activeUsers) {
    try {
      try {
        await bot.api.sendMessage(user.telegram_id, formattedHtml, {
          parse_mode: "HTML",
          reply_markup: keyboard,
          link_preview_options: { is_disabled: false },
        });
      } catch (sendErr: any) {
        // Fallback to plain text if HTML parsing failed
        const plainText = `📢 Announcement • 2027 Internship Tracker\n\n${cleanMessage}\n\n— Team ConnectMe`;
        await bot.api.sendMessage(user.telegram_id, plainText, {
          reply_markup: keyboard,
        });
      }

      successCount++;
      // Safe pacing between messages to avoid hitting Telegram 429 limits
      await new Promise((r) => setTimeout(r, 60));
    } catch (err: any) {
      failureCount++;
      failedUsers.push(user.telegram_id);
      console.warn(`[Broadcast] Could not deliver to user ${user.telegram_id}:`, err?.message || err);
    }
  }

  console.log(
    `✅ Broadcast complete. Sent: ${successCount}, Failed: ${failureCount}, Total: ${activeUsers.length}`
  );

  return {
    total: activeUsers.length,
    successCount,
    failureCount,
    failedUsers,
  };
}

// CLI entry point
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const messageArg = args.join(" ").trim();

  if (!messageArg) {
    console.error("❌ Usage: npx tsx src/jobs/broadcast.ts \"Your announcement message here\"");
    process.exit(1);
  }

  broadcastMessage(messageArg, { showDigestButton: true })
    .then((res) => {
      console.log(`\n🎉 Delivered to ${res.successCount} of ${res.total} users.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Broadcast failed:", err);
      process.exit(1);
    });
}
