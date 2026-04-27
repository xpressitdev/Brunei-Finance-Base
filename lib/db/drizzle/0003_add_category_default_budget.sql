ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "default_budget" numeric(12, 2) DEFAULT '0' NOT NULL;
