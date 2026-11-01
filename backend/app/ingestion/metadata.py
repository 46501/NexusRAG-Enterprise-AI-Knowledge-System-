import uuid
from dataclasses import dataclass
from pathlib import Path


@dataclass
class DocumentMeta:
    doc_id: str
    source: str
    role_access: str


def build_doc_meta(file_path: Path, role_access: str, original_filename: str | None = None) -> DocumentMeta:
    return DocumentMeta(
        doc_id=str(uuid.uuid4()),
        source=original_filename or file_path.name,
        role_access=role_access,
    )
