import React, { useState } from 'react';
import { Search, Wrench, Globe, Unlock, ShieldAlert, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Lockdown404ViewProps {
    onUnlock?: () => void;
}

export function Lockdown404View({ onUnlock }: Lockdown404ViewProps) {
    const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
    const [pin, setPin] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleUnlockSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Allow master pin 123456 or empty/admin direct unlock
        setIsSubmitting(true);
        setErrorMsg(null);
        try {
            const res = await fetch('/api/system/lockdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isLocked: false, lockedBy: 'Mở khóa Khai thác Web (Admin UI)' })
            });

            const data = await res.json();
            if (data.success) {
                toast.success('✅ ĐÃ KHÔI PHỤC HỆ THỐNG THÀNH CÔNG!');
                setIsUnlockModalOpen(false);
                if (onUnlock) onUnlock();
            } else {
                setErrorMsg('Không thể mở khóa hệ thống. Vui lòng thử lại!');
            }
        } catch (err) {
            setErrorMsg('Lỗi kết nối tới Server. Vui lòng kiểm tra lại!');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-[#f2f7fd] dark:bg-slate-950 flex flex-col items-center justify-center p-6 select-none overflow-hidden">
            {/* Background mountains / landscape abstract shapes */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-50">
                <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-sky-200/70 dark:from-sky-950/40 to-transparent rounded-t-[120%] transform scale-125" />
                <div className="absolute bottom-0 left-1/4 w-[500px] h-72 bg-sky-100 dark:bg-slate-900 rounded-t-full" />
                <div className="absolute bottom-0 right-1/4 w-[600px] h-80 bg-blue-100/70 dark:bg-slate-900/70 rounded-t-full" />
            </div>

            <div className="max-w-3xl w-full text-center space-y-6 relative z-10 flex flex-col items-center">
                {/* Status Alert Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-full text-xs font-black uppercase tracking-wider shadow-sm animate-pulse">
                    <ShieldAlert className="w-4 h-4" />
                    🚨 HỆ THỐNG ĐANG BỊ KHÓA KHẨN CẤP (GLOBAL LOCKDOWN)
                </div>

                {/* Main 404 Visual Illustration Container */}
                <div className="relative py-8 flex items-center justify-center w-full">
                    {/* Globe in the sky */}
                    <div className="absolute top-2 right-16 w-20 h-20 rounded-full bg-sky-200/90 dark:bg-sky-900/50 border border-sky-300 dark:border-sky-700 flex items-center justify-center text-sky-600 dark:text-sky-300 shadow-sm animate-pulse">
                        <Globe className="w-11 h-11 stroke-[1.5]" />
                    </div>

                    {/* Speech bubble "oops" */}
                    <div className="absolute top-4 left-24 bg-white dark:bg-slate-800 px-4 py-1.5 rounded-3xl shadow-sm border border-sky-100 dark:border-slate-700 text-sky-500 dark:text-sky-300 text-xs font-bold tracking-wider animate-bounce">
                        oops! locked
                    </div>

                    {/* Speech bubble "lockdown" */}
                    <div className="absolute top-6 right-36 bg-white dark:bg-slate-800 px-4 py-1.5 rounded-3xl shadow-sm border border-sky-100 dark:border-slate-700 text-sky-500 dark:text-sky-300 text-xs font-bold tracking-wider">
                        locked down
                    </div>

                    {/* Giant 404 Numbers */}
                    <div className="flex items-center justify-center gap-3 select-none">
                        <span className="text-9xl md:text-[13rem] font-black text-blue-600 dark:text-blue-500 tracking-tighter drop-shadow-lg font-mono leading-none">
                            4
                        </span>

                        <div className="relative flex items-center justify-center">
                            <span className="text-8xl md:text-9xl font-black text-blue-600 dark:text-blue-500 tracking-tighter drop-shadow-md font-mono">
                                0
                            </span>
                            <div className="absolute -left-8 bottom-3 flex flex-col items-center">
                                <div className="w-4 h-4 rounded-full bg-sky-700 mb-0.5 shadow-xs" />
                                <div className="w-6 h-10 bg-blue-600 rounded-t-xl flex items-center justify-center shadow-sm">
                                    <Search className="w-3.5 h-3.5 text-white" />
                                </div>
                            </div>
                        </div>

                        <span className="text-9xl md:text-[13rem] font-black text-blue-600 dark:text-blue-500 tracking-tighter drop-shadow-lg font-mono leading-none">
                            4
                        </span>
                    </div>

                    <div className="absolute bottom-3 right-32 flex items-center gap-1.5">
                        <div className="flex flex-col items-center">
                            <div className="w-3.5 h-3.5 rounded-full bg-sky-700 mb-0.5 shadow-xs" />
                            <div className="w-5 h-9 bg-blue-600 rounded-t-xl shadow-sm" />
                        </div>
                        <Wrench className="w-6 h-6 text-sky-700 transform -rotate-45" />
                    </div>
                </div>

                {/* Subtitle text */}
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                    Toàn bộ thao tác ứng dụng đã bị tạm dừng để bảo mật. Bạn có thể nhắn lệnh <code className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">mở</code> hoặc <code className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">/restore</code> qua Telegram Bot, hoặc mở khóa trực tiếp bên dưới.
                </p>

                {/* Admin Unlock Action Button */}
                <div className="pt-2">
                    <button
                        onClick={() => setIsUnlockModalOpen(true)}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer transition-all"
                    >
                        <Unlock className="w-4 h-4" />
                        <span>MỞ KHÓA KHÔI PHỤC HỆ THỐNG</span>
                    </button>
                </div>
            </div>

            {/* Unlock Confirmation Modal */}
            {isUnlockModalOpen && (
                <div className="fixed inset-0 z-[100000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                                <KeyRound className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                    Xác Nhận Mở Khóa Hệ Thống
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Khôi phục hoạt động cho ứng dụng W.L.D.S trên mọi thiết bị.
                                </p>
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {errorMsg}
                            </div>
                        )}

                        <form onSubmit={handleUnlockSubmit} className="space-y-4">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs text-slate-600 dark:text-slate-300 leading-relaxed border border-slate-100 dark:border-slate-800">
                                Bấm <b>"Mở Khóa Ngay"</b> để hủy kích hoạt chế độ Khóa Khẩn Cấp và khôi phục ứng dụng về trạng thái hoạt động bình thường.
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsUnlockModalOpen(false)}
                                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                                >
                                    Hủy bỏ
                                </button>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    <span>Mở Khóa Ngay</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
