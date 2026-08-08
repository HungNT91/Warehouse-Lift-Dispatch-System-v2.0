import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory System Lockdown State (persisted or synchronized across sessions)
let systemState = {
    isLocked: false,
    lockedBy: null as string | null,
    lockedAt: null as string | null,
    masterChatId: process.env.TELEGRAM_MASTER_CHAT_ID || "1926967637", // Default Master ID placeholder
    backupChatId: process.env.TELEGRAM_BACKUP_CHAT_ID || "6732311141", // Default Backup ID placeholder
    botToken: process.env.TELEGRAM_BOT_TOKEN || "8893527039:AAG9dkuaijXHURBKRkFKH5Fb89da1B_Jgx8",
    lastOffset: 0,
};

// Helper function to send message back via Telegram Bot API
async function sendTelegramReply(chatId: string, text: string) {
    try {
        const token = systemState.botToken;
        if (!token || token.includes("placeholder")) return;
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
    const cleanText = text.trim().toLowerCase();
    const isMaster = chatId === systemState.masterChatId;
    const isBackup = chatId === systemState.backupChatId;

    // Verify authorization: Must be Master or Backup ID
    if (!isMaster && !isBackup) {
        console.warn(`Unauthorized Telegram command attempt from Chat ID: ${chatId} (${senderName})`);
        return false;
    }

    const roleLabel = isMaster ? "Master Admin" : "Backup Admin";

    if (cleanText === "đóng" || cleanText === "khoa" || cleanText === "/lockdown" || cleanText === "lock") {
        systemState.isLocked = true;
        systemState.lockedBy = `${senderName} (${roleLabel} - ID: ${chatId})`;
        systemState.lockedAt = new Date().toISOString();

        console.log(`🚨 GLOBAL LOCKDOWN ACTIVATED via Telegram by ${systemState.lockedBy}`);
        await sendTelegramReply(
            chatId,
            `🚨 <b>HỆ THỐNG ĐÃ BỊ KHÓA KHẨN CẤP (GLOBAL LOCKDOWN)</b>\n\n- Người thực hiện: ${senderName} [${roleLabel}]\n- Thời gian: ${new Date().toLocaleString()}\n- Trạng thái: Toàn bộ thao tác trên ứng dụng đã bị đóng băng trên mọi màn hình người dùng.`
        );
        return true;
    }

    if (cleanText === "mở" || cleanText === "mokhoa" || cleanText === "/restore" || cleanText === "unlock") {
        systemState.isLocked = false;
        systemState.lockedBy = null;
        systemState.lockedAt = null;

        console.log(`✅ SYSTEM RESTORED via Telegram by ${senderName} (${roleLabel})`);
        await sendTelegramReply(
            chatId,
            `✅ <b>HỆ THỐNG ĐÃ ĐƯỢC MỞ KHÓA & KHÔI PHỤC</b>\n\n- Người thực hiện: ${senderName} [${roleLabel}]\n- Thời gian: ${new Date().toLocaleString()}\n- Trạng thái: Hoạt động bình thường trở lại.`
        );
        return true;
    }

    return false;
}

// Background Telegram Polling Loop (Long polling getUpdates)
async function pollTelegramUpdates() {
    const token = systemState.botToken;
    if (!token || token.includes("placeholder")) return;

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

// Run polling every 6 seconds
setInterval(pollTelegramUpdates, 6000);

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

startServer();
