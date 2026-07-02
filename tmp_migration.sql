CREATE TABLE IF NOT EXISTS sent_posts (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  image_url TEXT,
  type TEXT NOT NULL,
  channel TEXT NOT NULL,
  sent_to INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
