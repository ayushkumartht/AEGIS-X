"""Sign in, who am I, and account management (admin)."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from aegis.api import limits
from aegis.api.security import require
from aegis.auth import ROLES, User, hash_password, make_token, verify_password
from aegis.storage import repo
from aegis.storage.db import now_iso

router = APIRouter(prefix="/auth", tags=["auth"])

Role = Literal["admin", "officer", "viewer"]


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=200)


class NewUserRequest(BaseModel):
    email: str = Field(min_length=3, max_length=200, pattern=r"^[^@\s]+@[^@\s]+$")
    name: str = Field(min_length=1, max_length=80)
    role: Role = "officer"
    password: str = Field(min_length=8, max_length=200)


class UpdateUserRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    role: Role | None = None
    active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=200)


@router.post("/login")
def login(req: LoginRequest, request: Request):
    limits.check_rate("login:" + limits.client_ip(request))
    row = repo.get_user_by_email(req.email)
    if row is None or not row["active"] or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(401, "Wrong email or password.")
    repo.update_user(row["id"], last_login_at=now_iso())
    user = User(row["id"], row["email"], row["name"], row["role"])
    return {"token": make_token(user), "user": user.as_dict()}


@router.get("/me")
def me(user: User = Depends(require(*ROLES))):
    return user.as_dict()


@router.get("/users")
def users(_: User = Depends(require("admin"))):
    return repo.list_users()


@router.post("/users")
def add_user(req: NewUserRequest, _: User = Depends(require("admin"))):
    if repo.get_user_by_email(req.email):
        raise HTTPException(409, "An account with this email already exists.")
    uid = repo.add_user(req.email, req.name, req.role, hash_password(req.password))
    return repo.public_user(repo.get_user(uid))


@router.patch("/users/{user_id}")
def update_user(user_id: int, req: UpdateUserRequest, admin: User = Depends(require("admin"))):
    if repo.get_user(user_id) is None:
        raise HTTPException(404, "No such account.")
    if user_id == admin.id and (req.role not in (None, "admin") or req.active is False):
        raise HTTPException(400, "You cannot remove your own admin access.")
    repo.update_user(
        user_id,
        name=req.name,
        role=req.role,
        active=req.active,
        password_hash=hash_password(req.password) if req.password else None,
    )
    return repo.public_user(repo.get_user(user_id))
