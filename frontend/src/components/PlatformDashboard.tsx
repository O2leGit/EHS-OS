"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  brand_name: string | null;
  logo_url: string | null;
  brand_color_primary: string | null;
  brand_color_accent: string | null;
  created_at: string | null;
  partner_id: string | null;
  partner_name: string;
  users: number;
  sites: number;
  incidents: number;
  status: string;
}

interface Partner {
  id: string;
  name: string;
  brand_name: string;
  tenant_count: number;
  user_count: number;
}

interface PlatformMetrics {
  total_tenants: number;
  total_partners: number;
  total_users: number;
  total_incidents: number;
  total_sites: number;
  platform_health: string;
}

interface PlatformUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_platform_admin: boolean;
  tenant_name: string | null;
  tenant_slug: string | null;
  partner_name: string | null;
}

interface TenantRevenue {
  platformFee: number;
  maintenanceFee: number;
  setupFee: number;
  customizationFee: number;
}

interface RevenueConfig {
  [tenantSlug: string]: TenantRevenue;
}

// Revenue split percentages for partner-sourced deals
const PARTNER_SPLITS = {
  platform:      { partner: 0.30, ikigai: 0.70 },
  maintenance:   { partner: 0.35, ikigai: 0.65 },
  setup:         { partner: 0.40, ikigai: 0.60 },
  customization: { partner: 0.50, ikigai: 0.50 },
};

const DEFAULT_REVENUE: Record<string, TenantRevenue> = {
  "bio-techne":  { platformFee: 4500, maintenanceFee: 7500, setupFee: 25000, customizationFee: 35000 },
  _advanced:     { platformFee: 3500, maintenanceFee: 5000, setupFee: 20000, customizationFee: 25000 },
  _standard:     { platformFee: 2000, maintenanceFee: 3000, setupFee: 15000, customizationFee: 15000 },
  _starter:      { platformFee: 1000, maintenanceFee: 1500, setupFee: 8000,  customizationFee: 5000  },
  _default:      { platformFee: 1500, maintenanceFee: 2500, setupFee: 12000, customizationFee: 10000 },
};

const STORAGE_KEY = "ehs_revenue_config";

function loadRevenueConfig(): RevenueConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveRevenueConfig(config: RevenueConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch { /* ignore */ }
}

function getDefaultRevenue(tenant: Tenant): TenantRevenue {
  if (DEFAULT_REVENUE[tenant.slug]) return { ...DEFAULT_REVENUE[tenant.slug] };
  // Infer tier from user count as a rough heuristic
  if (tenant.users >= 20) return { ...DEFAULT_REVENUE._advanced };
  if (tenant.users >= 10) return { ...DEFAULT_REVENUE._standard };
  if (tenant.users >= 3)  return { ...DEFAULT_REVENUE._starter };
  return { ...DEFAULT_REVENUE._default };
}

function fmt$(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface PlatformDashboardProps {
  token: string;
  onLogout: () => void;
  onLoginAs: (token: string, tenantName: string) => void;
}

export default function PlatformDashboard({ token, onLogout, onLoginAs }: PlatformDashboardProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", slug: "", industry: "general_manufacturing", partner_id: "" });
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ users: { email: string; password: string; role: string }[] } | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tenants" | "users" | "revenue">("tenants");
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("demo123");
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [changePw, setChangePw] = useState("");
  const [changePwDone, setChangePwDone] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState({ email: "", full_name: "", password: "demo123", role: "user", tenant_id: "" });
  const [addingUser, setAddingUser] = useState(false);
  const [addUserSuccess, setAddUserSuccess] = useState<string | null>(null);
  const [revenueConfig, setRevenueConfig] = useState<RevenueConfig>(loadRevenueConfig);

  // Initialize revenue defaults for tenants once loaded
  useEffect(() => {
    if (tenants.length === 0) return;
    setRevenueConfig((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const t of tenants) {
        if (!next[t.slug]) {
          next[t.slug] = getDefaultRevenue(t);
          changed = true;
        }
      }
      if (changed) saveRevenueConfig(next);
      return changed ? next : prev;
    });
  }, [tenants]);

  const updateRevenue = useCallback((slug: string, field: keyof TenantRevenue, value: number) => {
    setRevenueConfig((prev) => {
      const next = { ...prev, [slug]: { ...prev[slug], [field]: value } };
      saveRevenueConfig(next);
      return next;
    });
  }, []);

  const fetchData = async () => {
    try {
      const [t, m, p] = await Promise.all([
        api<Tenant[]>("/api/platform/tenants", { token }),
        api<PlatformMetrics>("/api/platform/metrics", { token }),
        api<Partner[]>("/api/platform/partners", { token }),
      ]);
      setTenants(t);
      setMetrics(m);
      setPartners(p);
    } catch (err) {
      console.error("Failed to load platform data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const u = await api<PlatformUser[]>("/api/platform/users", { token });
      setUsers(u);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      await api("/api/platform/users/" + userId + "/reset-password", {
        method: "POST", token, body: { new_password: resetPassword },
      });
      setResetSuccess(userId);
      setResetUserId(null);
      setTimeout(() => setResetSuccess(null), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Reset failed");
    }
  };

  const handleChangeMyPassword = async () => {
    if (!changePw) return;
    try {
      await api("/api/platform/change-password", {
        method: "POST", token, body: { new_password: changePw },
      });
      setChangePwDone(true);
      setChangePw("");
      setTimeout(() => setChangePwDone(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Change failed");
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingUser(true);
    try {
      const res = await api<{ email: string; tenant: string }>("/api/platform/users", {
        method: "POST", token, body: addUserForm,
      });
      setAddUserSuccess(`Created ${res.email} for ${res.tenant}`);
      setShowAddUser(false);
      setAddUserForm({ email: "", full_name: "", password: "demo123", role: "user", tenant_id: "" });
      fetchUsers();
      setTimeout(() => setAddUserSuccess(null), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Create failed");
    } finally {
      setAddingUser(false);
    }
  };

  useEffect(() => { fetchData(); }, [token]);
  useEffect(() => { if (activeTab === "users") fetchUsers(); }, [activeTab]);

  const handleLoginAs = async (tenantId: string) => {
    try {
      const res = await api<{ token: string; tenant_name: string }>(`/api/platform/tenants/${tenantId}/login-as`, {
        method: "POST",
        token,
      });
      onLoginAs(res.token, res.tenant_name);
    } catch (err) {
      console.error("Login-as failed:", err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const body = { ...createForm, partner_id: createForm.partner_id || null };
      const res = await api<{ id: string; name: string; slug: string; users: { email: string; password: string; role: string }[] }>(
        "/api/platform/tenants",
        { method: "POST", token, body },
      );
      setCreateResult(res);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (tenantId: string) => {
    try {
      await api(`/api/platform/tenants/${tenantId}`, { method: "DELETE", token });
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
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
          <p className="text-gray-400">Loading platform...</p>
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
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                <span className="text-green-400">ikigaiOS</span>
                <span className="text-gray-500 mx-1.5">|</span>
                <span className="text-white">ScaleOS</span>
              </h1>
              <p className="text-[10px] text-gray-500 -mt-0.5">EHS-OS Platform Admin</p>
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

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Partners", value: metrics.total_partners, color: "text-purple-400" },
              { label: "Tenants", value: metrics.total_tenants, color: "text-blue-400" },
              { label: "Users", value: metrics.total_users, color: "text-green-400" },
              { label: "Platform Health", value: metrics.platform_health.toUpperCase(), color: "text-emerald-400" },
            ].map((m) => (
              <div key={m.label} className="bg-[#0d1220] border border-[#1e293b] rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tab Buttons */}
        <div className="flex gap-1 mb-4">
          {[
            { id: "tenants" as const, label: "Tenants" },
            { id: "users" as const, label: "Users & Passwords" },
            { id: "revenue" as const, label: "Revenue" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-green-600/20 text-green-400 border border-green-700/50"
                  : "text-gray-400 hover:text-gray-200 hover:bg-[#1e293b]/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Users & Passwords Tab */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {/* Change My Password */}
            <div className="bg-[#0d1220] border border-[#1e293b] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Change My Password</h3>
              <div className="flex items-center gap-3">
                <input
                  type="password"
                  value={changePw}
                  onChange={(e) => setChangePw(e.target.value)}
                  placeholder="New password"
                  className="bg-[#1e293b] border border-[#334155] text-white text-sm rounded-lg px-3 py-2 focus:border-green-500 focus:outline-none w-64"
                />
                <button
                  onClick={handleChangeMyPassword}
                  disabled={!changePw}
                  className="px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Update
                </button>
                {changePwDone && <span className="text-green-400 text-sm">Password changed</span>}
              </div>
            </div>

            {/* Add User Success Toast */}
            {addUserSuccess && (
              <div className="bg-green-900/50 border border-green-700 text-green-300 text-sm px-4 py-3 rounded-lg">{addUserSuccess}</div>
            )}

            {/* All Users Table */}
            <div className="bg-[#0d1220] border border-[#1e293b] rounded-xl">
              <div className="px-6 py-4 border-b border-[#1e293b] flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">All Users</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Manage users and passwords across all tenants</p>
                </div>
                <button
                  onClick={() => setShowAddUser(true)}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
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
                      <th className="text-left px-6 py-3 font-medium">Name</th>
                      <th className="text-left px-4 py-3 font-medium">Email</th>
                      <th className="text-left px-4 py-3 font-medium">Role</th>
                      <th className="text-left px-4 py-3 font-medium">Tenant / Partner</th>
                      <th className="text-right px-6 py-3 font-medium">Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-[#1e293b]/50 hover:bg-[#1e293b]/30 transition-colors">
                        <td className="px-6 py-3 text-sm text-white">{u.full_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-300">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${
                            u.is_platform_admin ? "bg-green-900/50 text-green-400 border-green-800/50"
                            : u.role === "partner" ? "bg-blue-900/50 text-blue-400 border-blue-800/50"
                            : u.role === "admin" ? "bg-purple-900/50 text-purple-400 border-purple-800/50"
                            : "bg-gray-800/50 text-gray-400 border-gray-700/50"
                          }`}>
                            {u.is_platform_admin ? "Platform Admin" : u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {u.tenant_name || u.partner_name || "--"}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {resetUserId === u.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <input
                                type="text"
                                value={resetPassword}
                                onChange={(e) => setResetPassword(e.target.value)}
                                className="bg-[#1e293b] border border-[#334155] text-white text-xs rounded px-2 py-1.5 w-28 focus:border-green-500 focus:outline-none"
                              />
                              <button
                                onClick={() => handleResetPassword(u.id)}
                                className="px-2.5 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                              >
                                Set
                              </button>
                              <button
                                onClick={() => setResetUserId(null)}
                                className="px-2 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : resetSuccess === u.id ? (
                            <span className="text-green-400 text-xs">Reset done</span>
                          ) : (
                            <button
                              onClick={() => { setResetUserId(u.id); setResetPassword("demo123"); }}
                              className="px-3 py-1.5 text-xs font-medium text-yellow-400 hover:bg-yellow-900/30 rounded-lg border border-yellow-800/30 transition-colors"
                            >
                              Reset Password
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Revenue Tab */}
        {activeTab === "revenue" && (() => {
          // Compute all revenue metrics
          const tenantRows = tenants.map((t) => {
            const rev = revenueConfig[t.slug] || getDefaultRevenue(t);
            const hasPartner = t.partner_name !== "Direct" && t.partner_name !== "--" && !!t.partner_id;
            const ikigaiPlatform = hasPartner ? rev.platformFee * PARTNER_SPLITS.platform.ikigai : rev.platformFee;
            const ikigaiMaint = hasPartner ? rev.maintenanceFee * PARTNER_SPLITS.maintenance.ikigai : rev.maintenanceFee;
            const ikigaiSetup = hasPartner ? rev.setupFee * PARTNER_SPLITS.setup.ikigai : rev.setupFee;
            const ikigaiCustom = hasPartner ? rev.customizationFee * PARTNER_SPLITS.customization.ikigai : rev.customizationFee;
            const partnerPlatform = hasPartner ? rev.platformFee * PARTNER_SPLITS.platform.partner : 0;
            const partnerMaint = hasPartner ? rev.maintenanceFee * PARTNER_SPLITS.maintenance.partner : 0;
            const partnerSetup = hasPartner ? rev.setupFee * PARTNER_SPLITS.setup.partner : 0;
            const partnerCustom = hasPartner ? rev.customizationFee * PARTNER_SPLITS.customization.partner : 0;
            return {
              tenant: t,
              rev,
              hasPartner,
              totalMonthly: rev.platformFee + rev.maintenanceFee,
              totalOneTime: rev.setupFee + rev.customizationFee,
              ikigaiShare: ikigaiPlatform + ikigaiMaint + ikigaiSetup + ikigaiCustom,
              partnerShare: partnerPlatform + partnerMaint + partnerSetup + partnerCustom,
              ikigaiMonthly: ikigaiPlatform + ikigaiMaint,
              partnerMonthly: partnerPlatform + partnerMaint,
            };
          });

          const totalPlatformFees = tenantRows.reduce((s, r) => s + r.rev.platformFee, 0);
          const totalMaintFees = tenantRows.reduce((s, r) => s + r.rev.maintenanceFee, 0);
          const totalSetupFees = tenantRows.reduce((s, r) => s + r.rev.setupFee, 0);
          const totalCustomFees = tenantRows.reduce((s, r) => s + r.rev.customizationFee, 0);
          const totalMRR = totalPlatformFees + totalMaintFees;
          const totalIkigaiShare = tenantRows.reduce((s, r) => s + r.ikigaiShare, 0);
          const totalPartnerShare = tenantRows.reduce((s, r) => s + r.partnerShare, 0);
          const totalRevenue = totalMRR + totalSetupFees + totalCustomFees;
          const platformShareMRR = tenantRows.reduce((s, r) => s + r.ikigaiMonthly, 0);

          const annualMRR = totalMRR * 12;
          const annualPlatformNet = tenantRows.reduce((s, r) => s + r.ikigaiMonthly, 0) * 12;
          const annualPartnerPayout = tenantRows.reduce((s, r) => s + r.partnerMonthly, 0) * 12;
          const totalOneTime = totalSetupFees + totalCustomFees;
          const ikigaiOneTime = tenantRows.reduce((s, r) => s + (r.ikigaiShare - r.ikigaiMonthly), 0);
          const annualTotal = annualMRR + totalOneTime;
          const annualNetTotal = annualPlatformNet + ikigaiOneTime;

          // Bar chart max for scaling
          const barMax = Math.max(totalPlatformFees, totalMaintFees, totalSetupFees, totalCustomFees, 1);

          return (
            <div className="space-y-6">
              {/* Revenue Overview Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Platform Revenue", value: fmt$(totalRevenue), sub: "recurring + one-time", color: "text-green-400" },
                  { label: "Platform Share (ikigaiOS)", value: fmt$(totalIkigaiShare), sub: "after partner splits", color: "text-emerald-400" },
                  { label: "Partner Payouts", value: fmt$(totalPartnerShare), sub: "owed to partners", color: "text-amber-400" },
                  { label: "Platform MRR", value: fmt$(platformShareMRR), sub: `${fmt$(totalMRR)}/mo gross`, color: "text-blue-400" },
                ].map((c) => (
                  <div key={c.label} className="bg-[#0d1220] border border-[#1e293b] rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                    <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{c.sub}</p>
                  </div>
                ))}
              </div>

              {/* Per-Tenant Revenue Table with Sliders */}
              <div className="bg-[#0d1220] border border-[#1e293b] rounded-xl">
                <div className="px-6 py-4 border-b border-[#1e293b]">
                  <h2 className="text-lg font-semibold text-white">Per-Tenant Revenue Configuration</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Adjust sliders to model revenue scenarios. Values persist across sessions.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-[#1e293b]">
                        <th className="text-left px-4 py-3 font-medium w-36">Tenant</th>
                        <th className="text-left px-3 py-3 font-medium w-20">Partner</th>
                        <th className="text-left px-3 py-3 font-medium">Platform Fee /mo</th>
                        <th className="text-left px-3 py-3 font-medium">Maintenance /mo</th>
                        <th className="text-left px-3 py-3 font-medium">Setup (one-time)</th>
                        <th className="text-left px-3 py-3 font-medium">Custom (one-time)</th>
                        <th className="text-right px-3 py-3 font-medium w-24">ikigaiOS Share</th>
                        <th className="text-right px-4 py-3 font-medium w-24">Partner Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenantRows.map(({ tenant: t, rev, hasPartner, ikigaiShare, partnerShare }) => (
                        <tr key={t.id} className="border-b border-[#1e293b]/50 hover:bg-[#1e293b]/20 transition-colors align-top">
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-white">{t.name}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`text-xs ${hasPartner ? "text-purple-400" : "text-gray-600"}`}>
                              {hasPartner ? t.partner_name : "Direct"}
                            </span>
                          </td>
                          {/* Platform Fee Slider */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={0} max={10000} step={100}
                                value={rev.platformFee}
                                onChange={(e) => updateRevenue(t.slug, "platformFee", Number(e.target.value))}
                                className="rev-slider flex-1"
                              />
                              <span className="text-xs text-green-400 font-mono w-16 text-right">{fmt$(rev.platformFee)}</span>
                            </div>
                          </td>
                          {/* Maintenance Fee Slider */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={0} max={15000} step={100}
                                value={rev.maintenanceFee}
                                onChange={(e) => updateRevenue(t.slug, "maintenanceFee", Number(e.target.value))}
                                className="rev-slider flex-1"
                              />
                              <span className="text-xs text-green-400 font-mono w-16 text-right">{fmt$(rev.maintenanceFee)}</span>
                            </div>
                          </td>
                          {/* Setup Fee Slider */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={0} max={100000} step={1000}
                                value={rev.setupFee}
                                onChange={(e) => updateRevenue(t.slug, "setupFee", Number(e.target.value))}
                                className="rev-slider flex-1"
                              />
                              <span className="text-xs text-amber-400 font-mono w-16 text-right">{fmt$(rev.setupFee)}</span>
                            </div>
                          </td>
                          {/* Customization Fee Slider */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={0} max={100000} step={1000}
                                value={rev.customizationFee}
                                onChange={(e) => updateRevenue(t.slug, "customizationFee", Number(e.target.value))}
                                className="rev-slider flex-1"
                              />
                              <span className="text-xs text-purple-400 font-mono w-16 text-right">{fmt$(rev.customizationFee)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="text-sm font-semibold text-emerald-400">{fmt$(ikigaiShare)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-sm font-semibold ${partnerShare > 0 ? "text-amber-400" : "text-gray-600"}`}>
                              {partnerShare > 0 ? fmt$(partnerShare) : "--"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#334155]">
                        <td className="px-4 py-3 text-sm font-bold text-white" colSpan={2}>Totals</td>
                        <td className="px-3 py-3 text-right"><span className="text-xs font-bold text-green-400">{fmt$(totalPlatformFees)}/mo</span></td>
                        <td className="px-3 py-3 text-right"><span className="text-xs font-bold text-green-400">{fmt$(totalMaintFees)}/mo</span></td>
                        <td className="px-3 py-3 text-right"><span className="text-xs font-bold text-amber-400">{fmt$(totalSetupFees)}</span></td>
                        <td className="px-3 py-3 text-right"><span className="text-xs font-bold text-purple-400">{fmt$(totalCustomFees)}</span></td>
                        <td className="px-3 py-3 text-right"><span className="text-sm font-bold text-emerald-400">{fmt$(totalIkigaiShare)}</span></td>
                        <td className="px-4 py-3 text-right"><span className="text-sm font-bold text-amber-400">{fmt$(totalPartnerShare)}</span></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Bottom row: Annual Projections + Revenue by Category */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Annual Projections */}
                <div className="bg-[#0d1220] border border-[#1e293b] rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Annual Projections</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Annual Recurring Revenue (MRR x 12)", value: fmt$(annualMRR), color: "text-blue-400" },
                      { label: "Annual Maintenance Revenue", value: fmt$(totalMaintFees * 12), color: "text-green-400" },
                      { label: "One-Time Revenue (Setup + Custom)", value: fmt$(totalOneTime), color: "text-amber-400" },
                      { label: "Total Annual Revenue", value: fmt$(annualTotal), color: "text-white", bold: true },
                      { label: "Annual Partner Payouts", value: `(${fmt$(annualPartnerPayout + (totalPartnerShare - tenantRows.reduce((s, r) => s + r.partnerMonthly, 0)))})`, color: "text-red-400" },
                      { label: "Annual Platform Net Revenue", value: fmt$(annualNetTotal), color: "text-emerald-400", bold: true },
                    ].map((row) => (
                      <div key={row.label} className={`flex items-center justify-between py-1.5 ${row.bold ? "border-t border-[#334155] pt-3 mt-2" : ""}`}>
                        <span className="text-xs text-gray-400">{row.label}</span>
                        <span className={`text-sm font-mono ${row.bold ? "font-bold" : "font-medium"} ${row.color}`}>{row.value}</span>
                      </div>
                    ))}
                    <div className="border-t border-[#1e293b] pt-3 mt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">YoY Growth Target (30%)</span>
                        <span className="text-xs text-gray-500 font-mono">{fmt$(annualTotal * 1.3)} target</span>
                      </div>
                      <div className="mt-2 h-2 bg-[#1e293b] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-green-600 to-emerald-400 rounded-full" style={{ width: `${Math.min(100, (1 / 1.3) * 100)}%` }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-gray-600">Current</span>
                        <span className="text-[10px] text-gray-600">+30% Target</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Revenue by Category */}
                <div className="bg-[#0d1220] border border-[#1e293b] rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Revenue by Category</h3>
                  <div className="space-y-4">
                    {[
                      { label: "Platform Subscriptions", value: totalPlatformFees, suffix: "/mo", color: "bg-blue-500", textColor: "text-blue-400" },
                      { label: "Maintenance & Support", value: totalMaintFees, suffix: "/mo", color: "bg-green-500", textColor: "text-green-400" },
                      { label: "Setup Fees", value: totalSetupFees, suffix: "", color: "bg-amber-500", textColor: "text-amber-400" },
                      { label: "Customization", value: totalCustomFees, suffix: "", color: "bg-purple-500", textColor: "text-purple-400" },
                    ].map((cat) => (
                      <div key={cat.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-gray-400">{cat.label}</span>
                          <span className={`text-sm font-mono font-medium ${cat.textColor}`}>{fmt$(cat.value)}{cat.suffix}</span>
                        </div>
                        <div className="h-4 bg-[#1e293b] rounded-full overflow-hidden">
                          <div
                            className={`h-full ${cat.color} rounded-full transition-all duration-300`}
                            style={{ width: `${Math.max(2, (cat.value / barMax) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-4 border-t border-[#1e293b]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Recurring vs One-Time Split</span>
                      <span className="text-xs text-gray-400 font-mono">
                        {totalRevenue > 0 ? Math.round((totalMRR / totalRevenue) * 100) : 0}% recurring
                      </span>
                    </div>
                    <div className="mt-2 h-3 bg-[#1e293b] rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                        style={{ width: `${totalRevenue > 0 ? (totalMRR / totalRevenue) * 100 : 0}%` }}
                      />
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${totalRevenue > 0 ? ((totalSetupFees + totalCustomFees) / totalRevenue) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-blue-400">Recurring</span>
                      <span className="text-[10px] text-amber-400">One-Time</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Slider CSS */}
              <style>{`
                .rev-slider {
                  -webkit-appearance: none;
                  appearance: none;
                  background: #1e293b;
                  height: 6px;
                  border-radius: 3px;
                  outline: none;
                  min-width: 80px;
                }
                .rev-slider::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 16px;
                  height: 16px;
                  border-radius: 50%;
                  background: #10B981;
                  cursor: pointer;
                  border: 2px solid #064e3b;
                }
                .rev-slider::-moz-range-thumb {
                  width: 16px;
                  height: 16px;
                  border-radius: 50%;
                  background: #10B981;
                  cursor: pointer;
                  border: 2px solid #064e3b;
                }
                .rev-slider::-webkit-slider-runnable-track {
                  height: 6px;
                  border-radius: 3px;
                }
                .rev-slider::-moz-range-track {
                  height: 6px;
                  border-radius: 3px;
                  background: #1e293b;
                }
                .rev-slider:hover::-webkit-slider-thumb {
                  background: #34d399;
                }
                .rev-slider:hover::-moz-range-thumb {
                  background: #34d399;
                }
              `}</style>
            </div>
          );
        })()}

        {/* Tenant List */}
        {activeTab === "tenants" && <div className="bg-[#0d1220] border border-[#1e293b] rounded-xl">
          <div className="px-6 py-4 border-b border-[#1e293b] flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Tenants</h2>
            <button
              onClick={() => { setShowCreate(true); setCreateResult(null); setCreateForm({ name: "", slug: "", industry: "general_manufacturing", partner_id: "" }); }}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create New Tenant
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-[#1e293b]">
                  <th className="text-left px-6 py-3 font-medium">Tenant Name</th>
                  <th className="text-left px-4 py-3 font-medium">Partner</th>
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
                    <td className="px-4 py-4 text-sm text-gray-400">{t.partner_name}</td>
                    <td className="px-4 py-4 text-sm text-gray-300 text-center">{t.sites}</td>
                    <td className="px-4 py-4 text-sm text-gray-300 text-center">{t.users}</td>
                    <td className="px-4 py-4 text-sm text-gray-300 text-center">{t.incidents}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-900/50 text-green-400 border border-green-800/50">
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleLoginAs(t.id)}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 border border-blue-800/50 transition-colors"
                        >
                          Login As
                        </button>
                        {t.slug !== "bio-techne" && (
                          deleteConfirm === t.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(t.id)}
                                className="px-2 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(t.id)}
                              className="px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900/30 rounded-lg border border-red-800/30 transition-colors"
                            >
                              Delete
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>}
      </div>

      {/* Create Tenant Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-[#0d1220] border border-[#1e293b] rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            {createResult ? (
              <div>
                <h3 className="text-lg font-bold text-white mb-4">Tenant Created</h3>
                <div className="bg-[#1e293b]/50 rounded-lg p-4 mb-3">
                  <p className="text-xs text-gray-400 mb-2">Default Credentials</p>
                  {createResult.users.map((u) => (
                    <div key={u.email} className="flex items-center justify-between py-1.5 border-b border-[#1e293b]/50 last:border-0">
                      <span className="text-sm text-gray-300">{u.email}</span>
                      <span className="text-xs text-gray-500">{u.password} ({u.role})</span>
                    </div>
                  ))}
                </div>
                {(createResult as any).demo_data && (
                  <div className="bg-green-900/30 border border-green-800/50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-green-400 font-medium mb-1">Demo Data Generated</p>
                    <p className="text-xs text-green-300/70">
                      {(createResult as any).demo_data.sites_created} sites,{" "}
                      {(createResult as any).demo_data.incidents_created} incidents,{" "}
                      {(createResult as any).demo_data.capas_created} CAPAs
                    </p>
                  </div>
                )}
                <button onClick={() => setShowCreate(false)} className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate}>
                <h3 className="text-lg font-bold text-white mb-4">Create New Tenant</h3>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Company Name</label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") })}
                      className="w-full bg-[#1e293b] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 focus:border-green-500 focus:outline-none"
                      placeholder="e.g. Precision Aero"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Slug</label>
                    <input
                      type="text"
                      value={createForm.slug}
                      onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                      className="w-full bg-[#1e293b] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 focus:border-green-500 focus:outline-none"
                      placeholder="precision-aero"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Industry</label>
                    <select
                      value={createForm.industry}
                      onChange={(e) => setCreateForm({ ...createForm, industry: e.target.value })}
                      className="w-full bg-[#1e293b] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 focus:border-green-500 focus:outline-none"
                    >
                      <option value="aerospace">Aerospace</option>
                      <option value="agriculture">Agriculture / Farming</option>
                      <option value="biotech">Biotechnology</option>
                      <option value="chemical">Chemical</option>
                      <option value="construction">Construction</option>
                      <option value="fishing">Fishing / Marine</option>
                      <option value="food_processing">Food Processing / Distribution</option>
                      <option value="healthcare">Healthcare / Hospital</option>
                      <option value="hospitality">Hospitality / Hotel / Resort</option>
                      <option value="landscaping">Landscaping / Lawn Care</option>
                      <option value="medical_device">Medical Device</option>
                      <option value="pharma">Pharmaceutical</option>
                      <option value="professional_services">Professional Services / Office</option>
                      <option value="restaurant">Restaurant / Food Service</option>
                      <option value="roofing_solar">Roofing / Solar Installation</option>
                      <option value="warehousing">Warehousing / Logistics</option>
                      <option value="general_manufacturing">General Manufacturing</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Assign to Partner</label>
                    <select
                      value={createForm.partner_id}
                      onChange={(e) => setCreateForm({ ...createForm, partner_id: e.target.value })}
                      className="w-full bg-[#1e293b] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 focus:border-green-500 focus:outline-none"
                    >
                      <option value="">Direct (No Partner)</option>
                      {partners.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-[#1e293b] text-gray-300 text-sm font-medium py-2.5 rounded-lg hover:bg-[#334155] transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={creating} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
                    {creating ? "Creating..." : "Create Tenant"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAddUser(false)}>
          <div className="bg-[#0d1220] border border-[#1e293b] rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleAddUser}>
              <h3 className="text-lg font-bold text-white mb-4">Add User</h3>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tenant</label>
                  <select
                    value={addUserForm.tenant_id}
                    onChange={(e) => setAddUserForm({ ...addUserForm, tenant_id: e.target.value })}
                    className="w-full bg-[#1e293b] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 focus:border-green-500 focus:outline-none"
                    required
                  >
                    <option value="">Select tenant...</option>
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
                    className="w-full bg-[#1e293b] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 focus:border-green-500 focus:outline-none"
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
                    className="w-full bg-[#1e293b] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 focus:border-green-500 focus:outline-none"
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
                    className="w-full bg-[#1e293b] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 focus:border-green-500 focus:outline-none"
                    placeholder="demo123"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Role</label>
                  <select
                    value={addUserForm.role}
                    onChange={(e) => setAddUserForm({ ...addUserForm, role: e.target.value })}
                    className="w-full bg-[#1e293b] border border-[#334155] text-white text-sm rounded-lg px-3 py-2.5 focus:border-green-500 focus:outline-none"
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
                <button type="submit" disabled={addingUser} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
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
