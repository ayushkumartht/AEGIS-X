"""Accounts with the standard library only: PBKDF2 password hashes and HMAC-signed tokens.

Roles, from most to least power:
  admin   - everything, including managing accounts and the Command Center
  officer - records decisions and field reports
  viewer  - signed in, read-only (same as a visitor, but named in the logs)

Anyone can explore a district and run simulations without signing in.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from dataclasses import dataclass

from aegis.settings import get_settings

logger = logging.getLogger(__name__)

ROLES = ("admin", "officer", "viewer")
PBKDF2_ITERATIONS = 390_000
_dev_secret = secrets.token_urlsafe(32)


@dataclass(frozen=True)
class User:
    id: int
    email: str
    name: str
    role: str

    def can(self, *roles: str) -> bool:
        return self.role in roles

    def as_dict(self) -> dict:
        return {"id": self.id, "email": self.email, "name": self.name, "role": self.role}


class AuthError(Exception):
    """Bad credentials or a bad token."""


def hash_password(password: str, *, iterations: int = PBKDF2_ITERATIONS) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt, digest = stored.split("$")
    except ValueError:
        return False
    if algo != "pbkdf2_sha256":
        return False
    calc = hashlib.pbkdf2_hmac("sha256", password.encode(), _unb64(salt), int(iterations))
    return hmac.compare_digest(calc, _unb64(digest))


def _secret() -> bytes:
    s = get_settings()
    if s.aegis_secret_key:
        return s.aegis_secret_key.encode()
    if s.is_production:
        raise RuntimeError("AEGIS_SECRET_KEY must be set in production.")
    return _dev_secret.encode()


def make_token(user: User, *, hours: int | None = None) -> str:
    ttl = (hours if hours is not None else get_settings().aegis_token_hours) * 3600
    payload = {"uid": user.id, "role": user.role, "exp": int(time.time()) + ttl}
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    return f"{body}.{_sign(body)}"


def read_token(token: str) -> dict:
    """The token's payload, or AuthError when it is forged, malformed or expired."""
    try:
        body, sig = token.split(".")
    except ValueError as exc:
        raise AuthError("Malformed token.") from exc
    if not hmac.compare_digest(sig, _sign(body)):
        raise AuthError("Invalid token.")
    payload = json.loads(_unb64(body))
    if payload.get("exp", 0) < time.time():
        raise AuthError("Your session has expired. Sign in again.")
    return payload


def _sign(body: str) -> str:
    return _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def ensure_admin() -> None:
    """Create (or reset the password of) the admin named by AEGIS_ADMIN_EMAIL / AEGIS_ADMIN_PASSWORD."""
    from aegis.storage import repo

    s = get_settings()
    if not (s.aegis_admin_email and s.aegis_admin_password):
        if not repo.count_users():
            logger.warning("No accounts exist. Set AEGIS_ADMIN_EMAIL and AEGIS_ADMIN_PASSWORD to create the admin.")
        return
    email = s.aegis_admin_email.strip().lower()
    existing = repo.get_user_by_email(email)
    if existing is None:
        repo.add_user(email, "Administrator", "admin", hash_password(s.aegis_admin_password))
        logger.info("Created admin account %s", email)
    elif not verify_password(s.aegis_admin_password, existing["password_hash"]) or existing["role"] != "admin":
        repo.update_user(existing["id"], role="admin", active=True, password_hash=hash_password(s.aegis_admin_password))
