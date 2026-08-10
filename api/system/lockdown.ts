import { toggleGlobalLockdown } from "../../src/lib/telegramState.js";

export default function handler(req: any, res: any) {
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
  const { isLocked, lockedBy } = body;

  const updatedState = toggleGlobalLockdown(!!isLocked, lockedBy || "Admin UI");

  return res.status(200).json({
    success: true,
    isLocked: updatedState.isLocked,
    lockedBy: updatedState.lockedBy,
    lockedAt: updatedState.lockedAt,
  });
}
