import express from 'express';
import fs from 'fs';
import path from 'path';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import {
  getGuildSettings,
  upsertGuildSettings,
  listTicketsForGuild,
  getTicketById,
  updateTicketRow,
  countTicketsByGuild,
  countOpenTicketsByGuild,
  listPanels,
  listFeedbackForGuild
} from '../lib/database';

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
  const out = {
    embedColor: s && s.embedColor ? s.embedColor : '#5865f2',
    embedFooter: s && s.embedFooter ? s.embedFooter : 'Support Team',
    claimEnabled: s && typeof s.claimEnabled !== 'undefined' ? !!s.claimEnabled : true,
    ticketChannel: s && s.ticketChannelId ? s.ticketChannelId : '',
    transcriptChannel: s && s.transcriptChannelId ? s.transcriptChannelId : '',
    feedbackChannel: s && s.feedbackChannelId ? s.feedbackChannelId : '',
    logsChannel: s && s.logsChannelId ? s.logsChannelId : ''
  };
  res.json(out);
});

app.post('/api/guilds/:guildId/settings', requireApiKey, (req: any, res: any) => {
  const guildId = req.params.guildId;
  const existing = getGuildSettings(guildId);
  const body = req.body || {};
  const toSave = {
    guildId,
    staffRoleId: existing ? existing.staffRoleId : null,
    allowedRoles: existing ? existing.allowedRoles : null,
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
    logsChannelId: body.logsChannel || (existing ? existing.logsChannelId : null)
  } as any;
  upsertGuildSettings(toSave);
  res.json({ ok: true });
});

app.get('/api/guilds/:guildId/overview', requireApiKey, (req: any, res: any) => {
  const guildId = req.params.guildId;
  const totalTickets = countTicketsByGuild(guildId);
  const openTickets = countOpenTicketsByGuild(guildId);
  const tickets = listTicketsForGuild(guildId);
  const closed = tickets.filter((t: any) => t.closedAt && t.closedAt > 0);
  const resolveDurations = closed
    .map((t: any) => Number(t.closedAt) - Number(t.createdAt))
    .filter((d: any) => typeof d === 'number' && d >= 0);
  const avgResolveMs = resolveDurations.length
    ? Math.round(resolveDurations.reduce((a: number, b: number) => a + b, 0) / resolveDurations.length)
    : null;

  const responseDurations: number[] = [];
  for (const t of tickets as any[]) {
    if (!t.transcriptPath) continue;
    let content: string;
    try {
      content = fs.readFileSync(t.transcriptPath, 'utf8');
    } catch (e) {
      continue;
    }
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const m = line.match(/^\[(.+?)\].*\((\d+)\):\s*(.*)$/);
      if (!m) continue;
      const ts = Date.parse(m[1]);
      const authorId = m[2];
      if (authorId === String(t.userId)) continue;
      const respMs = ts - Number(t.createdAt);
      if (respMs >= 0) responseDurations.push(respMs);
      break;
    }
  }
  const avgResponseMs = responseDurations.length
    ? Math.round(responseDurations.reduce((a, b) => a + b, 0) / responseDurations.length)
    : null;

  res.json({
    totalTickets,
    openTickets,
    avgResolveMs,
    avgResponseMs
  });
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

  const botUrlEnv = (process.env.BOT_API_URL || '').trim();
  const botHost = process.env.BOT_API_HOST || 'localhost';
  const botPort = process.env.BOT_API_PORT || '3001';
  const botProtocol = process.env.BOT_API_PROTOCOL || 'http';
  const botKey = process.env.BOT_API_KEY || process.env.DASHBOARD_API_KEY;
  const botBase = botUrlEnv || `${botProtocol}://${botHost}:${botPort}`;

  if (botBase && botKey) {
    try {
      const urlObj = new URL('/internal/close-ticket', botBase);
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

app.get('/api/guilds/:guildId/transcripts', requireApiKey, (req: any, res: any) => {
  const guildId = req.params.guildId;
  const tickets = listTicketsForGuild(guildId);
  const items = tickets
    .filter((t: any) => t.transcriptPath && typeof t.transcriptPath === 'string')
    .map((t: any) => {
      const createdAt = Number(t.createdAt);
      const date = new Date(createdAt || Date.now()).toISOString();
      let messages = 0;
      try {
        const content = fs.readFileSync(t.transcriptPath, 'utf8');
        messages = content.split('\n').map(l => l.trim()).filter(Boolean).length;
      } catch (e) {
        messages = 0;
      }
      return {
        id: String(t.id),
        ticketId: String(t.id),
        date,
        messages,
        path: t.transcriptPath
      };
    });
  res.json(items);
});

app.get('/api/guilds/:guildId/panels', requireApiKey, (req: any, res: any) => {
  const guildId = req.params.guildId;
  const panels = listPanels(guildId);
  res.json(panels);
});

app.get('/api/guilds/:guildId/feedbacks', requireApiKey, (req: any, res: any) => {
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

app.get('/api/guilds/:guildId/logs', requireApiKey, (req: any, res: any) => {
  const guildId = req.params.guildId;
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
  const limited = logs.slice(0, 100).map(l => ({
    id: l.id,
    type: l.type,
    action: l.action,
    details: l.details,
    timestamp: new Date(l.timestamp).toISOString()
  }));

  res.json(limited);
});


app.get('/transcripts/:filename', (req: any, res: any) => {
  const filename = req.params.filename as string;
  if (!filename) return res.status(400).send('Missing filename');
  const TRANSCRIPTS_PATH = process.env.TRANSCRIPTS_PATH || path.resolve(process.cwd(), 'transcripts');
  const safe = path.basename(filename); // prevent path traversal
  const abs = path.resolve(TRANSCRIPTS_PATH, safe);
  if (!fs.existsSync(abs)) return res.status(404).send('Transcript not found');
  res.sendFile(abs);
});

const PORT = Number(process.env.PORT || 3000);
const server = app.listen(PORT, () => console.log(`Dashboard API listening on ${PORT}`));
server.on('error', (err: any) => console.error('Dashboard server error', err));

process.on('uncaughtException', (err: any) => {
  console.error('Uncaught exception in dashboard process', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled rejection in dashboard process', reason);
});

export default app;
