import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

ROLE_LEVEL = {"viewer": 1, "analyst": 2, "responder": 3, "admin": 4}


@dataclass(frozen=True)
class User:
    username: str
    role: str


def password_hash(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 310_000).hex()


def authenticate(username: str, password: str) -> User:
    try:
        users = json.loads(os.environ.get("ONEHEALTH_AUTH_USERS", "[]"))
    except json.JSONDecodeError as exc:
        raise HTTPException(503, "Authentication configuration is invalid") from exc
    for item in users:
        if item.get("username") == username and item.get("role") in ROLE_LEVEL:
            expected = str(item.get("password_hash", ""))
            if hmac.compare_digest(password_hash(password, str(item.get("salt", ""))), expected):
                return User(username, item["role"])
    raise HTTPException(401, "Invalid username or password")


def _secret() -> bytes:
    value = os.environ.get("ONEHEALTH_AUTH_SECRET", "")
    if len(value) < 32:
        raise HTTPException(503, "ONEHEALTH_AUTH_SECRET must contain at least 32 characters")
    return value.encode()


def issue_token(user: User) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({"sub": user.username, "role": user.role, "exp": int(time.time()) + 28_800}, separators=(",", ":")).encode()).decode().rstrip("=")
    signature = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def require_role(credentials: HTTPAuthorizationCredentials | None, minimum: str) -> User:
    if credentials is None:
        raise HTTPException(401, "Authentication required")
    try:
        payload, signature = credentials.credentials.rsplit(".", 1)
        expected = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if int(data["exp"]) < time.time() or data["role"] not in ROLE_LEVEL:
            raise ValueError
        user = User(str(data["sub"]), str(data["role"]))
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise HTTPException(401, "Invalid or expired session") from None
    if ROLE_LEVEL[user.role] < ROLE_LEVEL[minimum]:
        raise HTTPException(403, f"{minimum.title()} role required")
    return user
