"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface QrReportingPageProps {
  token: string;
}

/** Generate a QR code image URL using the qrserver.com API */
function getQrImageUrl(data: string, size: number = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&margin=10`;
}

export default function QrReportingPage({ token }: QrReportingPageProps) {
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchQrData = useCallback(() => {
    api<{ full_name: string; role: string; tenant_slug?: string; tenant?: { slug?: string } }>("/api/auth/me", { token })
      .then((me) => {
        const slug = me.tenant_slug || me.tenant?.slug;
        if (slug) {
          setTenantSlug(slug);
          // Build the anonymous report URL client-side - no backend endpoint needed
          const baseUrl = window.location.origin;
          const url = `${baseUrl}/?report=true&tenant=${slug}`;
          setReportUrl(url);
          setLoading(false);
        } else {
          setError(true);
          setLoading(false);
        }
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    fetchQrData();
  }, [fetchQrData]);

  const handleCopy = () => {
    if (reportUrl && navigator.clipboard) {
      navigator.clipboard.writeText(reportUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    if (!reportUrl) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>QR Code - Anonymous Safety Reporting</title>
      <style>
        body { font-family: -apple-system, system-ui, sans-serif; text-align: center; padding: 40px; }
        h1 { font-size: 28px; margin-bottom: 8px; }
        h2 { font-size: 18px; color: #666; font-weight: normal; margin-bottom: 30px; }
        .qr-container { display: inline-block; padding: 20px; border: 3px solid #000; border-radius: 16px; margin-bottom: 20px; }
        .instructions { font-size: 16px; color: #444; max-width: 400px; margin: 20px auto; line-height: 1.5; }
        .shield { font-size: 14px; color: #2563eb; margin-top: 16px; }
        .url { font-size: 11px; color: #999; margin-top: 20px; word-break: break-all; }
      </style></head><body>
      <h1>Report a Safety Concern</h1>
      <h2>Scan the QR code below with your phone camera</h2>
      <div class="qr-container">
        <img src="${getQrImageUrl(reportUrl, 300)}" width="300" height="300" alt="QR Code" />
      </div>
      <p class="instructions">Point your smartphone camera at this QR code to open the safety reporting form. No app download needed.</p>
      <p class="shield">Your identity is completely anonymous.</p>
      <p class="url">${reportUrl}</p>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  const handleDownload = () => {
    if (!reportUrl) return;
    const link = document.createElement("a");
    link.href = getQrImageUrl(reportUrl, 500);
    link.download = `safety-qr-code-${tenantSlug}.png`;
    link.click();
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold">QR Code Reporting</h1>
          <p className="text-sm text-gray-500">Anonymous incident reporting via QR code</p>
        </div>
      </div>

      {/* How it works */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-sm font-bold text-green-400">1</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Print & Post</p>
              <p className="text-xs text-gray-500 mt-0.5">Print the QR poster and place it in visible locations throughout your facility.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-sm font-bold text-green-400">2</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Employee Scans</p>
              <p className="text-xs text-gray-500 mt-0.5">Any employee points their phone camera at the code. No app needed.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-sm font-bold text-green-400">3</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Anonymous Report</p>
              <p className="text-xs text-gray-500 mt-0.5">They fill out a simple form. No login, no personal data collected.</p>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code */}
      {loading ? (
        <div className="card p-12 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gray-600 border-t-green-500 rounded-full mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading QR code...</p>
        </div>
      ) : error || !reportUrl ? (
        <div className="card p-8 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto mb-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-red-400 font-medium">Could not load QR code data</p>
          <p className="text-gray-500 text-sm mt-1">Ensure your tenant is properly configured.</p>
        </div>
      ) : (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-gray-400">Public Reporting URL</label>
          </div>
          <div className="flex items-center gap-3 mb-6">
            <code className="flex-1 bg-navy-900 text-green-400 px-4 py-2.5 rounded font-mono text-sm break-all">
              {reportUrl}
            </code>
            <button onClick={handleCopy} className="btn-primary flex-shrink-0">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* QR Code Image */}
            <div className="bg-white rounded-xl p-6">
              <img
                src={getQrImageUrl(reportUrl, 220)}
                alt="QR Code for anonymous safety reporting"
                width={220}
                height={220}
                className="block"
              />
            </div>

            {/* Actions & Info */}
            <div className="flex-1 space-y-3">
              <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 bg-navy-700 hover:bg-navy-600 border border-navy-600 text-white font-medium py-3 px-4 rounded-lg transition-colors text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print QR Poster
              </button>

              <button onClick={handleDownload} className="w-full flex items-center justify-center gap-2 bg-navy-700 hover:bg-navy-600 border border-navy-600 text-white font-medium py-3 px-4 rounded-lg transition-colors text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download QR Image
              </button>

              <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-sm font-medium text-blue-300">Fully Anonymous</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  No login required. No personal data collected. Reports appear in your incident log
                  with an &quot;Anonymous&quot; badge so your team knows to follow up without identifying the reporter.
                </p>
              </div>

              <div className="bg-navy-900/50 border border-navy-700 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-300 mb-1.5">Suggested Locations</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>Break rooms and cafeterias</li>
                  <li>Near building exits and entrances</li>
                  <li>Safety bulletin boards</li>
                  <li>Equipment and storage areas</li>
                  <li>Loading docks and warehouse aisles</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
