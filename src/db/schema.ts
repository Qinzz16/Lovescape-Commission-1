import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["ADMIN", "STAFF"]);
export const categoryEnum = pgEnum("sales_category", ["PRE_WEDDING", "RENTAL", "MAKEUP"]);
export const sourceEnum = pgEnum("collection_source", ["BOOKIT", "MANUAL_ADJUSTMENT"]);
export const adjustmentTypeEnum = pgEnum("adjustment_type", ["ADDITION", "DEDUCTION"]);

export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().defaultRandom(), name: text("name").notNull(), email: text("email").notNull(),
  role: roleEnum("role").notNull().default("STAFF"), active: boolean("active").notNull().default(true),
  loginEnabled: boolean("login_enabled").notNull().default(true), passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("staff_email_unique").on(t.email)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(), staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("session_token_unique").on(t.tokenHash), index("session_staff_idx").on(t.staffId)]);

export const commissionSettings = pgTable("commission_settings", {
  id: integer("id").primaryKey().default(1), preWeddingBps: integer("pre_wedding_bps").notNull().default(300),
  rentalBps: integer("rental_bps").notNull().default(600), makeupBps: integer("makeup_bps").notNull().default(0),
  monthlyTargetSen: integer("monthly_target_sen").notNull().default(3_000_000), monthlyRewardSen: integer("monthly_reward_sen").notNull().default(30_000),
  updatedBy: uuid("updated_by").references(() => staff.id), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("settings_singleton", sql`${t.id} = 1`)]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(), invoiceNumber: text("invoice_number").notNull(), customerName: text("customer_name").notNull(),
  originalTotalSen: integer("original_total_sen").notNull(), createdDate: date("created_date", { mode: "string" }).notNull(), notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => staff.id), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("orders_invoice_unique").on(t.invoiceNumber), index("orders_customer_idx").on(t.customerName)]);

export const orderAdjustments = pgTable("order_adjustments", {
  id: uuid("id").primaryKey().defaultRandom(), orderId: uuid("order_id").notNull().references(() => orders.id), amountSen: integer("amount_sen").notNull(),
  type: adjustmentTypeEnum("type").notNull(), adjustmentDate: date("adjustment_date", { mode: "string" }).notNull(), reason: text("reason").notNull(), notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => staff.id), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("adjustments_order_idx").on(t.orderId)]);

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id),
  collectionDate: date("collection_date", { mode: "string" }).notNull(), category: categoryEnum("category").notNull(),
  collectedSen: integer("collected_sen").notNull(), source: sourceEnum("source").notNull().default("BOOKIT"), notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => staff.id), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("collection_positive", sql`${t.collectedSen} > 0`), index("collections_date_idx").on(t.collectionDate), index("collections_order_idx").on(t.orderId)]);

export const collectionAllocations = pgTable("collection_allocations", {
  id: uuid("id").primaryKey().defaultRandom(), collectionId: uuid("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  staffId: uuid("staff_id").notNull().references(() => staff.id), allocationBps: integer("allocation_bps").notNull(), allocatedCollectedSen: integer("allocated_collected_sen").notNull(),
  commissionRateBps: integer("commission_rate_bps").notNull(), commissionAmountSen: integer("commission_amount_sen").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("allocation_collection_staff_unique").on(t.collectionId, t.staffId), index("allocation_staff_idx").on(t.staffId), check("allocation_bps_valid", sql`${t.allocationBps} > 0 AND ${t.allocationBps} <= 10000`)]);

export const commissionPayments = pgTable("commission_payments", {
  id: uuid("id").primaryKey().defaultRandom(), staffId: uuid("staff_id").notNull().references(() => staff.id), commissionMonth: text("commission_month").notNull(), paidSen: integer("paid_sen").notNull(),
  paymentDate: date("payment_date", { mode: "string" }).notNull(), notes: text("notes"), createdBy: uuid("created_by").notNull().references(() => staff.id), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("payment_positive", sql`${t.paidSen} > 0`), index("payment_staff_month_idx").on(t.staffId, t.commissionMonth)]);

export const monthlyLocks = pgTable("monthly_locks", {
  month: text("month").primaryKey(), locked: boolean("locked").notNull().default(true), updatedBy: uuid("updated_by").notNull().references(() => staff.id), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
