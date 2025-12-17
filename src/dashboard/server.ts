import express from 'express';
import fs from 'fs';
import path from 'path';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { getGuildSettings, upsertGuildSettings, listTicketsForGuild, getTicketById, updateTicketRow } from '../lib/database';

dotenv.config();

const app = express();
app.use(bodyParser.json());

const API_KEY = process.env.DASHBOARD_API_KEY || '';

function requireApiKey(req: any, res: any, next: any) {
  const key = req.header('X-API-KEY') || req.query.apiKey;
  if (!key || key !== API_KEY) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.get('/api/guilds/:guildId/settings', requireApiKey, (req: any, res: any) => {
  const s = getGuildSettings(req.params.guildId);
  res.json(s || {});
});

app.post('/api/guilds/:guildId/settings', requireApiKey, (req: any, res: any) => {
  const payload = req.body;
  payload.guildId = req.params.guildId;
  if (payload.allowedRoles && Array.isArray(payload.allowedRoles)) payload.allowedRoles = JSON.stringify(payload.allowedRoles);
  upsertGuildSettings(payload);
  res.json({ ok: true });
});

app.get('/api/guilds/:guildId/tickets', requireApiKey, (req: any, res: any) => {
  const rows = listTicketsForGuild(req.params.guildId);
  res.json(rows);
});

app.post('/api/guilds/:guildId/tickets/:ticketId/close', requireApiKey, async (req: any, res: any) => {
  const id = Number(req.params.ticketId);
  const ticket = getTicketById(id);
  if (!ticket) return res.status(404).json({ error: 'not found' });
  updateTicketRow(id, { status: 'closed', closedAt: Date.now() });

  const botUrl = process.env.BOT_API_URL;
  const botKey = process.env.BOT_API_KEY || process.env.DASHBOARD_API_KEY;
  if (botUrl && botKey) {
    try {
      const urlObj = new URL('/internal/close-ticket', botUrl);
      const payload = JSON.stringify({ channelId: ticket.channelId, closerId: req.body.closerId || 'dashboard' });
      const lib = urlObj.protocol === 'https:' ? require('https') : require('http');
      const opts = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'X-BOT-KEY': botKey
        }
      } as any;

      await new Promise<void>((resolve, reject) => {
        const req2 = lib.request(opts, (resp: any) => {
          let data = '';
          resp.on('data', (c: any) => data += c);
          resp.on('end', () => resolve());
        });
        req2.on('error', (e: any) => reject(e));
        req2.write(payload);
        req2.end();
      });
    } catch (e) {
      console.warn('Failed to call bot API to close ticket', e);
    }
  }

  res.json({ ok: true });
});

app.get('/api/transcript', requireApiKey, (req: any, res: any) => {
  const filepath = req.query.path as string;
  if (!filepath) return res.status(400).json({ error: 'missing path' });
  const abs = path.resolve(filepath);
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'not found' });
  res.download(abs);
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`Dashboard API listening on ${PORT}`));

export default app;
