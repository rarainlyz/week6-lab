BEGIN;

INSERT INTO movies (id, title, title_th, release_date, vote_average, popularity, poster_path) VALUES
    (1423191, 'Resident Evil', 'เรสซิเดนท์ อีวิล', DATE '2026-01-01', 7.3, 100, '/i7UyjfPio0VFHB9rBUZSFyhOoM8.jpg'),
    (460458, 'Resident Evil: Welcome to Raccoon City', 'ผีชีวะ ปฐมบทแห่งเมืองผีดิบ', DATE '2022-01-01', 5.9, 90, '/bArhvjRHl535XMaSh9VjInF2mSZ.jpg')
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    title_th = EXCLUDED.title_th,
    release_date = EXCLUDED.release_date,
    vote_average = EXCLUDED.vote_average,
    popularity = EXCLUDED.popularity,
    poster_path = EXCLUDED.poster_path;

INSERT INTO movie_genres (movie_id, genre_id, position)
SELECT 1423191, id, 0 FROM genres WHERE name_en = 'Horror'
ON CONFLICT (movie_id, genre_id) DO UPDATE SET position = EXCLUDED.position;

INSERT INTO movie_genres (movie_id, genre_id, position)
SELECT 460458, id, 0 FROM genres WHERE name_en = 'Action'
ON CONFLICT (movie_id, genre_id) DO UPDATE SET position = EXCLUDED.position;

COMMIT;
