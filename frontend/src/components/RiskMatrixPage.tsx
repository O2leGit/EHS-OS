"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface RiskMatrixPageProps {
  token: string;
}

interface Incident {
  id: string;
  incident_number: string;
  title: string;
  severity: string;
  status: string;
  location: string;
  created_at: string;
}

const LIKELIHOOD_LABELS = ["Almost Certain", "Likely", "Possible", "Unlikely", "Rare"];
const SEVERITY_LABELS = ["Negligible", "Minor", "Moderate", "Major", "Catastrophic"];

// Risk level colors: 5x5 matrix, row=likelihood (top=5), col=severity (left=1)
// Values represent risk score = likelihood * severity
const RISK_MATRIX: number[][] = [
  [5, 10, 15, 20, 25],  // Almost Certain
  [4,  8, 12, 16, 20],  // Likely
  [3,  6,  9, 12, 15],  // Possible
  [2,  4,  6,  8, 10],  // Unlikely
  [1,  2,  3,  4,  5],  // Rare
];

function getRiskColor(score: number): { bg: string; text: string; label: string } {
  if (score >= 15) return { bg: "bg-red-600/80", text: "text-red-100", label: "Critical" };
  if (score >= 10) return { bg: "bg-orange-500/70", text: "text-orange-100", label: "High" };
  if (score >= 5) return { bg: "bg-amber-500/60", text: "text-amber-100", label: "Medium" };
  return { bg: "bg-green-600/60", text: "text-green-100", label: "Low" };
}

function getRiskBadgeClasses(label: string): string {
  switch (label) {
    case "Critical": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "High": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "Medium": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    default: return "bg-green-500/20 text-green-400 border-green-500/30";
  }
}

// Map incident severity to matrix position {row (likelihood index), col (severity index)}
function mapIncidentToMatrix(severity: string): { row: number; col: number } {
  switch (severity) {
    case "critical": return { row: 1, col: 3 }; // Likely / Major
    case "high":     return { row: 1, col: 2 }; // Likely / Moderate
    case "medium":   return { row: 2, col: 1 }; // Possible / Minor
    case "low":      return { row: 3, col: 0 }; // Unlikely / Negligible
    default:         return { row: 4, col: 0 }; // Rare / Negligible
  }
}

export default function RiskMatrixPage({ token }: RiskMatrixPageProps) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Incident[]>("/api/incidents/", { token })
      .then(setIncidents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  // Build cell counts from incidents
  const cellCounts: Record<string, number> = {};
  incidents.forEach((inc) => {
    const pos = mapIncidentToMatrix(inc.severity);
    const key = `${pos.row}-${pos.col}`;
    cellCounts[key] = (cellCounts[key] || 0) + 1;
  });

  // Build risk register entries
  const riskRegister = incidents.map((inc) => {
    const pos = mapIncidentToMatrix(inc.severity);
    const score = RISK_MATRIX[pos.row][pos.col];
    const color = getRiskColor(score);
    return {
      id: inc.id,
      description: inc.title,
      severity: SEVERITY_LABELS[pos.col],
      likelihood: LIKELIHOOD_LABELS[pos.row],
      score,
      riskLevel: color.label,
      status: inc.status,
      incidentNumber: inc.incident_number,
    };
  });

  // Sort by score descending
  riskRegister.sort((a, b) => b.score - a.score);

  const totalRisks = incidents.length;
  const criticalCount = riskRegister.filter((r) => r.riskLevel === "Critical").length;
  const highCount = riskRegister.filter((r) => r.riskLevel === "High").length;
  const mediumCount = riskRegister.filter((r) => r.riskLevel === "Medium").length;
  const lowCount = riskRegister.filter((r) => r.riskLevel === "Low").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Risk Assessment Matrix</h1>
          <p className="text-gray-400 text-sm mt-1">5x5 risk matrix auto-populated from incident data</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4 border-l-4 border-red-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Critical</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{criticalCount}</p>
        </div>
        <div className="card p-4 border-l-4 border-orange-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide">High</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{highCount}</p>
        </div>
        <div className="card p-4 border-l-4 border-amber-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Medium</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{mediumCount}</p>
        </div>
        <div className="card p-4 border-l-4 border-green-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Low</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{lowCount}</p>
        </div>
      </div>

      {/* 5x5 Matrix */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Risk Matrix</h2>
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-flex items-start gap-2 min-w-[500px]">
              {/* Y-axis label */}
              <div className="flex flex-col items-center justify-center mr-1" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                <span className="text-xs font-semibold text-gray-400 tracking-widest uppercase">Likelihood</span>
              </div>

              <div>
                {/* Matrix grid */}
                <div className="grid grid-cols-6 gap-0.5">
                  {/* Top-left corner (empty) */}
                  <div className="w-24 h-10" />
                  {/* Severity column headers */}
                  {SEVERITY_LABELS.map((label) => (
                    <div key={label} className="w-24 h-10 flex items-end justify-center pb-1">
                      <span className="text-[10px] font-medium text-gray-400 text-center leading-tight">{label}</span>
                    </div>
                  ))}

                  {/* Matrix rows */}
                  {LIKELIHOOD_LABELS.map((likelihood, rowIdx) => (
                    <>
                      {/* Row label */}
                      <div key={`label-${rowIdx}`} className="w-24 h-16 flex items-center justify-end pr-2">
                        <span className="text-[10px] font-medium text-gray-400 text-right leading-tight">{likelihood}</span>
                      </div>
                      {/* Row cells */}
                      {SEVERITY_LABELS.map((_, colIdx) => {
                        const score = RISK_MATRIX[rowIdx][colIdx];
                        const color = getRiskColor(score);
                        const key = `${rowIdx}-${colIdx}`;
                        const count = cellCounts[key] || 0;
                        return (
                          <div
                            key={`cell-${rowIdx}-${colIdx}`}
                            className={`w-24 h-16 ${color.bg} rounded flex flex-col items-center justify-center gap-0.5 border border-white/5 hover:border-white/20 transition-colors relative`}
                          >
                            <span className={`text-lg font-bold ${color.text}`}>{score}</span>
                            {count > 0 && (
                              <div className="flex items-center gap-0.5">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                <span className="text-[10px] font-semibold text-white">{count}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  ))}
                </div>

                {/* X-axis label */}
                <div className="flex justify-center mt-2">
                  <span className="text-xs font-semibold text-gray-400 tracking-widest uppercase">Severity</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-navy-700">
          <span className="text-xs text-gray-500">Legend:</span>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-600/60" /><span className="text-xs text-gray-400">Low (1-4)</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-500/60" /><span className="text-xs text-gray-400">Medium (5-9)</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-orange-500/70" /><span className="text-xs text-gray-400">High (10-14)</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-600/80" /><span className="text-xs text-gray-400">Critical (15-25)</span></div>
        </div>
      </div>

      {/* Risk Register Table */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Risk Register ({totalRisks})</h2>
        {loading ? (
          <div className="flex items-center justify-center h-20 text-gray-400">Loading...</div>
        ) : riskRegister.length === 0 ? (
          <p className="text-gray-500 text-sm">No incidents found. Risks will appear here when incidents are reported.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-700">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium text-xs uppercase">ID</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium text-xs uppercase">Risk Description</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium text-xs uppercase">Severity</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium text-xs uppercase">Likelihood</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-medium text-xs uppercase">Rating</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-medium text-xs uppercase">Risk Level</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-medium text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {riskRegister.map((risk) => (
                  <tr key={risk.id} className="border-b border-navy-700/50 hover:bg-navy-800/50 transition-colors">
                    <td className="py-2.5 px-3 text-gray-500 font-mono text-xs">{risk.incidentNumber}</td>
                    <td className="py-2.5 px-3 text-gray-200">{risk.description}</td>
                    <td className="py-2.5 px-3 text-gray-300">{risk.severity}</td>
                    <td className="py-2.5 px-3 text-gray-300">{risk.likelihood}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="font-bold text-white">{risk.score}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${getRiskBadgeClasses(risk.riskLevel)}`}>
                        {risk.riskLevel}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-xs text-gray-400 capitalize">{risk.status.replace(/_/g, " ")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
