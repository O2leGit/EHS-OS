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
import ChatPanel from "./ChatPanel";

export interface TenantBranding {
  brand_name: string;
  logo_url: string | null;
  partner_name: string | null;
  partner_logo_url: string | null;
  tenant_name?: string;
}

interface DashboardProps {
  token: string;
  onLogout: () => void;
}

type Page = "dashboard" | "documents" | "incidents" | "capas" | "features" | "admin" | "reports";

export default function Dashboard({ token, onLogout }: DashboardProps) {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialMessage, setChatInitialMessage] = useState<string | undefined>(undefined);
  const [user, setUser] = useState<{ full_name: string; role: string } | null>(null);
  const [toasts, setToasts] = useState<{id: number; message: string; type: 'success' | 'error'}[]>([]);
  const [sites, setSites] = useState<{id: string; name: string; code: string}[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [branding, setBranding] = useState<TenantBranding | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, {id, message, type}]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  useEffect(() => {
    api<{ full_name: string; role: string }>("/api/auth/me", { token })
      .then(setUser)
      .catch(() => {
        clearAuth();
        onLogout();
      });
    api<{id: string; name: string; code: string}[]>("/api/sites/", { token })
      .then(setSites)
      .catch(console.error);
    api<TenantBranding>("/api/tenant/branding", { token })
      .then(setBranding)
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
      case "reports":
        return <ReportsPage token={token} onOpenChat={handleOpenChat} />;
      case "features":
        return <FeaturesPage />;
      case "admin":
        return <AdminPage token={token} userRole={user?.role || ""} />;
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

      {/* Chat toggle */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed right-4 bottom-4 bg-safe hover:bg-green-600 text-white rounded-full shadow-lg z-50 transition-colors flex items-center gap-2 px-4 py-3"
        title="Ask an EHS AI Assistant"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="text-sm font-medium">Ask an EHS AI Assistant</span>
      </button>

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
