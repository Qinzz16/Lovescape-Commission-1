ALTER TABLE "collections" ADD COLUMN "bookit_payment_id" text;
--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "bookit_booking_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "collections_bookit_payment_unique" ON "collections" USING btree ("bookit_payment_id");
--> statement-breakpoint
CREATE INDEX "collections_bookit_booking_idx" ON "collections" USING btree ("bookit_booking_id");
