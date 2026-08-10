import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useLiftStore } from '../stores/useLiftStore';
import { speakText } from '../utils/audio';
import { toast } from 'sonner';

// Set to track played audio notification IDs on this client session to avoid double speech
const playedNotificationIds = new Set<string>();

export function useAudioBroadcast() {
    const { user, assignment } = useAuthStore();
    const { notifications } = useLiftStore();
    const mountTimeRef = useRef<number>(Date.now() - 5000); // Allow fresh notifications right after mount

    // 1. Cross-tab instant audio broadcast via BroadcastChannel
    useEffect(() => {
        if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

        const channel = new BroadcastChannel('wlds_audio_dispatch');

        const handleMessage = (event: MessageEvent) => {
            const { id, targetFloor, senderId, text } = event.data || {};
            if (!text || !id) return;

            // Skip if already played on this client instance
            if (playedNotificationIds.has(id)) return;
            playedNotificationIds.add(id);

            // Rule: Do NOT play audio on the device of the account who authored/sent the message
            if (user?.id && senderId && user.id === senderId) {
                return;
            }

            // Check floor assignment for recipient
            const myFloor = assignment?.assigned_floor;
            const isAdminOrSupervisor =
                user?.role === 'Admin' ||
                user?.role === 'Supervisor' ||
                (user?.role as string) === 'Manager';

            const isTargetedFloor =
                targetFloor === 0 ||
                (myFloor && Number(myFloor) === Number(targetFloor));

            if (isAdminOrSupervisor || isTargetedFloor) {
                toast.info(`🔊 Notification TTS: ${text.substring(0, 80)}...`, { duration: 5000 });
                speakText(text);
            }
        };

        channel.addEventListener('message', handleMessage);
        return () => {
            channel.removeEventListener('message', handleMessage);
            channel.close();
        };
    }, [user, assignment]);

    // 2. Cross-device database notification audio broadcast via Realtime / Polling
    useEffect(() => {
        if (!notifications || notifications.length === 0) return;

        notifications.forEach((notif) => {
            if (!notif.message || playedNotificationIds.has(notif.id)) return;

            // Detect audio dispatch notifications
            const isAudioDispatch =
                notif.message.includes('[AUDIO_DISPATCH') ||
                notif.category === 'telegram' ||
                notif.title?.toLowerCase().includes('phát thanh');

            if (!isAudioDispatch) return;

            // Extract metadata: "[AUDIO_DISPATCH|F2|SENDER:u1] Message content"
            let targetFloor = (notif as any).target_floor || 0;
            let senderId = (notif as any).sender_id || '';
            let cleanText = notif.message;

            const metaMatch = notif.message.match(/\[AUDIO_DISPATCH\|F(\d+)\|SENDER:([^\]]+)\]\s*(.*)/s);
            if (metaMatch) {
                targetFloor = parseInt(metaMatch[1], 10);
                senderId = metaMatch[2];
                cleanText = metaMatch[3];
            }

            // Ignore old historical notifications fetched on initial load (older than mount time - 10s)
            const notifTime = new Date(notif.created_at).getTime();
            if (!isNaN(notifTime) && notifTime < mountTimeRef.current) {
                playedNotificationIds.add(notif.id);
                return;
            }

            playedNotificationIds.add(notif.id);

            // Rule: Do NOT play audio on the device of the account who authored/sent the message
            if (user?.id && senderId && user.id === senderId) {
                return;
            }

            // Check recipient assignment
            const myFloor = assignment?.assigned_floor;
            const isAdminOrSupervisor =
                user?.role === 'Admin' ||
                user?.role === 'Supervisor' ||
                (user?.role as string) === 'Manager';

            // Fallback floor detection if assignment not explicitly in state
            let detectedUserFloor = myFloor;
            if (!detectedUserFloor && user?.employee_code) {
                const match = user.employee_code.match(/([1-4])/);
                if (match) detectedUserFloor = parseInt(match[1], 10);
            }

            const isTargetedFloor =
                targetFloor === 0 ||
                (detectedUserFloor && Number(detectedUserFloor) === Number(targetFloor));

            if (isAdminOrSupervisor || isTargetedFloor) {
                const floorLabel = targetFloor > 0 ? `Tầng ${targetFloor}` : 'Kênh Chung';
                toast.info(`🔊 Thông báo phát thanh (${floorLabel}): ${cleanText.substring(0, 90)}...`, {
                    duration: 6000,
                });
                speakText(cleanText);
            }
        });
    }, [notifications, user, assignment]);
}
