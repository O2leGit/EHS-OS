from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.auth import get_current_user

router = APIRouter()


@router.get("/branding")
async def get_branding(db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    row = await db.fetchrow(
        "SELECT brand_name, logo_url, brand_color_primary, brand_color_accent FROM tenants WHERE id = $1::uuid",
        current_user["tenant_id"],
    )
    if not row:
        return {"brand_name": "EHS-OS", "logo_url": None, "brand_color_primary": "#1B2A4A", "brand_color_accent": "#2ECC71"}
    return dict(row)
