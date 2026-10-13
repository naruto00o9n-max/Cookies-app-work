// Read-only deployment check. Report public bot identity and HTTP statuses only.
const token = process.env.DISCORD_BOT_TOKEN;
const guild = process.env.DISCORD_GUILD_ID;
if (token && guild) {
  try {
    const get = (path) => fetch('https://discord.com/api/v10' + path, { headers: { Authorization: 'Bot ' + token }, signal: AbortSignal.timeout(10000) });
    const identity = await get('/users/@me');
    if (!identity.ok) console.info('[Discord setup]', JSON.stringify({ stage: 'bot-token', status: identity.status }));
    else {
      const bot = await identity.json();
      const server = await get('/guilds/' + guild);
      if (!server.ok) console.info('[Discord setup]', JSON.stringify({ stage: 'guild-access', status: server.status, botId: bot.id, botName: bot.username }));
      else {
        const members = await get('/guilds/' + guild + '/members?limit=1');
        console.info('[Discord setup]', JSON.stringify({ stage: 'member-list', status: members.status, botId: bot.id, botName: bot.username }));
      }
    }
  } catch { console.info('[Discord setup] Network check unavailable; retry from the control room.'); }
}
