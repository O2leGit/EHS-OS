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
                        "content": f"""You are a predictive risk analyst for a life sciences EHS program.
Given this incident data from the last 90 days, generate a weekly risk briefing.

Incident data: {json.dumps(incident_data)}

Location frequency: {json.dumps(location_counts)}
Type frequency: {json.dumps(type_counts)}
Recent 14-day count: {len(recent_14d)}
90-day total: {len(incidents_90d)}

For each detected pattern (clusters by location, type, or time):
1. Describe the pattern in one sentence
2. Assess risk level (low/moderate/elevated/critical)
3. Predict what could happen if pattern continues
4. Recommend one specific intervention

Return JSON only:
{{
  "overall_risk": "low|moderate|elevated|critical",
  "summary": "one sentence overall summary",
  "patterns": [{{"severity": "low|moderate|elevated|critical", "description": "pattern description", "trend": "trend vs average", "prediction": "what could happen", "action": "recommended action"}}],
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
