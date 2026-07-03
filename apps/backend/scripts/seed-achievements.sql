-- Seed achievements for Geotano
-- Run this in the Neon SQL console (safe to re-run)
-- ============================================================

INSERT INTO "achievements" ("slug", "name_en", "name_es", "description_en", "description_es", "icon", "category", "tier", "sort_order")
VALUES
  -- Gameplay
  ('first_game',    'First Game',        'Primera Partida',       'Complete your first quiz game',            'Completá tu primera partida',                '🎮', 'gameplay', NULL,  1),
  ('games_10',      'Getting Started',   'Empezando',             'Complete 10 games',                        'Completá 10 partidas',                       '🎮', 'gameplay', 1,     2),
  ('games_50',      'Dedicated Player',  'Jugador Dedicado',      'Complete 50 games',                        'Completá 50 partidas',                       '🎮', 'gameplay', 2,     3),
  ('games_100',     'Geography Master',  'Maestro de Geografía',  'Complete 100 games',                       'Completá 100 partidas',                      '🎮', 'gameplay', 3,     4),
  ('streak_3',      'On a Roll',         'Racha',                 'Get a 3-answer streak',                    'Conseguí una racha de 3',                    '🔥', 'gameplay', 1,     5),
  ('streak_5',      'On Fire',           'En llamas',             'Get a 5-answer streak',                    'Conseguí una racha de 5',                    '🔥', 'gameplay', 2,     6),
  ('streak_10',     'Unstoppable',       'Imparable',             'Get a 10-answer streak',                   'Conseguí una racha de 10',                   '🔥', 'gameplay', 3,     7),
  ('perfect_game',  'Perfect Game',      'Partida Perfecta',      'Answer every question correctly in a game', 'Respondé bien todas las preguntas de una partida', '💯', 'gameplay', NULL, 8),
  -- Social
  ('first_friend',  'First Friend',      'Primer Amigo',          'Add your first friend',                    'Agregá tu primer amigo',                     '👥', 'social',   1,     9),
  ('friends_5',     'Social Butterfly',  'Mariposa Social',       'Add 5 friends',                            'Agregá 5 amigos',                            '👥', 'social',   2,     10),
  ('friends_20',    'Popular',           'Popular',               'Add 20 friends',                           'Agregá 20 amigos',                           '👥', 'social',   3,     11),
  -- Mastery
  ('score_10k',     'Score Collector',   'Coleccionista de Puntos','Reach 10,000 total score',                 'Alcanzá 10,000 puntos totales',              '🏆', 'mastery',  1,     12),
  ('score_50k',     'High Scorer',       'Puntuador Alto',        'Reach 50,000 total score',                 'Alcanzá 50,000 puntos totales',              '🏆', 'mastery',  2,     13),
  ('score_100k',    'Legendary',         'Leyenda',               'Reach 100,000 total score',                'Alcanzá 100,000 puntos totales',             '🏆', 'mastery',  3,     14),
  ('all_modes',     'World Traveler',    'Viajero del Mundo',     'Play all game modes at least once',        'Jugá todos los modos de juego al menos una vez', '🌍', 'mastery', NULL, 15)
ON CONFLICT ("slug") DO NOTHING;
