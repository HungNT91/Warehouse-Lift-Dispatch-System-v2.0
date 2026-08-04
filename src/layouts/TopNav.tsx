import { useState, useEffect } from "react";
import { format } from "date-fns";
import { 
  Bell, Menu, Moon, Sun, User as UserIcon, X, Volume2,
  Package, LogOut, Layers
} from "lucide-react";
import { useTheme } from "../components/ThemeProvider";
import { useAuthStore } from "../stores/useAuthStore";
import { useLiftStore } from "../stores/useLiftStore";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import { getSupabase } from "../api/supabase";
import { isSupabaseConfigured } from "../api/dbClient";
import { speakLiftArrival } from "../utils/audio";
import { toast } from "sonner";
import { getNavItemsForRole } from "../config/navigation";

export function TopNav() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user, assignment, logout } = useAuthStore();
  const { lifts, syncStatus, lastSyncedAt } = useLiftStore();

  const syncConfig = {
    realtime: {
      dot: 'bg-green-500 animate-pulse',
      text: 'text-green-700 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/30',
      label: 'REALTIME',
      labelMobile: 'LIVE',
    },
    polling: {
      dot: 'bg-amber-500 animate-pulse',
      text: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/30',
      label: 'ĐANG ĐỒNG BỘ',
      labelMobile: 'ĐỒNG BỘ',
    },
    connecting: {
      dot: 'bg-blue-400 animate-pulse',
      text: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/30',
      label: 'ĐANG KẾT NỐI…',
      labelMobile: 'KẾT NỐI',
    },
    offline: {
      dot: 'bg-red-500',
      text: 'text-red-700 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/30',
      label: 'NGOẠI TUYẾN',
      labelMobile: 'OFFLINE',
    },
  } as const;

  const sc = syncConfig[syncStatus] ?? syncConfig.connecting;

  const lastSyncLabel = lastSyncedAt
    ? lastSyncedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;
  const location = useLocation();

  const navItems = getNavItemsForRole(user?.role);
  const assignedLift = lifts.find(l => l.id === assignment?.lift_id);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    try {
      // Luôn reset state trong store trước (bao gồm cả persisted state)
      logout();
      // Sau đó mới đăng xuất Supabase nếu có kết nối
      if (isSupabaseConfigured()) {
        const supabase = getSupabase();
        await supabase.auth.signOut();
      }
      toast.success("Đã đăng xuất thành công!");
    } catch (e) {
      console.error(e);
      // Ngay cả khi lỗi, vẫn đã reset state rồi nên trang sẽ chuyển về login
    }
  };

  return (
    <>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button 
            className="lg:hidden text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 p-1 -ml-1" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <h1 className="text-lg font-bold text-slate-800 dark:text-white hidden md:block">W.L.D.S</h1>
          <div
            title={lastSyncLabel ? `Đồng bộ lần cuối: ${lastSyncLabel}` : 'Đang kết nối…'}
            className={`flex items-center gap-2 px-3 py-1 ${sc.bg} rounded-full cursor-default transition-colors duration-500`}
          >
            <div className={`w-2 h-2 rounded-full ${sc.dot}`}></div>
            <span className={`text-[11px] font-bold ${sc.text} hidden sm:inline`}>{sc.label}</span>
            <span className={`text-[11px] font-bold ${sc.text} sm:hidden`}>{sc.labelMobile}</span>
            {lastSyncLabel && (
              <span className={`text-[10px] font-mono ${sc.text} opacity-70 hidden lg:inline`}>{lastSyncLabel}</span>
            )}
          </div>


          {/* Worker Assignment Badge */}
          {assignment && (
            <Link 
              to="/assignment" 
              className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-extrabold text-blue-700 dark:text-blue-300 transition-colors"
              title="Nhấp để đổi thang/tầng phụ trách"
            >
              <Package className="w-3.5 h-3.5 text-blue-600" />
              <span>{assignedLift ? assignedLift.lift_number.replace('Lift ', 'Tời ') : 'Tời'}</span>
              <span className="text-blue-400 dark:text-blue-500">•</span>
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Tầng {assignment.assigned_floor || 1}</span>
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase">{format(currentTime, "dd/MM/yyyy | HH:mm:ss")}</p>
          </div>
          
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="relative p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {user?.role === 'Worker' && (
            <button 
              onClick={() => {
                speakLiftArrival('Thang P1', 4);
                toast.success("🔔 Đã thử nghiệm giọng nói thông báo thang cập bến!");
              }}
              title="Thử âm thanh giọng nói thông báo khi đến tầng"
              className="relative p-2 text-slate-400 hover:text-amber-500 transition-colors cursor-pointer"
            >
              <Volume2 className="w-5 h-5 text-amber-500 animate-pulse" />
            </button>
          )}

          <button className="relative p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          <div className="flex items-center gap-2 pl-4 border-l border-slate-200 dark:border-slate-700 hidden md:flex">
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <UserIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{user?.full_name || 'Tài khoản'}</p>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{user?.role || 'User'}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-16 left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xl z-20 flex flex-col max-h-[calc(100dvh-4rem)] overflow-y-auto animate-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border border-blue-200 dark:border-blue-800 shrink-0">
              <UserIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.full_name || 'Tài khoản'}</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{user?.role || 'User'}</p>
            </div>
          </div>
          <nav className="flex-1 p-2 flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm transition-colors duration-200",
                    isActive 
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold" 
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <button 
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full py-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl transition-colors font-bold text-sm"
            >
              <LogOut className="w-4 h-4" />
              Đăng Xuất
            </button>
          </div>
        </div>
      )}
    </>
  );
}
