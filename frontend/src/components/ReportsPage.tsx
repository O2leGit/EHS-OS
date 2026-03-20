"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface ReportsPageProps {
  token: string;
  onOpenChat?: (message: string) => void;
}

interface ReportSummary {
  id: string;
  report_type: string;
  period_label: string;
  title: string;
  created_by: string;
  created_at: string;
}

interface ReportDetail {
  id: string;
  report_type: string;
  title: string;
  content: {
    executive_summary: string;
    sections: {
      title: string;
      content: string;
      metrics?: { label: string; value: string; trend?: string; status?: string }[];
      recommendations?: string[];
    }[];
    risk_assessment?: {
      overall_level: string;
      summary: string;
      top_risks?: { risk: string; severity: string; mitigation: string }[];
    };
    action_items?: { action: string; owner: string; deadline: string; priority: string }[];
    looking_ahead?: string;
  };
  created_at: string;
  created_by: string;
}

const TYPE_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

const TYPE_COLORS: Record<string, string> = {
  weekly: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  monthly: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  quarterly: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  annual: "bg-green-500/20 text-green-400 border-green-500/30",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-amber-400",
  low: "text-green-400",
};

const RISK_COLORS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  elevated: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  moderate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/20 text-green-400 border-green-500/30",
};

export default function ReportsPage({ token }: ReportsPageProps) {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportDetail | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<string | null>(null);

  const fetchReports = () => {
    api<ReportSummary[]>("/api/reports/", { token })
      .then(setReports)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReports(); }, [token]);

  const generateReport = async (type: string) => {
    setGenerating(true);
    setActiveType(type);
    try {
      const result = await api<ReportDetail>("/api/reports/generate", {
        token,
        method: "POST",
        body: { report_type: type },
      });
      setSelectedReport(result);
      fetchReports();
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
      setActiveType(null);
    }
  };

  const viewReport = async (id: string) => {
    try {
      const result = await api<ReportDetail>(`/api/reports/${id}`, { token });
      setSelectedReport(result);
    } catch (e) {
      console.error(e);
    }
  };

  const downloadReport = async (reportId: string) => {
    try {
      const response = await fetch(`/api/reports/${reportId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = response.headers.get("content-disposition")?.split("filename=")[1]?.replace(/"/g, "") || "ehs_report.docx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      console.error("Download error:", err);
    }
  };

  if (selectedReport) {
    const c = selectedReport.content;
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-white text-sm mb-2 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Reports
            </button>
            <h2 className="text-xl font-bold text-white">{selectedReport.title}</h2>
            <p className="text-xs text-gray-400 mt-1">
              Generated {new Date(selectedReport.created_at).toLocaleString()} by {selectedReport.created_by}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadReport(selectedReport.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-navy-600 bg-navy-700 text-gray-300 hover:bg-navy-600 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Word
            </button>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${TYPE_COLORS[selectedReport.report_type] || ""}`}>
              {TYPE_LABELS[selectedReport.report_type] || selectedReport.report_type}
            </span>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-6">
          <h3 className="text-safe font-semibold text-sm mb-3">Executive Summary</h3>
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{c.executive_summary}</p>
        </div>

        {/* Sections */}
        {c.sections?.map((section, i) => (
          <div key={i} className="bg-navy-800 rounded-xl border border-navy-700 p-6">
            <h3 className="text-white font-semibold text-sm mb-3">{section.title}</h3>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line mb-4">{section.content}</p>
            {section.metrics && section.metrics.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {section.metrics.map((m, j) => (
                  <div key={j} className="bg-navy-900 rounded-lg p-3 text-center">
                    <div className={`text-lg font-bold ${m.status === 'good' ? 'text-green-400' : m.status === 'critical' ? 'text-red-400' : 'text-white'}`}>
                      {m.value}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{m.label}</div>
                    {m.trend && (
                      <div className={`text-xs mt-1 ${m.trend === 'down' ? 'text-green-400' : m.trend === 'up' ? 'text-red-400' : 'text-gray-400'}`}>
                        {m.trend === 'up' ? '^ Up' : m.trend === 'down' ? 'v Down' : '- Stable'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {section.recommendations && section.recommendations.length > 0 && (
              <div className="border-t border-navy-700 pt-3 mt-3">
                <div className="text-xs text-gray-400 font-medium mb-2">Recommendations</div>
                <ul className="space-y-1">
                  {section.recommendations.map((r, j) => (
                    <li key={j} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-safe mt-0.5">-</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}

        {/* Risk Assessment */}
        {c.risk_assessment && (
          <div className="bg-navy-800 rounded-xl border border-navy-700 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-sm">Risk Assessment</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${RISK_COLORS[c.risk_assessment.overall_level] || ""}`}>
                {c.risk_assessment.overall_level?.toUpperCase()}
              </span>
            </div>
            <p className="text-gray-300 text-sm mb-4">{c.risk_assessment.summary}</p>
            {c.risk_assessment.top_risks && (
              <div className="space-y-2">
                {c.risk_assessment.top_risks.map((risk, i) => (
                  <div key={i} className="bg-navy-900 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium ${SEVERITY_COLORS[risk.severity] || "text-gray-400"}`}>
                        [{risk.severity?.toUpperCase()}]
                      </span>
                      <span className="text-sm text-white">{risk.risk}</span>
                    </div>
                    <p className="text-xs text-gray-400 ml-4">{risk.mitigation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Items */}
        {c.action_items && c.action_items.length > 0 && (
          <div className="bg-navy-800 rounded-xl border border-navy-700 p-6">
            <h3 className="text-white font-semibold text-sm mb-3">Action Items</h3>
            <div className="space-y-2">
              {c.action_items.map((item, i) => (
                <div key={i} className="flex items-start gap-3 bg-navy-900 rounded-lg p-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    item.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                    item.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                    item.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {item.priority?.toUpperCase()}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm text-white">{item.action}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {item.owner} | {item.deadline}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Looking Ahead */}
        {c.looking_ahead && (
          <div className="bg-navy-800 rounded-xl border border-navy-700 p-6">
            <h3 className="text-white font-semibold text-sm mb-3">Looking Ahead</h3>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{c.looking_ahead}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">EHS Executive Reports</h2>
          <p className="text-sm text-gray-400 mt-1">AI-generated reports written as an EHS Director</p>
        </div>
      </div>

      {/* Generate buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["weekly", "monthly", "quarterly", "annual"] as const).map((type) => (
          <button
            key={type}
            onClick={() => generateReport(type)}
            disabled={generating}
            className={`bg-navy-800 border border-navy-700 rounded-xl p-4 text-center hover:border-safe/50 transition-all ${
              generating && activeType === type ? "animate-pulse" : ""
            } ${generating ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 border ${TYPE_COLORS[type]}`}>
              {TYPE_LABELS[type]}
            </div>
            <div className="text-white text-sm font-medium">
              {generating && activeType === type ? "Generating..." : `Generate ${TYPE_LABELS[type]}`}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {type === "weekly" ? "Last 7 days" : type === "monthly" ? "Last 30 days" : type === "quarterly" ? "Last 90 days" : "Full year"}
            </div>
          </button>
        ))}
      </div>

      {/* Archive */}
      <div className="bg-navy-800 rounded-xl border border-navy-700 p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Report Archive</h3>
        {loading ? (
          <div className="text-gray-400 text-sm animate-pulse">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 text-sm">No reports generated yet</p>
            <p className="text-gray-600 text-xs mt-1">Click a button above to generate your first report</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map((report) => (
              <button
                key={report.id}
                onClick={() => viewReport(report.id)}
                className="w-full text-left bg-navy-900 hover:bg-navy-700/50 rounded-lg p-3 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${TYPE_COLORS[report.report_type] || ""}`}>
                    {TYPE_LABELS[report.report_type] || report.report_type}
                  </span>
                  <div>
                    <div className="text-sm text-white">{report.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(report.created_at).toLocaleDateString()} | {report.created_by}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadReport(report.id); }}
                    className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-navy-600 transition-colors"
                    title="Download Word Document"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
