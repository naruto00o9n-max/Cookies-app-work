import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirectUri } from "@/lib/discord";

/** يبدأ تدفق OAuth2 الخاص بديسكورد */
export async function GET(req: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId || !process.env.DISCORD_CLIENT_SECRET) {
    return NextResponse.json({ error: "OAuth غير مفعّل — اضبط DISCORD_CLIENT_ID و DISCORD_CLIENT_SECRET" }, { status: 501 });
  }
  const url = new URL(req.url);
  const challenge = url.searchParams.get("challenge");
  if (challenge && !/^[A-Za-z0-9_-]{43}$/.test(challenge)) return NextResponse.json({ error: "Invalid challenge" }, { status: 400 });
  const state = crypto.randomBytes(16).toString("hex");
  const store = await cookies();
  store.set("ct_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  store.set("ct_mobile_challenge", challenge || "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: challenge ? 600 : 0 });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(req),
    response_type: "code",
    scope: "identify guilds",
    state,
    prompt: "consent",
  });
  return NextResponse.redirect(`https://discord.com/oauth2/authorize?${params}`);
}
