"use client";

import { useState, useEffect } from "react";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  userName: string;
  userRole?: string;
  sites?: {id: string; name: string; code: string}[];
  selectedSiteId?: string | null;
  onSiteChange?: (siteId: string | null) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { id: "documents", label: "Documents", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { id: "incidents", label: "Incidents", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" },
  { id: "capas", label: "CAPAs", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { id: "reports", label: "Reports", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { id: "features", label: "Features", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" },
  { id: "admin", label: "Admin", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z", adminOnly: true },
];

export default function Sidebar({ currentPage, onNavigate, onLogout, userName, userRole, sites, selectedSiteId, onSiteChange }: SidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleToggle = () => {
    if (isMobile) setExpanded((prev) => !prev);
  };

  return (
    <div
      className={`bg-navy-900 border-r border-navy-700 flex flex-col transition-all duration-200 ${
        expanded ? "w-60" : "w-14"
      }`}
      onMouseEnter={() => { if (!isMobile) setExpanded(true); }}
      onMouseLeave={() => { if (!isMobile) setExpanded(false); }}
      onClick={handleToggle}
    >
      <div className="p-3 border-b border-navy-700">
        <div className="flex items-center gap-2">
          {isMobile && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded((prev) => !prev); }}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors flex-shrink-0"
              aria-label="Toggle menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          {!isMobile && !expanded && (
            <div className="w-8 h-8 bg-safe rounded-lg flex items-center justify-center text-white flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          )}
          {!isMobile && expanded && (
            <img
              src="https://static.wixstatic.com/media/904f7b_34be1989a6234bc18b580179563ed22d~mv2.png/v1/crop/x_0,y_191,w_2169,h_617/fill/w_300,h_86,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/finalparzy3_edited.png"
              alt="Parzy Consulting"
              className="h-7 object-contain"
            />
          )}
        </div>
      </div>

      {/* Site selector */}
      {sites && sites.length > 0 && expanded && (
        <div className="px-3 py-2 border-b border-navy-700">
          <select
            value={selectedSiteId || ""}
            onChange={(e) => onSiteChange?.(e.target.value || null)}
            className="w-full bg-navy-800 border border-navy-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:border-safe focus:outline-none"
          >
            <option value="">All Sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>
        </div>
      )}

      <nav className="flex-1 py-2">
        {navItems.filter((item) => !item.adminOnly || userRole === "admin").map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
              currentPage === item.id
                ? "bg-navy-800 text-safe border-r-2 border-safe"
                : "text-gray-400 hover:text-gray-200 hover:bg-navy-800"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
            {expanded && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-navy-700">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-0 py-2 text-sm text-gray-400 hover:text-red-400 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {expanded && <span>Sign out</span>}
        </button>
        {expanded && userName && (
          <p className="text-xs text-gray-500 mt-1 truncate">{userName}</p>
        )}
        {expanded && (
          <p className="text-xs text-gray-600 mt-2 text-center">Powered by EHS-OS</p>
        )}
      </div>
    </div>
  );
}
