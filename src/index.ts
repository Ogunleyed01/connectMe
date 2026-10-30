import { env } from "./config/env.js";
import { createBot } from "./bot/index.js";
import { seedSampleInternships } from "./db/queries.js";

async function main() {
  console.log("==================================================");
  console.log(" 🚀 2027 Internship Tracker & Daily Digest Bot    ");
  console.log("==================================================");

  if (!env.BOT_TOKEN || env.BOT_TOKEN.trim() === "" || env.BOT_TOKEN === "your_telegram_bot_token_here") {
    console.error("\n❌ [Missing BOT_TOKEN]");
    console.error("Please add your Telegram Bot Token to the .env file:");
    console.error("BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRstuVWXyz\n");
    console.error("You can get a bot token by talking to @BotFather on Telegram.\n");
    process.exit(1);
  }

  try {
    // Seed initial 2027 opportunities
    await seedSampleInternships();

    const bot = createBot(env.BOT_TOKEN);

    // Fetch bot info to confirm token validity
    const botInfo = await bot.api.getMe();
    console.log(`✅ Authenticated with Telegram as @${botInfo.username} (${botInfo.first_name})`);
    console.log(`📡 Starting long-polling listener...`);

    // Handle graceful shutdown
    const handleShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Stopping bot...`);
      await bot.stop();
      process.exit(0);
    };

    process.once("SIGINT", () => handleShutdown("SIGINT"));
    process.once("SIGTERM", () => handleShutdown("SIGTERM"));

    await bot.start({
      onStart: () => {
        console.log(`🤖 Bot is live and listening for messages & /start commands!`);
      },
    });
  } catch (error) {
    console.error("❌ Fatal startup error:", error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled top-level error:", err);
  process.exit(1);
});
