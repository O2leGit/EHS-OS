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
import ChatPanel from "./ChatPanel";

interface DashboardProps {
  token: string;
  onLogout: () => void;
}

type Page = "dashboard" | "documents" | "incidents" | "capas" | "features" | "admin";

export default function Dashboard({ token, onLogout }: DashboardProps) {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [chatOpen, setChatOpen] = useState(false);
  const [user, setUser] = useState<{ full_name: string; role: string } | null>(null);

  useEffect(() => {
    api<{ full_name: string; role: string }>("/api/auth/me", { token })
      .then(setUser)
      .catch(() => {
        clearAuth();
        onLogout();
      });
  }, [token, onLogout]);

  const handleLogout = () => {
    clearAuth();
    onLogout();
  };

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardHome token={token} onNavigate={(p) => setCurrentPage(p as Page)} />;
      case "documents":
        return <DocumentsPage token={token} />;
      case "incidents":
        return <IncidentsPage token={token} />;
      case "capas":
        return <CapaPage token={token} />;
      case "features":
        return <FeaturesPage />;
      case "admin":
        return <AdminPage token={token} userRole={user?.role || ""} />;
      default:
        return <DashboardHome token={token} onNavigate={(p) => setCurrentPage(p as Page)} />;
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
      />
      <main className={`flex-1 overflow-y-auto transition-all ${chatOpen ? "mr-[380px]" : ""}`}>
        <div className="p-6 max-w-7xl mx-auto">
          {renderPage()}
        </div>
      </main>

      {/* Chat toggle */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed right-4 bottom-4 bg-safe hover:bg-green-600 text-white rounded-full p-3 shadow-lg z-50 transition-colors"
        title="EHS Expert"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {/* Chat panel */}
      {chatOpen && (
        <ChatPanel
          token={token}
          currentPage={currentPage}
          onClose={() => setChatOpen(false)}
          onNavigate={(p) => setCurrentPage(p as Page)}
        />
      )}
    </div>
  );
}
