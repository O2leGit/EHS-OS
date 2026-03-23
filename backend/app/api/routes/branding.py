from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.auth import get_current_user

router = APIRouter()

PLATFORM_BRANDING = {
    "brand_name": "ikigaiOS | ScaleOS",
    "logo_url": None,
    "brand_color_primary": "#1B2A4A",
    "brand_color_accent": "#2ECC71",
    "view_type": "platform",
}


@router.get("/branding")
async def get_branding(db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    # Platform admins see ikigaiOS/ScaleOS branding
    if current_user.get("is_platform_admin"):
        return PLATFORM_BRANDING

    # Partner users see their partner's branding
    partner_id = current_user.get("partner_id")
    if partner_id and current_user.get("role") == "partner":
        row = await db.fetchrow(
            "SELECT name, brand_name, logo_url, primary_color, accent_color FROM partners WHERE id = $1::uuid",
            partner_id,
        )
        if row:
            return {
                "brand_name": row["brand_name"],
                "logo_url": row["logo_url"],
                "brand_color_primary": row["primary_color"],
                "brand_color_accent": row["accent_color"],
                "view_type": "partner",
            }

    # Tenant users see their tenant's branding
    tenant_id = current_user.get("tenant_id")
    if tenant_id:
        row = await db.fetchrow(
            "SELECT brand_name, logo_url, brand_color_primary, brand_color_accent FROM tenants WHERE id = $1::uuid",
            tenant_id,
        )
        if row:
            result = dict(row)
            result["view_type"] = "tenant"
            return result

    return {"brand_name": "EHS-OS", "logo_url": None, "brand_color_primary": "#1B2A4A", "brand_color_accent": "#2ECC71", "view_type": "tenant"}
