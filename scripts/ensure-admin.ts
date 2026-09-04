import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { staff } from "../src/db/schema";

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

const db = getDb();
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
  console.log(`Admin account refreshed for ${email}. Remove ADMIN_PASSWORD from Vercel after the first successful deployment.`);
  process.exit(0);
}

await db.insert(staff).values({
  name,
  email,
  passwordHash,
  role: "ADMIN",
  active: true,
  loginEnabled: true,
});

console.log(`Admin account created for ${email}. Remove ADMIN_PASSWORD from Vercel after the first successful deployment.`);
