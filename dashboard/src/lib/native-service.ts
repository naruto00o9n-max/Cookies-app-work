import crypto from 'node:crypto';
import { MongoClient, type ClientSession, type Db, type Document } from 'mongodb';
import type { RecordEntry } from './store/types';
import type { SessionUser } from './session';
import { applyCommand, type Command } from '../../../mobile/src/lib/commands';
import { emptySnapshot } from '../../../mobile/src/lib/seed';
import type { Snapshot } from '../../../mobile/src/lib/types';

export {totalOf,visibleEntries} from '../../../mobile/src/lib/domain';

let client: MongoClient | undefined;
export function nativeDb() {
  if (!process.env.MONGODB_URI) return null;
  client ||= new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  return client.db(process.env.MONGODB_DB_NAME || 'work_bot');
}
export function toSnapshot(records: Record<string, RecordEntry[]>, works: Snapshot['works'], settings: Document, members: Document[], months: Document[], audit: Document[]): Snapshot {
  const defaults=emptySnapshot();
  return {
    version:1,
    records:Object.entries(records).flatMap(([userId, entries])=>entries.map((e,index)=>({...e,month_key:e.month_key||e.timestamp?.slice(0,7)||'unknown',userId,id:crypto.createHash('sha256').update(JSON.stringify([userId,e.work_name,e.chapter,e.work_type,e.timestamp,index])).digest('hex')}))),
    works, specialties:settings.specialties || defaults.specialties,
    settings:{...defaults.settings,...settings,active_month:settings.active_month || defaults.settings.active_month},
    members:[...new Set([...members.map(m=>String(m._id)),...Object.keys(records)])].map(id=>{const m=members.find(m=>String(m._id)===id);return {id,name:m?.nickname||m?.username||records[id]?.find(e=>e.username)?.username||id,avatar:m?.avatar};}),
    months:[...new Set([settings.active_month||defaults.settings.active_month,...months.map(m=>String(m._id)),...Object.values(records).flatMap(list=>list.map(e=>e.month_key||e.timestamp?.slice(0,7))).filter(key=>key&&/^\d{4}-(0[1-9]|1[0-2])$/.test(key))])].map(key=>({key,name:months.find(m=>String(m._id)===key)?.name||key})),
    audit:audit.map(a=>({id:String(a._id||a.timestamp),action:a.action,details:a.details||'',timestamp:a.timestamp,moderator_id:a.moderator_id||''})),
  };
}
async function readMongo(db: Db, session?: ClientSession) {
  const r=await db.collection('records').findOne({_id:'records' as never},{session});
  const w=await db.collection('records').findOne({_id:'works' as never},{session});
  const settings=await db.collection('settings').findOne({_id:'settings' as never},{session});
  const members=await db.collection('members').find({},{session}).toArray();
  const months=await db.collection('months').find({},{session}).toArray();
  const audit=await db.collection('audit_log').find({},{session}).sort({timestamp:-1}).limit(1000).toArray();
  return toSnapshot(r?.data||{},w?.data||[],settings||{},members,months,audit);
}
export async function nativeSnapshot() {
  const db=nativeDb(); if(!db)throw new Error('لم يتم إعداد قاعدة بيانات الفريق');
  return readMongo(db);
}
function recordsOf(s: Snapshot) {
  const r: Record<string, RecordEntry[]>=Object.create(null);
  for(const e of s.records) { const {id: _id,userId,...entry}=e; (r[userId]||=[]).push(entry); }
  return r;
}
async function writeMongo(db: Db, s: Snapshot, session: ClientSession, action: string) {
  const opts={session,upsert:true};
  // A single Atlas transaction keeps records, prices, work names and months consistent.
  await db.collection('records').updateOne({_id:'records' as never},{$set:{data:recordsOf(s)},$inc:{revision:1}},opts);
  await db.collection('records').updateOne({_id:'works' as never},{$set:{data:s.works},$inc:{revision:1}},opts);
  const settings={...s.settings,specialties:s.specialties} as Document; delete settings._id; delete settings.revision;
  await db.collection('settings').updateOne({_id:'settings' as never},{$set:settings,$inc:{revision:1}},opts);
  for(const m of s.months) await db.collection('months').updateOne({_id:m.key as never},{$set:{name:m.name}},opts);
  if(action==='deleteMonth'||action==='import') await db.collection('months').deleteMany({_id:{$nin:s.months.map(m=>m.key) as never}},{session});
  if(action==='import') for(const m of s.members) await db.collection('members').updateOne({_id:m.id as never},{$set:{username:m.name,avatar:m.avatar}},opts);
  const {id: _id,...audit}=s.audit[0];
  await db.collection('audit_log').insertOne(audit,{session});
}
export async function nativeCommand(command: Command, user: SessionUser) {
  if(command.action === "editLast") command.payload.userId=user.id;
  if(["register","editLast"].includes(command.action) && !command.payload.userId) command.payload.userId=user.id;
  const db=nativeDb();
  if(db) {
    await client!.connect();
    return client!.withSession(async session=>session.withTransaction(async()=>{
      const receiptKey=command.id?`${user.id}:${command.id}`:null;
      if(receiptKey){const prior=await db.collection('mobile_command_receipts').findOne({_id:receiptKey as never},{session});if(prior)return prior.result;}
      const s=await readMongo(db,session);
      await verifyPublication(s,command,db,session);
      const result=applyCommand(s,command,{id:user.id,name:user.username,isAdmin:user.isAdmin},true);
      await writeMongo(db,s,session,command.action);
      if(receiptKey)await db.collection('mobile_command_receipts').insertOne({_id:receiptKey as never,result,created_at:new Date(),expires:new Date(Date.now()+7*86400000)},{session});
      if(command.action==='register'){
        const target=String(command.payload.userId),total=s.records.filter(e=>e.userId===target&&e.month_key===s.settings.active_month).reduce((a,e)=>a+e.total,0);
        if(total>=s.settings.alert_threshold)await db.collection('mobile_outbox').insertOne({userId:target,title:'إنجازاتك تصنع فرقًا',body:`وصل إجمالي شغلك إلى ${s.settings.currency}${total.toFixed(3)}`,created_at:new Date(),sent:false},{session});
      }
      return result;
    }));
  }
  throw new Error('لم يتم إعداد قاعدة بيانات الفريق');
}
async function verifyPublication(s:Snapshot,c:Command,db:Db,session:ClientSession) {
  if(!['register','editLast'].includes(c.action)) return;
  if(c.action==='editLast'){const last=s.records.filter(e=>e.userId===String(c.payload.userId)&&e.month_key===s.settings.active_month&&!['مكافأة','خصم'].includes(e.work_type)).sort((a,b)=>b.timestamp.localeCompare(a.timestamp))[0];if(!last)return;c={...c,payload:{...c.payload,work:c.payload.work||last.work_name,chapters:c.payload.chapter||last.chapter,types:c.payload.types||last.work_type}};}
  const w=s.works.find(w=>w.name===String(c.payload.work)); if(!w?.azora) return;
  const {parseChapters}=await import('../../../mobile/src/lib/domain');
  const chapters=parseChapters(String(c.payload.chapters||''));
  const doc=await db.collection('azora').findOne({_id:'chapters' as never},{session});
  const cached=doc?.data?.[w.azora.slug];
  // Match the bot: no cache is not evidence of unpublished chapters; an empty successful cache is.
  const nums=cached?new Set((cached.numbers||[]).map((v:unknown)=>String(Number(v)))):null;
  const types=String(c.payload.types||'').split(/[,،]/).map(t=>t.trim());
  for(let i=0;i<chapters.length;i++) {
    const ch=chapters[i]; if(Number(ch)<(w.paid_start??0)) continue;
    if(nums&&!nums.has(String(Number(ch)))) throw new Error(`الفصل ${ch} لم ينشر على أزورا بعد`);
    const type=types.length===1?types[0]:types[i];
    if(s.records.some(e=>e.userId!==String(c.payload.userId)&&e.month_key===s.settings.active_month&&e.work_name===w.name&&Number(e.chapter)===Number(ch)&&e.work_type===type)) throw new Error(`الفصل ${ch} (${type}) مسجل لدى عضو آخر`);
  }
}
