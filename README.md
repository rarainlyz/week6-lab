# week6-lab

## MovieHub admin backoffice

The MovieHub server serves the admin dashboard at `/admin/dashboard`, movie management at `/admin/movies`, and member management at `/admin/members`. Sign in with an admin account to view dashboard statistics, create/edit/delete movies, search members, and change other members' roles. API routes under `/api/admin` require a valid admin JWT; hiding pages or controls in the browser is not the security boundary.

For a fresh database, initialize it with `moviehub/schema.sql` before starting the server. For an existing database, run `moviehub/migrations/001_member_timestamps.sql`, `moviehub/migrations/002_admin_movies.sql`, and `moviehub/migrations/003_enable_rls.sql` once. RLS intentionally has no end-user policies: the Go server must connect with a trusted database role that owns the tables or bypasses RLS; the Supabase Data API roles cannot access these tables directly.

Promote the first administrator directly in PostgreSQL after registering an account:

```sql
UPDATE members SET role = 'admin' WHERE lower(email) = lower('admin@example.com');
```

Sign in again after changing a role so the new role is included in the JWT.

## API routes

Public routes:

- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/genres`, `GET /api/movies?q=...`, `GET /api/movies/{id}`, `GET /api/movies/{id}/reviews`

Routes requiring a valid bearer token:

- `GET /api/me`
- `POST /api/movies/{id}/reviews`
- `DELETE /api/reviews/{reviewId}` (review owner or admin)
- `PUT /api/movies/{id}/vote`, `DELETE /api/movies/{id}/vote`
- `GET /api/me/wishlist`, `PUT /api/me/wishlist/{movieId}`, `DELETE /api/me/wishlist/{movieId}`

Admin-only routes:

- `GET /api/admin/stats`, `GET /api/admin/members`, `PUT /api/admin/members/{id}/role`
- `GET /api/admin/movies/{id}`, `POST /api/admin/movies/{id}`, `PUT /api/admin/movies/{id}`, `DELETE /api/admin/movies/{id}`
- `POST /api/admin/movies` is also supported for creating a movie with an optional ID in the JSON body.

Run locally from `moviehub/` with `DATABASE_URL` and a `JWT_SECRET` of at least 32 characters set in the environment, then run `go run .`. The server listens on `PORT` or `8080` by default. For a local PostgreSQL instance, load `schema.sql` and optionally `seed.sql` first.