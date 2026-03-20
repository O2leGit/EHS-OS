"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function CapaPage({ token }: CapaPageProps) {
  const [capas, setCapas] = useState<Capa[]>([]);

  const fetchCapas = useCallback(() => {
    api<Capa[]>("/api/capa/", { token }).then(setCapas).catch(console.error);
  }, [token]);

  useEffect(() => {
    fetchCapas();
  }, [fetchCapas]);

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
                <div key={capa.id} className="card-hover !p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-gray-500">{capa.capa_number}</span>
                    <span className={`text-xs font-medium ${priorityColor(capa.priority)}`}>
                      {capa.priority}
                    </span>
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
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
