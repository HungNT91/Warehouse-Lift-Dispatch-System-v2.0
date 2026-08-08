import { getSystemState, updateSystemConfig } from "../../src/lib/telegramState.js";

export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    const state = getSystemState();
    return res.status(200).json({
      masterChatId: state.masterChatId,
      backupChatId: state.backupChatId,
      botToken: state.botToken ? state.botToken.replace(/(.{10}).*(.{4})/, "$1****$2") : "",
      webhookUrl: state.webhookUrl,
    });
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { masterChatId, backupChatId, botToken } = body;
    updateSystemConfig({ masterChatId, backupChatId, botToken });
    const state = getSystemState();
    return res.status(200).json({
      success: true,
      masterChatId: state.masterChatId,
      backupChatId: state.backupChatId,
      webhookUrl: state.webhookUrl,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

