-- Retires the demo/history-filler workouts seeded by 0002 now that a real "start a workout" flow
-- (create_workout, add_workout_exercise) exists to replace them — deleting them any earlier would
-- have left the app with no way to log anything at all. Cascades to their workout_exercises, sets,
-- and supersets via the schema's own ON DELETE CASCADE; categories, both barbell_configs, and the
-- starter exercise library (0003) are untouched.

DELETE FROM workouts WHERE id IN (
    'workout-push-a',
    'workout-push-b',
    'workout-priya-1',
    'workout-2026-09-05',
    'workout-2026-09-04',
    'workout-2026-09-02',
    'workout-2026-08-29',
    'workout-2026-08-27-hc',
    'workout-2026-08-27-strength',
    'workout-2026-08-19',
    'workout-2026-08-14',
    'workout-2026-08-07',
    'workout-2026-07-31',
    'workout-2026-07-10',
    'workout-2026-06-19',
    'workout-2026-09-12'
);
