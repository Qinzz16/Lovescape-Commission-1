# Lovescape Commission

Private commission management for Lovescape. The application records actual customer collections, preserves the commission rate used for every staff allocation, calculates monthly RM30K rewards, tracks commission payments, locks completed months, and exports matching monthly reports. Bookit remains the source of truth for orders and customer payments.

## Stack

- Next.js 16 App Router and TypeScript
- React Server Components and Server Actions
- PostgreSQL (Neon recommended on Vercel)
- Drizzle ORM and versioned SQL migrations
- Database-backed credentials with bcrypt password hashing and opaque, hashed session tokens
- Integer-sen financial calculations and basis-point rates
- Vitest business-rule tests

No Supabase code, package, environment variable, or service is used.

## Local setup

1. Use Node.js 20.9 or later.
2. Copy `.env.example` to `.env.local`; set `DATABASE_URL`, `AUTH_SECRET`, and `APP_URL`.
3. Run `npm install`.
4. Run `npm run db:migrate`.
5. Run `npm run db:seed`.
6. Create the first admin with temporary environment values:

   ```bash
   ADMIN_NAME="Lovescape Manager" ADMIN_EMAIL="manager@example.com" ADMIN_PASSWORD="a-unique-strong-password" npm run admin:create
   ```

   Remove the password from the environment or shell history after use. Production passwords are never hardcoded.

7. Run `npm run dev` and open `http://localhost:3000`.

## Environment variables

| Variable       | Required | Purpose                                                          |
| -------------- | -------- | ---------------------------------------------------------------- |
| `DATABASE_URL` | Yes      | Pooled PostgreSQL connection; Neon is recommended for Vercel     |
| `AUTH_SECRET`  | Yes      | Application auth secret; generate with `openssl rand -base64 32` |
| `APP_URL`      | Yes      | Canonical local or production URL                                |

`ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` are temporary values used only by `npm run admin:create`; do not store them in Vercel.

## Vercel deployment

1. Import this repository into Vercel.
2. Add Neon Postgres from the Vercel Marketplace, or provide another persistent PostgreSQL database with pooled serverless connections.
3. Add `DATABASE_URL`, `AUTH_SECRET`, and `APP_URL` to Production and Preview.
4. Run migrations and the settings seed against production before first use.
5. Create the first admin from a trusted machine with the one-time command.
6. Deploy. The standard `npm run build` command is Vercel-compatible and no local filesystem persistence is used.

## Security and financial behavior

- Every mutation authenticates on the server; admin actions use a server role guard.
- Staff queries are scoped from the authenticated session, never from a trusted URL staff ID.
- Passwords use bcrypt cost 12. Cookies are HTTP-only, secure in production, same-site lax, and backed by hashed database tokens.
- Money is stored and calculated in integer sen; rates and allocations use basis points.
- Historical rate and commission amount are stored on each allocation and never change when settings change.
- Order adjustments are separate records and never rewrite collections.
- Month locking blocks edits, deletions, allocation changes, and movement into or out of the locked month, while later commission payments remain allowed.
- Inactive staff remain in historical reports.

## Commands

| Command                | Purpose                                      |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Local development                            |
| `npm run lint`         | ESLint                                       |
| `npm run typecheck`    | TypeScript validation                        |
| `npm test`             | Critical business-rule tests                 |
| `npm run build`        | Production build                             |
| `npm run db:generate`  | Generate a migration after schema changes    |
| `npm run db:migrate`   | Apply committed migrations                   |
| `npm run db:seed`      | Insert default settings safely               |
| `npm run admin:create` | Create the first admin from temporary values |
