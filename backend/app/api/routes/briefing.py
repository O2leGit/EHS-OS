import json
from datetime import datetime, timedelta, date

from fastapi import APIRouter, Depends
from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db

router = APIRouter()


def _serialize_row(row: dict) -> dict:
    """Convert date/datetime values to ISO strings for JSON serialization."""
    out = {}
    for k, v in row.items():
        if isinstance(v, (datetime, date)):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


@router.get("/weekly")
async def get_weekly_briefing(db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    tid = current_user["tenant_id"]

    # Get incidents last 90 days grouped by location, type, week
    incidents_90d = await db.fetch(
        """SELECT incident_type, severity, location, title, description,
                  DATE_TRUNC('week', created_at) as week,
                  created_at
           FROM incidents WHERE tenant_id = $1::uuid AND created_at > NOW() - INTERVAL '90 days'
           ORDER BY created_at DESC""",
        tid,
    )

    # Filter recent 14 days (use timezone-aware comparison)
    from datetime import timezone
    cutoff_14d = datetime.now(timezone.utc) - timedelta(days=14)
    recent_14d = [i for i in incidents_90d if i["created_at"] and i["created_at"] >= cutoff_14d]

    # Get current metrics
    incidents_mtd = await db.fetchval(
        """SELECT COUNT(*) FROM incidents
           WHERE tenant_id = $1::uuid AND created_at >= date_trunc('month', CURRENT_DATE)""",
        tid,
    )
    open_capas = await db.fetchval(
        "SELECT COUNT(*) FROM capas WHERE tenant_id = $1::uuid AND status IN ('open', 'in_progress')",
        tid,
    )
    overdue_capas = await db.fetchval(
        "SELECT COUNT(*) FROM capas WHERE tenant_id = $1::uuid AND status != 'closed' AND due_date < NOW()",
        tid,
    )

    # Get upcoming CAPA deadlines (next 7 days)
    upcoming = await db.fetch(
        """SELECT capa_number, title, due_date, assigned_to, priority
           FROM capas WHERE tenant_id = $1::uuid AND status != 'closed'
                AND due_date <= CURRENT_DATE + INTERVAL '7 days'
           ORDER BY due_date""",
        tid,
    )

    # Build pattern data
    location_counts = {}
    type_counts = {}
    for inc in incidents_90d:
        loc = inc["location"] or "Unknown"
        location_counts[loc] = location_counts.get(loc, 0) + 1
        t = inc["incident_type"]
        type_counts[t] = type_counts.get(t, 0) + 1

    # Defaults
    patterns = []
    overall_risk = "low"
    ai_summary = "Insufficient incident data for pattern analysis."
    priorities = []

    # If we have enough data and an API key, call Claude for analysis
    api_key = settings.anthropic_api_key or settings.claude_api_key
    if len(incidents_90d) >= 5 and api_key:
        incident_data = [
            {
                "type": str(i["incident_type"]),
                "severity": str(i["severity"]),
                "location": str(i["location"]),
                "title": str(i["title"]),
                "week": str(i["week"]),
            }
            for i in incidents_90d[:50]  # limit to 50 for token budget
        ]

        try:
            from anthropic import AsyncAnthropic

            client = AsyncAnthropic(api_key=api_key)
            message = await client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1500,
                messages=[
                    {
                        "role": "user",
                        "content": f"""You are a senior EHS Director with 20+ years of experience in life sciences and manufacturing environments. You have deep expertise in OSHA regulations (29 CFR 1910/1926), EPA compliance, and ISO 45001. You write with direct, authoritative language -- no hedging, no disclaimers. You speak like someone who has managed plant-level safety programs, presented to C-suite executives, and navigated OSHA inspections firsthand.

Given this incident data from the last 90 days, generate a weekly risk briefing for the leadership team.

Incident data: {json.dumps(incident_data)}

Location frequency: {json.dumps(location_counts)}
Type frequency: {json.dumps(type_counts)}
Recent 14-day count: {len(recent_14d)}
90-day total: {len(incidents_90d)}

For each detected pattern (clusters by location, type, or time):
1. Describe the pattern in one direct sentence -- state it like a finding, not a possibility
2. Assess risk level (low/moderate/elevated/critical) with executive-level risk framing (e.g., "exposure to OSHA citation under 29 CFR 1910.xxx", "potential OSHA recordable", "regulatory liability", "repeat violation territory")
3. Predict the operational and regulatory consequence if the pattern continues -- be specific about what OSHA, insurers, or auditors would flag
4. Recommend one specific, actionable intervention with clear ownership language (e.g., "Site leadership must...", "Implement immediately...", "Escalate to plant manager...")

Reference specific OSHA standards, ANSI guidelines, or industry benchmarks where applicable. Compare incident rates against BLS industry averages when relevant. Frame everything in terms of business risk: recordable rates, experience modifier impact, regulatory exposure, and operational continuity.

Be data-driven and action-oriented. No filler. No corporate pleasantries. Write like you're briefing the VP of Operations before a board meeting.

IMPORTANT CONTEXT: Denver is the pilot site for EHS-OS and accounts for the majority of reported incidents. This high volume is a POSITIVE indicator of reporting culture maturity, not disproportionate risk. Frame Denver's incident volume accordingly. As other sites (Toronto, Wallingford) enroll in Phase 2, the distribution will normalize.

Return JSON only:
{{
  "overall_risk": "low|moderate|elevated|critical",
  "summary": "one sentence overall assessment -- direct, authoritative, executive-level",
  "patterns": [{{"severity": "low|moderate|elevated|critical", "description": "pattern finding statement", "trend": "trend vs average with benchmark context", "prediction": "specific regulatory or operational consequence", "action": "specific intervention with ownership"}}],
  "priorities": ["priority 1", "priority 2", "priority 3"]
}}""",
                    }
                ],
            )

            content = message.content[0].text
            # Extract JSON from response
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            result = json.loads(content.strip())
            patterns = result.get("patterns", [])
            overall_risk = result.get("overall_risk", "low")
            ai_summary = result.get("summary", "")
            priorities = result.get("priorities", [])
        except Exception:
            pass  # Fall back to defaults

    # Rule-based fallback if AI analysis wasn't available
    if not patterns:
        # Detect location clusters
        for loc, count in location_counts.items():
            if count >= 3:
                matching = [str(i["title"]) for i in incidents_90d if (i["location"] or "") == loc]
                sev = "high" if any(i["severity"] == "high" for i in incidents_90d if (i["location"] or "") == loc) else "medium"
                patterns.append({
                    "severity": sev,
                    "title": f"{loc} Incident Cluster",
                    "description": f"{count} incidents at {loc} over the analysis period",
                    "trend": "Recurring incidents at same location",
                    "prediction": "Without intervention, additional incidents likely at this location",
                    "recommended_action": f"Conduct comprehensive safety audit of {loc}",
                    "matching_incidents": matching[:5],
                })

        # Detect type clusters
        for itype, count in type_counts.items():
            if count >= 4:
                patterns.append({
                    "severity": "medium",
                    "title": f"Elevated {itype.replace('_', ' ').title()} Reports",
                    "description": f"{count} {itype.replace('_', ' ')} incidents in 90 days",
                    "trend": f"Above-average {itype.replace('_', ' ')} frequency",
                    "prediction": f"Continued {itype.replace('_', ' ')} incidents expected without systemic intervention",
                    "recommended_action": f"Review {itype.replace('_', ' ')} prevention program and root causes",
                    "matching_incidents": [],
                })

        if patterns:
            overall_risk = "elevated" if any(p["severity"] == "high" for p in patterns) else "moderate"
            ai_summary = f"{len(patterns)} patterns detected requiring attention."
            priorities = [p["recommended_action"] for p in patterns[:3]]

    return {
        "overall_risk": overall_risk,
        "summary": ai_summary,
        "patterns": patterns,
        "priorities": priorities,
        "metrics": {
            "incidents_mtd": incidents_mtd or 0,
            "open_capas": open_capas or 0,
            "overdue_capas": overdue_capas or 0,
            "total_incidents_90d": len(incidents_90d),
            "recent_14d_count": len(recent_14d),
        },
        "upcoming_deadlines": [_serialize_row(dict(r)) for r in upcoming] if upcoming else [],
    }
