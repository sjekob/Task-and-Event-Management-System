"""
cors.py — Centralised CORS configuration for the gateway and all services.

Security note (OWASP A05 — Security Misconfiguration):
  Browsers reject the combination of `allow_origins=["*"]` with
  `allow_credentials=True`. More importantly, a wildcard origin is overly
  permissive. TaskNet authenticates with Bearer tokens in the Authorization
  header (not cookies), so credentialed CORS is not required.

Behaviour:
  • If CORS_ALLOW_ORIGINS is set (comma-separated), those exact origins are
    allowed and credentials are enabled.
  • If it is unset (local development), we fall back to a wildcard origin with
    credentials DISABLED — a spec-valid, Bearer-token-friendly default.
"""
import os


def get_cors_config() -> tuple[list[str], bool]:
    """Returns (allow_origins, allow_credentials)."""
    raw = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
    if raw:
        origins = [o.strip() for o in raw.split(",") if o.strip()]
        if origins:
            return origins, True
    # Dev default: wildcard without credentials (valid + works with Bearer tokens).
    return ["*"], False
