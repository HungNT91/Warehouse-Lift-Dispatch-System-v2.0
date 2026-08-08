let configState = {
  masterChatId: "584920194",
  backupChatId: "998234102",
  botToken: "8893527039:AAG9dkuaijXHURBKRkFKH5Fb89da1B_Jgx8",
};

export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      masterChatId: configState.masterChatId,
      backupChatId: configState.backupChatId,
      botToken: configState.botToken ? configState.botToken.replace(/(.{10}).*(.{4})/, "$1****$2") : "",
    });
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { masterChatId, backupChatId, botToken } = body;
    if (masterChatId !== undefined) configState.masterChatId = masterChatId;
    if (backupChatId !== undefined) configState.backupChatId = backupChatId;
    if (botToken !== undefined && !botToken.includes("****")) configState.botToken = botToken;
    return res.status(200).json({
      success: true,
      masterChatId: configState.masterChatId,
      backupChatId: configState.backupChatId,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
