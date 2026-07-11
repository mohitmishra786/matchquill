-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- AlterTable: add role with safe default for existing users
ALTER TABLE "User" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER';

-- Index for role-based queries.
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside Prisma's default transaction.
-- For production (zero-downtime), create the index first with:
--   psql $DATABASE_URL -f scripts/sql/create_user_role_index_concurrently.sql
-- Then run this migration (IF NOT EXISTS makes it safe if the index already exists).
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
