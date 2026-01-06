import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import {
  getGuildSettings,
  upsertGuildSettings, 
  listTicketsForGuild,
  getTicketById,
  updateTicketRow,
  countTicketsByGuild,
  countOpenTicketsByGuild,
  listPanels,
  listFeedbackForGuild,
  deleteTicketRow,
  createPanel,
  deletePanel,
  updatePanel,
  deleteFeedback,
  updatePanelMessage,
  getPanelById,
  createCategory,
  listCategories,
  deleteCategory,
  getCategoryById
} from '../lib/database';
import { TicketManager } from '../structures/TicketManager';

dotenv.config();

const BOT_API_KEY = process.env.BOT_API_KEY || process.env.DASHBOARD_API_KEY || '';

function registerSettingsRoutes(app: any, requireKey: any) {
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
      logsChannel: s && s.logsChannelId ? s.logsChannelId : ''
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
      logsChannelId: body.logsChannel || (existing ? existing.logsChannelId : null)
    } as any;
    upsertGuildSettings(toSave);
    res.json({ ok: true });
  });
}

function registerOverviewRoutes(app: any, requireKey: any) {
  app.get('/api/guilds/:guildId/overview', requireKey, (req: any, res: any) => {
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
}

function registerTicketRoutes(app: any, requireKey: any, ticketManager: TicketManager) {
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

function registerTranscriptRoutes(app: any, requireKey: any, ticketManager: TicketManager) {
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

function registerPanelRoutes(app: any, requireKey: any, ticketManager: TicketManager) {
  app.get('/api/guilds/:guildId/panels', requireKey, (req: any, res: any) => {
    const guildId = req.params.guildId;
    const panels = listPanels(guildId);
    res.json(panels);
  });

  app.post('/api/guilds/:guildId/panels', requireKey, (req: any, res: any) => {
    const guildId = req.params.guildId;
    const { title, description, embedColor, categoryIds } = req.body || {};
    try {
      if (!categoryIds || categoryIds.length === 0) {
        return res.status(400).json({ error: 'At least one category is required' });
      }
      const buttons = categoryIds.map((catId: string) => {
        const category = getCategoryById(Number(catId));
        const label = category ? category.name : `Category ${catId}`;
        const discordCategoryId = category ? category.discordCategoryId : null;
        return { label, categoryId: discordCategoryId };
      });
      const panelId = createPanel(guildId, title || 'Ticket Panel', 'dashboard', buttons, embedColor || null, description || null);
      res.json({ ok: true, id: panelId });
    } catch (err: any) {
      console.error('Error creating panel', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });

  app.put('/api/guilds/:guildId/panels/:panelId', requireKey, async (req: any, res: any) => {
    const panelId = Number(req.params.panelId);
    const { title, description, embedColor, categoryIds } = req.body || {};
    try {
      const panel = getPanelById(panelId);
      if (!panel) {
        return res.status(404).json({ error: 'Panel not found' });
      }

      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (embedColor !== undefined) updates.embedColor = embedColor;
      if (categoryIds && Array.isArray(categoryIds)) {
        const buttons = categoryIds.map((catId: string) => {
          const category = getCategoryById(Number(catId));
          const label = category ? category.name : `Category ${catId}`;
          const discordCategoryId = category ? category.discordCategoryId : null;
          return { label, categoryId: discordCategoryId };
        });
        updates.buttons = JSON.stringify(buttons);
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }
      updatePanel(panelId, updates);

      // Update the message in Discord if it was posted
      if (panel.channelId && panel.messageId) {
        try {
          const channel = await ticketManager.client.channels.fetch(panel.channelId) as any;
          if (channel && channel.isTextBased && channel.isTextBased()) {
            const message = await channel.messages.fetch(panel.messageId);
            if (message) {
              const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
              const updatedPanel = getPanelById(panelId);
              const embed = new EmbedBuilder()
                .setTitle(updatedPanel?.title || 'Ticket Panel')
                .setDescription(updatedPanel?.description || 'Click a button below to open a ticket.');
              if (updatedPanel?.embedColor) {
                embed.setColor(updatedPanel.embedColor as any);
              }
              const row = new ActionRowBuilder<any>();
              const buttons = updatedPanel?.buttons || [];
              buttons.slice(0, 5).forEach((b: any, idx: number) => {
                const label = (b && (b.label || b)) || `Category ${idx + 1}`;
                const btn = new ButtonBuilder().setCustomId(`panel_open:${panelId}:${idx}`).setLabel(label).setStyle(ButtonStyle.Primary as any);
                row.addComponents(btn as any);
              });
              await message.edit({ embeds: [embed], components: [row as any] });
            }
          }
        } catch (err: any) {
          console.warn(`Failed to update panel message in Discord: ${err?.message}`);
        }
      }

      res.json({ ok: true });
    } catch (err: any) {
      console.error('Error updating panel', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });

  app.post('/api/guilds/:guildId/panels/:panelId/send', requireKey, async (req: any, res: any) => {
    const panelId = Number(req.params.panelId);
    const { channelId } = req.body || {};
    try {
      if (!channelId) {
        return res.status(400).json({ error: 'channelId is required' });
      }
      const panel = getPanelById(panelId);
      if (!panel) {
        return res.status(404).json({ error: 'Panel not found' });
      }
      const channel = await ticketManager.client.channels.fetch(channelId) as any;
      if (!channel || !channel.isTextBased || !channel.isTextBased()) {
        return res.status(400).json({ error: 'Invalid text channel' });
      }
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
      const embed = new EmbedBuilder()
        .setTitle(panel.title || 'Ticket Panel')
        .setDescription(panel.description || 'Click a button below to open a ticket.');
      if (panel.embedColor) {
        embed.setColor(panel.embedColor as any);
      }
      const row = new ActionRowBuilder<any>();
      panel.buttons.slice(0, 5).forEach((b: any, idx: number) => {
        const label = (b && (b.label || b)) || `Category ${idx + 1}`;
        const btn = new ButtonBuilder().setCustomId(`panel_open:${panel.id}:${idx}`).setLabel(label).setStyle(ButtonStyle.Primary as any);
        row.addComponents(btn as any);
      });
      const sent = await channel.send({ embeds: [embed], components: [row as any] });
      updatePanelMessage(panel.id, channel.id, sent.id);
      res.json({ ok: true });
    } catch (err: any) {
      console.error('Error sending panel', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });

  app.delete('/api/guilds/:guildId/panels/:panelId', requireKey, async (req: any, res: any) => {
    const panelId = Number(req.params.panelId);
    try {
      const panel = getPanelById(panelId);
      if (panel && panel.channelId && panel.messageId) {
        try {
          const channel = await ticketManager.client.channels.fetch(panel.channelId) as any;
          if (channel && channel.isTextBased && channel.isTextBased()) {
            await channel.messages.delete(panel.messageId);
          }
        } catch (err: any) {
          console.warn(`Failed to delete panel message from Discord: ${err?.message}`);
        }
      }
      deletePanel(panelId);
      res.json({ ok: true });
    } catch (err: any) {
      console.error('Error deleting panel', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });
}

function registerCategoryRoutes(app: any, requireKey: any) {
  app.get('/api/guilds/:guildId/categories', requireKey, (req: any, res: any) => {
    const guildId = req.params.guildId;
    const categories = listCategories(guildId);
    res.json(categories);
  });

  app.post('/api/guilds/:guildId/categories', requireKey, (req: any, res: any) => {
    const guildId = req.params.guildId;
    const { name, discordCategoryId } = req.body || {};
    try {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Category name is required' });
      }
      const categoryId = createCategory(guildId, name.trim(), discordCategoryId || null);
      res.json({ ok: true, id: categoryId });
    } catch (err: any) {
      console.error('Error creating category', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });

  app.delete('/api/guilds/:guildId/categories/:categoryId', requireKey, (req: any, res: any) => {
    const categoryId = Number(req.params.categoryId);
    try {
      deleteCategory(categoryId);
      res.json({ ok: true });
    } catch (err: any) {
      console.error('Error deleting category', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });
}

function registerChannelRoutes(app: any, requireKey: any, ticketManager: TicketManager) {
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

function registerFeedbackRoutes(app: any, requireKey: any) {
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

function registerLogRoutes(app: any, requireKey: any) {
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
      const guildId = req.params.guildId;
      const tickets = listTicketsForGuild(guildId) as any[];
      const feedbacks = listFeedbackForGuild(guildId) as any[];
      
      let deletedCount = 0;
      
      // Delete all tickets
      for (const t of tickets) {
        try {
          deleteTicketRow(t.id);
          deletedCount++;
        } catch (e) {
          console.warn(`Failed to delete ticket ${t.id}`, e);
        }
      }
      
      // Delete all feedbacks
      for (const f of feedbacks) {
        try {
          deleteFeedback(f.id);
          deletedCount++;
        } catch (e) {
          console.warn(`Failed to delete feedback ${f.id}`, e);
        }
      }
      
      res.json({ ok: true, deletedCount });
    } catch (err: any) {
      console.error('Error purging logs', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });
}

function registerTranscriptFileRoute(app: any) {
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

function registerInternalRoutes(app: any, requireKey: any, ticketManager: TicketManager) {
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

export async function startBotApi(ticketManager: TicketManager) {
  const app = express();
  const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
  app.use(cors({ origin: dashboardUrl }));
  app.use(bodyParser.json());

  const requireKey = (req: any, res: any, next: any) => {
    const key = req.header('X-BOT-KEY') || req.header('X-API-KEY') || req.query.apiKey;
    if (!key || key !== BOT_API_KEY) return res.status(401).json({ error: 'unauthorized' });
    next();
  };

  registerInternalRoutes(app, requireKey, ticketManager);
  registerSettingsRoutes(app, requireKey);
  registerOverviewRoutes(app, requireKey);
  registerTicketRoutes(app, requireKey, ticketManager);
  registerTranscriptRoutes(app, requireKey, ticketManager);
  registerCategoryRoutes(app, requireKey);
  registerChannelRoutes(app, requireKey, ticketManager);
  registerPanelRoutes(app, requireKey, ticketManager);
  registerFeedbackRoutes(app, requireKey);
  registerLogRoutes(app, requireKey);
  registerTranscriptFileRoute(app);

  const port = Number(process.env.BOT_API_PORT || 3001);
  return new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.log(`Bot internal API listening on ${port}`);
      resolve();
    });
  });
}

export default startBotApi;
