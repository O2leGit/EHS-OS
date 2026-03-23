"""Platform admin endpoints for multi-tenant management.

These endpoints are only accessible by users with is_platform_admin = true.
They provide tenant CRUD, partner CRUD, login-as, and platform-wide metrics.
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


# ── Tenant endpoints ──────────────────────────────────────────────────────────

class TenantCreateRequest(BaseModel):
    name: str
    slug: str
    industry: str = "general_manufacturing"
    brand_color_primary: str = "#1B2A4A"
    brand_color_accent: str = "#2ECC71"
    logo_url: Optional[str] = None
    partner_id: Optional[str] = None


@router.get("/tenants")
async def list_tenants(db=Depends(get_db), admin=Depends(require_platform_admin)):
    """List all tenants with summary metrics and partner info."""
    tenants = await db.fetch(
        """SELECT t.id, t.name, t.slug, t.brand_name, t.logo_url,
                  t.brand_color_primary, t.brand_color_accent, t.created_at, t.partner_id,
                  p.name as partner_name
           FROM tenants t
           LEFT JOIN partners p ON t.partner_id = p.id
           ORDER BY t.name"""
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
            "partner_id": str(t["partner_id"]) if t["partner_id"] else None,
            "partner_name": t["partner_name"] or "Direct",
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
        """INSERT INTO tenants (id, name, slug, brand_name, logo_url, brand_color_primary, brand_color_accent, partner_id)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid)""",
        tenant_id, body.name, body.slug, body.name, body.logo_url,
        body.brand_color_primary, body.brand_color_accent,
        body.partner_id if body.partner_id else None,
    )

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
        """SELECT t.id, t.name, t.slug, t.brand_name, t.logo_url, t.brand_color_primary,
                  t.brand_color_accent, t.created_at, t.partner_id, p.name as partner_name
           FROM tenants t LEFT JOIN partners p ON t.partner_id = p.id
           WHERE t.id = $1::uuid""",
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
        "partner_id": str(tenant["partner_id"]) if tenant["partner_id"] else None,
        "partner_name": tenant["partner_name"] or "Direct",
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
    for tbl in ["document_analyses", "chat_messages", "reports", "prompt_templates", "capas", "incidents", "documents", "sites", "users"]:
        try:
            await db.execute(f"DELETE FROM {tbl} WHERE tenant_id = $1", tid)
        except Exception:
            pass
    await db.execute("DELETE FROM tenants WHERE id = $1", tid)
    return {"deleted": True, "slug": tenant["slug"]}


@router.post("/tenants/{tenant_id}/login-as")
async def login_as_tenant(tenant_id: str, db=Depends(get_db), admin=Depends(require_platform_admin)):
    """Generate a JWT to view the app as a tenant admin."""
    tenant = await db.fetchrow("SELECT id, name, slug FROM tenants WHERE id = $1::uuid", tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

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
    return {"token": token, "tenant_name": tenant["name"], "tenant_slug": tenant["slug"]}


# ── Partner endpoints ─────────────────────────────────────────────────────────

class PartnerCreateRequest(BaseModel):
    name: str
    brand_name: str
    logo_url: Optional[str] = None
    primary_color: str = "#1B2A4A"
    accent_color: str = "#2ECC71"


@router.get("/partners")
async def list_partners(db=Depends(get_db), admin=Depends(require_platform_admin)):
    """List all partners with tenant counts."""
    partners = await db.fetch("SELECT id, name, brand_name, logo_url, created_at FROM partners ORDER BY name")
    result = []
    for p in partners:
        tenant_count = await db.fetchval("SELECT COUNT(*) FROM tenants WHERE partner_id = $1", p["id"])
        user_count = await db.fetchval("SELECT COUNT(*) FROM users WHERE partner_id = $1", p["id"])
        result.append({
            "id": str(p["id"]),
            "name": p["name"],
            "brand_name": p["brand_name"],
            "logo_url": p["logo_url"],
            "created_at": p["created_at"].isoformat() if p["created_at"] else None,
            "tenant_count": tenant_count,
            "user_count": user_count,
        })
    return result


@router.post("/partners")
async def create_partner(body: PartnerCreateRequest, db=Depends(get_db), admin=Depends(require_platform_admin)):
    """Create a new partner organization."""
    pid = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO partners (id, name, brand_name, logo_url, primary_color, accent_color)
           VALUES ($1::uuid, $2, $3, $4, $5, $6)""",
        pid, body.name, body.brand_name, body.logo_url, body.primary_color, body.accent_color,
    )
    return {"id": pid, "name": body.name, "brand_name": body.brand_name}


@router.patch("/partners/{partner_id}")
async def update_partner(partner_id: str, body: PartnerCreateRequest, db=Depends(get_db), admin=Depends(require_platform_admin)):
    """Update a partner."""
    existing = await db.fetchrow("SELECT id FROM partners WHERE id = $1::uuid", partner_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Partner not found")
    await db.execute(
        """UPDATE partners SET name=$2, brand_name=$3, logo_url=$4, primary_color=$5, accent_color=$6
           WHERE id = $1::uuid""",
        partner_id, body.name, body.brand_name, body.logo_url, body.primary_color, body.accent_color,
    )
    return {"id": partner_id, "name": body.name}


# ── User Management ──────────────────────────────────────────────────────────

class ResetPasswordRequest(BaseModel):
    new_password: str


class ChangeMyPasswordRequest(BaseModel):
    new_password: str


@router.get("/users")
async def list_all_users(db=Depends(get_db), admin=Depends(require_platform_admin)):
    """List all users across all tenants."""
    rows = await db.fetch(
        """SELECT u.id, u.email, u.full_name, u.role, u.is_platform_admin, u.created_at,
                  t.name as tenant_name, t.slug as tenant_slug,
                  p.name as partner_name
           FROM users u
           LEFT JOIN tenants t ON u.tenant_id = t.id
           LEFT JOIN partners p ON u.partner_id = p.id
           ORDER BY u.role, u.email"""
    )
    return [{
        "id": str(r["id"]),
        "email": r["email"],
        "full_name": r["full_name"],
        "role": r["role"],
        "is_platform_admin": bool(r["is_platform_admin"]),
        "tenant_name": r["tenant_name"],
        "tenant_slug": r["tenant_slug"],
        "partner_name": r["partner_name"],
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    } for r in rows]


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, body: ResetPasswordRequest, db=Depends(get_db), admin=Depends(require_platform_admin)):
    """Reset any user's password."""
    user = await db.fetchrow("SELECT id, email FROM users WHERE id = $1::uuid", user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.execute(
        "UPDATE users SET password_hash = $1 WHERE id = $2::uuid",
        hash_password(body.new_password), user_id,
    )
    return {"email": user["email"], "password_reset": True}


@router.post("/change-password")
async def change_my_password(body: ChangeMyPasswordRequest, db=Depends(get_db), admin=Depends(require_platform_admin)):
    """Change the current platform admin's password."""
    await db.execute(
        "UPDATE users SET password_hash = $1 WHERE id = $2::uuid",
        hash_password(body.new_password), admin["sub"],
    )
    return {"password_changed": True}


# ── Metrics ───────────────────────────────────────────────────────────────────

@router.get("/metrics")
async def platform_metrics(db=Depends(get_db), admin=Depends(require_platform_admin)):
    """Platform-wide metrics."""
    total_tenants = await db.fetchval("SELECT COUNT(*) FROM tenants")
    total_partners = await db.fetchval("SELECT COUNT(*) FROM partners")
    total_users = await db.fetchval("SELECT COUNT(*) FROM users WHERE is_platform_admin IS NOT TRUE AND role != 'partner'")
    total_incidents = await db.fetchval("SELECT COUNT(*) FROM incidents")
    total_sites = await db.fetchval("SELECT COUNT(*) FROM sites WHERE is_active = true")

    return {
        "total_tenants": total_tenants,
        "total_partners": total_partners,
        "total_users": total_users,
        "total_incidents": total_incidents,
        "total_sites": total_sites,
        "platform_health": "green",
    }
