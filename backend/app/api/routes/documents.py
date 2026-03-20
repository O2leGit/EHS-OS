import os
import json
import uuid
from fastapi import APIRouter, Body, Depends, HTTPException, UploadFile, File, BackgroundTasks
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.services.ingestion import process_document
from app.services.ai import get_client

router = APIRouter()


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db=Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    allowed = {".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg", ".tiff"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"File type {ext} not supported")

    file_id = str(uuid.uuid4())
    tenant_dir = os.path.join(settings.upload_dir, current_user["tenant_id"])
    os.makedirs(tenant_dir, exist_ok=True)
    file_path = os.path.join(tenant_dir, f"{file_id}{ext}")

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    doc = await db.fetchrow(
        """INSERT INTO documents (tenant_id, filename, file_path, file_type, file_size, uploaded_by, status)
           VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid, 'processing')
           RETURNING id, status""",
        current_user["tenant_id"], file.filename, file_path, ext, len(content), current_user["sub"],
    )

    background_tasks.add_task(process_document, str(doc["id"]), current_user["tenant_id"])
    return {"id": str(doc["id"]), "status": "processing", "filename": file.filename}


@router.get("/")
async def list_documents(db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    rows = await db.fetch(
        """SELECT id, filename, file_type, file_size, status, created_at
           FROM documents WHERE tenant_id = $1::uuid ORDER BY created_at DESC""",
        current_user["tenant_id"],
    )
    return [dict(r) for r in rows]


@router.get("/{doc_id}")
async def get_document(doc_id: str, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    doc = await db.fetchrow(
        "SELECT * FROM documents WHERE id = $1::uuid AND tenant_id = $2::uuid",
        doc_id, current_user["tenant_id"],
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    analyses = await db.fetch(
        """SELECT chunk_index, document_type, framework_tier, framework_category,
                  framework_series, coverage_status, gaps, risk_severity, ai_reasoning
           FROM document_analyses WHERE document_id = $1::uuid ORDER BY chunk_index""",
        doc_id,
    )
    return {"document": dict(doc), "analyses": [dict(a) for a in analyses]}


@router.post("/generate-sop")
async def generate_sop(
    request: dict = Body(...),
    db=Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    topic = request.get("topic")
    if not topic:
        raise HTTPException(status_code=400, detail="Topic is required")

    facility = request.get("facility", "Not specified")
    additional_context = request.get("additional_context", "None")

    # Query tenant's existing documents and framework coverage for context
    existing_docs = await db.fetch(
        """SELECT filename, file_type, status FROM documents
           WHERE tenant_id = $1::uuid ORDER BY created_at DESC LIMIT 20""",
        current_user["tenant_id"],
    )
    coverage = await db.fetch(
        """SELECT DISTINCT framework_category, framework_tier, coverage_status
           FROM document_analyses da
           JOIN documents d ON da.document_id = d.id
           WHERE d.tenant_id = $1::uuid""",
        current_user["tenant_id"],
    )

    existing_context = ""
    if existing_docs:
        doc_list = ", ".join(r["filename"] for r in existing_docs)
        existing_context += f"\nExisting documents in this facility: {doc_list}"
    if coverage:
        cov_list = "; ".join(
            f"{r['framework_category']} ({r['coverage_status']})" for r in coverage
        )
        existing_context += f"\nCurrent framework coverage: {cov_list}"

    prompt = f"""Generate a complete Standard Operating Procedure (SOP) for a life sciences facility.

Topic: {topic}
Facility: {facility}
Additional context: {additional_context}
{existing_context}

Use this structure:
1. PURPOSE
2. SCOPE
3. RESPONSIBILITIES
4. DEFINITIONS
5. PROCEDURE (numbered steps)
6. SAFETY PRECAUTIONS (PPE, engineering controls, emergency procedures)
7. REGULATORY REFERENCES (OSHA, EPA citations)
8. RELATED DOCUMENTS
9. REVISION HISTORY
10. APPROVAL SIGNATURES (placeholder)

Requirements:
- Include specific regulatory citations (OSHA CFR, EPA where applicable)
- Include specific PPE requirements
- Write procedures as clear, numbered steps
- Flag steps requiring competency verification

Return JSON only, no markdown fences:
{{
  "title": "SOP title",
  "document_number": "SOP-YYYY-NNN",
  "revision": "Draft 1.0",
  "sections": [{{"heading": "section name", "content": "section content"}}],
  "regulatory_references": [{{"citation": "CFR number", "description": "what it covers"}}],
  "ppe_required": ["list of PPE"],
  "training_required": ["list of training"]
}}"""

    try:
        client = get_client()
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
        )

        content = response.content[0].text

        # Parse JSON from response
        try:
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            sop_data = json.loads(content.strip())
        except (json.JSONDecodeError, IndexError):
            raise HTTPException(
                status_code=500,
                detail="Failed to parse SOP response from AI",
            )

        # Optionally save as draft document
        save_draft = request.get("save_draft", False)
        doc_id = None
        if save_draft:
            doc = await db.fetchrow(
                """INSERT INTO documents (tenant_id, filename, file_path, file_type, file_size, uploaded_by, status)
                   VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid, 'analyzed')
                   RETURNING id""",
                current_user["tenant_id"],
                f"{sop_data.get('title', topic)}.json",
                "",
                ".json",
                len(content),
                current_user["sub"],
            )
            doc_id = str(doc["id"])

        return {
            "sop": sop_data,
            "document_id": doc_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SOP generation failed: {str(e)}")
