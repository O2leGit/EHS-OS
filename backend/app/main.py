import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.api.routes import auth, documents, incidents, capas, dashboard, chat, reports, admin, audit, briefing, sites, branding, platform


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.upload_dir, exist_ok=True)
    await init_db()
    # Auto-seed demo data on startup
    from app.services.seed import seed
    try:
        await seed()
    except Exception as e:
        import traceback
        print(f"Seed ERROR: {e}")
        traceback.print_exc()
    yield


app = FastAPI(title="EHS Operating System", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(incidents.router, prefix="/api/incidents", tags=["incidents"])
app.include_router(capas.router, prefix="/api/capa", tags=["capa"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])
app.include_router(briefing.router, prefix="/api/briefing", tags=["briefing"])
app.include_router(sites.router, prefix="/api/sites", tags=["sites"])
app.include_router(branding.router, prefix="/api/tenant", tags=["tenant"])
app.include_router(platform.router, prefix="/api/platform", tags=["platform"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/public/fresh")
async def public_fresh_redirect():
    """Redirects to a cache-busted analysis URL. Give Claude Chat this link."""
    import time
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=f"/api/public/analysis/t{int(time.time())}", status_code=307)


@app.get("/api/public/analysis")
@app.get("/api/public/analysis/{cache_bust}")
async def public_analysis(response: Response, cache_bust: str = ""):
    """Public endpoint for Claude Chat / external AI analysis.
    Returns a comprehensive overview of the Bio-Techne demo tenant
    without requiring authentication.
    Append any unique path segment (e.g., /api/public/analysis/v5) to bust caches."""
    import time
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["ETag"] = f'"{int(time.time())}"'
    response.headers["Vary"] = "*"
    from app.core.database import get_pool
    pool = await get_pool()
    async with pool.acquire() as db:
        tenant = await db.fetchrow("SELECT id, name, slug FROM tenants WHERE slug = 'bio-techne'")
        if not tenant:
            return {"error": "Demo tenant not found"}
        tid = tenant["id"]

        # KPIs
        incidents_mtd = await db.fetchval(
            "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND created_at >= date_trunc('month', NOW())", tid)
        open_capas = await db.fetchval(
            "SELECT COUNT(*) FROM capas WHERE tenant_id=$1 AND status IN ('open','in_progress')", tid)
        overdue_capas = await db.fetchval(
            "SELECT COUNT(*) FROM capas WHERE tenant_id=$1 AND status != 'closed' AND due_date < NOW()", tid)

        # Incidents
        incidents = await db.fetch(
            """SELECT incident_number, incident_type, severity, title, description,
                      location, reported_by, status, created_at
               FROM incidents WHERE tenant_id=$1 ORDER BY created_at DESC""", tid)

        # CAPAs
        capas = await db.fetch(
            """SELECT c.capa_number, c.title, c.description, c.capa_type, c.status,
                      c.priority, c.due_date, c.created_at,
                      u.full_name as assigned_to_name,
                      i.incident_number as linked_incident
               FROM capas c
               LEFT JOIN users u ON c.assigned_to = u.id
               LEFT JOIN incidents i ON c.incident_id = i.id
               WHERE c.tenant_id=$1 ORDER BY c.created_at DESC""", tid)

        # Framework coverage
        coverage = await db.fetch(
            """SELECT framework_tier, framework_category, framework_series,
                      coverage_status, gaps, risk_severity, ai_reasoning
               FROM document_analyses WHERE tenant_id=$1
               ORDER BY framework_tier, framework_series""", tid)

        # Documents
        docs = await db.fetch(
            "SELECT filename, file_type, status, created_at FROM documents WHERE tenant_id=$1", tid)

        # Users
        users = await db.fetch(
            "SELECT full_name, email, role FROM users WHERE tenant_id=$1", tid)

        # Sites
        sites_rows = await db.fetch(
            "SELECT id, name, code, site_type, employee_count FROM sites WHERE tenant_id=$1 AND is_active=true ORDER BY name", tid)

        # Audit Readiness Score (inline calc, mirrors /api/audit/readiness)
        cov_rows = await db.fetch(
            "SELECT coverage_status, COUNT(*) as cnt FROM document_analyses WHERE tenant_id=$1 GROUP BY coverage_status", tid)
        cov_total = sum(r["cnt"] for r in cov_rows)
        cov_covered = sum(r["cnt"] for r in cov_rows if r["coverage_status"] == "covered")
        cov_partial = sum(r["cnt"] for r in cov_rows if r["coverage_status"] == "partial")
        coverage_score = int(((cov_covered + cov_partial * 0.5) / max(cov_total, 1)) * 100)

        overdue_c = await db.fetchval(
            "SELECT COUNT(*) FROM capas WHERE tenant_id=$1 AND status != 'closed' AND due_date < CURRENT_DATE", tid)
        open_c = await db.fetchval(
            "SELECT COUNT(*) FROM capas WHERE tenant_id=$1 AND status IN ('open','in_progress')", tid)
        total_c = await db.fetchval("SELECT COUNT(*) FROM capas WHERE tenant_id=$1", tid)
        capa_score = int(max(0, min(100, 100 - (overdue_c * 25) - max(0, open_c - 3) * 5)))

        total_inc = await db.fetchval("SELECT COUNT(*) FROM incidents WHERE tenant_id=$1", tid)
        closed_inc = await db.fetchval(
            "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND status='closed'", tid)
        investigation_score = int((closed_inc / max(total_inc, 1)) * 100)

        near_misses = await db.fetchval(
            "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND incident_type='near_miss'", tid)
        injuries = await db.fetchval(
            "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND incident_type='injury'", tid)
        nm_ratio = near_misses / max(injuries, 1)
        nm_score = min(100, int((nm_ratio / 3) * 100))

        recent_docs = await db.fetchval(
            "SELECT COUNT(*) FROM documents WHERE tenant_id=$1 AND created_at > NOW() - INTERVAL '90 days'", tid)
        total_docs_count = await db.fetchval("SELECT COUNT(*) FROM documents WHERE tenant_id=$1", tid)
        doc_score = min(100, int((recent_docs / max(total_docs_count, 1)) * 100 + (30 if total_docs_count > 0 else 0)))

        audit_overall = int(
            coverage_score * 0.30 + capa_score * 0.25 + investigation_score * 0.20
            + nm_score * 0.15 + doc_score * 0.10
        )
        audit_level = "audit_ready" if audit_overall >= 80 else "needs_attention" if audit_overall >= 60 else "at_risk" if audit_overall >= 40 else "critical_gaps"

        import json
        def serialize(rows):
            result = []
            for r in rows:
                d = dict(r)
                for k, v in d.items():
                    if hasattr(v, 'isoformat'):
                        d[k] = v.isoformat()
                    elif isinstance(v, str) and k == 'gaps':
                        try:
                            d[k] = json.loads(v)
                        except Exception:
                            pass
                result.append(d)
            return result

        covered_count = sum(1 for r in coverage if r["coverage_status"] == "covered")
        total_count = len(coverage)
        coverage_pct = round((covered_count / total_count) * 100) if total_count else 0

        # Per-site metrics
        sites_with_metrics = []
        for site_row in sites_rows:
            sid = site_row["id"]
            s_total_inc = await db.fetchval(
                "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND site_id=$2", tid, sid)
            s_open_inc = await db.fetchval(
                "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND site_id=$2 AND status != 'closed'", tid, sid)
            s_inc_mtd = await db.fetchval(
                "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND site_id=$2 AND created_at >= date_trunc('month', NOW())", tid, sid)
            s_near_miss = await db.fetchval(
                "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND site_id=$2 AND incident_type='near_miss'", tid, sid)
            s_injuries = await db.fetchval(
                "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND site_id=$2 AND incident_type='injury'", tid, sid)
            s_total_capas = await db.fetchval(
                "SELECT COUNT(*) FROM capas WHERE tenant_id=$1 AND EXISTS (SELECT 1 FROM incidents WHERE incidents.id = capas.incident_id AND incidents.site_id=$2)", tid, sid)
            s_open_capas = await db.fetchval(
                "SELECT COUNT(*) FROM capas WHERE tenant_id=$1 AND status IN ('open','in_progress') AND EXISTS (SELECT 1 FROM incidents WHERE incidents.id = capas.incident_id AND incidents.site_id=$2)", tid, sid)
            s_overdue_capas = await db.fetchval(
                "SELECT COUNT(*) FROM capas WHERE tenant_id=$1 AND status != 'closed' AND due_date < NOW() AND EXISTS (SELECT 1 FROM incidents WHERE incidents.id = capas.incident_id AND incidents.site_id=$2)", tid, sid)
            s_closed_inc = await db.fetchval(
                "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND site_id=$2 AND status='closed'", tid, sid)
            s_dart_cases = await db.fetchval(
                "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND site_id=$2 AND incident_type='injury' AND severity IN ('high','critical')", tid, sid)
            s_hours = (site_row["employee_count"] or 0) * 2000 * 0.5
            s_trir = round((s_total_inc / max(s_hours, 1)) * 200000, 2) if s_hours > 0 else 0
            s_dart = round((s_dart_cases / max(s_hours, 1)) * 200000, 2) if s_hours > 0 else 0

            s_nm_ratio = f"{int(s_near_miss / max(s_total_inc, 1) * 100)}%"
            s_closure_rate = f"{int(s_closed_inc / max(s_total_capas, 1) * 100)}%" if s_total_capas > 0 else "N/A"

            # Simple site-level audit score
            s_inv_score = int((s_closed_inc / max(s_total_inc, 1)) * 100)
            s_capa_score = int(max(0, min(100, 100 - (s_overdue_capas * 25) - max(0, s_open_capas - 1) * 10)))
            s_audit = int(coverage_score * 0.30 + s_capa_score * 0.30 + s_inv_score * 0.25 + 50 * 0.15)
            s_level = "audit_ready" if s_audit >= 80 else "needs_attention" if s_audit >= 60 else "at_risk" if s_audit >= 40 else "critical_gaps"

            sites_with_metrics.append({
                "name": site_row["name"],
                "code": site_row["code"],
                "site_type": site_row["site_type"],
                "employee_count": site_row["employee_count"],
                "metrics": {
                    "total_incidents": s_total_inc,
                    "incidents_this_month": s_inc_mtd,
                    "open_incidents": s_open_inc,
                    "near_miss_ratio": s_nm_ratio,
                    "total_capas": s_total_capas,
                    "open_capas": s_open_capas,
                    "overdue_capas": s_overdue_capas,
                    "capa_closure_rate": s_closure_rate,
                    "framework_coverage_pct": coverage_pct,
                    "audit_readiness_score": s_audit,
                    "audit_readiness_level": s_level,
                    "trir": s_trir,
                    "dart": s_dart,
                }
            })

        # Global EHS metrics (roll up from all sites)
        total_employees = sum(s.get("employee_count", 0) or 0 for s in sites_with_metrics)
        total_injuries_all = await db.fetchval(
            "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND incident_type='injury'", tid)
        total_recordable = await db.fetchval(
            "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND incident_type IN ('injury', 'illness')", tid)
        total_dart_cases = await db.fetchval(
            "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND incident_type='injury' AND severity IN ('high', 'critical')", tid)
        total_near_misses_global = await db.fetchval(
            "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND incident_type='near_miss'", tid)
        total_all_incidents = await db.fetchval(
            "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1", tid)

        # Standard OSHA calculations (annualized, 200,000 hours = 100 FTE)
        # Assume 2000 hours/employee/year, scale to current period (6 months)
        hours_worked = total_employees * 2000 * 0.5  # 6 months of data
        trir = round((total_recordable / max(hours_worked, 1)) * 200000, 2) if hours_worked > 0 else 0
        dart_rate = round((total_dart_cases / max(hours_worked, 1)) * 200000, 2) if hours_worked > 0 else 0
        severity_rate = round((total_injuries_all / max(hours_worked, 1)) * 200000, 2) if hours_worked > 0 else 0
        nm_reporting_rate = round((total_near_misses_global / max(total_all_incidents, 1)) * 100, 1)

        from datetime import datetime, timezone
        import uuid
        return {
            "data_version": "5.1-mor-calibrated",
            "request_id": str(uuid.uuid4()),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "note": "v5.1: Real Bio-Techne MOR data (Feb 2026). 7 sites (MSP, STP, WAL, YYZ, YZ2, SJC, DEN), 32 incidents, 9 CAPAs. DART history (CY23-CY26), ISO 14001 passed 0 nonconformances, ergonomist approved. TRIR/DART metrics, AI executive reports, predictive briefing, audit readiness with top_actions.",
            "platform": "EHS Operating System (EHS-OS)",
            "description": "AI-native Environmental Health & Safety platform built for Bio-Techne",
            "demo_tenant": tenant["name"],
            "live_urls": {
                "frontend": "https://ehs-os.netlify.app",
                "backend_api": "https://ehs-os-backend-production.up.railway.app",
            },
            "demo_credentials": {
                "admin": {"email": "admin@bio-techne.com", "password": "demo123", "name": "Sarah Chen"},
                "manager": {"email": "jparker@bio-techne.com", "password": "demo123", "name": "James Parker"},
                "user": {"email": "mrodriguez@bio-techne.com", "password": "demo123", "name": "Maria Rodriguez"},
            },
            "kpi_summary": {
                "incidents_this_month": incidents_mtd,
                "open_capas": open_capas,
                "overdue_capas": overdue_capas,
                "framework_coverage_pct": coverage_pct,
                "total_incidents": len(incidents),
                "total_capas": len(capas),
                "total_documents": len(docs),
            },
            "global_metrics": {
                "total_employees": total_employees,
                "total_sites": len(sites_with_metrics),
                "hours_worked_ytd": int(hours_worked),
                "rates": {
                    "trir": {"value": trir, "label": "Total Recordable Incident Rate", "benchmark": 2.1, "unit": "per 200K hours",
                             "status": "good" if trir < 2.1 else "warning" if trir < 4.0 else "critical"},
                    "dart": {"value": dart_rate, "label": "Days Away/Restricted/Transfer Rate", "benchmark": 1.2, "unit": "per 200K hours",
                             "status": "good" if dart_rate < 1.2 else "warning" if dart_rate < 2.5 else "critical"},
                    "severity_rate": {"value": severity_rate, "label": "Severity Rate", "unit": "per 200K hours"},
                    "near_miss_reporting": {"value": nm_reporting_rate, "label": "Near-Miss Reporting Rate", "unit": "%", "target": 50,
                                            "status": "good" if nm_reporting_rate >= 50 else "warning" if nm_reporting_rate >= 30 else "critical"},
                },
                "compliance": {
                    "framework_coverage_pct": coverage_pct,
                    "audit_readiness_score": audit_overall,
                    "audit_readiness_level": audit_level,
                    "open_capas": open_c,
                    "overdue_capas": overdue_c,
                    "capa_closure_rate": f"{int((total_c - open_c) / max(total_c, 1) * 100)}%",
                },
                "dart_history": {
                    "cy23": 0.21,
                    "cy24": 0.87,
                    "cy25": 0.46,
                    "cy26_ytd": 1.33,
                    "rolling_12mo": 0.72,
                    "fy26": 0.70,
                    "note": "CY26 YTD: 3 recordables, FY26: 10 recordables. 7 recordables in last 90 days. Source: Feb 2026 MOR.",
                },
                "investigation": {
                    "total_incidents": total_inc,
                    "closed_investigations": closed_inc,
                    "closure_rate_pct": int((closed_inc / max(total_inc, 1)) * 100),
                    "avg_days_to_close": None,
                },
            },
            "features": [
                "AI Document Ingestion -- upload PDF/DOCX, get gap analysis against Pfizer 4-Tier EHS framework",
                "Photo-to-Incident -- snap a photo, AI fills the incident report with hazard analysis",
                "Predictive Risk Briefing -- AI analyzes incident patterns and predicts emerging risks",
                "Audit Readiness Score -- composite 0-100 score from 5 weighted compliance factors",
                "AI EHS Expert Chat -- context-aware advisor that knows your documents, gaps, and incidents",
                "SOP Draft Generator -- AI generates complete Standard Operating Procedures",
                "Incident Reporting -- mobile-first with voice-to-text, anonymous toggle, QR code access",
                "CAPA Workflow -- kanban board with drag-and-drop, filters, detail panels",
                "Gap Analysis Reports -- aggregated coverage across all documents",
                "Incident Notifications -- automatic email and SMS alerts to managers when incidents are reported",
                "Multi-Site Management -- manage multiple facilities with site-level filtering and benchmarking",
                "Multi-Tenant Admin -- tenant management, user roles, QR code generator",
                "AI Executive Reports -- on-demand weekly/monthly/quarterly/annual reports written by AI EHS director, with archive",
            ],
            "tech_stack": {
                "frontend": "Next.js 14 + React + Tailwind CSS (Netlify)",
                "backend": "Python FastAPI + asyncpg (Railway)",
                "database": "PostgreSQL (Railway)",
                "ai": "Claude API (Anthropic) -- Sonnet for analysis, Vision for photos",
            },
            "pfizer_framework": {
                "description": "4-Tier EHS Management System used as the compliance benchmark",
                "tiers": {
                    "1": "Policy -- Corporate EHS Policy",
                    "2": "Systems Manual -- Governance, PDCA, Roles",
                    "3": "Standards -- 100 (Management), 200 (Risk Topics), 300 (Programs), 400 (Resilience)",
                    "4": "Implementation -- SOPs, checklists, forms",
                },
            },
            "audit_readiness": {
                "overall_score": audit_overall,
                "level": audit_level,
                "factors": [
                    {"name": "Framework Coverage", "weight": 30, "score": coverage_score, "detail": f"{cov_covered}/{cov_total} standards fully covered"},
                    {"name": "CAPA Health", "weight": 25, "score": capa_score, "detail": f"{overdue_c} overdue, {open_c} open of {total_c} total"},
                    {"name": "Incident Investigation", "weight": 20, "score": investigation_score, "detail": f"{closed_inc}/{total_inc} investigations closed"},
                    {"name": "Near-Miss Ratio", "weight": 15, "score": nm_score, "detail": f"{near_misses}:{max(injuries, 1)} near-miss to injury ratio"},
                    {"name": "Document Freshness", "weight": 10, "score": doc_score, "detail": f"{recent_docs} documents uploaded in last 90 days"},
                ],
                "top_actions": [
                    {
                        "action": f"Close {overdue_c} overdue CAPAs: fume hood repair (CAPA-0003) and gas cylinder restraints (CAPA-0002)",
                        "points_improvement": 12,
                        "effort": "medium",
                        "rationale": "Overdue critical CAPAs are the largest drag on your score",
                    },
                    {
                        "action": "Develop ergonomics assessment program to address pipetting injury pattern",
                        "points_improvement": 8,
                        "effort": "high",
                        "rationale": "Active uncontrolled risk with 2 injuries in Lab 203",
                    },
                    {
                        "action": "Establish internal EHS audit program with quarterly schedule",
                        "points_improvement": 6,
                        "effort": "medium",
                        "rationale": "Auditing is a complete gap in the framework. Moves from red to yellow.",
                    },
                    {
                        "action": "Document PDCA management review schedule with defined triggers for corrective action",
                        "points_improvement": 4,
                        "effort": "low",
                        "rationale": "PDCA Methodology is partial due to missing Check and Act procedures. A one-page management review schedule closes this gap.",
                    },
                ],
                "projected_score_if_completed": 90,
                "projected_level": "audit_ready",
            },
            "incidents": serialize(incidents),
            "capas": serialize(capas),
            "framework_coverage": serialize(coverage),
            "documents": serialize(docs),
            "users": [dict(r) for r in users],
            "sites": sites_with_metrics,
            "predictive_briefing": {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "period": "March 6-20, 2026",
                "overall_risk": "elevated",
                "summary": "Three risk patterns detected across Denver and Cambridge facilities requiring targeted intervention this week.",
                "patterns": [
                    {
                        "severity": "high",
                        "title": "Building B Safety Equipment Maintenance Failures",
                        "description": "4 safety equipment compliance issues in Building B over 5 months: emergency shower testing lapsed (INC-0006), BSC certification expired (INC-0009), eyewash station access blocked (INC-0014), fire extinguisher inspection overdue 14 months (INC-0019).",
                        "trend": "Systemic maintenance scheduling failure isolated to Building B.",
                        "prediction": "Elevated probability of equipment unavailability during emergency. Audit exposure: an OSHA inspector would cite multiple violations in a single walkthrough.",
                        "recommended_action": "Conduct comprehensive Building B safety equipment audit this week. Establish monthly safety equipment checklist with assigned ownership.",
                        "matching_incidents": ["INC-0006", "INC-0009", "INC-0014", "INC-0019"],
                        "related_capas": ["CAPA-0006", "CAPA-0009"]
                    },
                    {
                        "severity": "high",
                        "title": "Lab 203 Repetitive Motion Injury Pattern",
                        "description": "2 ergonomic injuries from pipetting in Lab 203 within 12 days (INC-0007 wrist strain, INC-0016 thumb strain). A third incident (INC-0013, pipette tip box fell from shelf) suggests workstation organization issues.",
                        "trend": "Concentrated repetitive motion injuries in single lab. Both injuries involved 4+ hour pipetting sessions.",
                        "prediction": "Without intervention, additional RSI claims probable. Workers comp exposure averages $35,000-$60,000 per claim.",
                        "recommended_action": "Implement ergonomic assessment for all Lab 203 workstations. Evaluate electronic pipettes, rotation schedules, max continuous duration policy.",
                        "matching_incidents": ["INC-0007", "INC-0013", "INC-0016"],
                        "related_capas": ["CAPA-0008"]
                    },
                    {
                        "severity": "medium",
                        "title": "Lab 105 Equipment Degradation Cluster",
                        "description": "3 equipment-related incidents in Lab 105 over 4 months: fume hood below minimum velocity (INC-0003), splash shield cracked (INC-0010), gas manifold regulator leaking (INC-0020).",
                        "trend": "Multiple critical safety equipment failing in single lab. Pattern suggests aging infrastructure or deferred maintenance.",
                        "prediction": "Equipment failures increasing in frequency. Gas manifold leak represents most serious event.",
                        "recommended_action": "Schedule comprehensive equipment inspection for Lab 105. Review capital equipment replacement schedule.",
                        "matching_incidents": ["INC-0003", "INC-0010", "INC-0020"],
                        "related_capas": ["CAPA-0003", "CAPA-0005", "CAPA-0007"]
                    }
                ],
                "priorities_this_week": [
                    "Close CAPA-0003 (fume hood repair) immediately. Critical priority, 5 days overdue.",
                    "Conduct Building B safety equipment walkthrough and document findings.",
                    "Begin Lab 203 ergonomic assessment. Two injuries in 12 days demands immediate response."
                ],
                "metrics_vs_prior_period": {
                    "incidents": {"current_period": 14, "prior_period": 8, "direction": "up", "note": "Increase driven by multi-site reporting now active"},
                    "near_miss_ratio": {"current": "36%", "prior": "29%", "direction": "improving", "note": "Near-miss reporting increasing. Healthy trend."},
                    "open_capas": {"current": 7, "prior": 5, "direction": "up", "note": "New CAPAs from San Jose and Cambridge incidents"},
                    "overdue_capas": {"current": 2, "prior": 0, "direction": "up", "note": "CAPA-0003 and CAPA-0002 overdue. Requires immediate attention."},
                    "audit_readiness": {"current": 60, "prior": 55, "direction": "improving", "note": "Score improved 5 points from document uploads and CAPA closures"}
                },
                "positive_trends": [
                    "Near-miss reporting ratio improving (36% up from 29%). Frontline employees reporting hazards before injuries.",
                    "Two CAPAs closed this period (CAPA-0001, CAPA-0009), demonstrating system drives completion.",
                    "Five documents analyzed against framework. Coverage improved from 40% to 55%.",
                    "ISO 14001 Surveillance Audit passed with 0 nonconformances, only 6 verbal OFIs.",
                    "Multi-site incident reporting now active at all 7 facilities."
                ]
            },
            "branding": {
                "brand_name": "Bio-Techne",
                "powered_by": "Parzy Consulting",
                "logo_url": "https://www.bio-techne.com/themes/custom/bio_techne_global/logo.svg",
                "parzy_logo_url": "https://static.wixstatic.com/media/904f7b_34be1989a6234bc18b580179563ed22d~mv2.png/v1/crop/x_0,y_191,w_2169,h_617/fill/w_400,h_114,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/finalparzy3_edited.png",
                "favicon_url": None,
                "primary_color": "#1B2A4A",
                "accent_color": "#2ECC71",
                "chat_advisor_name": "EHS Advisor",
                "chat_advisor_subtitle": "AI-powered | Parzy Consulting",
                "chat_first_message": "I'm your EHS advisor, configured with Parzy Consulting's expertise and your facility's documents. I know your framework coverage, your incidents, your open corrective actions, and relevant OSHA and EPA regulations. Ask me anything about your EHS program.",
                "chat_suggested_prompts": [
                    "What are my biggest risks right now?",
                    "Which CAPAs should I prioritize?",
                    "Help me write an SOP",
                    "Explain a regulation"
                ]
            },
        }
