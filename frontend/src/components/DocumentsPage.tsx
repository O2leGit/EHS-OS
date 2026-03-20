"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, uploadFile } from "@/lib/api";

interface DocumentsPageProps {
  token: string;
  onOpenChat?: (message: string) => void;
}

interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
}

interface AnalysisResult {
  chunk_index: number;
  document_type: string;
  framework_tier: string;
  framework_category: string;
  framework_series: string;
  coverage_status: "covered" | "partial" | "gap";
  gaps: string;
  risk_severity: "high" | "medium" | "low" | null;
  ai_reasoning: string;
}

interface DocumentDetail {
  document: Document;
  analyses: AnalysisResult[];
}

interface SOPSection {
  heading: string;
  content: string;
}

interface SOPRegRef {
  citation: string;
  description: string;
}

interface SOPData {
  title: string;
  document_number: string;
  revision: string;
  sections: SOPSection[];
  regulatory_references: SOPRegRef[];
  ppe_required: string[];
  training_required: string[];
}

interface FrameworkCoverage {
  framework_tier: string;
  framework_category: string;
  framework_series: string;
  coverage_status: string;
  chunk_count: number;
}

interface GapItem {
  category: string;
  tier: string;
  series: string;
  description: string;
  severity: "high" | "medium";
  capaCreated: boolean;
  creating: boolean;
}

// --- Constants ---

const TIER_LABELS: Record<string, string> = {
  "1": "Tier 1 -- Policy & Leadership",
  "2": "Tier 2 -- Systems Manual",
  "3": "Tier 3 -- Standards & Procedures",
};

const SERIES_LABELS: Record<string, string> = {
  "100": "100s -- Management",
  "200": "200s -- Risk",
  "300": "300s -- Programs",
  "400": "400s -- Business Resilience",
};

const UPLOAD_STAGES = [
  { key: "uploading", label: "Uploading file..." },
  { key: "extracting", label: "Extracting text..." },
  { key: "analyzing", label: "Analyzing against Pfizer 4-Tier framework..." },
  { key: "complete", label: "Analysis complete!" },
] as const;

type UploadStage = typeof UPLOAD_STAGES[number]["key"] | null;

// --- Utility ---

function parseGaps(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === "string") return [parsed];
    return [String(parsed)];
  } catch {
    return [raw];
  }
}

// --- Sub-components ---

function CoverageBadge({ status }: { status: "covered" | "partial" | "gap" }) {
  if (status === "covered") return <span className="badge-safe">Covered</span>;
  if (status === "partial") return <span className="badge-warning">Partial</span>;
  return <span className="badge-critical">Gap</span>;
}

function SeverityBadge({ severity }: { severity: "high" | "medium" | "low" | null }) {
  if (!severity) return null;
  if (severity === "high") return <span className="badge-critical text-xs">High Risk</span>;
  if (severity === "medium") return <span className="badge-warning text-xs">Med Risk</span>;
  return <span className="badge-safe text-xs">Low Risk</span>;
}

function CoverageBar({ analyses }: { analyses: AnalysisResult[] }) {
  const total = analyses.length;
  if (total === 0) return null;
  const covered = analyses.filter((a) => a.coverage_status === "covered").length;
  const partial = analyses.filter((a) => a.coverage_status === "partial").length;
  const gap = analyses.filter((a) => a.coverage_status === "gap").length;
  const pctCovered = Math.round((covered / total) * 100);
  const pctPartial = Math.round((partial / total) * 100);
  const pctGap = Math.round((gap / total) * 100);

  return (
    <div>
      <div className="flex text-xs text-gray-400 mb-1 justify-between">
        <span>Coverage breakdown ({total} categories)</span>
        <span className="text-safe font-medium">{pctCovered}% fully covered</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {pctCovered > 0 && (
          <div className="bg-green-500" style={{ width: `${pctCovered}%` }} title={`Covered: ${covered}`} />
        )}
        {pctPartial > 0 && (
          <div className="bg-amber-500" style={{ width: `${pctPartial}%` }} title={`Partial: ${partial}`} />
        )}
        {pctGap > 0 && (
          <div className="bg-red-500" style={{ width: `${pctGap}%` }} title={`Gap: ${gap}`} />
        )}
      </div>
      <div className="flex gap-4 mt-2 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          {covered} Covered
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
          {partial} Partial
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          {gap} Gap
        </span>
      </div>
    </div>
  );
}

// --- Upload Progress Stepper ---

function UploadStepper({ currentStage }: { currentStage: UploadStage }) {
  if (!currentStage) return null;

  const stageIndex = UPLOAD_STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="flex items-center gap-0 w-full max-w-md">
        {UPLOAD_STAGES.map((stage, idx) => {
          const done = idx < stageIndex;
          const active = idx === stageIndex;
          const future = idx > stageIndex;

          return (
            <div key={stage.key} className="flex items-center flex-1 last:flex-none">
              {/* Circle */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-300 ${
                  done
                    ? "bg-green-600 border-green-500 text-white"
                    : active
                    ? "border-safe text-safe bg-green-900/30 animate-pulse"
                    : "border-navy-600 text-gray-600 bg-navy-800"
                }`}
              >
                {done ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-xs font-bold">{idx + 1}</span>
                )}
              </div>
              {/* Connector line */}
              {idx < UPLOAD_STAGES.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 transition-colors duration-300 ${
                    done ? "bg-green-600" : future ? "bg-navy-700" : "bg-safe/40"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className={`text-sm font-medium ${currentStage === "complete" ? "text-green-400" : "text-safe"}`}>
        {UPLOAD_STAGES[stageIndex]?.label}
      </p>
    </div>
  );
}

// --- Heatmap Cell Modal ---

function HeatmapModal({
  cell,
  onClose,
}: {
  cell: { category: string; status: string; reasoning: string; gaps: string; tier: string; series: string } | null;
  onClose: () => void;
}) {
  if (!cell) return null;

  const parsedGaps = parseGaps(cell.gaps);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-navy-900 border border-navy-600 rounded-xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-100">{cell.category}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Tier {cell.tier} / Series {cell.series}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-3">
          <span
            className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${
              cell.status === "covered"
                ? "bg-green-700 text-green-100"
                : cell.status === "partial"
                ? "bg-amber-700 text-amber-100"
                : "bg-red-900 text-red-200"
            }`}
          >
            {cell.status === "covered" ? "Covered" : cell.status === "partial" ? "Partial" : "Gap"}
          </span>
        </div>

        {parsedGaps.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Gaps Identified</p>
            <ul className="space-y-1">
              {parsedGaps.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-red-400 mt-0.5 shrink-0">&#x25CF;</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {cell.reasoning && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">AI Reasoning</p>
            <p className="text-sm text-gray-400 leading-relaxed">{cell.reasoning}</p>
          </div>
        )}

        {!cell.reasoning && parsedGaps.length === 0 && (
          <p className="text-sm text-gray-500">No additional details available for this category.</p>
        )}
      </div>
    </>
  );
}

// --- Framework Coverage Heatmap ---

function FrameworkHeatmap({
  analyses,
  title,
  onCellClick,
}: {
  analyses: (AnalysisResult | FrameworkCoverage)[];
  title: string;
  onCellClick?: (cell: { category: string; status: string; reasoning: string; gaps: string; tier: string; series: string }) => void;
}) {
  // Deduplicate by category -- pick worst status per category
  const categoryMap: Record<
    string,
    { category: string; tier: string; series: string; status: string; reasoning: string; gaps: string }
  > = {};

  const statusPriority: Record<string, number> = { gap: 0, partial: 1, covered: 2 };

  for (const item of analyses) {
    const key = `${item.framework_tier}-${item.framework_series}-${item.framework_category}`;
    const existing = categoryMap[key];
    const status = item.coverage_status ?? "gap";
    const reasoning = "ai_reasoning" in item ? (item as AnalysisResult).ai_reasoning : "";
    const gaps = "gaps" in item ? (item as AnalysisResult).gaps : "";

    if (!existing || (statusPriority[status] ?? 2) < (statusPriority[existing.status] ?? 2)) {
      categoryMap[key] = {
        category: item.framework_category,
        tier: item.framework_tier,
        series: item.framework_series,
        status,
        reasoning: reasoning || existing?.reasoning || "",
        gaps: gaps || existing?.gaps || "",
      };
    }
  }

  const items = Object.values(categoryMap);

  // Group by tier then series
  const tierGroups: Record<string, Record<string, typeof items>> = {};
  for (const item of items) {
    const tier = item.tier || "unknown";
    const series = item.series || "other";
    if (!tierGroups[tier]) tierGroups[tier] = {};
    if (!tierGroups[tier][series]) tierGroups[tier][series] = [];
    tierGroups[tier][series].push(item);
  }

  if (items.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <p className="text-gray-400 text-sm">No framework analysis data available. Upload and analyze documents to see coverage.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      <div className="flex gap-4 mb-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-500" /> Covered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" /> Partial
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> Gap
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-gray-700" /> Not Assessed
        </span>
      </div>

      <div className="space-y-5">
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
                          {tierGroups[tier][series].map((item, idx) => {
                            const color =
                              item.status === "covered"
                                ? "bg-green-700 border-green-600 text-green-100 hover:bg-green-600"
                                : item.status === "partial"
                                ? "bg-amber-700 border-amber-600 text-amber-100 hover:bg-amber-600"
                                : "bg-red-900 border-red-700 text-red-200 hover:bg-red-800";
                            return (
                              <button
                                key={idx}
                                onClick={() =>
                                  onCellClick?.({
                                    category: item.category,
                                    status: item.status,
                                    reasoning: item.reasoning,
                                    gaps: item.gaps,
                                    tier: item.tier,
                                    series: item.series,
                                  })
                                }
                                title={`${item.category} -- ${item.status} (click for details)`}
                                className={`border rounded px-2 py-1 text-xs cursor-pointer transition-colors ${color}`}
                              >
                                {item.category}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.values(tierGroups[tier])
                    .flat()
                    .map((item, idx) => {
                      const color =
                        item.status === "covered"
                          ? "bg-green-700 border-green-600 text-green-100 hover:bg-green-600"
                          : item.status === "partial"
                          ? "bg-amber-700 border-amber-600 text-amber-100 hover:bg-amber-600"
                          : "bg-red-900 border-red-700 text-red-200 hover:bg-red-800";
                      return (
                        <button
                          key={idx}
                          onClick={() =>
                            onCellClick?.({
                              category: item.category,
                              status: item.status,
                              reasoning: item.reasoning,
                              gaps: item.gaps,
                              tier: item.tier,
                              series: item.series,
                            })
                          }
                          title={`${item.category} -- ${item.status} (click for details)`}
                          className={`border rounded px-2 py-1 text-xs cursor-pointer transition-colors ${color}`}
                        >
                          {item.category}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}


// --- Top 5 Gaps ---

function TopGaps({
  gaps,
  onCreateCapa,
}: {
  gaps: GapItem[];
  onCreateCapa: (gap: GapItem, index: number) => void;
}) {
  if (gaps.length === 0) return null;

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1">Top 5 Critical Gaps</h2>
      <p className="text-xs text-gray-500 mb-4">Most critical gaps identified across analyzed documents</p>

      <div className="space-y-3">
        {gaps.map((gap, idx) => (
          <div
            key={idx}
            className="flex items-start justify-between p-3 rounded-lg bg-navy-800/60 border border-navy-700"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-gray-500">T{gap.tier} / {gap.series}</span>
                <span className="font-medium text-sm text-gray-200">{gap.category}</span>
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    gap.severity === "high"
                      ? "bg-red-900/60 text-red-300 border border-red-800"
                      : "bg-amber-900/60 text-amber-300 border border-amber-800"
                  }`}
                >
                  {gap.severity === "high" ? "High Risk" : "Medium Risk"}
                </span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">{gap.description}</p>
            </div>
            <div className="shrink-0 ml-4">
              {gap.capaCreated ? (
                <span className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  CAPA Created
                </span>
              ) : (
                <button
                  onClick={() => onCreateCapa(gap, idx)}
                  disabled={gap.creating}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-900/40 text-red-300 border border-red-800 hover:bg-red-800/60 transition-colors disabled:opacity-50"
                >
                  {gap.creating ? (
                    <span className="flex items-center gap-1.5">
                      <div className="animate-spin w-3 h-3 border border-red-400 border-t-transparent rounded-full" />
                      Creating...
                    </span>
                  ) : (
                    "Create CAPA"
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Analysis Row ---

function AnalysisRow({ result }: { result: AnalysisResult }) {
  const [expanded, setExpanded] = useState(false);
  const gaps = parseGaps(result.gaps);

  return (
    <div className="border border-navy-700 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-navy-800 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-mono text-gray-500 shrink-0">T{result.framework_tier} / {result.framework_series}</span>
          <span className="font-medium text-sm text-gray-200 truncate">{result.framework_category}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <SeverityBadge severity={result.risk_severity} />
          <CoverageBadge status={result.coverage_status} />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-navy-700 bg-navy-900/50">
          {gaps.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Identified Gaps</p>
              <ul className="space-y-1">
                {gaps.map((gap, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-red-400 mt-0.5 shrink-0">&#x25CF;</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.ai_reasoning && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">AI Reasoning</p>
              <p className="text-sm text-gray-400 leading-relaxed">{result.ai_reasoning}</p>
            </div>
          )}
          {gaps.length === 0 && !result.ai_reasoning && (
            <p className="text-sm text-gray-500 mt-3">No additional details available.</p>
          )}
        </div>
      )}
    </div>
  );
}

// --- Tier grouping ---

function groupByTier(analyses: AnalysisResult[]): Record<string, AnalysisResult[]> {
  return analyses.reduce<Record<string, AnalysisResult[]>>((acc, a) => {
    const key = a.framework_tier || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});
}

// --- Detail Panel ---

function DetailPanel({
  detail,
  loading,
  onClose,
}: {
  detail: DocumentDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  const tierLabels: Record<string, string> = {
    "1": "Tier 1 -- Policy & Leadership",
    "2": "Tier 2 -- Programs & Procedures",
    "3": "Tier 3 -- Implementation",
    "4": "Tier 4 -- Verification & Review",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl flex flex-col bg-navy-950 shadow-2xl border-l border-navy-700 overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700 shrink-0">
          <h2 className="text-lg font-bold text-gray-100">
            {detail ? detail.document.filename : "Loading analysis..."}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors p-1"
            aria-label="Close panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin w-10 h-10 border-2 border-safe border-t-transparent rounded-full mb-4" />
              <p className="text-gray-400">Loading analysis results...</p>
            </div>
          )}

          {!loading && detail && (
            <>
              {/* Document metadata */}
              <div className="card flex flex-wrap gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Type</p>
                  <p className="text-gray-300">{detail.document.file_type.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Size</p>
                  <p className="text-gray-300">{(detail.document.file_size / 1024).toFixed(0)} KB</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Uploaded</p>
                  <p className="text-gray-300">{new Date(detail.document.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Status</p>
                  <p className="text-gray-300 capitalize">{detail.document.status}</p>
                </div>
              </div>

              {detail.analyses.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  No analysis results found for this document.
                </div>
              ) : (
                <>
                  {/* Coverage bar */}
                  <div className="card">
                    <CoverageBar analyses={detail.analyses} />
                  </div>

                  {/* Results grouped by tier */}
                  {Object.entries(groupByTier(detail.analyses))
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([tier, results]) => (
                      <div key={tier}>
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                          {tierLabels[tier] || `Tier ${tier}`}
                          <span className="ml-2 text-gray-600 normal-case">({results.length} categories)</span>
                        </h3>
                        <div className="space-y-2">
                          {results.map((r, i) => (
                            <AnalysisRow key={`${r.framework_series}-${r.chunk_index}-${i}`} result={r} />
                          ))}
                        </div>
                      </div>
                    ))}
                </>
              )}
            </>
          )}

          {!loading && !detail && (
            <div className="text-center py-10 text-gray-500">
              Failed to load analysis. Please try again.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// --- SOP Preview ---

function SOPPreview({ sop, onClose }: { sop: SOPData; onClose: () => void }) {
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const sectionsHtml = sop.sections
      .map(
        (s) =>
          `<div style="margin-bottom:24px"><h2 style="font-size:16px;font-weight:700;margin-bottom:8px;color:#1a1a1a;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:4px">${s.heading}</h2><div style="font-size:14px;line-height:1.7;color:#333;white-space:pre-wrap">${s.content}</div></div>`
      )
      .join("");

    const refsHtml = sop.regulatory_references
      .map((r) => `<li><strong>${r.citation}</strong> -- ${r.description}</li>`)
      .join("");

    const ppeHtml = sop.ppe_required.map((p) => `<li>${p}</li>`).join("");

    printWindow.document.write(`<!DOCTYPE html><html><head><title>${sop.title}</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#333}@media print{body{margin:20px}}</style></head><body>
      <h1 style="font-size:22px;margin-bottom:4px">${sop.title}</h1>
      <p style="color:#666;font-size:13px">${sop.document_number} | ${sop.revision}</p>
      <hr style="margin:16px 0">
      ${sectionsHtml}
      ${refsHtml ? `<h2 style="font-size:16px;font-weight:700;margin-top:32px;border-bottom:1px solid #ddd;padding-bottom:4px">REGULATORY REFERENCES</h2><ul>${refsHtml}</ul>` : ""}
      ${ppeHtml ? `<h2 style="font-size:16px;font-weight:700;margin-top:32px;border-bottom:1px solid #ddd;padding-bottom:4px">PPE REQUIRED</h2><ul>${ppeHtml}</ul>` : ""}
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="mb-8">
      {/* Controls bar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-100">Generated SOP Draft</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="text-xs px-4 py-2 rounded-lg font-medium bg-navy-700 text-gray-200 border border-navy-600 hover:bg-navy-600 transition-colors"
          >
            Download / Print
          </button>
          <button
            onClick={onClose}
            className="text-xs px-4 py-2 rounded-lg font-medium bg-navy-800 text-gray-400 border border-navy-700 hover:bg-navy-700 hover:text-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Document-style card with light background */}
      <div className="bg-white rounded-xl shadow-xl p-8 md:p-10 max-w-4xl mx-auto">
        {/* Header */}
        <div className="border-b-2 border-gray-300 pb-4 mb-6">
          <h1 className="text-xl font-bold text-gray-900">{sop.title}</h1>
          <div className="flex gap-6 mt-2 text-sm text-gray-500">
            <span>Doc #: {sop.document_number}</span>
            <span>Rev: {sop.revision}</span>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {sop.sections.map((section, idx) => (
            <div key={idx}>
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-2">
                {section.heading}
              </h2>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {section.content}
              </div>
            </div>
          ))}
        </div>

        {/* Regulatory references */}
        {sop.regulatory_references.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Regulatory References</h3>
            <div className="flex flex-wrap gap-2">
              {sop.regulatory_references.map((ref, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200"
                  title={ref.description}
                >
                  {ref.citation}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* PPE */}
        {sop.ppe_required.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">PPE Required</h3>
            <div className="flex flex-wrap gap-2">
              {sop.ppe_required.map((ppe, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200"
                >
                  {ppe}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Training */}
        {sop.training_required.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Training Required</h3>
            <div className="flex flex-wrap gap-2">
              {sop.training_required.map((t, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-800 border border-green-200"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// AI PROMPT BAR
// =============================================================================

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
            <span className="text-xs text-cyan-400 block mb-0.5">Ask AI</span>
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DocumentsPage({ token, onOpenChat }: DocumentsPageProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // SOP Generator state
  const [sopFormOpen, setSopFormOpen] = useState(false);
  const [sopTopic, setSopTopic] = useState("");
  const [sopFacility, setSopFacility] = useState("");
  const [sopContext, setSopContext] = useState("");
  const [sopGenerating, setSopGenerating] = useState(false);
  const [sopResult, setSopResult] = useState<SOPData | null>(null);
  const [sopError, setSopError] = useState<string | null>(null);

  // Framework coverage heatmap state (aggregated across all docs)
  const [frameworkCoverage, setFrameworkCoverage] = useState<FrameworkCoverage[]>([]);
  // Heatmap from selected document's analyses
  const [heatmapModalCell, setHeatmapModalCell] = useState<{
    category: string;
    status: string;
    reasoning: string;
    gaps: string;
    tier: string;
    series: string;
  } | null>(null);

  // Top 5 gaps
  const [topGaps, setTopGaps] = useState<GapItem[]>([]);

  // Upload polling ref
  const uploadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyzeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDocs = useCallback(() => {
    api<Document[]>("/api/documents/", { token }).then(setDocuments).catch(console.error);
  }, [token]);

  const fetchCoverage = useCallback(() => {
    api<FrameworkCoverage[]>("/api/dashboard/framework-coverage", { token })
      .then(setFrameworkCoverage)
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    fetchDocs();
    fetchCoverage();
  }, [fetchDocs, fetchCoverage]);

  // Derive top 5 gaps from framework coverage + document analyses
  useEffect(() => {
    deriveTopGaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameworkCoverage, documents]);

  function deriveTopGaps() {
    // Build gap items from aggregated framework coverage
    const gapItems: GapItem[] = [];

    for (const item of frameworkCoverage) {
      if (item.coverage_status === "gap" || item.coverage_status === "partial") {
        gapItems.push({
          category: item.framework_category,
          tier: item.framework_tier,
          series: item.framework_series,
          description:
            item.coverage_status === "gap"
              ? `No documentation found covering ${item.framework_category}. This framework requirement is unaddressed.`
              : `Partial coverage found for ${item.framework_category}. Documentation exists but does not fully meet framework requirements.`,
          severity: item.coverage_status === "gap" ? "high" : "medium",
          capaCreated: false,
          creating: false,
        });
      }
    }

    // Sort: high severity first, then by tier/series
    gapItems.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "high" ? -1 : 1;
      if (a.tier !== b.tier) return a.tier.localeCompare(b.tier);
      return a.series.localeCompare(b.series);
    });

    setTopGaps(gapItems.slice(0, 5));
  }

  const openDetail = useCallback(
    async (docId: string) => {
      setSelectedDocId(docId);
      setDetail(null);
      setDetailLoading(true);
      try {
        const data = await api<DocumentDetail>(`/api/documents/${docId}`, { token });
        setDetail(data);
      } catch (err) {
        console.error("Failed to load document detail:", err);
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [token]
  );

  const closeDetail = () => {
    setSelectedDocId(null);
    setDetail(null);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadStage("uploading");

    // Clean up any previous timers
    if (uploadIntervalRef.current) clearInterval(uploadIntervalRef.current);
    if (uploadTimerRef.current) clearTimeout(uploadTimerRef.current);
    if (analyzeTimerRef.current) clearTimeout(analyzeTimerRef.current);

    try {
      await uploadFile("/api/documents/upload", file, token);

      // Stage 2: Extracting
      setUploadStage("extracting");

      // Stage 3: Analyzing (after 5 seconds)
      analyzeTimerRef.current = setTimeout(() => {
        setUploadStage("analyzing");
      }, 5000);

      // Poll for completion
      uploadIntervalRef.current = setInterval(async () => {
        try {
          const docs = await api<Document[]>("/api/documents/", { token });
          setDocuments(docs);

          // Check if the latest document is analyzed
          const latestAnalyzed = docs.find(
            (d) => d.filename === file.name && d.status === "analyzed"
          );
          if (latestAnalyzed) {
            // Stage 4: Complete
            if (analyzeTimerRef.current) clearTimeout(analyzeTimerRef.current);
            setUploadStage("complete");

            // Refresh coverage data
            fetchCoverage();

            // Clear after 2 seconds
            setTimeout(() => {
              setUploading(false);
              setUploadStage(null);
            }, 2000);

            if (uploadIntervalRef.current) clearInterval(uploadIntervalRef.current);
          }
        } catch {
          // Silently retry
        }
      }, 3000);

      // Timeout after 60 seconds
      uploadTimerRef.current = setTimeout(() => {
        if (uploadIntervalRef.current) clearInterval(uploadIntervalRef.current);
        if (analyzeTimerRef.current) clearTimeout(analyzeTimerRef.current);
        setUploading(false);
        setUploadStage(null);
        fetchDocs();
        fetchCoverage();
      }, 60000);
    } catch (err) {
      setUploadStage(null);
      setUploading(false);
      // Show error via a simple alert fallback
      console.error("Upload failed:", err);
    }
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (uploadIntervalRef.current) clearInterval(uploadIntervalRef.current);
      if (uploadTimerRef.current) clearTimeout(uploadTimerRef.current);
      if (analyzeTimerRef.current) clearTimeout(analyzeTimerRef.current);
    };
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleCreateCapa = async (gap: GapItem, index: number) => {
    setTopGaps((prev) =>
      prev.map((g, i) => (i === index ? { ...g, creating: true } : g))
    );

    try {
      await api("/api/capa/", {
        token,
        method: "POST",
        body: {
          title: `Address gap: ${gap.category}`,
          description: gap.description,
          capa_type: "corrective",
          priority: gap.severity === "high" ? "critical" : "high",
        },
      });

      setTopGaps((prev) =>
        prev.map((g, i) =>
          i === index ? { ...g, creating: false, capaCreated: true } : g
        )
      );
    } catch (err) {
      console.error("Failed to create CAPA:", err);
      setTopGaps((prev) =>
        prev.map((g, i) => (i === index ? { ...g, creating: false } : g))
      );
    }
  };

  const handleGenerateSop = async () => {
    if (!sopTopic.trim()) return;
    setSopGenerating(true);
    setSopError(null);
    setSopResult(null);

    try {
      const result = await api<{ sop: SOPData; document_id: string | null }>(
        "/api/documents/generate-sop",
        {
          token,
          method: "POST",
          body: {
            topic: sopTopic.trim(),
            facility: sopFacility.trim() || undefined,
            additional_context: sopContext.trim() || undefined,
          },
        }
      );
      setSopResult(result.sop);
      setSopFormOpen(false);
    } catch (err) {
      setSopError(err instanceof Error ? err.message : "SOP generation failed");
    } finally {
      setSopGenerating(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "analyzed":
        return <span className="badge-safe">Analyzed</span>;
      case "processing":
        return <span className="badge-warning">Processing</span>;
      case "error":
        return <span className="badge-critical">Error</span>;
      default:
        return <span className="badge-info">{status}</span>;
    }
  };

  // Build heatmap data: use selected document analyses if available, otherwise aggregated coverage
  const heatmapAnalyses: (AnalysisResult | FrameworkCoverage)[] =
    detail && detail.analyses.length > 0 ? detail.analyses : frameworkCoverage;

  const heatmapTitle =
    detail && detail.analyses.length > 0
      ? `Framework Coverage -- ${detail.document.filename}`
      : "Framework Coverage Heatmap";

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Documents</h1>

      {/* AI Prompt Bar */}
      <AiPromptBar
        onOpenChat={onOpenChat}
        prompts={[
          "What gaps does my documentation have?",
          "Help me write an SOP",
          "What documents do I need for OSHA compliance?",
        ]}
      />

      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center mb-8 transition-colors ${
          dragActive
            ? "border-safe bg-green-900/10"
            : "border-navy-600 hover:border-navy-500"
        }`}
      >
        {uploading ? (
          <UploadStepper currentStage={uploadStage} />
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-12 h-12 text-gray-500 mx-auto mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-gray-300 font-medium">Drop files here or click to upload</p>
            <p className="text-gray-500 text-sm mt-1">
              PDF, DOCX, or images. AI will analyze against EHS framework.
            </p>
            <input
              type="file"
              accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.tiff"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="btn-primary inline-block mt-4 cursor-pointer">
              Choose File
            </label>
          </>
        )}
      </div>

      {/* SOP Generator */}
      {sopResult ? (
        <SOPPreview
          sop={sopResult}
          onClose={() => {
            setSopResult(null);
            setSopTopic("");
            setSopFacility("");
            setSopContext("");
          }}
        />
      ) : sopFormOpen ? (
        <div className="card mb-8">
          <h2 className="text-base font-bold text-gray-100 mb-4">Generate SOP Draft</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                What SOP do you need? <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={sopTopic}
                onChange={(e) => setSopTopic(e.target.value)}
                placeholder="e.g., Chemical Waste Disposal, Fume Hood Operation, Biosafety Cabinet Use"
                className="w-full rounded-lg bg-navy-800 border border-navy-600 text-gray-200 px-4 py-2.5 text-sm placeholder:text-gray-600 focus:outline-none focus:border-safe/60 focus:ring-1 focus:ring-safe/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Which facility/lab?
              </label>
              <input
                type="text"
                value={sopFacility}
                onChange={(e) => setSopFacility(e.target.value)}
                placeholder="e.g., Building A - Chemistry Lab 201"
                className="w-full rounded-lg bg-navy-800 border border-navy-600 text-gray-200 px-4 py-2.5 text-sm placeholder:text-gray-600 focus:outline-none focus:border-safe/60 focus:ring-1 focus:ring-safe/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Any specific requirements?
              </label>
              <textarea
                value={sopContext}
                onChange={(e) => setSopContext(e.target.value)}
                rows={3}
                placeholder="e.g., Must include cyanide handling precautions, needs to reference site-specific emergency contacts"
                className="w-full rounded-lg bg-navy-800 border border-navy-600 text-gray-200 px-4 py-2.5 text-sm placeholder:text-gray-600 focus:outline-none focus:border-safe/60 focus:ring-1 focus:ring-safe/30 resize-none"
              />
            </div>
            {sopError && (
              <div className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-2">
                {sopError}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerateSop}
                disabled={!sopTopic.trim() || sopGenerating}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sopGenerating ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    <span>Generating SOP draft...</span>
                    <span className="inline-block animate-pulse">&#10024;</span>
                  </>
                ) : (
                  "Generate Draft"
                )}
              </button>
              <button
                onClick={() => {
                  setSopFormOpen(false);
                  setSopError(null);
                }}
                disabled={sopGenerating}
                className="text-sm text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setSopFormOpen(true)}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium bg-navy-700 text-gray-200 border border-navy-600 hover:bg-navy-600 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Generate SOP
          </button>
        </div>
      )}

      {/* Document list */}
      <div className="space-y-3 mb-8">
        {documents.map((doc) => (
          <div key={doc.id} className="card-hover flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-navy-700 rounded-lg flex items-center justify-center text-gray-400 shrink-0">
                {doc.status === "processing" ? (
                  <div className="animate-spin w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{doc.filename}</p>
                <p className="text-sm text-gray-500">
                  {(doc.file_size / 1024).toFixed(0)} KB
                  {" / "}
                  {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
              {statusBadge(doc.status)}
              {doc.status === "analyzed" && (
                <button
                  onClick={() => openDetail(doc.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    selectedDocId === doc.id
                      ? "bg-safe/20 text-safe border border-safe/40"
                      : "bg-navy-700 text-gray-300 hover:bg-navy-600 hover:text-gray-100 border border-navy-600"
                  }`}
                >
                  View Analysis
                </button>
              )}
              {doc.status === "processing" && (
                <span className="text-xs text-amber-400 animate-pulse">Analyzing...</span>
              )}
            </div>
          </div>
        ))}
        {documents.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No documents uploaded yet. Drop a file above to get started.
          </p>
        )}
      </div>

      {/* Framework Coverage Heatmap */}
      <div className="mb-6">
        <FrameworkHeatmap
          analyses={heatmapAnalyses}
          title={heatmapTitle}
          onCellClick={(cell) => setHeatmapModalCell(cell)}
        />
      </div>

      {/* Top 5 Gaps */}
      <div className="mb-6">
        <TopGaps gaps={topGaps} onCreateCapa={handleCreateCapa} />
      </div>

      {/* Heatmap cell detail modal */}
      <HeatmapModal cell={heatmapModalCell} onClose={() => setHeatmapModalCell(null)} />

      {/* Detail slide-out panel */}
      {selectedDocId && (
        <DetailPanel detail={detail} loading={detailLoading} onClose={closeDetail} />
      )}
    </div>
  );
}
