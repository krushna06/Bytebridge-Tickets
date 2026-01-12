import { listPanels, createPanel, deletePanel, updatePanel, updatePanelMessage, getPanelById, getCategoryById } from '../../lib/database';
import { TicketManager } from '../../structures/TicketManager';

export function registerPanelRoutes(app: any, requireKey: any, ticketManager: TicketManager) {
  app.get('/api/guilds/:guildId/panels', requireKey, (req: any, res: any) => {
    const guildId = req.params.guildId;
    const panels = listPanels(guildId);
    res.json(panels);
  });

  app.post('/api/guilds/:guildId/panels', requireKey, (req: any, res: any) => {
    const guildId = req.params.guildId;
    const { title, description, embedColor, categoryIds, buttons } = req.body || {};
    try {
      if (!categoryIds || categoryIds.length === 0) {
        return res.status(400).json({ error: 'At least one category is required' });
      }
      let panelButtons = categoryIds.map((catId: string) => {
        const category = getCategoryById(Number(catId));
        const label = category ? category.name : `Category ${catId}`;
        const discordCategoryId = category ? category.discordCategoryId : null;
        const categoryDbId = category ? category.id : null;
        const buttonConfig = buttons && buttons[catId];
        return { 
          label, 
          categoryId: discordCategoryId, 
          categoryDbId,
          color: buttonConfig?.color || null,
          emoji: buttonConfig?.emoji || null
        };
      });
      const panelId = createPanel(guildId, title || 'Ticket Panel', 'dashboard', panelButtons, embedColor || null, description || null);
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
          const categoryDbId = category ? category.id : null;
          const buttonConfig = req.body.buttons && req.body.buttons[catId];
          return { 
            label, 
            categoryId: discordCategoryId, 
            categoryDbId,
            color: buttonConfig?.color || null,
            emoji: buttonConfig?.emoji || null
          };
        });
        updates.buttons = JSON.stringify(buttons);
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }
      updatePanel(panelId, updates);

      if (panel.channelId && panel.messageId) {
        try {
          const channel = await ticketManager.client.channels.fetch(panel.channelId) as any;
          if (channel && channel.isTextBased && channel.isTextBased()) {
            const message = await channel.messages.fetch(panel.messageId);
            if (message) {
              const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
              const updatedPanel = getPanelById(panelId);
              const embed = new EmbedBuilder()
                .setTitle((updatedPanel as any)?.title || 'Ticket Panel')
                .setDescription((updatedPanel as any)?.description || 'Click a button below to open a ticket.');
              if ((updatedPanel as any)?.embedColor) {
                embed.setColor((updatedPanel as any).embedColor as any);
              }
              const row = new ActionRowBuilder<any>();
              const buttons = updatedPanel?.buttons || [];
              buttons.slice(0, 5).forEach((b: any, idx: number) => {
                const label = (b && (b.label || b)) || `Category ${idx + 1}`;
                const emoji = b?.emoji || null;
                const color = b?.color || 'Primary';
                const btn = new ButtonBuilder()
                  .setCustomId(`panel_open:${panelId}:${idx}`)
                  .setLabel(label)
                  .setStyle((ButtonStyle as any)[color] || ButtonStyle.Primary);
                if (emoji) btn.setEmoji(emoji);
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
    const { channelId, includeStats } = req.body || {};
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
        .setTitle((panel as any).title || 'Ticket Panel')
        .setDescription((panel as any).description || 'Click a button below to open a ticket.');
      if ((panel as any).embedColor) {
        embed.setColor((panel as any).embedColor as any);
      }
      const row = new ActionRowBuilder<any>();
      panel.buttons.slice(0, 5).forEach((b: any, idx: number) => {
        const label = (b && (b.label || b)) || `Category ${idx + 1}`;
        const emoji = b?.emoji || null;
        const color = b?.color || 'Primary';
        const btn = new ButtonBuilder()
          .setCustomId(`panel_open:${panel.id}:${idx}`)
          .setLabel(label)
          .setStyle((ButtonStyle as any)[color] || ButtonStyle.Primary);
        if (emoji) btn.setEmoji(emoji);
        row.addComponents(btn as any);
      });
      const sent = await channel.send({ embeds: [embed], components: [row as any] });
      updatePanelMessage(panel.id, channel.id, sent.id);

      if (includeStats) {
        const { updateStatsEmbeds } = await import('../../lib/statsUpdater');
        const { updatePanelStatsMessage } = await import('../../lib/database');
        const statsEmbed = (await import('../../handlers/panels')).createStatsEmbed(req.params.guildId, (panel as any).embedColor || undefined);
        const statsSent = await channel.send({ embeds: [statsEmbed] });
        updatePanelStatsMessage(panel.id, statsSent.id);
        updateStatsEmbeds(ticketManager.client, req.params.guildId).catch((err: any) => console.error('Failed to update stats embeds:', err));
      }

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
            if ((panel as any).statsMessageId) {
              try {
                await channel.messages.delete((panel as any).statsMessageId);
              } catch (err: any) {
                console.warn(`Failed to delete stats message from Discord: ${err?.message}`);
              }
            }
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
