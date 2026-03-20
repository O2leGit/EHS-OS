"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { setAuth, getToken, clearAuth } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [token, setToken] = useState<string | null>(
    typeof window !== "undefined" ? getToken() : null
  );
  const [email, setEmail] = useState("admin@helixbioworks.com");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoLogging, setAutoLogging] = useState(false);
  const [manualLogout, setManualLogout] = useState(false);

  // Auto-login: if no token and not manually logged out, auto-login with demo creds
  useEffect(() => {
    if (token) return; // Already logged in
    if (manualLogout) return; // User explicitly logged out, show form
    setAutoLogging(true);
    api<{ token: string; user_id: string }>("/api/auth/login", {
      method: "POST",
      body: { email: "admin@helixbioworks.com", password: "demo123" },
    })
      .then((res) => {
        setAuth(res.token, res.user_id);
        setToken(res.token);
      })
      .catch(() => {
        setAutoLogging(false); // Fall back to manual login form
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (token) {
    return (
      <Dashboard
        token={token}
        onLogout={() => {
          clearAuth();
          setToken(null);
          setManualLogout(true);
        }}
      />
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
        <h1 className="text-xl font-semibold text-white mb-1">Loading Parzy Consulting EHS-OS...</h1>
        <p className="text-gray-500 text-sm">Signing in automatically</p>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api<{ token: string; user_id: string }>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setAuth(res.token, res.user_id);
      setToken(res.token);
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
          <div className="w-16 h-16 bg-safe/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-safe" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Parzy Consulting</h1>
          <p className="text-gray-400 mt-1 text-sm">EHS Operating System</p>
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
            Demo: admin@helixbioworks.com / demo123
          </p>
        </form>
      </div>
    </div>
  );
}
