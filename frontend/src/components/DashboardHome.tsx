"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface DashboardHomeProps {
  token: string;
  onNavigate: (page: string) => void;
}

interface Summary {
  incidents_mtd: number;
  open_capas: number;
  overdue_capas: number;
  framework_coverage_pct: number;
}

interface IncidentWeek {
  week: string;
  count: number;
}

interface CapaStatus {
  status: string;
  count: number;
}

interface FrameworkCoverage {
  framework_tier: string;
  framework_category: string;
  framework_series: string;
  coverage_status: string;
  chunk_count: number;
  gaps?: string[];
  ai_reasoning?: string;
}

interface RecentActivityItem {
  type: "incident" | "capa";
  reference: string;
  title: string;
  timestamp: string;
}

const CAPA_COLORS: Record<string, string> = {
  open: "#3b82f6",
  in_progress: "#f59e0b",
  overdue: "#ef4444",
  closed: "#22c55e",
};

const COVERAGE_COLORS: Record<string, string> = {
  covered: "#22c55e",
  partial: "#f59e0b",
  gap: "#ef4444",
};

const TIER_LABELS: Record<string, string> = {
  "1": "Tier 1 — Policy",
  "2": "Tier 2 — Systems Manual",
  "3": "Tier 3 — Standards",
};

const SERIES_LABELS: Record<string, string> = {
  "100": "100s — Management",
  "200": "200s — Risk",
  "300": "300s — Programs",
  "400": "400s — Business Resilience",
};

function formatWeekLabel(week: string): string {
  try {
    const d = new Date(week);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return week;
  }
}

function formatCapaStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

export default function DashboardHome({ token, onNavigate }: DashboardHomeProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [incidentsOverTime, setIncidentsOverTime] = useState<IncidentWeek[]>([]);
  const [capaStatus, setCapaStatus] = useState<CapaStatus[]>([]);
  const [frameworkCoverage, setFrameworkCoverage] = useState<FrameworkCoverage[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<FrameworkCoverage | null>(null);

  useEffect(() => {
    Promise.all([
      api<Summary>("/api/dashboard/summary", { token }),
      api<IncidentWeek[]>("/api/dashboard/incidents-over-time", { token }),
      api<CapaStatus[]>("/api/dashboard/capa-status", { token }),
      api<FrameworkCoverage[]>("/api/dashboard/framework-coverage", { token }),
      api<RecentActivityItem[]>("/api/dashboard/recent-activity", { token }).catch(() => []),
    ])
      .then(([s, incidents, capas, coverage, activity]) => {
        setSummary(s);
        setIncidentsOverTime(incidents);
        setCapaStatus(capas);
        setFrameworkCoverage(coverage);
        setRecentActivity(activity);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <div className="text-gray-400">Loading dashboard...</div>;
  }

  // CAPA closure rate
  const totalCapas = capaStatus.reduce((sum, s) => sum + s.count, 0);
  const closedCapas = capaStatus.find((s) => s.status === "closed")?.count ?? 0;
  const closureRate = totalCapas > 0 ? Math.round((closedCapas / totalCapas) * 100) : 0;

  const metrics = [
    {
      label: "Incidents MTD",
      value: summary?.incidents_mtd ?? 0,
      color: "text-blue-400",
      bgColor: "bg-blue-900/20",
      borderColor: "border-blue-800",
      navigateTo: "incidents",
    },
    {
      label: "Open CAPAs",
      value: summary?.open_capas ?? 0,
      color: "text-amber-400",
      bgColor: "bg-amber-900/20",
      borderColor: "border-amber-800",
      navigateTo: "capas",
    },
    {
      label: "Overdue CAPAs",
      value: summary?.overdue_capas ?? 0,
      color: summary?.overdue_capas ? "text-red-400" : "text-green-400",
      bgColor: summary?.overdue_capas ? "bg-red-900/20" : "bg-green-900/20",
      borderColor: summary?.overdue_capas ? "border-red-800" : "border-green-800",
      navigateTo: "capas",
    },
    {
      label: "CAPA Closure Rate",
      value: `${closureRate}%`,
      color: closureRate >= 70 ? "text-green-400" : closureRate >= 40 ? "text-amber-400" : "text-red-400",
      bgColor: closureRate >= 70 ? "bg-green-900/20" : closureRate >= 40 ? "bg-amber-900/20" : "bg-red-900/20",
      borderColor: closureRate >= 70 ? "border-green-800" : closureRate >= 40 ? "border-amber-800" : "border-red-800",
      navigateTo: "capas",
    },
  ];

  // Group framework coverage by tier, then series/category
  const tierGroups: Record<string, Record<string, FrameworkCoverage[]>> = {};
  for (const item of frameworkCoverage) {
    const tier = item.framework_tier || "unknown";
    const series = item.framework_series || "other";
    if (!tierGroups[tier]) tierGroups[tier] = {};
    if (!tierGroups[tier][series]) tierGroups[tier][series] = [];
    tierGroups[tier][series].push(item);
  }

  const incidentChartData = incidentsOverTime.map((d) => ({
    week: formatWeekLabel(d.week),
    count: d.count,
  }));

  const capaChartData = capaStatus.map((s) => ({
    name: formatCapaStatus(s.status),
    value: s.count,
    fill: CAPA_COLORS[s.status] ?? "#6b7280",
  }));

  const renderHeatmapCell = (item: FrameworkCoverage, idx: number) => {
    const status = item.coverage_status ?? "gap";
    const color =
      status === "covered"
        ? "bg-green-700 border-green-600 text-green-100"
        : status === "partial"
        ? "bg-amber-700 border-amber-600 text-amber-100"
        : "bg-red-900 border-red-700 text-red-200";
    return (
      <div
        key={idx}
        title={`${item.framework_category} — ${status} (${item.chunk_count} doc${item.chunk_count !== 1 ? "s" : ""})`}
        className={`border rounded px-2 py-1 text-xs cursor-pointer hover:brightness-125 transition-all ${color}`}
        onClick={() => setSelectedCell(item)}
      >
        {item.framework_category}
      </div>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((m) => (
          <div
            key={m.label}
            onClick={() => onNavigate(m.navigateTo)}
            className={`card-hover ${m.bgColor} border ${m.borderColor} cursor-pointer hover:ring-2 hover:ring-cyan-500/50 transition-all`}
          >
            <p className="text-sm text-gray-400">{m.label}</p>
            <p className={`text-3xl font-bold mt-1 ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Incidents Area Chart + CAPA Donut */}
        <div className="space-y-6">
          {/* Incidents Over Time - Area Chart */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Incidents Over Time</h2>
            {incidentChartData.length === 0 ? (
              <p className="text-gray-400 text-sm">No incident data available yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={incidentChartData} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                  <defs>
                    <linearGradient id="incidentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="week" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #374151", borderRadius: "6px" }}
                    labelStyle={{ color: "#e5e7eb" }}
                    itemStyle={{ color: "#06b6d4" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fill="url(#incidentGradient)"
                    name="Incidents"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* CAPA Status Breakdown */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">CAPA Status Breakdown</h2>
            {capaChartData.length === 0 ? (
              <p className="text-gray-400 text-sm">No CAPA data available yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={capaChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {capaChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #374151", borderRadius: "6px" }}
                    labelStyle={{ color: "#e5e7eb" }}
                    itemStyle={{ color: "#e5e7eb" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", color: "#9ca3af" }}
                    formatter={(value) => <span style={{ color: "#9ca3af" }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right Column: Framework Heatmap + Recent Activity */}
        <div className="space-y-6">
          {/* Framework Coverage Heatmap */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-1">Framework Coverage Heatmap</h2>
            <div className="flex gap-4 mb-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-green-500"></span> Covered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-amber-500"></span> Partial
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-red-500"></span> Gap
              </span>
            </div>

            {frameworkCoverage.length === 0 ? (
              <p className="text-gray-400 text-sm">Upload documents to see framework coverage analysis.</p>
            ) : (
              <div className="space-y-6">
                {Object.keys(tierGroups)
                  .sort()
                  .map((tier) => (
                    <div key={tier}>
                      <h3 className="text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wide">
                        {TIER_LABELS[tier] ?? `Tier ${tier}`}
                      </h3>

                      {tier === "3" ? (
                        <div className="space-y-3">
                          {Object.keys(tierGroups[tier])
                            .sort()
                            .map((series) => (
                              <div key={series}>
                                <p className="text-xs text-gray-500 mb-1.5">
                                  {SERIES_LABELS[series] ?? `Series ${series}`}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {tierGroups[tier][series].map((item, idx) =>
                                    renderHeatmapCell(item, idx)
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {Object.values(tierGroups[tier])
                            .flat()
                            .map((item, idx) => renderHeatmapCell(item, idx))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Recent Activity Feed */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
            {recentActivity.length === 0 ? (
              <p className="text-gray-400 text-sm">No recent activity.</p>
            ) : (
              <ul className="space-y-1">
                {recentActivity.slice(0, 10).map((item, idx) => (
                  <li
                    key={idx}
                    className={`flex items-start gap-3 px-3 py-2 rounded border-l-2 ${
                      item.type === "incident"
                        ? "border-l-cyan-500 bg-gray-800/50"
                        : "border-l-amber-500 bg-gray-800/50"
                    }`}
                  >
                    {/* Icon */}
                    <span className="mt-0.5 flex-shrink-0">
                      {item.type === "incident" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                        </svg>
                      )}
                    </span>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400">{item.reference}</span>
                        <span className="text-xs text-gray-500">{timeAgo(item.timestamp)}</span>
                      </div>
                      <p className="text-sm text-gray-300 truncate">{item.title}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Framework Coverage Detail Modal */}
      {selectedCell && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setSelectedCell(null)}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{selectedCell.framework_category}</h3>
              <button
                onClick={() => setSelectedCell(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Coverage Status</p>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                    selectedCell.coverage_status === "covered"
                      ? "bg-green-700 text-green-100"
                      : selectedCell.coverage_status === "partial"
                      ? "bg-amber-700 text-amber-100"
                      : "bg-red-900 text-red-200"
                  }`}
                >
                  {selectedCell.coverage_status?.charAt(0).toUpperCase() + selectedCell.coverage_status?.slice(1)}
                </span>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Tier / Series</p>
                <p className="text-sm text-gray-300 mt-1">
                  {TIER_LABELS[selectedCell.framework_tier] ?? `Tier ${selectedCell.framework_tier}`}
                  {selectedCell.framework_series && (
                    <> / {SERIES_LABELS[selectedCell.framework_series] ?? `Series ${selectedCell.framework_series}`}</>
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Documents Matched</p>
                <p className="text-sm text-gray-300 mt-1">
                  {selectedCell.chunk_count} document{selectedCell.chunk_count !== 1 ? "s" : ""}
                </p>
              </div>

              {selectedCell.gaps && selectedCell.gaps.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Gaps Identified</p>
                  <ul className="mt-1 space-y-1">
                    {selectedCell.gaps.map((gap, i) => (
                      <li key={i} className="text-sm text-red-300 flex items-start gap-1.5">
                        <span className="text-red-400 mt-0.5">-</span>
                        {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedCell.ai_reasoning && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">AI Reasoning</p>
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed">{selectedCell.ai_reasoning}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
