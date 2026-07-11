ALTER TABLE menu_items ADD COLUMN icon_text TEXT;

INSERT OR IGNORE INTO app_settings
  (key, value, value_type, category, description, is_public)
VALUES
  ('brand_font_family', 'aptos', 'string', 'branding', 'Primary website font family', 1),
  ('brand_display_font', 'cambria', 'string', 'branding', 'Display heading font family', 1),
  ('brand_font_scale', '100', 'number', 'branding', 'Global font scale percentage', 1),
  ('brand_background_theme', 'cream_gold', 'string', 'branding', 'Website background theme', 1),
  ('brand_background_image_url', '', 'string', 'branding', 'Optional background image URL', 1),
  ('brand_icon_url', '/assets/brand-mark.jpg', 'string', 'branding', 'Brand icon image URL', 1);
