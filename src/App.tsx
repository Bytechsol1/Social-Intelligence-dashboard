import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Youtube,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  Settings,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Zap,
  Target,
  BarChart3
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- COMPONENTS ---

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white border border-slate-200 rounded-2xl p-6 shadow-sm", className)}>
    {children}
  </div>
);

const StatCard = ({ title, value, icon: Icon, delta, unit = "" }: any) => (
  <Card className="flex flex-col gap-4">
    <div className="flex justify-between items-start">
      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
        <Icon className="w-5 h-5 text-slate-600" />
      </div>
      {delta !== undefined && (
        <span className={cn(
          "text-xs font-semibold px-2 py-1 rounded-full",
          delta > 0 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100"
        )}>
          {delta > 0 ? "+" : ""}{delta}%
        </span>
      )}
    </div>
    <div>
      <p className="text-slate-500 text-sm font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900 mt-1">
        {unit}{value.toLocaleString()}
      </h3>
    </div>
  </Card>
);

export default function App() {
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [manychatKey, setManychatKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const fetchData = async () => {
    try {
      const [dashRes, statusRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/status')
      ]);
      setData(await dashRes.json());
      setStatus(await statusRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleOAuth = (e: MessageEvent) => {
      if (e.data?.type === 'OAUTH_SUCCESS') fetchData();
    };
    window.addEventListener('message', handleOAuth);
    return () => window.removeEventListener('message', handleOAuth);
  }, []);

  const connectYoutube = async () => {
    const res = await fetch('/api/auth/youtube/url');
    const { url } = await res.json();
    window.open(url, 'youtube_auth', 'width=600,height=700');
  };

  const saveManychat = async () => {
    await fetch('/api/auth/manychat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: manychatKey })
    });
    fetchData();
    setManychatKey("");
  };

  const triggerSync = async () => {
    setSyncing(true);
    await fetch('/api/sync', { method: 'POST' });
    await fetchData();
    setSyncing(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-slate-200">
      {/* Sidebar Navigation */}
      <nav className="fixed left-0 top-0 bottom-0 w-20 border-r border-slate-200 flex flex-col items-center py-8 gap-8 bg-white z-50">
        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shadow-slate-200">
          <TrendingUp className="text-white w-6 h-6" />
        </div>
        <div className="flex flex-col gap-6">
          <button onClick={() => setShowSettings(false)} className={cn("p-3 rounded-xl transition-all duration-200", !showSettings ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-900 hover:bg-slate-50")}>
            <LayoutDashboard className="w-6 h-6" />
          </button>
          <button onClick={() => setShowSettings(true)} className={cn("p-3 rounded-xl transition-all duration-200", showSettings ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-900 hover:bg-slate-50")}>
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pl-20 min-h-screen">
        <header className="h-20 border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 bg-white/80 backdrop-blur-md z-40">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Social Intelligence</h1>
            <p className="text-xs text-slate-500 font-medium">Analytics & Growth Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={triggerSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95"
            >
              <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-8">
          {!showSettings ? (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="All-Time Views" value={data?.summary?.total_views || 0} icon={Youtube} delta={12} />
                <StatCard title="Est. Revenue (30d)" value={data?.summary?.revenue || 0} icon={DollarSign} unit="$" delta={8} />
                <StatCard title="Total Subscribers" value={data?.summary?.subscribers || 0} icon={Users} delta={2} />
                <StatCard title="ManyChat Contacts" value={data?.summary?.manychat_subs || 0} icon={MessageSquare} delta={5} />
              </div>

              {/* Bento Grid Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900">Performance Overview</h3>
                        {data?.chartData?.length === 0 && status?.youtube && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold uppercase tracking-tighter">
                            <Clock className="w-3 h-3" />
                            Data Pending (48h delay)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">Daily channel growth metrics</p>
                    </div>
                    <select className="bg-slate-50 border border-slate-200 text-xs font-semibold rounded-lg px-3 py-1.5 outline-none focus:ring-2 ring-slate-100">
                      <option>Last 30 Days</option>
                      <option>Last 90 Days</option>
                    </select>
                  </div>
                  <div className="h-[320px] w-full" style={{ minHeight: 0 }}>
                    {data?.chartData?.length > 0 ? (
                      <ResponsiveContainer width="100%" height={320}>
                        <AreaChart data={data?.chartData}>
                          <defs>
                            <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0f172a" stopOpacity={0.05} />
                              <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                          <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                          />
                          <Area type="monotone" dataKey="youtube_views" stroke="#0f172a" strokeWidth={2} fillOpacity={1} fill="url(#colorViews)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                        <BarChart3 className="w-8 h-8 opacity-20" />
                        <p className="text-xs font-medium">
                          {status?.youtube ? "Historical data is being processed by Google..." : "Connect YouTube to see growth data"}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>

                <div className="space-y-6">
                  <Card className="bg-slate-900 text-white border-none shadow-xl shadow-slate-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-white/10 rounded-lg">
                        <Zap className="w-5 h-5 text-yellow-400" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Automation</span>
                    </div>
                    <h3 className="text-3xl font-bold">{data?.summary?.active_widgets || 0}</h3>
                    <p className="text-sm text-slate-400 font-medium">Active ManyChat Widgets</p>
                    <div className="mt-6 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-400" style={{ width: '65%' }}></div>
                    </div>
                  </Card>

                  <Card className="bg-emerald-600 text-white border-none shadow-xl shadow-emerald-100">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-white/10 rounded-lg">
                        <Target className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Conversion</span>
                    </div>
                    <h3 className="text-3xl font-bold">{data?.summary?.conversion_rate || 0}%</h3>
                    <p className="text-sm text-emerald-100 font-medium">Lead Conversion Rate</p>
                    <p className="text-[10px] text-emerald-200 mt-4">Based on "Lead" & "Conversion" tags</p>
                  </Card>
                </div>
              </div>

              {/* Detailed YouTube Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Youtube className="w-3 h-3" /> 30d Views</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{data?.summary?.recent_views || 0}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">30d Likes</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{data?.summary?.recent_likes || 0}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">30d Comments</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{data?.summary?.recent_comments || 0}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">30d Shares</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{data?.summary?.recent_shares || 0}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Videos</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{data?.summary?.total_videos || 0}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-emerald-500">Subscribers</p>
                  <p className="text-xl font-bold text-emerald-600 mt-1">{data?.summary?.subscribers || 0}</p>
                </div>
              </div>


              {/* Detailed ManyChat Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tags</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{data?.summary?.total_tags || 0}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custom Fields</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{data?.summary?.total_custom_fields || 0}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bot Fields</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{data?.summary?.total_bot_fields || 0}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Growth Tools</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{data?.summary?.active_growth_tools || 0}/{data?.summary?.total_growth_tools || 0}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Flows</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{data?.summary?.total_flows || 0}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Widgets</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{data?.summary?.active_widgets || 0}</p>
                </div>
              </div>

              {/* ManyChat Analytics Section */}
              {data?.automations?.length > 0 && (() => {
                // Derive month-based chart data from flow IDs (encoded as content{YYYYMMDD}...)
                const monthCounts: Record<string, number> = {};
                data.automations.forEach((a: any) => {
                  const match = a.id.match(/content(\d{4})(\d{2})\d{2}/);
                  if (match) {
                    const label = `${match[1]}-${match[2]}`;
                    monthCounts[label] = (monthCounts[label] || 0) + 1;
                  }
                });
                const flowChartData = Object.entries(monthCounts)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([month, count]) => ({ month, flows: count }));

                const namePrefixes: Record<string, number> = {};
                data.automations.forEach((a: any) => {
                  const prefix = a.name.split(':')[0]?.trim() || 'Other';
                  namePrefixes[prefix] = (namePrefixes[prefix] || 0) + 1;
                });
                const topCategories = Object.entries(namePrefixes)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5);

                return (
                  <>
                    {/* Chart + Full list */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left: Bar Chart + Stats */}
                      <div className="lg:col-span-1 space-y-4">
                        <Card>
                          <h3 className="font-bold text-slate-900 mb-1">Flows by Month</h3>
                          <p className="text-xs text-slate-400 mb-4">When automations were created</p>
                          {flowChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={180}>
                              <BarChart data={flowChartData} barSize={14}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="month" fontSize={9} tickLine={false} axisLine={false} />
                                <YAxis fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: 12 }}
                                  cursor={{ fill: '#f8fafc' }}
                                />
                                <Bar dataKey="flows" fill="#6366f1" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-[180px] flex items-center justify-center text-slate-300 text-xs">No date data found</div>
                          )}
                        </Card>

                        <Card>
                          <h3 className="font-bold text-slate-900 mb-3">Top Flow Series</h3>
                          <div className="space-y-2">
                            {topCategories.map(([name, count]) => (
                              <div key={name} className="flex items-center gap-3">
                                <div className="flex-1">
                                  <div className="flex justify-between mb-1">
                                    <span className="text-xs font-medium text-slate-700 truncate max-w-[120px]">{name}</span>
                                    <span className="text-xs font-bold text-indigo-600">{count}</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-indigo-500 rounded-full transition-all"
                                      style={{ width: `${(count / data.automations.length) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      </div>

                      {/* Right: Full list */}
                      <Card className="lg:col-span-2 p-0 overflow-hidden">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
                          <div>
                            <h3 className="font-bold text-slate-900">All ManyChat Flows</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Full list of synced automations</p>
                          </div>
                          <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full">{data.automations.length} total</span>
                        </div>
                        <div className="overflow-y-auto" style={{ maxHeight: '460px' }}>
                          <div className="divide-y divide-slate-50">
                            {data.automations.map((auto: any, idx: number) => (
                              <div key={auto.id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors group">
                                <span className="text-xs font-bold text-slate-300 w-5 shrink-0 text-right">{idx + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors truncate">{auto.name}</p>
                                  <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{auto.id}</p>
                                </div>
                                <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 uppercase tracking-wide">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                  {auto.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    </div>
                  </>
                );
              })()}



              {/* ManyChat Status + Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="flex flex-col justify-center items-center text-center space-y-4 bg-indigo-50 border-indigo-100">
                  <div className="p-4 bg-white rounded-2xl shadow-sm">
                    <MessageSquare className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">ManyChat Status</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {status?.manychat ? "Connected & Syncing" : "Not Connected"}
                    </p>
                  </div>
                  {!status?.manychat && (
                    <button onClick={() => setShowSettings(true)} className="text-xs font-bold text-indigo-600 hover:underline">
                      Connect API Key
                    </button>
                  )}
                </Card>

                <Card>
                  <h3 className="font-bold text-slate-900 mb-6">Recent Activity</h3>
                  <div className="space-y-4">
                    {data?.logs?.slice(0, 3).map((log: any) => (
                      <div key={log.id} className="flex gap-3 items-start">
                        <div className={cn(
                          "mt-1 p-1 rounded-full",
                          log.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                        )}>
                          {log.status === 'COMPLETED' ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-800 uppercase tracking-tight">{log.status}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{log.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

            </>
          ) : (

            <div className="max-w-2xl space-y-8">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">Connections</h2>
                <p className="text-slate-500 mt-2">Manage your third-party integrations and API credentials.</p>
              </div>

              <Card className="divide-y divide-slate-100 p-0 overflow-hidden">
                <div className="p-8 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                      <Youtube className="w-7 h-7 text-rose-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">YouTube Analytics</h4>
                      <p className="text-sm text-slate-500 mt-0.5">Sync views, revenue, and subscriber data.</p>
                    </div>
                  </div>
                  {status?.youtube ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Connected
                    </div>
                  ) : (
                    <button onClick={connectYoutube} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-sm active:scale-95">
                      Connect
                    </button>
                  )}
                </div>

                <div className="p-8 space-y-6 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <MessageSquare className="w-7 h-7 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">ManyChat API</h4>
                      <p className="text-sm text-slate-500 mt-0.5">Track automation metrics and subscriber growth.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="password"
                      placeholder="ManyChat API Key"
                      value={manychatKey}
                      onChange={(e) => setManychatKey(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm focus:ring-4 ring-slate-100 outline-none transition-all placeholder:text-slate-400"
                    />
                    <button onClick={saveManychat} className="px-6 py-3 bg-slate-100 text-slate-900 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all active:scale-95">
                      Save Key
                    </button>
                  </div>
                  {status?.manychat && (
                    <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> API Key Verified & Encrypted
                    </p>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      </main >
    </div >
  );
}
