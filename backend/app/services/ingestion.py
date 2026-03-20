import os
from app.core.database import get_pool
from app.services.ai import analyze_document_chunk
import json


def extract_text_pdf(file_path: str) -> str:
    import fitz  # PyMuPDF
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text


def extract_text_docx(file_path: str) -> str:
    from docx import Document
    doc = Document(file_path)
    return "\n".join([p.text for p in doc.paragraphs if p.text.strip()])


def extract_text_image(file_path: str) -> str:
    try:
        import pytesseract
        from PIL import Image
        return pytesseract.image_to_string(Image.open(file_path))
    except Exception:
        return ""


def extract_text(file_path: str, file_type: str) -> str:
    if file_type == ".pdf":
        return extract_text_pdf(file_path)
    elif file_type in (".docx", ".doc"):
        return extract_text_docx(file_path)
    elif file_type in (".png", ".jpg", ".jpeg", ".tiff"):
        return extract_text_image(file_path)
    return ""


def chunk_text(text: str, chunk_size: int = 2500, overlap: int = 200) -> list[str]:
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap
    return chunks


async def process_document(doc_id: str, tenant_id: str):
    pool = await get_pool()
    async with pool.acquire() as db:
        doc = await db.fetchrow("SELECT * FROM documents WHERE id = $1::uuid", doc_id)
        if not doc:
            return

        try:
            text = extract_text(doc["file_path"], doc["file_type"])
            if not text.strip():
                await db.execute(
                    "UPDATE documents SET status = 'error' WHERE id = $1::uuid", doc_id
                )
                return

            chunks = chunk_text(text)

            for i, chunk in enumerate(chunks):
                analysis = await analyze_document_chunk(chunk)

                for cat in analysis.get("categories", []):
                    await db.execute(
                        """INSERT INTO document_analyses
                           (document_id, tenant_id, chunk_index, chunk_text, document_type,
                            framework_tier, framework_category, framework_series,
                            coverage_status, gaps, risk_severity, ai_reasoning, raw_ai_response)
                           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)""",
                        doc_id, tenant_id, i, chunk[:500],
                        analysis.get("document_type", "other"),
                        cat.get("tier"), cat.get("category"), cat.get("series"),
                        cat.get("coverage_status", "not_assessed"),
                        json.dumps(cat.get("gaps", [])),
                        cat.get("risk_severity"),
                        cat.get("reasoning"),
                        json.dumps(analysis),
                    )

            await db.execute(
                "UPDATE documents SET status = 'analyzed' WHERE id = $1::uuid", doc_id
            )
        except Exception as e:
            await db.execute(
                "UPDATE documents SET status = 'error' WHERE id = $1::uuid", doc_id
            )
            raise
