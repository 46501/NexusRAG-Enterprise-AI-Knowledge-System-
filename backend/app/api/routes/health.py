import ctypes
import gc
import sys
from fastapi import APIRouter

router = APIRouter(tags=["health"])

_call_count = 0


def _trim_memory():
    """Trigger glibc malloc_trim to return free memory pages to OS."""
    gc.collect()
    if sys.platform.startswith("linux"):
        try:
            ctypes.CDLL("libc.so.6").malloc_trim(0)
        except Exception:
            pass


@router.get("/health")
async def health():
    global _call_count
    _call_count += 1
    # Trim memory every 10 health checks (~5-10 minutes under Render monitoring)
    if _call_count % 10 == 0:
        _trim_memory()
    return {"status": "ok"}

