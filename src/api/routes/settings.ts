import { getGuildSettings, upsertGuildSettings } from '../../lib/database';

export function registerSettingsRoutes(app: any, requireKey: any) {
  app.get('/api/guilds/:guildId/settings', requireKey, (req: any, res: any) => {
    const s = getGuildSettings(req.params.guildId);
    let staffRoles = '';
    if (s && s.allowedRoles) {
      try {
        const parsed = JSON.parse(s.allowedRoles);
        staffRoles = Array.isArray(parsed) ? parsed.join(',') : '';
      } catch {
        staffRoles = '';
      }
    }
    const out = {
      embedColor: s && s.embedColor ? s.embedColor : '#5865f2',
      embedFooter: s && s.embedFooter ? s.embedFooter : 'Support Team',
      claimEnabled: s && typeof s.claimEnabled !== 'undefined' ? !!s.claimEnabled : true,
      staffRoles,
      transcriptChannel: s && s.transcriptChannelId ? s.transcriptChannelId : '',
      feedbackChannel: s && s.feedbackChannelId ? s.feedbackChannelId : '',
      logsChannel: s && s.logsChannelId ? s.logsChannelId : '',
      channelPrefix: s && s.channelPrefix ? s.channelPrefix : '{category}-{count}'
    };
    res.json(out);
  });

  app.post('/api/guilds/:guildId/settings', requireKey, (req: any, res: any) => {
    const guildId = req.params.guildId;
    const existing = getGuildSettings(guildId);
    const body = req.body || {};

    let allowedRoles = existing ? existing.allowedRoles : null;
    if (body.staffRoles) {
      const roleIds = body.staffRoles
        .split(',')
        .map((id: string) => id.trim())
        .filter((id: string) => id.length > 0);
      allowedRoles = roleIds.length ? JSON.stringify(roleIds) : null;
    }

    const toSave = {
      guildId,
      staffRoleId: existing ? existing.staffRoleId : null,
      allowedRoles,
      categoryId: existing ? existing.categoryId : null,
      closedCategoryId: existing ? existing.closedCategoryId : null,
      claimEnabled: body.claimEnabled ? 1 : 0,
      transcriptEnabled: existing ? existing.transcriptEnabled : 1,
      transcriptChannelId: body.transcriptChannel || (existing ? existing.transcriptChannelId : null),
      feedbackChannelId: body.feedbackChannel || (existing ? existing.feedbackChannelId : null),
      closeTimeout: existing ? existing.closeTimeout : 0,
      embedColor: body.embedColor || (existing ? existing.embedColor : null),
      embedFooter: body.embedFooter || (existing ? existing.embedFooter : null),
      ticketChannelId: body.ticketChannel || (existing ? existing.ticketChannelId : null),
      logsChannelId: body.logsChannel || (existing ? existing.logsChannelId : null),
      channelPrefix: body.channelPrefix || (existing ? existing.channelPrefix : '{category}-{count}')
    } as any;
    upsertGuildSettings(toSave);
    res.json({ ok: true });
  });
}
