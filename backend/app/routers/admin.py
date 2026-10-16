from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from io import BytesIO

from ..core.database import SupabaseDB
from ..models.schemas import Role, UserOut
from ..routers.auth import current_user_dependency
from ..core.rbac import require_roles
from ..services.store import store
from ..services.jemmi.knowledge_service import KnowledgeService

router = APIRouter(prefix='/admin', tags=['admin'])


AdminUser = Depends(require_roles(Role.admin))


@router.get('/metrics')
def metrics(user: UserOut = AdminUser):
    summary = store.summary()
    db = SupabaseDB.initialize()
    conn = db.get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT COUNT(*) FROM users')
        row = cursor.fetchone()
        total_users = int(row[0]) if row else 0
        cursor.execute('SELECT COUNT(*) FROM reports WHERE status = %s', ('generated',))
        row = cursor.fetchone()
        total_reports = int(row[0]) if row else 0
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM refresh_tokens
            WHERE revoked = FALSE AND expires_at > NOW()
            """
        )
        row = cursor.fetchone()
        active_sessions = int(row[0]) if row else 0
    finally:
        cursor.close()
        db.return_connection(conn)

    return {
        'totalUsers': total_users,
        'totalReports': total_reports,
        'modelPerformance': round(summary['average_confidence'], 2),
        'activeSessions': active_sessions,
    }


@router.get('/dataset')
def dataset(user: UserOut = AdminUser):
    summary = store.summary()
    return {
        'ageGroups': f"{summary['total_patients']} unique users with scans",
        'scanSources': 'Supabase MRI uploads',
        'annotationQuality': f"{summary['reports_generated']} generated reports",
        'trainingSplit': 'Production inference only',
    }


@router.get('/security')
def security_posture(user: UserOut = AdminUser):
    return {
        'jwtAuthentication': True,
        'rbac': True,
        'secureFileUpload': True,
        'inputValidation': True,
    }


@router.get('')
def overview(user: UserOut = AdminUser):
    return {
        'metrics': metrics(user),
        'datasetStatistics': dataset(user),
        'securityPosture': security_posture(user),
    }


def extract_uploaded_file_text(content: bytes, filename: str) -> str:
    ext = filename.split('.')[-1].lower()
    if ext in ['txt', 'md', 'markdown']:
        return content.decode('utf-8', errors='ignore')
    elif ext == 'csv':
        import csv
        from io import StringIO
        f = StringIO(content.decode('utf-8', errors='ignore'))
        reader = csv.reader(f)
        lines = []
        for row in reader:
            if row:
                lines.append(", ".join(row))
        return "\n".join(lines)
    elif ext == 'pdf':
        try:
            import pypdf
            reader = pypdf.PdfReader(BytesIO(content))
            pages_text = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    pages_text.append(t)
            return "\n".join(pages_text)
        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="pypdf package is not installed on server. Run 'pip install pypdf' to extract PDFs."
            )
    elif ext in ['doc', 'docx']:
        try:
            import docx
            doc = docx.Document(BytesIO(content))
            return "\n".join([p.text for p in doc.paragraphs])
        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="python-docx package is not installed on server. Run 'pip install python-docx' to extract Word files."
            )
    else:
        # Default fallback: try plain-text decode
        try:
            return content.decode('utf-8')
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format: {ext}"
            )


@router.post('/upload-knowledge-doc')
async def upload_knowledge_doc(
    title: str = Form(...),
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    user: UserOut = AdminUser
):
    """Admin-only endpoint to upload documents to SQLite RAG database."""
    from fastapi.concurrency import run_in_threadpool
    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty"
        )

    text = await run_in_threadpool(extract_uploaded_file_text, content, file.filename or "doc.txt")
    if not text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract any text from file"
        )

    doc_id = await run_in_threadpool(KnowledgeService.add_document_to_rag, title, text, doc_type)
    return {
        "status": "success",
        "message": f"Successfully processed and chunked document: {title}",
        "document_id": doc_id
    }


@router.post('/add-faq')
def add_faq(
    question: str = Form(...),
    answer: str = Form(...),
    user: UserOut = AdminUser
):
    """Admin-only endpoint to add a quick FAQ entry."""
    if not question.strip() or not answer.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question and answer fields cannot be empty"
        )

    formatted_content = f"Question: {question}. Answer: {answer}"
    doc_id = KnowledgeService.add_document_to_rag(f"FAQ: {question}", formatted_content, "faq")
    return {
        "status": "success",
        "message": "FAQ added successfully to RAG database",
        "document_id": doc_id
    }
