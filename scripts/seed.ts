import { getDb } from "../src/db";
import { commissionSettings } from "../src/db/schema";
import { DEFAULT_SETTINGS } from "../src/lib/business";
await getDb()
  .insert(commissionSettings)
  .values({ id: 1, ...DEFAULT_SETTINGS })
  .onConflictDoNothing();
console.log("Default Lovescape commission settings are ready.");
