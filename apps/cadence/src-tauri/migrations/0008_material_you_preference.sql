-- Adds the Material You dynamic-colour preference (SCREENS.md P-68), defaulting on since the feature is purely additive where it's supported and a no-op everywhere else.

ALTER TABLE app_settings ADD COLUMN use_material_you INTEGER NOT NULL DEFAULT 1 CHECK (use_material_you IN (0,1));
