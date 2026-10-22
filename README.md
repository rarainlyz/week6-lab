# week6-lab

## MovieHub member admin

The MovieHub server serves the member-management page at `/admin/members`. Sign in with an admin account to search members and change other members' roles; the page uses the existing `/api/admin/members` endpoints.

For a fresh database, initialize it with `moviehub/schema.sql` before starting the server. For an existing database, run `moviehub/migrations/001_member_timestamps.sql` once so the page can show each account's join date.