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
    "partner_name": None,
    "partner_logo_url": None,
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
                "partner_name": None,
                "partner_logo_url": None,
            }

    # Tenant users see their tenant's branding + partner info if assigned
    tenant_id = current_user.get("tenant_id")
    if tenant_id:
        row = await db.fetchrow(
            """SELECT t.name, t.brand_name, t.logo_url, t.brand_color_primary, t.brand_color_accent,
                      p.name as partner_name, p.logo_url as partner_logo_url
               FROM tenants t
               LEFT JOIN partners p ON t.partner_id = p.id
               WHERE t.id = $1::uuid""",
            tenant_id,
        )
        if row:
            return {
                "brand_name": row["brand_name"] or row["name"],
                "logo_url": row["logo_url"],
                "brand_color_primary": row["brand_color_primary"] or "#1B2A4A",
                "brand_color_accent": row["brand_color_accent"] or "#2ECC71",
                "view_type": "tenant",
                "tenant_name": row["name"],
                "partner_name": row["partner_name"],
                "partner_logo_url": row["partner_logo_url"],
            }

    return {"brand_name": "EHS-OS", "logo_url": None, "brand_color_primary": "#1B2A4A", "brand_color_accent": "#2ECC71", "view_type": "tenant", "partner_name": None, "partner_logo_url": None}
