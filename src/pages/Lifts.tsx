import { useState } from 'react';
import { useLiftStore } from '../stores/useLiftStore';
import { useAuthStore } from '../stores/useAuthStore';
import { 
  Server, 
  Search, 
  Lock, 
  Unlock, 
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Play,
  Settings2,
  X
} from 'lucide-react';
import { LiftStatus, Lift } from '../types';

export function Lifts() {
  const { lifts, updateLift } = useLiftStore();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingLift, setEditingLift] = useState<Lift | null>(null);
  const [selectedFloors, setSelectedFloors] = useState<number[]>([]);

  const canManage = user?.role === 'Admin' || user?.role === 'Supervisor';

  const filteredLifts = lifts.filter(lift => 
    lift.lift_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: LiftStatus) => {
    switch(status) {
      case 'AVAILABLE': return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">SẴN SÀNG</span>;
      case 'WAITING_PICKUP': return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">CHỜ LẤY HÀNG</span>;
      case 'MOVING': return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">DI CHUYỂN</span>;
      case 'RESERVED': return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">ĐÃ ĐẶT</span>;
      case 'LOCKED': return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">ĐÃ KHÓA</span>;
      case 'OFFLINE': return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">NGOẠI TUYẾN</span>;
      case 'MAINTENANCE': return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300">BẢO TRÌ</span>;
      default: return null;
    }
  };

  const handleToggleLock = (id: string, currentStatus: LiftStatus) => {
    if (currentStatus === 'LOCKED') {
      updateLift(id, { status: 'AVAILABLE' });
    } else {
      updateLift(id, { status: 'LOCKED' });
    }
  };

  const handleToggleMaintenance = (id: string, currentStatus: LiftStatus) => {
    if (currentStatus === 'MAINTENANCE') {
      updateLift(id, { status: 'AVAILABLE' });
    } else {
      updateLift(id, { status: 'MAINTENANCE' });
    }
  };

  const handleOpenSettings = (lift: Lift) => {
    setEditingLift(lift);
    setSelectedFloors(lift.allowed_floors || [1, 2, 3, 4]);
  };

  const handleToggleFloor = (floor: number) => {
    if (selectedFloors.includes(floor)) {
      setSelectedFloors(selectedFloors.filter(f => f !== floor));
    } else {
      setSelectedFloors([...selectedFloors, floor].sort());
    }
  };

  const handleSaveSettings = () => {
    if (editingLift) {
      updateLift(editingLift.id, { allowed_floors: selectedFloors });
      setEditingLift(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 md:gap-8 pb-12 w-full max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl text-slate-900 dark:text-white">Chi Tiết Giám Sát Tời</h1>
            <p className="text-xs font-medium text-slate-500">Quản lý trạng thái và điều khiển thiết bị</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm tên tời..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white sm:text-sm transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col w-full">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto w-full">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Thiết Bị
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Trạng Thái
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Vị Trí
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Thông Tin
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
                {filteredLifts.map((lift) => (
                  <tr key={lift.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${
                            lift.status === 'AVAILABLE' ? 'bg-green-50 border-green-200 text-green-600 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400' :
                            lift.status === 'MOVING' ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400' :
                            lift.status === 'WAITING_PICKUP' ? 'bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400' :
                            lift.status === 'MAINTENANCE' || lift.status === 'OFFLINE' ? 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700' :
                            'bg-purple-50 border-purple-200 text-purple-600 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-400'
                          }`}>
                            <Server className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-slate-900 dark:text-white uppercase">
                            {lift.lift_number}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            ID: {lift.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(lift.status)}
                      {lift.status === 'MOVING' && (
                        <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                          <div className="h-full bg-blue-500 transition-all duration-1000 ease-linear" style={{ width: `${lift.progress}%` }}></div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        Tầng {lift.current_floor} {lift.destination_floor ? `→ Tầng ${lift.destination_floor}` : ''}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {lift.status === 'MOVING' ? 'Đang di chuyển' : 'Đang dừng'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-white">
                        {lift.current_job_id ? `Việc #${lift.current_job_id}` : (lift.operator ? `NV: ${lift.operator}` : 'Rảnh')}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Cập nhật: {lift.last_update}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {canManage && (
                          <>
                            <button 
                              onClick={() => handleToggleLock(lift.id, lift.status)}
                              className={`p-2 rounded-lg transition-colors border ${
                                lift.status === 'LOCKED' 
                                  ? 'bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-400' 
                                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'
                              }`}
                              title={lift.status === 'LOCKED' ? 'Mở Khóa' : 'Khóa'}
                            >
                              {lift.status === 'LOCKED' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => handleToggleMaintenance(lift.id, lift.status)}
                              className={`p-2 rounded-lg transition-colors border ${
                                lift.status === 'MAINTENANCE' 
                                  ? 'bg-slate-200 border-slate-300 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300' 
                                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'
                              }`}
                              title={lift.status === 'MAINTENANCE' ? 'Kết Thúc Bảo Trì' : 'Bảo Trì'}
                            >
                              {lift.status === 'MAINTENANCE' ? <Play className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => handleOpenSettings(lift)}
                              className="p-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              title="Cài Đặt Tầng"
                            >
                              <Settings2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button 
                          className="p-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          title="Cảnh Báo"
                        >
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden flex flex-col divide-y divide-slate-200 dark:divide-slate-800 w-full overflow-y-auto">
          {filteredLifts.map((lift) => (
            <div key={lift.id} className="p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${
                    lift.status === 'AVAILABLE' ? 'bg-green-50 border-green-200 text-green-600 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400' :
                    lift.status === 'MOVING' ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400' :
                    lift.status === 'WAITING_PICKUP' ? 'bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400' :
                    lift.status === 'MAINTENANCE' || lift.status === 'OFFLINE' ? 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700' :
                    'bg-purple-50 border-purple-200 text-purple-600 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-400'
                  }`}>
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white uppercase">{lift.lift_number}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">ID: {lift.id}</div>
                  </div>
                </div>
                <div className="text-right">
                  {getStatusBadge(lift.status)}
                </div>
              </div>
              
              {lift.status === 'MOVING' && (
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-1000 ease-linear" style={{ width: `${lift.progress}%` }}></div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Vị Trí</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    Tầng {lift.current_floor} {lift.destination_floor ? `→ ${lift.destination_floor}` : ''}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {lift.status === 'MOVING' ? 'Đang di chuyển' : 'Đang dừng'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Trạng Thái</div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white mt-0.5 truncate">
                    {lift.current_job_id ? `Việc #${lift.current_job_id}` : (lift.operator ? `NV: ${lift.operator}` : 'Rảnh')}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {lift.last_update}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-1">
                {canManage && (
                  <>
                    <button 
                      onClick={() => handleToggleLock(lift.id, lift.status)}
                      className={`p-2 rounded-lg transition-colors border ${
                        lift.status === 'LOCKED' 
                          ? 'bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-400' 
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'
                      }`}
                      title={lift.status === 'LOCKED' ? 'Mở Khóa' : 'Khóa'}
                    >
                      {lift.status === 'LOCKED' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => handleToggleMaintenance(lift.id, lift.status)}
                      className={`p-2 rounded-lg transition-colors border ${
                        lift.status === 'MAINTENANCE' 
                          ? 'bg-slate-200 border-slate-300 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300' 
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'
                      }`}
                      title={lift.status === 'MAINTENANCE' ? 'Kết Thúc Bảo Trì' : 'Bảo Trì'}
                    >
                      {lift.status === 'MAINTENANCE' ? <Play className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => handleOpenSettings(lift)}
                      className="p-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Cài Đặt Tầng"
                    >
                      <Settings2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button 
                  className="p-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Cảnh Báo"
                >
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredLifts.length === 0 && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            Không tìm thấy thiết bị nào phù hợp.
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {editingLift && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Giới Hạn Tầng Hoạt Động</h3>
              <button 
                onClick={() => setEditingLift(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Chọn các tầng mà tời <strong>{editingLift.lift_number}</strong> được phép di chuyển đến:
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map(floor => (
                  <button
                    key={floor}
                    onClick={() => handleToggleFloor(floor)}
                    className={`py-3 rounded-xl border-2 font-bold transition-colors ${
                      selectedFloors.includes(floor)
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600'
                    }`}
                  >
                    Tầng {floor}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button 
                onClick={() => setEditingLift(null)}
                className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={handleSaveSettings}
                className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-200 dark:shadow-blue-900/20 transition-colors"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
