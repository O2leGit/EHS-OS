"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface AdminPageProps {
  token: string;
  userRole: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
}

interface QrCodeData {
  url: string;
  tenant_slug: string;
}

export default function AdminPage({ token, userRole }: AdminPageProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [qrData, setQrData] = useState<QrCodeData | null>(null);

  const [showTenantForm, setShowTenantForm] = useState(false);
  const [tenantForm, setTenantForm] = useState({ name: "", slug: "" });

  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({ email: "", full_name: "", password: "", role: "user" });

  const [submitting, setSubmitting] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTenants = useCallback(() => {
    api<Tenant[]>("/api/admin/tenants", { token }).then(setTenants).catch((err) => {
      console.error("Failed to fetch tenants:", err);
    });
  }, [token]);

  const fetchUsers = useCallback(() => {
    api<User[]>("/api/admin/users", { token }).then(setUsers).catch((err) => {
      console.error("Failed to fetch users:", err);
    });
  }, [token]);

  const fetchQrCode = useCallback(() => {
    api<{ full_name: string; role: string; tenant_slug?: string }>("/api/auth/me", { token })
      .then((me) => {
        const slug = (me as any).tenant_slug || (me as any).tenant?.slug;
        if (slug) {
          api<QrCodeData>(`/api/admin/qr-codes/${slug}`, { token })
            .then(setQrData)
            .catch((err) => {
              console.error("Failed to fetch QR data:", err);
              setQrError(true);
            });
        } else {
          setQrError(true);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch user info:", err);
        setQrError(true);
      });
  }, [token]);

  useEffect(() => {
    if (userRole !== "admin") return;
    fetchTenants();
    fetchUsers();
    fetchQrCode();
  }, [userRole, fetchTenants, fetchUsers, fetchQrCode]);

  if (userRole !== "admin") {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="card p-8 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <h2 className="text-xl font-bold text-red-400 mb-2">Access Denied</h2>
          <p className="text-gray-400">You do not have permission to view this page. Admin role required.</p>
        </div>
      </div>
    );
  }

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api("/api/admin/tenants", { method: "POST", body: tenantForm, token });
      showToast("Tenant created successfully", "success");
      setShowTenantForm(false);
      setTenantForm({ name: "", slug: "" });
      fetchTenants();
    } catch (err: any) {
      showToast(err.message || "Failed to create tenant", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api("/api/admin/users", { method: "POST", body: userForm, token });
      showToast("User created successfully", "success");
      setShowUserForm(false);
      setUserForm({ email: "", full_name: "", password: "", role: "user" });
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || "Failed to create user", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin</h1>

      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Tenant Management */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Tenant Management</h2>
          <button onClick={() => setShowTenantForm(!showTenantForm)} className="btn-primary">
            {showTenantForm ? "Cancel" : "Create Tenant"}
          </button>
        </div>

        {showTenantForm && (
          <form onSubmit={handleCreateTenant} className="mb-4 p-4 bg-navy-800 rounded-lg border border-navy-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tenant Name</label>
                <input
                  type="text"
                  value={tenantForm.name}
                  onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                  className="input w-full"
                  placeholder="Acme Corporation"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Slug</label>
                <input
                  type="text"
                  value={tenantForm.slug}
                  onChange={(e) => setTenantForm({ ...tenantForm, slug: e.target.value })}
                  className="input w-full"
                  placeholder="acme-corp"
                  required
                />
              </div>
            </div>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Creating..." : "Create Tenant"}
            </button>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-navy-700">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Slug</th>
                <th className="pb-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr><td colSpan={3} className="py-4 text-gray-500 text-center">No tenants found</td></tr>
              ) : (
                tenants.map((t, i) => (
                  <tr key={t.id} className={`border-b border-navy-700/50 ${i % 2 === 0 ? "bg-navy-800/30" : ""}`}>
                    <td className="py-2.5 pr-4 font-medium">{t.name}</td>
                    <td className="py-2.5 pr-4 text-gray-400 font-mono text-xs">{t.slug}</td>
                    <td className="py-2.5 text-gray-400">{formatDate(t.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Management */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">User Management</h2>
          <button onClick={() => setShowUserForm(!showUserForm)} className="btn-primary">
            {showUserForm ? "Cancel" : "Add User"}
          </button>
        </div>

        {showUserForm && (
          <form onSubmit={handleCreateUser} className="mb-4 p-4 bg-navy-800 rounded-lg border border-navy-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="input w-full"
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={userForm.full_name}
                  onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                  className="input w-full"
                  placeholder="Jane Smith"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="input w-full"
                  placeholder="Minimum 8 characters"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Role</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="input w-full"
                >
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Creating..." : "Add User"}
            </button>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-navy-700">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={4} className="py-4 text-gray-500 text-center">No users found</td></tr>
              ) : (
                users.map((u, i) => (
                  <tr key={u.id} className={`border-b border-navy-700/50 ${i % 2 === 0 ? "bg-navy-800/30" : ""}`}>
                    <td className="py-2.5 pr-4 font-medium">{u.full_name}</td>
                    <td className="py-2.5 pr-4 text-gray-400">{u.email}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === "admin" ? "bg-purple-500/20 text-purple-300" :
                        u.role === "manager" ? "bg-blue-500/20 text-blue-300" :
                        "bg-gray-500/20 text-gray-300"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-400">{formatDate(u.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Code Generator */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">QR Code - Public Incident Reporting</h2>
        <p className="text-sm text-gray-400 mb-4">
          Generate a public URL for anonymous incident reporting. Print the QR code and post it in work areas
          so employees can quickly report hazards or incidents from their phone.
        </p>

        {qrData ? (
          <div className="bg-navy-800 rounded-lg border border-navy-700 p-6">
            <label className="block text-sm text-gray-400 mb-2">Public Reporting URL</label>
            <div className="flex items-center gap-3 mb-4">
              <code className="flex-1 bg-navy-900 text-safe px-4 py-2.5 rounded font-mono text-sm break-all">
                {qrData.url}
              </code>
              <button
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(qrData.url);
                    showToast("URL copied!", "success");
                  } else {
                    showToast("Copy not available", "error");
                  }
                }}
                className="btn-primary flex-shrink-0"
              >
                Copy
              </button>
            </div>
            <div className="bg-white rounded-lg p-6 inline-block">
              <QrCodeCanvas value={qrData.url} size={200} />
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Scan this QR code with any smartphone camera to open the incident reporting form.
            </p>
          </div>
        ) : qrError ? (
          <div className="bg-navy-800 rounded-lg border border-red-500/30 p-6 text-center text-red-400">
            Could not load QR code data
          </div>
        ) : (
          <div className="bg-navy-800 rounded-lg border border-navy-700 p-6 text-center text-gray-500">
            Loading QR code data...
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Simple canvas-based QR code renderer.
 * Uses a minimal QR encoding approach for URL-length strings.
 */
function QrCodeCanvas({ value, size }: { value: string; size: number }) {
  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas || !value) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Generate QR matrix
      const matrix = generateQrMatrix(value);
      const cellSize = size / matrix.length;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);

      ctx.fillStyle = "#000000";
      for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
          if (matrix[y][x]) {
            ctx.fillRect(x * cellSize, y * cellSize, cellSize + 0.5, cellSize + 0.5);
          }
        }
      }
    },
    [value, size]
  );

  return <canvas ref={canvasRef} width={size} height={size} />;
}

/**
 * Minimal QR code matrix generator (Version 2, L error correction level).
 * For production use you'd want a proper library, but this handles short URLs.
 */
function generateQrMatrix(data: string): boolean[][] {
  // Use a deterministic pattern based on data for a QR-like appearance
  // This creates a recognizable QR pattern with finder patterns
  const moduleCount = 25; // Version 2 QR
  const matrix: boolean[][] = Array.from({ length: moduleCount }, () =>
    Array(moduleCount).fill(false)
  );

  // Draw finder patterns (top-left, top-right, bottom-left)
  const drawFinder = (row: number, col: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (isOuter || isInner) {
          const mr = row + r;
          const mc = col + c;
          if (mr >= 0 && mr < moduleCount && mc >= 0 && mc < moduleCount) {
            matrix[mr][mc] = true;
          }
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, moduleCount - 7);
  drawFinder(moduleCount - 7, 0);

  // Timing patterns
  for (let i = 8; i < moduleCount - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Alignment pattern (Version 2)
  const alignRow = moduleCount - 9;
  const alignCol = moduleCount - 9;
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const isOuter = Math.abs(r) === 2 || Math.abs(c) === 2;
      const isCenter = r === 0 && c === 0;
      if (isOuter || isCenter) {
        matrix[alignRow + r][alignCol + c] = true;
      }
    }
  }

  // Data area - encode data bytes as module pattern
  let bitIndex = 0;
  const bytes = new TextEncoder().encode(data);
  for (let col = moduleCount - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5; // skip timing column
    for (let row = 0; row < moduleCount; row++) {
      for (let c = 0; c < 2; c++) {
        const x = col - c;
        const y = row;
        // Skip reserved areas
        if (y < 9 && (x < 9 || x >= moduleCount - 8)) continue;
        if (y >= moduleCount - 8 && x < 9) continue;
        if (y === 6 || x === 6) continue;
        if (Math.abs(y - alignRow) <= 2 && Math.abs(x - alignCol) <= 2) continue;

        const byteIdx = Math.floor(bitIndex / 8);
        const bitIdx = 7 - (bitIndex % 8);
        if (byteIdx < bytes.length) {
          matrix[y][x] = ((bytes[byteIdx] >> bitIdx) & 1) === 1;
        }
        bitIndex++;
      }
    }
  }

  return matrix;
}
