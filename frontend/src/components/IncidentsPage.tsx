"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface IncidentsPageProps {
  token: string;
}

interface Incident {
  id: string;
  incident_number: string;
  incident_type: string;
  severity: string;
  title: string;
  status: string;
  location: string;
  created_at: string;
}

const typeColors: Record<string, string> = {
  injury: "badge-critical",
  near_miss: "badge-warning",
  hazard: "badge-warning",
  environmental: "badge-info",
  observation: "badge-safe",
};

const severityColors: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-amber-400",
  low: "text-green-400",
};

export default function IncidentsPage({ token }: IncidentsPageProps) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    incident_type: "near_miss",
    severity: "medium",
    title: "",
    description: "",
    location: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchIncidents = useCallback(() => {
    api<Incident[]>("/api/incidents/", { token }).then(setIncidents).catch(console.error);
  }, [token]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api("/api/incidents/", { method: "POST", body: formData, token });
      setShowForm(false);
      setFormData({ incident_type: "near_miss", severity: "medium", title: "", description: "", location: "" });
      fetchIncidents();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Incidents</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? "Cancel" : "Report Incident"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type</label>
              <select
                value={formData.incident_type}
                onChange={(e) => setFormData({ ...formData, incident_type: e.target.value })}
                className="input-field w-full"
              >
                <option value="injury">Injury</option>
                <option value="near_miss">Near Miss</option>
                <option value="hazard">Hazard</option>
                <option value="environmental">Environmental</option>
                <option value="observation">Observation</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Severity</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="input-field w-full"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Location</label>
              <input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="input-field w-full"
                placeholder="Building A - Lab 201"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="input-field w-full"
              placeholder="Brief description of the incident"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field w-full h-24"
              placeholder="Detailed description of what happened..."
            />
          </div>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Report"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {incidents.map((inc) => (
          <div key={inc.id} className="card-hover flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-mono text-gray-500">{inc.incident_number}</span>
                  <span className={typeColors[inc.incident_type] || "badge-info"}>
                    {inc.incident_type.replace("_", " ")}
                  </span>
                </div>
                <p className="font-medium">{inc.title}</p>
                <p className="text-sm text-gray-500">{inc.location} / {new Date(inc.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-sm font-medium ${severityColors[inc.severity] || ""}`}>
                {inc.severity.toUpperCase()}
              </span>
              <p className="text-sm text-gray-500 mt-1">{inc.status}</p>
            </div>
          </div>
        ))}
        {incidents.length === 0 && (
          <p className="text-gray-500 text-center py-8">No incidents reported yet.</p>
        )}
      </div>
    </div>
  );
}
