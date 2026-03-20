from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.auth import get_current_user

router = APIRouter()


@router.get("/gap-analysis")
async def gap_analysis(db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    tid = current_user["tenant_id"]

    rows = await db.fetch(
        """SELECT framework_tier, framework_category, framework_series,
                  coverage_status, gaps, risk_severity, ai_reasoning
           FROM document_analyses WHERE tenant_id = $1::uuid
           ORDER BY framework_tier, framework_category, framework_series""",
        tid,
    )

    # Build tier/category hierarchy
    tiers_map = {}
    all_gaps = []
    covered_count = 0
    total_count = 0

    for r in rows:
        tier = r["framework_tier"] or "Unknown"
        category = r["framework_category"] or "Unknown"
        series = r["framework_series"] or ""
        status = r["coverage_status"] or "gap"

        total_count += 1
        if status == "covered":
            covered_count += 1

        if tier not in tiers_map:
            tiers_map[tier] = {}
        if category not in tiers_map[tier]:
            tiers_map[tier][category] = {
                "category": category,
                "series": series,
                "coverage_status": status,
                "gaps": [],
                "risk_severity": r["risk_severity"],
                "ai_reasoning": r["ai_reasoning"],
            }

        # gaps is stored as JSONB (a JSON array of strings)
        import json as _json
        gap_list = r["gaps"] if isinstance(r["gaps"], list) else _json.loads(r["gaps"]) if r["gaps"] else []
        if status != "covered" and gap_list:
            for gap_text in gap_list:
                gap_entry = {
                    "category": category,
                    "gap_description": gap_text,
                    "risk_severity": r["risk_severity"],
                    "recommendation": r["ai_reasoning"],
                }
                tiers_map[tier][category]["gaps"].append(gap_text)
            all_gaps.append(gap_entry)

    overall_score = round((covered_count / total_count) * 100) if total_count > 0 else 0

    tiers = []
    for tier_name, categories in tiers_map.items():
        tiers.append({
            "tier": tier_name,
            "categories": list(categories.values()),
        })

    # Top gaps sorted by severity
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    top_gaps = sorted(
        all_gaps,
        key=lambda g: severity_order.get((g["risk_severity"] or "low").lower(), 4),
    )[:10]

    return {
        "overall_score": overall_score,
        "tiers": tiers,
        "top_gaps": top_gaps,
    }


@router.get("/gap-analysis/{category}")
async def gap_analysis_detail(category: str, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    tid = current_user["tenant_id"]

    rows = await db.fetch(
        """SELECT id, framework_tier, framework_category, framework_series,
                  coverage_status, gaps, ai_reasoning, chunk_text, risk_severity,
                  created_at
           FROM document_analyses
           WHERE tenant_id = $1::uuid AND framework_category = $2
           ORDER BY created_at DESC""",
        tid, category,
    )

    return [dict(r) for r in rows]
