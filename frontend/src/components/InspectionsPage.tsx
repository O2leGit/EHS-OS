"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Template {
  name: string;
  category: string;
  items: string[];
}

interface Inspection {
  id: string;
  template_name: string;
  inspector_name: string;
  status: string;
  score: number | null;
  total_items: number | null;
  passed_items: number | null;
  failed_items: number | null;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
}

interface InspectionsPageProps {
  token: string;
}

type ItemResult = "pass" | "fail" | "na";

export default function InspectionsPage({ token }: InspectionsPageProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [mode, setMode] = useState<"list" | "new">("list");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [results, setResults] = useState<Record<number, ItemResult>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    try {
      const [t, i] = await Promise.all([
        api<Template[]>("/api/inspections/templates", { token }),
        api<Inspection[]>("/api/inspections/", { token }),
      ]);
      setTemplates(t);
      setInspections(i);
    } catch (err) {
      console.error("Failed to load inspections:", err);
    }
  };

  const startInspection = (template: Template) => {
    setSelectedTemplate(template);
    setResults({});
    setNotes("");
    setMode("new");
  };

  const setItemResult = (idx: number, value: ItemResult) => {
    setResults((prev) => ({ ...prev, [idx]: value }));
  };

  const handleSubmit = async () => {
    if (!selectedTemplate) return;
    setSubmitting(true);

    const totalItems = selectedTemplate.items.length;
    const answered = Object.values(results);
    const passedItems = answered.filter((r) => r === "pass").length;
    const failedItems = answered.filter((r) => r === "fail").length;
    const score = totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 0;

    try {
      await api("/api/inspections/", {
        token,
        method: "POST",
        body: {
          template_name: selectedTemplate.name,
          status: "completed",
          score,
          total_items: totalItems,
          passed_items: passedItems,
          failed_items: failedItems,
          notes: notes || null,
        },
      });
      setMode("list");
      loadData();
    } catch (err) {
      console.error("Failed to submit inspection:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return d;
    }
  };

  const scoreColor = (score: number | null) => {
    if (score === null) return "text-gray-400";
    if (score >= 90) return "text-green-400";
    if (score >= 70) return "text-yellow-400";
    return "text-red-400";
  };

  if (mode === "new" && selectedTemplate) {
    const totalItems = selectedTemplate.items.length;
    const answeredCount = Object.keys(results).length;

    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setMode("list")}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{selectedTemplate.name}</h1>
            <p className="text-sm text-gray-400">{selectedTemplate.category} - {answeredCount}/{totalItems} items checked</p>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          {selectedTemplate.items.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                results[idx] === "pass"
                  ? "bg-green-900/20 border-green-800"
                  : results[idx] === "fail"
                  ? "bg-red-900/20 border-red-800"
                  : results[idx] === "na"
                  ? "bg-gray-800/50 border-gray-700"
                  : "bg-navy-800 border-navy-700"
              }`}
            >
              <span className="text-sm text-gray-200 flex-1 mr-4">{item}</span>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setItemResult(idx, "pass")}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    results[idx] === "pass"
                      ? "bg-green-600 text-white"
                      : "bg-navy-700 text-gray-400 hover:bg-green-900/50 hover:text-green-300"
                  }`}
                >
                  Pass
                </button>
                <button
                  onClick={() => setItemResult(idx, "fail")}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    results[idx] === "fail"
                      ? "bg-red-600 text-white"
                      : "bg-navy-700 text-gray-400 hover:bg-red-900/50 hover:text-red-300"
                  }`}
                >
                  Fail
                </button>
                <button
                  onClick={() => setItemResult(idx, "na")}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    results[idx] === "na"
                      ? "bg-gray-600 text-white"
                      : "bg-navy-700 text-gray-400 hover:bg-gray-700 hover:text-gray-300"
                  }`}
                >
                  N/A
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-navy-800 border border-navy-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:border-safe focus:outline-none resize-none"
            placeholder="Add any observations or follow-up actions..."
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={submitting || answeredCount === 0}
            className="px-6 py-2.5 bg-safe hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {submitting ? "Submitting..." : "Complete Inspection"}
          </button>
          <button
            onClick={() => setMode("list")}
            className="px-6 py-2.5 bg-navy-700 hover:bg-navy-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Inspections</h1>
          <p className="text-sm text-gray-400 mt-1">{inspections.length} inspection{inspections.length !== 1 ? "s" : ""} recorded</p>
        </div>
      </div>

      {/* Template selector */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Start New Inspection</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {templates.map((t) => (
            <button
              key={t.name}
              onClick={() => startInspection(t)}
              className="flex flex-col items-start p-3 bg-navy-800 hover:bg-navy-700 border border-navy-700 hover:border-safe/50 rounded-lg transition-colors text-left group"
            >
              <span className="text-xs text-gray-500 mb-1">{t.category}</span>
              <span className="text-sm text-gray-200 group-hover:text-white font-medium leading-tight">{t.name}</span>
              <span className="text-xs text-gray-500 mt-1.5">{t.items.length} items</span>
            </button>
          ))}
        </div>
      </div>

      {/* Past inspections table */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Inspection History</h2>
        {inspections.length === 0 ? (
          <div className="text-center py-12 bg-navy-800 rounded-lg border border-navy-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <p className="text-gray-400 text-sm">No inspections yet. Select a template above to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-navy-700">
            <table className="w-full">
              <thead>
                <tr className="bg-navy-800 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Template</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Inspector</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Score</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Results</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700">
                {inspections.map((insp) => (
                  <tr key={insp.id} className="bg-navy-900 hover:bg-navy-800 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-300">{formatDate(insp.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-200 font-medium">{insp.template_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{insp.inspector_name || "-"}</td>
                    <td className={`px-4 py-3 text-sm font-bold ${scoreColor(insp.score)}`}>
                      {insp.score !== null ? `${insp.score}%` : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {insp.total_items !== null ? (
                        <span>
                          <span className="text-green-400">{insp.passed_items}</span>
                          {" / "}
                          <span className="text-red-400">{insp.failed_items}</span>
                          {" / "}
                          {insp.total_items}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        insp.status === "completed"
                          ? "bg-green-900/40 text-green-400"
                          : "bg-yellow-900/40 text-yellow-400"
                      }`}>
                        {insp.status === "completed" ? "Completed" : "In Progress"}
                      </span>
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
