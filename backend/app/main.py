import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.api.routes import auth, documents, incidents, capas, dashboard, chat, reports, admin, audit, briefing, sites, branding


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.upload_dir, exist_ok=True)
    await init_db()
    # Auto-seed demo data on startup
    from app.services.seed import seed
    try:
        await seed()
    except Exception as e:
        print(f"Seed warning: {e}")
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


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/public/analysis")
async def public_analysis(response: Response):
    """Public endpoint for Claude Chat / external AI analysis.
    Returns a comprehensive overview of the Helix BioWorks demo tenant
    without requiring authentication."""
    import time
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["ETag"] = f'"{int(time.time())}"'
    from app.core.database import get_pool
    pool = await get_pool()
    async with pool.acquire() as db:
        tenant = await db.fetchrow("SELECT id, name, slug FROM tenants WHERE slug = 'helix-bioworks'")
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
            "SELECT name, code, site_type, employee_count FROM sites WHERE tenant_id=$1 AND is_active=true ORDER BY name", tid)

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
        capa_score = int(max(0, 100 - (overdue_c * 20) - (open_c * 5)))

        total_inc = await db.fetchval("SELECT COUNT(*) FROM incidents WHERE tenant_id=$1", tid)
        closed_inc = await db.fetchval(
            "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND status='closed'", tid)
        investigation_score = int((closed_inc / max(total_inc, 1)) * 100)

        near_misses = await db.fetchval(
            "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND incident_type='near_miss'", tid)
        injuries = await db.fetchval(
            "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND incident_type='injury'", tid)
        nm_ratio = near_misses / max(injuries, 1)
        nm_score = min(100, int((nm_ratio / 10) * 100))

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

        from datetime import datetime, timezone
        import uuid
        return {
            "data_version": "4.0-multisite-notifications",
            "request_id": str(uuid.uuid4()),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "note": "v4.0: multi-site management (4 sites), incident notifications (email/SMS), 28 incidents, 9 CAPAs, 5 documents, audit readiness with top_actions, rule-based risk briefing fallback, branding support",
            "platform": "EHS Operating System (EHS-OS)",
            "description": "AI-native Environmental Health & Safety platform for life sciences companies",
            "demo_tenant": tenant["name"],
            "live_urls": {
                "frontend": "https://ehs-os.netlify.app",
                "backend_api": "https://ehs-os-backend-production.up.railway.app",
            },
            "demo_credentials": {
                "admin": {"email": "admin@helixbioworks.com", "password": "demo123", "name": "Sarah Chen"},
                "manager": {"email": "jparker@helixbioworks.com", "password": "demo123", "name": "James Parker"},
                "user": {"email": "mrodriguez@helixbioworks.com", "password": "demo123", "name": "Maria Rodriguez"},
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
            },
            "incidents": serialize(incidents),
            "capas": serialize(capas),
            "framework_coverage": serialize(coverage),
            "documents": serialize(docs),
            "users": [dict(r) for r in users],
            "sites": [dict(r) for r in sites_rows],
        }
