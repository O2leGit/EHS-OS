"use client";

import { useState } from "react";

interface Feature {
  title: string;
  description: string;
  details: string[];
  icon: string;
  color: string;
  tag: string;
}

const features: Feature[] = [
  {
    title: "AI Document Ingestion",
    description: "Upload any EHS document and get instant gap analysis against the Pfizer 4-Tier framework. The system reads, classifies, and maps your documents to over 20 compliance categories.",
    details: [
      "Upload PDF, DOCX, or image files via drag-and-drop",
      "AI extracts text (OCR for scanned documents)",
      "Maps content to Pfizer 4-Tier EHS framework (Tiers 1-3, Series 100-400)",
      "Coverage heatmap shows green (covered), amber (partial), red (gap)",
      "Click any cell to see the source text and AI reasoning",
      "Top 5 gaps identified with one-click CAPA creation",
      "Progressive upload status: extracting, analyzing, complete",
    ],
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    tag: "Core AI",
  },
  {
    title: "Photo-to-Incident Report",
    description: "Snap a photo of a workplace hazard and AI fills the entire incident report. Identifies hazard type, severity, regulatory citations, and recommended actions from the image alone.",
    details: [
      "Camera capture on mobile, file upload on desktop",
      "Claude Vision AI analyzes the photo in seconds",
      "Auto-fills: incident type, severity, description, location clues",
      "Cites relevant OSHA/EPA regulatory standards",
      "Shows confidence score and identified hazards",
      "User reviews and submits -- no typing required",
      "Works for chemical spills, blocked exits, missing PPE, equipment hazards",
    ],
    icon: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z",
    color: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    tag: "AI Vision",
  },
  {
    title: "Predictive Risk Briefing",
    description: "AI analyzes your incident history to detect patterns and predict emerging risks before they become injuries. Get a weekly briefing with actionable interventions.",
    details: [
      "Scans 90 days of incident data for location, type, and time clusters",
      "Detects patterns like repeated near-misses in the same area",
      "Risk levels: Low, Moderate, Elevated, Critical",
      "Each pattern includes trend analysis and predicted outcome",
      "One-click CAPA creation from recommended interventions",
      "Weekly auto-generation with on-demand refresh",
      "Metrics snapshot comparing this period to the last",
    ],
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    tag: "Predictive AI",
  },
  {
    title: "Audit Readiness Score",
    description: "One number that answers: 'If OSHA walked in right now, how ready are we?' A composite score from 5 weighted factors with drill-down detail and AI recommendations.",
    details: [
      "Score 0-100 with color-coded gauge on the dashboard",
      "Framework Coverage (30%): How much of the 4-tier framework is documented",
      "CAPA Health (25%): Overdue and open corrective actions",
      "Incident Investigation (20%): Investigation closure rate",
      "Near-Miss Ratio (15%): Reporting culture indicator",
      "Document Freshness (10%): How current your documentation is",
      "AI recommendations: Top 3 actions to improve your score",
    ],
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    color: "text-green-400 bg-green-500/10 border-green-500/30",
    tag: "Live Score",
  },
  {
    title: "AI EHS Expert Chat",
    description: "A persistent, context-aware AI advisor that knows your documents, gaps, incidents, and CAPAs. Ask regulatory questions and get answers cross-referenced against your actual compliance status.",
    details: [
      "Powered by Claude AI with deep EHS regulatory knowledge",
      "Context-aware: knows your framework coverage, incidents, and CAPAs",
      "Regulation lookup with structured compliance scorecards",
      "Shows covered vs missing requirements for any OSHA/EPA standard",
      "Inline CAPA creation from chat recommendations",
      "Suggested prompts adapt based on the page you're viewing",
      "Chat history persisted per user",
    ],
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    tag: "AI Advisor",
  },
  {
    title: "SOP Draft Generator",
    description: "Describe the SOP you need and AI generates a complete Standard Operating Procedure in Pfizer Tier 4 format with regulatory citations, PPE requirements, and step-by-step procedures.",
    details: [
      "Enter topic, facility, and any special requirements",
      "AI generates full SOP: purpose, scope, responsibilities, procedures",
      "Includes specific OSHA/EPA regulatory citations",
      "Lists required PPE and training",
      "Emergency response procedures included",
      "Document-style preview with print/download support",
      "Cross-references your existing documents and gap data",
    ],
    icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    color: "text-teal-400 bg-teal-500/10 border-teal-500/30",
    tag: "AI Generator",
  },
  {
    title: "Incident Reporting",
    description: "Mobile-first incident reporting with large touch targets, voice-to-text, anonymous reporting, and instant confirmation. Designed for someone in a hard hat with gloves.",
    details: [
      "5 incident types: Injury, Near-Miss, Hazard, Environmental, Observation",
      "Big tappable buttons for type and severity selection",
      "Voice-to-text input for hands-free description entry",
      "Anonymous reporting toggle (default on for field workers)",
      "Public QR code reporting -- no login required",
      "Instant confirmation with incident number",
      "Photo attachment with AI analysis integration",
    ],
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z",
    color: "text-red-400 bg-red-500/10 border-red-500/30",
    tag: "Mobile-First",
  },
  {
    title: "CAPA Workflow Board",
    description: "Kanban-style corrective and preventive action tracking with drag-and-drop, filters, detail panels, and overdue alerts. Switch between board and list views.",
    details: [
      "Kanban board: Open, In Progress, Overdue, Closed columns",
      "Drag-and-drop cards between columns to update status",
      "Click any card to see full detail panel with timeline",
      "Filter by priority, type, or search text",
      "Toggle between Board and List/Table views",
      "Overdue CAPAs highlighted with red border and badge",
      "Linked to source incident with one-click navigation",
    ],
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    color: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    tag: "Workflow",
  },
  {
    title: "KPI Dashboard",
    description: "Real-time metrics with interactive charts, clickable cards, framework coverage heatmap, and recent activity feed. Everything Jen needs to walk a prospect through the system.",
    details: [
      "4 KPI cards: Incidents MTD, Open CAPAs, Overdue CAPAs, Audit Readiness",
      "Click any card to navigate to the relevant page",
      "Incidents Over Time area chart (Recharts)",
      "CAPA status donut chart breakdown",
      "Framework coverage heatmap with clickable drill-down",
      "Recent activity feed (latest incidents + CAPAs)",
      "Weekly Risk Briefing banner with full modal view",
    ],
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
    tag: "Analytics",
  },
  {
    title: "Gap Analysis Reports",
    description: "Aggregated gap analysis across all uploaded documents. See your entire framework coverage with drill-down by tier, category, and series. Export-ready for client presentations.",
    details: [
      "Overall coverage score as a percentage",
      "Tier-by-tier breakdown (Policy, Systems Manual, Standards)",
      "Series-level detail (100-400 series within Tier 3)",
      "Top gaps ranked by risk severity",
      "Per-gap AI reasoning explaining what's missing and why it matters",
      "One-click CAPA creation from any identified gap",
      "Category drill-down with source document references",
    ],
    icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    tag: "Compliance",
  },
  {
    title: "Multi-Tenant Administration",
    description: "Create client workspaces, manage users and roles, generate QR codes for field incident reporting. Each tenant's data is completely isolated.",
    details: [
      "Create and manage tenant organizations",
      "Add users with role-based access (Admin, Manager, User)",
      "QR code URL generator for public incident reporting per site",
      "Admin-only visibility in the sidebar",
      "All data scoped by tenant -- complete isolation",
      "JWT authentication with role enforcement",
      "Ready for multi-client consulting delivery",
    ],
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z",
    color: "text-gray-400 bg-gray-500/10 border-gray-500/30",
    tag: "Admin",
  },
  {
    title: "Incident Notifications",
    description: "Automatic email and SMS alerts to safety managers when incidents are reported. High-severity incidents trigger immediate notifications with one-click access to the report.",
    details: [
      "SMS alerts via Twilio within seconds of incident submission",
      "HTML email notifications with incident details and severity badge",
      "Configurable notification groups (admin, manager roles)",
      "Severity-based formatting: red for high, yellow for medium",
      "Dashboard alert banner for high-severity open incidents",
      "One-click link from notification to incident in EHS-OS",
      "Non-blocking: notifications sent asynchronously, never delays incident submission",
    ],
    icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    tag: "Alerts",
  },
  {
    title: "Multi-Site Management",
    description: "Manage multiple facilities from a single dashboard. Filter all data by site, compare incident rates across locations, and identify site-specific patterns.",
    details: [
      "Site selector in navigation filters all views instantly",
      "4 demo sites: Denver Research Center, San Jose Manufacturing, Minneapolis HQ, Cambridge Lab",
      "Each site has its own incident, CAPA, and document data",
      "Aggregate view shows all sites combined (default)",
      "Site-specific audit readiness and risk briefings",
      "Incidents auto-tagged to reporting site",
      "Ready for cross-site benchmarking and pattern detection",
    ],
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    color: "text-sky-400 bg-sky-500/10 border-sky-500/30",
    tag: "Enterprise",
  },
];

const competitorComparison = [
  { competitor: "Cority Cortex AI", their: "9 separate AI agents for specific tasks. $72-290K/yr. Enterprise-only.", ours: "One unified AI expert. Conversational. Context-aware. 1/10th the cost." },
  { competitor: "VelocityEHS", their: "Dashboard analytics on existing data. AI bolt-on.", ours: "AI reads documents, maps gaps, predicts risks, and tells you what to do." },
  { competitor: "SafetyCulture", their: "AI generates inspection template questions. That's it.", ours: "AI ingests document libraries, produces coverage analysis, acts as ongoing advisor." },
  { competitor: "EHS Momentum", their: "No AI. Manual processes. Legacy interface.", ours: "AI-native from the ground up. Modern UX. Predictive analytics." },
];

export default function FeaturesPage() {
  const [expandedFeature, setExpandedFeature] = useState<number | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  return (
    <div className="space-y-8">
      {/* Hero header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-navy-900 via-[#1B2A4A] to-navy-800 rounded-2xl p-8 border border-navy-700">
        <div className="absolute top-0 right-0 w-96 h-96 bg-safe/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-safe/20 rounded-xl flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-safe" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <span className="text-safe text-sm font-semibold tracking-wider uppercase">Platform Overview</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">EHS Operating System</h1>
          <p className="text-gray-300 text-lg max-w-3xl leading-relaxed">
            AI-native Environmental Health & Safety platform built for life sciences companies.
            From document ingestion to predictive risk analysis, every feature is designed to make
            EHS management smarter, faster, and more proactive.
          </p>
          <div className="flex items-center gap-4 mt-6">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="w-2 h-2 bg-safe rounded-full" />
              {features.length} Features
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="w-2 h-2 bg-cyan-400 rounded-full" />
              7 AI-Powered
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="w-2 h-2 bg-purple-400 rounded-full" />
              Pfizer 4-Tier Framework
            </div>
          </div>
        </div>
      </div>

      {/* AI Differentiator callout */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">What Makes This Different</h3>
            <p className="text-gray-300 mt-1">
              Most EHS platforms digitize paperwork. This one thinks. The AI reads your documents, understands
              your gaps, detects patterns in your incidents, and tells you what to do next -- like having a
              senior EHS consultant available 24/7 who has read everything in your system.
            </p>
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
            >
              {showComparison ? "Hide" : "See"} competitive comparison
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 transition-transform ${showComparison ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Comparison table */}
        {showComparison && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-700">
                  <th className="text-left text-gray-400 font-medium py-2 px-3 w-1/5">Competitor</th>
                  <th className="text-left text-gray-400 font-medium py-2 px-3 w-2/5">Their AI</th>
                  <th className="text-left text-safe font-medium py-2 px-3 w-2/5">Our AI</th>
                </tr>
              </thead>
              <tbody>
                {competitorComparison.map((row, i) => (
                  <tr key={row.competitor} className={i % 2 === 0 ? "bg-navy-800/30" : ""}>
                    <td className="py-3 px-3 text-white font-medium">{row.competitor}</td>
                    <td className="py-3 px-3 text-gray-400">{row.their}</td>
                    <td className="py-3 px-3 text-gray-200">{row.ours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Feature cards */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">All Features</h2>
        <div className="grid gap-4">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`bg-navy-800 border rounded-xl transition-all cursor-pointer ${
                expandedFeature === index ? "border-safe/50 ring-1 ring-safe/20" : "border-navy-700 hover:border-navy-600"
              }`}
              onClick={() => setExpandedFeature(expandedFeature === index ? null : index)}
            >
              <div className="p-5 flex items-start gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${feature.color}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-white font-semibold">{feature.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${feature.color}`}>
                      {feature.tag}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform ${expandedFeature === index ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Expanded details */}
              {expandedFeature === index && (
                <div className="px-5 pb-5 pt-0">
                  <div className="border-t border-navy-700 pt-4 ml-15">
                    <ul className="space-y-2">
                      {feature.details.map((detail, di) => (
                        <li key={di} className="flex items-start gap-2 text-sm text-gray-300">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-safe flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tech stack footer */}
      <div className="bg-navy-800 border border-navy-700 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-4">Built With</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Frontend", value: "Next.js + React + Tailwind", sub: "Netlify" },
            { label: "Backend", value: "Python FastAPI + asyncpg", sub: "Railway" },
            { label: "AI Engine", value: "Claude API (Anthropic)", sub: "Sonnet + Vision" },
            { label: "Database", value: "PostgreSQL", sub: "Multi-tenant" },
          ].map((item) => (
            <div key={item.label} className="bg-navy-900 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{item.label}</p>
              <p className="text-white text-sm font-medium mt-1">{item.value}</p>
              <p className="text-gray-500 text-xs mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
