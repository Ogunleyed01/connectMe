import http from "node:http";
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

    // Start lightweight HTTP server for Render / Koyeb Web Service health checks (Free Tier)
    const port = process.env.PORT || 8080;
    const server = http.createServer((req, res) => {
      // Hardened basic security headers
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("Content-Security-Policy", "default-src 'none'");

      // Only respond to GET and HEAD health probes
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { "Content-Type": "text/plain" });
        res.end("Method Not Allowed");
        return;
      }

      if (req.url === "/health" || req.url === "/") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", bot: `@${botInfo.username}` }));
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    });

    server.listen(port, () => {
      console.log(`🌐 HTTP health-check server listening on port ${port} (Ready for Free Web Service hosting)`);
    });

    console.log(`📡 Starting long-polling listener...`);

    // Handle graceful shutdown
    const handleShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Stopping bot...`);
      server.close();
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
