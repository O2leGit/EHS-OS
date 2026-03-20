import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.auth import get_current_user
from app.services.ai import get_chat_response

router = APIRouter()


class ChatMessage(BaseModel):
    message: str
    context: Optional[dict] = None


@router.post("/message")
async def send_message(msg: ChatMessage, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    tid = current_user["tenant_id"]
    uid = current_user["sub"]

    # Save user message
    await db.execute(
        """INSERT INTO chat_messages (tenant_id, user_id, role, content, context)
           VALUES ($1::uuid, $2::uuid, 'user', $3, $4)""",
        tid, uid, msg.message, json.dumps(msg.context) if msg.context else None,
    )

    # Get recent chat history
    history = await db.fetch(
        """SELECT role, content FROM chat_messages
           WHERE tenant_id = $1::uuid AND user_id = $2::uuid
           ORDER BY created_at DESC LIMIT 20""",
        tid, uid,
    )
    history = [dict(h) for h in reversed(history)]

    # Get tenant context
    gaps = await db.fetch(
        """SELECT framework_tier, framework_category, coverage_status, gaps
           FROM document_analyses WHERE tenant_id = $1::uuid""",
        tid,
    )
    open_incidents = await db.fetchval(
        "SELECT COUNT(*) FROM incidents WHERE tenant_id = $1::uuid AND status = 'open'", tid
    )
    open_capas = await db.fetchval(
        "SELECT COUNT(*) FROM capas WHERE tenant_id = $1::uuid AND status IN ('open', 'in_progress')", tid
    )

    # Fetch recent incidents for AI context
    recent_incidents = await db.fetch(
        """SELECT title, severity, status, created_at::text AS date
           FROM incidents WHERE tenant_id = $1::uuid
           ORDER BY created_at DESC LIMIT 10""",
        tid,
    )

    # Fetch open CAPAs detail for AI context
    open_capa_list = await db.fetch(
        """SELECT title, priority, status, due_date::text AS due_date
           FROM capas WHERE tenant_id = $1::uuid AND status IN ('open', 'in_progress')
           ORDER BY due_date ASC NULLS LAST LIMIT 10""",
        tid,
    )

    tenant_context = {
        "framework_gaps": [dict(g) for g in gaps[:20]],
        "open_incidents": open_incidents,
        "open_capas": open_capas,
        "recent_incidents": [dict(i) for i in recent_incidents],
        "open_capa_list": [dict(c) for c in open_capa_list],
        "page_context": msg.context,
    }

    response = await get_chat_response(history, tenant_context)

    # Save assistant response
    await db.execute(
        """INSERT INTO chat_messages (tenant_id, user_id, role, content)
           VALUES ($1::uuid, $2::uuid, 'assistant', $3)""",
        tid, uid, response,
    )

    return {"response": response}


@router.get("/history")
async def chat_history(db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    rows = await db.fetch(
        """SELECT role, content, created_at FROM chat_messages
           WHERE tenant_id = $1::uuid AND user_id = $2::uuid
           ORDER BY created_at ASC LIMIT 100""",
        current_user["tenant_id"], current_user["sub"],
    )
    return [dict(r) for r in rows]


@router.get("/suggested-prompts")
async def suggested_prompts(page: Optional[str] = None):
    base = [
        "What are my biggest EHS gaps right now?",
        "Help me write an SOP for chemical waste disposal",
        "Explain OSHA requirements for lab safety",
    ]
    page_prompts = {
        "documents": ["Analyze my latest upload", "What framework areas am I missing?"],
        "incidents": ["What patterns do you see in recent incidents?", "Help me classify this incident"],
        "capas": ["Which CAPAs are overdue?", "Help me write a root cause analysis"],
        "dashboard": ["Give me an executive summary", "What should I prioritize this week?"],
    }
    prompts = base + page_prompts.get(page, [])
    return {"prompts": prompts}
