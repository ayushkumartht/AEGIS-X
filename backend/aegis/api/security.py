"""FastAPI dependencies that read the signed-in user from the `Authorization: Bearer` header."""

from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, Request

from aegis.auth import AuthError, User, read_token
from aegis.storage import repo


def optional_user(request: Request) -> User | None:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return None
    try:
        payload = read_token(header[7:].strip())
    except AuthError as exc:
        raise HTTPException(401, str(exc)) from exc
    row = repo.get_user(int(payload["uid"]))
    if row is None or not row["active"]:
        raise HTTPException(401, "This account no longer exists or is disabled.")
    return User(row["id"], row["email"], row["name"], row["role"])


def require(*roles: str) -> Callable[..., User]:
    """Dependency: the signed-in user, who must hold one of `roles`."""

    def dep(user: User | None = Depends(optional_user)) -> User:
        if user is None:
            raise HTTPException(401, "Sign in to do this.")
        if not user.can(*roles):
            raise HTTPException(403, f"This needs the {' or '.join(roles)} role.")
        return user

    return dep
