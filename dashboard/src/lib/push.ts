import {nativeDb} from './native-service';
export async function sendTeamPush(title:string,body:string,userId?:string,data:Record<string,string>={screen:'More'}) {
  const db=nativeDb();if(!db)return;
  const devices=await db.collection('mobile_devices').find(userId?{userId}:{}).limit(10000).toArray();
  for(let i=0;i<devices.length;i+=100){
    const batch=devices.slice(i,i+100);
    const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json',...(process.env.EXPO_ACCESS_TOKEN?{Authorization:`Bearer ${process.env.EXPO_ACCESS_TOKEN}`}:{})},body:JSON.stringify(batch.map(d=>({to:d.token,title,body,sound:'default',data}))),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(`تعذر إرسال الإشعارات (${response.status})`);
    const result=await response.json();
    if(!Array.isArray(result.data)||result.data.length!==batch.length)throw new Error('استجابة إرسال الإشعارات غير مكتملة');
    for(let j=0;j<result.data.length;j++){const ticket=result.data[j];if(ticket.details?.error==='DeviceNotRegistered')await db.collection('mobile_devices').deleteOne({_id:batch[j]._id});else if(ticket.status==='error')throw new Error(`تعذر إرسال الإشعارات: ${ticket.details?.error||'unknown'}`);}
  }
}
