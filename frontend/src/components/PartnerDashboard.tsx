"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  brand_name: string | null;
  created_at: string | null;
  users: number;
  sites: number;
  incidents: number;
  status: string;
}

interface PartnerProfile {
  name: string;
  brand_name: string;
  logo_url: string | null;
}

interface PartnerDashboardProps {
  token: string;
  onLogout: () => void;
  onLoginAs: (token: string, tenantName: string) => void;
}

// --- Revenue Split Percentages (Partner-Sourced Deals) ---
const SPLITS = {
  platform:       { partner: 0.30, label: "Platform Subscription" },
  setup:          { partner: 0.40, label: "Setup/Onboarding Fee" },
  customization:  { partner: 0.50, label: "Customization Services" },
  consulting:     { partner: 0.80, label: "EHS Consulting" },
  maintenance:    { partner: 0.35, label: "Ongoing Maintenance" },
  training:       { partner: 0.70, label: "Training Delivery" },
} as const;

// --- Demo pricing by tier (monthly) ---
interface TierPricing {
  label: string;
  segment: string;
  platformMo: number;
  maintenanceMo: number;
  setupOnetime: number;
  customOnetime: number;
  status: "Active" | "Onboarding" | "Pilot";
}

const CLIENT_PRICING: Record<string, TierPricing> = {
  "Bio-Techne": {
    label: "Advanced",
    segment: "Mid-Market",
    platformMo: 4500,
    maintenanceMo: 7500,
    setupOnetime: 25000,
    customOnetime: 15000,
    status: "Active",
  },
  "Danaher": {
    label: "Premium",
    segment: "Enterprise",
    platformMo: 8500,
    maintenanceMo: 12000,
    setupOnetime: 50000,
    customOnetime: 35000,
    status: "Active",
  },
  "3M Safety": {
    label: "Professional",
    segment: "Mid-Market",
    platformMo: 3200,
    maintenanceMo: 5000,
    setupOnetime: 18000,
    customOnetime: 10000,
    status: "Onboarding",
  },
  "Thermo Fisher": {
    label: "Growth",
    segment: "Enterprise",
    platformMo: 6000,
    maintenanceMo: 9000,
    setupOnetime: 40000,
    customOnetime: 25000,
    status: "Pilot",
  },
};

// Fallback for any tenant not in the map
const DEFAULT_PRICING: TierPricing = {
  label: "Essentials",
  segment: "SMB",
  platformMo: 1500,
  maintenanceMo: 2500,
  setupOnetime: 8000,
  customOnetime: 5000,
  status: "Active",
};

function getPricing(tenantName: string): TierPricing {
  return CLIENT_PRICING[tenantName] || DEFAULT_PRICING;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

// --- Partner Tier Logic ---
function getPartnerTier(annualRevenue: number): { tier: string; min: number; max: number; next: string | null; color: string; progressPct: number } {
  if (annualRevenue >= 300000) {
    return { tier: "Strategic", min: 300000, max: 500000, next: null, color: "text-purple-400", progressPct: 100 };
  } else if (annualRevenue >= 100000) {
    const pct = Math.min(100, ((annualRevenue - 100000) / 200000) * 100);
    return { tier: "Growth", min: 100000, max: 300000, next: "Strategic", color: "text-blue-400", progressPct: pct };
  } else {
    const pct = Math.min(100, (annualRevenue / 100000) * 100);
    return { tier: "Launch", min: 0, max: 100000, next: "Growth", color: "text-green-400", progressPct: pct };
  }
}

type TabId = "clients" | "revenue";

export default function PartnerDashboard({ token, onLogout, onLoginAs }: PartnerDashboardProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("clients");
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState({ email: "", full_name: "", password: "demo123", role: "user", tenant_id: "" });
  const [addingUser, setAddingUser] = useState(false);
  const [addUserSuccess, setAddUserSuccess] = useState<string | null>(null);

  const fetchData = () => {
    Promise.all([
      api<Tenant[]>("/api/partner/tenants", { token }),
      api<PartnerProfile>("/api/partner/profile", { token }),
    ])
      .then(([t, p]) => {
        setTenants(t);
        setProfile(p);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [token]);

  // --- Revenue computations ---
  const revenueData = useMemo(() => {
    const clients = tenants.map((t) => {
      const p = getPricing(t.name);
      const monthlyPlatform = p.platformMo;
      const monthlyMaintenance = p.maintenanceMo;
      const monthlyTotal = monthlyPlatform + monthlyMaintenance;
      const partnerPlatform = monthlyPlatform * SPLITS.platform.partner;
      const partnerMaintenance = monthlyMaintenance * SPLITS.maintenance.partner;
      const partnerMonthly = partnerPlatform + partnerMaintenance;
      return {
        ...t,
        tier: p.label,
        segment: p.segment,
        clientStatus: p.status,
        monthlyPlatform,
        monthlyMaintenance,
        monthlyTotal,
        partnerPlatform,
        partnerMaintenance,
        partnerMonthly,
        setupOnetime: p.setupOnetime,
        customOnetime: p.customOnetime,
        partnerSetup: p.setupOnetime * SPLITS.setup.partner,
        partnerCustom: p.customOnetime * SPLITS.customization.partner,
      };
    });

    const totalMRR = clients.reduce((s, c) => s + c.monthlyTotal, 0);
    const partnerMRR = clients.reduce((s, c) => s + c.partnerMonthly, 0);
    const totalPlatformMo = clients.reduce((s, c) => s + c.monthlyPlatform, 0);
    const totalMaintenanceMo = clients.reduce((s, c) => s + c.monthlyMaintenance, 0);
    const totalSetup = clients.reduce((s, c) => s + c.setupOnetime, 0);
    const totalCustom = clients.reduce((s, c) => s + c.customOnetime, 0);
    const partnerPlatformMo = clients.reduce((s, c) => s + c.partnerPlatform, 0);
    const partnerMaintenanceMo = clients.reduce((s, c) => s + c.partnerMaintenance, 0);
    const partnerSetupTotal = clients.reduce((s, c) => s + c.partnerSetup, 0);
    const partnerCustomTotal = clients.reduce((s, c) => s + c.partnerCustom, 0);
    const annualRecurring = partnerMRR * 12;
    const totalRevenue = totalMRR * 12 + totalSetup + totalCustom;
    const partnerTotal = annualRecurring + partnerSetupTotal + partnerCustomTotal;
    const activeClients = clients.filter((c) => c.clientStatus === "Active").length;
    const tierInfo = getPartnerTier(partnerTotal);

    return {
      clients,
      totalMRR,
      partnerMRR,
      totalRevenue,
      partnerTotal,
      activeClients,
      totalPlatformMo,
      totalMaintenanceMo,
      totalSetup,
      totalCustom,
      partnerPlatformMo,
      partnerMaintenanceMo,
      partnerSetupTotal,
      partnerCustomTotal,
      tierInfo,
    };
  }, [tenants]);

  const handleLoginAs = async (tenantId: string) => {
    try {
      const res = await api<{ token: string; tenant_name: string }>(`/api/partner/tenants/${tenantId}/login-as`, {
        method: "POST",
        token,
      });
      onLoginAs(res.token, res.tenant_name);
    } catch (err) {
      console.error("Login-as failed:", err);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingUser(true);
    try {
      const res = await api<{ email: string; tenant: string }>(`/api/partner/tenants/${addUserForm.tenant_id}/users`, {
        method: "POST", token, body: addUserForm,
      });
      setAddUserSuccess(`Created ${res.email} for ${res.tenant}`);
      setShowAddUser(false);
      setAddUserForm({ email: "", full_name: "", password: "demo123", role: "user", tenant_id: "" });
      fetchData();
      setTimeout(() => setAddUserSuccess(null), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Create failed");
    } finally {
      setAddingUser(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin w-10 h-10 text-green-400 mx-auto mb-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      {/* Header */}
      <header className="bg-[#0d1220] border-b border-[#1e293b] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {profile?.logo_url ? (
              <img src={profile.logo_url} alt={profile.brand_name} className="h-8 object-contain" />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">{profile?.brand_name?.charAt(0) || "P"}</span>
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-white">{profile?.brand_name || "Partner"}</h1>
              <p className="text-[10px] text-gray-500 -mt-0.5">EHS Platform</p>
            </div>
          </div>
          <button onClick={onLogout} className="text-sm text-gray-400 hover:text-red-400 transition-colors flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-[#0d1220] border-b border-[#1e293b]">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {([
            { id: "clients" as TabId, label: "Clients", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
            { id: "revenue" as TabId, label: "Revenue", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {addUserSuccess && (
          <div className="bg-green-900/50 border border-green-700 text-green-300 text-sm px-4 py-3 rounded-lg mb-4">{addUserSuccess}</div>
        )}

        {/* ===================== CLIENTS TAB ===================== */}
        {activeTab === "clients" && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-[#0d1220] border border-[#1e293b] rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">My Clients</p>
                <p className="text-2xl font-bold text-blue-400">{tenants.length}</p>
              </div>
              <div className="bg-[#0d1220] border border-[#1e293b] rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Total Sites</p>
                <p className="text-2xl font-bold text-green-400">{tenants.reduce((a, t) => a + t.sites, 0)}</p>
              </div>
              <div className="bg-[#0d1220] border border-[#1e293b] rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Total Incidents</p>
                <p className="text-2xl font-bold text-yellow-400">{tenants.reduce((a, t) => a + t.incidents, 0)}</p>
              </div>
            </div>

            {/* Client List */}
            <div className="bg-[#0d1220] border border-[#1e293b] rounded-xl">
              <div className="px-6 py-4 border-b border-[#1e293b] flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">My Clients</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Click Login to view and demo a client&apos;s EHS system</p>
                </div>
                <button
                  onClick={() => setShowAddUser(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add User
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-[#1e293b]">
                      <th className="text-left px-6 py-3 font-medium">Client</th>
                      <th className="text-center px-4 py-3 font-medium">Sites</th>
                      <th className="text-center px-4 py-3 font-medium">Users</th>
                      <th className="text-center px-4 py-3 font-medium">Incidents</th>
                      <th className="text-center px-4 py-3 font-medium">Status</th>
                      <th className="text-right px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t) => (
                      <tr key={t.id} className="border-b border-[#1e293b]/50 hover:bg-[#1e293b]/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#1e293b] flex items-center justify-center text-xs font-bold text-white">
                              {t.name.charAt(0)}
                            </div>
                            <span className="text-sm font-medium text-white">{t.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-300 text-center">{t.sites}</td>
                        <td className="px-4 py-4 text-sm text-gray-300 text-center">{t.users}</td>
                        <td className="px-4 py-4 text-sm text-gray-300 text-center">{t.incidents}</td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-900/50 text-green-400 border border-green-800/50">
                            {t.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleLoginAs(t.id)}
                            className="px-4 py-1.5 text-xs font-medium bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 border border-blue-800/50 transition-colors"
                          >
                            Login
                          </button>
                        </td>
                      </tr>
                    ))}
                    {tenants.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500 text-sm">
                          No clients assigned yet. Contact your platform administrator.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ===================== REVENUE TAB ===================== */}
        {activeTab === "revenue" && (
          <>
            {/* Revenue Overview Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-[#0d1220] border border-[#1e293b] rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Total Revenue (Annual)</p>
                <p className="text-2xl font-bold text-white">{fmt(revenueData.totalRevenue)}</p>
                <p className="text-[10px] text-gray-500 mt-1">All clients combined</p>
              </div>
              <div className="bg-[#0d1220] border border-[#1e293b] rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Your Share (Annual)</p>
                <p className="text-2xl font-bold text-green-400">{fmt(revenueData.partnerTotal)}</p>
                <p className="text-[10px] text-green-600 mt-1">Partner revenue split</p>
              </div>
              <div className="bg-[#0d1220] border border-[#1e293b] rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Monthly Recurring (MRR)</p>
                <p className="text-2xl font-bold text-blue-400">{fmt(revenueData.partnerMRR)}</p>
                <p className="text-[10px] text-gray-500 mt-1">Your monthly share</p>
              </div>
              <div className="bg-[#0d1220] border border-[#1e293b] rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Active Clients</p>
                <p className="text-2xl font-bold text-purple-400">{revenueData.activeClients}</p>
                <p className="text-[10px] text-gray-500 mt-1">of {tenants.length} total</p>
              </div>
            </div>

            {/* Partner Tier Progress */}
            <div className="bg-[#0d1220] border border-[#1e293b] rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Partner Tier</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Based on annual partner revenue</p>
                </div>
                <span className={`text-lg font-bold ${revenueData.tierInfo.color}`}>
                  {revenueData.tierInfo.tier}
                </span>
              </div>
              {/* Tier bar */}
              <div className="relative mb-2">
                <div className="h-3 bg-[#1e293b] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${revenueData.tierInfo.progressPct}%`,
                      background: revenueData.tierInfo.tier === "Strategic"
                        ? "linear-gradient(90deg, #a855f7, #7c3aed)"
                        : revenueData.tierInfo.tier === "Growth"
                          ? "linear-gradient(90deg, #3b82f6, #6366f1)"
                          : "linear-gradient(90deg, #22c55e, #10b981)",
                    }}
                  />
                </div>
                {/* Tier markers */}
                <div className="flex justify-between mt-1.5">
                  {[
                    { label: "Launch", val: "$0", pos: "left-0" },
                    { label: "Growth", val: "$100K", pos: "left-1/3" },
                    { label: "Strategic", val: "$300K", pos: "left-2/3" },
                  ].map((m) => (
                    <div key={m.label} className="text-center">
                      <p className="text-[10px] text-gray-500">{m.label}</p>
                      <p className="text-[10px] text-gray-600">{m.val}</p>
                    </div>
                  ))}
                </div>
              </div>
              {revenueData.tierInfo.next && (
                <p className="text-xs text-gray-500 mt-2">
                  {fmt(revenueData.tierInfo.max - revenueData.partnerTotal)} more to reach{" "}
                  <span className="text-white font-medium">{revenueData.tierInfo.next}</span> tier
                </p>
              )}
              {!revenueData.tierInfo.next && (
                <p className="text-xs text-purple-400 mt-2 font-medium">
                  Top-tier partner -- priority support, co-marketing, and enhanced splits
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-6 mb-6">
              {/* Revenue Split Visualization */}
              <div className="col-span-2 bg-[#0d1220] border border-[#1e293b] rounded-xl">
                <div className="px-5 py-4 border-b border-[#1e293b]">
                  <h3 className="text-sm font-semibold text-white">Revenue Split Breakdown</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Monthly recurring + one-time revenue</p>
                </div>
                <div className="p-5 space-y-4">
                  {/* Platform */}
                  <SplitRow
                    label="Platform Subscription"
                    sublabel="Monthly recurring"
                    total={revenueData.totalPlatformMo}
                    partnerShare={revenueData.partnerPlatformMo}
                    splitPct={SPLITS.platform.partner}
                    color="blue"
                  />
                  {/* Maintenance */}
                  <SplitRow
                    label="Ongoing Maintenance"
                    sublabel="Monthly recurring"
                    total={revenueData.totalMaintenanceMo}
                    partnerShare={revenueData.partnerMaintenanceMo}
                    splitPct={SPLITS.maintenance.partner}
                    color="green"
                  />
                  {/* Setup */}
                  <SplitRow
                    label="Setup/Onboarding"
                    sublabel="One-time"
                    total={revenueData.totalSetup}
                    partnerShare={revenueData.partnerSetupTotal}
                    splitPct={SPLITS.setup.partner}
                    color="yellow"
                  />
                  {/* Customization */}
                  <SplitRow
                    label="Customization Services"
                    sublabel="One-time"
                    total={revenueData.totalCustom}
                    partnerShare={revenueData.partnerCustomTotal}
                    splitPct={SPLITS.customization.partner}
                    color="purple"
                  />
                </div>
              </div>

              {/* Quick Stats Side Panel */}
              <div className="bg-[#0d1220] border border-[#1e293b] rounded-xl">
                <div className="px-5 py-4 border-b border-[#1e293b]">
                  <h3 className="text-sm font-semibold text-white">Split Summary</h3>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Platform (30% split)</p>
                    <p className="text-lg font-bold text-blue-400">{fmt(revenueData.partnerPlatformMo)}<span className="text-xs text-gray-500 font-normal">/mo</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Maintenance (35% split)</p>
                    <p className="text-lg font-bold text-green-400">{fmt(revenueData.partnerMaintenanceMo)}<span className="text-xs text-gray-500 font-normal">/mo</span></p>
                  </div>
                  <div className="border-t border-[#1e293b] pt-4">
                    <p className="text-xs text-gray-500 mb-1">Total Monthly Share</p>
                    <p className="text-xl font-bold text-white">{fmt(revenueData.partnerMRR)}<span className="text-xs text-gray-500 font-normal">/mo</span></p>
                  </div>
                  <div className="border-t border-[#1e293b] pt-4">
                    <p className="text-xs text-gray-500 mb-1">Setup Earned (40%)</p>
                    <p className="text-sm font-semibold text-yellow-400">{fmt(revenueData.partnerSetupTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Customization Earned (50%)</p>
                    <p className="text-sm font-semibold text-purple-400">{fmt(revenueData.partnerCustomTotal)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Revenue Breakdown Table */}
            <div className="bg-[#0d1220] border border-[#1e293b] rounded-xl">
              <div className="px-6 py-4 border-b border-[#1e293b]">
                <h3 className="text-sm font-semibold text-white">Client Revenue Detail</h3>
                <p className="text-xs text-gray-500 mt-0.5">Per-client monthly breakdown with partner share</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-[#1e293b]">
                      <th className="text-left px-6 py-3 font-medium">Client</th>
                      <th className="text-center px-4 py-3 font-medium">Tier</th>
                      <th className="text-right px-4 py-3 font-medium">Platform/mo</th>
                      <th className="text-right px-4 py-3 font-medium">Maintenance/mo</th>
                      <th className="text-right px-4 py-3 font-medium">Your Share/mo</th>
                      <th className="text-center px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueData.clients.map((c) => (
                      <tr key={c.id} className="border-b border-[#1e293b]/50 hover:bg-[#1e293b]/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#1e293b] flex items-center justify-center text-xs font-bold text-white">
                              {c.name.charAt(0)}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-white">{c.name}</span>
                              <p className="text-[10px] text-gray-500">{c.segment}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${
                            c.tier === "Premium" ? "bg-purple-900/50 text-purple-400 border-purple-800/50" :
                            c.tier === "Advanced" ? "bg-blue-900/50 text-blue-400 border-blue-800/50" :
                            c.tier === "Growth" ? "bg-cyan-900/50 text-cyan-400 border-cyan-800/50" :
                            c.tier === "Professional" ? "bg-indigo-900/50 text-indigo-400 border-indigo-800/50" :
                            "bg-gray-900/50 text-gray-400 border-gray-800/50"
                          }`}>
                            {c.tier}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-300 text-right">{fmt(c.monthlyPlatform)}</td>
                        <td className="px-4 py-4 text-sm text-gray-300 text-right">{fmt(c.monthlyMaintenance)}</td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm font-semibold text-green-400">{fmt(c.partnerMonthly)}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${
                            c.clientStatus === "Active" ? "bg-green-900/50 text-green-400 border-green-800/50" :
                            c.clientStatus === "Onboarding" ? "bg-yellow-900/50 text-yellow-400 border-yellow-800/50" :
                            "bg-blue-900/50 text-blue-400 border-blue-800/50"
                          }`}>
                            {c.clientStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {revenueData.clients.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500 text-sm">
                          No revenue data available yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {revenueData.clients.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-[#1e293b] bg-[#1e293b]/20">
                        <td className="px-6 py-3 text-sm font-semibold text-white">Total</td>
                        <td />
                        <td className="px-4 py-3 text-sm font-semibold text-white text-right">{fmt(revenueData.totalPlatformMo)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-white text-right">{fmt(revenueData.totalMaintenanceMo)}</td>
                        <td className="px-4 py-3 text-sm font-bold text-green-400 text-right">{fmt(revenueData.partnerMRR)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAddUser(false)}>
          <div className="bg-[#0d1220] border border-[#1e293b] rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleAddUser}>
              <h3 className="text-lg font-bold text-white mb-4">Add Client User</h3>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Client</label>
                  <select
                    value={addUserForm.tenant_id}
                    onChange={(e) => setAddUserForm({ ...addUserForm, tenant_id: e.target.value })}
                    className="w-full bg-[#1e293b] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                    required
                  >
                    <option value="">Select client...</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={addUserForm.full_name}
                    onChange={(e) => setAddUserForm({ ...addUserForm, full_name: e.target.value })}
                    className="w-full bg-[#1e293b] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                    placeholder="Ken Fairleigh"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={addUserForm.email}
                    onChange={(e) => setAddUserForm({ ...addUserForm, email: e.target.value })}
                    className="w-full bg-[#1e293b] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                    placeholder="kfairleigh@bio-techne.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Password</label>
                  <input
                    type="text"
                    value={addUserForm.password}
                    onChange={(e) => setAddUserForm({ ...addUserForm, password: e.target.value })}
                    className="w-full bg-[#1e293b] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Role</label>
                  <select
                    value={addUserForm.role}
                    onChange={(e) => setAddUserForm({ ...addUserForm, role: e.target.value })}
                    className="w-full bg-[#1e293b] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="user">User</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 bg-[#1e293b] text-gray-300 text-sm font-medium py-2.5 rounded-lg hover:bg-[#334155] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={addingUser} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
                  {addingUser ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SplitRow component for revenue visualization ---
function SplitRow({ label, sublabel, total, partnerShare, splitPct, color }: {
  label: string;
  sublabel: string;
  total: number;
  partnerShare: number;
  splitPct: number;
  color: "blue" | "green" | "yellow" | "purple";
}) {
  const colorMap = {
    blue:   { bar: "bg-blue-500",   text: "text-blue-400",   bg: "bg-blue-500/10" },
    green:  { bar: "bg-green-500",  text: "text-green-400",  bg: "bg-green-500/10" },
    yellow: { bar: "bg-yellow-500", text: "text-yellow-400", bg: "bg-yellow-500/10" },
    purple: { bar: "bg-purple-500", text: "text-purple-400", bg: "bg-purple-500/10" },
  };
  const c = colorMap[color];

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <span className="text-sm text-white font-medium">{label}</span>
          <span className="text-xs text-gray-500 ml-2">{sublabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Total: {fmt(total)}</span>
          <span className={`text-sm font-semibold ${c.text}`}>{fmt(partnerShare)}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>{fmtPct(splitPct)}</span>
        </div>
      </div>
      <div className="h-2 bg-[#1e293b] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${splitPct * 100}%` }} />
      </div>
    </div>
  );
}
