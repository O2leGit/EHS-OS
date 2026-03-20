"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  BarChart,
  Bar,
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

export default function DashboardHome({ token }: DashboardHomeProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [incidentsOverTime, setIncidentsOverTime] = useState<IncidentWeek[]>([]);
  const [capaStatus, setCapaStatus] = useState<CapaStatus[]>([]);
  const [frameworkCoverage, setFrameworkCoverage] = useState<FrameworkCoverage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<Summary>("/api/dashboard/summary", { token }),
      api<IncidentWeek[]>("/api/dashboard/incidents-over-time", { token }),
      api<CapaStatus[]>("/api/dashboard/capa-status", { token }),
      api<FrameworkCoverage[]>("/api/dashboard/framework-coverage", { token }),
    ])
      .then(([s, incidents, capas, coverage]) => {
        setSummary(s);
        setIncidentsOverTime(incidents);
        setCapaStatus(capas);
        setFrameworkCoverage(coverage);
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
    },
    {
      label: "Open CAPAs",
      value: summary?.open_capas ?? 0,
      color: "text-amber-400",
      bgColor: "bg-amber-900/20",
      borderColor: "border-amber-800",
    },
    {
      label: "Overdue CAPAs",
      value: summary?.overdue_capas ?? 0,
      color: summary?.overdue_capas ? "text-red-400" : "text-green-400",
      bgColor: summary?.overdue_capas ? "bg-red-900/20" : "bg-green-900/20",
      borderColor: summary?.overdue_capas ? "border-red-800" : "border-green-800",
    },
    {
      label: "CAPA Closure Rate",
      value: `${closureRate}%`,
      color: closureRate >= 70 ? "text-green-400" : closureRate >= 40 ? "text-amber-400" : "text-red-400",
      bgColor: closureRate >= 70 ? "bg-green-900/20" : closureRate >= 40 ? "bg-amber-900/20" : "bg-red-900/20",
      borderColor: closureRate >= 70 ? "border-green-800" : closureRate >= 40 ? "border-amber-800" : "border-red-800",
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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={`card-hover ${m.bgColor} border ${m.borderColor}`}
          >
            <p className="text-sm text-gray-400">{m.label}</p>
            <p className={`text-3xl font-bold mt-1 ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Incidents Over Time */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Incidents Over Time</h2>
          {incidentChartData.length === 0 ? (
            <p className="text-gray-400 text-sm">No incident data available yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={incidentChartData} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="week" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #374151", borderRadius: "6px" }}
                  labelStyle={{ color: "#e5e7eb" }}
                  itemStyle={{ color: "#3b82f6" }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Incidents" />
              </BarChart>
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
                    // Tier 3: group by series
                    <div className="space-y-3">
                      {Object.keys(tierGroups[tier])
                        .sort()
                        .map((series) => (
                          <div key={series}>
                            <p className="text-xs text-gray-500 mb-1.5">
                              {SERIES_LABELS[series] ?? `Series ${series}`}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {tierGroups[tier][series].map((item, idx) => {
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
                                    className={`border rounded px-2 py-1 text-xs cursor-default ${color}`}
                                  >
                                    {item.framework_category}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    // Tier 1 and 2: flat grid
                    <div className="flex flex-wrap gap-2">
                      {Object.values(tierGroups[tier])
                        .flat()
                        .map((item, idx) => {
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
                              className={`border rounded px-2 py-1 text-xs cursor-default ${color}`}
                            >
                              {item.framework_category}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
