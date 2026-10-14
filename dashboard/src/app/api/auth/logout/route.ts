import { clearSessionCookie } from "@/lib/session";
import { json, requireAuth, isResponse } from "@/lib/api";

export async function POST() {
  const user = await requireAuth();
  if (isResponse(user)) return user;
  await clearSessionCookie();
  return json({ ok: true });
}
