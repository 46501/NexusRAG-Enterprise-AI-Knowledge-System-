import base64
import binascii
import re
import unicodedata
from enum import Enum
from typing import NamedTuple

from pydantic import BaseModel, Field

from app.utils.logger import get_logger

logger = get_logger(__name__)


class GuardrailThreatCategory(str, Enum):
    PROMPT_INJECTION = "PROMPT_INJECTION"
    PROMPT_EXFILTRATION = "PROMPT_EXFILTRATION"
    ADVERSARIAL_DELIMITER = "ADVERSARIAL_DELIMITER"
    DATA_EXFILTRATION_PROBE = "DATA_EXFILTRATION_PROBE"
    CODE_EXECUTION_PROBE = "CODE_EXECUTION_PROBE"


class GuardrailSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class GuardrailResult(BaseModel):
    passed: bool = Field(..., description="True if query is safe to process; False if blocked.")
    action: str = Field(..., description="'ALLOW', 'BLOCK', or 'FLAG'.")
    threat_category: GuardrailThreatCategory | None = Field(default=None, description="Classified category if threat detected.")
    severity: GuardrailSeverity | None = Field(default=None, description="Severity rating of the detected threat.")
    matched_pattern: str | None = Field(default=None, description="Sanitized description of pattern that triggered the rule.")
    confidence: float = Field(default=1.0, description="Confidence score of detection (0.0 - 1.0).")
    refusal_message: str | None = Field(default=None, description="Safe corporate response returned when blocked.")
    sanitized_query: str = Field(..., description="Query with zero-width characters and invisible noise stripped.")


# Default enterprise refusal message
ENTERPRISE_REFUSAL_MESSAGE = (
    "Security Notice: Your request triggered an automated safety and guardrail policy. "
    "NexusRAG queries must strictly pertain to corporate policy and document search. "
    "System override attempts, instruction extraction, and policy bypasses are monitored and logged."
)

# Invisible / Zero-width characters used for steganographic injection
_ZERO_WIDTH_CHARS = re.compile(
    r"[\u200B\u200C\u200D\u200E\u200F\uFEFF\u00AD\u2060\u2061\u2062\u2063\u2064\u206A-\u206F]"
)

# Leetspeak basic translation mapping for normalized screening
_LEET_TABLE = str.maketrans({
    "0": "o",
    "1": "i",
    "3": "e",
    "4": "a",
    "5": "s",
    "7": "t",
    "@": "a",
    "$": "s",
    "!": "i",
})


class _RulePattern(NamedTuple):
    category: GuardrailThreatCategory
    severity: GuardrailSeverity
    pattern: re.Pattern
    description: str


# -----------------------------------------------------------------------------
# 1. Direct Prompt Injection & Jailbreak Signatures
# -----------------------------------------------------------------------------
_PROMPT_INJECTION_RULES: list[_RulePattern] = [
    _RulePattern(
        GuardrailThreatCategory.PROMPT_INJECTION,
        GuardrailSeverity.CRITICAL,
        re.compile(
            r"\b(?:ignore|disregard|forget|bypass|override|drop)\s+(?:all\s+)?(?:previous|prior|above|existing|system|initial)\s+(?:instructions|prompts?|rules?|directives?|constraints?|guidelines?)",
            re.IGNORECASE,
        ),
        "Instruction override pattern",
    ),
    _RulePattern(
        GuardrailThreatCategory.PROMPT_INJECTION,
        GuardrailSeverity.CRITICAL,
        re.compile(
            r"\b(?:you\s+are\s+now|pretend\s+to\s+be|act\s+as|roleplay\s+as)\s+(?:dan|an?\s+unrestricted|an?\s+unfiltered|jailbreak(?:ed)?|an?\s+evil|developer\s+mode|god\s+mode|chaos\s+gpt)\b",
            re.IGNORECASE,
        ),
        "Jailbreak persona assignment",
    ),
    _RulePattern(
        GuardrailThreatCategory.PROMPT_INJECTION,
        GuardrailSeverity.CRITICAL,
        re.compile(
            r"\b(?:enable|enter|switch\s+to|activate)\s+(?:jailbreak|unrestricted|unfiltered|developer|god|dan)\s+mode\b",
            re.IGNORECASE,
        ),
        "Adversarial mode activation",
    ),
    _RulePattern(
        GuardrailThreatCategory.PROMPT_INJECTION,
        GuardrailSeverity.HIGH,
        re.compile(
            r"\bsystem\s+override\b|override\s+(?:system|safety|guardrail|security|departmental)\s+(?:prompts?|rules?|filters?|controls?)",
            re.IGNORECASE,
        ),
        "System override command",
    ),
    _RulePattern(
        GuardrailThreatCategory.PROMPT_INJECTION,
        GuardrailSeverity.HIGH,
        re.compile(
            r"\b(?:bypass|disable|circumvent)\s+(?:all\s+)?(?:security|department\s+isolation|rbac|safety\s+filters?|guardrails?)",
            re.IGNORECASE,
        ),
        "Security/RBAC bypass attempt",
    ),
    _RulePattern(
        GuardrailThreatCategory.PROMPT_INJECTION,
        GuardrailSeverity.MEDIUM,
        re.compile(
            r"\b(?:in\s+a\s+hypothetical\s+world\s+where\s+(?:there\s+are\s+no|you\s+have\s+no)\s+rules|for\s+educational\s+purposes\s+(?:only\s+)?ignore\s+safety)\b",
            re.IGNORECASE,
        ),
        "Hypothetical rule bypass scenario",
    ),
    _RulePattern(
        GuardrailThreatCategory.PROMPT_INJECTION,
        GuardrailSeverity.HIGH,
        re.compile(
            r"\bdo\s+anything\s+now\b|\bfrom\s+now\s+on\s+you\s+(?:must\s+)?(?:ignore|obey\s+only\s+me)\b",
            re.IGNORECASE,
        ),
        "DAN directive phrasing",
    ),
]

# -----------------------------------------------------------------------------
# 2. System Prompt & Instruction Exfiltration Signatures
# -----------------------------------------------------------------------------
_EXFILTRATION_RULES: list[_RulePattern] = [
    _RulePattern(
        GuardrailThreatCategory.PROMPT_EXFILTRATION,
        GuardrailSeverity.CRITICAL,
        re.compile(
            r"\b(?:what\s+(?:is|was)|show(?:\s+me)?|print|display|reveal|output|tell(?:\s+me)?|give(?:\s+me)?|share|recite|leak)\b.*?\b(?:system\s+prompt|system\s+instruction|developer\s+instruction|hidden\s+prompt|initial\s+prompt|base\s+instructions?|system\s+message)\b",
            re.IGNORECASE,
        ),
        "System prompt extraction probe",
    ),
    _RulePattern(
        GuardrailThreatCategory.PROMPT_EXFILTRATION,
        GuardrailSeverity.CRITICAL,
        re.compile(
            r"\b(?:system\s+prompt|system\s+instruction|developer\s+instruction|hidden\s+prompt|initial\s+prompt|base\s+instructions?)\b.*?\b(?:verbatim|word\s+for\s+word|exact|output|show|print)\b",
            re.IGNORECASE,
        ),
        "System prompt extraction probe (post-specifier)",
    ),
    _RulePattern(
        GuardrailThreatCategory.PROMPT_EXFILTRATION,
        GuardrailSeverity.HIGH,
        re.compile(
            r"\b(?:repeat|print|output|recite)\s+(?:everything|all\s+text)\s+(?:above|before\s+this|starting\s+with\s+[\"']?(?:you\s+are|system))\b",
            re.IGNORECASE,
        ),
        "Prefix text extraction probe",
    ),
    _RulePattern(
        GuardrailThreatCategory.PROMPT_EXFILTRATION,
        GuardrailSeverity.HIGH,
        re.compile(
            r"\bwhat\s+were\s+you\s+told\s+to\s+do\s+before\s+this\s+conversation\b",
            re.IGNORECASE,
        ),
        "Meta initialization probe",
    ),
    _RulePattern(
        GuardrailThreatCategory.PROMPT_EXFILTRATION,
        GuardrailSeverity.MEDIUM,
        re.compile(
            r"\b(?:output|dump|leak|print|show)\s+(?:raw\s+)?(?:system\s+template|instruction\s+block|grounding\s+rules?)\b",
            re.IGNORECASE,
        ),
        "Template exfiltration probe",
    ),
]

# -----------------------------------------------------------------------------
# 3. Adversarial Delimiters & Fake Prompt Fences
# -----------------------------------------------------------------------------
_DELIMITER_RULES: list[_RulePattern] = [
    _RulePattern(
        GuardrailThreatCategory.ADVERSARIAL_DELIMITER,
        GuardrailSeverity.CRITICAL,
        re.compile(
            r"(?:<\|im_start\|>|<\|im_end\|>|<\|system\|>|<<SYS>>|<system>|</system>|\[INST\]|\[/INST\])",
            re.IGNORECASE,
        ),
        "LLM special prompt token injection",
    ),
    _RulePattern(
        GuardrailThreatCategory.ADVERSARIAL_DELIMITER,
        GuardrailSeverity.HIGH,
        re.compile(
            r"(?:---+\s*END(?:\s+OF)?\s+CONTEXT\s*---+|===+\s*END(?:\s+OF)?\s+SYSTEM\s*===+|###\s*HUMAN\s*:|###\s*ASSISTANT\s*:)",
            re.IGNORECASE,
        ),
        "Context fence breaking delimiter",
    ),
    _RulePattern(
        GuardrailThreatCategory.ADVERSARIAL_DELIMITER,
        GuardrailSeverity.HIGH,
        re.compile(
            r"(?:^|\n)\s*\[?SYSTEM\]?\s*:\s*(?:ignore|new\s+task|override)",
            re.IGNORECASE,
        ),
        "Spoofed system prefix directive",
    ),
]

# -----------------------------------------------------------------------------
# 4. Data Exfiltration & Database Probing Signatures
# -----------------------------------------------------------------------------
_DATA_EXFILTRATION_RULES: list[_RulePattern] = [
    _RulePattern(
        GuardrailThreatCategory.DATA_EXFILTRATION_PROBE,
        GuardrailSeverity.HIGH,
        re.compile(
            r"\b(?:dump|export|extract)\b.*?\b(?:database|postgres|qdrant|vector\s+store|collection|tables?)\b",
            re.IGNORECASE,
        ),
        "Bulk vector/database dump request",
    ),
    _RulePattern(
        GuardrailThreatCategory.DATA_EXFILTRATION_PROBE,
        GuardrailSeverity.CRITICAL,
        re.compile(
            r"\b(?:show|list|dump|leak|extract)\b.*?\b(?:user\s+passwords?|password\s+hashes?|jwt\s+tokens?|api\s+keys?|secret\s+keys?)\b",
            re.IGNORECASE,
        ),
        "Credential and secret dump request",
    ),
]

# -----------------------------------------------------------------------------
# 5. Code Execution & Injection Signatures
# -----------------------------------------------------------------------------
_CODE_EXECUTION_RULES: list[_RulePattern] = [
    _RulePattern(
        GuardrailThreatCategory.CODE_EXECUTION_PROBE,
        GuardrailSeverity.HIGH,
        re.compile(
            r"(?:\bUNION\s+ALL\s+SELECT\b|\bUNION\s+SELECT\b|\bDROP\s+TABLE\b|;\s*SELECT\s+\*\s+FROM\b|\bOR\s+1\s*=\s*1\b)",
            re.IGNORECASE,
        ),
        "SQL injection vector",
    ),
    _RulePattern(
        GuardrailThreatCategory.CODE_EXECUTION_PROBE,
        GuardrailSeverity.CRITICAL,
        re.compile(
            r"(?:__import__\s*\(\s*['\"]os['\"]\s*\)|os\.system\s*\(|subprocess\.Popen\s*\(|\$\{jndi:)",
            re.IGNORECASE,
        ),
        "Remote code execution / JNDI injection vector",
    ),
]

_ALL_RULES = (
    _PROMPT_INJECTION_RULES
    + _EXFILTRATION_RULES
    + _DELIMITER_RULES
    + _DATA_EXFILTRATION_RULES
    + _CODE_EXECUTION_RULES
)


# -----------------------------------------------------------------------------
# Text Normalization & Steganography Detection Helpers
# -----------------------------------------------------------------------------
def sanitize_invisible_characters(text: str) -> str:
    """Strip zero-width characters and invisible unicode control codes."""
    if not text:
        return ""
    # Normalize unicode to standard NFKC
    normalized = unicodedata.normalize("NFKC", text)
    # Remove zero-width & non-printable steganographic characters
    return _ZERO_WIDTH_CHARS.sub("", normalized)


def normalize_leetspeak(text: str) -> str:
    """Convert common leetspeak substitutions to standard characters for pattern checking."""
    return text.translate(_LEET_TABLE)


def check_base64_injections(text: str) -> _RulePattern | None:
    """Inspect potential base64 strings embedded in text to detect obfuscated prompt injections."""
    # Match standalone tokens of length >= 20 containing valid base64 characters
    candidates = re.findall(r"\b[A-Za-z0-9+/]{20,}={0,2}\b", text)
    for cand in candidates:
        try:
            decoded = base64.b64decode(cand, validate=True).decode("utf-8", errors="ignore")
            if len(decoded) > 10:
                # Screen decoded string against injection and exfiltration patterns
                for rule in _PROMPT_INJECTION_RULES + _EXFILTRATION_RULES:
                    if rule.pattern.search(decoded):
                        return rule
        except (binascii.Error, UnicodeDecodeError):
            continue
    return None


# -----------------------------------------------------------------------------
# Main Public Interface
# -----------------------------------------------------------------------------
def inspect_query(query: str, user_role: str | None = None) -> GuardrailResult:
    """Comprehensive multi-layered security inspection for incoming user queries.

    Checks for:
    - Direct prompt injections & jailbreak attacks
    - System prompt & instruction exfiltration
    - Adversarial delimiters & context hijacking tokens
    - Bulk database dump & credential probes
    - Obfuscated base64 payload injections
    """
    if not query or not query.strip():
        return GuardrailResult(
            passed=True,
            action="ALLOW",
            sanitized_query="",
        )

    # 1. Clean invisible & zero-width characters
    sanitized = sanitize_invisible_characters(query).strip()

    # 2. Check for base64 obfuscated payload injections
    b64_threat = check_base64_injections(sanitized)
    if b64_threat:
        logger.warning(
            "Guardrail FIREWALL TRIGGERED (Base64 Obfuscation): role=%s threat=%s desc=%s",
            user_role,
            b64_threat.category.value,
            b64_threat.description,
        )
        return GuardrailResult(
            passed=False,
            action="BLOCK",
            threat_category=b64_threat.category,
            severity=b64_threat.severity,
            matched_pattern=f"Obfuscated Base64: {b64_threat.description}",
            confidence=0.98,
            refusal_message=ENTERPRISE_REFUSAL_MESSAGE,
            sanitized_query=sanitized,
        )

    # 3. Direct Pattern Matching across all signatures
    for rule in _ALL_RULES:
        if rule.pattern.search(sanitized):
            logger.warning(
                "Guardrail FIREWALL TRIGGERED: role=%s threat=%s severity=%s pattern=%s",
                user_role,
                rule.category.value,
                rule.severity.value,
                rule.description,
            )
            return GuardrailResult(
                passed=False,
                action="BLOCK",
                threat_category=rule.category,
                severity=rule.severity,
                matched_pattern=rule.description,
                confidence=0.95,
                refusal_message=ENTERPRISE_REFUSAL_MESSAGE,
                sanitized_query=sanitized,
            )

    # 4. Leetspeak / Obfuscated variant check
    leeted = normalize_leetspeak(sanitized)
    if leeted != sanitized:
        for rule in _PROMPT_INJECTION_RULES + _EXFILTRATION_RULES:
            if rule.pattern.search(leeted):
                logger.warning(
                    "Guardrail FIREWALL TRIGGERED (Leetspeak Match): role=%s threat=%s desc=%s",
                    user_role,
                    rule.category.value,
                    rule.description,
                )
                return GuardrailResult(
                    passed=False,
                    action="BLOCK",
                    threat_category=rule.category,
                    severity=rule.severity,
                    matched_pattern=f"Leetspeak Obfuscation: {rule.description}",
                    confidence=0.92,
                    refusal_message=ENTERPRISE_REFUSAL_MESSAGE,
                    sanitized_query=sanitized,
                )

    # 5. Query passed all firewall filters
    return GuardrailResult(
        passed=True,
        action="ALLOW",
        threat_category=None,
        severity=None,
        matched_pattern=None,
        confidence=1.0,
        refusal_message=None,
        sanitized_query=sanitized,
    )


def sanitize_text_for_ingestion(text: str) -> tuple[str, list[str]]:
    """Clean uploaded document text and detect indirect prompt injections.

    Returns:
        (cleaned_text, list_of_warning_flags)
    """
    warnings: list[str] = []
    if not text:
        return "", warnings

    # Strip zero-width invisible characters
    cleaned = sanitize_invisible_characters(text)
    if len(cleaned) < len(text):
        diff = len(text) - len(cleaned)
        warnings.append(f"Stripped {diff} zero-width invisible characters from uploaded text.")

    # Screen text for potential indirect prompt injection directives
    for rule in _PROMPT_INJECTION_RULES + _DELIMITER_RULES:
        if rule.pattern.search(cleaned):
            warnings.append(f"Potential indirect prompt injection detected: {rule.description}")

    return cleaned, warnings


def is_system_prompt_probe(query: str) -> bool:
    """Helper specifically checking if query attempts to extract system instructions."""
    res = inspect_query(query)
    return res.threat_category == GuardrailThreatCategory.PROMPT_EXFILTRATION


def is_prompt_injection(query: str) -> bool:
    """Helper specifically checking if query is an adversarial prompt injection."""
    res = inspect_query(query)
    return res.threat_category in (
        GuardrailThreatCategory.PROMPT_INJECTION,
        GuardrailThreatCategory.ADVERSARIAL_DELIMITER,
    )
