import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { getDb } from "../src/db";
import { commissionSettings, staff } from "../src/db/schema";
import { DEFAULT_SETTINGS } from "../src/lib/business";

const db = getDb();

console.log("Running database migrations...");
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Database migrations complete.");

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
  process.exit(0);
}

if (password.length < 12) {
  throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
}

const passwordHash = await hash(password, 12);
const [existing] = await db.select().from(staff).where(eq(staff.email, email)).limit(1);

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

console.log("Vercel database bootstrap complete. Remove ADMIN_PASSWORD from Vercel after login is confirmed.");
