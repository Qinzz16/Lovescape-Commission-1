CREATE TYPE "public"."adjustment_type" AS ENUM('ADDITION', 'DEDUCTION');--> statement-breakpoint
CREATE TYPE "public"."sales_category" AS ENUM('PRE_WEDDING', 'RENTAL', 'MAKEUP');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'STAFF');--> statement-breakpoint
CREATE TYPE "public"."collection_source" AS ENUM('BOOKIT', 'MANUAL_ADJUSTMENT');--> statement-breakpoint
CREATE TABLE "collection_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"allocation_bps" integer NOT NULL,
	"allocated_collected_sen" integer NOT NULL,
	"commission_rate_bps" integer NOT NULL,
	"commission_amount_sen" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allocation_bps_valid" CHECK ("collection_allocations"."allocation_bps" > 0 AND "collection_allocations"."allocation_bps" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"collection_date" date NOT NULL,
	"category" "sales_category" NOT NULL,
	"collected_sen" integer NOT NULL,
	"source" "collection_source" DEFAULT 'BOOKIT' NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_positive" CHECK ("collections"."collected_sen" > 0)
);
--> statement-breakpoint
CREATE TABLE "commission_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"commission_month" text NOT NULL,
	"paid_sen" integer NOT NULL,
	"payment_date" date NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_positive" CHECK ("commission_payments"."paid_sen" > 0)
);
--> statement-breakpoint
CREATE TABLE "commission_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"pre_wedding_bps" integer DEFAULT 300 NOT NULL,
	"rental_bps" integer DEFAULT 600 NOT NULL,
	"makeup_bps" integer DEFAULT 0 NOT NULL,
	"monthly_target_sen" integer DEFAULT 3000000 NOT NULL,
	"monthly_reward_sen" integer DEFAULT 30000 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_singleton" CHECK ("commission_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "monthly_locks" (
	"month" text PRIMARY KEY NOT NULL,
	"locked" boolean DEFAULT true NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"amount_sen" integer NOT NULL,
	"type" "adjustment_type" NOT NULL,
	"adjustment_date" date NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"customer_name" text NOT NULL,
	"original_total_sen" integer NOT NULL,
	"created_date" date NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "role" DEFAULT 'STAFF' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"login_enabled" boolean DEFAULT true NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_allocations" ADD CONSTRAINT "collection_allocations_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_allocations" ADD CONSTRAINT "collection_allocations_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_settings" ADD CONSTRAINT "commission_settings_updated_by_staff_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_locks" ADD CONSTRAINT "monthly_locks_updated_by_staff_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_adjustments" ADD CONSTRAINT "order_adjustments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_adjustments" ADD CONSTRAINT "order_adjustments_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "allocation_collection_staff_unique" ON "collection_allocations" USING btree ("collection_id","staff_id");--> statement-breakpoint
CREATE INDEX "allocation_staff_idx" ON "collection_allocations" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "collections_date_idx" ON "collections" USING btree ("collection_date");--> statement-breakpoint
CREATE INDEX "collections_order_idx" ON "collections" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payment_staff_month_idx" ON "commission_payments" USING btree ("staff_id","commission_month");--> statement-breakpoint
CREATE INDEX "adjustments_order_idx" ON "order_adjustments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_invoice_unique" ON "orders" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_name");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "session_staff_idx" ON "sessions" USING btree ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_email_unique" ON "staff" USING btree ("email");