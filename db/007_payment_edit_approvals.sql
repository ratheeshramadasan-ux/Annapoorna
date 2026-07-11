CREATE TABLE IF NOT EXISTS payment_edit_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER NOT NULL,
  requested_by_admin_id INTEGER NOT NULL,
  approved_by_admin_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_payload TEXT NOT NULL,
  review_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (requested_by_admin_id) REFERENCES admin_users(id),
  FOREIGN KEY (approved_by_admin_id) REFERENCES admin_users(id)
);

INSERT OR IGNORE INTO app_settings
  (key, value, value_type, category, description, is_public)
VALUES
  ('payment_edit_second_admin_approval_enabled', 'false', 'boolean', 'payments', 'Require a second admin to approve payment edits', 0);
