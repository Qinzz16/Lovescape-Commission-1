import { hash } from "bcryptjs";
import { getDb } from "../src/db";
import { staff } from "../src/db/schema";
const name = process.env.ADMIN_NAME?.trim();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!name || !email || !password || password.length < 12)
  throw new Error(
    "Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD (minimum 12 characters) for this one-time command.",
  );
await getDb()
  .insert(staff)
  .values({
    name,
    email,
    passwordHash: await hash(password, 12),
    role: "ADMIN",
    active: true,
    loginEnabled: true,
  });
console.log(
  `Admin account created for ${email}. Remove ADMIN_PASSWORD from your environment now.`,
);
