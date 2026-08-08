import { getSystemState } from "../../src/lib/telegramState.js";

export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const state = getSystemState();

  return res.status(200).json({
    isLocked: state.isLocked,
    lockedBy: state.lockedBy,
    lockedAt: state.lockedAt,
    masterChatId: state.masterChatId,
    backupChatId: state.backupChatId,
    webhookUrl: state.webhookUrl,
  });
}

