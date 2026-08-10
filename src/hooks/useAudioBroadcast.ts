import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useLiftStore } from '../stores/useLiftStore';
import { speakText } from '../utils/audio';

// Set to track played audio notification IDs on this client session to avoid double speech
const playedNotificationIds = new Set<string>();

export function useAudioBroadcast() {
    const { user, assignment } = useAuthStore();
    const { notifications } = useLiftStore();
    const mountTimeRef = useRef<number>(Date.now() - 3000); // Allow fresh notifications right after mount

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
            const isAdminOrSupervisor = user?.role === 'Admin' || user?.role === 'Supervisor';
            const isTargetedFloor = targetFloor === 0 || (myFloor && Number(myFloor) === Number(targetFloor));

            if (isAdminOrSupervisor || isTargetedFloor) {
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
                notif.category === 'telegram' && notif.message.includes('[AUDIO_DISPATCH');

            if (!isAudioDispatch) return;

            // Ignore old historical notifications fetched on initial load
            const notifTime = new Date(notif.created_at).getTime();
            if (!isNaN(notifTime) && notifTime < mountTimeRef.current) {
                playedNotificationIds.add(notif.id);
                return;
            }

            playedNotificationIds.add(notif.id);

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

            // Rule: Do NOT play audio on the device of the account who authored/sent the message
            if (user?.id && senderId && user.id === senderId) {
                return;
            }

            // Check recipient assignment
            const myFloor = assignment?.assigned_floor;
            const isAdminOrSupervisor = user?.role === 'Admin' || user?.role === 'Supervisor';
            const isTargetedFloor = targetFloor === 0 || (myFloor && Number(myFloor) === Number(targetFloor));

            if (isAdminOrSupervisor || isTargetedFloor) {
                speakText(cleanText);
            }
        });
    }, [notifications, user, assignment]);
}
