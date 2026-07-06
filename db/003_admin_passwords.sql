-- Add per-admin password hashes for existing D1 databases.
-- D1/SQLite does not support IF NOT EXISTS for ADD COLUMN on all versions,
-- so run this only once on databases created before these columns existed.

ALTER TABLE admin_users ADD COLUMN password_hash TEXT;
ALTER TABLE admin_users ADD COLUMN password_salt TEXT;
ALTER TABLE admin_users ADD COLUMN whatsapp_number TEXT;
ALTER TABLE admin_users ADD COLUMN email_alert_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE admin_users ADD COLUMN whatsapp_alert_enabled INTEGER NOT NULL DEFAULT 1;

UPDATE admin_users
SET password_salt = '7174f92079ac67cf85fa29132122a42b',
    password_hash = 'f9538e7d682ddfb75b468e829d96a7f38f03cb14e3fa7cf550bb21f22ebe3067',
    whatsapp_number = '+13685992299',
    email_alert_enabled = 1,
    whatsapp_alert_enabled = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'ratheesh.ramadasan@gmail.com';

UPDATE admin_users
SET password_salt = 'e57f687a4e2b447c694b68a4ca8d2d83',
    password_hash = 'c60931b8a6a9cb438bb612efc8b2f20ac702bd3004020a706ed6d39d7d2a3a08',
    whatsapp_number = '+14034814101',
    email_alert_enabled = 1,
    whatsapp_alert_enabled = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'lachureshmi6@gmail.com';
