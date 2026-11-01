from dataclasses import dataclass


_CHUNK_SIZE = 512
_CHUNK_OVERLAP = 64


@dataclass
class Chunk:
    text: str
    chunk_index: int


def chunk_text(text: str, chunk_size: int = _CHUNK_SIZE, overlap: int = _CHUNK_OVERLAP) -> list[Chunk]:
    words = text.split()
    chunks = []
    start = 0
    index = 0

    while start < len(words):
        end = start + chunk_size
        chunk_words = words[start:end]
        chunks.append(Chunk(text=" ".join(chunk_words), chunk_index=index))
        start += chunk_size - overlap
        index += 1

    return chunks
