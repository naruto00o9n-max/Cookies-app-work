import type { Db } from "mongodb";
import { accidentalCatalogWork } from "../../../mobile/src/lib/azora-policy";
import type { Work } from "../../../mobile/src/lib/types";
const migration = "azora-native-catalog-v2";
export async function repairAzoraCatalog(db: Db) {
  if (
    await db
      .collection("mobile_migrations")
      .findOne({ _id: migration as never })
  )
    return;
  await db.client.withSession((session) =>
    session.withTransaction(async () => {
      if (
        await db
          .collection("mobile_migrations")
          .findOne({ _id: migration as never }, { session })
      )
        return;
      const doc = await db
        .collection("records")
        .findOne({ _id: "works" as never }, { session });
      const records = await db
        .collection("records")
        .findOne({ _id: "records" as never }, { session });
      const cache = await db
        .collection("azora")
        .findOne({ _id: "cache" as never }, { session });
      const works: Work[] = doc?.data || [],
        entries = Object.values(records?.data || {}).flat() as {
          work_name: string;
        }[];
      const removed = works.filter((w) =>
        accidentalCatalogWork(w, cache?.works || {}, entries),
      );
      // Backup and cleanup are atomic. Financial records and bot/manual links are never removed.
      await db
        .collection("mobile_migrations")
        .insertOne(
          {
            _id: migration as never,
            created_at: new Date(),
            works_before: works,
            removed,
            removed_count: removed.length,
          },
          { session },
        );
      if (removed.length)
        await db
          .collection("records")
          .updateOne(
            { _id: "works" as never },
            {
              $set: { data: works.filter((w) => !removed.includes(w)) },
              $inc: { revision: 1 },
            },
            { session },
          );
      await db
        .collection("azora")
        .updateOne(
          { _id: "state" as never },
          {
            $set: {
              native_catalog_version: 0,
              baseline_done: false,
              listing_v2: false,
              catalog_repair_removed: removed.length,
            },
          },
          { session, upsert: true },
        );
    }),
  );
}
