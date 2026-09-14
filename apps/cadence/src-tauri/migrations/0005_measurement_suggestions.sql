-- Built-in measurement-definition suggestions (SPEC.md 8.8: "bodyweight, body-fat percentage, and
-- common circumferences, but all definitions remain editable"). Shipped archived (disabled) by
-- default, matching the plan's "editable, not always on" reading of SPEC — a fresh install should
-- not force these into a new user's enabled list, only offer them ready to switch on.

INSERT INTO measurement_definitions (id, name, unit, sort_order, archived, created_at_ms, updated_at_ms, revision) VALUES ('bodyweight', 'Bodyweight', 'kg', 0, 1, CAST(strftime('%s', '2026-06-01T00:00:00') AS INTEGER) * 1000, CAST(strftime('%s', '2026-06-01T00:00:00') AS INTEGER) * 1000, 1);
INSERT INTO measurement_definitions (id, name, unit, sort_order, archived, created_at_ms, updated_at_ms, revision) VALUES ('body-fat', 'Body fat', '%', 1, 1, CAST(strftime('%s', '2026-06-01T00:00:00') AS INTEGER) * 1000, CAST(strftime('%s', '2026-06-01T00:00:00') AS INTEGER) * 1000, 1);
INSERT INTO measurement_definitions (id, name, unit, sort_order, archived, created_at_ms, updated_at_ms, revision) VALUES ('waist', 'Waist', 'cm', 2, 1, CAST(strftime('%s', '2026-06-01T00:00:00') AS INTEGER) * 1000, CAST(strftime('%s', '2026-06-01T00:00:00') AS INTEGER) * 1000, 1);
INSERT INTO measurement_definitions (id, name, unit, sort_order, archived, created_at_ms, updated_at_ms, revision) VALUES ('hips', 'Hips', 'cm', 3, 1, CAST(strftime('%s', '2026-06-01T00:00:00') AS INTEGER) * 1000, CAST(strftime('%s', '2026-06-01T00:00:00') AS INTEGER) * 1000, 1);
INSERT INTO measurement_definitions (id, name, unit, sort_order, archived, created_at_ms, updated_at_ms, revision) VALUES ('chest-circumference', 'Chest', 'cm', 4, 1, CAST(strftime('%s', '2026-06-01T00:00:00') AS INTEGER) * 1000, CAST(strftime('%s', '2026-06-01T00:00:00') AS INTEGER) * 1000, 1);
INSERT INTO measurement_definitions (id, name, unit, sort_order, archived, created_at_ms, updated_at_ms, revision) VALUES ('bicep', 'Bicep', 'cm', 5, 1, CAST(strftime('%s', '2026-06-01T00:00:00') AS INTEGER) * 1000, CAST(strftime('%s', '2026-06-01T00:00:00') AS INTEGER) * 1000, 1);
INSERT INTO measurement_definitions (id, name, unit, sort_order, archived, created_at_ms, updated_at_ms, revision) VALUES ('thigh', 'Thigh', 'cm', 6, 1, CAST(strftime('%s', '2026-06-01T00:00:00') AS INTEGER) * 1000, CAST(strftime('%s', '2026-06-01T00:00:00') AS INTEGER) * 1000, 1);
