CREATE TABLE t_p45740175_quantum_leap_initiat.badges (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE t_p45740175_quantum_leap_initiat.user_badges (
  user_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  PRIMARY KEY (user_id, badge_id)
);

INSERT INTO t_p45740175_quantum_leap_initiat.badges (id, label, color) VALUES
  ('verified', '✓ Верифицирован', '#3ba55c'),
  ('og', '⭐ OG', '#faa61a'),
  ('dev', '🛠 Разработчик', '#5865f2'),
  ('top', '🔥 Топ пользователь', '#ed4245'),
  ('wave', '🌊 19 wave', '#6C63FF');