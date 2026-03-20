from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.auth import get_current_user

router = APIRouter()


@router.get("/summary")
async def dashboard_summary(db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    tid = current_user["tenant_id"]

    incidents_mtd = await db.fetchval(
        """SELECT COUNT(*) FROM incidents
           WHERE tenant_id = $1::uuid AND created_at >= date_trunc('month', NOW())""",
        tid,
    )
    open_capas = await db.fetchval(
        "SELECT COUNT(*) FROM capas WHERE tenant_id = $1::uuid AND status IN ('open', 'in_progress')", tid
    )
    overdue_capas = await db.fetchval(
        "SELECT COUNT(*) FROM capas WHERE tenant_id = $1::uuid AND status != 'closed' AND due_date < NOW()", tid
    )

    total_categories = 20  # approximate total framework categories
    covered = await db.fetchval(
        """SELECT COUNT(DISTINCT framework_category)
           FROM document_analyses WHERE tenant_id = $1::uuid AND coverage_status = 'covered'""",
        tid,
    )
    coverage_pct = round((covered / total_categories) * 100) if total_categories > 0 else 0

    return {
        "incidents_mtd": incidents_mtd,
        "open_capas": open_capas,
        "overdue_capas": overdue_capas,
        "framework_coverage_pct": coverage_pct,
    }


@router.get("/incidents-over-time")
async def incidents_over_time(db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    rows = await db.fetch(
        """SELECT date_trunc('week', created_at)::date as week, COUNT(*) as count
           FROM incidents WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '6 months'
           GROUP BY week ORDER BY week""",
        current_user["tenant_id"],
    )
    return [{"week": str(r["week"]), "count": r["count"]} for r in rows]


@router.get("/capa-status")
async def capa_status(db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    rows = await db.fetch(
        """SELECT status, COUNT(*) as count
           FROM capas WHERE tenant_id = $1::uuid GROUP BY status""",
        current_user["tenant_id"],
    )
    return [dict(r) for r in rows]


@router.get("/framework-coverage")
async def framework_coverage(db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    rows = await db.fetch(
        """SELECT framework_tier, framework_category, framework_series, coverage_status,
                  COUNT(*) as chunk_count
           FROM document_analyses WHERE tenant_id = $1::uuid
           GROUP BY framework_tier, framework_category, framework_series, coverage_status
           ORDER BY framework_tier, framework_series""",
        current_user["tenant_id"],
    )
    return [dict(r) for r in rows]
