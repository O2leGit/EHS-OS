import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.api.routes import auth, documents, incidents, capas, dashboard, chat, reports, admin, audit, briefing


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


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/public/analysis")
async def public_analysis(response: Response):
    """Public endpoint for Claude Chat / external AI analysis.
    Returns a comprehensive overview of the Helix BioWorks demo tenant
    without requiring authentication."""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
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
        return {
            "data_version": "2.0-polished",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "note": "This data reflects DEMO_POLISH.md fixes: 20 incidents, 9 CAPAs across 3 assignees, 5 analyzed documents, enriched AI reasoning, 2 overdue CAPAs, 6-month incident spread, pattern detection ready",
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
            "incidents": serialize(incidents),
            "capas": serialize(capas),
            "framework_coverage": serialize(coverage),
            "documents": serialize(docs),
            "users": [dict(r) for r in users],
        }
