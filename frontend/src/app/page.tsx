"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { setAuth, getToken, clearAuth } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";
import PlatformDashboard from "@/components/PlatformDashboard";

const ADMIN_TOKEN_KEY = "ehs_admin_token";
const VIEWING_TENANT_KEY = "ehs_viewing_tenant";

export default function Home() {
  const [token, setToken] = useState<string | null>(
    typeof window !== "undefined" ? getToken() : null
  );
  const [email, setEmail] = useState("admin@bio-techne.com");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoLogging, setAutoLogging] = useState(false);
  const [manualLogout, setManualLogout] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [viewingTenant, setViewingTenant] = useState<string | null>(null);

  // Check if we have a stored admin token (login-as mode)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(VIEWING_TENANT_KEY);
      if (stored) setViewingTenant(stored);
    }
  }, []);

  // Detect platform admin after login
  useEffect(() => {
    if (!token) return;
    // Skip platform admin check if viewing as tenant
    if (localStorage.getItem(ADMIN_TOKEN_KEY)) {
      setIsPlatformAdmin(false);
      return;
    }
    api<{ is_platform_admin?: boolean }>("/api/auth/me", { token })
      .then((user) => {
        setIsPlatformAdmin(!!user.is_platform_admin);
      })
      .catch(() => {});
  }, [token]);

  // Auto-login: if no token and not manually logged out, auto-login with demo creds
  useEffect(() => {
    if (token) return; // Already logged in
    if (manualLogout) return; // User explicitly logged out, show form
    setAutoLogging(true);
    api<{ token: string; user_id: string }>("/api/auth/login", {
      method: "POST",
      body: { email: "admin@bio-techne.com", password: "demo123" },
    })
      .then((res) => {
        setAuth(res.token, res.user_id);
        setToken(res.token);
      })
      .catch(() => {
        setAutoLogging(false); // Fall back to manual login form
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = () => {
    clearAuth();
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(VIEWING_TENANT_KEY);
    setToken(null);
    setIsPlatformAdmin(false);
    setViewingTenant(null);
    setManualLogout(true);
  };

  const handleLoginAs = (tenantToken: string, tenantName: string) => {
    // Store current admin token so we can return
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
      localStorage.setItem(VIEWING_TENANT_KEY, tenantName);
    }
    setAuth(tenantToken, "");
    setToken(tenantToken);
    setIsPlatformAdmin(false);
    setViewingTenant(tenantName);
  };

  const handleReturnToAdmin = () => {
    const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (adminToken) {
      setAuth(adminToken, "");
      setToken(adminToken);
      setIsPlatformAdmin(true);
      setViewingTenant(null);
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      localStorage.removeItem(VIEWING_TENANT_KEY);
    }
  };

  if (token) {
    // Platform admin view
    if (isPlatformAdmin && !viewingTenant) {
      return (
        <PlatformDashboard
          token={token}
          onLogout={handleLogout}
          onLoginAs={handleLoginAs}
        />
      );
    }

    // Tenant view (normal or login-as)
    return (
      <div className="flex flex-col h-screen">
        {/* Return to Admin banner when viewing as tenant */}
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
              Return to Platform Admin
            </button>
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <Dashboard
            token={token}
            onLogout={handleLogout}
          />
        </div>
      </div>
    );
  }

  // Show loading screen during auto-login
  if (autoLogging) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <svg className="animate-spin w-10 h-10 text-green-400 mb-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <h1 className="text-xl font-semibold text-white mb-1">Loading EHS Management...</h1>
        <p className="text-gray-500 text-sm">Signing in automatically</p>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api<{ token: string; user_id: string; is_platform_admin?: boolean }>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setAuth(res.token, res.user_id);
      setToken(res.token);
      if (res.is_platform_admin) {
        setIsPlatformAdmin(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <h1 className="text-xl font-bold text-white">EHS Operating System</h1>
          <div className="flex flex-col items-center gap-1.5 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-400">ikigaiOS</span>
              <span className="text-[10px] text-gray-600">|</span>
              <span className="text-xs font-semibold text-gray-400">ScaleOS</span>
            </div>
          </div>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
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
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
          <p className="text-xs text-gray-500 text-center mt-4">
            Demo: admin@bio-techne.com / demo123
          </p>
        </form>
      </div>
    </div>
  );
}
