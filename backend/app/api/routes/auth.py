from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.core.auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter()


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    tenant_slug: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
async def register(req: RegisterRequest, db=Depends(get_db)):
    tenant = await db.fetchrow("SELECT id FROM tenants WHERE slug = $1", req.tenant_slug)
    if not tenant:
        raise HTTPException(status_code=400, detail="Invalid tenant")

    existing = await db.fetchrow("SELECT id FROM users WHERE email = $1", req.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = await db.fetchrow(
        """INSERT INTO users (tenant_id, email, password_hash, full_name)
           VALUES ($1, $2, $3, $4) RETURNING id, role""",
        tenant["id"], req.email, hash_password(req.password), req.full_name,
    )
    token = create_token(str(user["id"]), str(tenant["id"]), user["role"])
    return {"token": token, "user_id": str(user["id"])}


@router.post("/login")
async def login(req: LoginRequest, db=Depends(get_db)):
    user = await db.fetchrow(
        "SELECT id, tenant_id, password_hash, role, is_platform_admin FROM users WHERE email = $1", req.email
    )
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    is_pa = bool(user["is_platform_admin"])
    tid = str(user["tenant_id"]) if user["tenant_id"] else ""
    role = "platform_admin" if is_pa else user["role"]
    token = create_token(str(user["id"]), tid, role, is_platform_admin=is_pa)
    return {"token": token, "user_id": str(user["id"]), "is_platform_admin": is_pa}


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    user = await db.fetchrow(
        "SELECT id, email, full_name, role, tenant_id, is_platform_admin FROM users WHERE id = $1::uuid",
        current_user["sub"],
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    result = dict(user)
    result["is_platform_admin"] = bool(result.get("is_platform_admin"))
    return result
