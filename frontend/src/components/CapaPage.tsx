"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

interface CapaPageProps {
  token: string;
}

interface Capa {
  id: string;
  capa_number: string;
  title: string;
  description?: string;
  capa_type: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  incident_number: string | null;
  incident_title?: string | null;
  assigned_to_name: string | null;
  root_cause?: string | null;
}

type ChangeableStatus = "open" | "in_progress" | "closed";
type ViewMode = "board" | "list";
type PriorityFilter = "all" | "critical" | "high" | "medium" | "low";
type TypeFilter = "all" | "corrective" | "preventive";

const statusColumns = ["open", "in_progress", "overdue", "closed"];
const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  overdue: "Overdue",
  closed: "Closed",
};
const statusColors: Record<string, string> = {
  open: "border-blue-600",
  in_progress: "border-amber-600",
  overdue: "border-red-600",
  closed: "border-green-600",
};

const changeableStatuses: { value: ChangeableStatus; label: string; color: string }[] = [
  { value: "open", label: "Mark Open", color: "text-blue-400 hover:bg-blue-900/40" },
  { value: "in_progress", label: "Mark In Progress", color: "text-amber-400 hover:bg-amber-900/40" },
  { value: "closed", label: "Mark Closed", color: "text-green-400 hover:bg-green-900/40" },
];

function isOverdue(capa: Capa): boolean {
  return capa.status !== "closed" && !!capa.due_date && new Date(capa.due_date) < new Date();
}

function daysUntilDue(dueDate: string | null): { days: number; label: string; overdue: boolean } | null {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { days: Math.abs(diff), label: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { days: 0, label: "Due today", overdue: false };
  return { days: diff, label: `${diff}d remaining`, overdue: false };
}

function priorityColor(p: string): string {
  switch (p) {
    case "critical": return "text-red-400";
    case "high": return "text-orange-400";
    case "medium": return "text-amber-400";
    default: return "text-green-400";
  }
}

function priorityBgColor(p: string): string {
  switch (p) {
    case "critical": return "bg-red-900/40 text-red-300 border-red-700";
    case "high": return "bg-orange-900/40 text-orange-300 border-orange-700";
    case "medium": return "bg-amber-900/40 text-amber-300 border-amber-700";
    default: return "bg-green-900/40 text-green-300 border-green-700";
  }
}

function typeBadgeColor(t: string): string {
  return t === "corrective"
    ? "bg-blue-900/40 text-blue-300 border-blue-700"
    : "bg-purple-900/40 text-purple-300 border-purple-700";
}

function statusBadgeColor(s: string): string {
  switch (s) {
    case "open": return "bg-blue-900/40 text-blue-300";
    case "in_progress": return "bg-amber-900/40 text-amber-300";
    case "closed": return "bg-green-900/40 text-green-300";
    default: return "bg-gray-800 text-gray-300";
  }
}

export default function CapaPage({ token }: CapaPageProps) {
  const [capas, setCapas] = useState<Capa[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedCapa, setSelectedCapa] = useState<Capa | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedCapaId, setDraggedCapaId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const fetchCapas = useCallback(() => {
    api<Capa[]>("/api/capa/", { token }).then(setCapas).catch(console.error);
  }, [token]);

  useEffect(() => {
    fetchCapas();
  }, [fetchCapas]);

  // Dismiss dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    }
    if (activeDropdown) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activeDropdown]);

  // Filter logic
  const filteredCapas = capas.filter((c) => {
    if (priorityFilter !== "all" && c.priority !== priorityFilter) return false;
    if (typeFilter !== "all" && c.capa_type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !c.title.toLowerCase().includes(q) &&
        !(c.description || "").toLowerCase().includes(q) &&
        !c.capa_number.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const getCapasForColumn = (status: string) => {
    if (status === "overdue") {
      return filteredCapas.filter(
        (c) => c.status !== "closed" && c.due_date && new Date(c.due_date) < new Date()
      );
    }
    return filteredCapas.filter((c) => c.status === status);
  };

  const getListCapas = () => {
    return [...filteredCapas].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  };

  const handleCardClick = (e: React.MouseEvent, capa: Capa) => {
    // If clicking the status dropdown area, don't open detail panel
    const target = e.target as HTMLElement;
    if (target.closest("[data-status-dropdown]")) return;
    setSelectedCapa(capa);
  };

  const handleStatusDropdownClick = (e: React.MouseEvent, capaId: string) => {
    e.stopPropagation();
    setActiveDropdown(activeDropdown === capaId ? null : capaId);
  };

  const handleStatusChange = async (capaId: string, newStatus: ChangeableStatus) => {
    setUpdatingId(capaId);
    setActiveDropdown(null);
    try {
      await api(`/api/capa/${capaId}`, {
        method: "PATCH",
        body: { status: newStatus },
        token,
      });
      fetchCapas();
      // Update detail panel if open
      if (selectedCapa && selectedCapa.id === capaId) {
        setSelectedCapa({ ...selectedCapa, status: newStatus });
      }
    } catch (err) {
      console.error("Failed to update CAPA status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, capaId: string) => {
    setDraggedCapaId(capaId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", capaId);
  };

  const handleDragOver = (e: React.DragEvent, column: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(column);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, column: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const capaId = e.dataTransfer.getData("text/plain");
    setDraggedCapaId(null);
    if (!capaId || column === "overdue") return; // Can't drop into overdue column
    const capa = capas.find((c) => c.id === capaId);
    if (!capa || capa.status === column) return;
    handleStatusChange(capaId, column as ChangeableStatus);
  };

  const handleDragEnd = () => {
    setDraggedCapaId(null);
    setDragOverColumn(null);
  };

  // Render a CAPA card (used in both board and list views)
  const renderCard = (capa: Capa) => {
    const overdue = isOverdue(capa);
    const dueInfo = daysUntilDue(capa.due_date);

    return (
      <div
        key={capa.id}
        className="relative"
        ref={activeDropdown === capa.id ? dropdownRef : null}
      >
        <div
          className={`card-hover !p-4 cursor-pointer transition-all ${
            updatingId === capa.id ? "opacity-50 pointer-events-none" : ""
          } ${overdue ? "!border-l-2 !border-l-red-500" : ""} ${
            draggedCapaId === capa.id ? "opacity-30" : ""
          }`}
          onClick={(e) => handleCardClick(e, capa)}
          draggable
          onDragStart={(e) => handleDragStart(e, capa.id)}
          onDragEnd={handleDragEnd}
          title="Click to view details. Drag to change status."
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-gray-500">{capa.capa_number}</span>
            <div className="flex items-center gap-2">
              {overdue && (
                <span className="text-[10px] font-bold text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Overdue
                </span>
              )}
              <span className={`text-xs font-medium ${priorityColor(capa.priority)}`}>
                {capa.priority}
              </span>
              {/* Status dropdown trigger */}
              <button
                data-status-dropdown="true"
                onClick={(e) => handleStatusDropdownClick(e, capa.id)}
                className="p-0.5 rounded hover:bg-white/10 transition-colors"
                title="Change status"
              >
                <svg
                  className={`w-3 h-3 text-gray-500 transition-transform ${
                    activeDropdown === capa.id ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
          <p className="text-sm font-medium mb-2">{capa.title}</p>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{capa.assigned_to_name || "Unassigned"}</span>
            {dueInfo && (
              <span className={dueInfo.overdue ? "text-red-400" : ""}>
                {dueInfo.overdue
                  ? dueInfo.label
                  : `Due ${new Date(capa.due_date!).toLocaleDateString()}`}
              </span>
            )}
          </div>
          {capa.incident_number && (
            <p className="text-xs text-gray-600 mt-1">Linked: {capa.incident_number}</p>
          )}
          {updatingId === capa.id && (
            <p className="text-xs text-blue-400 mt-2">Updating...</p>
          )}
        </div>

        {/* Status dropdown */}
        {activeDropdown === capa.id && (
          <div className="absolute left-0 right-0 z-50 mt-1 bg-navy-950 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
            <p className="text-xs text-gray-500 px-3 pt-2 pb-1 border-b border-gray-800">
              Change status
            </p>
            {changeableStatuses.map((s) => {
              const isCurrent = capa.status === s.value;
              return (
                <button
                  key={s.value}
                  disabled={isCurrent}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isCurrent) handleStatusChange(capa.id, s.value);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                    isCurrent
                      ? `${s.color.split(" ")[0]} opacity-40 cursor-not-allowed bg-white/5`
                      : `${s.color} cursor-pointer`
                  }`}
                >
                  <span>{s.label}</span>
                  {isCurrent && (
                    <span className="text-xs text-gray-500 italic">current</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">CAPA Board</h1>
        <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-1">
          <button
            onClick={() => setViewMode("board")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === "board"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            Board
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === "list"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            List
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
        {/* Priority filter */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">Priority:</span>
          {(["all", "critical", "high", "medium", "low"] as PriorityFilter[]).map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-2 py-1 text-xs rounded-full transition-colors capitalize ${
                priorityFilter === p
                  ? p === "all"
                    ? "bg-gray-600 text-white"
                    : p === "critical"
                    ? "bg-red-900/60 text-red-300"
                    : p === "high"
                    ? "bg-orange-900/60 text-orange-300"
                    : p === "medium"
                    ? "bg-amber-900/60 text-amber-300"
                    : "bg-green-900/60 text-green-300"
                  : "text-gray-400 hover:bg-gray-700"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">Type:</span>
          {(["all", "corrective", "preventive"] as TypeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2 py-1 text-xs rounded-full transition-colors capitalize ${
                typeFilter === t
                  ? t === "all"
                    ? "bg-gray-600 text-white"
                    : t === "corrective"
                    ? "bg-blue-900/60 text-blue-300"
                    : "bg-purple-900/60 text-purple-300"
                  : "text-gray-400 hover:bg-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by title, description, or CAPA #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800/60 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-600"
          />
        </div>

        {/* Active filter count */}
        {(priorityFilter !== "all" || typeFilter !== "all" || searchQuery) && (
          <button
            onClick={() => {
              setPriorityFilter("all");
              setTypeFilter("all");
              setSearchQuery("");
            }}
            className="text-xs text-gray-400 hover:text-white underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Board View */}
      {viewMode === "board" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statusColumns.map((col) => (
            <div
              key={col}
              onDragOver={(e) => col !== "overdue" ? handleDragOver(e, col) : undefined}
              onDragLeave={handleDragLeave}
              onDrop={(e) => col !== "overdue" ? handleDrop(e, col) : undefined}
              className={`transition-colors rounded-lg ${
                dragOverColumn === col ? "bg-blue-900/20 ring-1 ring-blue-500/30" : ""
              }`}
            >
              <div className={`border-t-2 ${statusColors[col]} mb-3 pt-2`}>
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                  {statusLabels[col]}
                  <span className="ml-2 text-gray-500">({getCapasForColumn(col).length})</span>
                </h2>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {getCapasForColumn(col).map((capa) => renderCard(capa))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="border border-gray-700/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">CAPA #</th>
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Priority</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Assignee</th>
                <th className="text-left px-4 py-3 font-medium">Due Date</th>
                <th className="text-left px-4 py-3 font-medium">Incident</th>
              </tr>
            </thead>
            <tbody>
              {getListCapas().map((capa) => {
                const overdue = isOverdue(capa);
                const dueInfo = daysUntilDue(capa.due_date);
                return (
                  <tr
                    key={capa.id}
                    onClick={(e) => handleCardClick(e, capa)}
                    className={`border-t border-gray-800 cursor-pointer hover:bg-gray-800/40 transition-colors ${
                      overdue ? "border-l-2 border-l-red-500" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-gray-500 text-xs">{capa.capa_number}</td>
                    <td className="px-4 py-3 text-gray-200 font-medium">
                      <div className="flex items-center gap-2">
                        {capa.title}
                        {overdue && (
                          <span className="text-[10px] font-bold text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Overdue
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded border ${typeBadgeColor(capa.capa_type)} capitalize`}>
                        {capa.capa_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium capitalize ${priorityColor(capa.priority)}`}>
                        {capa.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded capitalize ${statusBadgeColor(capa.status)}`}>
                        {statusLabels[capa.status] || capa.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{capa.assigned_to_name || "Unassigned"}</td>
                    <td className="px-4 py-3">
                      {capa.due_date ? (
                        <div>
                          <span className={dueInfo?.overdue ? "text-red-400" : "text-gray-300"}>
                            {new Date(capa.due_date).toLocaleDateString()}
                          </span>
                          {dueInfo && (
                            <span className={`text-xs ml-1 ${dueInfo.overdue ? "text-red-400" : "text-gray-500"}`}>
                              ({dueInfo.label})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-600">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{capa.incident_number || "--"}</td>
                  </tr>
                );
              })}
              {getListCapas().length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No CAPAs match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Slide-out Panel */}
      {selectedCapa && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedCapa(null)}
          />
          {/* Panel */}
          <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-gray-900 border-l border-gray-700 z-50 overflow-y-auto shadow-2xl animate-slide-in-right">
            {/* Header */}
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <span className="text-xs font-mono text-gray-500">{selectedCapa.capa_number}</span>
                <h2 className="text-lg font-bold text-white mt-0.5">{selectedCapa.title}</h2>
              </div>
              <button
                onClick={() => setSelectedCapa(null)}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-6">
              {/* Badges row */}
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs px-2.5 py-1 rounded border capitalize ${typeBadgeColor(selectedCapa.capa_type)}`}>
                  {selectedCapa.capa_type}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded border capitalize ${priorityBgColor(selectedCapa.priority)}`}>
                  {selectedCapa.priority} priority
                </span>
                {isOverdue(selectedCapa) && (
                  <span className="text-xs px-2.5 py-1 rounded bg-red-900/40 text-red-300 border border-red-700 font-bold uppercase">
                    Overdue
                  </span>
                )}
              </div>

              {/* Description */}
              {selectedCapa.description && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">{selectedCapa.description}</p>
                </div>
              )}

              {/* Status */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Status</h3>
                <div className="flex items-center gap-2">
                  <span className={`text-sm px-3 py-1 rounded capitalize ${statusBadgeColor(selectedCapa.status)}`}>
                    {statusLabels[selectedCapa.status] || selectedCapa.status}
                  </span>
                  <select
                    value={selectedCapa.status}
                    onChange={(e) => handleStatusChange(selectedCapa.id, e.target.value as ChangeableStatus)}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-blue-600"
                  >
                    {changeableStatuses.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label.replace("Mark ", "")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assigned to */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Assigned To</h3>
                <p className="text-sm text-gray-200">{selectedCapa.assigned_to_name || "Unassigned"}</p>
              </div>

              {/* Due date */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Due Date</h3>
                {selectedCapa.due_date ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-200">
                      {new Date(selectedCapa.due_date).toLocaleDateString("en-US", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {(() => {
                      const info = daysUntilDue(selectedCapa.due_date);
                      if (!info) return null;
                      return (
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            info.overdue
                              ? "bg-red-900/40 text-red-300"
                              : info.days <= 3
                              ? "bg-amber-900/40 text-amber-300"
                              : "bg-gray-800 text-gray-400"
                          }`}
                        >
                          {info.label}
                        </span>
                      );
                    })()}
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">No due date set</span>
                )}
              </div>

              {/* Linked Incident */}
              {selectedCapa.incident_number && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Linked Incident</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-blue-400">{selectedCapa.incident_number}</span>
                    {selectedCapa.incident_title && (
                      <span className="text-sm text-gray-300">{selectedCapa.incident_title}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Root Cause */}
              {selectedCapa.root_cause && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Root Cause</h3>
                  <p className="text-sm text-gray-300 bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                    {selectedCapa.root_cause}
                  </p>
                </div>
              )}

              {/* Timeline */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Timeline</h3>
                <div className="border-l-2 border-gray-700 pl-4 space-y-3">
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-gray-600 border-2 border-gray-900" />
                    <p className="text-sm text-gray-400">
                      Created on{" "}
                      <span className="text-gray-200">
                        {new Date(selectedCapa.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </p>
                  </div>
                  {selectedCapa.due_date && (
                    <div className="relative">
                      <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${
                        isOverdue(selectedCapa) ? "bg-red-500" : "bg-gray-600"
                      }`} />
                      <p className="text-sm text-gray-400">
                        Due on{" "}
                        <span className={isOverdue(selectedCapa) ? "text-red-400" : "text-gray-200"}>
                          {new Date(selectedCapa.due_date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </p>
                    </div>
                  )}
                  {selectedCapa.status === "closed" && (
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-gray-900" />
                      <p className="text-sm text-gray-400">
                        Closed
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* CSS for slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
