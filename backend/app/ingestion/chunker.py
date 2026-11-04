import re
from dataclasses import dataclass

_CHUNK_SIZE = 512
_CHUNK_OVERLAP = 64

# Regex patterns for detecting document section headers
_MD_HEADER_RE = re.compile(r"^(#{1,4})\s+(.+)$", re.MULTILINE)
_SECTION_PREFIX_RE = re.compile(
    r"^(?:Section\s+\d+|Article\s+[IVXLCDM\d]+|Policy\s+\d+|Part\s+\d+|Step\s+\d+|Chapter\s+\d+|P\d+\s*[-—–])\b",
    re.IGNORECASE,
)


@dataclass
class Chunk:
    text: str
    chunk_index: int
    section: str = ""
    context_prefix: str = ""
    contextual_text: str = ""
    total_chunks: int = 0


def _detect_sections(text: str) -> list[tuple[int, str]]:
    """Scans text and identifies word offsets where new sections begin.
    
    Returns a list of (word_index, section_title) sorted by word_index.
    """
    sections: list[tuple[int, str]] = []
    lines = text.split("\n")
    word_count = 0

    for line in lines:
        stripped = line.strip()
        line_words = stripped.split()
        num_words = len(line_words)

        if not stripped:
            continue

        # Pattern 1: Markdown header (# Heading)
        md_match = re.match(r"^#{1,4}\s+(.+)$", stripped)
        if md_match:
            title = md_match.group(1).strip()
            sections.append((word_count, title))
            word_count += num_words
            continue

        # Pattern 2: Explicit section prefixes (Section 1, Step 3, P0 — Critical, etc.)
        if _SECTION_PREFIX_RE.match(stripped) and len(stripped) < 120:
            sections.append((word_count, stripped))
            word_count += num_words
            continue

        # Pattern 3: Standalone title-like lines (short, capitalized or title-cased, no ending period)
        if (
            num_words <= 8
            and len(stripped) <= 80
            and not stripped.endswith((".", ",", ";", ":", "?", "!"))
            and (stripped.isupper() or stripped.istitle() or any(w.istitle() for w in line_words[:2]))
        ):
            sections.append((word_count, stripped))
            word_count += num_words
            continue

        word_count += num_words

    return sections


def _find_active_section(sections: list[tuple[int, str]], start_word: int) -> str:
    """Finds the section title in effect at `start_word`."""
    active_section = "Overview"
    for word_idx, title in sections:
        if word_idx <= start_word:
            active_section = title
        else:
            break
    return active_section


def chunk_text(
    text: str,
    chunk_size: int = _CHUNK_SIZE,
    overlap: int = _CHUNK_OVERLAP,
    doc_title: str | None = None,
    department: str | None = None,
) -> list[Chunk]:
    """Splits text into chunks enriched with Anthropic-style Contextual Grounding.
    
    Each chunk retains its raw text (for UI display and citation inspection) while
    generating a `contextual_text` prepended with document, department, and section
    context for high-precision dense vector embedding and sparse BM25 indexing.
    """
    words = text.split()
    if not words:
        return []

    sections = _detect_sections(text)
    chunks: list[Chunk] = []
    start = 0
    index = 0

    while start < len(words):
        end = start + chunk_size
        chunk_words = words[start:end]
        raw_chunk_text = " ".join(chunk_words)

        section = _find_active_section(sections, start)

        # Build situational context prefix
        doc_part = f"Document: {doc_title}" if doc_title else None
        dept_part = f"Department: {department}" if department else None
        sec_part = f"Section: {section}" if section else None

        parts = [p for p in (doc_part, dept_part, sec_part) if p]
        if parts:
            context_prefix = f"[{' | '.join(parts)}]"
            contextual_text = f"{context_prefix}\n\n{raw_chunk_text}"
        else:
            context_prefix = ""
            contextual_text = raw_chunk_text

        chunks.append(
            Chunk(
                text=raw_chunk_text,
                chunk_index=index,
                section=section,
                context_prefix=context_prefix,
                contextual_text=contextual_text,
            )
        )
        start += chunk_size - overlap
        index += 1

    total = len(chunks)
    for c in chunks:
        c.total_chunks = total

    return chunks
