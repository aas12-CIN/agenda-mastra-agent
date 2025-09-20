import { createTool } from "@mastra/core";
import { z } from "zod";

// Expected ENV:
// TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
export const notifyTool = createTool({
  id: "notify",
  description: "Envia mensagem para Telegram; fallback: console",
  inputSchema: z.object({
    message: z.string().describe("Texto da mensagem a ser enviada"),
    channel: z.enum(["telegram", "console"]).optional(),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    channel: z.string(),
    id: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

    // Decide the channel
    const channel =
      context.channel ||
      (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID ? "telegram" : "console");

    if (channel === "telegram" && TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: context.message,
            parse_mode: "Markdown", // optional
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error("Erro no envio ao Telegram: " + JSON.stringify(data));
        }

        return {
          ok: true,
          channel: "telegram",
          id: data?.result?.message_id?.toString(),
        };
      } catch (err) {
        console.error("[Notify] Erro no Telegram:", err);
        // fallback to console
      }
    }

    // Always falls here if it fails or if TELEGRAM is not configured
    console.log("[Notify] =>", context.message);
    return { ok: true, channel: "console" };
  },
});
