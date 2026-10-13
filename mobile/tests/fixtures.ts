import { emptySnapshot } from "../src/lib/seed";
import type { Snapshot } from "../src/lib/types";
export function demoSnapshot(): Snapshot {
  const s = emptySnapshot(),
    key = s.settings.active_month;
  s.members = [
    { id: "demo-1", name: "أحمد" },
    { id: "demo-2", name: "سارة" },
    { id: "demo-3", name: "يوسف" },
    { id: "demo-4", name: "نور" },
  ];
  s.works = [
    { name: "Solo Leveling", paid_start: 1 },
    { name: "Omniscient Reader", paid_start: 5 },
    { name: "The Beginning After the End", paid_start: 1 },
    { name: "Eleceed", paid_start: 1 },
  ];
  for (let i = 0; i < 84; i++) {
    const member = s.members[i % 4],
      type = ["تحرير", "ترجمة_كوري", "تبييض"][i % 3];
    s.records.push({
      id: `demo-${i}`,
      userId: member.id,
      username: member.name,
      work_name: s.works[i % 4].name,
      chapter: String(100 + i),
      work_type: type,
      total: s.specialties[type].price,
      notes: "",
      month_key: key,
      timestamp: new Date(Date.now() - i * 5 * 3600000).toISOString(),
    });
  }
  return s;
}
