import "dotenv/config";
import { Bot } from "./bot/bot.ts";

async function main() {
  const bot = new Bot();

  process.on("SIGINT", () => void shutdown(bot));
  process.on("SIGTERM", () => void shutdown(bot));

  await bot.run();
}

async function shutdown(bot: Bot) {
  try {
    console.log("Shutting down...");
    await bot.shutdown();
  } catch (error) {
    console.error("Shutdown error:", error);
  } finally {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
