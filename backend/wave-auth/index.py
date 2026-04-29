"""
Аутентификация пользователей 19 wave: регистрация и вход по номеру телефона + пароль.
"""
import json
import os
import hashlib
import psycopg2

SCHEMA = "t_p45740175_quantum_leap_initiat"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Session-Id",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    body = json.loads(event.get("body") or "{}")

    conn = get_conn()
    cur = conn.cursor()

    try:
        # POST /register
        if method == "POST" and path.endswith("/register"):
            name = body.get("name", "").strip()
            username = body.get("username", "").strip().lower()
            phone = body.get("phone", "").strip()
            password = body.get("password", "").strip()
            avatar = body.get("avatar")

            if not name or not username or not phone or not password:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Заполните все поля"})}

            if len(password) < 6:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Пароль минимум 6 символов"})}

            if not username.startswith("@") or not username[1:].isalpha() or not username[1:].islower():
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Юзернейм должен начинаться с @ и содержать только строчные английские буквы"})}

            cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE username = %s OR phone = %s", (username, phone))
            if cur.fetchone():
                return {"statusCode": 409, "headers": CORS, "body": json.dumps({"error": "Юзернейм или телефон уже заняты"})}

            is_admin = phone == "+79270333319"
            rainbow_nick = phone == "+79270333319"
            pw_hash = hash_password(password)

            cur.execute(
                f"INSERT INTO {SCHEMA}.users (name, username, phone, avatar, is_admin, rainbow_nick, online, password_hash) VALUES (%s, %s, %s, %s, %s, %s, TRUE, %s) RETURNING id, name, username, phone, avatar, bio, is_admin, rainbow_nick, banned, online",
                (name, username, phone, avatar, is_admin, rainbow_nick, pw_hash)
            )
            row = cur.fetchone()
            conn.commit()
            user = _row_to_user(row, [])
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"user": user})}

        # POST /login
        if method == "POST" and path.endswith("/login"):
            phone = body.get("phone", "").strip()
            password = body.get("password", "").strip()

            cur.execute(
                f"SELECT id, name, username, phone, avatar, bio, is_admin, rainbow_nick, banned, online, password_hash FROM {SCHEMA}.users WHERE phone = %s",
                (phone,)
            )
            row = cur.fetchone()
            if not row:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Пользователь не найден"})}
            if row[8]:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Аккаунт заблокирован"})}

            stored_hash = row[10]
            if stored_hash and hash_password(password) != stored_hash:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Неверный пароль"})}

            uid = row[0]
            cur.execute(f"UPDATE {SCHEMA}.users SET online = TRUE WHERE id = %s", (uid,))

            cur.execute(
                f"SELECT b.id, b.label, b.color FROM {SCHEMA}.badges b JOIN {SCHEMA}.user_badges ub ON b.id = ub.badge_id WHERE ub.user_id = %s",
                (uid,)
            )
            badges = [{"id": r[0], "label": r[1], "color": r[2]} for r in cur.fetchall()]
            conn.commit()
            user = _row_to_user(row, badges)
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"user": user})}

        # POST /logout
        if method == "POST" and path.endswith("/logout"):
            uid = body.get("userId")
            if uid:
                cur.execute(f"UPDATE {SCHEMA}.users SET online = FALSE, last_seen = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = %s", (uid,))
                conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}

    finally:
        cur.close()
        conn.close()


def _row_to_user(row, badges):
    return {
        "id": row[0],
        "name": row[1],
        "username": row[2],
        "phone": row[3],
        "avatar": row[4],
        "bio": row[5] or "",
        "isAdmin": row[6],
        "rainbowNick": row[7],
        "banned": row[8],
        "online": row[9],
        "badges": badges,
    }
