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
  capa_type: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  incident_number: string | null;
  assigned_to_name: string | null;
}

type ChangeableStatus = "open" | "in_progress" | "closed";

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

export default function CapaPage({ token }: CapaPageProps) {
  const [capas, setCapas] = useState<Capa[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
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

  const getCapasForColumn = (status: string) => {
    if (status === "overdue") {
      return capas.filter(
        (c) => c.status !== "closed" && c.due_date && new Date(c.due_date) < new Date()
      );
    }
    return capas.filter((c) => c.status === status);
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case "critical": return "text-red-400";
      case "high": return "text-orange-400";
      case "medium": return "text-amber-400";
      default: return "text-green-400";
    }
  };

  const handleCardClick = (e: React.MouseEvent, capaId: string) => {
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
    } catch (err) {
      console.error("Failed to update CAPA status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">CAPA Board</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statusColumns.map((col) => (
          <div key={col}>
            <div className={`border-t-2 ${statusColors[col]} mb-3 pt-2`}>
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                {statusLabels[col]}
                <span className="ml-2 text-gray-500">({getCapasForColumn(col).length})</span>
              </h2>
            </div>
            <div className="space-y-2">
              {getCapasForColumn(col).map((capa) => (
                <div key={capa.id} className="relative" ref={activeDropdown === capa.id ? dropdownRef : null}>
                  {/* Card */}
                  <div
                    className={`card-hover !p-4 cursor-pointer transition-opacity ${
                      updatingId === capa.id ? "opacity-50 pointer-events-none" : ""
                    } ${
                      activeDropdown === capa.id ? "ring-1 ring-blue-500/50" : ""
                    }`}
                    onClick={(e) => handleCardClick(e, capa.id)}
                    title="Click to change status"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-gray-500">{capa.capa_number}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${priorityColor(capa.priority)}`}>
                          {capa.priority}
                        </span>
                        {/* Chevron icon indicating clickability */}
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
                      </div>
                    </div>
                    <p className="text-sm font-medium mb-2">{capa.title}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{capa.assigned_to_name || "Unassigned"}</span>
                      {capa.due_date && (
                        <span className={new Date(capa.due_date) < new Date() ? "text-red-400" : ""}>
                          Due {new Date(capa.due_date).toLocaleDateString()}
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
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
