"""Smoke test of the session / rate-limit / header protections through the gateway.

Run inside the auth container:  python tools/security_smoke.py
Creates a throwaway session for an existing active account (nothing else is
changed) and revokes it at the end.
"""
import os
import sys
import uuid

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth import create_token, start_session, end_session, SESSION_IDLE_MINUTES  # noqa: E402
from database import _connect  # noqa: E402

GW = os.getenv("GATEWAY", "http://gateway:8000")


def main():
    db = _connect()
    u = db.execute("SELECT id, role FROM users WHERE is_active=1 ORDER BY id LIMIT 1").fetchone()
    sid = start_session(db, u["id"], u["role"], "smoke-test", "security_smoke")
    db.commit()
    h = {"Authorization": f"Bearer {create_token(u['id'], u['role'], sid)}"}
    c = httpx.Client(base_url=GW, timeout=15)

    r = c.get("/api/auth/me", headers=h)
    print("1. live session /me:", r.status_code, "| idle minutes:", r.json().get("idle_timeout_minutes"))
    print("   headers:", {k: r.headers.get(k) for k in ("x-content-type-options", "x-frame-options", "cache-control", "referrer-policy")})

    r = c.post("/api/auth/heartbeat", headers=h)
    print("2. heartbeat:", r.status_code)

    # Pretend the session has been idle past the limit + grace.
    db.execute(f"UPDATE auth_session SET last_active_at = CURRENT_TIMESTAMP - INTERVAL '{SESSION_IDLE_MINUTES + 6} minutes' WHERE id=?", (sid,))
    db.commit()
    r = c.get("/api/auth/me", headers=h)
    print("3. idle session /me:", r.status_code, r.json().get("detail"))

    db.execute("UPDATE auth_session SET last_active_at = CURRENT_TIMESTAMP WHERE id=?", (sid,))
    db.commit()
    r = c.post("/api/auth/logout", headers=h)
    print("4. logout:", r.status_code)
    r = c.get("/api/auth/me", headers=h)
    print("   after logout /me:", r.status_code, r.json().get("detail"))

    from jose import jwt
    from auth import SECRET_KEY, ALGORITHM
    legacy = jwt.encode({"sub": str(u["id"]), "role": u["role"], "exp": 4102444800}, SECRET_KEY, algorithm=ALGORITHM)
    r = c.get("/api/auth/me", headers={"Authorization": f"Bearer {legacy}"})
    print("5. token without a session:", r.status_code, r.json().get("detail"))

    codes = []
    for _ in range(25):
        codes.append(c.post("/api/auth/login", json={"username": f"nobody-{uuid.uuid4().hex[:8]}", "password": "x"}).status_code)
    print("6. 25 sign-ins in a row:", codes.count(401), "x 401 then", codes.count(429), "x 429")

    big = c.post("/api/tasks", headers=h, content=bytes(26 * 1024 * 1024))
    print("7. 26 MB request:", big.status_code, big.json().get("detail"))

    end_session(db, sid)
    db.commit()
    db.close()


if __name__ == "__main__":
    main()
