import { json,requireAuth,isResponse } from '@/lib/api';
import { nativeCommand } from '@/lib/native-service';
export async function POST(req:Request) {
  const user=await requireAuth(); if(isResponse(user)) return user;
  try {
    const raw=await req.text(); if(raw.length>5_000_000) return json({error:'الملف كبير جدًا'},413);
    const command=JSON.parse(raw);
    if(typeof command.action!=='string'||!command.payload||typeof command.payload!=='object') return json({error:'طلب غير صالح'},400);
    if(command.id!==undefined&&(typeof command.id!=='string'||!/^[A-Za-z0-9_-]{3,128}$/.test(command.id)))return json({error:'معرف العملية غير صالح'},400);
    if(!user.isAdmin&&!['register','editLast'].includes(command.action)) return json({error:'للمشرفين فقط'},403);
    return json(await nativeCommand(command,user));
  } catch(e) { return json({error:e instanceof Error?e.message:'تعذر حفظ البيانات'},400); }
}
