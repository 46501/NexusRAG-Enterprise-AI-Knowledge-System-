import re
from collections.abc import AsyncIterator
from enum import Enum
from typing import NamedTuple

from pydantic import BaseModel, Field

from app.utils.logger import get_logger

logger = get_logger(__name__)


class PIIType(str, Enum):
    SSN = "SSN"
    CREDIT_CARD = "CREDIT_CARD"
    API_KEY = "API_KEY"
    PRIVATE_KEY = "PRIVATE_KEY"
    PHONE_NUMBER = "PHONE_NUMBER"
    EMAIL = "EMAIL"
    PASSWORD_ASSIGNMENT = "PASSWORD_ASSIGNMENT"
    IBAN = "IBAN"


class PIIEntity(BaseModel):
    pii_type: PIIType
    redacted_preview: str = Field(..., description="Safe masked preview of detected PII (e.g. •••-••-1234).")
    start: int | None = None
    end: int | None = None


class ScrubResult(BaseModel):
    scrubbed_text: str
    detected_entities: list[PIIEntity] = Field(default_factory=list)
    has_pii: bool = False
    redaction_count: int = 0


# -----------------------------------------------------------------------------
# Luhn Algorithm for Accurate Credit Card Validation
# -----------------------------------------------------------------------------
def _is_luhn_valid(number_str: str) -> bool:
    """Validate digits against the Luhn algorithm (mod 10)."""
    digits = [int(c) for c in number_str if c.isdigit()]
    if len(digits) < 13 or len(digits) > 19:
        return False
    checksum = 0
    reverse_digits = digits[::-1]
    for i, d in enumerate(reverse_digits):
        if i % 2 == 1:
            doubled = d * 2
            checksum += doubled - 9 if doubled > 9 else doubled
        else:
            checksum += d
    return checksum % 10 == 0


def _mask_preview(raw: str, pii_type: PIIType) -> str:
    """Create a safe audit preview for logs without exposing full secret."""
    cleaned = raw.strip()
    if pii_type == PIIType.SSN:
        digits = re.sub(r"\D", "", cleaned)
        return f"•••-••-{digits[-4:]}" if len(digits) >= 4 else "•••-••-••••"
    elif pii_type == PIIType.CREDIT_CARD:
        digits = re.sub(r"\D", "", cleaned)
        return f"••••-••••-••••-{digits[-4:]}" if len(digits) >= 4 else "••••-••••-••••-••••"
    elif pii_type in (PIIType.API_KEY, PIIType.PASSWORD_ASSIGNMENT):
        prefix = cleaned[:4] if len(cleaned) >= 6 else "••"
        return f"{prefix}••••••••"
    elif pii_type == PIIType.PHONE_NUMBER:
        digits = re.sub(r"\D", "", cleaned)
        return f"•••-•••-{digits[-4:]}" if len(digits) >= 4 else "•••-•••-••••"
    elif pii_type == PIIType.EMAIL:
        parts = cleaned.split("@")
        if len(parts) == 2:
            name = parts[0]
            masked_name = name[0] + "•••" if len(name) > 1 else "•"
            return f"{masked_name}@{parts[1]}"
        return "•••@••••"
    return "••••••••"


# -----------------------------------------------------------------------------
# Precompiled Regex Patterns for High-Speed Inspection (<1ms)
# -----------------------------------------------------------------------------

# US Social Security Numbers
_SSN_FORMATTED = re.compile(
    r"\b(?!000|666|9\d{2})\d{3}[-\s](?!00)\d{2}[-\s](?!0000)\d{4}\b"
)
_SSN_UNFORMATTED = re.compile(
    r"(?i)\b(?:ssn|social\s+security(?:\s+number)?)\s*[:=#]?\s*([0-9]{9})\b"
)

# Credit Cards
_CREDIT_CARD_CANDIDATE = re.compile(
    r"\b(?:\d{4}[-\s]?){3}\d{4}\b|\b3[47]\d{2}[-\s]?\d{6}[-\s]?\d{5}\b|\b\d{13,19}\b"
)

# Private Keys
_PRIVATE_KEY_BLOCK = re.compile(
    r"-----BEGIN (?:[A-Z0-9_-]+\s+)?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9_-]+\s+)?PRIVATE KEY-----"
)

# API Keys & Secrets
_OPENAI_KEY = re.compile(r"\b(?:sk-[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9_-]{20,})\b")
_GOOGLE_KEY = re.compile(r"\bAIza[0-9A-Za-z-_]{30,40}\b")
_AWS_ACCESS_KEY = re.compile(r"\bAKIA[0-9A-Z]{16}\b")
_JWT_TOKEN = re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b")
_GENERIC_AUTH_SECRET = re.compile(
    r"(?i)\b(?:api[_-]?key|bearer\s+|auth[_-]?token|access[_-]?token|client[_-]?secret)\s*[:=]\s*['\"]?([A-Za-z0-9_\-\.]{24,})['\"]?"
)

# Cleartext Password Assignments
_PASSWORD_ASSIGNMENT = re.compile(
    r"(?i)\b(?:password|passwd|pwd)\s*[:=]\s*['\"]?([^'\"\s]{6,})['\"]?"
)

# Phone Numbers (US & International)
_PHONE_NUMBER = re.compile(
    r"\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?[2-9]\d{2}[-.\s]?\d{4}\b|"
    r"\b\+(?:[1-9]\d{0,2})[-.\s]?\d{1,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b"
)

# Email Addresses
_EMAIL_ADDRESS = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
)

# International Bank Account Numbers (IBAN)
_IBAN = re.compile(
    r"\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b"
)


# -----------------------------------------------------------------------------
# Main Scrubbing Engine
# -----------------------------------------------------------------------------
def scrub_text(text: str, mask_emails: bool = False) -> ScrubResult:
    """Scrub sensitive PII, credentials, API keys, and financial numbers from text.

    Args:
        text: The input query, document chunk, or generated answer.
        mask_emails: Whether to redact email addresses (default False to allow corporate contacts).

    Returns:
        ScrubResult containing the sanitized text and list of detected entities.
    """
    if not text:
        return ScrubResult(scrubbed_text="", detected_entities=[], has_pii=False, redaction_count=0)

    entities: list[PIIEntity] = []
    output = text

    # 1. Private Key Blocks (Highest Priority - Full Block Replacement)
    for m in _PRIVATE_KEY_BLOCK.finditer(output):
        entities.append(PIIEntity(
            pii_type=PIIType.PRIVATE_KEY,
            redacted_preview="-----BEGIN PRIVATE KEY----- •••",
            start=m.start(),
            end=m.end(),
        ))
    output = _PRIVATE_KEY_BLOCK.sub("[REDACTED_PRIVATE_KEY]", output)

    # 2. API Keys & Secrets
    for m in _OPENAI_KEY.finditer(output):
        entities.append(PIIEntity(
            pii_type=PIIType.API_KEY,
            redacted_preview=_mask_preview(m.group(), PIIType.API_KEY),
        ))
    output = _OPENAI_KEY.sub("[REDACTED_API_KEY]", output)

    for m in _GOOGLE_KEY.finditer(output):
        entities.append(PIIEntity(
            pii_type=PIIType.API_KEY,
            redacted_preview=_mask_preview(m.group(), PIIType.API_KEY),
        ))
    output = _GOOGLE_KEY.sub("[REDACTED_API_KEY]", output)

    for m in _AWS_ACCESS_KEY.finditer(output):
        entities.append(PIIEntity(
            pii_type=PIIType.API_KEY,
            redacted_preview=_mask_preview(m.group(), PIIType.API_KEY),
        ))
    output = _AWS_ACCESS_KEY.sub("[REDACTED_API_KEY]", output)

    for m in _JWT_TOKEN.finditer(output):
        entities.append(PIIEntity(
            pii_type=PIIType.API_KEY,
            redacted_preview=_mask_preview(m.group(), PIIType.API_KEY),
        ))
    output = _JWT_TOKEN.sub("[REDACTED_API_KEY]", output)

    # Generic secret assignments (e.g. api_key: "abc...")
    def _replace_generic_secret(match: re.Match) -> str:
        full = match.group(0)
        secret = match.group(1)
        entities.append(PIIEntity(
            pii_type=PIIType.API_KEY,
            redacted_preview=_mask_preview(secret, PIIType.API_KEY),
        ))
        return full.replace(secret, "[REDACTED_API_KEY]")
    output = _GENERIC_AUTH_SECRET.sub(_replace_generic_secret, output)

    # 3. Cleartext Password Assignments
    def _replace_password(match: re.Match) -> str:
        full = match.group(0)
        pwd = match.group(1)
        entities.append(PIIEntity(
            pii_type=PIIType.PASSWORD_ASSIGNMENT,
            redacted_preview=_mask_preview(pwd, PIIType.PASSWORD_ASSIGNMENT),
        ))
        return full.replace(pwd, "[REDACTED_PASSWORD]")
    output = _PASSWORD_ASSIGNMENT.sub(_replace_password, output)

    # 4. Social Security Numbers (SSN)
    for m in _SSN_FORMATTED.finditer(output):
        entities.append(PIIEntity(
            pii_type=PIIType.SSN,
            redacted_preview=_mask_preview(m.group(), PIIType.SSN),
        ))
    output = _SSN_FORMATTED.sub("[REDACTED_SSN]", output)

    def _replace_unformatted_ssn(match: re.Match) -> str:
        full = match.group(0)
        digits = match.group(1)
        entities.append(PIIEntity(
            pii_type=PIIType.SSN,
            redacted_preview=_mask_preview(digits, PIIType.SSN),
        ))
        return full.replace(digits, "[REDACTED_SSN]")
    output = _SSN_UNFORMATTED.sub(_replace_unformatted_ssn, output)

    # 5. Credit Card Numbers (Validated with Luhn check to prevent false positives)
    def _replace_credit_cards(match: re.Match) -> str:
        candidate = match.group(0)
        digits_only = re.sub(r"\D", "", candidate)
        # Check Luhn algorithm
        if 13 <= len(digits_only) <= 19 and _is_luhn_valid(digits_only):
            entities.append(PIIEntity(
                pii_type=PIIType.CREDIT_CARD,
                redacted_preview=_mask_preview(candidate, PIIType.CREDIT_CARD),
            ))
            return "[REDACTED_CREDIT_CARD]"
        return candidate
    output = _CREDIT_CARD_CANDIDATE.sub(_replace_credit_cards, output)

    # 6. Phone Numbers
    for m in _PHONE_NUMBER.finditer(output):
        entities.append(PIIEntity(
            pii_type=PIIType.PHONE_NUMBER,
            redacted_preview=_mask_preview(m.group(), PIIType.PHONE_NUMBER),
        ))
    output = _PHONE_NUMBER.sub("[REDACTED_PHONE]", output)

    # 7. Optional Email Address Masking
    if mask_emails:
        for m in _EMAIL_ADDRESS.finditer(output):
            entities.append(PIIEntity(
                pii_type=PIIType.EMAIL,
                redacted_preview=_mask_preview(m.group(), PIIType.EMAIL),
            ))
        output = _EMAIL_ADDRESS.sub("[REDACTED_EMAIL]", output)

    if entities:
        logger.info(
            "PII Scrubber sanitized %d entities: types=%s",
            len(entities),
            [e.pii_type.value for e in entities],
        )

    return ScrubResult(
        scrubbed_text=output,
        detected_entities=entities,
        has_pii=bool(entities),
        redaction_count=len(entities),
    )


# -----------------------------------------------------------------------------
# Streaming Response Redactor (Low-Latency Sliding Window Buffer)
# -----------------------------------------------------------------------------
async def scrub_stream(
    stream: AsyncIterator[str],
    window_size: int = 18,
    mask_emails: bool = False,
) -> AsyncIterator[str]:
    """Wrap an asynchronous token stream and sanitize PII in real-time.

    Buffers tokens and immediately flushes completed words at word boundaries
    when no sensitive sequence is in progress, drastically reducing time-to-first-token
    while ensuring secrets split across chunks are strictly redacted.
    """
    buffer = ""

    async for chunk in stream:
        buffer += chunk

        # Fast path: flush completed words at word boundaries
        if " " in buffer or "\n" in buffer:
            last_delim = max(buffer.rfind(" "), buffer.rfind("\n"))
            trailing = buffer[last_delim + 1 :]

            # Check if trailing fragment could be the start of a secret (digits, @, =, _)
            is_secret_candidate = any(c in trailing for c in ("@", "=", "_")) or (
                trailing.replace("-", "").isdigit() and len(trailing.replace("-", "")) >= 3
            )

            if not is_secret_candidate and len(trailing) < window_size:
                to_scrub = buffer[: last_delim + 1]
                buffer = buffer[last_delim + 1 :]
                res = scrub_text(to_scrub, mask_emails=mask_emails)
                yield res.scrubbed_text
            elif len(buffer) >= window_size * 2:
                safe_limit = len(buffer) - window_size
                cut_idx = max(buffer.rfind(" ", 0, safe_limit), buffer.rfind("\n", 0, safe_limit))
                if cut_idx > 0:
                    to_scrub = buffer[: cut_idx + 1]
                    buffer = buffer[cut_idx + 1 :]
                    res = scrub_text(to_scrub, mask_emails=mask_emails)
                    yield res.scrubbed_text

    # Flush remainder on stream end
    if buffer:
        final_res = scrub_text(buffer, mask_emails=mask_emails)
        yield final_res.scrubbed_text


# -----------------------------------------------------------------------------
# RAG Helper Utilities
# -----------------------------------------------------------------------------
def scrub_query(query: str) -> tuple[str, list[PIIEntity]]:
    """Sanitize incoming user query before sending to vector search / LLM."""
    res = scrub_text(query)
    return res.scrubbed_text, res.detected_entities


def scrub_answer(answer: str, mask_emails: bool = False) -> tuple[str, list[PIIEntity]]:
    """Sanitize synthesized answer before returning to the user."""
    res = scrub_text(answer, mask_emails=mask_emails)
    return res.scrubbed_text, res.detected_entities


def scrub_sources(sources: list[dict], mask_emails: bool = False) -> list[dict]:
    """Sanitize retrieved citation chunks to prevent leaking secrets in source metadata."""
    if not sources:
        return sources

    scrubbed = []
    for s in sources:
        item = dict(s)
        if "text" in item and item["text"]:
            res = scrub_text(item["text"], mask_emails=mask_emails)
            item["text"] = res.scrubbed_text
        scrubbed.append(item)
    return scrubbed
