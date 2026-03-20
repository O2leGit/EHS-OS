import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.services.ingestion import process_document

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
