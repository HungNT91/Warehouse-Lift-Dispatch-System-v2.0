import express from "express";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// CORS Headers for Vercel Serverless & Local
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

// Hardcoded Telegram & Emergency Lockdown Configuration (Works out-of-the-box in Production without .env)
const DEFAULT_TELEGRAM_BOT_TOKEN = "8893527039:AAG9dkuaijXHURBKRkFKH5Fb89da1B_Jgx8";
const DEFAULT_MASTER_CHAT_ID = "584920194";
const DEFAULT_BACKUP_CHAT_ID = "998234102";

// In-memory System Lockdown State (persisted or synchronized across sessions)
let systemState = {
    isLocked: false,
    lockedBy: null as string | null,
    lockedAt: null as string | null,
    masterChatId: process.env.TELEGRAM_MASTER_CHAT_ID || DEFAULT_MASTER_CHAT_ID,
    backupChatId: process.env.TELEGRAM_BACKUP_CHAT_ID || DEFAULT_BACKUP_CHAT_ID,
    botToken: process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN,
    lastOffset: 0,
};

// Helper function to send message back via Telegram Bot API
async function sendTelegramReply(chatId: string, text: string) {
    try {
        const token = systemState.botToken || DEFAULT_TELEGRAM_BOT_TOKEN;
        if (!token) return;
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: "HTML",
            }),
        });
    } catch (err) {
        console.error("Error sending Telegram reply:", err);
    }
}

// Process incoming Telegram command
async function processTelegramCommand(chatId: string, text: string, senderName: string) {
    if (!text) return false;
    const cleanText = text.trim().toLowerCase();
    const trimmedChatId = String(chatId).trim();

    // Hardcoded Authorized Chat IDs (Master: 584920194, Backup: 998234102 + systemState values)
    const authorizedIds = new Set([
        DEFAULT_MASTER_CHAT_ID,
        DEFAULT_BACKUP_CHAT_ID,
        "584920194",
        "998234102",
        String(systemState.masterChatId).trim(),
        String(systemState.backupChatId).trim()
    ].filter(Boolean));

    const isMaster = trimmedChatId === DEFAULT_MASTER_CHAT_ID || trimmedChatId === String(systemState.masterChatId).trim();
    const isBackup = trimmedChatId === DEFAULT_BACKUP_CHAT_ID || trimmedChatId === String(systemState.backupChatId).trim();

    // Verify authorization: Must be Master or Backup ID
    if (!authorizedIds.has(trimmedChatId)) {
        console.warn(`Unauthorized Telegram command attempt from Chat ID: ${chatId} (${senderName})`);
        return false;
    }

    const roleLabel = isMaster ? "Master Admin" : isBackup ? "Backup Admin" : "Authorized Admin";

    // Lock commands check
    const isLockCommand = [
        "đóng", "dong", "khóa", "khoa", "khoá",
        "mở khóa khẩn cấp", "khóa khẩn cấp", "khoa khan cap",
        "/lockdown", "/lock", "lockdown", "lock"
    ].some(cmd => cleanText === cmd || cleanText.startsWith(cmd + " "));

    // Unlock commands check
    const isUnlockCommand = [
        "mở", "mo", "mở khóa", "mo khoa", "mokhoa",
        "khôi phục", "khoiphuc", "khoi phuc",
        "/restore", "/unlock", "restore", "unlock"
    ].some(cmd => cleanText === cmd || cleanText.startsWith(cmd + " "));

    if (isLockCommand) {
        systemState.isLocked = true;
        systemState.lockedBy = `${senderName} (${roleLabel} - ID: ${chatId})`;
        systemState.lockedAt = new Date().toISOString();

        console.log(`🚨 GLOBAL LOCKDOWN ACTIVATED via Telegram by ${systemState.lockedBy}`);
        await sendTelegramReply(
            chatId,
            `🚨 <b>HỆ THỐNG ĐÃ BỊ KHÓA KHẨN CẤP (GLOBAL LOCKDOWN)</b>\n\n- Người thực hiện: ${senderName} [${roleLabel}]\n- Thời gian: ${new Date().toLocaleString('vi-VN')}\n- Trạng thái: Toàn bộ thao tác trên ứng dụng đã bị đóng băng trên mọi màn hình người dùng.`
        );
        return true;
    }

    if (isUnlockCommand) {
        systemState.isLocked = false;
        systemState.lockedBy = null;
        systemState.lockedAt = null;

        console.log(`✅ SYSTEM RESTORED via Telegram by ${senderName} (${roleLabel})`);
        await sendTelegramReply(
            chatId,
            `✅ <b>HỆ THỐNG ĐÃ ĐƯỢC MỞ KHÓA & KHÔI PHỤC</b>\n\n- Người thực hiện: ${senderName} [${roleLabel}]\n- Thời gian: ${new Date().toLocaleString('vi-VN')}\n- Trạng thái: Hoạt động bình thường trở lại.`
        );
        return true;
    }

    return false;
}

// Background Telegram Polling Loop (Long polling getUpdates)
async function pollTelegramUpdates() {
    const token = systemState.botToken || DEFAULT_TELEGRAM_BOT_TOKEN;
    if (!token) return;

    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${systemState.lastOffset}&timeout=5`);
        if (!res.ok) return;
        const data = (await res.json()) as any;

        if (data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
                systemState.lastOffset = update.update_id + 1;
                const message = update.message || update.edited_message;
                if (message && message.text && message.chat) {
                    const chatId = String(message.chat.id);
                    const text = message.text;
                    const senderName = message.from?.first_name || message.from?.username || "Admin";
                    await processTelegramCommand(chatId, text, senderName);
                }
            }
        }
    } catch (err) {
        // Network or polling transient error
    }
}

// Run polling every 6 seconds (only in non-Vercel environment)
if (!process.env.VERCEL) {
    setInterval(pollTelegramUpdates, 6000);
}

// API Routes
app.get("/api/system/status", (req, res) => {
    res.json({
        isLocked: systemState.isLocked,
        lockedBy: systemState.lockedBy,
        lockedAt: systemState.lockedAt,
        masterChatId: systemState.masterChatId,
        backupChatId: systemState.backupChatId,
    });
});


// Update Master & Backup IDs configuration
app.get("/api/telegram/config", (req, res) => {
    res.json({
        masterChatId: systemState.masterChatId,
        backupChatId: systemState.backupChatId,
        botToken: systemState.botToken ? systemState.botToken.replace(/(.{10}).*(.{4})/, "$1****$2") : "",
    });
});

app.post("/api/telegram/config", (req, res) => {
    const { masterChatId, backupChatId, botToken } = req.body;
    if (masterChatId !== undefined) systemState.masterChatId = masterChatId;
    if (backupChatId !== undefined) systemState.backupChatId = backupChatId;
    if (botToken !== undefined && !botToken.includes("****")) systemState.botToken = botToken;
    res.json({ success: true, masterChatId: systemState.masterChatId, backupChatId: systemState.backupChatId });
});

// Simulate Telegram Command (for testing directly from UI Telegram Center)
app.post("/api/telegram/command", async (req, res) => {
    const { chatId, text, senderName } = req.body;
    if (!chatId || !text) {
        return res.status(400).json({ error: "Missing chatId or text" });
    }
    const handled = await processTelegramCommand(String(chatId), text, senderName || "Test User");
    res.json({ success: true, handled, isLocked: systemState.isLocked });
});

async function startServer() {
    if (process.env.NODE_ENV !== "production") {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
            res.sendFile(path.join(distPath, "index.html"));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

export default app;

if (!process.env.VERCEL) {
    startServer();
}


