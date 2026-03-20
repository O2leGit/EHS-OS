import base64
import json
import os

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel
from typing import Optional
import anthropic

from app.core.database import get_db, get_pool
from app.core.auth import get_current_user

router = APIRouter()

PHOTO_ANALYSIS_PROMPT = """You are an EHS incident analysis expert for a life sciences facility.
Analyze this workplace photo and extract incident/hazard information.

Return JSON only, no other text:
{
  "type": "injury | near_miss | hazard | environmental | observation",
  "severity": "low | medium | high",
  "description": "Detailed description of what you observe in the photo",
  "hazards_identified": ["list of specific hazards visible"],
  "location_clues": "Any visible location indicators (signs, labels, equipment)",
  "immediate_actions": ["list of recommended immediate actions"],
  "regulatory_references": ["relevant OSHA/EPA standards that may apply"],
  "confidence": 0.0-1.0
}"""


class IncidentCreate(BaseModel):
    incident_type: str
    severity: str = "low"
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    reported_by: Optional[str] = None
    is_anonymous: bool = False


class PublicIncidentReport(BaseModel):
    incident_type: str
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    reported_by: Optional[str] = None
    is_anonymous: bool = True
    tenant_slug: str


@router.post("/")
async def create_incident(inc: IncidentCreate, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    count = await db.fetchval(
        "SELECT COUNT(*) FROM incidents WHERE tenant_id = $1::uuid", current_user["tenant_id"]
    )
    incident_number = f"INC-{count + 1:04d}"

    row = await db.fetchrow(
        """INSERT INTO incidents (tenant_id, incident_number, incident_type, severity, title,
                                  description, location, reported_by, reported_by_user, is_anonymous)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::uuid, $10)
           RETURNING id, incident_number""",
        current_user["tenant_id"], incident_number, inc.incident_type, inc.severity,
        inc.title, inc.description, inc.location, inc.reported_by, current_user["sub"], inc.is_anonymous,
    )

    # Send notifications asynchronously (don't block response)
    try:
        from app.services.notifications import send_incident_notifications
        import asyncio
        asyncio.create_task(send_incident_notifications(db, current_user["tenant_id"], {
            "incident_number": incident_number,
            "incident_type": inc.incident_type,
            "severity": inc.severity,
            "title": inc.title,
            "location": inc.location,
        }))
    except Exception:
        pass  # Don't fail incident creation if notifications fail

    return dict(row)


@router.post("/report")
async def public_report(inc: PublicIncidentReport):
    pool = await get_pool()
    async with pool.acquire() as db:
        tenant = await db.fetchrow("SELECT id FROM tenants WHERE slug = $1", inc.tenant_slug)
        if not tenant:
            raise HTTPException(status_code=400, detail="Invalid site")

        count = await db.fetchval(
            "SELECT COUNT(*) FROM incidents WHERE tenant_id = $1", tenant["id"]
        )
        incident_number = f"INC-{count + 1:04d}"

        row = await db.fetchrow(
            """INSERT INTO incidents (tenant_id, incident_number, incident_type, severity, title,
                                      description, location, reported_by, is_anonymous)
               VALUES ($1, $2, $3, 'medium', $4, $5, $6, $7, $8)
               RETURNING id, incident_number""",
            tenant["id"], incident_number, inc.incident_type, inc.title,
            inc.description, inc.location, inc.reported_by, inc.is_anonymous,
        )
        # Send notifications asynchronously (don't block response)
        try:
            from app.services.notifications import send_incident_notifications
            import asyncio
            asyncio.create_task(send_incident_notifications(db, tenant["id"], {
                "incident_number": incident_number,
                "incident_type": inc.incident_type,
                "severity": "medium",
                "title": inc.title,
                "location": inc.location,
            }))
        except Exception:
            pass  # Don't fail incident creation if notifications fail

        return {"id": str(row["id"]), "incident_number": row["incident_number"], "message": "Report submitted. Thank you."}


@router.get("/alerts")
async def get_incident_alerts(db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Get high-severity open incidents from last 48 hours for dashboard banner."""
    rows = await db.fetch(
        """SELECT id, incident_number, title, severity, location, created_at
           FROM incidents
           WHERE tenant_id = $1::uuid
           AND severity = 'high'
           AND status = 'open'
           AND created_at > NOW() - INTERVAL '48 hours'
           ORDER BY created_at DESC""",
        current_user["tenant_id"],
    )
    return [dict(r) for r in rows]


@router.get("/")
async def list_incidents(site_id: str = None, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    if site_id:
        rows = await db.fetch(
            """SELECT id, incident_number, incident_type, severity, title, status, location, occurred_at, created_at
               FROM incidents WHERE tenant_id = $1::uuid AND site_id = $2::uuid ORDER BY created_at DESC""",
            current_user["tenant_id"], site_id,
        )
    else:
        rows = await db.fetch(
            """SELECT id, incident_number, incident_type, severity, title, status, location, occurred_at, created_at
               FROM incidents WHERE tenant_id = $1::uuid ORDER BY created_at DESC""",
            current_user["tenant_id"],
        )
    return [dict(r) for r in rows]


@router.get("/{incident_id}")
async def get_incident(incident_id: str, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    row = await db.fetchrow(
        "SELECT * FROM incidents WHERE id = $1::uuid AND tenant_id = $2::uuid",
        incident_id, current_user["tenant_id"],
    )
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    return dict(row)


@router.post("/analyze-photo")
async def analyze_photo(
    photo: UploadFile = File(...),
    user=Depends(get_current_user),
    pool=Depends(get_pool),
):
    try:
        photo_bytes = await photo.read()
        content_type = photo.content_type or "image/jpeg"
        b64_data = base64.b64encode(photo_bytes).decode()

        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": content_type,
                            "data": b64_data,
                        },
                    },
                    {
                        "type": "text",
                        "text": PHOTO_ANALYSIS_PROMPT,
                    },
                ],
            }],
        )

        raw_text = message.content[0].text

        # Parse JSON from response
        try:
            # Strip markdown code fences if present
            text = raw_text
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            analysis = json.loads(text.strip())
        except (json.JSONDecodeError, IndexError):
            analysis = {
                "type": "observation",
                "severity": "medium",
                "description": raw_text,
                "hazards_identified": [],
                "location_clues": "",
                "immediate_actions": [],
                "regulatory_references": [],
                "confidence": 0.0,
            }

        return {"analysis": analysis}

    except anthropic.APIError as e:
        raise HTTPException(status_code=500, detail=f"Claude API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Photo analysis failed: {str(e)}")
