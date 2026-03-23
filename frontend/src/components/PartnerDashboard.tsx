"use client";

import { useState, useEffect } from "react";
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

export default function PartnerDashboard({ token, onLogout, onLoginAs }: PartnerDashboardProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [token]);

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

      <div className="max-w-7xl mx-auto px-6 py-6">
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
          <div className="px-6 py-4 border-b border-[#1e293b]">
            <h2 className="text-lg font-semibold text-white">My Clients</h2>
            <p className="text-xs text-gray-500 mt-0.5">Click Login to view and demo a client's EHS system</p>
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
      </div>
    </div>
  );
}
