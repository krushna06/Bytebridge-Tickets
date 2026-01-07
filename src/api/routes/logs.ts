import { listTicketsForGuild, listFeedbackForGuild } from '../../lib/database';

export function registerLogRoutes(app: any, requireKey: any) {
  app.get('/api/guilds/:guildId/logs', requireKey, (req: any, res: any) => {
    const guildId = req.params.guildId;
    const count = Math.min(Number(req.query.count) || 100, 500); // Max 500 logs
    const tickets = listTicketsForGuild(guildId) as any[];
    const feedbacks = listFeedbackForGuild(guildId) as any[];
    type LogItem = { id: string; type: 'info' | 'success' | 'error'; action: string; details: string; timestamp: number };
    const logs: LogItem[] = [];

    for (const t of tickets) {
      logs.push({
        id: `ticket-created-${t.id}`,
        type: 'info',
        action: 'Ticket Created',
        details: `Ticket #${t.id} for user ${t.userId}`,
        timestamp: Number(t.createdAt) || Date.now()
      });
      if (t.closedAt) {
        logs.push({
          id: `ticket-closed-${t.id}`,
          type: 'success',
          action: 'Ticket Resolved',
          details: `Ticket #${t.id} closed by ${t.closedBy || 'system'}`,
          timestamp: Number(t.closedAt)
        });
      }
    }

    for (const f of feedbacks) {
      logs.push({
        id: `feedback-${f.id}`,
        type: 'success',
        action: 'Feedback Submitted',
        details: `Rating ${f.score}/5 for ticket #${f.ticketId}`,
        timestamp: Number(f.createdAt) || Date.now()
      });
    }

    logs.sort((a, b) => b.timestamp - a.timestamp);
    const limited = logs.slice(0, count).map(l => ({
      id: l.id,
      type: l.type,
      action: l.action,
      details: l.details,
      timestamp: new Date(l.timestamp).toISOString()
    }));

    res.json(limited);
  });

  app.post('/api/guilds/:guildId/logs/purge', requireKey, (req: any, res: any) => {
    try {
      res.json({ ok: true, deletedCount: 0, message: 'Logs are generated from tickets and feedbacks. To delete data, delete tickets or feedbacks individually.' });
    } catch (err: any) {
      console.error('Error purging logs', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });
}
