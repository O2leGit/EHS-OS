"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { setAuth, getToken } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [token, setToken] = useState<string | null>(
    typeof window !== "undefined" ? getToken() : null
  );
  const [email, setEmail] = useState("admin@helixbioworks.com");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (token) {
    return <Dashboard token={token} onLogout={() => { setToken(null); }} />;
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
          <h1 className="text-3xl font-bold text-safe">EHS-OS</h1>
          <p className="text-gray-400 mt-2">EHS Operating System</p>
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
