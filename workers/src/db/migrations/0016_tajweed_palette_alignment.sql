-- Align the tajweed rule colours with the design palette.
--
-- globals.css says the tajweed colours were "retuned for the green ground" and
-- names the two specific problems it fixed: "the old noon-saakin green (#22c55e)
-- was the ground colour, and the old qalqalah amber was the gold accent". The
-- retuning happened in the CSS tokens. It never reached this table — and this
-- table is what the reader actually renders, via an inline style. So the reader
-- has been painting the pre-rebrand palette the whole time.
--
-- Measured against the canvas #071411, nine of the ten rendered colours were
-- absent from the palette and three failed the 4.5:1 minimum outright:
--
--     makharij  #8b5cf6 at 4.44:1
--     idghaam   #dc2626 at 3.89:1
--     silent    #6b7280 at 3.89:1
--
-- Six rules had tokens to align to. Four did not — lam_shamsiyyah, idghaam,
-- hamzat_wasl and silent — because the renderer classifies ten categories while
-- the palette defined six. Those four were chosen against numbers rather than by
-- eye: each is >= 4.5:1 on canvas, >= 25 CIE76 from every other rule colour so
-- the colour-coding actually distinguishes rules, and >= 22 from gold-500 and
-- leaf-500 so no rule can be mistaken for the accent or for progress.
--
-- "silent" is deliberately ground-400 rather than a new hue: a letter that is not
-- pronounced should read as de-emphasised text, not as another colour competing
-- for attention.
--
-- Keep this in step with --tajweed-* in src/app/styles/globals.css.

UPDATE tajweed_rules SET color = '#6ba8f5' WHERE id = 'madd';           -- was #3b82f6   7.6:1
UPDATE tajweed_rules SET color = '#7fd8c0' WHERE id = 'noon_saakin';    -- was #22c55e  11.2:1
UPDATE tajweed_rules SET color = '#5fd1e8' WHERE id = 'meem_saakin';    -- was #06b6d4  10.5:1
UPDATE tajweed_rules SET color = '#f58c5c' WHERE id = 'qalqalah';       -- was #f59e0b   7.9:1
UPDATE tajweed_rules SET color = '#f58bc0' WHERE id = 'ghunnah';        -- was #ec4899   8.4:1
UPDATE tajweed_rules SET color = '#b99bf0' WHERE id = 'makharij';       -- was #8b5cf6   8.1:1  (was failing)
UPDATE tajweed_rules SET color = '#b6d96a' WHERE id = 'lam_shamsiyyah'; -- was #14b8a6  11.7:1
UPDATE tajweed_rules SET color = '#f58a8a' WHERE id = 'idghaam';        -- was #dc2626   8.0:1  (was failing)
UPDATE tajweed_rules SET color = '#9fb3c8' WHERE id = 'hamzat_wasl';    -- was #94a3b8   8.7:1
UPDATE tajweed_rules SET color = '#8b8471' WHERE id = 'silent';         -- was #6b7280   5.0:1  (was failing)
