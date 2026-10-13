import crypto from "node:crypto";
import { MongoClient } from "mongodb";
import type { SessionUser } from "./session";

type Grant = { _id: string; challenge: string; user: SessionUser; expires: Date };
const local = new Map<string, Grant>();
let client: MongoClient | undefined;
function collection() {
  client ||= new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8000 });
  return client.db(process.env.MONGODB_DB_NAME || "work_bot").collection<Grant>("mobile_auth_grants");
}
export async function issueGrant(user: SessionUser, challenge: string) {
  const code = crypto.randomBytes(32).toString("base64url");
  const grant = { _id: code, user, challenge, expires: new Date(Date.now() + 60_000) };
  if (process.env.MONGODB_URI) {
    await collection().createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
    await collection().insertOne(grant);
  } else {
    for (const [key, value] of local) if (+value.expires < Date.now()) local.delete(key);
    local.set(code, grant);
  }
  return code;
}
export async function redeemGrant(code: string, verifier: string) {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) return null;
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  if (process.env.MONGODB_URI) {
    const grant = await collection().findOneAndDelete({ _id: code, challenge, expires: { $gt: new Date() } });
    return grant?.user || null;
  }
  const grant = local.get(code);
  if (!grant || grant.challenge !== challenge || +grant.expires < Date.now()) return null;
  local.delete(code);
  return grant.user;
}
