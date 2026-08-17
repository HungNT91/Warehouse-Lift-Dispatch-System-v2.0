/**
 * useRealtimeSync.ts
 *
 * Cơ chế cập nhật dữ liệu tự động hai lớp:
 *  - Layer 1 (Primary):  Supabase Realtime WebSocket — cập nhật tức thì khi DB thay đổi
 *  - Layer 2 (Fallback): Polling 60 giây — kích hoạt khi WebSocket không khả dụng
 *
 * Trạng thái kết nối được lưu vào useLiftStore.syncStatus để UI có thể đọc từ bất kỳ đâu.
 */

import { useEffect, useRef } from 'react';
import { useLiftStore } from '../stores/useLiftStore';
import { useAuthStore } from '../stores/useAuthStore';
import { isSupabaseConfigured } from '../api/dbClient';
import { getSupabase } from '../api/supabase';

const POLL_INTERVAL_MS = 10_000; // 10 giây

/** Module-level singletons — tránh đăng ký trùng khi component re-render */
let _channels: any[] = [];
let _pollingTimer: ReturnType<typeof setInterval> | null = null;
let _initialized = false;

export function useRealtimeSync() {
  const { fetchInitialData, setSyncStatus, checkAndResetExpiredRestrictions } = useLiftStore();
  const { isAuthenticated } = useAuthStore();
  const refreshingRef = useRef(false);

  const refresh = async () => {
    if (refreshingRef.current) return; // chặn gọi song song
    refreshingRef.current = true;
    try {
      await fetchInitialData();
      checkAndResetExpiredRestrictions();
      setSyncStatus(
        _channels.length > 0 ? 'realtime' : 'polling',
        new Date()
      );
    } catch (e) {
      console.error('[RealtimeSync] Lỗi đồng bộ dữ liệu:', e);
    } finally {
      refreshingRef.current = false;
    }
  };

  useEffect(() => {
    if (!isAuthenticated || _initialized) return;
    _initialized = true;

    if (!isSupabaseConfigured()) {
      console.info('[RealtimeSync] Supabase chưa cấu hình → chỉ Polling 60s.');
      setSyncStatus('polling');
      _startPolling();
      return;
    }

    setSyncStatus('connecting');
    _startRealtimeSubscriptions();
    _startPolling(); // luôn giữ polling làm dự phòng

    return () => {
      _stopRealtimeSubscriptions();
      _stopPolling();
      _initialized = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ─────────────────────────────────────────────
  // LAYER 1: Supabase Realtime WebSocket
  // ─────────────────────────────────────────────
  function _startRealtimeSubscriptions() {
    if (_channels.length > 0) return;
    try {
      const supabase = getSupabase();

      const tables = [
        { name: 'lifts', event: '*' },
        { name: 'transport_jobs', event: '*' },
        { name: 'notifications', event: 'INSERT' },
        { name: 'activity_logs', event: 'INSERT' },
      ] as const;

      let subscribedCount = 0;

      tables.forEach(({ name, event }) => {
        const ch = supabase
          .channel(`realtime_wlds:${name}`)
          .on(
            'postgres_changes' as any,
            { event, schema: 'public', table: name },
            () => { refresh(); }
          )
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              subscribedCount++;
              if (subscribedCount >= tables.length) {
                setSyncStatus('realtime', new Date());
                console.info('[RealtimeSync] ✅ Tất cả Realtime channel đã kết nối.');
              }
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.warn(`[RealtimeSync] ⚠️ Channel ${name} lỗi → Polling bù lại.`);
              setSyncStatus('polling');
            }
          });

        _channels.push(ch);
      });
    } catch (err) {
      console.error('[RealtimeSync] Không thể khởi tạo Realtime:', err);
      setSyncStatus('polling');
    }
  }

  function _stopRealtimeSubscriptions() {
    try {
      if (!isSupabaseConfigured() || _channels.length === 0) return;
      const supabase = getSupabase();
      _channels.forEach((ch) => supabase.removeChannel(ch));
    } catch { /* ignore */ }
    _channels = [];
  }

  // ─────────────────────────────────────────────
  // LAYER 2: Polling Fallback (60 giây)
  // ─────────────────────────────────────────────
  function _startPolling() {
    if (_pollingTimer) return;
    _pollingTimer = setInterval(() => { refresh(); }, POLL_INTERVAL_MS);
    console.info(`[RealtimeSync] 🔄 Polling khởi động — mỗi ${POLL_INTERVAL_MS / 1000}s.`);
  }

  function _stopPolling() {
    if (_pollingTimer) {
      clearInterval(_pollingTimer);
      _pollingTimer = null;
    }
  }
}
