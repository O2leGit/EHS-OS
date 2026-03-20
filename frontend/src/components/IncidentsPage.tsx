"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpeechRecognitionAny = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

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

const INCIDENT_TYPES = [
  {
    value: "injury",
    label: "Injury",
    color: "border-red-500",
    bg: "bg-red-500/10",
    ring: "ring-red-500",
    textColor: "text-red-400",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
  },
  {
    value: "near_miss",
    label: "Near-Miss",
    color: "border-amber-500",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500",
    textColor: "text-amber-400",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    value: "hazard",
    label: "Hazard",
    color: "border-orange-500",
    bg: "bg-orange-500/10",
    ring: "ring-orange-500",
    textColor: "text-orange-400",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    value: "environmental",
    label: "Environmental",
    color: "border-green-500",
    bg: "bg-green-500/10",
    ring: "ring-green-500",
    textColor: "text-green-400",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
  },
  {
    value: "observation",
    label: "Observation",
    color: "border-blue-500",
    bg: "bg-blue-500/10",
    ring: "ring-blue-500",
    textColor: "text-blue-400",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

const SEVERITY_OPTIONS = [
  { value: "low", label: "Low", bg: "bg-green-500/15", border: "border-green-500", ring: "ring-green-500", text: "text-green-400" },
  { value: "medium", label: "Medium", bg: "bg-amber-500/15", border: "border-amber-500", ring: "ring-amber-500", text: "text-amber-400" },
  { value: "high", label: "High", bg: "bg-red-500/15", border: "border-red-500", ring: "ring-red-500", text: "text-red-400" },
];

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
  const [anonymous, setAnonymous] = useState(true);
  const [listening, setListening] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionAny>(null);

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
      const result = await api<Incident>("/api/incidents/", {
        method: "POST",
        body: { ...formData, anonymous },
        token,
      });
      setSubmitSuccess(result?.incident_number || "INC-???");
      fetchIncidents();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitSuccess(null);
    setShowForm(false);
    setFormData({ incident_type: "near_miss", severity: "medium", title: "", description: "", location: "" });
    setAnonymous(true);
  };

  const toggleVoice = () => {
    const SpeechRecognitionAPI =
      typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionAPI) return;

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new (SpeechRecognitionAPI as new () => SpeechRecognitionAny)();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionAny) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript) {
        setFormData((prev) => ({
          ...prev,
          description: prev.description ? prev.description + " " + transcript : transcript,
        }));
      }
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Incidents</h1>
        <button onClick={() => { setShowForm(!showForm); setSubmitSuccess(null); }} className="btn-primary">
          {showForm ? "Cancel" : "Report Incident"}
        </button>
      </div>

      {showForm && submitSuccess && (
        <div className="card mb-6 flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-green-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-green-400 mb-2">Incident Reported Successfully</h2>
          <p className="text-gray-400 font-mono text-lg mb-2">{submitSuccess}</p>
          <p className="text-gray-500 mb-6">Thank you for helping keep our workplace safe</p>
          <button onClick={resetForm} className="btn-primary">Report Another</button>
        </div>
      )}

      {showForm && !submitSuccess && (
        <form onSubmit={handleSubmit} className="card mb-6 space-y-6 p-4 md:p-6">
          {/* Incident Type Buttons */}
          <div>
            <label className="block text-sm text-gray-400 mb-3 font-medium">Incident Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {INCIDENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, incident_type: t.value })}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 min-h-[100px] transition-all cursor-pointer
                    ${formData.incident_type === t.value
                      ? `${t.color} ${t.bg} ring-2 ${t.ring} ${t.textColor}`
                      : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-500 hover:bg-gray-800"
                    }`}
                >
                  {t.icon}
                  <span className="text-sm font-bold">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Severity Pills */}
          <div>
            <label className="block text-sm text-gray-400 mb-3 font-medium">Severity</label>
            <div className="flex gap-3">
              {SEVERITY_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, severity: s.value })}
                  className={`flex-1 py-3 px-4 rounded-full border-2 text-sm font-bold transition-all cursor-pointer min-h-[44px]
                    ${formData.severity === s.value
                      ? `${s.border} ${s.bg} ring-2 ${s.ring} ${s.text}`
                      : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-500"
                    }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Anonymous Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAnonymous(!anonymous)}
              className={`relative w-12 h-7 rounded-full transition-colors ${anonymous ? "bg-green-500" : "bg-gray-600"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${anonymous ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
            <span className="text-sm text-gray-300">Report Anonymously</span>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm text-gray-400 mb-1 font-medium">Location</label>
            <input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="input-field w-full min-h-[44px]"
              placeholder="Building A - Lab 201"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm text-gray-400 mb-1 font-medium">Title</label>
            <input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="input-field w-full min-h-[44px]"
              placeholder="Brief description of the incident"
              required
            />
          </div>

          {/* Description with Voice */}
          <div>
            <label className="block text-sm text-gray-400 mb-1 font-medium">Description</label>
            <div className="relative">
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-field w-full h-28 pr-12"
                placeholder="Detailed description of what happened..."
              />
              <button
                type="button"
                onClick={toggleVoice}
                title={listening ? "Stop recording" : "Start voice input"}
                className={`absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center transition-all
                  ${listening
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white"
                  }`}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1">(Voice input supported in Chrome/Edge)</p>
          </div>

          <button
            type="submit"
            className="btn-primary w-full min-h-[48px] text-base font-bold"
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit Report"}
          </button>
        </form>
      )}

      {/* Incident List */}
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
