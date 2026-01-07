import { listFeedbackForGuild, deleteFeedback } from '../../lib/database';

export function registerFeedbackRoutes(app: any, requireKey: any) {
  app.get('/api/guilds/:guildId/feedbacks', requireKey, (req: any, res: any) => {
    const guildId = req.params.guildId;
    const feedbacks = listFeedbackForGuild(guildId);
    const items = feedbacks.map((f: any) => {
      const date = new Date(Number(f.createdAt) || Date.now()).toISOString();
      return {
        id: String(f.id),
        ticketId: String(f.ticketId),
        userId: String(f.userId),
        score: Number(f.score),
        handledBy: f.handledBy ? String(f.handledBy) : null,
        date
      };
    });
    res.json(items);
  });

  app.delete('/api/guilds/:guildId/feedbacks/:feedbackId', requireKey, (req: any, res: any) => {
    const feedbackId = Number(req.params.feedbackId);
    try {
      deleteFeedback(feedbackId);
      res.json({ ok: true });
    } catch (err: any) {
      console.error('Error deleting feedback', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });
}
