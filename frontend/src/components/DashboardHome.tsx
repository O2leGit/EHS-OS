"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface DashboardHomeProps {
  token: string;
}

interface Summary {
  incidents_mtd: number;
  open_capas: number;
  overdue_capas: number;
  framework_coverage_pct: number;
}

export default function DashboardHome({ token }: DashboardHomeProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Summary>("/api/dashboard/summary", { token })
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <div className="text-gray-400">Loading dashboard...</div>;
  }

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
      label: "Framework Coverage",
      value: `${summary?.framework_coverage_pct ?? 0}%`,
      color: "text-green-400",
      bgColor: "bg-green-900/20",
      borderColor: "border-green-800",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <p className="text-gray-400 text-sm">Activity feed will populate as you use the system.</p>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Framework Coverage</h2>
          <p className="text-gray-400 text-sm">Upload documents to see framework coverage analysis.</p>
        </div>
      </div>
    </div>
  );
}
