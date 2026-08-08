import { processTelegramCommand } from "../../src/lib/telegramState.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  const { chatId, text, senderName } = body;
  if (!chatId || !text) {
    return res.status(400).json({ error: "Missing chatId or text" });
  }

  const result = await processTelegramCommand(String(chatId), text, senderName || "API User");
  return res.status(200).json(result);
}

