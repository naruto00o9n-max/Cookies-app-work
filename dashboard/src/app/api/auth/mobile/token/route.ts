import { json } from "@/lib/api";
import { redeemGrant } from "@/lib/mobile-auth";
import { createToken } from "@/lib/session";
export async function POST(req: Request) {
  try {
    const { code, verifier } = await req.json();
    if (typeof code !== "string" || typeof verifier !== "string") return json({ error: "طلب غير صالح" }, 400);
    const user = await redeemGrant(code, verifier);
    if (!user) return json({ error: "انتهت صلاحية تسجيل الدخول؛ حاول مجددًا" }, 401);
    return json({ token: createToken(user), user });
  } catch { return json({ error: "تعذر تسجيل الدخول" }, 503); }
}
