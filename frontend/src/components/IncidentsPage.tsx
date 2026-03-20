"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, uploadFile } from "@/lib/api";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpeechRecognitionAny = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface IncidentsPageProps {
  token: string;
  onOpenChat?: (message: string) => void;
  showToast?: (message: string, type?: 'success' | 'error') => void;
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

export default function IncidentsPage({ token, onOpenChat, showToast }: IncidentsPageProps) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    incident_type: "near_miss",
    severity: "medium",
    title: "",
    description: "",
    location: "",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(true);
  const [listening, setListening] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);
  const [photoResult, setPhotoResult] = useState<{
    confidence: number;
    regulatory_references?: string[];
    hazards?: string[];
  } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionAny>(null);

  const fetchIncidents = useCallback(() => {
    api<Incident[]>("/api/incidents/", { token }).then(setIncidents).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api<Incident>("/api/incidents/", {
        method: "POST",
        body: { ...formData, anonymous },
        token,
      });
      setSubmitSuccess(result?.incident_number || "INC-???");
      showToast?.(`Incident ${result?.incident_number || ''} reported successfully`, 'success');
      fetchIncidents();
    } catch (err) {
      console.error(err);
      setSubmitError("Failed to submit incident. Please try again.");
      showToast?.("Failed to submit incident", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitSuccess(null);
    setShowForm(false);
    setFormData({ incident_type: "near_miss", severity: "medium", title: "", description: "", location: "" });
    setAnonymous(true);
    setPhotoResult(null);
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

  const handlePhotoAnalyze = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoAnalyzing(true);
    setPhotoResult(null);
    try {
      const result = await uploadFile("/api/incidents/analyze-photo", file, token) as {
        type?: string;
        severity?: string;
        description?: string;
        hazards?: string[];
        location_clues?: string;
        regulatory_references?: string[];
        confidence?: number;
      };
      // Pre-fill form fields from AI analysis
      setFormData((prev) => ({
        ...prev,
        incident_type: result.type && INCIDENT_TYPES.some((t) => t.value === result.type) ? result.type : prev.incident_type,
        severity: result.severity && SEVERITY_OPTIONS.some((s) => s.value === result.severity) ? result.severity : prev.severity,
        description: [
          result.description || "",
          result.hazards?.length ? `\nHazards: ${result.hazards.join(", ")}` : "",
          result.regulatory_references?.length ? `\nRegulatory: ${result.regulatory_references.join(", ")}` : "",
        ].filter(Boolean).join(""),
        location: result.location_clues || prev.location,
      }));
      setPhotoResult({
        confidence: result.confidence ?? 0,
        regulatory_references: result.regulatory_references,
        hazards: result.hazards,
      });
    } catch (err) {
      console.error("Photo analysis failed:", err);
    } finally {
      setPhotoAnalyzing(false);
      // Reset file input so the same file can be re-selected
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
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
          {/* Report from Photo */}
          <div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoAnalyze}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoAnalyzing}
              className="w-full bg-[#1B2A4A] border border-cyan-500/30 text-white rounded-xl p-4 flex items-center gap-4 hover:border-cyan-500/60 hover:bg-[#1f3158] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {photoAnalyzing ? (
                <div className="w-10 h-10 flex items-center justify-center">
                  <svg className="animate-spin w-6 h-6 text-cyan-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : (
                <div className="w-10 h-10 flex items-center justify-center text-cyan-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
              )}
              <div className="text-left">
                <span className="font-semibold block">
                  {photoAnalyzing ? "Analyzing image..." : "Report from Photo"}
                </span>
                <span className="text-sm text-gray-400">
                  {photoAnalyzing ? "AI is identifying hazards and filling the report" : "Take a photo and AI will fill the report"}
                </span>
              </div>
            </button>

            {/* Photo analysis result badges */}
            {photoResult && (
              <div className="mt-3 space-y-2">
                {photoResult.confidence < 0.5 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Low confidence analysis. Please review carefully.
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                    photoResult.confidence >= 0.8 ? "bg-green-500/15 text-green-400 border border-green-500/30" :
                    photoResult.confidence >= 0.5 ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30" :
                    "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  }`}>
                    Confidence: {Math.round(photoResult.confidence * 100)}%
                  </span>
                  {photoResult.regulatory_references?.map((ref, i) => (
                    <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30">
                      {ref}
                    </span>
                  ))}
                  {photoResult.hazards?.map((hazard, i) => (
                    <span key={`h-${i}`} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30">
                      {hazard}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

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

          {submitError && (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full min-h-[48px] text-base font-bold"
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit Report"}
          </button>
        </form>
      )}

      {/* AI Prompt Bar */}
      <AiPromptBar
        onOpenChat={onOpenChat}
        prompts={[
          "Analyze patterns in my recent incidents",
          "Which incidents need immediate attention?",
          "Help me write an incident investigation",
        ]}
      />

      {/* Incident List */}
      <div className="space-y-3">
        {incidents.map((inc) => (
          <div key={inc.id} className="card-hover flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-mono text-gray-500">{inc.incident_number}</span>
                  <span className={typeColors[inc.incident_type] || "badge-info"}>
                    {(inc.incident_type || "").replace("_", " ")}
                  </span>
                </div>
                <p className="font-medium">{inc.title}</p>
                <p className="text-sm text-gray-500">{inc.location} / {new Date(inc.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-sm font-medium ${severityColors[inc.severity] || ""}`}>
                {(inc.severity || "").toUpperCase()}
              </span>
              <p className="text-sm text-gray-500 mt-1">{inc.status}</p>
            </div>
          </div>
        ))}
        {loading && incidents.length === 0 && (
          <div className="space-y-3 animate-pulse">
            {[1,2,3].map(i => (
              <div key={i} className="bg-navy-800 rounded-xl p-5 border border-navy-700 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-3 bg-navy-700 rounded w-20" />
                      <div className="h-4 bg-navy-700 rounded w-16" />
                    </div>
                    <div className="h-4 bg-navy-700 rounded w-48 mb-1" />
                    <div className="h-3 bg-navy-700 rounded w-32" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-3 bg-navy-700 rounded w-12 mb-2 ml-auto" />
                  <div className="h-3 bg-navy-700 rounded w-16 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && incidents.length === 0 && (
          <div className="text-center py-12 bg-navy-800 rounded-xl border border-navy-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-gray-600 mx-auto mb-4">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h3 className="text-lg font-medium text-gray-400 mb-2">No incidents reported yet</h3>
            <p className="text-gray-500 text-sm mb-4">Start by reporting your first incident or use the photo analysis feature</p>
            <button onClick={() => setShowForm(true)} className="btn-primary">Report an Incident</button>
          </div>
        )}
      </div>
    </div>
  );
}
