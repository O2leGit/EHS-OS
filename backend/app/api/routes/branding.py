from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.auth import get_current_user

router = APIRouter()

PLATFORM_BRANDING = {
    "brand_name": "ikigaiOS | ScaleOS",
    "logo_url": None,
    "brand_color_primary": "#1B2A4A",
    "brand_color_accent": "#2ECC71",
    "is_platform": True,
}


@router.get("/branding")
async def get_branding(db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    # Platform admins see ikigaiOS/ScaleOS branding
    if current_user.get("is_platform_admin"):
        return PLATFORM_BRANDING

    # Tenant users see their tenant's branding
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        return PLATFORM_BRANDING

    row = await db.fetchrow(
        "SELECT brand_name, logo_url, brand_color_primary, brand_color_accent FROM tenants WHERE id = $1::uuid",
        tenant_id,
    )
    if not row:
        return {"brand_name": "EHS-OS", "logo_url": None, "brand_color_primary": "#1B2A4A", "brand_color_accent": "#2ECC71", "is_platform": False}
    result = dict(row)
    result["is_platform"] = False
    return result
