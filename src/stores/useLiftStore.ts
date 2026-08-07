import { create } from 'zustand';
import { Lift, Job, AppNotification, ActivityLog } from '../types';
import { db, isUuid } from '../api/dbClient';
import { mockLifts, mockJobs, mockNotifications, mockActivities } from '../data/mock';
import { useTelegramStore } from './useTelegramStore';
import { useAuthStore } from './useAuthStore';
import { speakLiftArrival } from '../utils/audio';

interface LiftState {
  lifts: Lift[];
  jobs: Job[];
  notifications: AppNotification[];
  activities: ActivityLog[];
  isLoading: boolean;
  syncStatus: 'connecting' | 'realtime' | 'polling' | 'offline';
  lastSyncedAt: Date | null;
  setSyncStatus: (status: 'connecting' | 'realtime' | 'polling' | 'offline', syncedAt?: Date) => void;
  updateLift: (liftId: string, updates: Partial<Lift>) => void;
  updateJob: (jobId: string, updates: Partial<Job>) => void;
  addJob: (jobData: Partial<Job>) => Promise<Job>;
  cancelJob: (jobId: string) => Promise<void>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  addActivity: (activity: Omit<ActivityLog, 'id' | 'created_at'>) => void;
  fetchInitialData: () => Promise<void>;
  simulateRealtime: () => void;
}

export const useLiftStore = create<LiftState>((set, get) => ({
  lifts: [],
  jobs: [],
  notifications: [],
  activities: [],
  isLoading: false,
  syncStatus: 'connecting',
  lastSyncedAt: null,

  setSyncStatus: (status, syncedAt) => set({
    syncStatus: status,
    lastSyncedAt: syncedAt ?? (status === 'realtime' || status === 'polling' ? new Date() : get().lastSyncedAt)
  }),

  updateLift: (liftId, updates) => {
    // If updating ONLY progress, update local store state without issuing a DB write
    if (Object.keys(updates).length === 1 && updates.progress !== undefined) {
      set((state) => ({
        lifts: state.lifts.map((lift) =>
          lift.id === liftId ? { ...lift, progress: updates.progress! } : lift
        )
      }));
      return;
    }

    const prevLift = get().lifts.find(l => l.id === liftId || l.lift_number === liftId);

    // Save to DB (lifts table)
    const statusMap: Record<string, number> = {
      'AVAILABLE': 1,
      'MOVING': 2,
      'WAITING_PICKUP': 3,
      'LOCKED': 4,
      'MAINTENANCE': 5,
      'OFFLINE': 6,
      'STOPPED': 5
    };
    const dbUpdates: any = {};
    if (updates.status && statusMap[updates.status]) {
      dbUpdates.status_id = statusMap[updates.status];
    }
    if (updates.current_floor !== undefined) {
      dbUpdates.current_floor = `f${updates.current_floor}`;
    }
    if (updates.current_job_id !== undefined) {
      dbUpdates.current_job = updates.current_job_id;
    }

    // Direct synchronization for uncollected timer (pickup_start_time)
    if (updates.status === 'WAITING_PICKUP' && !updates.pickup_start_time) {
      updates.pickup_start_time = Date.now();
    } else if (updates.status && updates.status !== 'WAITING_PICKUP') {
      updates.pickup_start_time = null;
    }

    if (updates.pickup_start_time !== undefined) {
      dbUpdates.pickup_start_time = updates.pickup_start_time;
      if (updates.pickup_start_time) {
        dbUpdates.last_update = new Date(updates.pickup_start_time).toISOString();
      }
    } else if (updates.status === 'MOVING') {
      dbUpdates.last_update = new Date().toISOString();
    }

    db.lifts.update(liftId, dbUpdates).catch(console.error);

    // Save lift command log into lift_commands table
    if (updates.status || updates.destination_floor !== undefined || updates.current_job_id !== undefined) {
      db.liftCommands.create({
        lift_id: liftId,
        command: updates.status ? `SET_STATUS_${updates.status}` : 'MOVE_LIFT',
        payload: {
          current_floor: updates.current_floor,
          destination_floor: updates.destination_floor,
          job_id: updates.current_job_id,
          status: updates.status
        },
        status: 'EXECUTED',
        created_by: 'u1',
        executed_at: new Date().toISOString()
      }).catch(console.error);
    }

    // ----------------------------------------------------
    // AUTOMATIC TELEGRAM TRIGGERS CHECK
    // ----------------------------------------------------
    const liftName = prevLift?.lift_number || liftId;

    // Trigger 1: autoSendLiftMaintenance
    if (updates.status && updates.status !== prevLift?.status && ['MAINTENANCE', 'LOCKED', 'OFFLINE'].includes(updates.status)) {
      const { autoSendLiftMaintenance, sendTelegramMessage, techChatId } = useTelegramStore.getState();
      if (autoSendLiftMaintenance) {
        const statusText = updates.status === 'MAINTENANCE' ? 'Đang Bảo Trì Định Kỳ' : updates.status === 'LOCKED' ? 'Tạm Thời Khóa Tải' : 'Ngoại Tuyến';
        sendTelegramMessage({
          chatId: techChatId,
          targetGroupLabel: 'Đội Kỹ Thuật & Bảo Trì',
          message: `⚠️ <b>CẢNH BÁO BẢO TRÌ THIẾT BỊ</b>\n🛠️ <b>Thiết bị:</b> ${liftName}\n🔒 <b>Trạng thái mới:</b> ${statusText}\n⏱️ <i>Yêu cầu Đội Kỹ Thuật kiểm tra thiết bị!</i>`
        }).catch(console.error);
      }
    }

    // Trigger 2: autoSendLiftArrival
    if (updates.status && prevLift?.status === 'MOVING' && ['WAITING_PICKUP', 'AVAILABLE'].includes(updates.status)) {
      const destFloor = updates.current_floor || prevLift?.destination_floor || prevLift?.current_floor || 1;
      const liftName = prevLift?.lift_number || liftId;

      // Phát âm thanh TTS theo tầng được phân công
      // - Worker: chỉ phát khi thang đến đúng tầng mình phụ trách
      // - Admin/Supervisor: luôn phát (không có tầng cố định)
      const { assignment } = useAuthStore.getState();
      const userAssignedFloor = assignment?.assigned_floor;
      const shouldAnnounce = !userAssignedFloor || userAssignedFloor === destFloor;
      if (shouldAnnounce) {
        speakLiftArrival(liftName, destFloor);
      }

      const { autoSendLiftArrival, sendTelegramMessage, floorConfigs, defaultChatId } = useTelegramStore.getState();
      if (autoSendLiftArrival) {
        const destFloor = updates.current_floor || prevLift?.destination_floor || prevLift?.current_floor || 1;
        const cfg = floorConfigs[destFloor];
        const chatId = (cfg && cfg.enabled && cfg.chatId) ? cfg.chatId : defaultChatId;
        const groupLabel = (cfg && cfg.enabled && cfg.groupName) ? cfg.groupName : `KHO TẦNG ${destFloor}`;

        sendTelegramMessage({
          chatId,
          targetGroupLabel: groupLabel,
          message: `🔔 <b>HÀNG ĐÃ ĐƯỢC VẬN CHUYỂN ĐẾN TẦNG ${destFloor}</b>\n🚚 <b>${liftName}</b> đã vận chuyển thành công tới <b>Tầng ${destFloor}</b>\n✅ <i>Trạng thái: Sẵn sàng kéo hàng tại Tầng ${destFloor}.</i>`
        }).catch(console.error);
      }
    }

    // Trigger 3: autoSendUncollectedCargo
    if (updates.status === 'WAITING_PICKUP' && prevLift?.status !== 'WAITING_PICKUP') {
      const { autoSendUncollectedCargo, sendTelegramMessage, floorConfigs, defaultChatId } = useTelegramStore.getState();
      if (autoSendUncollectedCargo) {
        const destFloor = updates.current_floor || prevLift?.current_floor || 1;
        const cfg = floorConfigs[destFloor];
        const chatId = (cfg && cfg.enabled && cfg.chatId) ? cfg.chatId : defaultChatId;
        const groupLabel = (cfg && cfg.enabled && cfg.groupName) ? cfg.groupName : `KHO TẦNG ${destFloor}`;

        sendTelegramMessage({
          chatId,
          targetGroupLabel: groupLabel,
          message: `🚨 <b>CẢNH BÁO TỒN ĐỌNG HÀNG</b>\n📍 <b>Vị trí:</b> ${liftName} - Tầng ${destFloor}\n⏱️ <b>Trạng thái:</b> Chờ kéo hàng tại tầng\n👉 <i>Yêu cầu Đội phụ Kho ${groupLabel} khẩn trương kéo hàng!</i>`
        }).catch(console.error);
      }
    }

    set((state) => ({
      lifts: state.lifts.map((lift) =>
        lift.id === liftId ? { ...lift, ...updates, updated_at: new Date().toISOString(), last_update: 'Vừa xong' } : lift
      )
    }));
  },

  updateJob: async (jobId, updates) => {
    const targetJob = get().jobs.find(j => j.id === jobId || j.code === jobId);
    const code = targetJob?.code || jobId;
    const realId = targetJob?.id || jobId;

    // Save to DB
    await db.transportJobs.update(realId, {
      ...(updates.status ? { status: updates.status as any } : {}),
      ...(updates.notes !== undefined ? { remark: updates.notes } : {})
    }).catch(console.error);

    if (updates.status && targetJob && updates.status !== targetJob.status) {
      let logDesc = `Cập nhật công việc #${code}: ${updates.status}`;
      if (updates.status === 'COMPLETED') {
        logDesc = `Đã hoàn thành công việc #${code} (Kéo hàng tại Tầng ${targetJob.target_floor})`;
      } else if (updates.status === 'WAITING_PICKUP') {
        logDesc = `Công việc #${code} đã tới Tầng ${targetJob.target_floor} (Chờ kéo hàng)`;
      } else if ((updates.status as string) === 'MOVING') {
        logDesc = `Đang vận chuyển công việc #${code} từ Tầng ${targetJob.source_floor} ➔ Tầng ${targetJob.target_floor}`;
      }

      await db.activityLogs.add({
        user_id: targetJob.created_by || 'system',
        action: updates.status === 'COMPLETED' ? 'COMPLETE_JOB' : 'UPDATE_JOB',
        table_name: 'transport_jobs',
        record_id: isUuid(realId) ? realId : code,
        description: logDesc,
        event_type: 'JOB_EVENT'
      }).catch(console.error);

      await db.jobTimeline.create({
        job_id: realId,
        status: updates.status,
        action_by: targetJob.created_by || 'system',
        remark: logDesc
      }).catch(console.error);

      const newActivity: ActivityLog = {
        id: `act-${Date.now()}`,
        user_id: targetJob.creator_name || 'Nhân viên kho',
        action: 'job',
        entity: 'transport_jobs',
        entity_id: code,
        description: logDesc,
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      set((state) => ({
        activities: [newActivity, ...state.activities]
      }));
    }

    set((state) => ({
      jobs: state.jobs.map((job) =>
        (job.id === jobId || job.code === jobId) ? { ...job, ...updates, updated_at: new Date().toISOString() } : job
      )
    }));
  },

  addJob: async (jobData) => {
    const newCode = `TR-${Math.floor(8900 + Math.random() * 200)}`;
    const newJob: Job = {
      id: `job-${Date.now()}`,
      code: newCode,
      lift_id: jobData.lift_id || 'L1',
      lift_number: get().lifts.find(l => l.id === jobData.lift_id)?.lift_number || 'Thang P1',
      created_by: jobData.created_by || 'u1',
      creator_name: jobData.creator_name || 'Nhân viên kho',
      source_floor: jobData.source_floor || 1,
      target_floor: jobData.target_floor || 2,
      status: jobData.status || 'CREATED',
      priority: jobData.priority || 'NORMAL',
      item_type: jobData.item_type || 'Pallet Hàng',
      quantity: jobData.quantity || 1,
      notes: jobData.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Save transport_job to Database
    const createdDbJob = await db.transportJobs.create({
      job_no: newCode,
      lift_id: newJob.lift_id,
      from_floor: `f${newJob.source_floor}`,
      to_floor: `f${newJob.target_floor}`,
      sender_id: newJob.created_by,
      status: newJob.status as any,
      remark: `${newJob.item_type} x${newJob.quantity} - ${newJob.notes}`
    }).catch(() => null);

    if (createdDbJob?.id) {
      newJob.id = createdDbJob.id;
    }

    // Save Activity Log to Database
    const logDesc = `Đã tạo công việc #${newCode} (T${newJob.source_floor} ➔ T${newJob.target_floor} - ${newJob.item_type})`;
    await db.activityLogs.add({
      user_id: newJob.created_by,
      action: 'CREATE_JOB',
      table_name: 'transport_jobs',
      record_id: isUuid(newJob.id) ? newJob.id : newCode,
      description: logDesc,
      event_type: 'JOB_EVENT'
    }).catch(console.error);

    // Save Job Timeline to Database
    await db.jobTimeline.create({
      job_id: newJob.id,
      status: newJob.status,
      action_by: newJob.created_by,
      remark: logDesc
    }).catch(console.error);

    // Save Notification to Database
    await db.notifications.create({
      job_id: newJob.id,
      notification_type: 'NEW_JOB',
      receiver_id: newJob.created_by,
      title: 'Đã tạo công việc mới',
      message: `Công việc #${newCode} vừa được tạo từ Tầng ${newJob.source_floor} đến Tầng ${newJob.target_floor}.`,
      status: 'SENT'
    }).catch(console.error);

    const newActivity: ActivityLog = {
      id: `act-${Date.now()}`,
      user_id: newJob.creator_name || 'Nhân viên kho',
      action: 'job',
      entity: 'transport_jobs',
      entity_id: newCode,
      description: logDesc,
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newNotif: AppNotification = {
      id: `notif-${Date.now()}`,
      title: 'Đã tạo công việc mới',
      message: `Công việc #${newCode} vừa được tạo từ Tầng ${newJob.source_floor} đến Tầng ${newJob.target_floor}.`,
      severity: newJob.priority === 'URGENT' ? 'warning' : 'info',
      category: 'job',
      is_read: false,
      created_at: new Date().toISOString(),
      link_id: newCode
    };

    // Trigger 4: autoSendUrgentJob
    const { autoSendUrgentJob, sendTelegramMessage, defaultChatId } = useTelegramStore.getState();
    if (autoSendUrgentJob && (newJob.priority === 'URGENT' || newJob.notes?.toLowerCase().includes('hỏa tốc') || newJob.notes?.toLowerCase().includes('ưu tiên'))) {
      sendTelegramMessage({
        chatId: defaultChatId,
        targetGroupLabel: 'Kênh Chung Kho',
        message: `🔴 <b>ĐƠN VẬN CHUYỂN HỎA TỐC MỚI</b>\n📄 <b>Mã đơn:</b> #${newJob.code}\n🔄 <b>Lộ trình:</b> Tầng ${newJob.source_floor} ➔ Tầng ${newJob.target_floor}\n📦 <b>Loại hàng:</b> ${newJob.item_type} (Số lượng: ${newJob.quantity})\n👤 <b>Người tạo:</b> ${newJob.creator_name}\n⚡ <i>Yêu cầu ưu tiên tời vận hành ngay lập tức!</i>`
      }).catch(console.error);
    }

    set((state) => ({
      jobs: [newJob, ...state.jobs],
      activities: [newActivity, ...state.activities],
      notifications: [newNotif, ...state.notifications]
    }));

    return newJob;
  },

  cancelJob: async (jobId) => {
    const targetJob = get().jobs.find(j => j.id === jobId || j.code === jobId);
    const code = targetJob?.code || jobId;
    const realId = targetJob?.id || jobId;

    await db.transportJobs.update(realId, { status: 'CANCELLED' }).catch(console.error);

    await db.jobTimeline.create({
      job_id: realId,
      status: 'CANCELLED',
      action_by: targetJob?.created_by || 'u1',
      remark: `Hủy đơn vận chuyển #${code}`
    }).catch(console.error);

    const logDesc = `Đã hủy đơn vận chuyển #${code}`;
    await db.activityLogs.add({
      user_id: targetJob?.created_by || 'u1',
      action: 'CANCEL_JOB',
      table_name: 'transport_jobs',
      record_id: code,
      description: logDesc,
      event_type: 'JOB_EVENT'
    }).catch(console.error);

    set((state) => ({
      jobs: state.jobs.map(j => (j.id === jobId || j.code === jobId) ? { ...j, status: 'CANCELLED', updated_at: new Date().toISOString() } : j),
      activities: [
        {
          id: `act-${Date.now()}`,
          user_id: 'user',
          action: 'job',
          entity: 'job',
          entity_id: code,
          description: logDesc,
          created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        ...state.activities
      ]
    }));
  },

  markNotificationRead: (id) => {
    db.notifications.updateStatus(id, 'READ').catch(console.error);
    set((state) => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, is_read: true } : n)
    }));
  },

  markAllNotificationsRead: () => {
    const notifs = get().notifications;
    notifs.forEach(n => db.notifications.updateStatus(n.id, 'READ').catch(console.error));
    set((state) => ({
      notifications: state.notifications.map(n => ({ ...n, is_read: true }))
    }));
  },

  clearNotifications: () => set(() => ({
    notifications: []
  })),

  addActivity: (activityData) => {
    db.activityLogs.add({
      user_id: activityData.user_id || 'u1',
      action: activityData.action.toUpperCase(),
      table_name: activityData.entity || 'system',
      record_id: activityData.entity_id || '',
      description: activityData.description,
      event_type: 'SYSTEM_EVENT'
    }).catch(console.error);

    set((state) => ({
      activities: [
        {
          id: `act-${Date.now()}`,
          ...activityData,
          created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        ...state.activities
      ]
    }));
  },

  fetchInitialData: async () => {
    set({ isLoading: true });
    try {
      const [dbLifts, dbJobs, dbNotifs, dbActivities, dbStatusList, dbUsers, dbFloors] = await Promise.all([
        db.lifts.getAll(),
        db.transportJobs.getAll(),
        db.notifications.getAll(),
        db.activityLogs.getAll(),
        db.liftStatus.getAll(),
        db.users.getAll(),
        db.floors.getAll()
      ]);

      const statusCodeMap: Record<number, string> = {};
      dbStatusList.forEach(s => {
        statusCodeMap[s.id] = s.status_code;
      });

      const userMap: Record<string, string> = {};
      dbUsers.forEach(u => {
        userMap[u.id] = u.full_name;
      });

      const floorMap: Record<string, number> = {};
      dbFloors.forEach(f => {
        floorMap[f.id] = f.floor_no;
      });

      // Map lifts
      const parseFloor = (floor: string | number | null | undefined): number => {
        if (typeof floor === 'number') return floor;
        if (!floor) return 1;
        const str = String(floor);
        if (floorMap[str]) return floorMap[str];
        if (str.startsWith('f')) {
          const num = parseInt(str.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(num) && num > 0) return num;
        }
        const fallbackNum = parseInt(str.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(fallbackNum) && fallbackNum > 0 && fallbackNum <= 10) return fallbackNum;
        return 1;
      };

      const mappedLifts: Lift[] = dbLifts.map(d => {
        // Fallback robust active job matching
        const activeJob = (d.current_job
          ? (dbJobs.find(j => j.id === d.current_job || j.job_no === d.current_job || (j as any).code === d.current_job) ||
            get().jobs.find(j => j.id === d.current_job || j.code === d.current_job))
          : null) ||
          dbJobs.find(j =>
            (j.lift_id === d.id || j.lift_id === d.lift_code) &&
            ['MOVING', 'WAITING_PICKUP', 'CREATED'].includes(j.status)
          ) ||
          get().jobs.find(j =>
            (j.lift_id === d.id || j.lift_id === d.lift_code) &&
            ['MOVING', 'WAITING_PICKUP', 'CREATED'].includes(j.status)
          ) || null;

        const destFloor = activeJob ? parseFloor((activeJob as any).to_floor || (activeJob as any).target_floor) : null;
        const srcFloor = activeJob ? parseFloor((activeJob as any).from_floor || (activeJob as any).source_floor) : null;
        const liftStatus = (statusCodeMap[d.status_id || 1] as any) || 'AVAILABLE';

        let pickupStartTime: number | null = null;
        if (liftStatus === 'WAITING_PICKUP') {
          if (d.pickup_start_time) {
            pickupStartTime = typeof d.pickup_start_time === 'number'
              ? d.pickup_start_time
              : new Date(d.pickup_start_time).getTime();
          } else if (d.last_update) {
            const parsed = new Date(d.last_update).getTime();
            pickupStartTime = !isNaN(parsed) && parsed > 0 ? parsed : Date.now();
          } else {
            pickupStartTime = Date.now();
          }
        }

        // Calculate progress dynamically based on time elapsed
        let computedProgress = 0;
        if (liftStatus === 'MOVING') {
          const startTime = d.last_update ? new Date(d.last_update).getTime() : Date.now();
          const travelDist = (destFloor && srcFloor) ? Math.abs(destFloor - srcFloor) : 1;
          const totalSecs = travelDist * 30; // 30s per floor
          const elapsedSecs = Math.max(0, (Date.now() - startTime) / 1000);
          computedProgress = Math.min(99, Math.floor((elapsedSecs / totalSecs) * 100));
        } else if (liftStatus === 'WAITING_PICKUP') {
          computedProgress = 100;
        }

        const normalizedLiftId = (d.id && !d.id.includes('-')) ? d.id : (d.lift_code || d.id);

        return {
          id: normalizedLiftId,
          lift_number: d.lift_name || d.lift_code || d.id,
          current_floor: parseFloor(d.current_floor),
          destination_floor: destFloor,
          source_floor: srcFloor,
          status: liftStatus,
          operator: d.current_job ? userMap['u3'] || 'Phạm Lan Trang' : null,
          current_job_id: activeJob ? (activeJob.id || (activeJob as any).job_no) : (d.current_job || null),
          elapsed_time: null,
          pickup_start_time: pickupStartTime,
          last_update: d.last_update ? new Date(d.last_update).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong',
          progress: computedProgress,
          created_at: new Date().toISOString(),
          updated_at: d.last_update || new Date().toISOString(),
        };
      });
      // Map jobs
      const mappedJobs: Job[] = dbJobs.map(j => ({
        id: j.id,
        code: j.job_no || j.id,
        lift_id: j.lift_id || 'L1',
        lift_number: dbLifts.find(l => l.id === j.lift_id)?.lift_name || j.lift_id || 'Thang P1',
        created_by: j.sender_id || 'u1',
        creator_name: (j.sender_id && userMap[j.sender_id]) ? userMap[j.sender_id] : 'Nhân viên kho',
        source_floor: parseFloor(j.from_floor),
        target_floor: parseFloor(j.to_floor),
        status: (j.status as any) || 'CREATED',
        priority: 'NORMAL',
        item_type: j.remark || 'Pallet Hàng',
        quantity: 1,
        notes: j.remark || '',
        created_at: j.created_at,
        updated_at: j.created_at
      }));

      // Map notifications
      const mappedNotifs: AppNotification[] = dbNotifs.map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        severity: (n.notification_type && n.notification_type.includes('WARNING')) ? 'warning' : 'info',
        category: 'job',
        is_read: n.status === 'READ',
        created_at: n.created_at,
        link_id: n.job_id
      }));

      // Map activities
      const mappedActivities: ActivityLog[] = dbActivities.map(a => {
        // Resolve user display name
        let displayUserName = 'Hệ Thống';
        if (a.user_id && a.user_id !== 'system') {
          if (userMap[a.user_id]) {
            displayUserName = userMap[a.user_id];
          } else {
            const foundUser = dbUsers.find(u => u.id === a.user_id || u.employee_code === a.user_id);
            if (foundUser) displayUserName = foundUser.full_name;
            else if (!a.user_id.includes('-') || a.user_id.length < 20) displayUserName = a.user_id;
          }
        }

        // Resolve entity display ID
        let displayEntityId = a.record_id || '';
        if (displayEntityId && (displayEntityId.length > 20 || displayEntityId.includes('-'))) {
          const matchingJob = dbJobs.find(j => j.id === displayEntityId || j.job_no === displayEntityId);
          if (matchingJob) {
            displayEntityId = matchingJob.job_no || matchingJob.id;
          } else {
            const matchingLift = dbLifts.find(l => l.id === displayEntityId);
            if (matchingLift) {
              displayEntityId = matchingLift.lift_name ? matchingLift.lift_name.replace('Lift ', 'Tời ') : 'Tời';
            } else {
              const matchingUser = dbUsers.find(u => u.id === displayEntityId);
              if (matchingUser) {
                displayEntityId = matchingUser.employee_code || matchingUser.full_name;
              } else {
                displayEntityId = '';
              }
            }
          }
        }

        // Sanitize any raw UUID strings inside description
        let cleanDescription = a.description || '';
        const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
        cleanDescription = cleanDescription.replace(uuidPattern, (uuidStr) => {
          const matchedJob = dbJobs.find(j => j.id === uuidStr);
          if (matchedJob) return matchedJob.job_no || 'đơn hàng';
          const matchedLift = dbLifts.find(l => l.id === uuidStr);
          if (matchedLift) return matchedLift.lift_name ? matchedLift.lift_name.replace('Lift ', 'Tời ') : 'Tời';
          const matchedUser = dbUsers.find(u => u.id === uuidStr);
          if (matchedUser) return matchedUser.full_name;
          return 'đối tượng';
        });

        // Determine badge action category
        const actLower = (a.action || '').toLowerCase();
        let catAction = 'system';
        if (actLower.includes('job') || actLower.includes('order')) catAction = 'job';
        else if (actLower.includes('telegram')) catAction = 'telegram';
        else if (actLower.includes('assign')) catAction = 'assignment';
        else if (actLower.includes('alert') || actLower.includes('stop') || actLower.includes('warning')) catAction = 'alert';

        return {
          id: String(a.id),
          user_id: displayUserName,
          action: catAction,
          entity: a.table_name,
          entity_id: displayEntityId,
          description: cleanDescription,
          created_at: a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong'
        };
      });

      // ─────────────────────────────────────────────────────────────────────
      // Smart-merge: giữ lại các trường ephemeral (như progress, elapsed_time)
      // CHỈ KHI cả DB và Local có CÙNG trạng thái hoạt động (MOVING hoặc WAITING_PICKUP).
      // Nếu DB đã đổi trạng thái (ví dụ từ WAITING_PICKUP sang AVAILABLE do tầng B bấm xác nhận),
      // bắt buộc phải cập nhật ngay trạng thái từ DB để thiết bị của nhân viên A không bị kẹt
      // ─────────────────────────────────────────────────────────────────────
      const currentLifts = get().lifts;
      const mergedLifts: Lift[] = mappedLifts.map(dbLift => {
        const localLift = currentLifts.find(l =>
          l.id === dbLift.id ||
          l.lift_number === dbLift.lift_number ||
          l.id === dbLift.lift_number
        );

        if (!localLift) return dbLift;

        if (localLift.status === 'MOVING') {
          const newStatus = dbLift.status === 'WAITING_PICKUP' ? 'WAITING_PICKUP' : 'MOVING';
          return {
            ...dbLift,
            status: newStatus,
            progress: newStatus === 'MOVING' ? Math.max(localLift.progress, dbLift.progress) : 100,
            elapsed_time: localLift.elapsed_time,
            pickup_start_time: dbLift.pickup_start_time ?? localLift.pickup_start_time,
            destination_floor: dbLift.destination_floor ?? localLift.destination_floor,
            source_floor: dbLift.source_floor ?? localLift.source_floor,
            current_job_id: dbLift.current_job_id ?? localLift.current_job_id,
            operator: dbLift.operator ?? localLift.operator,
            last_update: dbLift.last_update ?? localLift.last_update,
          };
        }

        if (localLift.status === 'WAITING_PICKUP') {
          const newStatus = dbLift.status === 'AVAILABLE' ? 'AVAILABLE' : 'WAITING_PICKUP';
          return {
            ...dbLift,
            status: newStatus,
            pickup_start_time: newStatus === 'WAITING_PICKUP' ? (dbLift.pickup_start_time ?? localLift.pickup_start_time) : null,
            destination_floor: newStatus === 'WAITING_PICKUP' ? (dbLift.destination_floor ?? localLift.destination_floor) : null,
            source_floor: newStatus === 'WAITING_PICKUP' ? (dbLift.source_floor ?? localLift.source_floor) : null,
            current_job_id: newStatus === 'WAITING_PICKUP' ? (dbLift.current_job_id ?? localLift.current_job_id) : null,
            operator: newStatus === 'WAITING_PICKUP' ? (dbLift.operator ?? localLift.operator) : null,
          };
        }

        return dbLift;
      });

      set({
        lifts: mergedLifts.length > 0 ? mergedLifts : mockLifts,
        jobs: mappedJobs.length > 0 ? mappedJobs : mockJobs,
        notifications: mappedNotifs.length > 0 ? mappedNotifs : mockNotifications,
        activities: mappedActivities.length > 0 ? mappedActivities : mockActivities
      });

    } catch (e) {
      console.error('Failed to fetch initial data from database:', e);
      set({ lifts: mockLifts, jobs: mockJobs, notifications: mockNotifications, activities: mockActivities });
    } finally {
      set({ isLoading: false });
    }
  },

  simulateRealtime: () => {
    // Realtime sync simulation
  }
}));

