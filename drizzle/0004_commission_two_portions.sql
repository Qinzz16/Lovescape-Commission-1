ALTER TABLE "commission_settings" ADD COLUMN "booking_portion_bps" integer DEFAULT 5000 NOT NULL;
--> statement-breakpoint
ALTER TABLE "commission_settings" ADD COLUMN "wedding_portion_bps" integer DEFAULT 5000 NOT NULL;
--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "wedding_pickup_date" date;
--> statement-breakpoint
CREATE TABLE "commission_portions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "collection_id" uuid NOT NULL,
  "staff_id" uuid NOT NULL,
  "portion" integer NOT NULL,
  "release_month" text NOT NULL,
  "amount_sen" integer NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "commission_portion_valid" CHECK ("portion" IN (1, 2) AND "amount_sen" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "commission_portion_unique" ON "commission_portions" USING btree ("collection_id", "staff_id", "portion");
--> statement-breakpoint
CREATE INDEX "commission_portion_month_idx" ON "commission_portions" USING btree ("release_month");
--> statement-breakpoint
CREATE INDEX "commission_portion_staff_idx" ON "commission_portions" USING btree ("staff_id");
--> statement-breakpoint
ALTER TABLE "commission_portions" ADD CONSTRAINT "commission_portions_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "commission_portions" ADD CONSTRAINT "commission_portions_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");
--> statement-breakpoint
INSERT INTO "commission_portions" ("collection_id","staff_id","portion","release_month","amount_sen")
SELECT ca.collection_id, ca.staff_id, 1, substring(c.collection_date::text,1,7),
       round(ca.commission_amount_sen * 0.5)
FROM "collection_allocations" ca
JOIN "collections" c ON c.id = ca.collection_id
WHERE ca.commission_amount_sen > 0
ON CONFLICT ("collection_id","staff_id","portion") DO NOTHING;
--> statement-breakpoint
INSERT INTO "commission_portions" ("collection_id","staff_id","portion","release_month","amount_sen")
SELECT ca.collection_id, ca.staff_id, 2,
       substring(coalesce(c.wedding_pickup_date, c.collection_date)::text,1,7),
       ca.commission_amount_sen - round(ca.commission_amount_sen * 0.5)
FROM "collection_allocations" ca
JOIN "collections" c ON c.id = ca.collection_id
WHERE ca.commission_amount_sen > 0
ON CONFLICT ("collection_id","staff_id","portion") DO NOTHING;
