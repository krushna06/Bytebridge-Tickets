import { TicketManager } from '../../structures/TicketManager';

export function registerChannelRoutes(app: any, requireKey: any, ticketManager: TicketManager) {
  app.get('/api/guilds/:guildId/channels', requireKey, async (req: any, res: any) => {
    const guildId = req.params.guildId;
    try {
      const guild = await ticketManager.client.guilds.fetch(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });
      const channels = await guild.channels.fetch();
      const textChannels = channels
        .filter((ch: any) => ch && ch.isTextBased && ch.isTextBased())
        .map((ch: any) => ({ id: ch.id, name: ch.name }));
      res.json(textChannels);
    } catch (err: any) {
      console.error('Error fetching channels', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });

  app.get('/api/guilds/:guildId/discord-categories', requireKey, async (req: any, res: any) => {
    const guildId = req.params.guildId;
    try {
      const guild = await ticketManager.client.guilds.fetch(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });
      const channels = await guild.channels.fetch();
      const categories = channels
        .filter((ch: any) => ch && ch.type === 4) // 4 = GUILD_CATEGORY
        .map((ch: any) => ({ id: ch.id, name: ch.name }));
      res.json(categories);
    } catch (err: any) {
      console.error('Error fetching Discord categories', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });
}
