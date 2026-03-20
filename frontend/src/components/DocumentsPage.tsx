"use client";

import { useState, useEffect, useCallback } from "react";
import { api, uploadFile } from "@/lib/api";

interface DocumentsPageProps {
  token: string;
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
          <div
            className="bg-green-500"
            style={{ width: `${pctCovered}%` }}
            title={`Covered: ${covered}`}
          />
        )}
        {pctPartial > 0 && (
          <div
            className="bg-amber-500"
            style={{ width: `${pctPartial}%` }}
            title={`Partial: ${partial}`}
          />
        )}
        {pctGap > 0 && (
          <div
            className="bg-red-500"
            style={{ width: `${pctGap}%` }}
            title={`Gap: ${gap}`}
          />
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
          <span className="text-xs font-mono text-gray-500 shrink-0">T{result.framework_tier} · {result.framework_series}</span>
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

function groupByTier(analyses: AnalysisResult[]): Record<string, AnalysisResult[]> {
  return analyses.reduce<Record<string, AnalysisResult[]>>((acc, a) => {
    const key = a.framework_tier || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});
}

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
    "1": "Tier 1 — Policy & Leadership",
    "2": "Tier 2 — Programs & Procedures",
    "3": "Tier 3 — Implementation",
    "4": "Tier 4 — Verification & Review",
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

export default function DocumentsPage({ token }: DocumentsPageProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchDocs = useCallback(() => {
    api<Document[]>("/api/documents/", { token }).then(setDocuments).catch(console.error);
  }, [token]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

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
    setUploadStatus("Uploading...");
    try {
      await uploadFile("/api/documents/upload", file, token);
      setUploadStatus("Processing with AI...");
      const interval = setInterval(() => {
        fetchDocs();
      }, 3000);
      setTimeout(() => {
        clearInterval(interval);
        setUploading(false);
        setUploadStatus("");
        fetchDocs();
      }, 30000);
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Documents</h1>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center mb-8 transition-colors ${
          dragActive
            ? "border-safe bg-green-900/10"
            : "border-navy-600 hover:border-navy-500"
        }`}
      >
        {uploading ? (
          <div>
            <div className="animate-spin w-8 h-8 border-2 border-safe border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-safe font-medium">{uploadStatus}</p>
          </div>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-gray-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-300 font-medium">Drop files here or click to upload</p>
            <p className="text-gray-500 text-sm mt-1">PDF, DOCX, or images. AI will analyze against EHS framework.</p>
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

      {/* Document list */}
      <div className="space-y-3">
        {documents.map((doc) => (
          <div key={doc.id} className="card-hover flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-navy-700 rounded-lg flex items-center justify-center text-gray-400 shrink-0">
                {doc.status === "processing" ? (
                  <div className="animate-spin w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
          <p className="text-gray-500 text-center py-8">No documents uploaded yet. Drop a file above to get started.</p>
        )}
      </div>

      {/* Detail slide-out panel */}
      {selectedDocId && (
        <DetailPanel
          detail={detail}
          loading={detailLoading}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}
