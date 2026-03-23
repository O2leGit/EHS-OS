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

interface TenantBranding {
  brand_name: string;
  logo_url: string | null;
  partner_name: string | null;
  partner_logo_url: string | null;
  tenant_name?: string;
}

interface DashboardHomeProps {
  token: string;
  onNavigate: (page: string) => void;
  onOpenChat?: (message: string) => void;
  selectedSiteId?: string | null;
  branding?: TenantBranding | null;
}

interface BriefingPattern {
  severity: string;
  description: string;
  trend: string;
  prediction: string;
  recommended_action: string;
}

interface WeeklyBriefing {
  overall_risk_level: string;
  summary: string;
  patterns: BriefingPattern[];
  metrics: {
    incidents_mtd: number;
    open_capas: number;
    overdue_capas: number;
  };
  upcoming_deadlines: {
    reference: string;
    title: string;
    due_date: string;
  }[];
}

interface Summary {
  incidents_mtd: number;
  open_capas: number;
  overdue_capas: number;
  framework_coverage_pct: number;
  trends?: {
    incidents_monthly: number[];
    capas_opened_monthly: number[];
    near_miss_monthly: number[];
  };
}

interface AuditFactor {
  name: string;
  score: number;
  detail: string;
}

interface AuditRecommendation {
  action: string;
  points: number;
  effort: string;
}

interface AuditReadiness {
  overall_score: number;
  score?: number;
  level: string;
  factors: AuditFactor[];
  recommendations: AuditRecommendation[];
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

const RISK_LEVEL_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  low: { bg: "bg-green-900/30", border: "border-green-600", text: "text-green-300", label: "Low Risk" },
  moderate: { bg: "bg-yellow-900/30", border: "border-yellow-600", text: "text-yellow-300", label: "Moderate Risk" },
  elevated: { bg: "bg-orange-900/30", border: "border-orange-600", text: "text-orange-300", label: "Elevated Risk" },
  critical: { bg: "bg-red-900/30", border: "border-red-600", text: "text-red-300", label: "Critical Risk" },
};

const SEVERITY_BADGE: Record<string, string> = {
  low: "bg-green-700 text-green-100",
  moderate: "bg-yellow-700 text-yellow-100",
  elevated: "bg-orange-700 text-orange-100",
  high: "bg-red-700 text-red-100",
  critical: "bg-red-900 text-red-100",
};

function AiPromptBar({ prompts, onOpenChat }: { prompts: string[]; onOpenChat?: (message: string) => void }) {
  if (!onOpenChat) return null;
  return (
    <div className="bg-gradient-to-r from-[#0B1426] to-[#111D35] border border-cyan-500/20 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
        </svg>
        <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">AI Insights</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onOpenChat(prompt)}
            className="bg-[#111D35] hover:bg-[#1B2A4A] border border-[#1E3050] hover:border-cyan-500/30 rounded-lg px-4 py-3 cursor-pointer transition-all text-left group"
          >
            <span className="text-xs text-cyan-400 block mb-0.5">Ask EHS AI Assistant</span>
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DashboardHome({ token, onNavigate, onOpenChat, selectedSiteId, branding }: DashboardHomeProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [incidentsOverTime, setIncidentsOverTime] = useState<IncidentWeek[]>([]);
  const [capaStatus, setCapaStatus] = useState<CapaStatus[]>([]);
  const [frameworkCoverage, setFrameworkCoverage] = useState<FrameworkCoverage[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<FrameworkCoverage | null>(null);
  const [briefing, setBriefing] = useState<WeeklyBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  const [auditReadiness, setAuditReadiness] = useState<AuditReadiness | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [globalMetrics, setGlobalMetrics] = useState<any>(null);
  const [alerts, setAlerts] = useState<{id: string; incident_number: string; title: string; severity: string; location: string; created_at: string}[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("ehs_dismissed_alerts") || "[]");
    } catch { return []; }
  });

  useEffect(() => {
    const siteParam = selectedSiteId ? `?site_id=${selectedSiteId}` : "";
    Promise.all([
      api<Summary>(`/api/dashboard/summary${siteParam}`, { token }),
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

    api<WeeklyBriefing>("/api/briefing/weekly", { token })
      .then(setBriefing)
      .catch(console.error)
      .finally(() => setBriefingLoading(false));

    api<AuditReadiness>("/api/audit/readiness", { token })
      .then(setAuditReadiness)
      .catch(console.error);

    // Fetch alerts
    api<{id: string; incident_number: string; title: string; severity: string; location: string; created_at: string}[]>(
      "/api/incidents/alerts", { token }
    ).then(setAlerts).catch(console.error);

    // Fetch global metrics
    api<any>("/api/dashboard/global-metrics", { token })
      .then(setGlobalMetrics)
      .catch(console.error);
  }, [token, selectedSiteId]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-navy-700 rounded w-40 mb-6" />
        {/* KPI card skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-navy-800 rounded-xl p-5 border border-navy-700">
              <div className="h-3 bg-navy-700 rounded w-24 mb-3" />
              <div className="h-8 bg-navy-700 rounded w-16" />
            </div>
          ))}
        </div>
        {/* Chart skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-navy-800 rounded-xl p-5 border border-navy-700 h-64" />
          <div className="bg-navy-800 rounded-xl p-5 border border-navy-700 h-64" />
        </div>
      </div>
    );
  }

  // CAPA closure rate
  const totalCapas = capaStatus.reduce((sum, s) => sum + s.count, 0);
  const closedCapas = capaStatus.find((s) => s.status === "closed")?.count ?? 0;
  const closureRate = totalCapas > 0 ? Math.round((closedCapas / totalCapas) * 100) : 0;

  // Build sparkline SVG from trend data
  const buildSparkline = (data: number[], downIsGood: boolean) => {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const w = 60;
    const h = 20;
    const pad = 2;
    const points = data
      .map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (w - pad * 2);
        const y = pad + (1 - (v - min) / range) * (h - pad * 2);
        return `${x},${y}`;
      })
      .join(" ");
    const trending = data[data.length - 1] - data[0];
    const trendingUp = trending > 0;
    const color = downIsGood
      ? trendingUp ? "#ef4444" : "#22c55e"
      : trendingUp ? "#22c55e" : "#ef4444";
    return (
      <svg width={w} height={h} className="mt-1 opacity-80">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  const metrics = [
    {
      label: "Incidents MTD",
      value: summary?.incidents_mtd ?? 0,
      color: "text-blue-400",
      bgColor: "bg-blue-900/20",
      borderColor: "border-blue-800",
      navigateTo: "incidents",
      trendData: summary?.trends?.incidents_monthly,
      downIsGood: true,
    },
    {
      label: "Open CAPAs",
      value: summary?.open_capas ?? 0,
      color: "text-amber-400",
      bgColor: "bg-amber-900/20",
      borderColor: "border-amber-800",
      navigateTo: "capas",
      trendData: summary?.trends?.capas_opened_monthly,
      downIsGood: true,
    },
    {
      label: "Overdue CAPAs",
      value: summary?.overdue_capas ?? 0,
      color: summary?.overdue_capas ? "text-red-400" : "text-green-400",
      bgColor: summary?.overdue_capas ? "bg-red-900/20" : "bg-green-900/20",
      borderColor: summary?.overdue_capas ? "border-red-800" : "border-green-800",
      navigateTo: "capas",
      trendData: summary?.trends?.near_miss_monthly,
      downIsGood: true,
    },
  ];

  // Audit readiness gauge helpers
  const auditScore = auditReadiness?.overall_score ?? auditReadiness?.score ?? 0;
  const auditGaugeColor = auditScore >= 80 ? "#22c55e" : auditScore >= 60 ? "#eab308" : auditScore >= 40 ? "#f97316" : "#ef4444";
  const auditLevel = auditReadiness?.level || (auditScore >= 80 ? "Audit Ready" : auditScore >= 60 ? "Needs Attention" : auditScore >= 40 ? "At Risk" : "Critical Gaps");
  const auditLevelTextColor = auditScore >= 80 ? "text-green-400" : auditScore >= 60 ? "text-yellow-400" : auditScore >= 40 ? "text-orange-400" : "text-red-400";
  // SVG circle gauge math: radius=40, circumference=251.3
  const gaugeRadius = 40;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeDashoffset = gaugeCircumference - (auditScore / 100) * gaugeCircumference;

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

  const capaChartDataBase = capaStatus.map((s) => ({
    name: formatCapaStatus(s.status),
    value: s.count,
    fill: CAPA_COLORS[s.status] ?? "#6b7280",
  }));
  // Add overdue segment from summary if not already in capa-status response
  const hasOverdue = capaStatus.some((s) => s.status === "overdue");
  const overdueCount = hasOverdue ? 0 : (summary?.overdue_capas ?? 0);
  const capaChartData = overdueCount > 0
    ? [...capaChartDataBase, { name: "Overdue", value: overdueCount, fill: CAPA_COLORS["overdue"] }]
    : capaChartDataBase;
  const totalCapaCount = capaChartData.reduce((sum, s) => sum + s.value, 0);

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
        key={`${item.framework_tier}-${item.framework_series}-${item.framework_category}`}
        title={`${item.framework_category} — ${status} (${item.chunk_count} doc${item.chunk_count !== 1 ? "s" : ""})`}
        className={`border rounded px-2 py-1 text-xs cursor-pointer hover:brightness-125 transition-all ${color}`}
        onClick={() => setSelectedCell(item)}
      >
        {item.framework_category}
      </div>
    );
  };

  const hasCriticalRisk = briefing && (briefing.overall_risk_level === "critical" || briefing.overall_risk_level === "elevated");
  const criticalPatternCount = briefing?.patterns?.filter(p => p.severity === "critical" || p.severity === "high").length ?? 0;

  const dismissAlert = (alertId: string) => {
    const updated = [...dismissedAlerts, alertId];
    setDismissedAlerts(updated);
    localStorage.setItem("ehs_dismissed_alerts", JSON.stringify(updated));
  };

  const activeAlerts = alerts.filter(a => !dismissedAlerts.includes(a.id));

  return (
    <div>
      {/* Alert Banner */}
      {activeAlerts.length > 0 && (
        <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-4 mb-6 animate-slide-down">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <div>
                <p className="text-red-300 font-semibold text-sm">
                  {activeAlerts.length} high-severity incident{activeAlerts.length > 1 ? "s" : ""} require{activeAlerts.length === 1 ? "s" : ""} attention
                </p>
                <p className="text-red-400/70 text-xs mt-0.5">
                  {activeAlerts[0]?.title} at {activeAlerts[0]?.location} - {
                    (() => {
                      const mins = Math.floor((Date.now() - new Date(activeAlerts[0]?.created_at).getTime()) / 60000);
                      if (mins < 60) return `${mins}m ago`;
                      const hours = Math.floor(mins / 60);
                      if (hours < 24) return `${hours}h ago`;
                      return `${Math.floor(hours / 24)}d ago`;
                    })()
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate("incidents")}
                className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 px-3 py-1.5 rounded-lg transition-colors"
              >
                View
              </button>
              <button
                onClick={() => activeAlerts.forEach(a => dismissAlert(a.id))}
                className="text-xs text-red-400/50 hover:text-red-400 px-2 py-1.5 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tenant Header - dynamic branding */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {branding?.logo_url ? (
            <img
              src={branding.logo_url}
              alt={branding.tenant_name || branding.brand_name}
              className="h-8 object-contain"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          ) : (
            <span className="text-2xl font-bold text-white">{branding?.tenant_name || branding?.brand_name || "EHS-OS"}</span>
          )}
          <div className="h-6 w-px bg-navy-700" />
          <h1 className="text-2xl font-bold">EHS Management System</h1>
        </div>
        <div className="flex items-center gap-3">
          {branding?.partner_name && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">Managed by</span>
                {branding.partner_logo_url ? (
                  <img src={branding.partner_logo_url} alt={branding.partner_name} className="h-6 object-contain opacity-80" />
                ) : (
                  <span className="text-xs font-medium text-gray-300">{branding.partner_name}</span>
                )}
              </div>
              <div className="h-4 w-px bg-navy-700" />
            </>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400">Powered by</span>
            <span className="text-xs font-semibold text-gray-300">ScaleOS</span>
            <span className="text-[10px] text-gray-500">&</span>
            <span className="text-xs font-semibold text-gray-300">IkigaiOS</span>
          </div>
        </div>
      </div>

      {/* Weekly Risk Briefing Banner */}
      {!briefingLoading && (
        <div className={`relative mb-6 rounded-xl overflow-hidden ${hasCriticalRisk ? "" : ""}`}>
          {hasCriticalRisk && (
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />
          )}
          <div className="bg-gradient-to-r from-[#1B2A4A] to-[#2E75B6] text-white rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Sparkles icon with pulse */}
                <div className="animate-pulse">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
                    <path d="M5 3v4" />
                    <path d="M3 5h4" />
                    <path d="M19 17v4" />
                    <path d="M17 19h4" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold">Weekly Risk Briefing</h2>
                    {criticalPatternCount > 0 && (
                      <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {criticalPatternCount} alert{criticalPatternCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-blue-200 mt-0.5">
                    {briefing?.summary || "AI-powered risk analysis based on your incident data"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBriefingModal(true)}
                className="border border-white/40 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                View Full Briefing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Prompt Bar */}
      <AiPromptBar
        onOpenChat={onOpenChat}
        prompts={[
          "What are my biggest risks right now?",
          "Summarize my compliance status",
          "What should I prioritize this week?",
        ]}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((m) => (
          <div
            key={m.label}
            onClick={() => onNavigate(m.navigateTo)}
            className={`card-hover ${m.bgColor} border ${m.borderColor} cursor-pointer hover:ring-2 hover:ring-cyan-500/50 transition-all`}
          >
            <p className="text-sm text-gray-400">{m.label}</p>
            <div className="flex items-end justify-between">
              <p className={`text-3xl font-bold mt-1 ${m.color}`}>{m.value}</p>
              {m.trendData && m.trendData.length >= 2 && buildSparkline(m.trendData, m.downIsGood)}
            </div>
          </div>
        ))}
        {/* Audit Readiness Gauge Card */}
        <div
          onClick={() => setShowAuditModal(true)}
          className="card-hover bg-gray-900/40 border border-gray-700 cursor-pointer hover:ring-2 hover:ring-cyan-500/50 transition-all flex flex-col items-center justify-center py-3"
        >
          {auditReadiness ? (
            <>
              <svg width="100" height="100" viewBox="0 0 100 100" className="mb-1">
                {/* Background track */}
                <circle
                  cx="50" cy="50" r={gaugeRadius}
                  fill="none"
                  stroke="#374151"
                  strokeWidth="8"
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  strokeDasharray={gaugeCircumference}
                />
                {/* Foreground arc */}
                <circle
                  cx="50" cy="50" r={gaugeRadius}
                  fill="none"
                  stroke={auditGaugeColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeDashoffset}
                  style={{ transition: "stroke-dashoffset 0.8s ease" }}
                />
                {/* Score text */}
                <text x="50" y="46" textAnchor="middle" fill="white" fontSize="22" fontWeight="bold" dominantBaseline="middle">
                  {auditScore}
                </text>
                <text x="50" y="62" textAnchor="middle" fill="#9ca3af" fontSize="8">
                  / 100
                </text>
              </svg>
              <p className="text-sm text-gray-400">Audit Readiness</p>
              <p className={`text-xs font-semibold ${auditLevelTextColor}`}>{auditLevel}</p>
            </>
          ) : (
            <div className="text-center text-gray-500">Loading...</div>
          )}
        </div>
      </div>

      {/* Global EHS Metrics */}
      {globalMetrics && (
        <div className="space-y-4 mb-8">
          {/* Global rates bar */}
          <div className="bg-navy-800 rounded-xl border border-navy-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm">Global Safety Metrics</h3>
              <span className="text-xs text-gray-500">{globalMetrics.global.total_employees} employees across {globalMetrics.global.total_sites} sites</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* TRIR */}
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{globalMetrics.global.trir}</div>
                <div className="text-xs text-gray-400 mt-1">TRIR</div>
                <div className={`text-xs mt-1 ${globalMetrics.global.trir < globalMetrics.benchmarks.trir.industry_avg ? 'text-green-400' : 'text-red-400'}`}>
                  Industry avg: {globalMetrics.benchmarks.trir.industry_avg}
                </div>
              </div>
              {/* DART */}
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{globalMetrics.global.dart}</div>
                <div className="text-xs text-gray-400 mt-1">DART Rate</div>
                <div className={`text-xs mt-1 ${globalMetrics.global.dart < globalMetrics.benchmarks.dart.industry_avg ? 'text-green-400' : 'text-red-400'}`}>
                  Industry avg: {globalMetrics.benchmarks.dart.industry_avg}
                </div>
              </div>
              {/* Near-Miss % */}
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{globalMetrics.global.near_miss_reporting_pct}%</div>
                <div className="text-xs text-gray-400 mt-1">Near-Miss Rate</div>
                <div className={`text-xs mt-1 ${globalMetrics.global.near_miss_reporting_pct >= 50 ? 'text-green-400' : 'text-amber-400'}`}>
                  Target: {globalMetrics.benchmarks.near_miss_target}%
                </div>
              </div>
              {/* Investigation closure */}
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{globalMetrics.global.investigation_closure_pct}%</div>
                <div className="text-xs text-gray-400 mt-1">Investigation Closure</div>
                <div className="text-xs text-gray-400 mt-1">
                  {globalMetrics.global.total_incidents} total incidents
                </div>
              </div>
            </div>
          </div>

          {/* Site Benchmarking Table */}
          <div className="bg-navy-800 rounded-xl border border-navy-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm">Site Benchmarking</h3>
              <span className="text-[10px] text-gray-500 bg-navy-700/50 px-2 py-0.5 rounded">Rolling 12 Months | FY2026 YTD</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-navy-700">
                    <th className="text-left text-gray-400 font-medium py-2 px-2">Site</th>
                    <th className="text-center text-gray-400 font-medium py-2 px-2">Employees</th>
                    <th className="text-center text-gray-400 font-medium py-2 px-2">Incidents</th>
                    <th className="text-center text-gray-400 font-medium py-2 px-2">TRIR</th>
                    <th className="text-center text-gray-400 font-medium py-2 px-2">DART</th>
                    <th className="text-center text-gray-400 font-medium py-2 px-2">Near-Miss %</th>
                    <th className="text-center text-gray-400 font-medium py-2 px-2">Closure %</th>
                  </tr>
                </thead>
                <tbody>
                  {globalMetrics.sites.map((site: any) => (
                    <tr key={site.code} className={`border-b border-navy-700/50 hover:bg-navy-700/30 ${site.status === 'not_enrolled' ? 'opacity-50' : ''}`}>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <div className="text-white font-medium">{site.name}</div>
                          {site.status === 'not_enrolled' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-700 text-gray-400 border border-gray-600">Phase 2</span>
                          )}
                          {site.status === 'insufficient_data' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-900/30 text-amber-400 border border-amber-800/30">Ramping</span>
                          )}
                          {site.context && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-900/30 text-blue-400 border border-blue-800/30">Pilot</span>
                          )}
                        </div>
                        <div className="text-gray-500">{site.code}</div>
                      </td>
                      <td className="text-center text-gray-300 py-2.5 px-2">{site.employees}</td>
                      <td className="text-center text-gray-300 py-2.5 px-2">{site.total_incidents}</td>
                      <td className="text-center py-2.5 px-2">
                        {site.trir != null ? (
                          <span className={site.trir < 2.1 ? 'text-green-400' : site.trir < 4 ? 'text-amber-400' : 'text-red-400'}>
                            {site.trir}
                          </span>
                        ) : (
                          <span className="text-gray-600">--</span>
                        )}
                      </td>
                      <td className="text-center py-2.5 px-2">
                        {site.dart != null ? (
                          <span className={site.dart < 1.2 ? 'text-green-400' : site.dart < 2.5 ? 'text-amber-400' : 'text-red-400'}>
                            {site.dart}
                          </span>
                        ) : (
                          <span className="text-gray-600">--</span>
                        )}
                      </td>
                      <td className="text-center py-2.5 px-2">
                        {site.near_miss_pct != null ? (
                          <span className={site.near_miss_pct >= 50 ? 'text-green-400' : site.near_miss_pct >= 30 ? 'text-amber-400' : 'text-red-400'}>
                            {site.near_miss_pct}%
                          </span>
                        ) : (
                          <span className="text-gray-600">--</span>
                        )}
                      </td>
                      <td className="text-center py-2.5 px-2">
                        {site.investigation_closure_pct != null ? (
                          <span className={site.investigation_closure_pct >= 70 ? 'text-green-400' : site.investigation_closure_pct >= 40 ? 'text-amber-400' : 'text-red-400'}>
                            {site.investigation_closure_pct}%
                          </span>
                        ) : (
                          <span className="text-gray-600">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Global total row */}
                  <tr className="bg-navy-700/30 font-medium">
                    <td className="py-2.5 px-2 text-safe">Global Total</td>
                    <td className="text-center text-white py-2.5 px-2">{globalMetrics.global.total_employees}</td>
                    <td className="text-center text-white py-2.5 px-2">{globalMetrics.global.total_incidents}</td>
                    <td className="text-center text-safe py-2.5 px-2">{globalMetrics.global.trir}</td>
                    <td className="text-center text-safe py-2.5 px-2">{globalMetrics.global.dart}</td>
                    <td className="text-center text-safe py-2.5 px-2">{globalMetrics.global.near_miss_reporting_pct}%</td>
                    <td className="text-center text-safe py-2.5 px-2">{globalMetrics.global.investigation_closure_pct}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
                  {/* Center text showing total */}
                  <text x="50%" y="45%" textAnchor="middle" fill="#e5e7eb" fontSize="22" fontWeight="bold" dominantBaseline="middle">
                    {totalCapaCount}
                  </text>
                  <text x="50%" y="58%" textAnchor="middle" fill="#9ca3af" fontSize="11" dominantBaseline="middle">
                    Total CAPAs
                  </text>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #374151", borderRadius: "6px" }}
                    labelStyle={{ color: "#e5e7eb" }}
                    itemStyle={{ color: "#e5e7eb" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", color: "#9ca3af" }}
                    formatter={(value: string) => {
                      const entry = capaChartData.find((d) => d.name === value);
                      return <span style={{ color: "#9ca3af" }}>{value} ({entry?.value ?? 0})</span>;
                    }}
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
                    key={item.reference || idx}
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

      {/* Weekly Risk Briefing Modal */}
      {showBriefingModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowBriefingModal(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-5 flex items-center justify-between rounded-t-xl z-10">
              <h2 className="text-xl font-bold text-white">Weekly Risk Briefing</h2>
              <button
                onClick={() => setShowBriefingModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Risk Summary Banner */}
              {briefing && (() => {
                const style = RISK_LEVEL_STYLES[briefing.overall_risk_level] || RISK_LEVEL_STYLES.low;
                return (
                  <div className={`rounded-lg border p-4 ${style.bg} ${style.border}`}>
                    <span className={`text-sm font-bold uppercase tracking-wide ${style.text}`}>
                      {style.label}
                    </span>
                    <p className="text-sm text-gray-300 mt-1">{briefing.summary}</p>
                  </div>
                );
              })()}

              {/* Pattern Alerts */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Pattern Alerts</h3>
                {(!briefing?.patterns || briefing.patterns.length === 0) ? (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-600 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <p className="text-sm text-gray-400">
                      Insufficient incident data for pattern detection. Keep reporting incidents to enable predictive analytics.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {briefing.patterns.map((pattern, idx) => (
                      <div key={idx} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${SEVERITY_BADGE[pattern.severity] || SEVERITY_BADGE.moderate}`}>
                            {pattern.severity?.toUpperCase()}
                          </span>
                          {pattern.trend && (
                            <span className="text-xs text-gray-400">Trend: {pattern.trend}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-200 mb-2">{pattern.description}</p>
                        {pattern.prediction && (
                          <p className="text-xs text-gray-400 mb-2">
                            <span className="font-semibold text-gray-300">Prediction:</span> {pattern.prediction}
                          </p>
                        )}
                        {pattern.recommended_action && (
                          <p className="text-xs text-gray-400 mb-3">
                            <span className="font-semibold text-gray-300">Recommended:</span> {pattern.recommended_action}
                          </p>
                        )}
                        <button
                          onClick={() => { setShowBriefingModal(false); onNavigate("capas"); }}
                          className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded transition-colors font-medium"
                        >
                          Create CAPA
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Metrics Snapshot */}
              {briefing?.metrics && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Metrics Snapshot</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-blue-400">{briefing.metrics.incidents_mtd}</p>
                      <p className="text-xs text-gray-400 mt-1">Incidents MTD</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-amber-400">{briefing.metrics.open_capas}</p>
                      <p className="text-xs text-gray-400 mt-1">Open CAPAs</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
                      <p className={`text-2xl font-bold ${briefing.metrics.overdue_capas > 0 ? "text-red-400" : "text-green-400"}`}>
                        {briefing.metrics.overdue_capas}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Overdue CAPAs</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Upcoming Deadlines */}
              {briefing?.upcoming_deadlines && briefing.upcoming_deadlines.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Upcoming Deadlines</h3>
                  <div className="space-y-2">
                    {briefing.upcoming_deadlines.map((dl, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 truncate">{dl.title}</p>
                          <p className="text-xs text-gray-500">{dl.reference}</p>
                        </div>
                        <span className="text-xs text-amber-400 font-medium whitespace-nowrap">{dl.due_date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                  {(selectedCell.coverage_status || "unknown").charAt(0).toUpperCase() + (selectedCell.coverage_status || "unknown").slice(1)}
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

      {/* Audit Readiness Detail Modal */}
      {showAuditModal && auditReadiness && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowAuditModal(false)}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                {/* Mini gauge in modal header */}
                <svg width="56" height="56" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={gaugeRadius} fill="none" stroke="#374151" strokeWidth="8" strokeLinecap="round" transform="rotate(-90 50 50)" strokeDasharray={gaugeCircumference} />
                  <circle cx="50" cy="50" r={gaugeRadius} fill="none" stroke={auditGaugeColor} strokeWidth="8" strokeLinecap="round" transform="rotate(-90 50 50)" strokeDasharray={gaugeCircumference} strokeDashoffset={gaugeDashoffset} />
                  <text x="50" y="50" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold" dominantBaseline="middle">{auditScore}</text>
                </svg>
                <div>
                  <h3 className="text-lg font-semibold text-white">Audit Readiness</h3>
                  <p className={`text-sm font-medium ${auditLevelTextColor}`}>{auditLevel}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Factors breakdown */}
            <div className="space-y-3 mb-6">
              <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Score Breakdown</h4>
              {auditReadiness.factors.map((factor, i) => {
                const barColor = factor.score >= 80 ? "bg-green-500" : factor.score >= 60 ? "bg-yellow-500" : factor.score >= 40 ? "bg-orange-500" : "bg-red-500";
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{factor.name}</span>
                      <span className="text-sm font-mono text-gray-400">{factor.score}/100</span>
                    </div>
                    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${factor.score}%`, transition: "width 0.6s ease" }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">{factor.detail}</p>
                  </div>
                );
              })}
            </div>

            {/* Recommendations */}
            {auditReadiness.recommendations.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Recommendations</h4>
                {auditReadiness.recommendations.map((rec, i) => {
                  const effortBadge = rec.effort === "high" ? "bg-red-500/15 text-red-400 border-red-500/30"
                    : rec.effort === "medium" ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    : "bg-green-500/15 text-green-400 border-green-500/30";
                  return (
                    <div key={i} className="flex items-start gap-3 bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${effortBadge}`}>
                            {rec.effort} effort
                          </span>
                          <span className="text-xs text-cyan-400 font-medium">+{rec.points} pts</span>
                        </div>
                        <p className="text-sm text-gray-300">{rec.action}</p>
                      </div>
                      <button
                        onClick={() => {
                          setShowAuditModal(false);
                          onNavigate("capas");
                        }}
                        className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors whitespace-nowrap"
                      >
                        Create CAPA
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
