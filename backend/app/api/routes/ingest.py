import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status

from app.api.dependencies import get_current_user
from app.db.models import RoleEnum, User
from app.services.ingestion_service import ingest_upload

router = APIRouter(prefix="/ingest", tags=["ingest"])

_TEMP_DIR = Path("temp_uploads")
_ALLOWED_SUFFIXES = {".pdf", ".txt", ".md"}
_MAX_BYTES = 20 * 1024 * 1024
_DEPT_VALUES = {r.value for r in RoleEnum if r != RoleEnum.admin}


@router.post("", status_code=status.HTTP_201_CREATED)
async def ingest_document(
    file: UploadFile,
    department: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in _ALLOWED_SUFFIXES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type '{suffix}'. Allowed: {sorted(_ALLOWED_SUFFIXES)}",
        )

    contents = await file.read()
    if len(contents) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 20 MB limit",
        )

    if current_user.role == RoleEnum.admin:
        if not department or department not in _DEPT_VALUES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Admin must specify a valid department: {sorted(_DEPT_VALUES)}",
            )
        role_access = department
    else:
        role_access = current_user.role.value

    _TEMP_DIR.mkdir(parents=True, exist_ok=True)
    temp_path = _TEMP_DIR / f"{uuid.uuid4()}{suffix}"
    temp_path.write_bytes(contents)

    try:
        doc_id = await ingest_upload(
            file_path=temp_path,
            role_access=role_access,
            uploader_id=str(current_user.id),
            original_filename=file.filename,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
    finally:
        if temp_path.exists():
            temp_path.unlink()

    return {"doc_id": doc_id, "filename": file.filename, "department": role_access}
