import asyncio
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.security.pii_scrubber import (
    PIIType,
    _is_luhn_valid,
    scrub_answer,
    scrub_query,
    scrub_sources,
    scrub_stream,
    scrub_text,
)


def test_ssn_redaction():
    print("\n--- TEST 1: SOCIAL SECURITY NUMBER (SSN) REDACTION ---")
    formatted = "Employee John Doe has SSN 123-45-6789 on record."
    res = scrub_text(formatted)
    print("  [+] Input:", formatted)
    print("  [+] Scrubbed:", res.scrubbed_text)
    assert "[REDACTED_SSN]" in res.scrubbed_text
    assert "123-45-6789" not in res.scrubbed_text
    assert any(e.pii_type == PIIType.SSN for e in res.detected_entities)

    unformatted = "Please verify ssn: 987654321 for onboarding."
    res2 = scrub_text(unformatted)
    assert "[REDACTED_SSN]" in res2.scrubbed_text
    assert "987654321" not in res2.scrubbed_text
    print("  -> Passed SSN formatted and unformatted tests.")


def test_credit_card_luhn_validation_and_redaction():
    print("\n--- TEST 2: CREDIT CARD REDACTION & LUHN CHECKS ---")
    # Valid Visa (passes Luhn)
    valid_visa = "Payment card 4111-1111-1111-1111 submitted for expense reimbursement."
    res_visa = scrub_text(valid_visa)
    print("  [+] Visa scrubbed:", res_visa.scrubbed_text)
    assert "[REDACTED_CREDIT_CARD]" in res_visa.scrubbed_text
    assert "4111-1111-1111-1111" not in res_visa.scrubbed_text

    # Valid Amex (15 digits, passes Luhn)
    valid_amex = "Amex card: 3782-822463-10005"
    res_amex = scrub_text(valid_amex)
    print("  [+] Amex scrubbed:", res_amex.scrubbed_text)
    assert "[REDACTED_CREDIT_CARD]" in res_amex.scrubbed_text

    # Non-card 16-digit sequence (fails Luhn check - e.g. tracking number)
    fake_card = "Shipment tracking number is 1234-5678-9012-3456 in warehouse."
    assert not _is_luhn_valid("1234567890123456")
    res_fake = scrub_text(fake_card)
    print("  [+] False-positive test (Tracking ID):", res_fake.scrubbed_text)
    assert "1234-5678-9012-3456" in res_fake.scrubbed_text
    assert "[REDACTED_CREDIT_CARD]" not in res_fake.scrubbed_text

    print("  -> Passed credit card redaction and Luhn false-positive prevention.")


def test_api_keys_and_secret_redaction():
    print("\n--- TEST 3: API KEYS, SECRETS & TOKENS ---")
    # OpenAI key
    text_openai = "Use key sk-proj-abc1234567890123456789012345 for testing."
    res_oai = scrub_text(text_openai)
    print("  [+] OpenAI Key scrubbed:", res_oai.scrubbed_text)
    assert "[REDACTED_API_KEY]" in res_oai.scrubbed_text
    assert "sk-proj-" not in res_oai.scrubbed_text

    # Google API key
    text_google = "Google Maps key is AIzaSyD-1234567890abcdefghijklmnopqrst in config."
    res_google = scrub_text(text_google)
    print("  [+] Google Key scrubbed:", res_google.scrubbed_text)
    assert "[REDACTED_API_KEY]" in res_google.scrubbed_text
    assert "AIzaSyD" not in res_google.scrubbed_text

    # AWS Access Key ID
    text_aws = "AWS credentials: AKIAIOSFODNN7EXAMPLE"
    res_aws = scrub_text(text_aws)
    print("  [+] AWS Key scrubbed:", res_aws.scrubbed_text)
    assert "[REDACTED_API_KEY]" in res_aws.scrubbed_text
    assert "AKIA" not in res_aws.scrubbed_text

    # JWT Token
    jwt_sample = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    res_jwt = scrub_text(jwt_sample)
    print("  [+] JWT Token scrubbed:", res_jwt.scrubbed_text)
    assert "[REDACTED_API_KEY]" in res_jwt.scrubbed_text
    assert "eyJ" not in res_jwt.scrubbed_text

    # Generic api_key assignment
    text_gen = 'Connect with api_key: "abcdef1234567890abcdef123456"'
    res_gen = scrub_text(text_gen)
    print("  [+] Generic Secret scrubbed:", res_gen.scrubbed_text)
    assert "[REDACTED_API_KEY]" in res_gen.scrubbed_text

    print("  -> Passed all API key and credential redaction tests.")


def test_private_key_blocks_and_passwords():
    print("\n--- TEST 4: PRIVATE KEYS & CLEARTEXT PASSWORDS ---")
    priv_key = (
        "Server config:\n"
        "-----BEGIN RSA PRIVATE KEY-----\n"
        "MIIEowIBAAKCAQEA0Y1W4Qz8fR2...SAMPLE...PRIVATE...KEY...BLOCK\n"
        "-----END RSA PRIVATE KEY-----\n"
        "Config finished."
    )
    res_pk = scrub_text(priv_key)
    print("  [+] Private key scrubbed:", res_pk.scrubbed_text)
    assert "[REDACTED_PRIVATE_KEY]" in res_pk.scrubbed_text
    assert "MIIEowIBAAKCAQEA" not in res_pk.scrubbed_text

    pwd_text = 'Database connection: password = "UltraSecretPassword2026!" on port 5432'
    res_pwd = scrub_text(pwd_text)
    print("  [+] Password scrubbed:", res_pwd.scrubbed_text)
    assert "[REDACTED_PASSWORD]" in res_pwd.scrubbed_text
    assert "UltraSecretPassword2026!" not in res_pwd.scrubbed_text

    print("  -> Passed private key and password redaction tests.")


def test_phone_numbers_and_emails():
    print("\n--- TEST 5: PHONE NUMBERS & EMAILS ---")
    phones = "Call HR at (555) 234-5678 or mobile +1-555-867-5309 for assistance."
    res_phone = scrub_text(phones)
    print("  [+] Phones scrubbed:", res_phone.scrubbed_text)
    assert "[REDACTED_PHONE]" in res_phone.scrubbed_text
    assert "234-5678" not in res_phone.scrubbed_text
    assert "867-5309" not in res_phone.scrubbed_text

    # Email without email masking (preserves enterprise contact)
    email_text = "Contact support@apexcorp.com for travel questions."
    res_email_kept = scrub_text(email_text, mask_emails=False)
    assert "support@apexcorp.com" in res_email_kept.scrubbed_text

    # Email with email masking enabled
    res_email_masked = scrub_text(email_text, mask_emails=True)
    print("  [+] Email masked:", res_email_masked.scrubbed_text)
    assert "[REDACTED_EMAIL]" in res_email_masked.scrubbed_text
    assert "support@apexcorp.com" not in res_email_masked.scrubbed_text

    print("  -> Passed phone number and email masking tests.")


async def test_streaming_token_redaction():
    print("\n--- TEST 6: REAL-TIME STREAMING TOKEN BUFFER REDACTION ---")
    # Simulate an API key split across 3 consecutive SSE chunks
    chunks = [
        "The requested token is sk-",
        "proj-9876543210abcdef",
        "1234567890abcdef and can be used immediately.",
    ]

    async def _mock_stream():
        for c in chunks:
            yield c
            await asyncio.sleep(0.005)

    stream_scrubbed = []
    async for clean_tok in scrub_stream(_mock_stream(), window_size=20):
        stream_scrubbed.append(clean_tok)

    full_output = "".join(stream_scrubbed)
    print("  [+] Raw stream chunks:", chunks)
    print("  [+] Scrubbed full stream output:", full_output)

    assert "[REDACTED_API_KEY]" in full_output
    assert "sk-proj-" not in full_output
    assert "9876543210abcdef" not in full_output
    print("  -> Passed streaming window buffer secret redaction.")


def test_sources_and_query_scrubbing():
    print("\n--- TEST 7: CITATION SOURCES & INBOUND QUERY SCRUBBING ---")
    # Inbound query with SSN
    raw_query = "What is the policy for SSN 123-45-6789?"
    clean_q, pii_list = scrub_query(raw_query)
    print("  [+] Inbound query sanitized:", clean_q)
    assert "[REDACTED_SSN]" in clean_q
    assert len(pii_list) == 1

    # Outbound sources list with sensitive details
    dirty_sources = [
        {
            "index": 1,
            "source": "hr_records.txt",
            "text": "Employee Jane Doe has card 4111-1111-1111-1111 on file.",
        },
        {
            "index": 2,
            "source": "api_config.md",
            "text": "System key: AKIAIOSFODNN7EXAMPLE",
        },
    ]
    cleaned_sources = scrub_sources(dirty_sources)
    print("  [+] Cleaned Source 1:", cleaned_sources[0]["text"])
    print("  [+] Cleaned Source 2:", cleaned_sources[1]["text"])

    assert "[REDACTED_CREDIT_CARD]" in cleaned_sources[0]["text"]
    assert "4111-1111-1111-1111" not in cleaned_sources[0]["text"]
    assert "[REDACTED_API_KEY]" in cleaned_sources[1]["text"]
    assert "AKIAIOSFODNN7EXAMPLE" not in cleaned_sources[1]["text"]

    print("  -> Passed source metadata and inbound query scrubbing.")


async def main():
    print("================================================================================")
    print("NEXUSRAG PII & SECRET SCRUBBER TEST SUITE (app/security/pii_scrubber.py)")
    print("================================================================================")
    test_ssn_redaction()
    test_credit_card_luhn_validation_and_redaction()
    test_api_keys_and_secret_redaction()
    test_private_key_blocks_and_passwords()
    test_phone_numbers_and_emails()
    await test_streaming_token_redaction()
    test_sources_and_query_scrubbing()
    print("================================================================================")
    print("ALL PII & SECRET SCRUBBER TESTS PASSED (100% SUCCESS)!")
    print("================================================================================")


if __name__ == "__main__":
    asyncio.run(main())
