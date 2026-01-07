import fs from 'fs';
import path from 'path';
import { listTicketsForGuild } from '../../lib/database';
import { TicketManager } from '../../structures/TicketManager';

export function registerTranscriptRoutes(app: any, requireKey: any, ticketManager: TicketManager) {
  app.get('/api/transcript', requireKey, (req: any, res: any) => {
    const filepath = req.query.path as string;
    if (!filepath) return res.status(400).json({ error: 'missing path' });
    const abs = path.resolve(filepath);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'not found' });
    res.download(abs);
  });

  app.get('/api/transcript-html', requireKey, (req: any, res: any) => {
    const filepath = req.query.path as string;
    if (!filepath) return res.status(400).json({ error: 'missing path' });
    const abs = path.resolve(filepath);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'not found' });
    try {
      const content = fs.readFileSync(abs, 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(content);
    } catch (err: any) {
      console.error('Error reading transcript', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });

  app.get('/api/guilds/:guildId/transcripts', requireKey, (req: any, res: any) => {
    const guildId = req.params.guildId;
    const tickets = listTicketsForGuild(guildId);
    const items = tickets
      .filter((t: any) => t.transcriptPath && typeof t.transcriptPath === 'string')
      .map((t: any) => {
        const createdAt = Number(t.createdAt);
        const date = new Date(createdAt || Date.now()).toISOString();
        return {
          id: String(t.id),
          ticketId: String(t.id),
          date,
          path: t.transcriptPath
        };
      });
    res.json(items);
  });
}

export function registerTranscriptFileRoute(app: any) {
  app.get('/transcripts/:filename', (req: any, res: any) => {
    const filename = req.params.filename as string;
    if (!filename) return res.status(400).send('Missing filename');
    const TRANSCRIPTS_PATH = process.env.TRANSCRIPTS_PATH || path.resolve(process.cwd(), 'transcripts');
    const safe = path.basename(filename);
    const abs = path.resolve(TRANSCRIPTS_PATH, safe);
    if (!fs.existsSync(abs)) return res.status(404).send('Transcript not found');
    res.sendFile(abs);
  });
}
