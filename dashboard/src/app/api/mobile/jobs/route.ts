import crypto from 'node:crypto';
import {json} from '@/lib/api';
import {nativeDb,nativeSnapshot} from '@/lib/native-service';
import {syncAzora} from '@/lib/azora-native';
import {sendTeamPush} from '@/lib/push';
export const maxDuration=300;
export async function GET(req:Request){
  const supplied=req.headers.get('authorization')||'',expected=`Bearer ${process.env.CRON_SECRET||''}`;
  if(!process.env.CRON_SECRET||supplied.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return json({error:'غير مصرح'},401);
  const db=nativeDb();if(!db)return json({error:'قاعدة البيانات غير مرتبطة'},503);
  const owner=crypto.randomBytes(16).toString('hex');
  try { await db.collection('mobile_job_lock').findOneAndUpdate({_id:'jobs' as never,$or:[{expires:{$lt:new Date()}},{expires:{$exists:false}}]},{$set:{owner,expires:new Date(Date.now()+300000)}},{upsert:true}); }
  catch(e){if((e as {code?:number}).code===11000)return json({busy:true},202);return json({error:'تعذر حجز المهام'},503);}
  const now=new Date(),day=now.toISOString().slice(0,10),results:Record<string,unknown>={};
  try{
    const snapshot=await nativeSnapshot();
    await db.collection('mobile_command_receipts').createIndex({expires:1},{expireAfterSeconds:0});
    for(const message of await db.collection('mobile_outbox').find({sent:false}).limit(100).toArray()){
      await sendTeamPush(message.title,message.body,message.userId);
      await db.collection('mobile_outbox').updateOne({_id:message._id},{$set:{sent:true,sent_at:now}});
    }
    await db.collection('mobile_backups').createIndex({expires:1},{expireAfterSeconds:0});
    await db.collection('mobile_backups').updateOne({_id:day as never},{$setOnInsert:{snapshot,created_at:now,expires:new Date(+now+30*86400000)}},{upsert:true});results.backup=day;
    // Called every ten minutes: prior-day and due-day reminders. The marker prevents repeated sends.
    const due=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),snapshot.settings.payment_day||28,snapshot.settings.payment_hour));
    const hours=(+due-+now)/3600000;
    if(snapshot.settings.payment_day&&((hours>=0&&hours<=24)||(hours<0&&hours>=-1))){
      const marker=`payment:${now.toISOString().slice(0,7)}:${hours>=0?'prior':'due'}`;
      const existing=await db.collection('mobile_job_markers').findOne({_id:marker as never});
      if(!existing){await sendTeamPush('موعد مستحقات كوكيز',hours>=0?'اقترب موعد الدفع. راجع أعمالك ومستحقاتك.':'حان موعد الدفع. تقرير الفريق جاهز في التطبيق.');await db.collection('mobile_job_markers').updateOne({_id:marker as never},{$set:{sent_at:now}},{upsert:true});results.reminder=true;}
    }
    try{results.azora=await syncAzora();}catch(e){results.azoraError=e instanceof Error?e.message:'تعذرت مزامنة أزورا';await db.collection('azora').updateOne({_id:'state' as never},{$set:{last_sync_ok:false,last_error:results.azoraError,last_sync_at:now.toISOString()}},{upsert:true});}
    return json(results);
  }catch{return json({error:'تعذر تشغيل المهام الدورية'},503);}
  finally{await db.collection('mobile_job_lock').deleteOne({_id:'jobs' as never,owner});}
}
