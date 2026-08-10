import React, { useState, useEffect } from 'react';
import {
  Send, Bot, MessageCircle, SignalHigh, CheckCircle2, XCircle,
  Users, Settings, HelpCircle, Copy, Check, RefreshCw, Key, ShieldCheck,
  AlertTriangle, ArrowRight, ExternalLink, Sparkles, Layers, Volume2,
  Radio, ListFilter, Trash2, Smartphone, Terminal, Zap, Info
} from 'lucide-react';
import { useTelegramStore, TelegramLog } from '../stores/useTelegramStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useLiftStore } from '../stores/useLiftStore';
import { toast } from 'sonner';
import { db } from '../api/dbClient';
import { speakText } from '../utils/audio';

export function TelegramCenter() {
  const { user } = useAuthStore();
  const {
    botToken,
    botName,
    botUsername,
    isConnected,
    defaultChatId,
    techChatId,
    floorConfigs,
    autoSendUrgentJob,
    autoSendUncollectedCargo,
    autoSendLiftArrival,
    autoSendLiftMaintenance,
    logs,
    setBotToken,
    setBotInfo,
    updateFloorConfig,
    setDefaultChatId,
    setTechChatId,
    toggleTrigger,
    sendTelegramMessage,
    clearLogs,
    loadLogsFromDb,
    loadSettingsFromDb,
    saveSettingsToDb
  } = useTelegramStore();

  const [activeTab, setActiveTab] = useState<'dispatch' | 'guide' | 'settings' | 'logs'>('dispatch');
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Kill Switch Master/Backup ID State
  const [masterId, setMasterId] = useState('');
  const [backupId, setBackupId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [isSavingKillSwitch, setIsSavingKillSwitch] = useState(false);
  const [testCommand, setTestCommand] = useState('status');
  const [testChatId, setTestChatId] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/system/status');
      if (res.ok) {
        const data = await res.json();
        setMasterId(data.masterChatId || '');
        setBackupId(data.backupChatId || '');
        setWebhookUrl(data.webhookUrl || null);
        if (!testChatId) setTestChatId(data.masterChatId || '');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSetupWebhook = async (action: 'setup' | 'delete') => {
    setIsRegisteringWebhook(true);
    try {
      const res = await fetch('/api/telegram/webhook/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, domain: window.location.origin })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(action === 'setup' ? 'Đã kích hoạt Telegram Webhook cho Production thành công!' : 'Đã hủy Webhook, chuyển sang Polling!');
        fetchStatus();
      } else {
        toast.error(`Lỗi Webhook: ${data.description || 'Thất bại'}`);
      }
    } catch (err) {
      toast.error('Lỗi khi kết nối tới Webhook API');
    } finally {
      setIsRegisteringWebhook(false);
    }
  };

  const handleSaveKillSwitch = async () => {
    setIsSavingKillSwitch(true);
    try {
      const { botToken: currentBotToken } = useTelegramStore.getState();
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterChatId: masterId, backupChatId: backupId, botToken: currentBotToken })
      });
      if (res.ok) {
        toast.success('Đã cập nhật Master & Backup ID thành công!');
        fetchStatus();
      } else {
        toast.error('Lỗi khi cập nhật cấu hình.');
      }
    } catch (err) {
      toast.error('Lỗi kết nối server.');
    } finally {
      setIsSavingKillSwitch(false);
    }
  };

  const handleRunTestCommand = async () => {
    try {
      const res = await fetch('/api/telegram/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: testChatId, text: testCommand, senderName: 'Admin Tester' })
      });
      const data = await res.json();
      setTestResult(data);
      if (data.handled) {
        toast.success(`Lệnh "${testCommand}" đã được xử lý! Trạng thái: ${data.isLocked ? 'ĐÃ KHÓA' : 'ĐÃ MỞ'}`);
        fetchStatus();
      } else {
        toast.error('Lệnh bị từ chối hoặc Chat ID không khớp Master/Backup!');
      }
    } catch (err) {
      toast.error('Lỗi khi gửi lệnh test.');
    }
  };

  useEffect(() => {
    loadLogsFromDb();
    loadSettingsFromDb();
  }, [activeTab]);

  // Manual Dispatch State
  const [targetGroup, setTargetGroup] = useState<string>('DEFAULT');
  const [templateType, setTemplateType] = useState<string>('CUSTOM');
  const [messageText, setMessageText] = useState<string>('🚨 <b>CẢNH BÁO TỒN ĐỌNG HÀNG</b>\nThang P3 tại Tầng 4 có đơn hàng chờ lấy quá 3 phút! Đội kho Tầng 4 vui lòng kiểm tra và kéo hàng ra khỏi thang gấp.');
  const [enableTts, setEnableTts] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);

  // Settings State
  const [tempToken, setTempToken] = useState<string>(botToken);
  const [isTestingToken, setIsTestingToken] = useState<boolean>(false);

  useEffect(() => {
    setTempToken(botToken);
  }, [botToken]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    toast.success(`Đã sao chép: ${label}`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Test Bot Token Connection
  const handleTestBotToken = async () => {
    if (!tempToken || tempToken.trim() === '') {
      toast.error('Vui lòng nhập Bot Token hợp lệ!');
      return;
    }

    setIsTestingToken(true);
    try {
      const res = await fetch(`https://api.telegram.org/bot${tempToken}/getMe`);
      const data = await res.json();

      if (data.ok && data.result) {
        setBotToken(tempToken);
        setBotInfo({
          name: data.result.first_name || 'W.L.D.S Telegram Bot',
          username: data.result.username || 'wlds_bot',
          isConnected: true,
        });
        await db.telegramLogs.log({
          user_id: 'u1',
          telegram_chat_id: 'SYSTEM',
          message: `🤖 Đã kiểm tra kết nối Telegram Bot thành công: @${data.result.username} (${data.result.first_name})`,
          status: 'SUCCESS'
        }).catch(console.error);

        await db.activityLogs.add({
          user_id: 'u1',
          action: 'TELEGRAM_CONFIG',
          table_name: 'telegram_logs',
          description: `Đã kết nối Telegram Bot API: @${data.result.username}`,
          event_type: 'TELEGRAM_EVENT'
        }).catch(console.error);

        toast.success(`Kết nối thành công tới Bot: @${data.result.username}`);
      } else {
        toast.error(`Không thể kết nối Telegram Bot: ${data.description || 'Token không hợp lệ'}`);
        // Keep demo active
        setBotToken(tempToken);
        setBotInfo({
          name: botName,
          username: botUsername,
          isConnected: true,
        });

        await db.telegramLogs.log({
          user_id: 'u1',
          telegram_chat_id: 'SYSTEM',
          message: `⚠️ Kiểm tra kết nối Telegram Bot thất bại: ${data.description || 'Token không hợp lệ'}`,
          status: 'FAILED'
        }).catch(console.error);
      }
    } catch (e) {
      toast.info('Đã lưu Token vào hệ thống (Chế độ mô phỏng offline)');
      setBotToken(tempToken);
      setBotInfo({
        name: botName,
        username: botUsername,
        isConnected: true,
      });

      await db.telegramLogs.log({
        user_id: 'u1',
        telegram_chat_id: 'SYSTEM',
        message: `ℹ️ Lưu Telegram Bot Token ở chế độ mô phỏng offline`,
        status: 'SUCCESS'
      }).catch(console.error);
    } finally {
      setIsTestingToken(false);
      loadLogsFromDb();
    }
  };

  // Handle Preset Template Switch
  const handleSelectTemplate = (type: string) => {
    setTemplateType(type);
    switch (type) {
      case 'UNCOLLECTED':
        setMessageText(
          `🚨 <b>CẢNH BÁO TỒN ĐỌNG HÀNG (>3 Phút)</b>\n` +
          `📍 <b>Vị trí:</b> Thang P1 - Tầng 4\n` +
          `📦 <b>Mã đơn:</b> #TR-8990 - Pallet Hàng\n` +
          `⏱️ <b>Thời gian chờ:</b> 4 phút 25 giây\n` +
          `👉 <i>Yêu cầu Đội Kho Tầng 4 khẩn trương dỡ hàng!</i>`
        );
        break;
      case 'LIFT_ARRIVAL':
        setMessageText(
          `🔔 <b>CHUÔNG TỜI CẬP BẾN TẦNG</b>\n` +
          `🚚 <b>Tời 02</b> đã vận chuyển thành công từ <b>Tầng 3 ➔ Tầng 1</b>\n` +
          `📦 <b>Số lượng:</b> Pallet Hàng\n` +
          `✅ <i>Trạng thái: Sẵn sàng kéo hàng tại Tầng 1.</i>`
        );
        break;
      case 'MAINTENANCE':
        setMessageText(
          `⚠️ <b>CẢNH BÁO BẢO TRÌ THIẾT BỊ</b>\n` +
          `🛠️ <b>Thiết bị:</b> Thang P5 (Lift 05)\n` +
          `🔒 <b>Trạng thái:</b> Tạm dừng hoạt động để bảo dưỡng định kỳ\n` +
          `⏱️ <b>Thời gian dự kiến:</b> 30 phút`
        );
        break;
      case 'URGENT_JOB':
        setMessageText(
          `🔴 <b>ĐƠN VẬN CHUYỂN HỎA TỐC MỚI</b>\n` +
          `📄 <b>Mã đơn:</b> #TR-8994\n` +
          `🔄 <b>Lộ trình:</b> Tầng 1 ➔ Tầng 4\n` +
          `👤 <b>Người tạo:</b> Nguyễn Văn Hùng\n` +
          `⚡ <i>Ưu tiên tời vận hành ngay lập tức!</i>`
        );
        break;
      default:
        setMessageText('');
        break;
    }
  };

  // Handle Manual Dispatch
  const handleSendDispatch = async () => {
    if (!messageText.trim()) {
      toast.error('Nội dung tin nhắn không được để trống!');
      return;
    }

    setIsSending(true);

    let targetChatId = defaultChatId;
    let targetLabel = 'Kênh Chung Kho';
    let targetFloor = 0; // 0 = Kênh chung / Tất cả các tầng

    if (targetGroup === 'TECH') {
      targetChatId = techChatId;
      targetLabel = 'Kỹ Thuật Bảo Trì';
      targetFloor = 0;
    } else if (targetGroup.startsWith('FLOOR_')) {
      targetFloor = parseInt(targetGroup.replace('FLOOR_', ''), 10) || 0;
      const cfg = floorConfigs[targetFloor];
      if (cfg) {
        targetChatId = cfg.chatId;
        targetLabel = cfg.groupName;
      }
    }

    // Nếu gửi ở kênh chung nhưng tin nhắn chỉ định rõ "Tầng X", tự nhận diện tầng mục tiêu
    if (targetFloor === 0) {
      const match = messageText.match(/tầng\s*([1-4])/i);
      if (match) {
        targetFloor = parseInt(match[1], 10) || 0;
      }
    }

    // Gửi tin nhắn qua Telegram API endpoint
    const res = await sendTelegramMessage({
      chatId: targetChatId,
      targetGroupLabel: targetLabel,
      message: messageText,
    });

    // Nếu bật tính năng đọc giọng nói (TTS): phát thanh tới thiết bị của các tài khoản được phân công làm việc ở tầng đó
    if (enableTts) {
      const senderUserId = user?.id || 'u1';
      const notifTitle = targetFloor > 0
        ? `🔊 Thông báo phát thanh Tầng ${targetFloor}`
        : `🔊 Thông báo phát thanh Kênh Chung`;

      const formattedMessage = `[AUDIO_DISPATCH|F${targetFloor}|SENDER:${senderUserId}] ${messageText}`;

      // 1. Phát qua BroadcastChannel để các tab khác trên cùng trình duyệt phát giọng đọc tức thì
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('wlds_audio_dispatch');
          bc.postMessage({
            id: `audio-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            targetFloor,
            senderId: senderUserId,
            text: messageText,
            timestamp: Date.now()
          });
          bc.close();
        } catch (e) {
          console.warn('BroadcastChannel error:', e);
        }
      }

      // 2. Lưu Notification vào DB để truyền đồng bộ tới tất cả thiết bị tài khoản khác ở tầng đó via Realtime/Polling
      await db.notifications.create({
        notification_type: `AUDIO_DISPATCH_F${targetFloor}`,
        title: notifTitle,
        message: formattedMessage,
        status: 'SENT'
      }).catch(console.error);

      // 3. Cập nhật state Notifications cục bộ
      const newNotif = {
        id: `notif-audio-${Date.now()}`,
        title: notifTitle,
        message: formattedMessage,
        severity: 'info' as const,
        category: 'telegram' as const,
        is_read: false,
        created_at: new Date().toISOString(),
        target_floor: targetFloor,
        sender_id: senderUserId
      };

      useLiftStore.setState(state => ({
        notifications: [newNotif, ...state.notifications]
      }));
    }

    setIsSending(false);

    if (res.success) {
      const floorTargetDesc = targetFloor > 0 ? `Tầng ${targetFloor}` : 'Kênh Chung';
      toast.success(
        `Đã phát tin tới Telegram (${targetLabel}) ${enableTts ? `và phát thanh giọng đọc TTS tới ${floorTargetDesc} ` : ''}thành công!`
      );
    } else {
      toast.error(`Thất bại: ${res.error}`);
    }
  };

  // KPI Statistics
  const totalSentToday = logs.filter(l => l.status === 'SUCCESS').length;
  const failedToday = logs.filter(l => l.status === 'FAILED').length;

  return (
    <div className="space-y-6 pb-12 w-full max-w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sky-500 text-white rounded-2xl shadow-md shadow-sky-500/20">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
                Trung Tâm Thông Báo Telegram
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center gap-1">
                <Bot className="w-3.5 h-3.5" />
                Bot API
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Phát tin nhắn khẩn cấp, cấu hình Chat ID các tầng và đồng bộ cảnh báo kho tự động
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
          <button
            onClick={() => setIsGuideModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/80 text-sky-700 dark:text-sky-300 font-bold text-xs md:text-sm rounded-xl border border-sky-200/80 dark:border-sky-800 transition-all cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Hướng Dẫn Tạo & Liên Kết Bot</span>
          </button>

          <button
            onClick={() => setActiveTab('dispatch')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-xs md:text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Phát Tin Khẩn</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <SignalHigh className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Trạng Thái Bot</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-sm font-black text-slate-900 dark:text-white">
                {isConnected ? 'Sẵn Sàng' : 'Chưa Kết Nối'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono truncate max-w-[120px]">@{botUsername}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Kênh Đã Liên Kết</p>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">5 Nhóm</p>
            <p className="text-[11px] text-slate-500">Kênh chung & 4 Tầng kho</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Đã Phát Hôm Nay</p>
            <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{totalSentToday} Tin</p>
            <p className="text-[11px] text-slate-500">Đã gửi thành công</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quy Tắc Tự Động</p>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">4 Kích Hoạt</p>
            <p className="text-[11px] text-slate-500">Báo đọng, chuông tời, sự cố</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400">
        <button
          onClick={() => setActiveTab('dispatch')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${activeTab === 'dispatch'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
        >
          <Send className="w-4 h-4" />
          <span>Phát Tin Khẩn & Broadcast</span>
        </button>

        <button
          onClick={() => setActiveTab('guide')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${activeTab === 'guide'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Hướng Dẫn Tạo & Liên Kết Bot</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${activeTab === 'settings'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
        >
          <Settings className="w-4 h-4" />
          <span>Cấu Hình Token & Định Tuyến Tầng</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${activeTab === 'logs'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
        >
          <ListFilter className="w-4 h-4" />
          <span>Lịch Sử Gửi Tin ({logs.length})</span>
        </button>

      </div>

      {/* TAB 1: DISPATCH & BROADCAST */}
      {activeTab === 'dispatch' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Dispatch Panel */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 md:p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Gửi Tin Nhắn / Cảnh Báo Trực Tiếp
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Parse Mode: HTML</span>
            </div>

            {/* Target Group Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                1. Chọn Nhóm Telegram Nhận Khẩn
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { id: 'DEFAULT', name: '📢 Kênh Chung Toàn Kho', chatId: defaultChatId },
                  { id: 'FLOOR_1', name: '🏢 Kho Tầng 1', chatId: floorConfigs[1]?.chatId },
                  { id: 'FLOOR_2', name: '🏢 Kho Tầng 2', chatId: floorConfigs[2]?.chatId },
                  { id: 'FLOOR_3', name: '🏢 Kho Tầng 3', chatId: floorConfigs[3]?.chatId },
                  { id: 'FLOOR_4', name: '🏢 Kho Tầng 4', chatId: floorConfigs[4]?.chatId },
                  { id: 'TECH', name: '🛠️ Đội Bảo Trì Kỹ Thuật', chatId: techChatId },
                ].map((grp) => (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => setTargetGroup(grp.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${targetGroup === grp.id
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                      }`}
                  >
                    <div className="text-xs font-bold">{grp.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{grp.chatId}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Template Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                2. Mẫu Tin Nhắn Nhanh (Templates)
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { id: 'UNCOLLECTED', label: '🚨 Cảnh báo tồn hàng >3m' },
                  { id: 'LIFT_ARRIVAL', label: '🔔 Chuông tời đến tầng' },
                  { id: 'MAINTENANCE', label: '⚠️ Báo sự cố / bảo trì' },
                  { id: 'URGENT_JOB', label: '🔴 Đơn vận chuyển hỏa tốc' },
                  { id: 'CUSTOM', label: '✏️ Tự soạn thảo' },
                ].map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => handleSelectTemplate(tmpl.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${templateType === tmpl.id
                      ? 'bg-sky-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                  >
                    {tmpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Area */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  3. Nội Dung Tin Nhắn Telegram (Hỗ trợ thẻ HTML: &lt;b&gt;, &lt;i&gt;, &lt;code&gt;)
                </label>

                {/* TTS Toggle Switch */}
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-3 py-1 rounded-xl border border-sky-200/80 dark:border-sky-800">
                  <Volume2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Đọc TTS Khi Gửi</span>
                  <input
                    type="checkbox"
                    checked={enableTts}
                    onChange={(e) => setEnableTts(e.target.checked)}
                    className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
                  />
                </label>
              </div>

              <textarea
                rows={6}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Nhập nội dung tin nhắn gửi tới Telegram..."
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
              ></textarea>
            </div>

            {/* Actions & Submit Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span>
                  {enableTts
                    ? 'Hệ thống sẽ phát âm thanh giọng đọc tiếng Việt (TTS) song song khi phát tin.'
                    : 'Chế độ đọc giọng nói TTS đang tắt.'}
                </span>
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!messageText.trim()) {
                      toast.error('Chưa có nội dung để nghe thử!');
                      return;
                    }
                    speakText(messageText);
                    toast.info('🔊 Đang phát âm thanh đọc thử (TTS)...');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  title="Nghe thử giọng đọc Text-To-Speech trước khi phát tin"
                >
                  <Volume2 className="w-4 h-4 text-sky-500" />
                  <span>Nghe Thử TTS</span>
                </button>

                <button
                  onClick={handleSendDispatch}
                  disabled={isSending}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs md:text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang phát tin...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Gửi Ngay Qua Telegram</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Realtime Preview & Recent Dispatch Widget */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-sky-500" />
                  Xem Trước Trên Telegram Mobile
                </h3>
                <span className="text-[10px] bg-sky-100 text-sky-700 font-bold px-2 py-0.5 rounded">Live Preview</span>
              </div>

              {/* Fake Telegram Chat Card */}
              <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center text-white text-[10px] font-bold">
                    W
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{botName}</span>
                  <span className="text-[10px] text-slate-400">vừa xong</span>
                </div>
                <div
                  className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans shadow-2xs"
                  dangerouslySetInnerHTML={{ __html: messageText.replace(/\n/g, '<br/>') || '<i>Chưa có nội dung...</i>' }}
                />
              </div>
            </div>

            {/* Quick Recent Log */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Nhật Ký Gửi Gần Nhất
                </h3>
                <button onClick={() => setActiveTab('logs')} className="text-[11px] font-bold text-blue-600 hover:underline">
                  Xem tất cả
                </button>
              </div>

              <div className="space-y-2">
                {logs.slice(0, 3).map((l) => (
                  <div key={l.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{l.targetGroup}</span>
                      <span className="text-slate-400 font-mono">{l.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{l.message.replace(/<[^>]*>?/gm, '')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STEP-BY-STEP SETUP GUIDE */}
      {(activeTab === 'guide' || isGuideModalOpen) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-sky-500 text-white rounded-2xl">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Hướng Dẫn Tạo Bot Telegram & Lấy Chat ID Nhóm Kho (4 Bước Chi Tiết)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Thực hiện các bước đơn giản bên dưới để kết nối Telegram tự động phát cảnh báo cho kho
                </p>
              </div>
            </div>

            {isGuideModalOpen && (
              <button
                onClick={() => setIsGuideModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Đóng hướng dẫn
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Step 1 */}
            <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center justify-center">
                  1
                </span>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Tạo Bot Mới Với @BotFather
                </h3>
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-disc pl-5 leading-relaxed">
                <li>Mở ứng dụng Telegram trên điện thoại hoặc máy tính.</li>
                <li>
                  Tìm kiếm từ khóa <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-bold">@BotFather</code> (Bot chính thức của Telegram có tích xanh).
                </li>
                <li>
                  Gửi lệnh <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-bold">/newbot</code>.
                </li>
                <li>Nhập Tên hiển thị Bot (VD: <code className="text-blue-600 dark:text-blue-400 font-bold">WLDS Lift Alert Bot</code>).</li>
                <li>
                  Nhập Username Bot kết thúc bằng chữ <code className="font-bold">bot</code> (VD: <code className="text-blue-600 dark:text-blue-400 font-bold">wlds_elevator_bot</code>).
                </li>
              </ul>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <p className="text-[11px] font-bold text-slate-500">Mẫu API Token nhận được từ BotFather:</p>
                <div className="flex items-center justify-between text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>7829103845:AAHqK8x9pLzM2_W0rT1vU3yZ...</span>
                  <button
                    onClick={() => handleCopy('7829103845:AAHqK8x9pLzM2_W0rT1vU3yZ_demo', 'Mẫu Token')}
                    className="p-1 hover:bg-slate-100 rounded cursor-pointer text-slate-400 hover:text-slate-600"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center justify-center">
                  2
                </span>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Dán API Token Vào Hệ Thống
                </h3>
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-disc pl-5 leading-relaxed">
                <li>Sao chép toàn bộ chuỗi HTTP API Token do BotFather gửi.</li>
                <li>Chuyển qua tab <b>"Cấu Hình Token & Định Tuyến Tầng"</b> trong trang này.</li>
                <li>Dán Token vào ô <b>Telegram Bot API Token</b>.</li>
                <li>
                  Bấm nút <b>"Kiểm Tra Bot Token"</b> để xác nhận tài khoản Bot hoạt động bình thường.
                </li>
              </ul>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/60 rounded-xl border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-blue-500" />
                <span>Token được mã hóa an toàn và chỉ lưu trong bộ nhớ máy quản trị.</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center justify-center">
                  3
                </span>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Tạo Nhóm Kho & Lấy Chat ID Nhóm
                </h3>
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-disc pl-5 leading-relaxed">
                <li>Tạo các nhóm Telegram riêng cho từng tầng kho (Ví dụ: <i>KHO TẦNG 1, KHO TẦNG 2...</i>).</li>
                <li>Mời Bot vừa tạo vào từng Nhóm Telegram đó.</li>
                <li>
                  Mời bot lấy ID <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-bold">@userinfobot</code> hoặc <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-bold">@getidsbot</code> vào nhóm.
                </li>
                <li>Bot sẽ lập tức phản hồi ID nhóm (Có dạng có dấu trừ phía trước: <code className="text-sky-600 dark:text-sky-400 font-bold font-mono">-1002145892302</code>).</li>
              </ul>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <p className="text-[11px] font-bold text-slate-500">Lưu ý về định dạng Chat ID:</p>
                <p className="text-xs font-mono text-amber-600 dark:text-amber-400 font-bold">
                  Dành cho Nhóm Telegram: Bắt buộc có dấu trừ "-" (VD: -100xxxxxxxxxx)
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center justify-center">
                  4
                </span>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Cấp Quyền Administrator & Thử Nghiệm
                </h3>
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-disc pl-5 leading-relaxed">
                <li>
                  Vào Cài đặt Nhóm Telegram ➔ Chỉnh sửa ➔ <b>Administrators (Quản trị viên)</b> ➔ Thêm Bot của bạn làm Admin để đảm bảo Bot được gửi tin nhắn tự do.
                </li>
                <li>
                  Nhập các Chat ID vào Bảng Định Tuyến Tầng tương ứng.
                </li>
                <li>
                  Bấm nút <b>"Gửi Thử Tin Nhắn"</b> bên dưới từng tầng để kiểm tra chuông thông báo phát về điện thoại nhân viên kho.
                </li>
              </ul>

              <button
                onClick={() => setActiveTab('settings')}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Đến Trang Cấu Hình Ngay</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SETTINGS & ROUTING */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Bot Token Config Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 md:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Cấu Hình Telegram Bot Token & API Connection
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Đã kết nối</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  HTTP Telegram Bot Token (@BotFather)
                </label>
                <input
                  type="text"
                  value={tempToken}
                  onChange={(e) => setTempToken(e.target.value)}
                  placeholder="Ví dụ: 7829103845:AAHqK8x9pLzM2_W0rT1vU3yZ..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={handleTestBotToken}
                disabled={isTestingToken}
                className="w-full px-5 py-2.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isTestingToken ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
                <span>Kiểm Tra & Lưu Token</span>
              </button>
            </div>
          </div>

          {/* Floor Routing Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 md:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Định Tuyến Kênh & Chat ID Nhóm Tầng
                  </h3>
                  <p className="text-xs text-slate-500">Cấu hình Chat ID nhóm Telegram riêng cho từng tầng kho</p>
                </div>
              </div>
            </div>

            {/* General & Tech Channels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
                  📢 Chat ID Kênh Thông Báo Chung Toàn Kho
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={defaultChatId}
                    onChange={(e) => setDefaultChatId(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                  />
                  <button
                    onClick={() => {
                      sendTelegramMessage({
                        chatId: defaultChatId,
                        targetGroupLabel: 'Kênh Chung',
                        message: '🔔 <b>Thử nghiệm phát tin nhắn Kênh Chung Kho thành công!</b>'
                      });
                      toast.success('Đã gửi tin nhắn test tới Kênh Chung');
                    }}
                    className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shrink-0 cursor-pointer"
                  >
                    Test Gửi
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
                  🛠️ Chat ID Nhóm Kỹ Thuật & Bảo Trì
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={techChatId}
                    onChange={(e) => setTechChatId(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                  />
                  <button
                    onClick={() => {
                      sendTelegramMessage({
                        chatId: techChatId,
                        targetGroupLabel: 'Đội Kỹ Thuật',
                        message: '🛠️ <b>Thử nghiệm phát tin nhắn Nhóm Kỹ Thuật thành công!</b>'
                      });
                      toast.success('Đã gửi tin nhắn test tới Nhóm Kỹ Thuật');
                    }}
                    className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shrink-0 cursor-pointer"
                  >
                    Test Gửi
                  </button>
                </div>
              </div>
            </div>

            {/* Floor Channels List */}
            <div className="space-y-3 pt-2">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Kênh Nhóm Riêng Theo Tầng (Tầng 1 ➔ Tầng 4)
              </p>

              {[1, 2, 3, 4].map((fNum) => {
                const cfg = floorConfigs[fNum] || {
                  floor: fNum,
                  chatId: `-100214589230${fNum}`,
                  groupName: `KHO TẦNG ${fNum} - TỜI HÀNG`,
                  enabled: true,
                };

                return (
                  <div
                    key={fNum}
                    className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                        T{fNum}
                      </div>
                      <div className="space-y-0.5">
                        <input
                          type="text"
                          value={cfg.groupName}
                          onChange={(e) => updateFloorConfig(fNum, { groupName: e.target.value })}
                          className="font-extrabold text-sm text-slate-900 dark:text-white bg-transparent focus:outline-none focus:underline"
                        />
                        <p className="text-[11px] text-slate-400">Tự động nhận cảnh báo tời chuyển đến/đi Tầng {fNum}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="flex-1 md:w-64 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Telegram Chat ID</span>
                        <input
                          type="text"
                          value={cfg.chatId}
                          onChange={(e) => updateFloorConfig(fNum, { chatId: e.target.value })}
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <button
                        onClick={() => {
                          sendTelegramMessage({
                            chatId: cfg.chatId,
                            targetGroupLabel: cfg.groupName,
                            message: `🔔 <b>Thử nghiệm kết nối Telegram ${cfg.groupName} thành công!</b>`
                          });
                          toast.success(`Đã gửi tin test đến ${cfg.groupName}`);
                        }}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 mt-4 md:mt-0"
                      >
                        Test
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Automation Triggers Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 md:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Quy Tắc Tự Động Kích Hoạt Gửi Telegram (Auto-Triggers)
                  </h3>
                  <p className="text-xs text-slate-500">Tự động đẩy cảnh báo về điện thoại khi xảy ra sự kiện trong kho</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => toggleTrigger('autoSendUncollectedCargo')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${autoSendUncollectedCargo
                  ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                  }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      Cảnh Báo Tồn Hàng &gt;3 Phút
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Phát tin nhắn khẩn cấp tới nhóm tầng tương ứng khi tời cập bến mà chưa dỡ hàng
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoSendUncollectedCargo}
                  onChange={() => { }}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              <div
                onClick={() => toggleTrigger('autoSendUrgentJob')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${autoSendUrgentJob
                  ? 'bg-red-50/60 dark:bg-red-950/20 border-red-300 dark:border-red-800'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                  }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      Đơn Vận Chuyển Hỏa Tốc
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Phát tin nhắn cảnh báo ưu tiên cao ngay khi có nhân viên tạo đơn hỏa tốc
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoSendUrgentJob}
                  onChange={() => { }}
                  className="w-4 h-4 accent-red-500 rounded cursor-pointer"
                />
              </div>

              <div
                onClick={() => toggleTrigger('autoSendLiftArrival')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${autoSendLiftArrival
                  ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                  }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      Thông Báo Tời Cập Bến Tầng
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Gửi chuông Telegram báo hiệu cho đội kho nhận hàng sẵn sàng dỡ tải
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoSendLiftArrival}
                  onChange={() => { }}
                  className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                />
              </div>

              <div
                onClick={() => toggleTrigger('autoSendLiftMaintenance')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${autoSendLiftMaintenance
                  ? 'bg-purple-50/60 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                  }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-purple-500" />
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      Cảnh Báo Bảo Trì & Sự Cố Tời
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Phát tin nhắn thông báo cho Nhóm Kỹ Thuật khi tời tạm dừng hoặc hỏng hóc
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoSendLiftMaintenance}
                  onChange={() => { }}
                  className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Save All Settings Action Card */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl shadow-sm border border-slate-800">
            <div>
              <h4 className="text-sm font-extrabold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Lưu Trữ Cấu Hình Bền Vững
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">Tất cả thông tin Bot Token, Chat ID nhóm tầng và quy tắc sẽ được đồng bộ vào Database & lưu lại kể cả khi tải lại trang.</p>
            </div>
            <button
              onClick={async () => {
                await saveSettingsToDb();
                toast.success('Đã lưu toàn bộ cấu hình Telegram vào Database!');
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              Lưu Cấu Hình
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: DISPATCH LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 md:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ListFilter className="w-5 h-5 text-indigo-500" />
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Lịch Sử Dispatch Tin Nhắn Telegram
                </h3>
                <p className="text-xs text-slate-500">Theo dõi trạng thái gửi tin nhắn tới Telegram Bot API</p>
              </div>
            </div>

            <button
              onClick={() => {
                clearLogs();
                toast.info('Đã xóa toàn bộ nhật ký gửi tin nhắn!');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-950/40 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa Nhật Ký</span>
            </button>
          </div>

          <div className="space-y-3">
            {logs.length === 0 ? (
              <div className="p-12 text-center">
                <MessageCircle className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Chưa có tin nhắn nào được gửi</p>
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 rounded-lg text-xs font-bold">
                        {log.targetGroup}
                      </span>
                      <span className="text-xs font-mono text-slate-400">ID: {log.chatId}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400">{log.timestamp}</span>
                      {log.status === 'SUCCESS' ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Thành công
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Lỗi API
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className="text-xs font-mono text-slate-700 dark:text-slate-300 leading-relaxed pt-1"
                    dangerouslySetInnerHTML={{ __html: log.message.replace(/\n/g, '<br/>') }}
                  />

                  {log.telegramMessageId && (
                    <div className="text-[10px] text-slate-400 font-mono pt-1">
                      Telegram Msg ID: #{log.telegramMessageId}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}
