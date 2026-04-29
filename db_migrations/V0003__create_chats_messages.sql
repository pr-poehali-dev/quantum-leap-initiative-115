CREATE TABLE t_p45740175_quantum_leap_initiat.chats (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type TEXT NOT NULL DEFAULT 'direct',
  name TEXT,
  description TEXT DEFAULT '',
  avatar TEXT,
  owner_id TEXT,
  is_channel BOOLEAN DEFAULT FALSE,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE TABLE t_p45740175_quantum_leap_initiat.chat_members (
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE t_p45740175_quantum_leap_initiat.messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id TEXT NOT NULL,
  from_id TEXT NOT NULL,
  text TEXT DEFAULT '',
  image TEXT,
  audio TEXT,
  timestamp BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE INDEX idx_messages_chat_id ON t_p45740175_quantum_leap_initiat.messages(chat_id);
CREATE INDEX idx_messages_timestamp ON t_p45740175_quantum_leap_initiat.messages(timestamp);
CREATE INDEX idx_chat_members_user ON t_p45740175_quantum_leap_initiat.chat_members(user_id);