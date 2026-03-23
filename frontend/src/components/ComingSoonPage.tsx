"use client";

import { ReactNode } from "react";

interface ComingSoonPageProps {
  title: string;
  description: string;
  icon: ReactNode;
  capabilities: string[];
  expectedDate: string;
}

export default function ComingSoonPage({ title, description, icon, capabilities, expectedDate }: ComingSoonPageProps) {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(circle at 25% 25%, rgba(251, 191, 36, 0.15) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(251, 191, 36, 0.1) 0%, transparent 50%)"
        }} />
      </div>

      <div className="relative z-10 max-w-3xl w-full mx-auto flex flex-col items-center text-center px-4">
        {/* Coming Soon badge */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 mb-8">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          Coming Soon
        </span>

        {/* Icon with gradient circle */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{
            background: "linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%)",
            boxShadow: "0 0 60px rgba(251, 191, 36, 0.1)"
          }}>
            <div className="text-amber-400 w-12 h-12">
              {icon}
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white mb-3">{title}</h1>

        {/* Description */}
        <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mb-10">{description}</p>

        {/* Capabilities grid */}
        <div className="w-full max-w-2xl mb-10">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Key Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
            {capabilities.map((cap, i) => (
              <div key={i} className="flex items-start gap-3 bg-navy-800/60 border border-navy-700/50 rounded-lg px-4 py-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-300">{cap}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expected date badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-800 border border-navy-700 text-sm text-gray-400 mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Expected availability: <span className="text-white font-medium">{expectedDate}</span>
        </div>

        {/* Request Early Access button */}
        <button
          className="px-6 py-3 rounded-lg font-semibold text-sm text-white transition-all hover:scale-105 active:scale-95 mb-4"
          style={{
            background: "linear-gradient(135deg, #F59E0B, #D97706)",
            boxShadow: "0 4px 14px rgba(245, 158, 11, 0.3)"
          }}
        >
          Request Early Access
        </button>

        {/* Footer note */}
        <p className="text-xs text-gray-600 max-w-md">
          Interested? Talk to your account manager about accelerating this feature as part of your customization package.
        </p>
      </div>
    </div>
  );
}
