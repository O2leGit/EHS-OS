from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.core.database import get_db
from app.core.auth import get_current_user

router = APIRouter()


class CapaCreate(BaseModel):
    incident_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    capa_type: str = "corrective"
    priority: str = "medium"
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None
    root_cause: Optional[str] = None


class CapaUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None
    root_cause: Optional[str] = None
    description: Optional[str] = None


@router.post("/", status_code=201)
async def create_capa(capa: CapaCreate, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    count = await db.fetchval(
        "SELECT COUNT(*) FROM capas WHERE tenant_id = $1::uuid", current_user["tenant_id"]
    )
    capa_number = f"CAPA-{count + 1:04d}"

    row = await db.fetchrow(
        """INSERT INTO capas (tenant_id, incident_id, capa_number, title, description,
                              capa_type, priority, assigned_to, due_date, root_cause)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::uuid, $9, $10)
           RETURNING id, capa_number""",
        current_user["tenant_id"],
        capa.incident_id if capa.incident_id else None,
        capa_number, capa.title, capa.description,
        capa.capa_type, capa.priority,
        capa.assigned_to if capa.assigned_to else None,
        capa.due_date, capa.root_cause,
    )
    return dict(row)


@router.get("/")
async def list_capas(
    status: Optional[str] = None,
    db=Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if status:
        rows = await db.fetch(
            """SELECT c.id, c.capa_number, c.title, c.capa_type, c.status, c.priority,
                      c.due_date, c.created_at, i.incident_number,
                      u.full_name as assigned_to_name
               FROM capas c
               LEFT JOIN incidents i ON c.incident_id = i.id
               LEFT JOIN users u ON c.assigned_to = u.id
               WHERE c.tenant_id = $1::uuid AND c.status = $2
               ORDER BY c.created_at DESC""",
            current_user["tenant_id"], status,
        )
    else:
        rows = await db.fetch(
            """SELECT c.id, c.capa_number, c.title, c.capa_type, c.status, c.priority,
                      c.due_date, c.created_at, i.incident_number,
                      u.full_name as assigned_to_name
               FROM capas c
               LEFT JOIN incidents i ON c.incident_id = i.id
               LEFT JOIN users u ON c.assigned_to = u.id
               WHERE c.tenant_id = $1::uuid
               ORDER BY c.created_at DESC""",
            current_user["tenant_id"],
        )
    return [dict(r) for r in rows]


@router.get("/{capa_id}")
async def get_capa(capa_id: str, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    row = await db.fetchrow(
        """SELECT c.*, i.incident_number, u.full_name as assigned_to_name
           FROM capas c
           LEFT JOIN incidents i ON c.incident_id = i.id
           LEFT JOIN users u ON c.assigned_to = u.id
           WHERE c.id = $1::uuid AND c.tenant_id = $2::uuid""",
        capa_id, current_user["tenant_id"],
    )
    if not row:
        raise HTTPException(status_code=404, detail="CAPA not found")
    return dict(row)


@router.patch("/{capa_id}")
async def update_capa(
    capa_id: str,
    update: CapaUpdate,
    db=Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    existing = await db.fetchrow(
        "SELECT id FROM capas WHERE id = $1::uuid AND tenant_id = $2::uuid",
        capa_id, current_user["tenant_id"],
    )
    if not existing:
        raise HTTPException(status_code=404, detail="CAPA not found")

    updates = []
    values = []
    idx = 1
    for field, val in update.model_dump(exclude_none=True).items():
        updates.append(f"{field} = ${idx}")
        values.append(str(val) if field == "assigned_to" else val)
        idx += 1

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    if update.status == "closed":
        updates.append(f"closed_at = NOW()")

    values.append(capa_id)
    query = f"UPDATE capas SET {', '.join(updates)} WHERE id = ${idx}::uuid RETURNING id, status"
    row = await db.fetchrow(query, *values)
    return dict(row)
