import { authConfig, getSession } from '@/lib/session';
import { json } from '@/lib/api';
import { validateMemberAccess, MemberAccessError } from '@/lib/discord-members';
export async function GET() {
  const stored = await getSession(), config = authConfig();
  if (!stored) return json({authenticated:false,user:null,config});
  try { const user = await validateMemberAccess(stored); return json({authenticated:true,user,config}); }
  catch(e) { return json({authenticated:false,user:null,config,error:e instanceof Error?e.message:'تعذر التحقق من العضوية'},e instanceof MemberAccessError?e.status:503); }
}
