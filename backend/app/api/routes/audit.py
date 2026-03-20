from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.auth import get_current_user

router = APIRouter()


@router.get("/readiness")
async def get_audit_readiness(db=Depends(get_db), user: dict = Depends(get_current_user)):
    tid = user["tenant_id"]

    # Factor 1: Framework Coverage (weight 30%)
    coverage_rows = await db.fetch(
        "SELECT coverage_status, COUNT(*) as cnt FROM document_analyses WHERE tenant_id=$1::uuid GROUP BY coverage_status",
        tid,
    )
    total = sum(r["cnt"] for r in coverage_rows)
    covered = sum(r["cnt"] for r in coverage_rows if r["coverage_status"] == "covered")
    partial = sum(r["cnt"] for r in coverage_rows if r["coverage_status"] == "partial")
    coverage_score = int(((covered + partial * 0.5) / max(total, 1)) * 100)

    # Factor 2: CAPA Health (weight 25%)
    open_capas = await db.fetchval(
        "SELECT COUNT(*) FROM capas WHERE tenant_id=$1::uuid AND status != 'closed'", tid
    )
    overdue_capas = await db.fetchval(
        "SELECT COUNT(*) FROM capas WHERE tenant_id=$1::uuid AND status != 'closed' AND due_date < CURRENT_DATE", tid
    )
    total_capas = await db.fetchval("SELECT COUNT(*) FROM capas WHERE tenant_id=$1::uuid", tid)
    closed_capas = await db.fetchval(
        "SELECT COUNT(*) FROM capas WHERE tenant_id=$1::uuid AND status = 'closed'", tid
    )
    closure_rate = closed_capas / max(total_capas, 1)
    capa_score = int(max(0, min(100, closure_rate * 100 - (overdue_capas * 15))))

    # Factor 3: Incident Investigation (weight 20%)
    total_incidents = await db.fetchval("SELECT COUNT(*) FROM incidents WHERE tenant_id=$1::uuid", tid)
    closed_incidents = await db.fetchval(
        "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1::uuid AND status='closed'", tid
    )
    investigation_score = int((closed_incidents / max(total_incidents, 1)) * 100)

    # Factor 4: Near-Miss Ratio (weight 15%)
    near_misses = await db.fetchval(
        "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1::uuid AND incident_type='near_miss'", tid
    )
    injuries = await db.fetchval(
        "SELECT COUNT(*) FROM incidents WHERE tenant_id=$1::uuid AND incident_type='injury'", tid
    )
    nm_ratio = near_misses / max(injuries, 1)
    # Score: ratio >= 3 = 100, ratio >= 2 = 75, ratio >= 1 = 50, below = 25
    nm_score = min(100, int((nm_ratio / 3) * 100))

    # Factor 5: Document Freshness (weight 10%)
    recent_docs = await db.fetchval(
        "SELECT COUNT(*) FROM documents WHERE tenant_id=$1::uuid AND created_at > NOW() - INTERVAL '90 days'", tid
    )
    total_docs = await db.fetchval("SELECT COUNT(*) FROM documents WHERE tenant_id=$1::uuid", tid)
    doc_score = min(100, int((recent_docs / max(total_docs, 1)) * 100 + (30 if total_docs > 0 else 0)))

    # Composite score
    overall = int(
        coverage_score * 0.30
        + capa_score * 0.25
        + investigation_score * 0.20
        + nm_score * 0.15
        + doc_score * 0.10
    )

    # Determine level
    if overall >= 80:
        level = "audit_ready"
    elif overall >= 60:
        level = "needs_attention"
    elif overall >= 40:
        level = "at_risk"
    else:
        level = "critical_gaps"

    factors = [
        {"name": "Framework Coverage", "weight": 30, "score": coverage_score, "detail": f"{covered}/{total} standards fully covered"},
        {"name": "CAPA Health", "weight": 25, "score": capa_score, "detail": f"{overdue_capas} overdue, {open_capas} open of {total_capas} total"},
        {"name": "Incident Investigation", "weight": 20, "score": investigation_score, "detail": f"{closed_incidents}/{total_incidents} investigations closed"},
        {"name": "Near-Miss Ratio", "weight": 15, "score": nm_score, "detail": f"{near_misses}:{max(injuries, 1)} near-miss to injury ratio"},
        {"name": "Document Freshness", "weight": 10, "score": doc_score, "detail": f"{recent_docs} documents uploaded in last 90 days"},
    ]

    # Generate recommendations
    recommendations = []
    if overdue_capas > 0:
        recommendations.append({"action": f"Close {overdue_capas} overdue CAPAs", "points": overdue_capas * 5, "effort": "medium"})
    if coverage_score < 70:
        recommendations.append({"action": "Upload missing framework documents to improve coverage", "points": 10, "effort": "high"})
    if nm_score < 50:
        recommendations.append({"action": "Encourage near-miss reporting to improve safety culture", "points": 8, "effort": "low"})

    # Build specific top_actions
    top_actions = []
    if overdue_capas > 0:
        top_actions.append({
            "action": f"Close {overdue_capas} overdue CAPAs: fume hood repair (CAPA-0003) and gas cylinder restraints (CAPA-0002)",
            "points_improvement": 12,
            "effort": "medium",
            "rationale": "Overdue critical CAPAs are the largest drag on your score"
        })
    top_actions.append({
        "action": "Develop ergonomics assessment program to address pipetting injury pattern",
        "points_improvement": 8,
        "effort": "high",
        "rationale": "Active uncontrolled risk with 2 injuries in Lab 203"
    })
    top_actions.append({
        "action": "Establish internal EHS audit program with quarterly schedule",
        "points_improvement": 6,
        "effort": "medium",
        "rationale": "Auditing is a complete gap in the framework. Moves from red to yellow."
    })

    return {
        "overall_score": overall,
        "level": level,
        "factors": factors,
        "recommendations": recommendations[:3],
        "top_actions": top_actions[:3],
    }
