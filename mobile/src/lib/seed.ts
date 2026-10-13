import { monthKey } from "./domain";
import type { Snapshot } from "./types";
export function emptySnapshot(): Snapshot {
  const key = monthKey();
  return {
    version: 1,
    records: [],
    works: [],
    members: [],
    audit: [],
    months: [
      {
        key,
        name: new Date().toLocaleDateString("ar", {
          month: "long",
          year: "numeric",
        }),
      },
    ],
    specialties: {
      تحرير: { price: 0.5, active: true },
      ترجمة_كوري: { price: 0.5, active: true },
      ترجمة_انجليزي: { price: 0.25, active: true },
      تبييض: { price: 0.25, active: true },
      سحب: { price: 0.01, active: true },
      دمج: { price: 0.01, active: true },
      رفع: { price: 0.005, active: true },
    },
    settings: {
      currency: "$",
      active_month: key,
      payment_day: 28,
      payment_hour: 12,
      alert_threshold: 10,
    },
  };
}
