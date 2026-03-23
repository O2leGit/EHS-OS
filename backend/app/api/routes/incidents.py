import base64
import json
import os
import time
from collections import defaultdict

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel
from typing import Optional
import anthropic

from app.core.database import get_db, get_pool
from app.core.auth import get_current_user

router = APIRouter()

# Rate limiting for anonymous reports: max 10 per IP per hour
_rate_limit_store: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_MAX = 10
RATE_LIMIT_WINDOW = 3600  # 1 hour in seconds


def _check_rate_limit(ip: str) -> bool:
    """Returns True if request is allowed, False if rate limited."""
    now = time.time()
    # Clean old entries
    _rate_limit_store[ip] = [t for t in _rate_limit_store[ip] if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limit_store[ip]) >= RATE_LIMIT_MAX:
        return False
    _rate_limit_store[ip].append(now)
    return True


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

ANONYMOUS_CATEGORIES = [
    "unsafe_condition", "unsafe_behavior", "near_miss", "equipment_issue",
    "chemical_spill", "ergonomic", "fire_electrical", "other",
]


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


class AnonymousIncidentReport(BaseModel):
    category: str
    severity: str = "medium"
    description: str
    location: Optional[str] = None
    photo_url: Optional[str] = None
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


@router.post("/anonymous")
async def anonymous_report(inc: AnonymousIncidentReport, request: Request):
    """Accept anonymous incident reports from QR code scans. No authentication required."""
    # Rate limit by IP
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many reports. Please try again later.")

    # Validate category
    if inc.category not in ANONYMOUS_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {', '.join(ANONYMOUS_CATEGORIES)}")

    # Validate severity
    if inc.severity not in ("low", "medium", "high", "critical"):
        raise HTTPException(status_code=400, detail="Invalid severity. Must be low, medium, high, or critical.")

    # Validate description length
    if not inc.description or len(inc.description.strip()) < 20:
        raise HTTPException(status_code=400, detail="Description must be at least 20 characters.")

    # Map category to readable title
    category_labels = {
        "unsafe_condition": "Unsafe Condition",
        "unsafe_behavior": "Unsafe Behavior",
        "near_miss": "Near Miss",
        "equipment_issue": "Equipment Issue",
        "chemical_spill": "Chemical/Spill",
        "ergonomic": "Ergonomic Hazard",
        "fire_electrical": "Fire/Electrical Hazard",
        "other": "Other Safety Concern",
    }
    title = f"Anonymous Report: {category_labels.get(inc.category, inc.category)}"

    # Map category to incident_type
    category_to_type = {
        "unsafe_condition": "hazard",
        "unsafe_behavior": "hazard",
        "near_miss": "near_miss",
        "equipment_issue": "hazard",
        "chemical_spill": "environmental",
        "ergonomic": "hazard",
        "fire_electrical": "hazard",
        "other": "observation",
    }
    incident_type = category_to_type.get(inc.category, "observation")

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
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               RETURNING id, incident_number""",
            tenant["id"], incident_number, incident_type, inc.severity,
            title, inc.description.strip(), inc.location, "Anonymous Employee", True,
        )

        # Send notifications
        try:
            from app.services.notifications import send_incident_notifications
            import asyncio
            asyncio.create_task(send_incident_notifications(db, tenant["id"], {
                "incident_number": incident_number,
                "incident_type": incident_type,
                "severity": inc.severity,
                "title": title,
                "location": inc.location,
            }))
        except Exception:
            pass

        return {
            "id": str(row["id"]),
            "incident_number": row["incident_number"],
            "message": "Your anonymous report has been submitted. Thank you for helping keep the workplace safe.",
        }


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
            """SELECT id, incident_number, incident_type, severity, title, status, location, occurred_at, created_at, is_anonymous
               FROM incidents WHERE tenant_id = $1::uuid AND site_id = $2::uuid ORDER BY created_at DESC""",
            current_user["tenant_id"], site_id,
        )
    else:
        rows = await db.fetch(
            """SELECT id, incident_number, incident_type, severity, title, status, location, occurred_at, created_at, is_anonymous
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
