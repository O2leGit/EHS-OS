from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.auth import get_current_user

router = APIRouter()


@router.get("/")
async def list_sites(db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id")
    # Platform admin and partner users have no tenant_id - return empty list
    if not tenant_id:
        return []
    rows = await db.fetch(
        """SELECT id, name, code, site_type, employee_count, is_active, created_at
           FROM sites WHERE tenant_id = $1::uuid AND is_active = true
           ORDER BY name""",
        tenant_id,
    )
    return [dict(r) for r in rows]
