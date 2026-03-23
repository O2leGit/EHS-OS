"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const CATEGORIES = [
  { value: "unsafe_condition", label: "Unsafe Condition", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
  { value: "unsafe_behavior", label: "Unsafe Behavior", icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" },
  { value: "near_miss", label: "Near Miss", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { value: "equipment_issue", label: "Equipment Issue", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  { value: "chemical_spill", label: "Chemical / Spill", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" },
  { value: "ergonomic", label: "Ergonomic", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { value: "fire_electrical", label: "Fire / Electrical", icon: "M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" },
  { value: "other", label: "Other", icon: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
];

const SEVERITIES = [
  { value: "low", label: "Low", color: "border-green-500 bg-green-500/10 text-green-400", dot: "bg-green-500" },
  { value: "medium", label: "Medium", color: "border-amber-500 bg-amber-500/10 text-amber-400", dot: "bg-amber-500" },
  { value: "high", label: "High", color: "border-orange-500 bg-orange-500/10 text-orange-400", dot: "bg-orange-500" },
  { value: "critical", label: "Critical", color: "border-red-500 bg-red-500/10 text-red-400", dot: "bg-red-500" },
];

interface AnonymousReportPageProps {
  tenantSlug: string;
}

export default function AnonymousReportPage({ tenantSlug }: AnonymousReportPageProps) {
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [incidentNumber, setIncidentNumber] = useState("");
  const [error, setError] = useState("");

  const descriptionValid = description.trim().length >= 20;
  const formValid = category && severity && descriptionValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/incidents/anonymous`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          severity,
          description: description.trim(),
          location: location.trim() || null,
          tenant_slug: tenantSlug,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: "Submission failed" }));
        throw new Error(data.detail || `Error: ${res.status}`);
      }

      const data = await res.json();
      setIncidentNumber(data.incident_number || "");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setCategory("");
    setSeverity("medium");
    setDescription("");
    setLocation("");
    setSubmitted(false);
    setIncidentNumber("");
    setError("");
  };

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          {/* Success checkmark */}
          <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-3">Report Submitted</h1>
          <p className="text-gray-400 mb-2">
            Thank you. Your report has been submitted anonymously.
          </p>
          {incidentNumber && (
            <p className="text-sm text-gray-500 mb-6">
              Reference: <span className="font-mono text-gray-400">{incidentNumber}</span>
            </p>
          )}

          <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4 mb-8">
            <div className="flex items-center justify-center gap-2 text-green-400 text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Your identity remains completely anonymous.
            </div>
          </div>

          <button
            onClick={handleReset}
            className="w-full bg-[#1a2744] hover:bg-[#223358] border border-[#2a3f6b] text-white font-medium py-3 px-6 rounded-xl transition-colors"
          >
            Submit Another Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Header */}
      <div className="bg-[#0d1526] border-b border-[#1e293b]">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Report a Safety Concern</h1>
              <p className="text-xs text-gray-500">EHS Management System</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Anonymous reassurance banner */}
        <div className="bg-[#0f1d35] border border-blue-800/40 rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-300">Your identity is completely anonymous</p>
            <p className="text-xs text-gray-500 mt-0.5">No login required. No personal data is collected.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error message */}
          {error && (
            <div className="bg-red-900/30 border border-red-700/50 text-red-400 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              What type of concern? <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                    category === cat.value
                      ? "border-green-500 bg-green-500/10 ring-1 ring-green-500/50"
                      : "border-[#1e293b] bg-[#0d1526] hover:border-gray-600"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 flex-shrink-0 ${category === cat.value ? "text-green-400" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                  </svg>
                  <span className={`text-sm ${category === cat.value ? "text-white font-medium" : "text-gray-400"}`}>
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Location / Area
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Loading Dock B, Lab 204, Warehouse Aisle 3"
              className="w-full bg-[#0d1526] border border-[#1e293b] text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 transition-colors"
            />
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Severity Level <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {SEVERITIES.map((sev) => (
                <button
                  key={sev.value}
                  type="button"
                  onClick={() => setSeverity(sev.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                    severity === sev.value
                      ? sev.color + " ring-1 ring-current/30"
                      : "border-[#1e293b] bg-[#0d1526] hover:border-gray-600 text-gray-500"
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${severity === sev.value ? sev.dot : "bg-gray-700"}`} />
                  <span className="text-xs font-medium">{sev.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the safety concern in detail. What did you observe? Where exactly? What are the potential risks?"
              rows={5}
              className="w-full bg-[#0d1526] border border-[#1e293b] text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 transition-colors resize-none"
            />
            <div className="flex items-center justify-between mt-1.5">
              <p className={`text-xs ${description.trim().length >= 20 ? "text-gray-600" : "text-amber-500/80"}`}>
                {description.trim().length < 20
                  ? `${20 - description.trim().length} more characters needed`
                  : "Minimum met"}
              </p>
              <p className="text-xs text-gray-600">{description.trim().length} chars</p>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!formValid || submitting}
            className={`w-full font-semibold py-4 px-6 rounded-xl text-base transition-all ${
              formValid && !submitting
                ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-900/30"
                : "bg-gray-800 text-gray-600 cursor-not-allowed"
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Submitting...
              </span>
            ) : (
              "Submit Anonymous Report"
            )}
          </button>

          {/* Footer note */}
          <p className="text-center text-xs text-gray-600 mt-4">
            Reports are reviewed by the EHS team within 24 hours. For immediate emergencies, call 911.
          </p>
        </form>
      </div>
    </div>
  );
}
