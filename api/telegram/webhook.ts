import { processTelegramCommand } from "../../src/lib/telegramState.js";

export default async function handler(req: any, res: any) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method === "GET") {
        return res.status(200).send("Telegram Webhook Endpoint Active");
    }

    if (req.method === "POST") {
        try {
            const update = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
            const message = update.message || update.edited_message || update.channel_post;

            if (message && message.text && message.chat) {
                const chatId = String(message.chat.id);
                const text = message.text;
                const senderName = message.from?.first_name || message.from?.username || message.chat.title || "Admin";

                await processTelegramCommand(chatId, text, senderName);
            }
        } catch (err) {
            console.error("[Telegram Webhook Serverless Error]", err);
        }
        return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
}
