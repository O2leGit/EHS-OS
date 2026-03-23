"use client";

import { useState, useEffect } from "react";
import type { TenantBranding } from "./Dashboard";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  userName: string;
  userRole?: string;
  sites?: {id: string; name: string; code: string}[];
  selectedSiteId?: string | null;
  onSiteChange?: (siteId: string | null) => void;
  branding?: TenantBranding | null;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
  requiredTier?: string;
  tierLabel?: string;
  comingSoon?: boolean;
}

// Tier hierarchy: essentials < professional < growth < standard < advanced < premium
const TIER_RANK: Record<string, number> = {
  essentials: 0,
  professional: 1,
  growth: 2,
  standard: 3,
  advanced: 4,
  premium: 5,
};

function hasTierAccess(currentTier: string, requiredTier: string): boolean {
  return (TIER_RANK[currentTier] ?? 1) >= (TIER_RANK[requiredTier] ?? 0);
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { id: "documents", label: "Documents", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { id: "incidents", label: "Incidents", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" },
  { id: "capas", label: "CAPAs", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", requiredTier: "professional", tierLabel: "PRO+" },
  { id: "inspections", label: "Inspections", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01", requiredTier: "professional", tierLabel: "PRO+" },
  { id: "risk", label: "Risk Matrix", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z", requiredTier: "growth", tierLabel: "GROWTH+" },
  { id: "reports", label: "Reports", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", requiredTier: "growth", tierLabel: "GROWTH+" },
  { id: "training", label: "Training", icon: "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222", comingSoon: true },
  { id: "sds", label: "SDS Library", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z", comingSoon: true },
  { id: "audits", label: "Audits", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", comingSoon: true },
  { id: "permits", label: "Permits", icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", comingSoon: true },
  { id: "features", label: "Features", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" },
  { id: "admin", label: "Admin", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z", adminOnly: true },
];

export default function Sidebar({ currentPage, onNavigate, onLogout, userName, userRole, sites, selectedSiteId, onSiteChange, branding }: SidebarProps) {
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

  const tenantName = branding?.tenant_name || branding?.brand_name || "EHS-OS";
  const currentTier = branding?.pricing_tier || "professional";

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
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: "var(--brand-color, #2ECC71)" }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          )}
          {!isMobile && expanded && (
            <div className="flex flex-col">
              {branding?.logo_url ? (
                <img
                  src={branding.logo_url}
                  alt={tenantName}
                  className="h-6 object-contain" style={{ filter: "brightness(0) invert(1)" }}
                />
              ) : (
                <span className="text-sm font-bold text-white">{tenantName}</span>
              )}
              <span className="text-[9px] text-gray-500 mt-0.5">EHS Management System</span>
            </div>
          )}
        </div>
      </div>

      {/* Site selector */}
      {sites && sites.length > 0 && expanded && (
        <div className="px-3 py-2 border-b border-navy-700">
          <select
            value={selectedSiteId || ""}
            onChange={(e) => onSiteChange?.(e.target.value || null)}
            className="w-full bg-navy-800 border border-navy-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
            style={{ "--tw-ring-color": "var(--brand-color, #2ECC71)" } as React.CSSProperties}
          >
            <option value="">All Sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>
        </div>
      )}

      <nav className="flex-1 py-2">
        {navItems.filter((item) => !item.adminOnly || userRole === "admin").map((item) => {
          const locked = item.requiredTier && !hasTierAccess(currentTier, item.requiredTier);
          return (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); if (isMobile) setExpanded(false); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                currentPage === item.id
                  ? "bg-navy-800 border-r-2"
                  : "text-gray-400 hover:text-gray-200 hover:bg-navy-800"
              }`}
              style={currentPage === item.id ? { color: "var(--brand-color, #2ECC71)", borderColor: "var(--brand-color, #2ECC71)" } : undefined}
            >
              <span className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {expanded && <span>{item.label}</span>}
              </span>
              {expanded && locked && (
                <span className="flex items-center gap-0.5 text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-1.5 py-0.5 leading-none font-medium whitespace-nowrap">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  {item.tierLabel}
                </span>
              )}
              {expanded && item.comingSoon && (
                <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-full px-1.5 py-0.5 leading-none font-medium whitespace-nowrap">
                  SOON
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-navy-700">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-0 py-2 text-sm text-red-400/70 hover:text-red-400 transition-colors"
          title="Sign out"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {expanded ? <span>Sign out</span> : null}
        </button>
        {expanded && userName && (
          <p className="text-xs text-gray-500 mt-1 truncate">{userName}</p>
        )}
        {expanded && branding?.partner_name && (
          <div className="flex flex-col items-center gap-1 mt-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-500">Managed by</span>
              {branding.partner_logo_url ? (
                <img src={branding.partner_logo_url} alt={branding.partner_name} className="h-4 object-contain opacity-70" />
              ) : (
                <span className="text-[9px] text-gray-400 font-medium">{branding.partner_name}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
