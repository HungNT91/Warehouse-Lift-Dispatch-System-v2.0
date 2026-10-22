/**
 * useRealtimeSync.ts
 *
 * Cơ chế cập nhật dữ liệu tự động tối ưu hóa 2 lớp:
 *  - Layer 1 (Primary): Supabase Realtime WebSocket — cập nhật tức thì với Debounce 600ms
 *  - Layer 2 (Fallback): Heartbeat 60s khi Realtime đang chạy, hoặc Polling 25s khi WebSocket gặp lỗi/mất kết nối
 *
 * Trạng thái kết nối được lưu vào useLiftStore.syncStatus để UI hiển thị chính xác.
 */

import { useEffect, useRef } from 'react';
import { useLiftStore } from '../stores/useLiftStore';
import { useAuthStore } from '../stores/useAuthStore';
import { isSupabaseConfigured } from '../api/dbClient';
import { getSupabase } from '../api/supabase';

const FALLBACK_POLL_INTERVAL_MS = 25_000; // 25s khi mất kết nối Realtime
const REALTIME_HEARTBEAT_MS = 60_000;      // 60s heartbeat đồng bộ định kỳ khi Realtime bình thường

/** Module-level singletons — tránh đăng ký trùng khi component re-render */
let _channels: any[] = [];
let _pollingTimer: ReturnType<typeof setInterval> | null = null;
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
let _currentPollInterval = FALLBACK_POLL_INTERVAL_MS;
let _initialized = false;

export function useRealtimeSync() {
  const { fetchInitialData, fetchDynamicData, setSyncStatus, checkAndResetExpiredRestrictions } = useLiftStore();
  const { isAuthenticated } = useAuthStore();
  const refreshingRef = useRef(false);

  const refresh = async (onlyDynamic = false) => {
    if (refreshingRef.current) return; // Chặn gọi song song chồng chéo
    refreshingRef.current = true;
    try {
      if (onlyDynamic) {
        await fetchDynamicData();
      } else {
        await fetchInitialData();
      }
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

  // Gom nhiều event dồn dập (ví dụ khi tạo đơn có 3 table cùng insert) thành 1 lần refresh duy nhất
  const scheduleDebouncedRefresh = () => {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      _debounceTimer = null;
      refresh(true);
    }, 600);
  };

  useEffect(() => {
    if (!isAuthenticated || _initialized) return;
    _initialized = true;

    if (!isSupabaseConfigured()) {
      console.info('[RealtimeSync] Supabase chưa cấu hình → Polling dự phòng 25s.');
      setSyncStatus('polling');
      _startPolling(FALLBACK_POLL_INTERVAL_MS);
      return;
    }

    setSyncStatus('connecting');
    _startRealtimeSubscriptions();
    _startPolling(FALLBACK_POLL_INTERVAL_MS);

    return () => {
      _stopRealtimeSubscriptions();
      _stopPolling();
      if (_debounceTimer) {
        clearTimeout(_debounceTimer);
        _debounceTimer = null;
      }
      _initialized = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ─────────────────────────────────────────────
  // LAYER 1: Supabase Realtime WebSocket (Debounced)
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
            () => {
              // Mọi event đều qua debounced refresh và chỉ fetch dynamic data, không bao giờ fetch lại 7 bảng
              scheduleDebouncedRefresh();
            }
          )
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              subscribedCount++;
              if (subscribedCount >= tables.length) {
                setSyncStatus('realtime', new Date());
                console.info('[RealtimeSync] ✅ Realtime WebSocket kết nối thành công. Chuyển Polling sang chế độ Heartbeat 60s.');
                // Giảm tần suất polling xuống 60s để tiết kiệm API tối đa khi Realtime hoạt động tốt
                _startPolling(REALTIME_HEARTBEAT_MS);
              }
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.warn(`[RealtimeSync] ⚠️ Channel ${name} gặp sự cố → Chuyển sang Polling dự phòng 25s.`);
              setSyncStatus('polling');
              _startPolling(FALLBACK_POLL_INTERVAL_MS);
            }
          });

        _channels.push(ch);
      });
    } catch (err) {
      console.error('[RealtimeSync] Không thể khởi tạo Realtime:', err);
      setSyncStatus('polling');
      _startPolling(FALLBACK_POLL_INTERVAL_MS);
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
  // LAYER 2: Heartbeat & Fallback Polling
  // ─────────────────────────────────────────────
  function _startPolling(intervalMs: number) {
    if (_pollingTimer && _currentPollInterval === intervalMs) return;
    _stopPolling();
    _currentPollInterval = intervalMs;
    _pollingTimer = setInterval(() => { refresh(true); }, intervalMs);
    console.info(`[RealtimeSync] 🔄 Polling thiết lập chu kỳ: ${intervalMs / 1000}s.`);
  }

  function _stopPolling() {
    if (_pollingTimer) {
      clearInterval(_pollingTimer);
      _pollingTimer = null;
    }
  }
}

