import crypto from 'node:crypto';
import {newPublishedChapters,workRecipients,azoraMetadata} from './azora-events';
import { nativeDb } from './native-service';
import { MongoClient } from 'mongodb';
const BASE='https://api.azorafly.com';
async function get(path:string) {
  const response=await fetch(BASE+path,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(25000),cache:'no-store'});
  if(!response.ok)throw new Error(`أزورا غير متاحة (${response.status})`);
  return response.json();
}
async function teamFallback(slug:string){
  const response=await fetch(`https://azorafly.com/teams/${encodeURIComponent(slug)}`,{signal:AbortSignal.timeout(25000),cache:'no-store'});
  if(!response.ok)throw new Error(`صفحة الفريق غير متاحة (${response.status})`);
  const html=await response.text();if(html.includes('Attention Required')||html.includes('cf-error'))throw new Error('صفحة أزورا محجوبة حاليًا');
  const slugs=[...new Set([...html.matchAll(/href="\/series\/([A-Za-z0-9_-]+)"/g)].map(m=>m[1]))];
  if(!slugs.length)throw new Error('لم تُقرأ أعمال الفريق؛ لم تُحفظ قائمة فارغة');
  return slugs.map(slug=>({slug,postTitle:slug}));
}
export async function azoraState() {
  const db=nativeDb(); if(!db)throw new Error('لم يتم إعداد قاعدة بيانات الفريق');
  const [state,cache,works]=await Promise.all([db.collection('azora').findOne({_id:'state' as never}),db.collection('azora').findOne({_id:'cache' as never}),db.collection('records').findOne({_id:'works' as never})]);
  return {state:{team_slug:'cookies',enabled:true,auto_add_new_works:true,...state},posts:Object.values(cache?.works||{}),linked:(works?.data||[]).filter((w:any)=>w.azora)};
}
function chaptersFrom(data:any):any[] {
  const list=data.post?.chapters||data.chapters||[];if(!Array.isArray(list))throw new Error('قائمة فصول أزورا غير صالحة');
  return list.map(ch=>({...ch,number:String(Number(ch.number??ch.chapterNumber??ch.chapter??ch.title?.match(/\d+(?:\.\d+)?/)?.[0]))})).filter(ch=>ch.number!=='NaN');
}
export async function syncAzora() {
  const db=nativeDb();if(!db)throw new Error('أزورا تحتاج قاعدة بيانات الفريق');
  const state:Record<string,any>=(await db.collection('azora').findOne({_id:'state' as never}))||{};
  if(state.enabled===false)return {message:'مزامنة أزورا معطلة'};
  const slug=String(state.team_slug||'cookies');let teamId=state.team_id;
  let listingError=false;
  try{if(!teamId)for(let page=1;page<=10;page++) {const data=await get(`/api/teams?page=${page}&perPage=50`);const team=(data.teams||[]).find((t:any)=>t.slug===slug);if(team){teamId=team.id;break;}if(page>=(data.totalPages||1))break;}
  }catch{listingError=true;}
  const posts:any[]=[];
  try{if(!teamId)throw new Error("unknown team");for(let page=1;page<=20;page++){const data=await get(`/api/teams/posts/${Number(teamId)}?page=${page}&perPage=24`);if(!Array.isArray(data.posts))throw new Error('بيانات الأعمال غير صالحة');posts.push(...data.posts);if(page>=(data.totalPages||1))break;if(page===20)throw new Error('عدد صفحات الفريق يتجاوز الحد؛ لم تُحفظ مزامنة ناقصة');}
  }catch{listingError=true;posts.splice(0,posts.length,...await teamFallback(slug));}
  const workDoc=await db.collection('records').findOne({_id:'works' as never});
  const linked=(workDoc?.data||[]).filter((w:any)=>w.azora?.slug);
  const previous=await db.collection('azora').findOne({_id:'chapters' as never});
  const freshBySlug:Record<string,string[]>={};
  const metadata:Record<string,ReturnType<typeof azoraMetadata>>={};
  const chapterCache:Record<string,any>={};
  // Network work precedes the short database transaction.
  for(const w of linked){
    const result=await get(`/api/post?postSlug=${encodeURIComponent(w.azora.slug)}`);
    const post=result.post,id=post?.id;if(!id)throw new Error(`لم يُعثر على ${w.name}`);
    const payload=await get(`/api/chapters?postId=${Number(id)}`),chapters=chaptersFrom(payload);
    const old=previous?.data?.[w.azora.slug];
    freshBySlug[w.azora.slug]=newPublishedChapters(Array.isArray(old?.numbers)?old.numbers:undefined,chapters);
    metadata[w.azora.slug]=azoraMetadata(post,chapters);
    chapterCache[w.azora.slug]={numbers:chapters.map(ch=>ch.number),chapters,count:chapters.length,updated_at:new Date().toISOString(),last_fetch:new Date().toISOString()};
  }
  const mongo=new MongoClient(process.env.MONGODB_URI!);await mongo.connect();let added=0;
  try {await mongo.withSession(session=>session.withTransaction(async()=>{
    const database=mongo.db(process.env.MONGODB_DB_NAME||'work_bot'),opts={session,upsert:true};
    const latest=await database.collection('records').findOne({_id:'works' as never},{session});const works=latest?.data||[];added=0;
    if(state.auto_add_new_works!==false)for(const post of posts){const name=String(post.postTitle||post.title||post.slug);if(!works.some((w:any)=>w.azora?.slug===post.slug||w.name===name)){works.push({name,active:true,paid_start:null,azora:{slug:post.slug,post_id:post.id,title_en:name,cover:post.featuredImage,linked_at:new Date().toISOString()}});added++;}}
    for(const work of works)if(work.azora?.slug&&metadata[work.azora.slug])work.azora={...work.azora,...metadata[work.azora.slug]};
    if(added||Object.keys(metadata).length)await database.collection('records').updateOne({_id:'works' as never},{$set:{data:works},$inc:{revision:1}},opts);
    const recordDoc=await database.collection('records').findOne({_id:'records' as never},{session});
    for(const work of works){
      if(!work.azora?.slug)continue;
      if(state.announcements_enabled===false)continue;
      for(const chapter of freshBySlug[work.azora.slug]||[]){
        for(const userId of workRecipients(recordDoc?.data||{},work,chapter)){
          const eventId=crypto.createHash('sha256').update(JSON.stringify(['azora',work.azora.slug,chapter,userId])).digest('hex');
          await database.collection('mobile_outbox').updateOne({_id:eventId as never},{$setOnInsert:{userId,title:'فصل جديد بانتظارك ✦',body:`نُشر الفصل ${chapter} من «${work.name}» على أزورا. يمكنك تسجيل إنجازك الآن.`,data:{screen:'Detail',work:work.name,chapter},created_at:new Date(),sent:false}},opts);
        }
      }
    }
    const priorCache=listingError?await database.collection('azora').findOne({_id:'cache' as never},{session}):null;
    await database.collection('azora').updateOne({_id:'cache' as never},{$set:{works:listingError?{...Object.fromEntries(posts.map(p=>[p.slug,p])),...(priorCache?.works||{})}:Object.fromEntries(posts.map(p=>[p.slug,p]))}},opts);
    if(Object.keys(chapterCache).length)await database.collection('azora').updateOne({_id:'chapters' as never},{$set:Object.fromEntries(Object.entries(chapterCache).map(([key,v])=>[`data.${key}`,v]))},opts);
    await database.collection('azora').updateOne({_id:'state' as never},{$set:{team_id:teamId,last_sync_at:new Date().toISOString(),last_sync_ok:true,last_error:null,posts_source:listingError?'ssr':'api'},$inc:{auto_added_count:added}},opts);
  }));}finally{await mongo.close();}

  return {message:`تمت مزامنة ${posts.length} عمل و${linked.length} عمل مرتبط، وإضافة ${added} عمل`};
}
