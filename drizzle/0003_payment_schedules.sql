CREATE TABLE "payment_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_name" text NOT NULL,
  "payment_number" integer NOT NULL,
  "due_date" date NOT NULL,
  "expected_sen" integer NOT NULL,
  "staff_id" uuid,
  "notes" text,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "schedule_positive" CHECK ("expected_sen" > 0),
  CONSTRAINT "schedule_payment_number_positive" CHECK ("payment_number" > 0)
);
--> statement-breakpoint
CREATE INDEX "schedule_customer_idx" ON "payment_schedules" USING btree ("customer_name");
--> statement-breakpoint
CREATE INDEX "schedule_due_date_idx" ON "payment_schedules" USING btree ("due_date");
--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");
--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "staff"("id");
--> statement-breakpoint
CREATE TABLE "payment_schedule_allocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "schedule_id" uuid NOT NULL,
  "collection_id" uuid NOT NULL,
  "allocated_sen" integer NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "schedule_allocation_positive" CHECK ("allocated_sen" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_collection_unique" ON "payment_schedule_allocations" USING btree ("schedule_id", "collection_id");
--> statement-breakpoint
CREATE INDEX "schedule_allocation_schedule_idx" ON "payment_schedule_allocations" USING btree ("schedule_id");
--> statement-breakpoint
CREATE INDEX "schedule_allocation_collection_idx" ON "payment_schedule_allocations" USING btree ("collection_id");
--> statement-breakpoint
ALTER TABLE "payment_schedule_allocations" ADD CONSTRAINT "payment_schedule_allocations_schedule_id_payment_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "payment_schedules"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "payment_schedule_allocations" ADD CONSTRAINT "payment_schedule_allocations_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE;
