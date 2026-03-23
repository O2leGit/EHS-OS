"use client";

import { useState, useEffect } from "react";
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
  const [activeTab, setActiveTab] = useState<"tenants" | "users">("tenants");
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
                <div className="bg-[#1e293b]/50 rounded-lg p-4 mb-4">
                  <p className="text-xs text-gray-400 mb-2">Default Credentials</p>
                  {createResult.users.map((u) => (
                    <div key={u.email} className="flex items-center justify-between py-1.5 border-b border-[#1e293b]/50 last:border-0">
                      <span className="text-sm text-gray-300">{u.email}</span>
                      <span className="text-xs text-gray-500">{u.password} ({u.role})</span>
                    </div>
                  ))}
                </div>
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
                      <option value="pharma">Pharmaceutical</option>
                      <option value="biotech">Biotechnology</option>
                      <option value="medical_device">Medical Device</option>
                      <option value="chemical">Chemical</option>
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
