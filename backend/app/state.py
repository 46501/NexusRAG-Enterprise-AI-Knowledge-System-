import asyncio
import os

from slowapi import Limiter
from slowapi.util import get_remote_address

# Safe concurrency ceiling on memory-constrained containers (e.g. Render 512MB free tier)
RAG_SEMAPHORE_MAX = int(os.getenv("RAG_SEMAPHORE_MAX", "2"))

limiter = Limiter(key_func=get_remote_address)

rag_semaphore: asyncio.Semaphore | None = None


def init_semaphore() -> None:
    global rag_semaphore
    rag_semaphore = asyncio.Semaphore(RAG_SEMAPHORE_MAX)


def get_semaphore() -> asyncio.Semaphore:
    global rag_semaphore
    if rag_semaphore is None:
        rag_semaphore = asyncio.Semaphore(RAG_SEMAPHORE_MAX)
    return rag_semaphore


def rag_slots_in_use() -> int:
    sem = get_semaphore()
    return RAG_SEMAPHORE_MAX - sem._value
