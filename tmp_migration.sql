CREATE TABLE IF NOT EXISTS advertising_posts (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  link_url TEXT,
  link_label TEXT,
  image_urls TEXT DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
