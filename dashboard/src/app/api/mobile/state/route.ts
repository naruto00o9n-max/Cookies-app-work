import { json,requireAuth,isResponse } from '@/lib/api';
import { nativeSnapshot } from '@/lib/native-service';
export async function GET() {
  const user=await requireAuth(); if(isResponse(user)) return user;
  try { const snapshot=await nativeSnapshot(); if(!user.isAdmin) snapshot.audit=[]; return json({snapshot,user,mode:process.env.MONGODB_URI?'mongo':'demo'}); }
  catch { return json({error:'تعذر الاتصال بقاعدة البيانات'},503); }
}
