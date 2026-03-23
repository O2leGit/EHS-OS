"""Partner endpoints - read-only access to assigned tenants.

Partners can view their assigned tenants and login-as them for demos.
They cannot create, edit, or delete tenants.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.database import get_db
from app.core.auth import get_current_user, create_token

router = APIRouter()


async def require_partner(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "partner" or not current_user.get("partner_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Partner access required",
        )
    return current_user


@router.get("/tenants")
async def list_partner_tenants(db=Depends(get_db), partner=Depends(require_partner)):
    """List tenants assigned to this partner."""
    partner_id = partner["partner_id"]
    tenants = await db.fetch(
        """SELECT id, name, slug, brand_name, logo_url, brand_color_primary, brand_color_accent, created_at
           FROM tenants WHERE partner_id = $1::uuid ORDER BY name""",
        partner_id,
    )
    result = []
    for t in tenants:
        tid = t["id"]
        user_count = await db.fetchval("SELECT COUNT(*) FROM users WHERE tenant_id = $1", tid)
        site_count = await db.fetchval("SELECT COUNT(*) FROM sites WHERE tenant_id = $1 AND is_active = true", tid)
        incident_count = await db.fetchval("SELECT COUNT(*) FROM incidents WHERE tenant_id = $1", tid)
        result.append({
            "id": str(tid),
            "name": t["name"],
            "slug": t["slug"],
            "brand_name": t["brand_name"],
            "created_at": t["created_at"].isoformat() if t["created_at"] else None,
            "users": user_count,
            "sites": site_count,
            "incidents": incident_count,
            "status": "Active",
        })
    return result


@router.post("/tenants/{tenant_id}/login-as")
async def partner_login_as(tenant_id: str, db=Depends(get_db), partner=Depends(require_partner)):
    """Login-as a tenant. Only works if tenant is assigned to this partner."""
    partner_id = partner["partner_id"]
    tenant = await db.fetchrow(
        "SELECT id, name, slug, partner_id FROM tenants WHERE id = $1::uuid",
        tenant_id,
    )
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if str(tenant["partner_id"]) != partner_id:
        raise HTTPException(status_code=403, detail="Tenant not assigned to your partner account")

    tenant_admin = await db.fetchrow(
        "SELECT id, role FROM users WHERE tenant_id = $1::uuid AND role = 'admin' ORDER BY created_at LIMIT 1",
        tenant["id"],
    )
    if not tenant_admin:
        raise HTTPException(status_code=404, detail="No admin user found for this tenant")

    token = create_token(
        user_id=str(tenant_admin["id"]),
        tenant_id=str(tenant["id"]),
        role=tenant_admin["role"],
    )
    return {
        "token": token,
        "tenant_name": tenant["name"],
        "tenant_slug": tenant["slug"],
    }


@router.get("/profile")
async def partner_profile(db=Depends(get_db), partner=Depends(require_partner)):
    """Get partner branding config."""
    row = await db.fetchrow(
        "SELECT id, name, brand_name, logo_url, primary_color, accent_color FROM partners WHERE id = $1::uuid",
        partner["partner_id"],
    )
    if not row:
        return {"brand_name": "Partner", "logo_url": None}
    return dict(row)
