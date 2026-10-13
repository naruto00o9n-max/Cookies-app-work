import { json, requireAdmin, isResponse } from "@/lib/api";
import { syncDiscordMembers } from "@/lib/discord-members";

export const maxDuration = 60;

export async function POST() {
  const auth = await requireAdmin();
  if (isResponse(auth)) return auth;
  try { return json(await syncDiscordMembers({ force: true, moderatorId: auth.id })); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "تعذرت مزامنة أعضاء ديسكورد" }, 502); }
}
