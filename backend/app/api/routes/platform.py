"""Platform admin endpoints for multi-tenant management.

These endpoints are only accessible by users with is_platform_admin = true.
They provide tenant CRUD, login-as, and platform-wide metrics.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.auth import get_current_user, create_token, hash_password

router = APIRouter()


async def require_platform_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not current_user.get("is_platform_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform admin access required",
        )
    return current_user


class TenantCreateRequest(BaseModel):
    name: str
    slug: str
    industry: str = "general_manufacturing"
    brand_color_primary: str = "#1B2A4A"
    brand_color_accent: str = "#2ECC71"
    logo_url: Optional[str] = None


@router.get("/tenants")
async def list_tenants(db=Depends(get_db), admin=Depends(require_platform_admin)):
    """List all tenants with summary metrics."""
    tenants = await db.fetch(
        """SELECT id, name, slug, brand_name, logo_url, brand_color_primary, brand_color_accent, created_at
           FROM tenants ORDER BY created_at DESC"""
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
            "logo_url": t["logo_url"],
            "brand_color_primary": t["brand_color_primary"],
            "brand_color_accent": t["brand_color_accent"],
            "created_at": t["created_at"].isoformat() if t["created_at"] else None,
            "users": user_count,
            "sites": site_count,
            "incidents": incident_count,
            "status": "Active",
        })
    return result


@router.post("/tenants")
async def create_tenant(body: TenantCreateRequest, db=Depends(get_db), admin=Depends(require_platform_admin)):
    """Create a new tenant with default admin/manager/user accounts."""
    existing = await db.fetchrow("SELECT id FROM tenants WHERE slug = $1", body.slug)
    if existing:
        raise HTTPException(status_code=400, detail=f"Tenant with slug '{body.slug}' already exists")

    tenant_id = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO tenants (id, name, slug, brand_name, logo_url, brand_color_primary, brand_color_accent)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)""",
        tenant_id, body.name, body.slug, body.name, body.logo_url,
        body.brand_color_primary, body.brand_color_accent,
    )

    # Create default users for the tenant
    email_base = body.slug.replace("-", "")
    default_pw = hash_password("demo123")
    users_created = []
    for role, prefix, name in [
        ("admin", "admin", f"{body.name} Admin"),
        ("manager", "manager", f"{body.name} Manager"),
        ("user", "user", f"{body.name} User"),
    ]:
        email = f"{prefix}@{email_base}.com"
        uid = str(uuid.uuid4())
        await db.execute(
            """INSERT INTO users (id, email, password_hash, full_name, role, tenant_id)
               VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid)""",
            uid, email, default_pw, name, role, tenant_id,
        )
        users_created.append({"email": email, "password": "demo123", "role": role})

    return {
        "id": tenant_id,
        "name": body.name,
        "slug": body.slug,
        "users": users_created,
    }


@router.get("/tenants/{tenant_id}")
async def get_tenant(tenant_id: str, db=Depends(get_db), admin=Depends(require_platform_admin)):
    """Get tenant detail."""
    tenant = await db.fetchrow(
        "SELECT id, name, slug, brand_name, logo_url, brand_color_primary, brand_color_accent, created_at FROM tenants WHERE id = $1::uuid",
        tenant_id,
    )
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    users = await db.fetch(
        "SELECT id, email, full_name, role, created_at FROM users WHERE tenant_id = $1::uuid ORDER BY role, email",
        tenant_id,
    )
    sites = await db.fetch(
        "SELECT id, name, code, site_type, employee_count FROM sites WHERE tenant_id = $1::uuid AND is_active = true ORDER BY name",
        tenant_id,
    )

    return {
        "id": str(tenant["id"]),
        "name": tenant["name"],
        "slug": tenant["slug"],
        "brand_name": tenant["brand_name"],
        "logo_url": tenant["logo_url"],
        "brand_color_primary": tenant["brand_color_primary"],
        "brand_color_accent": tenant["brand_color_accent"],
        "created_at": tenant["created_at"].isoformat() if tenant["created_at"] else None,
        "users": [{"id": str(u["id"]), "email": u["email"], "full_name": u["full_name"], "role": u["role"]} for u in users],
        "sites": [{"id": str(s["id"]), "name": s["name"], "code": s["code"], "site_type": s["site_type"], "employee_count": s["employee_count"]} for s in sites],
    }


@router.delete("/tenants/{tenant_id}")
async def delete_tenant(tenant_id: str, db=Depends(get_db), admin=Depends(require_platform_admin)):
    """Delete a tenant and all its data."""
    tenant = await db.fetchrow("SELECT id, slug FROM tenants WHERE id = $1::uuid", tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant["slug"] == "bio-techne":
        raise HTTPException(status_code=400, detail="Cannot delete the primary demo tenant")

    tid = tenant["id"]
    # Clean up FK references
    for tbl in ["document_analyses", "chat_messages", "reports", "prompt_templates", "capas", "incidents", "documents", "sites", "users"]:
        try:
            await db.execute(f"DELETE FROM {tbl} WHERE tenant_id = $1", tid)
        except Exception:
            pass
    await db.execute("DELETE FROM tenants WHERE id = $1", tid)
    return {"deleted": True, "slug": tenant["slug"]}


@router.post("/tenants/{tenant_id}/login-as")
async def login_as_tenant(tenant_id: str, db=Depends(get_db), admin=Depends(require_platform_admin)):
    """Generate a JWT to view the app as a tenant admin. Used for demos."""
    tenant = await db.fetchrow("SELECT id, name, slug FROM tenants WHERE id = $1::uuid", tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Find the tenant's admin user
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
        is_platform_admin=False,
    )
    return {
        "token": token,
        "tenant_name": tenant["name"],
        "tenant_slug": tenant["slug"],
    }


@router.get("/metrics")
async def platform_metrics(db=Depends(get_db), admin=Depends(require_platform_admin)):
    """Platform-wide metrics."""
    total_tenants = await db.fetchval("SELECT COUNT(*) FROM tenants")
    total_users = await db.fetchval("SELECT COUNT(*) FROM users WHERE is_platform_admin IS NOT TRUE")
    total_incidents = await db.fetchval("SELECT COUNT(*) FROM incidents")
    total_sites = await db.fetchval("SELECT COUNT(*) FROM sites WHERE is_active = true")

    return {
        "total_tenants": total_tenants,
        "total_users": total_users,
        "total_incidents": total_incidents,
        "total_sites": total_sites,
        "platform_health": "green",
    }
