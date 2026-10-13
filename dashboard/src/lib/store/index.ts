import type { Store } from "./types";
import { MongoStore } from "./mongo";

let cached: Store | null = null;

/**
 * يختار المتجر المناسب:
 * - MONGODB_URI موجود → متجر Mongo حقيقي متصل بنفس قاعدة البوت (نفس البيانات لحظيًا).
 * - غير موجود → خطأ إعداد؛ لا بيانات وهمية أو بدائل تلقائية.
 */
export function getStore(): Store {
  if (cached) return cached;
  const uri = process.env.MONGODB_URI;
  if (uri) {
    cached = new MongoStore(uri, process.env.MONGODB_DB_NAME || "work_bot");
  } else {
    throw new Error("MONGODB_URI is required; sample data is disabled");
  }
  return cached;
}
