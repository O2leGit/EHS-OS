"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { setAuth, getToken, clearAuth } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";
import PlatformDashboard from "@/components/PlatformDashboard";
import PartnerDashboard from "@/components/PartnerDashboard";

const RETURN_TOKEN_KEY = "ehs_return_token";
const VIEWING_TENANT_KEY = "ehs_viewing_tenant";
const RETURN_VIEW_KEY = "ehs_return_view";

export default function Home() {
  const [token, setToken] = useState<string | null>(
    typeof window !== "undefined" ? getToken() : null
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickLogging, setQuickLogging] = useState<string | null>(null);
  const [viewType, setViewType] = useState<string | null>(null);
  const [viewingTenant, setViewingTenant] = useState<string | null>(null);

  // Restore viewing-as state from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(VIEWING_TENANT_KEY);
      if (stored) setViewingTenant(stored);
    }
  }, []);

  // Detect user type after login
  useEffect(() => {
    if (!token) return;
    if (localStorage.getItem(RETURN_TOKEN_KEY)) {
      setViewType("tenant");
      return;
    }
    api<{ is_platform_admin?: boolean; role?: string; partner_id?: string }>("/api/auth/me", { token })
      .then((user) => {
        if (user.is_platform_admin) {
          setViewType("platform");
        } else if (user.role === "partner" && user.partner_id) {
          setViewType("partner");
        } else {
          setViewType("tenant");
        }
      })
      .catch(() => {});
  }, [token]);

  const doLogin = async (loginEmail: string, loginPassword: string) => {
    const res = await api<{ token: string; user_id: string; is_platform_admin?: boolean; role?: string; partner_id?: string | null }>("/api/auth/login", {
      method: "POST",
      body: { email: loginEmail, password: loginPassword },
    });
    setAuth(res.token, res.user_id);
    setToken(res.token);
    if (res.is_platform_admin) {
      setViewType("platform");
    } else if (res.role === "partner" && res.partner_id) {
      setViewType("partner");
    } else {
      setViewType("tenant");
    }
  };

  const handleLogout = () => {
    clearAuth();
    localStorage.removeItem(RETURN_TOKEN_KEY);
    localStorage.removeItem(VIEWING_TENANT_KEY);
    localStorage.removeItem(RETURN_VIEW_KEY);
    setToken(null);
    setViewType(null);
    setViewingTenant(null);
  };

  const handleLoginAs = (tenantToken: string, tenantName: string) => {
    if (token) {
      localStorage.setItem(RETURN_TOKEN_KEY, token);
      localStorage.setItem(VIEWING_TENANT_KEY, tenantName);
      localStorage.setItem(RETURN_VIEW_KEY, viewType || "platform");
    }
    setAuth(tenantToken, "");
    setToken(tenantToken);
    setViewType("tenant");
    setViewingTenant(tenantName);
  };

  const handleReturnToAdmin = () => {
    const returnToken = localStorage.getItem(RETURN_TOKEN_KEY);
    const returnView = localStorage.getItem(RETURN_VIEW_KEY) || "platform";
    if (returnToken) {
      setAuth(returnToken, "");
      setToken(returnToken);
      setViewType(returnView);
      setViewingTenant(null);
      localStorage.removeItem(RETURN_TOKEN_KEY);
      localStorage.removeItem(VIEWING_TENANT_KEY);
      localStorage.removeItem(RETURN_VIEW_KEY);
    }
  };

  const returnLabel = typeof window !== "undefined" && localStorage.getItem(RETURN_VIEW_KEY) === "partner"
    ? "Return to Dashboard"
    : "Return to Platform Admin";

  if (token && viewType) {
    if (viewType === "platform") {
      return <PlatformDashboard token={token} onLogout={handleLogout} onLoginAs={handleLoginAs} />;
    }
    if (viewType === "partner") {
      return <PartnerDashboard token={token} onLogout={handleLogout} onLoginAs={handleLoginAs} />;
    }
    return (
      <div className="flex flex-col h-screen">
        {viewingTenant && (
          <div className="bg-blue-900/80 border-b border-blue-700 px-4 py-2 flex items-center justify-between text-sm z-50">
            <span className="text-blue-200">
              Viewing as: <strong className="text-white">{viewingTenant}</strong>
            </span>
            <button
              onClick={handleReturnToAdmin}
              className="bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
              </svg>
              {returnLabel}
            </button>
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <Dashboard token={token} onLogout={handleLogout} />
        </div>
      </div>
    );
  }

  // Quick login handler
  const handleQuickLogin = async (loginEmail: string) => {
    setQuickLogging(loginEmail);
    setError("");
    try {
      await doLogin(loginEmail, "demo123");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setQuickLogging(null);
    }
  };

  // Show loading during quick login
  if (quickLogging) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <svg className="animate-spin w-10 h-10 text-green-400 mb-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <h1 className="text-xl font-semibold text-white mb-1">Signing in...</h1>
        <p className="text-gray-500 text-sm">{quickLogging}</p>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await doLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <h1 className="text-xl font-bold text-white">EHS Operating System</h1>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <span className="text-xs font-semibold text-gray-400">ikigaiOS</span>
            <span className="text-[10px] text-gray-600">|</span>
            <span className="text-xs font-semibold text-gray-400">ScaleOS</span>
          </div>
        </div>

        {/* Quick Login Buttons */}
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 text-center">Quick Login</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleQuickLogin("chris@cotoole.com")}
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-[#1e293b] bg-[#0d1220] hover:border-green-600/50 hover:bg-[#0d1220]/80 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">PA</div>
              <span className="text-[10px] text-gray-400 group-hover:text-green-400 transition-colors">Platform Admin</span>
            </button>
            <button
              onClick={() => handleQuickLogin("jen@parzyconsulting.com")}
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-[#1e293b] bg-[#0d1220] hover:border-blue-600/50 hover:bg-[#0d1220]/80 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">P</div>
              <span className="text-[10px] text-gray-400 group-hover:text-blue-400 transition-colors">Partner</span>
            </button>
            <button
              onClick={() => handleQuickLogin("admin@bio-techne.com")}
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-[#1e293b] bg-[#0d1220] hover:border-cyan-600/50 hover:bg-[#0d1220]/80 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">C</div>
              <span className="text-[10px] text-gray-400 group-hover:text-cyan-400 transition-colors">Client Demo</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-[#1e293b]" />
          <span className="text-[10px] text-gray-600 uppercase tracking-wider">or sign in</span>
          <div className="flex-1 h-px bg-[#1e293b]" />
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-400 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field w-full"
              placeholder="you@company.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field w-full"
              placeholder="Enter password"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
