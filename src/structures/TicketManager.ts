import { Client, Guild, GuildMember, ChannelType, PermissionFlagsBits, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { createTicketRow, updateTicketRow, getTicketByChannel, getGuildSettings, getCategoryById, countTicketsByGuild } from '../lib/database';
import { saveChannelTranscript } from '../lib/transcript';
import { getTranscriptBaseUrl } from '../lib/urlHelper';
import { updateStatsEmbeds } from '../lib/statsUpdater';
import { isOutsideWorkingHours } from '../lib/workingHours';

function processWelcomeMessage(template: string, user: GuildMember, ticketId: number, categoryName: string): string {
  return template
    .replace(/{user}/g, `<@${user.id}>`)
    .replace(/{ticket}/g, `#${ticketId}`)
    .replace(/{category}/g, categoryName);
}

export class TicketManager {
  client: Client;
  closeReasons: Map<string, { reason: string; userId: string; messageId?: string }> = new Map();
  
  constructor(client: Client) {
    this.client = client;
  }

  async createTicket(guild: Guild, opener: GuildMember, summary?: string, categoryId?: string | null, categoryDbId?: number | null, questionsWithAnswers?: Array<{ question: string; answer: string }>) {
    const settings = getGuildSettings(guild.id);
    
    let channelName = `ticket-${opener.user.username}`.toLowerCase().replace(/[^a-z0-9\-]/g, '-').slice(0, 90);
    
    if (settings?.channelPrefix) {
      const ticketCount = countTicketsByGuild(guild.id);
      let categoryName = 'support';
      
      if (categoryDbId) {
        const category = getCategoryById(categoryDbId);
        if (category) categoryName = category.name;
      }
      
      channelName = settings.channelPrefix
        .replace(/{count}/g, String(ticketCount))
        .replace(/{user}/g, opener.user.username)
        .replace(/{category}/g, categoryName)
        .slice(0, 100);
    }
    
    const createOptions: any = {
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: opener.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
      ]
    };
    if (categoryId) createOptions.parent = categoryId;
    const channel = await guild.channels.create(createOptions);

    const ticketId = createTicketRow({
      guildId: guild.id,
      channelId: channel.id,
      userId: opener.id,
      status: 'open',
      createdAt: Date.now()
    });

    const embedColor = settings?.embedColor ? parseInt(settings.embedColor.replace('#', ''), 16) : 0x5865f2;
    const claimEnabled = settings ? !!settings.claimEnabled : true;

    let description = `Hello ${opener}, thank you for opening a ticket (ID: ${ticketId}).` + (summary ? `\nReason: ${summary}` : '');
    let title = 'New ticket';

    if (categoryDbId) {
      const category = getCategoryById(categoryDbId);
      if (category && category.description) {
        description = processWelcomeMessage(category.description, opener, ticketId, category.name);
        if (category.title) {
          title = category.title;
        }
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(embedColor)
      .setTimestamp();

    if (questionsWithAnswers && questionsWithAnswers.length > 0) {
      questionsWithAnswers.forEach((qa) => {
        embed.addFields({
          name: qa.question,
          value: qa.answer || 'No answer provided',
          inline: false
        });
      });
    }

    const row = new ActionRowBuilder<ButtonBuilder>();

    if (claimEnabled) {
      const claimButton = new ButtonBuilder()
        .setCustomId(`ticket_claim:${ticketId}`)
        .setLabel('Claim')
        .setStyle(ButtonStyle.Primary);
      row.addComponents(claimButton);
    }

    const closeButton = new ButtonBuilder()
      .setCustomId(`ticket_close:${ticketId}`)
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger);

    row.addComponents(closeButton);

    try {
      let staffRoleMention = '@staff';
      if (settings?.allowedRoles) {
        try {
          const roleIds = JSON.parse(settings.allowedRoles);
          if (Array.isArray(roleIds) && roleIds.length > 0) {
            staffRoleMention = roleIds.map(id => `<@&${id}>`).join(' ');
          }
        } catch {}
      }
      await (channel as TextChannel).send({ content: `${staffRoleMention} ${opener.toString()} has created a new ticket`, embeds: [embed], components: [row as any] });
      
      const { isOutside, message: workingHoursMessage } = isOutsideWorkingHours(settings);
      if (isOutside && workingHoursMessage) {
        const workingHoursEmbed = new EmbedBuilder()
          .setTitle('⏰ Outside Working Hours')
          .setDescription(workingHoursMessage)
          .setColor(0xFFA500)
          .setTimestamp();
        await (channel as TextChannel).send({ embeds: [workingHoursEmbed] });
      }
    } catch (err) {
      await (channel as TextChannel).send({ content: description });
    }

    updateStatsEmbeds(this.client, guild.id).catch(err => console.error('Failed to update stats embeds:', err));

    if ((this as any).updateBotStatus) {
      (this as any).updateBotStatus();
    }

    return { ticketId, channel };
  }

  async closeTicket(channelId: string, closerId?: string, closeReason?: string) {
    const ticket = getTicketByChannel(channelId);
    if (!ticket) throw new Error('Ticket not found');
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) throw new Error('Channel not found or not text');
    const closedAt = Date.now();
    const reason = closeReason || 'No reason provided';

    const transcriptPath = await saveChannelTranscript(channel as TextChannel, ticket.id as number);
    updateTicketRow(ticket.id, { status: 'closed', closedAt, transcriptPath, closedBy: closerId || null });

    try {
      const settings = getGuildSettings((channel as TextChannel).guild.id as string) || null;
      const embedColor = settings?.embedColor ? parseInt(settings.embedColor.replace('#', ''), 16) : 0x5865f2;
      const user = await this.client.users.fetch(ticket.userId).catch(() => null);
      const openerName = user ? `${user.username}#${user.discriminator}` : ticket.userId;
      const createdAt = new Date(ticket.createdAt);
      const closedDate = new Date(closedAt);
      const diffMs = closedAt - ticket.createdAt;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const fmt = (d: Date) => d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).replace('AM', 'am').replace('PM', 'pm');

      const embed = new EmbedBuilder()
        .setTitle('Your ticket has been closed')
        .setColor(embedColor)
        .addFields(
          { name: 'Ticket', value: `${(channel as TextChannel).name} (#${ticket.id})`, inline: true },
          { name: 'Topic', value: `${openerName}`, inline: true },
          { name: 'Created at', value: `${fmt(createdAt)}`, inline: true },
          { name: 'Closed at', value: `${fmt(closedDate)}\n(after ${diffDays} days)`, inline: true },
          { name: 'Closed by', value: `<@${closerId || 'system'}>`, inline: true },
          { name: 'Closed because', value: `${reason}`, inline: true },
          { name: 'Transcript', value: 'Click here' }
        )
        .setTimestamp(closedAt);

      const base = getTranscriptBaseUrl();
      const filename = transcriptPath ? (require('path').basename(transcriptPath)) : null;
      const transcriptLink = filename ? `${base}/transcripts/${encodeURIComponent(filename)}` : null;

      if (transcriptLink) {
        const fields = embed.data.fields || [];
        for (let f of fields) {
          if (f.name === 'Transcript') f.value = `[Click here](${transcriptLink})`;
        }
      }

      if (settings && (settings as any).transcriptChannelId) {
        try {
          const tc = await this.client.channels.fetch((settings as any).transcriptChannelId as string);
          if (tc && (tc as any).isTextBased()) {
            const toSend: any = { embeds: [embed] };
            await (tc as any).send(toSend);
          }
        } catch (e) {
          console.warn('Failed to post to transcript channel', e);
        }
      }

      if (user) {
        try {
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const row = new ActionRowBuilder();
          for (let i = 1; i <= 5; i++) {
            const b = new ButtonBuilder()
              .setCustomId(`rating:${ticket.id}:${i}`)
              .setLabel(`⭐ ${i}`)
              .setStyle(ButtonStyle.Primary);
            row.addComponents(b as any);
          }

          if (transcriptLink) {
            const fields = embed.data.fields || [];
            for (let f of fields) {
              if (f.name === 'Transcript') f.value = `[Click here](${transcriptLink})`;
            }
          }

          const dmPayload: any = { embeds: [embed], components: [row as any] };
          if (transcriptPath) dmPayload.files = [transcriptPath];
          await user.send(dmPayload).catch(() => null);
        } catch (e) {
          console.warn('Failed to DM user with transcript embed', e);
        }
      }
    } catch (e) {
      console.warn('Error while sending transcript embed/DM', e);
    }

    try {
      await (channel as TextChannel).permissionOverwrites.set([
        { id: (channel as TextChannel).guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }
      ]);
    } catch (err) {
      console.warn('Failed to update permissions on close', err);
    }
    setTimeout(async () => {
      try {
        const ch = await this.client.channels.fetch(channelId);
        if (ch && ch.isTextBased() && 'guild' in ch && (ch as TextChannel).deletable) {
          await (ch as TextChannel).delete('Ticket closed - auto delete after 5s');
        }
      } catch (err) {
        console.warn('Failed to auto-delete ticket channel', channelId, err);
      }
    }, 5000);

    updateStatsEmbeds(this.client, ticket.guildId).catch(err => console.error('Failed to update stats embeds:', err));

    if ((this as any).updateBotStatus) {
      (this as any).updateBotStatus();
    }

    return { transcriptPath, ticketId: ticket.id as number };
  }

  async claimTicket(channelId: string, claimerId: string) {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) throw new Error('Channel not found or not text');
    const ticket = getTicketByChannel(channelId);
    await (channel as TextChannel).send(`<@${claimerId}> has claimed this ticket.`);
    if (ticket) {
      updateStatsEmbeds(this.client, ticket.guildId).catch(err => console.error('Failed to update stats embeds:', err));
    }
  }
}

export default TicketManager;
