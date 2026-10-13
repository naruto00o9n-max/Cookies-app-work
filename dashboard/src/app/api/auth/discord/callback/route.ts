import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { issueGrant } from "@/lib/mobile-auth";
import { nativeDb } from "@/lib/native-service";
import { discordMemberPatch } from "@/lib/discord-members";
import { setSessionCookie } from "@/lib/session";
import { DISCORD_API, redirectUri, PERM_ADMINISTRATOR, PERM_MANAGE_MESSAGES } from "@/lib/discord";

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  discriminator?: string;
}

export async function GET(req: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!clientId || !clientSecret || !code) {
    return NextResponse.redirect(new URL("/?auth=error", req.url));
  }

  const store = await cookies();
  const savedState = store.get("ct_oauth_state")?.value;
  if (!state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/?auth=state", req.url));
  }
  store.set("ct_oauth_state", "", { path: "/", maxAge: 0 });

  const challenge = store.get("ct_mobile_challenge")?.value;
  store.set("ct_mobile_challenge", "", { path: "/", maxAge: 0 });
  const fail=(reason:string)=>NextResponse.redirect(challenge?`cookiestracker://auth?error=${reason}`:new URL(`/?auth=${reason}`,req.url));
  try {
    if (!process.env.DISCORD_GUILD_ID) throw new Error("DISCORD_GUILD_ID is required");
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri(req),
      }),
    });
    if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}`);
    const token = (await tokenRes.json()) as { access_token: string };

    const headers = { Authorization: `Bearer ${token.access_token}` };
    const [userRes, guildsRes] = await Promise.all([
      fetch(`${DISCORD_API}/users/@me`, { headers }),
      fetch(`${DISCORD_API}/users/@me/guilds`, { headers }),
    ]);
    if (!userRes.ok) throw new Error(`user ${userRes.status}`);
    const dUser = (await userRes.json()) as DiscordUser;

    if (!guildsRes.ok) throw new Error("Cannot verify team membership");
    let isAdmin = false;
    const ownerIds = (process.env.DISCORD_OWNER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (ownerIds.includes(dUser.id)) isAdmin = true;

    if (guildsRes.ok) {
      const guilds = (await guildsRes.json()) as Array<{ id: string; owner: boolean; permissions: string }>;
      const guildId = process.env.DISCORD_GUILD_ID;
      if (guildId) {
        const g = guilds.find((x) => x.id === guildId);
        if (!g) {
          return fail("notmember");
        }
        if (g.owner || ownerIds.includes(dUser.id)) isAdmin = true;
        if (!isAdmin) {
          const perms = BigInt(g.permissions || "0");
          if ((perms & PERM_ADMINISTRATOR) !== 0n || (perms & PERM_MANAGE_MESSAGES) !== 0n) isAdmin = true;
        }
      } else {
        if (guilds.some((g) => g.owner)) isAdmin = true;
      }
    }

    const membershipRes = await fetch(`${DISCORD_API}/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`, { headers });
    if (!membershipRes.ok) throw new Error(`member profile ${membershipRes.status}; sign in again to grant guilds.members.read`);
    const membership = await membershipRes.json() as { nick?: string | null; avatar?: string | null; joined_at?: string };
    const profile = discordMemberPatch({ ...membership, user: dUser }, process.env.DISCORD_GUILD_ID);
    const user = {
      id: dUser.id,
      username: dUser.username,
      globalName: membership.nick || dUser.global_name || dUser.username,
      avatar: profile.avatar,
      isAdmin,
    };
    const db = nativeDb();
    if (!db) throw new Error("Database not configured");
    const members = db.collection("members");
    const existing = await members.findOne({ _id: user.id as never });
    if (existing?.blocked) return fail("blocked");
    const now = new Date().toISOString();
    await members.updateOne({ _id: user.id as never }, {
      $set: { ...profile, isAdmin, appRegistered: true, lastLoginAt: now, last_seen: now },
      $setOnInsert: { first_seen: now },
    }, { upsert: true });
    await members.updateOne({ _id: user.id as never, firstLoginAt: { $exists: false } }, { $set: { firstLoginAt: now } });
    if (challenge) {
      const grant = await issueGrant(user, challenge);
      return NextResponse.redirect(`cookiestracker://auth?code=${encodeURIComponent(grant)}`);
    }
    await setSessionCookie(user);

    return NextResponse.redirect(new URL("/", req.url));
  } catch (e) {
    console.error("[OAUTH] callback failed:", e);
    return fail("error");
  }
}
