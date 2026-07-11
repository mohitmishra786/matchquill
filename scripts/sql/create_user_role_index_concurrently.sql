-- Production-safe index creation (outside a transaction).
-- Usage: psql "$DATABASE_URL" -f scripts/sql/create_user_role_index_concurrently.sql
-- Must not be wrapped in BEGIN/COMMIT.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_role_idx" ON "User"("role");
