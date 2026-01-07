import { TicketManager } from '../../structures/TicketManager';

export function registerInternalRoutes(app: any, requireKey: any, ticketManager: TicketManager) {
  app.post('/internal/close-ticket', requireKey, async (req: any, res: any) => {
    try {
      const { channelId, closerId } = req.body;
      if (!channelId) return res.status(400).json({ error: 'missing channelId' });
      const result = await ticketManager.closeTicket(channelId, closerId);
      return res.json({ ok: true, transcriptPath: result.transcriptPath, ticketId: result.ticketId });
    } catch (err: any) {
      console.error('Error in /internal/close-ticket', err);
      return res.status(500).json({ error: err?.message || 'internal error' });
    }
  });
}
