import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.core.database import get_db
from app.core.auth import get_current_user, hash_password

router = APIRouter()


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


class TenantCreate(BaseModel):
    name: str
    slug: str


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "viewer"
    tenant_id: str


@router.post("/tenants")
async def create_tenant(body: TenantCreate, db=Depends(get_db), admin: dict = Depends(require_admin)):
    tenant_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO tenants (id, name, slug) VALUES ($1::uuid, $2, $3)",
        tenant_id, body.name, body.slug,
    )
    return {"id": tenant_id, "name": body.name, "slug": body.slug}


@router.get("/tenants")
async def list_tenants(db=Depends(get_db), admin: dict = Depends(require_admin)):
    rows = await db.fetch("SELECT id, name, slug, created_at FROM tenants ORDER BY created_at DESC")
    return [dict(r) for r in rows]


@router.post("/users")
async def create_user(body: UserCreate, db=Depends(get_db), admin: dict = Depends(require_admin)):
    # Check if email already exists
    existing = await db.fetchval("SELECT id FROM users WHERE email = $1", body.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    hashed = hash_password(body.password)
    await db.execute(
        """INSERT INTO users (id, email, password_hash, full_name, role, tenant_id)
           VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid)""",
        user_id, body.email, hashed, body.full_name, body.role, body.tenant_id,
    )
    return {"id": user_id, "email": body.email, "full_name": body.full_name, "role": body.role}


@router.get("/users")
async def list_users(db=Depends(get_db), admin: dict = Depends(require_admin)):
    rows = await db.fetch(
        """SELECT id, email, full_name, role, created_at
           FROM users WHERE tenant_id = $1::uuid ORDER BY created_at DESC""",
        admin["tenant_id"],
    )
    return [dict(r) for r in rows]


@router.get("/qr-codes/{tenant_slug}")
async def get_qr_code(tenant_slug: str, admin: dict = Depends(require_admin)):
    base_url = "https://ehs-os.netlify.app"
    report_url = f"{base_url}/?report=true&tenant={tenant_slug}"
    return {
        "url": report_url,
        "tenant_slug": tenant_slug,
        "qr_data": report_url,
    }
