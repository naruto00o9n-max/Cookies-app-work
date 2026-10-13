import { after } from 'next/server';
import { json, requireAuth, isResponse } from '@/lib/api';
import { nativeSnapshot } from '@/lib/native-service';
import { syncDiscordMembers } from '@/lib/discord-members';
export const maxDuration = 300;
export async function GET() {
  const user = await requireAuth();
  if (isResponse(user)) return user;
  try {
    const snapshot = await nativeSnapshot();
    if (!user.isAdmin) snapshot.audit = [];
    if (process.env.DISCORD_BOT_TOKEN) after(async () => {
      try {
        const result = await syncDiscordMembers();
        if (!result.skipped && !result.busy) console.info('[Discord directory] synchronized members:', result.synced);
      } catch (e) { console.error('[Discord directory] sync failed:', e instanceof Error ? e.message : 'unknown'); }
    });
    return json({ snapshot, user, mode: 'mongo' });
  } catch { return json({ error: 'تعذر الاتصال بقاعدة البيانات' }, 503); }
}
