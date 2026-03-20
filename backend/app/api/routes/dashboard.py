from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.auth import get_current_user

router = APIRouter()


@router.get("/summary")
async def dashboard_summary(site_id: str = None, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    tid = current_user["tenant_id"]

    if site_id:
        incidents_mtd = await db.fetchval(
            """SELECT COUNT(*) FROM incidents
               WHERE tenant_id = $1::uuid AND site_id = $2::uuid AND created_at >= date_trunc('month', NOW())""",
            tid, site_id,
        )
        open_capas = await db.fetchval(
            "SELECT COUNT(*) FROM capas WHERE tenant_id = $1::uuid AND site_id = $2::uuid AND status IN ('open', 'in_progress')", tid, site_id
        )
        overdue_capas = await db.fetchval(
            "SELECT COUNT(*) FROM capas WHERE tenant_id = $1::uuid AND site_id = $2::uuid AND status != 'closed' AND due_date < NOW()", tid, site_id
        )
    else:
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


@router.get("/global-metrics")
async def get_global_metrics(db=Depends(get_db), user: dict = Depends(get_current_user)):
    tid = user["tenant_id"]

    # Get all sites
    sites = await db.fetch(
        "SELECT id, name, code, employee_count FROM sites WHERE tenant_id=$1::uuid AND is_active=true", tid)

    total_employees = sum(s["employee_count"] or 0 for s in sites)
    hours_worked = total_employees * 2000 * 0.5

    # Global counts
    total_incidents = await db.fetchval("SELECT COUNT(*) FROM incidents WHERE tenant_id=$1::uuid", tid)
    total_recordable = await db.fetchval(
        "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1::uuid AND incident_type IN ('injury', 'illness')", tid)
    dart_cases = await db.fetchval(
        "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1::uuid AND incident_type='injury' AND severity IN ('high', 'critical')", tid)
    near_misses = await db.fetchval(
        "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1::uuid AND incident_type='near_miss'", tid)
    closed = await db.fetchval(
        "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1::uuid AND status='closed'", tid)

    trir = round((total_recordable / max(hours_worked, 1)) * 200000, 2) if hours_worked > 0 else 0
    dart_rate = round((dart_cases / max(hours_worked, 1)) * 200000, 2) if hours_worked > 0 else 0
    nm_rate = round((near_misses / max(total_incidents, 1)) * 100, 1)

    # Per-site breakdown
    site_metrics = []
    for site in sites:
        sid = site["id"]
        s_inc = await db.fetchval("SELECT COUNT(*) FROM incidents WHERE tenant_id=$1::uuid AND site_id=$2", tid, sid)
        s_rec = await db.fetchval("SELECT COUNT(*) FROM incidents WHERE tenant_id=$1::uuid AND site_id=$2 AND incident_type IN ('injury','illness')", tid, sid)
        s_dart = await db.fetchval("SELECT COUNT(*) FROM incidents WHERE tenant_id=$1::uuid AND site_id=$2 AND incident_type='injury' AND severity IN ('high','critical')", tid, sid)
        s_nm = await db.fetchval("SELECT COUNT(*) FROM incidents WHERE tenant_id=$1::uuid AND site_id=$2 AND incident_type='near_miss'", tid, sid)
        s_closed = await db.fetchval("SELECT COUNT(*) FROM incidents WHERE tenant_id=$1::uuid AND site_id=$2 AND status='closed'", tid, sid)
        s_hours = (site["employee_count"] or 0) * 2000 * 0.5

        site_metrics.append({
            "name": site["name"],
            "code": site["code"],
            "employees": site["employee_count"] or 0,
            "total_incidents": s_inc,
            "trir": round((s_rec / max(s_hours, 1)) * 200000, 2) if s_hours > 0 else 0,
            "dart": round((s_dart / max(s_hours, 1)) * 200000, 2) if s_hours > 0 else 0,
            "near_miss_pct": round((s_nm / max(s_inc, 1)) * 100, 1),
            "investigation_closure_pct": round((s_closed / max(s_inc, 1)) * 100, 1),
        })

    return {
        "global": {
            "total_employees": total_employees,
            "total_sites": len(sites),
            "hours_worked_ytd": int(hours_worked),
            "trir": trir,
            "dart": dart_rate,
            "near_miss_reporting_pct": nm_rate,
            "investigation_closure_pct": round((closed / max(total_incidents, 1)) * 100, 1),
            "total_incidents": total_incidents,
        },
        "sites": site_metrics,
        "benchmarks": {
            "trir": {"industry_avg": 2.1, "best_in_class": 0.8, "label": "BLS Life Sciences Average"},
            "dart": {"industry_avg": 1.2, "best_in_class": 0.4, "label": "BLS Life Sciences Average"},
            "near_miss_target": 50,
        }
    }


@router.get("/recent-activity")
async def recent_activity(db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    # Get last 10 events (incidents + CAPAs) ordered by created_at
    incidents = await db.fetch(
        """SELECT 'incident' as type, incident_number as reference, title, created_at
           FROM incidents WHERE tenant_id = $1::uuid
           ORDER BY created_at DESC LIMIT 5""",
        current_user["tenant_id"],
    )
    capas = await db.fetch(
        """SELECT 'capa' as type, capa_number as reference, title, created_at
           FROM capas WHERE tenant_id = $1::uuid
           ORDER BY created_at DESC LIMIT 5""",
        current_user["tenant_id"],
    )
    combined = sorted(
        [dict(r) for r in incidents] + [dict(r) for r in capas],
        key=lambda x: x["created_at"],
        reverse=True,
    )[:10]
    return combined
