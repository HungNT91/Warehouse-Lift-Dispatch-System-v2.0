import fs from 'fs';
import path from 'path';

// Path to persist system state across restarts in production
const STATE_FILE = path.join(process.cwd(), '.telegram_state.json');

export interface TelegramSystemState {
    isLocked: boolean;
    lockedBy: string | null;
    lockedAt: string | null;
    masterChatId: string;
    backupChatId: string;
    botToken: string;
    lastOffset: number;
    webhookUrl: string | null;
}

// Known default authorized IDs (combining both 584920194, 1926967637, 998234102, 6732311141)
const DEFAULT_MASTER_IDS = ["1926967637"];
const DEFAULT_BACKUP_IDS = ["6732311141"];
const DEFAULT_BOT_TOKEN = "8893527039:AAG9dkuaijXHURBKRkFKH5Fb89da1B_Jgx8";

let state: TelegramSystemState = {
    isLocked: false,
    lockedBy: null,
    lockedAt: null,
    masterChatId: process.env.TELEGRAM_MASTER_CHAT_ID || DEFAULT_MASTER_IDS.join(", "),
    backupChatId: process.env.TELEGRAM_BACKUP_CHAT_ID || DEFAULT_BACKUP_IDS.join(", "),
    botToken: process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN,
    lastOffset: 0,
    webhookUrl: null,
};

// Load saved state from disk on startup
function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, 'utf8');
            const saved = JSON.parse(data);
            state = { ...state, ...saved };
            console.log('Successfully loaded persisted Telegram system state from disk.');
        }
    } catch (err) {
        console.warn('Could not read saved Telegram state from disk:', err);
    }
}

// Save state to disk
export function saveState() {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    } catch (err) {
        console.warn('Could not persist Telegram state to disk:', err);
    }
}

// Initialize on module import
loadState();

export function getSystemState(): TelegramSystemState {
    return state;
}

export function updateSystemConfig(updates: { masterChatId?: string; backupChatId?: string; botToken?: string }) {
    if (updates.masterChatId !== undefined && updates.masterChatId.trim() !== '') {
        state.masterChatId = updates.masterChatId.trim();
    }
    if (updates.backupChatId !== undefined && updates.backupChatId.trim() !== '') {
        state.backupChatId = updates.backupChatId.trim();
    }
    if (updates.botToken !== undefined && updates.botToken.trim() !== '' && !updates.botToken.includes('****')) {
        state.botToken = updates.botToken.trim();
    }
    saveState();
}

/**
 * Get set of all authorized Chat IDs (Master + Backup + Defaults)
 */
export function getAuthorizedChatIds(): Set<string> {
    const ids = new Set<string>();

    // Add default known IDs
    DEFAULT_MASTER_IDS.forEach(id => ids.add(id));
    DEFAULT_BACKUP_IDS.forEach(id => ids.add(id));

    // Add configured Master IDs (supports comma/space separated list)
    if (state.masterChatId) {
        state.masterChatId.split(/[,;\s]+/).forEach(id => {
            const clean = id.trim();
            if (clean) ids.add(clean);
        });
    }

    // Add configured Backup IDs
    if (state.backupChatId) {
        state.backupChatId.split(/[,;\s]+/).forEach(id => {
            const clean = id.trim();
            if (clean) ids.add(clean);
        });
    }

    return ids;
}

/**
 * Check if a given Chat ID is authorized to send emergency commands
 */
export function isAuthorizedUser(chatId: string | number): boolean {
    if (!chatId) return false;
    const cleanId = String(chatId).trim();
    const authorizedSet = getAuthorizedChatIds();

    if (authorizedSet.has(cleanId)) return true;

    // Check if stripped leading/trailing dashes match
    for (const id of authorizedSet) {
        if (id === cleanId || id.replace(/^-/, '') === cleanId.replace(/^-/, '')) {
            return true;
        }
    }

    return false;
}

/**
 * Send reply message back via Telegram Bot API
 */
export async function sendTelegramReply(chatId: string | number, text: string): Promise<boolean> {
    try {
        const token = state.botToken || DEFAULT_BOT_TOKEN;
        if (!token) return false;

        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
            }),
        });

        const data = await res.json() as any;
        if (!data.ok) {
            console.warn('Telegram sendMessage response failed:', data);
        }
        return !!data.ok;
    } catch (err) {
        console.error('Error sending Telegram reply:', err);
        return false;
    }
}

/**
 * Register Webhook with Telegram API
 */
export async function registerTelegramWebhook(domainUrl: string): Promise<{ success: boolean; description?: string }> {
    try {
        const token = state.botToken || DEFAULT_BOT_TOKEN;
        if (!token) return { success: false, description: 'No Bot Token configured' };

        const cleanDomain = domainUrl.replace(/\/$/, '');
        const webhookUrl = `${cleanDomain}/api/telegram/webhook`;

        console.log(`Setting Telegram Webhook to: ${webhookUrl}`);

        const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: webhookUrl,
                allowed_updates: ['message', 'edited_message', 'channel_post'],
                drop_pending_updates: false,
            }),
        });

        const data = await res.json() as any;
        if (data.ok) {
            state.webhookUrl = webhookUrl;
            saveState();
            return { success: true, description: data.description || 'Webhook registered successfully' };
        } else {
            return { success: false, description: data.description || 'Telegram rejected Webhook setup' };
        }
    } catch (err: any) {
        console.error('Error registering Telegram webhook:', err);
        return { success: false, description: err.message || 'Network error' };
    }
}

/**
 * Delete Webhook (switch back to polling)
 */
export async function deleteTelegramWebhook(): Promise<{ success: boolean; description?: string }> {
    try {
        const token = state.botToken || DEFAULT_BOT_TOKEN;
        if (!token) return { success: false, description: 'No Bot Token' };

        const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
            method: 'POST',
        });
        const data = await res.json() as any;
        if (data.ok) {
            state.webhookUrl = null;
            saveState();
            return { success: true, description: 'Webhook removed, Polling active' };
        }
        return { success: false, description: data.description };
    } catch (err: any) {
        return { success: false, description: err.message };
    }
}

/**
 * Process incoming Telegram Command
 */
export async function processTelegramCommand(
    chatId: string | number,
    text: string,
    senderName: string = 'Admin'
): Promise<{ success: boolean; handled: boolean; isLocked: boolean; reason?: string }> {
    if (!text) return { success: false, handled: false, isLocked: state.isLocked, reason: 'Empty text' };

    const cleanText = text.trim().toLowerCase();
    const stringChatId = String(chatId).trim();

    // Check authorization
    if (!isAuthorizedUser(stringChatId)) {
        console.warn(`[Telegram Security] Unauthorized command attempt from Chat ID: "${stringChatId}" (${senderName}). Text: "${text}"`);
        console.warn(`Authorized Chat IDs set:`, Array.from(getAuthorizedChatIds()));
        return {
            success: false,
            handled: false,
            isLocked: state.isLocked,
            reason: `Unauthorized Chat ID: ${stringChatId}. Required Master ID (${state.masterChatId}) or Backup ID (${state.backupChatId})`
        };
    }

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
        state.isLocked = true;
        state.lockedBy = `${senderName} (Chat ID: ${stringChatId})`;
        state.lockedAt = new Date().toISOString();
        saveState();

        console.log(`🚨 GLOBAL LOCKDOWN ACTIVATED via Telegram by ${state.lockedBy}`);
        await sendTelegramReply(
            stringChatId,
            `🚨 <b>HỆ THỐNG ĐÃ BỊ KHÓA KHẨN CẤP (GLOBAL LOCKDOWN)</b>\n\n- Người thực hiện: ${senderName}\n- Chat ID: <code>${stringChatId}</code>\n- Thời gian: ${new Date().toLocaleString('vi-VN')}\n- Trạng thái: Toàn bộ thao tác trên ứng dụng W.L.D.S đã bị khóa trên mọi màn hình người dùng.`
        );
        return { success: true, handled: true, isLocked: true };
    }

    if (isUnlockCommand) {
        state.isLocked = false;
        state.lockedBy = null;
        state.lockedAt = null;
        saveState();

        console.log(`✅ SYSTEM RESTORED via Telegram by ${senderName} (Chat ID: ${stringChatId})`);
        await sendTelegramReply(
            stringChatId,
            `✅ <b>HỆ THỐNG ĐÃ ĐƯỢC MỞ KHÓA & KHÔI PHỤC</b>\n\n- Người thực hiện: ${senderName}\n- Chat ID: <code>${stringChatId}</code>\n- Thời gian: ${new Date().toLocaleString('vi-VN')}\n- Trạng thái: Ứng dụng đã mở khóa, hoạt động bình thường trở lại.`
        );
        return { success: true, handled: true, isLocked: false };
    }

    // Help or Status check command
    if (cleanText === "/status" || cleanText === "status" || cleanText === "/start" || cleanText === "start") {
        await sendTelegramReply(
            stringChatId,
            `🤖 <b>W.L.D.S TELEGRAM SYSTEM BOT</b>\n\n- Trạng thái hệ thống: ${state.isLocked ? '🔴 ĐANG BỊ KHÓA' : '🟢 ĐANG HOẠT ĐỘNG'}\n- Master Chat ID: <code>${state.masterChatId}</code>\n- Backup Chat ID: <code>${state.backupChatId}</code>\n\n<b>Các lệnh hợp lệ:</b>\n- <code>đóng</code> hoặc <code>/lockdown</code>: Khóa ứng dụng khẩn cấp\n- <code>mở</code> hoặc <code>/restore</code>: Khôi phục mở ứng dụng`
        );
        return { success: true, handled: true, isLocked: state.isLocked };
    }

    return { success: true, handled: false, isLocked: state.isLocked, reason: 'Command not recognized' };
}

/**
 * Background Long Polling update runner
 */
export async function pollTelegramUpdates() {
    const token = state.botToken || DEFAULT_BOT_TOKEN;
    if (!token) return;

    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${state.lastOffset}&timeout=5`);
        if (!res.ok) {
            const data = await res.json().catch(() => ({})) as any;
            if (data.error_code === 409) {
                // 409 Conflict: Webhook is active! If webhook is active, getUpdates is disabled by Telegram.
                console.warn('[Telegram Bot] 409 Conflict: Webhook is currently active on Telegram. Processing via Webhook endpoint instead.');
            }
            return;
        }

        const data = (await res.json()) as any;

        if (data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
                state.lastOffset = update.update_id + 1;
                saveState();

                const message = update.message || update.edited_message || update.channel_post;
                if (message && message.text && message.chat) {
                    const chatId = String(message.chat.id);
                    const text = message.text;
                    const senderName = message.from?.first_name || message.from?.username || message.chat.title || "Admin";
                    await processTelegramCommand(chatId, text, senderName);
                }
            }
        }
    } catch (err) {
        // Network or transient polling error
    }
}
