ALTER TABLE reviews ADD COLUMN source TEXT NOT NULL DEFAULT 'portal';
ALTER TABLE reviews ADD COLUMN external_review_id TEXT;
ALTER TABLE reviews ADD COLUMN external_review_url TEXT;
ALTER TABLE reviews ADD COLUMN reviewer_avatar_url TEXT;
ALTER TABLE reviews ADD COLUMN google_create_time TEXT;
ALTER TABLE reviews ADD COLUMN google_update_time TEXT;
ALTER TABLE reviews ADD COLUMN google_reply TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_external_source
ON reviews(source, external_review_id)
WHERE external_review_id IS NOT NULL;

INSERT OR IGNORE INTO app_settings
  (key, value, value_type, category, description, is_public)
VALUES
  ('google_reviews_sync_enabled', 'false', 'boolean', 'reviews', 'Enable Google Business Profile review sync', 0),
  ('google_account_id', '', 'string', 'reviews', 'Google Business Profile account ID', 0),
  ('google_location_id', '', 'string', 'reviews', 'Google Business Profile location ID', 0),
  ('google_reviews_last_sync_at', '', 'string', 'reviews', 'Last Google review sync time', 0),
  ('google_reviews_last_sync_status', '', 'string', 'reviews', 'Last Google review sync status', 0);
