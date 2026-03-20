import asyncpg
from app.core.config import settings

pool = None


async def get_pool():
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(settings.database_url, min_size=2, max_size=10)
    return pool


async def get_db():
    p = await get_pool()
    async with p.acquire() as conn:
        yield conn


async def init_db():
    p = await get_pool()
    async with p.acquire() as conn:
        await conn.execute(SCHEMA_SQL)


SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    uploaded_by UUID REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    document_type TEXT,
    framework_tier TEXT,
    framework_category TEXT,
    framework_series TEXT,
    coverage_status TEXT DEFAULT 'not_assessed',
    gaps JSONB DEFAULT '[]',
    risk_severity TEXT,
    ai_reasoning TEXT,
    raw_ai_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    incident_number TEXT NOT NULL,
    incident_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'low',
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    reported_by TEXT,
    reported_by_user UUID REFERENCES users(id),
    is_anonymous BOOLEAN DEFAULT false,
    photo_path TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS capas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id),
    capa_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    capa_type TEXT NOT NULL DEFAULT 'corrective',
    status TEXT NOT NULL DEFAULT 'open',
    priority TEXT NOT NULL DEFAULT 'medium',
    assigned_to UUID REFERENCES users(id),
    due_date DATE,
    closed_at TIMESTAMPTZ,
    root_cause TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    name TEXT NOT NULL,
    template TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code VARCHAR(20) NOT NULL,
    site_type VARCHAR(50),
    employee_count INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

-- Add site_id columns (nullable for backward compat)
DO $$ BEGIN
    ALTER TABLE incidents ADD COLUMN site_id UUID REFERENCES sites(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE capas ADD COLUMN site_id UUID REFERENCES sites(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE documents ADD COLUMN site_id UUID REFERENCES sites(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add phone_number to users (for SMS notifications)
DO $$ BEGIN
    ALTER TABLE users ADD COLUMN phone_number VARCHAR(20);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add branding columns to tenants
DO $$ BEGIN
    ALTER TABLE tenants ADD COLUMN brand_name VARCHAR(100);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE tenants ADD COLUMN logo_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE tenants ADD COLUMN brand_color_primary VARCHAR(7) DEFAULT '#1B2A4A';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE tenants ADD COLUMN brand_color_accent VARCHAR(7) DEFAULT '#2ECC71';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analyses_document ON document_analyses(document_id);
CREATE INDEX IF NOT EXISTS idx_analyses_tenant ON document_analyses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_capas_tenant ON capas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_capas_incident ON capas(incident_id);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_sites_tenant ON sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incidents_site ON incidents(site_id);
"""
