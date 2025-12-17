import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { TicketManager } from '../structures/TicketManager';

dotenv.config();

const BOT_API_KEY = process.env.BOT_API_KEY || process.env.DASHBOARD_API_KEY || '';

export async function startBotApi(ticketManager: TicketManager) {
  const app = express();
  app.use(bodyParser.json());

  function requireKey(req: any, res: any, next: any) {
    const key = req.header('X-BOT-KEY');
    if (!key || key !== BOT_API_KEY) return res.status(401).json({ error: 'unauthorized' });
    next();
  }

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

  const port = Number(process.env.BOT_API_PORT || 3001);
  return new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.log(`Bot internal API listening on ${port}`);
      resolve();
    });
  });
}

export default startBotApi;
