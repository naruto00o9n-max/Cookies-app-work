import { test } from "node:test";
import assert from "node:assert/strict";
import {
  discordMemberPatch,
  discordIsAdmin,
  publicMember,
} from "../../dashboard/src/lib/discord-profile";

const id = "1342820475595653211";
const guild = "1332820475595653211";
const user = {
  id,
  username: "login-name",
  global_name: "Global name",
  avatar: "account-avatar",
  discriminator: "0",
};

test("server nickname and server avatar take priority without losing the account identity", () => {
  const patch = discordMemberPatch({ user, nick: "Server nickname", avatar: "a_guild-avatar" }, guild);
  const displayed = publicMember({ _id: id, ...patch });
  assert.equal(displayed.name, "Server nickname");
  assert.equal(displayed.username, "login-name");
  assert.match(displayed.avatar!, /guilds\/1332820475595653211\/users\/1342820475595653211\/avatars\/a_guild-avatar.gif/);
});

test("clearing a server nickname falls back to global name and a real Discord default avatar", () => {
  const previous = { _id: id, nickname: "Old nickname", avatar: "old-avatar", title: "Veteran", blocked: true };
  const patch = discordMemberPatch({ user: { ...user, avatar: null }, nick: null }, guild);
  const displayed = publicMember({ ...previous, ...patch });
  assert.equal(displayed.name, "Global name");
  assert.match(displayed.avatar!, /^https:\/\/cdn.discordapp.com\/embed\/avatars\/[0-5]\.png$/);
  assert.equal(displayed.title, "Veteran");
  assert.equal(displayed.blocked, true);
  assert.equal(displayed.appRegistered, false);
});

test("global name falls back to username and uploaded account avatar when guild overrides are absent", () => {
  const displayed = publicMember({ _id: id, ...discordMemberPatch({ user: { ...user, global_name: null } }, guild) });
  assert.equal(displayed.name, "login-name");
  assert.match(displayed.avatar!, /avatars\/1342820475595653211\/account-avatar.png/);
  const legacy = discordMemberPatch({ user: { ...user, avatar: null, discriminator: "1234" } }, guild);
  assert.equal(legacy.avatar, "https://cdn.discordapp.com/embed/avatars/4.png");
});

test("server ownership and actual role permissions determine moderation rights", () => {
  const roles = [
    { id: guild, permissions: "0" },
    { id: "translator", permissions: "0" },
    { id: "moderator", permissions: "8192" },
    { id: "administrator", permissions: "8" },
  ];
  assert.equal(discordIsAdmin({ user, roles: ["translator"] }, guild, "someone-else", roles), false);
  assert.equal(discordIsAdmin({ user, roles: ["moderator"] }, guild, "someone-else", roles), true);
  assert.equal(discordIsAdmin({ user, roles: ["administrator"] }, guild, "someone-else", roles), true);
  assert.equal(discordIsAdmin({ user, roles: [] }, guild, id, roles), true);
  assert.equal(discordIsAdmin({ user, roles: [] }, guild, "someone-else", roles, [id]), true);
});

test("joining the guild does not imply registering in the app", () => {
  const legacy = publicMember({ _id: id, username: "legacy", joinedAt: "2026-01-01" });
  assert.equal(legacy.appRegistered, false);
  assert.equal(legacy.firstLoginAt, undefined);
  const registered = publicMember({ _id: id, appRegistered: true, firstLoginAt: "2026-10-13", lastLoginAt: "2026-10-14" });
  assert.equal(registered.appRegistered, true);
  assert.equal(registered.firstLoginAt, "2026-10-13");
  assert.equal(registered.lastLoginAt, "2026-10-14");
});
