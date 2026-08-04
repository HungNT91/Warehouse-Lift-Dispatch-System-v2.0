import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from 'recharts';
import { Calendar, Download } from 'lucide-react';

const hourlyData = [
  { time: '08:00', jobs: 12, waitTime: 4 },
  { time: '09:00', jobs: 24, waitTime: 6 },
  { time: '10:00', jobs: 35, waitTime: 8 },
  { time: '11:00', jobs: 42, waitTime: 12 },
  { time: '12:00', jobs: 28, waitTime: 5 },
  { time: '13:00', jobs: 33, waitTime: 7 },
  { time: '14:00', jobs: 45, waitTime: 15 },
  { time: '15:00', jobs: 38, waitTime: 9 },
  { time: '16:00', jobs: 25, waitTime: 5 },
];

const floorData = [
  { name: 'Tầng 1', active: 120, delayed: 14 },
  { name: 'Tầng 2', active: 85, delayed: 5 },
  { name: 'Tầng 3', active: 94, delayed: 8 },
  { name: 'Tầng 4', active: 110, delayed: 12 },
];

export function Reports() {
  return (
    <div className="flex flex-col gap-6 md:gap-8 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-slate-900 dark:text-white">Báo Cáo Hiệu Suất</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base mt-1">Phân tích và dữ liệu lịch sử cho hoạt động kho</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-sm whitespace-nowrap">
            <Calendar className="w-5 h-5" /> Hôm Nay
          </button>
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors shadow-sm shadow-blue-200 dark:shadow-blue-900/20 text-sm whitespace-nowrap">
            <Download className="w-4 h-4" /> Xuất CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
        {/* Hourly Jobs Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 md:p-6 flex flex-col h-[400px]">
          <div className="mb-6">
            <h3 className="font-display font-bold text-base md:text-lg text-slate-900 dark:text-white">Khối Lượng Vận Chuyển Theo Giờ</h3>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Tổng số việc xử lý mỗi giờ</p>
          </div>
          <div className="flex-1 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorJobs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#fff' }}
                  itemStyle={{ fontWeight: 600 }}
                  labelStyle={{ color: '#64748B' }}
                />
                <Area type="monotone" dataKey="jobs" name="Số Việc" stroke="#2563EB" strokeWidth={3} fillOpacity={1} fill="url(#colorJobs)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Floor Activity */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 md:p-6 flex flex-col h-[400px]">
          <div className="mb-6">
            <h3 className="font-display font-bold text-base md:text-lg text-slate-900 dark:text-white">Phân Bổ Hoạt Động Theo Tầng</h3>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Việc hoàn thành so với chậm trễ</p>
          </div>
          <div className="flex-1 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={floorData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#fff' }}
                  cursor={{fill: '#F8FAFC'}}
                  labelStyle={{ color: '#64748B' }}
                />
                <Bar dataKey="active" name="Hoàn Thành" fill="#16A34A" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="delayed" name="Chậm Trễ" fill="#DC2626" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Wait Time Trend */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 md:p-6 flex flex-col h-[400px]">
          <div className="mb-6">
            <h3 className="font-display font-bold text-base md:text-lg text-slate-900 dark:text-white">Xu Hướng Thời Gian Chờ (Phút)</h3>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Theo dõi trên tất cả các tầng trong ngày làm việc</p>
          </div>
          <div className="flex-1 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 600, color: '#F59E0B' }}
                  labelStyle={{ color: '#64748B' }}
                />
                <Line type="monotone" dataKey="waitTime" name="Thời Gian Chờ (p)" stroke="#F59E0B" strokeWidth={3} dot={{r: 4, strokeWidth: 2, fill: '#fff'}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
