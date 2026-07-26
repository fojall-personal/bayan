-- Add the tajweed display categories that had no colour.
--
-- `tajweed_rules` held six categories, but the ingested annotations use 18 rule
-- names (see workers/src/lib/tajweed-colors.ts). Four categories referenced by
-- that mapping had no row, so ~13,000 of the 60,057 marks — every hamzat wasl,
-- lam shamsiyyah, silent letter and letter-to-letter idghaam — would have
-- rendered with no colour in the reader.
--
-- Colours avoid the six already in use (blue #3b82f6, green #22c55e,
-- cyan #06b6d4, amber #f59e0b, pink #ec4899, purple #8b5cf6).
--
-- INSERT OR IGNORE so this is a no-op if the rows already exist.

INSERT OR IGNORE INTO tajweed_rules (id, name, color, color_name) VALUES
  ('hamzat_wasl',    'Hamzat Wasl (هَمْزَة الوَصْل)',    '#94a3b8', 'slate'),
  ('lam_shamsiyyah', 'Lam Shamsiyyah (لام شمسية)',        '#14b8a6', 'teal'),
  ('silent',         'Silent (غير مَلْفُوظ)',              '#6b7280', 'gray'),
  ('idghaam',        'Idghaam (إدغام)',                    '#dc2626', 'red');
