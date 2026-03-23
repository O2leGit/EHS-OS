"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { clearAuth } from "@/lib/auth";
import Sidebar from "./Sidebar";
import DashboardHome from "./DashboardHome";
import DocumentsPage from "./DocumentsPage";
import IncidentsPage from "./IncidentsPage";
import CapaPage from "./CapaPage";
import AdminPage from "./AdminPage";
import FeaturesPage from "./FeaturesPage";
import ReportsPage from "./ReportsPage";
import RiskMatrixPage from "./RiskMatrixPage";
import ChatPanel from "./ChatPanel";
import InspectionsPage from "./InspectionsPage";
import ComingSoonPage from "./ComingSoonPage";
import QrReportingPage from "./QrReportingPage";
import OnboardingChecklist from "./OnboardingChecklist";

export interface TenantBranding {
  brand_name: string;
  logo_url: string | null;
  brand_color_primary?: string | null;
  brand_color_accent?: string | null;
  partner_name: string | null;
  partner_logo_url: string | null;
  tenant_name?: string;
  pricing_tier?: string;
}

interface DashboardProps {
  token: string;
  onLogout: () => void;
}

type Page = "dashboard" | "documents" | "incidents" | "capas" | "inspections" | "risk" | "features" | "admin" | "reports" | "training" | "sds" | "audits" | "permits" | "qr-reporting";

export default function Dashboard({ token, onLogout }: DashboardProps) {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialMessage, setChatInitialMessage] = useState<string | undefined>(undefined);
  const [user, setUser] = useState<{ full_name: string; role: string } | null>(null);
  const [toasts, setToasts] = useState<{id: number; message: string; type: 'success' | 'error'}[]>([]);
  const [sites, setSites] = useState<{id: string; name: string; code: string}[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tenantSlug, setTenantSlug] = useState<string>("");

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, {id, message, type}]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  useEffect(() => {
    api<{ full_name: string; role: string; tenant_slug?: string; is_platform_admin?: boolean; partner_id?: string | null }>("/api/auth/me", { token })
      .then((me) => {
        setUser(me);
        // Determine tenant slug and onboarding eligibility
        const slug = (me as Record<string, unknown>).tenant_slug as string || "";
        setTenantSlug(slug);
        if (
          slug &&
          !me.is_platform_admin &&
          me.role !== "partner" &&
          typeof window !== "undefined"
        ) {
          const params = new URLSearchParams(window.location.search);
          const isDemo = params.get("demo") === "true";
          const alreadyComplete = localStorage.getItem(`ehs_onboarding_complete_${slug}`) === "true";
          if (!isDemo && !alreadyComplete) {
            setShowOnboarding(true);
          }
        }
      })
      .catch(() => {
        clearAuth();
        onLogout();
      });
    api<{id: string; name: string; code: string}[]>("/api/sites/", { token })
      .then(setSites)
      .catch(console.error);
    api<TenantBranding>("/api/tenant/branding", { token })
      .then((b) => {
        setBranding(b);
        // Set CSS custom properties for white-label theming
        const accent = b.brand_color_accent || "#2ECC71";
        const primary = b.brand_color_primary || "#1B2A4A";
        document.documentElement.style.setProperty("--brand-color", accent);
        document.documentElement.style.setProperty("--brand-color-primary", primary);
      })
      .catch(console.error);
  }, [token, onLogout]);

  const handleLogout = () => {
    clearAuth();
    onLogout();
  };

  const handleOpenChat = (message: string) => {
    setChatInitialMessage(message);
    setChatOpen(true);
  };

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardHome token={token} onNavigate={(p) => setCurrentPage(p as Page)} onOpenChat={handleOpenChat} selectedSiteId={selectedSiteId} branding={branding} />;
      case "documents":
        return <DocumentsPage token={token} onOpenChat={handleOpenChat} showToast={showToast} />;
      case "incidents":
        return <IncidentsPage token={token} onOpenChat={handleOpenChat} showToast={showToast} />;
      case "capas":
        return <CapaPage token={token} onOpenChat={handleOpenChat} />;
      case "inspections":
        return <InspectionsPage token={token} />;
      case "risk":
        return <RiskMatrixPage token={token} />;
      case "reports":
        return <ReportsPage token={token} onOpenChat={handleOpenChat} />;
      case "training":
        return (
          <ComingSoonPage
            title="Training Management"
            description="Centralized training tracking, certification management, and compliance-driven learning paths for your entire workforce."
            expectedDate="Q3 2026"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
              </svg>
            }
            capabilities={[
              "Employee training records and certification tracking",
              "Auto-assigned training based on role, site, and hazard exposure",
              "Expiration alerts and renewal workflows",
              "OSHA-required training compliance matrix",
              "Training completion dashboards with site comparisons",
              "LMS integration (Cornerstone, SAP SuccessFactors)",
            ]}
          />
        );
      case "sds":
        return (
          <ComingSoonPage
            title="SDS Management"
            description="AI-powered Safety Data Sheet management with automatic hazard extraction, chemical inventory tracking, and GHS compliance."
            expectedDate="Q3 2026"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            }
            capabilities={[
              "Searchable SDS library with version control",
              "AI extraction of hazard classifications, PPE requirements, and exposure limits",
              "Chemical inventory by site and location",
              "Right-to-Know compliance reporting",
              "Emergency response data instantly accessible",
              "Integration with chemical purchasing systems",
            ]}
          />
        );
      case "audits":
        return (
          <ComingSoonPage
            title="Audit Management"
            description="End-to-end audit lifecycle management from planning through findings resolution, with AI-powered gap analysis and corrective action tracking."
            expectedDate="Q4 2026"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
            capabilities={[
              "Audit scheduling and resource planning",
              "Configurable audit templates (ISO 14001, ISO 45001, OSHA, VPP)",
              "Mobile audit execution with photo evidence",
              "AI-generated findings and recommendations",
              "Corrective action tracking linked to CAPAs",
              "Audit trend analytics and site benchmarking",
            ]}
          />
        );
      case "permits":
        return (
          <ComingSoonPage
            title="Permit to Work"
            description="Digital permit-to-work system for high-hazard activities with multi-level approval workflows, real-time monitoring, and automatic safety controls."
            expectedDate="Q4 2026"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            }
            capabilities={[
              "Hot work, confined space, LOTO, working at height permits",
              "Multi-level digital approval workflows",
              "Real-time active permit dashboard",
              "Automatic conflict detection (overlapping permits in same area)",
              "Permit expiration and extension management",
              "Integration with contractor management",
            ]}
          />
        );
      case "features":
        return <FeaturesPage />;
      case "admin":
        return <AdminPage token={token} userRole={user?.role || ""} />;
      case "qr-reporting":
        return <QrReportingPage token={token} />;
      default:
        return <DashboardHome token={token} onNavigate={(p) => setCurrentPage(p as Page)} onOpenChat={handleOpenChat} branding={branding} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        currentPage={currentPage}
        onNavigate={(p) => setCurrentPage(p as Page)}
        onLogout={handleLogout}
        userName={user?.full_name || ""}
        userRole={user?.role || ""}
        sites={sites}
        selectedSiteId={selectedSiteId}
        onSiteChange={setSelectedSiteId}
        branding={branding}
      />
      <main className={`flex-1 overflow-y-auto transition-all ${chatOpen ? "mr-[380px]" : ""}`}>
        <div className="p-6 max-w-7xl mx-auto">
          {renderPage()}
        </div>
      </main>

      {/* Chat toggle - hidden when chat is open */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed right-4 bottom-4 text-white rounded-full shadow-lg z-50 transition-colors flex items-center gap-2 px-4 py-3"
          style={{ backgroundColor: "var(--brand-color, #2ECC71)" }}
          title="Ask an EHS AI Assistant"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-sm font-medium">Ask an EHS AI Assistant</span>
        </button>
      )}

      {/* Chat panel */}
      {chatOpen && (
        <ChatPanel
          token={token}
          currentPage={currentPage}
          onClose={() => setChatOpen(false)}
          onNavigate={(p) => setCurrentPage(p as Page)}
          initialMessage={chatInitialMessage}
          onInitialMessageSent={() => setChatInitialMessage(undefined)}
        />
      )}

      {/* Onboarding checklist modal */}
      {showOnboarding && tenantSlug && (
        <OnboardingChecklist
          tenantSlug={tenantSlug}
          branding={branding}
          onClose={() => setShowOnboarding(false)}
          onNavigate={(page) => {
            setShowOnboarding(false);
            setCurrentPage(page as Page);
          }}
        />
      )}

      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-sm font-medium border transition-all animate-slide-in-right ${
              toast.type === 'success'
                ? 'bg-green-900/90 text-green-200 border-green-700'
                : 'bg-red-900/90 text-red-200 border-red-700'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-green-400 shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-red-400 shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
              {toast.message}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
