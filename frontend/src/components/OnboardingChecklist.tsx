"use client";

import { useState, useEffect } from "react";
import { TenantBranding } from "./Dashboard";

interface OnboardingChecklistProps {
  tenantSlug: string;
  branding: TenantBranding | null;
  onClose: () => void;
  onNavigate: (page: string) => void;
}

interface Step {
  id: number;
  title: string;
  description: string;
  actionLabel: string;
  navigateTo: string;
  icon: React.ReactNode;
}

const STEPS: Step[] = [
  {
    id: 1,
    title: "Upload Your Documents",
    description:
      "Upload your safety policies, SOPs, and compliance documents. Our AI will automatically analyze them for framework gaps.",
    actionLabel: "Go to Documents",
    navigateTo: "documents",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
  },
  {
    id: 2,
    title: "Review Your Incidents",
    description:
      "Review and manage your incident log. Track investigations, assign corrective actions, and monitor trends.",
    actionLabel: "View Incidents",
    navigateTo: "incidents",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    id: 3,
    title: "Check Audit Readiness",
    description:
      "See your current audit readiness score and identify gaps before your next OSHA or ISO audit.",
    actionLabel: "View Dashboard",
    navigateTo: "dashboard",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    id: 4,
    title: "Generate Your First Report",
    description:
      "Generate an AI-powered executive briefing or weekly risk report in seconds. Download as Word for your leadership team.",
    actionLabel: "Go to Reports",
    navigateTo: "reports",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 5,
    title: "Invite Your Team",
    description:
      "Add EHS managers, site leads, and safety coordinators. Each user gets role-based access to their site data.",
    actionLabel: "Manage Users",
    navigateTo: "admin",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

export default function OnboardingChecklist({
  tenantSlug,
  branding,
  onClose,
  onNavigate,
}: OnboardingChecklistProps) {
  const storageKeyComplete = `ehs_onboarding_complete_${tenantSlug}`;
  const storageKeyStep = `ehs_onboarding_step_${tenantSlug}`;

  const [currentStep, setCurrentStep] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const saved = localStorage.getItem(storageKeyStep);
    return saved ? parseInt(saved, 10) : 0;
  });

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => new Set());

  // Persist current step
  useEffect(() => {
    localStorage.setItem(storageKeyStep, String(currentStep));
  }, [currentStep, storageKeyStep]);

  const handleToggleComplete = (stepId: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const handleAction = (navigateTo: string, stepId: number) => {
    // Mark step complete when action is clicked
    setCompletedSteps((prev) => new Set(prev).add(stepId));
    handleDismiss();
    onNavigate(navigateTo);
  };

  const handleDismiss = () => {
    localStorage.setItem(storageKeyComplete, "true");
    onClose();
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCompleteSetup = () => {
    handleDismiss();
  };

  const step = STEPS[currentStep];
  const accent = branding?.brand_color_accent || "#2ECC71";
  const completedCount = completedSteps.size;
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: "#0f1a2e" }}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-1">
            {branding?.logo_url && (
              <img
                src={branding.logo_url}
                alt={branding.brand_name}
                className="h-8 w-auto object-contain"
              />
            )}
            <h2 className="text-2xl font-bold text-white">
              Welcome to{" "}
              <span style={{ color: accent }}>
                {branding?.brand_name || "EHS-OS"}
              </span>
            </h2>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Complete these 5 steps to get the most out of your EHS platform.
          </p>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mt-5">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setCurrentStep(i)}
                className="relative group"
                title={s.title}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2 ${
                    i === currentStep
                      ? "scale-110"
                      : completedSteps.has(s.id)
                      ? "opacity-90"
                      : "opacity-50 border-slate-600"
                  }`}
                  style={{
                    borderColor:
                      i === currentStep || completedSteps.has(s.id)
                        ? accent
                        : undefined,
                    backgroundColor:
                      completedSteps.has(s.id) ? accent : "transparent",
                    color:
                      completedSteps.has(s.id) ? "#fff" : i === currentStep ? accent : "#94a3b8",
                  }}
                >
                  {completedSteps.has(s.id) ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                {/* connector line */}
                {i < STEPS.length - 1 && (
                  <div
                    className="absolute top-1/2 left-full w-2 h-0.5 -translate-y-1/2"
                    style={{
                      backgroundColor: completedSteps.has(s.id) ? accent : "#334155",
                    }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Completion counter */}
          <div className="text-center mt-2">
            <span className="text-xs text-slate-500">
              {completedCount} of {STEPS.length} complete
            </span>
          </div>
        </div>

        {/* Step card */}
        <div className="px-8 py-6">
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <div className="flex items-start gap-4">
              {/* Checkmark circle */}
              <button
                onClick={() => handleToggleComplete(step.id)}
                className={`mt-0.5 shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                  completedSteps.has(step.id)
                    ? "border-transparent"
                    : "border-slate-500 hover:border-slate-300"
                }`}
                style={{
                  backgroundColor: completedSteps.has(step.id) ? accent : "transparent",
                }}
                title={completedSteps.has(step.id) ? "Mark incomplete" : "Mark complete"}
              >
                {completedSteps.has(step.id) && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>

              {/* Icon */}
              <div
                className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${accent}20`, color: accent }}
              >
                {step.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white mb-1">
                  {step.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {step.description}
                </p>
                <button
                  onClick={() => handleAction(step.navigateTo, step.id)}
                  className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:brightness-110"
                  style={{ backgroundColor: accent }}
                >
                  {step.actionLabel}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 flex items-center justify-between">
          <button
            onClick={handleDismiss}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Skip Setup
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-white/10 text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {isLastStep ? (
              <button
                onClick={handleCompleteSetup}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:brightness-110"
                style={{ backgroundColor: accent }}
              >
                Complete Setup
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:brightness-110"
                style={{ backgroundColor: accent }}
              >
                Next
              </button>
            )}
          </div>
        </div>

        {/* Close X button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
          title="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
