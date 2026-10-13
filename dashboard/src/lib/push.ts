import {nativeDb} from './native-service';
export async function sendTeamPush(title:string,body:string,userId?:string) {
  const db=nativeDb();if(!db)return;
  const devices=await db.collection('mobile_devices').find(userId?{userId}:{}).limit(10000).toArray();
  for(let i=0;i<devices.length;i+=100){
    const batch=devices.slice(i,i+100);
    const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json',...(process.env.EXPO_ACCESS_TOKEN?{Authorization:`Bearer ${process.env.EXPO_ACCESS_TOKEN}`}:{})},body:JSON.stringify(batch.map(d=>({to:d.token,title,body,sound:'default',data:{screen:'More'}}))),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(`تعذر إرسال الإشعارات (${response.status})`);
    const result=await response.json();
    for(let j=0;j<(result.data||[]).length;j++)if(result.data[j].details?.error==='DeviceNotRegistered')await db.collection('mobile_devices').deleteOne({_id:batch[j]._id});
  }
}
