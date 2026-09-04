import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { compare } from "bcryptjs";
import { getDb } from "@/db";
import { sessions, staff } from "@/db/schema";

const COOKIE_NAME = "lovescape_session";
const SESSION_DAYS = 14;

const hashToken = (token: string) => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return createHmac("sha256", secret).update(token).digest("hex");
};

export async function authenticate(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const [account] = await getDb()
    .select()
    .from(staff)
    .where(eq(staff.email, normalized))
    .limit(1);
  if (
    !account?.active ||
    !account.loginEnabled ||
    !account.passwordHash ||
    !(await compare(password, account.passwordHash))
  )
    return null;

  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await getDb()
    .insert(sessions)
    .values({ staffId: account.id, tokenHash: hashToken(rawToken), expiresAt });
  (await cookies()).set(COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return account;
}

export async function currentAccount() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const [row] = await getDb()
    .select({
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      active: staff.active,
      loginEnabled: staff.loginEnabled,
    })
    .from(sessions)
    .innerJoin(staff, eq(sessions.staffId, staff.id))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row?.active && row.loginEnabled ? row : null;
}

export async function requireAccount() {
  const account = await currentAccount();
  if (!account) redirect("/login");
  return account;
}

export async function requireAdmin() {
  const account = await requireAccount();
  if (account.role !== "ADMIN") redirect("/dashboard?error=Access+denied");
  return account;
}

export async function signOut() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token)
    await getDb()
      .delete(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)));
  cookieStore.delete(COOKIE_NAME);
}
