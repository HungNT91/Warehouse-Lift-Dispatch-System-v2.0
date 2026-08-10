import express from "express";
import path from "path";
import dotenv from "dotenv";
import {
    getSystemState,
    updateSystemConfig,
    toggleGlobalLockdown,
    processTelegramCommand,
    pollTelegramUpdates,
    registerTelegramWebhook,
    deleteTelegramWebhook
} from "./lib/telegramState.js";

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

// Run background polling every 5 seconds (fallback mode)
setInterval(() => {
    pollTelegramUpdates().catch(() => { });
}, 5000);

// API Routes
app.get("/api/system/status", (req, res) => {
    const state = getSystemState();
    res.json({
        isLocked: state.isLocked,
        lockedBy: state.lockedBy,
        lockedAt: state.lockedAt,
        masterChatId: state.masterChatId,
        backupChatId: state.backupChatId,
        webhookUrl: state.webhookUrl,
    });
});

// Direct Lockdown Toggle
app.post("/api/system/lockdown", (req, res) => {
    const { isLocked, lockedBy } = req.body;
    const updatedState = toggleGlobalLockdown(!!isLocked, lockedBy || 'Admin UI');
    res.json({
        success: true,
        isLocked: updatedState.isLocked,
        lockedBy: updatedState.lockedBy,
        lockedAt: updatedState.lockedAt
    });
});

// Telegram Config
app.get("/api/telegram/config", (req, res) => {
    const state = getSystemState();
    res.json({
        masterChatId: state.masterChatId,
        backupChatId: state.backupChatId,
        botToken: state.botToken ? state.botToken.replace(/(.{10}).*(.{4})/, "$1****$2") : "",
        webhookUrl: state.webhookUrl,
    });
});

app.post("/api/telegram/config", (req, res) => {
    const { masterChatId, backupChatId, botToken } = req.body;
    updateSystemConfig({ masterChatId, backupChatId, botToken });
    const state = getSystemState();
    res.json({
        success: true,
        masterChatId: state.masterChatId,
        backupChatId: state.backupChatId,
        webhookUrl: state.webhookUrl
    });
});

// Simulate Telegram Command (for testing directly from UI Telegram Center)
app.post("/api/telegram/command", async (req, res) => {
    const { chatId, text, senderName } = req.body;
    if (!chatId || !text) {
        return res.status(400).json({ error: "Missing chatId or text" });
    }
    const result = await processTelegramCommand(String(chatId), text, senderName || "UI Tester");
    res.json(result);
});

// Telegram Webhook Handler (Endpoint where Telegram sends real-time updates in Production)
app.all("/api/telegram/webhook", async (req, res) => {
    if (req.method === "GET") {
        return res.status(200).send("Telegram Webhook Endpoint is Active");
    }

    if (req.method === "POST") {
        try {
            const update = req.body || {};
            const message = update.message || update.edited_message || update.channel_post;

            if (message && message.text && message.chat) {
                const chatId = String(message.chat.id);
                const text = message.text;
                const senderName = message.from?.first_name || message.from?.username || message.chat.title || "Admin";

                console.log(`[Telegram Webhook] Received update from Chat ID: ${chatId} (${senderName}): "${text}"`);
                await processTelegramCommand(chatId, text, senderName);
            }
        } catch (err) {
            console.error("[Telegram Webhook Error]", err);
        }
        return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
});

// Telegram Webhook Setup & Registration
app.post("/api/telegram/webhook/setup", async (req, res) => {
    const { action, domain } = req.body;

    if (action === "delete") {
        const result = await deleteTelegramWebhook();
        return res.json(result);
    }

    // Determine target host domain
    let hostUrl = domain;
    if (!hostUrl) {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = req.headers["x-forwarded-host"] || req.headers.host;
        if (host) {
            hostUrl = `${protocol}://${host}`;
        }
    }

    if (!hostUrl) {
        return res.status(400).json({ success: false, description: "Could not auto-detect domain host. Please provide domain parameter." });
    }

    const result = await registerTelegramWebhook(hostUrl);
    return res.json(result);
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



