"""
Чаты 19 wave: список чатов, создание личных/групповых/каналов, сообщения, опрос новых.
"""
# psycopg2-binary required
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
        # GET /list?userId=... — список чатов пользователя
        if method == "GET" and path.endswith("/list"):
            uid = params.get("userId")
            if not uid:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "userId required"})}

            cur.execute(f"""
                SELECT c.id, c.type, c.name, c.description, c.avatar, c.owner_id, c.is_channel, c.created_at
                FROM {SCHEMA}.chats c
                JOIN {SCHEMA}.chat_members cm ON c.id = cm.chat_id
                WHERE cm.user_id = %s
                ORDER BY c.created_at DESC
            """, (uid,))
            chats_raw = cur.fetchall()
            chats = []
            for row in chats_raw:
                cid = row[0]
                # last message
                cur.execute(f"""
                    SELECT m.id, m.from_id, m.text, m.image, m.audio, m.timestamp,
                           u.name, u.username
                    FROM {SCHEMA}.messages m
                    JOIN {SCHEMA}.users u ON m.from_id = u.id
                    WHERE m.chat_id = %s ORDER BY m.timestamp DESC LIMIT 1
                """, (cid,))
                lm = cur.fetchone()
                last_msg = None
                if lm:
                    last_msg = {
                        "id": lm[0], "fromId": lm[1], "text": lm[2],
                        "image": lm[3], "audio": lm[4], "timestamp": lm[5],
                        "fromName": lm[6], "fromUsername": lm[7]
                    }
                # members
                cur.execute(f"""
                    SELECT u.id, u.name, u.username, u.avatar, u.online, u.rainbow_nick
                    FROM {SCHEMA}.users u
                    JOIN {SCHEMA}.chat_members cm ON u.id = cm.user_id
                    WHERE cm.chat_id = %s
                """, (cid,))
                members = [{"id": r[0], "name": r[1], "username": r[2], "avatar": r[3], "online": r[4], "rainbowNick": r[5]} for r in cur.fetchall()]

                # for direct chats, get partner info
                partner = None
                if row[1] == "direct":
                    for m in members:
                        if m["id"] != uid:
                            partner = m
                            break

                chats.append({
                    "id": cid, "type": row[1], "name": row[2], "description": row[3],
                    "avatar": row[4], "ownerId": row[5], "isChannel": row[6],
                    "createdAt": row[7], "lastMessage": last_msg,
                    "members": members, "partner": partner
                })

            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"chats": chats})}

        # POST /direct — создать или получить прямой чат
        if method == "POST" and path.endswith("/direct"):
            uid = body.get("userId")
            target_id = body.get("targetId")
            if not uid or not target_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "userId and targetId required"})}

            # check existing direct chat
            cur.execute(f"""
                SELECT c.id FROM {SCHEMA}.chats c
                JOIN {SCHEMA}.chat_members cm1 ON c.id = cm1.chat_id AND cm1.user_id = %s
                JOIN {SCHEMA}.chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id = %s
                WHERE c.type = 'direct'
                LIMIT 1
            """, (uid, target_id))
            row = cur.fetchone()
            if row:
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"chatId": row[0]})}

            cur.execute(f"INSERT INTO {SCHEMA}.chats (type) VALUES ('direct') RETURNING id")
            chat_id = cur.fetchone()[0]
            cur.execute(f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s, %s), (%s, %s)", (chat_id, uid, chat_id, target_id))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"chatId": chat_id})}

        # POST /group — создать группу или канал
        if method == "POST" and path.endswith("/group"):
            uid = body.get("userId")
            name = body.get("name", "").strip()
            is_channel = body.get("isChannel", False)
            description = body.get("description", "")
            member_ids = body.get("memberIds", [])

            if not uid or not name:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "userId and name required"})}

            chat_type = "channel" if is_channel else "group"
            cur.execute(
                f"INSERT INTO {SCHEMA}.chats (type, name, description, owner_id, is_channel) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (chat_type, name, description, uid, is_channel)
            )
            chat_id = cur.fetchone()[0]
            all_members = list(set([uid] + member_ids))
            for mid in all_members:
                cur.execute(f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (chat_id, mid))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"chatId": chat_id})}

        # GET /messages?chatId=...&since=...
        if method == "GET" and path.endswith("/messages"):
            chat_id = params.get("chatId")
            since = params.get("since", "0")
            if not chat_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "chatId required"})}

            cur.execute(f"""
                SELECT m.id, m.from_id, m.text, m.image, m.audio, m.timestamp,
                       u.name, u.username, u.avatar, u.rainbow_nick
                FROM {SCHEMA}.messages m
                JOIN {SCHEMA}.users u ON m.from_id = u.id
                WHERE m.chat_id = %s AND m.timestamp > %s
                ORDER BY m.timestamp ASC
                LIMIT 100
            """, (chat_id, int(since)))
            msgs = []
            for r in cur.fetchall():
                msgs.append({
                    "id": r[0], "fromId": r[1], "text": r[2], "image": r[3],
                    "audio": r[4], "timestamp": r[5],
                    "fromName": r[6], "fromUsername": r[7], "fromAvatar": r[8],
                    "fromRainbow": r[9]
                })
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"messages": msgs})}

        # POST /messages — отправить сообщение
        if method == "POST" and path.endswith("/messages"):
            chat_id = body.get("chatId")
            from_id = body.get("fromId")
            text = body.get("text", "")
            image = body.get("image")
            audio = body.get("audio")

            if not chat_id or not from_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "chatId and fromId required"})}

            cur.execute(
                f"INSERT INTO {SCHEMA}.messages (chat_id, from_id, text, image, audio) VALUES (%s, %s, %s, %s, %s) RETURNING id, timestamp",
                (chat_id, from_id, text, image, audio)
            )
            row = cur.fetchone()
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"id": row[0], "timestamp": row[1]})}

        # GET /admin/messages?chatId=... — просмотр чата для админа
        if method == "GET" and path.endswith("/admin/messages"):
            chat_id = params.get("chatId")
            cur.execute(f"""
                SELECT m.id, m.from_id, m.text, m.image, m.audio, m.timestamp, u.name
                FROM {SCHEMA}.messages m
                JOIN {SCHEMA}.users u ON m.from_id = u.id
                WHERE m.chat_id = %s
                ORDER BY m.timestamp ASC LIMIT 100
            """, (chat_id,))
            msgs = [{"id": r[0], "fromId": r[1], "text": r[2], "image": r[3], "audio": r[4], "timestamp": r[5], "fromName": r[6]} for r in cur.fetchall()]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"messages": msgs})}

        # POST /join — вступить в группу/канал
        if method == "POST" and path.endswith("/join"):
            uid = body.get("userId")
            chat_id = body.get("chatId")
            cur.execute(f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (chat_id, uid))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # GET /public — публичные группы и каналы
        if method == "GET" and path.endswith("/public"):
            uid = params.get("userId")
            cur.execute(f"""
                SELECT c.id, c.type, c.name, c.description, c.avatar, c.is_channel, c.created_at,
                       COUNT(cm.user_id) as members_count
                FROM {SCHEMA}.chats c
                JOIN {SCHEMA}.chat_members cm ON c.id = cm.chat_id
                WHERE c.type IN ('group', 'channel')
                GROUP BY c.id
                ORDER BY members_count DESC
            """)
            chats = []
            for r in cur.fetchall():
                is_member = False
                if uid:
                    cur.execute(f"SELECT 1 FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s", (r[0], uid))
                    is_member = cur.fetchone() is not None
                chats.append({
                    "id": r[0], "type": r[1], "name": r[2], "description": r[3],
                    "avatar": r[4], "isChannel": r[5], "createdAt": r[6],
                    "membersCount": r[7], "isMember": is_member
                })
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"chats": chats})}

        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}

    finally:
        cur.close()
        conn.close()