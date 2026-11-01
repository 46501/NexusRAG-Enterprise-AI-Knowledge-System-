from pathlib import Path


def load_text_file(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load_pdf_file(path: Path) -> str:
    import pdfplumber

    pages = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
    return "\n\n".join(pages)


def load_document(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return load_pdf_file(path)
    if suffix in (".txt", ".md"):
        return load_text_file(path)
    raise ValueError(f"Unsupported file type: {suffix} ({path})")
