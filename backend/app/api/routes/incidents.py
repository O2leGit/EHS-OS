from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db, get_pool
from app.core.auth import get_current_user

router = APIRouter()


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
        return {"id": str(row["id"]), "incident_number": row["incident_number"], "message": "Report submitted. Thank you."}


@router.get("/")
async def list_incidents(db=Depends(get_db), current_user: dict = Depends(get_current_user)):
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
