"""
Управление пользователями 19 wave: список, профиль, обновление, админ-действия.
"""
import json
import os
import psycopg2

SCHEMA = "t_p45740175_quantum_leap_initiat"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Session-Id",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    body = json.loads(event.get("body") or "{}")
    params = event.get("queryStringParameters") or {}

    conn = get_conn()
    cur = conn.cursor()

    try:
        # GET /list — все пользователи
        if method == "GET" and path.endswith("/list"):
            cur.execute(
                f"SELECT id, name, username, avatar, bio, is_admin, rainbow_nick, banned, online FROM {SCHEMA}.users ORDER BY online DESC, name"
            )
            rows = cur.fetchall()
            users = []
            for row in rows:
                uid = row[0]
                cur.execute(
                    f"SELECT b.id, b.label, b.color FROM {SCHEMA}.badges b JOIN {SCHEMA}.user_badges ub ON b.id = ub.badge_id WHERE ub.user_id = %s",
                    (uid,)
                )
                badges = [{"id": r[0], "label": r[1], "color": r[2]} for r in cur.fetchall()]
                users.append({
                    "id": row[0], "name": row[1], "username": row[2],
                    "avatar": row[3], "bio": row[4] or "", "isAdmin": row[5],
                    "rainbowNick": row[6], "banned": row[7], "online": row[8],
                    "badges": badges
                })
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"users": users})}

        # GET /badges — все доступные бейджи
        if method == "GET" and path.endswith("/badges"):
            cur.execute(f"SELECT id, label, color FROM {SCHEMA}.badges")
            badges = [{"id": r[0], "label": r[1], "color": r[2]} for r in cur.fetchall()]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"badges": badges})}

        # PUT /update — обновить профиль
        if method == "PUT" and path.endswith("/update"):
            uid = body.get("userId")
            name = body.get("name", "").strip()
            bio = body.get("bio", "").strip()
            avatar = body.get("avatar")
            if not uid or not name:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "userId и name обязательны"})}
            cur.execute(
                f"UPDATE {SCHEMA}.users SET name = %s, bio = %s, avatar = %s WHERE id = %s",
                (name, bio, avatar, uid)
            )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # POST /admin/ban — бан/разбан
        if method == "POST" and path.endswith("/admin/ban"):
            target_id = body.get("targetId")
            cur.execute(f"UPDATE {SCHEMA}.users SET banned = NOT banned WHERE id = %s RETURNING banned", (target_id,))
            row = cur.fetchone()
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"banned": row[0] if row else False})}

        # POST /admin/rainbow — радужный ник
        if method == "POST" and path.endswith("/admin/rainbow"):
            target_id = body.get("targetId")
            cur.execute(f"UPDATE {SCHEMA}.users SET rainbow_nick = NOT rainbow_nick WHERE id = %s RETURNING rainbow_nick", (target_id,))
            row = cur.fetchone()
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"rainbowNick": row[0] if row else False})}

        # POST /admin/badge — выдать/забрать бейдж
        if method == "POST" and path.endswith("/admin/badge"):
            target_id = body.get("targetId")
            badge_id = body.get("badgeId")
            action = body.get("action", "toggle")
            cur.execute(f"SELECT 1 FROM {SCHEMA}.user_badges WHERE user_id = %s AND badge_id = %s", (target_id, badge_id))
            has = cur.fetchone() is not None
            if has:
                cur.execute(f"UPDATE {SCHEMA}.user_badges SET user_id = user_id WHERE user_id = %s AND badge_id = %s", (target_id, badge_id))
                cur.execute(f"DELETE FROM {SCHEMA}.user_badges WHERE user_id = %s AND badge_id = %s", (target_id, badge_id))
                given = False
            else:
                cur.execute(f"INSERT INTO {SCHEMA}.user_badges (user_id, badge_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (target_id, badge_id))
                given = True
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"given": given})}

        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}

    finally:
        cur.close()
        conn.close()