import { listTicketsForGuild, getTicketById, updateTicketRow, deleteTicketRow } from '../../lib/database';
import { TicketManager } from '../../structures/TicketManager';

export function registerTicketRoutes(app: any, requireKey: any, ticketManager: TicketManager) {
  app.get('/api/guilds/:guildId/tickets', requireKey, (req: any, res: any) => {
    const rows = listTicketsForGuild(req.params.guildId);
    res.json(rows);
  });

  app.get('/api/guilds/:guildId/tickets/:ticketId', requireKey, (req: any, res: any) => {
    const id = Number(req.params.ticketId);
    const ticket = getTicketById(id);
    if (!ticket) return res.status(404).json({ error: 'not found' });
    res.json(ticket);
  });

  app.post('/api/guilds/:guildId/tickets/:ticketId/close', requireKey, async (req: any, res: any) => {
    const id = Number(req.params.ticketId);
    const ticket = getTicketById(id);
    if (!ticket) return res.status(404).json({ error: 'not found' });
    updateTicketRow(id, { status: 'closed', closedAt: Date.now() });

    try {
      const result = await ticketManager.closeTicket(ticket.channelId, req.body.closerId || 'dashboard');
      return res.json({ ok: true, transcriptPath: result.transcriptPath, ticketId: result.ticketId });
    } catch (err: any) {
      console.error('Error in /api/guilds/:guildId/tickets/:ticketId/close', err);
      return res.status(500).json({ error: err?.message || 'internal error' });
    }
  });

  app.post('/api/guilds/:guildId/tickets/:ticketId/reopen', requireKey, (req: any, res: any) => {
    const id = Number(req.params.ticketId);
    const ticket = getTicketById(id);
    if (!ticket) return res.status(404).json({ error: 'not found' });
    updateTicketRow(id, { status: 'open', closedAt: null });
    res.json({ ok: true });
  });

  app.delete('/api/guilds/:guildId/tickets/:ticketId', requireKey, (req: any, res: any) => {
    const id = Number(req.params.ticketId);
    const ticket = getTicketById(id);
    if (!ticket) return res.status(404).json({ error: 'not found' });
    try {
      deleteTicketRow(id);
      res.json({ ok: true });
    } catch (err: any) {
      console.error('Error deleting ticket', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });
}
