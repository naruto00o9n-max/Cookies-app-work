import { PERM_ADMINISTRATOR, PERM_MANAGE_MESSAGES } from "./discord";
import type { MemberDoc } from "./store/types";
import type { Member } from "../../../mobile/src/lib/types";

export interface DiscordMemberProfile {
  user: { id: string; username: string; global_name?: string | null; avatar?: string | null; discriminator?: string; bot?: boolean };
  nick?: string | null;
  avatar?: string | null;
  joined_at?: string;
  roles?: string[];
}

/** Guild avatars take priority; Discord supplies a real default avatar even without an upload. */
export function discordMemberPatch(member: DiscordMemberProfile, guildId: string): Partial<MemberDoc> {
  const user = member.user;
  const hash = member.avatar || user.avatar;
  const base = member.avatar
    ? `https://cdn.discordapp.com/guilds/${guildId}/users/${user.id}/avatars`
    : `https://cdn.discordapp.com/avatars/${user.id}`;
  const defaultIndex = user.discriminator && user.discriminator !== "0"
    ? Number(user.discriminator) % 5
    : Number((BigInt(user.id) >> BigInt(22)) % BigInt(6));
  return {
    username: user.username,
    nickname: member.nick || "",
    globalName: user.global_name || null,
    avatar: hash ? `${base}/${hash}.${hash.startsWith("a_") ? "gif" : "png"}?size=256` : `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`,
    ...(member.joined_at ? { joinedAt: member.joined_at } : {}),
    guildPresent: true,
  };
}

export function publicMember(member: MemberDoc): Member {
  return {
    id: String(member._id),
    name: member.nickname || member.globalName || member.username || String(member._id),
    avatar: member.avatar,
    username: member.username,
    nickname: member.nickname,
    globalName: member.globalName,
    joinedAt: member.joinedAt,
    firstLoginAt: member.firstLoginAt,
    lastLoginAt: member.lastLoginAt,
    appRegistered: Boolean(member.appRegistered),
    isAdmin: Boolean(member.isAdmin),
    blocked: Boolean(member.blocked),
    title: member.title,
  };
}

export function discordIsAdmin(member: DiscordMemberProfile, guildId: string, ownerId: string, roles: Array<{ id: string; permissions: string }>, ownerIds: readonly string[] = []): boolean {
  if (member.user.id === ownerId || ownerIds.includes(member.user.id)) return true;
  const ownRoles = new Set([guildId, ...(member.roles || [])]);
  let permissions = 0n;
  for (const role of roles) if (ownRoles.has(role.id)) permissions |= BigInt(role.permissions || "0");
  return (permissions & PERM_ADMINISTRATOR) !== 0n || (permissions & PERM_MANAGE_MESSAGES) !== 0n;
}

