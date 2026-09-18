import { hash } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { getDb } from "../src/db";
import { commissionSettings, staff } from "../src/db/schema";
import { DEFAULT_SETTINGS } from "../src/lib/business";

async function ensureFeatureSchema() {
  const db = getDb();

  // Repair schema drift for databases that were created before the later
  // feature migrations were added to the repository.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "commission_settings" (
      "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
      "booking_portion_bps" integer DEFAULT 5000 NOT NULL,
      "wedding_portion_bps" integer DEFAULT 5000 NOT NULL,
      "pre_wedding_bps" integer DEFAULT 300 NOT NULL,
      "rental_bps" integer DEFAULT 600 NOT NULL,
      "makeup_bps" integer DEFAULT 0 NOT NULL,
      "monthly_target_sen" integer DEFAULT 3000000 NOT NULL,
      "monthly_reward_sen" integer DEFAULT 30000 NOT NULL,
      "updated_by" uuid,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    ALTER TABLE "commission_settings"
      ADD COLUMN IF NOT EXISTS "booking_portion_bps" integer DEFAULT 5000 NOT NULL,
      ADD COLUMN IF NOT EXISTS "wedding_portion_bps" integer DEFAULT 5000 NOT NULL,
      ADD COLUMN IF NOT EXISTS "pre_wedding_bps" integer DEFAULT 300 NOT NULL,
      ADD COLUMN IF NOT EXISTS "rental_bps" integer DEFAULT 600 NOT NULL,
      ADD COLUMN IF NOT EXISTS "makeup_bps" integer DEFAULT 0 NOT NULL,
      ADD COLUMN IF NOT EXISTS "monthly_target_sen" integer DEFAULT 3000000 NOT NULL,
      ADD COLUMN IF NOT EXISTS "monthly_reward_sen" integer DEFAULT 30000 NOT NULL,
      ADD COLUMN IF NOT EXISTS "updated_by" uuid,
      ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  `);

  await db.execute(sql`
    ALTER TABLE "collections"
      ADD COLUMN IF NOT EXISTS "booking_date" date,
      ADD COLUMN IF NOT EXISTS "wedding_pickup_date" date,
      ADD COLUMN IF NOT EXISTS "bookit_payment_id" text,
      ADD COLUMN IF NOT EXISTS "bookit_booking_id" text
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "collections_bookit_payment_unique"
      ON "collections" ("bookit_payment_id")
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "collections_bookit_booking_idx"
      ON "collections" ("bookit_booking_id")
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "commission_portions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "collection_id" uuid NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
      "staff_id" uuid NOT NULL REFERENCES "staff"("id"),
      "portion" integer NOT NULL,
      "release_month" text NOT NULL,
      "amount_sen" integer NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "commission_portion_valid" CHECK ("portion" IN (1, 2) AND "amount_sen" >= 0)
    )
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "commission_portion_unique"
      ON "commission_portions" ("collection_id", "staff_id", "portion")
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "commission_portion_month_idx"
      ON "commission_portions" ("release_month")
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "commission_portion_staff_idx"
      ON "commission_portions" ("staff_id")
  `);

  // Backfill the two commission portions for historical allocations. The
  // unique index makes this safe to run on every deployment.
  await db.execute(sql`
    INSERT INTO "commission_portions"
      ("collection_id", "staff_id", "portion", "release_month", "amount_sen")
    SELECT
      ca."collection_id",
      ca."staff_id",
      1,
      substring(coalesce(c."booking_date", c."collection_date")::text, 1, 7),
      round(ca."commission_amount_sen" * 0.5)::integer
    FROM "collection_allocations" ca
    JOIN "collections" c ON c."id" = ca."collection_id"
    WHERE ca."commission_amount_sen" > 0
    ON CONFLICT ("collection_id", "staff_id", "portion") DO NOTHING
  `);

  await db.execute(sql`
    INSERT INTO "commission_portions"
      ("collection_id", "staff_id", "portion", "release_month", "amount_sen")
    SELECT
      ca."collection_id",
      ca."staff_id",
      2,
      substring(coalesce(c."wedding_pickup_date", c."collection_date")::text, 1, 7),
      ca."commission_amount_sen" - round(ca."commission_amount_sen" * 0.5)::integer
    FROM "collection_allocations" ca
    JOIN "collections" c ON c."id" = ca."collection_id"
    WHERE ca."commission_amount_sen" > 0
    ON CONFLICT ("collection_id", "staff_id", "portion") DO NOTHING
  `);
}

async function main() {
  const db = getDb();

  console.log("Running database migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Database migrations complete.");

  await ensureFeatureSchema();
  console.log("Feature database schema is ready.");

  await db
    .insert(commissionSettings)
    .values({ id: 1, ...DEFAULT_SETTINGS })
    .onConflictDoNothing();
  console.log("Default commission settings are ready.");

  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    console.log("ADMIN_NAME, ADMIN_EMAIL or ADMIN_PASSWORD not set; skipping admin bootstrap.");
    return;
  }

  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const passwordHash = await hash(password, 12);
  const [existing] = await db
    .select()
    .from(staff)
    .where(eq(staff.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(staff)
      .set({
        name,
        passwordHash,
        role: "ADMIN",
        active: true,
        loginEnabled: true,
        updatedAt: new Date(),
      })
      .where(eq(staff.id, existing.id));
    console.log(`Admin account refreshed for ${email}.`);
  } else {
    await db.insert(staff).values({
      name,
      email,
      passwordHash,
      role: "ADMIN",
      active: true,
      loginEnabled: true,
    });
    console.log(`Admin account created for ${email}.`);
  }

  console.log(
    "Vercel database bootstrap complete. Remove ADMIN_PASSWORD from Vercel after login is confirmed.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
