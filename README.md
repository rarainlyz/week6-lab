# week6-lab

## MovieHub admin backoffice

The MovieHub server serves the admin dashboard at `/admin/dashboard`, movie management at `/admin/movies`, and member management at `/admin/members`. Sign in with an admin account to view dashboard statistics, create/edit/delete movies, search members, and change other members' roles. API routes under `/api/admin` require a valid admin JWT; hiding pages or controls in the browser is not the security boundary.

For a fresh database, initialize it with `moviehub/schema.sql` before starting the server. For an existing database, run `moviehub/migrations/001_member_timestamps.sql`, `moviehub/migrations/002_admin_movies.sql`, and `moviehub/migrations/003_enable_rls.sql` once. RLS intentionally has no end-user policies: the Go server must connect with a trusted database role that owns the tables or bypasses RLS; the Supabase Data API roles cannot access these tables directly.

Promote the first administrator directly in PostgreSQL after registering an account:

```sql
UPDATE members SET role = 'admin' WHERE lower(email) = lower('admin@example.com');
```

Sign in again after changing a role so the new role is included in the JWT.