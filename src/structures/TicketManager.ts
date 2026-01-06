import { Client, Guild, GuildMember, ChannelType, PermissionFlagsBits, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { createTicketRow, updateTicketRow, getTicketByChannel, getGuildSettings } from '../lib/database';
import { saveChannelTranscript } from '../lib/transcript';

export class TicketManager {
  client: Client;
  constructor(client: Client) {
    this.client = client;
  }

  async createTicket(guild: Guild, opener: GuildMember, summary?: string, categoryId?: string | null) {
    const createOptions: any = {
      name: `ticket-${opener.user.username}`.toLowerCase().replace(/[^a-z0-9\-]/g, '-').slice(0, 90),
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

    try {
      const newName = `ticket-${ticketId}`;
      if ((channel as any).setName) await (channel as any).setName(newName);
    } catch (e) {
    }

    const settings = getGuildSettings(guild.id);
    const embedColor = settings?.embedColor ? parseInt(settings.embedColor.replace('#', ''), 16) : 0x5865f2;
    const claimEnabled = settings ? !!settings.claimEnabled : true;

    const embed = new EmbedBuilder()
      .setTitle('New ticket')
      .setDescription(`Hello ${opener}, thank you for opening a ticket (ID: ${ticketId}).` + (summary ? `\nReason: ${summary}` : ''))
      .setColor(embedColor)
      .setTimestamp();

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
      await (channel as TextChannel).send({ embeds: [embed], components: [row as any] });
    } catch (err) {
      const welcome = `Hello ${opener}, thank you for opening a ticket (ID: ${ticketId}).` + (summary ? `\nReason: ${summary}` : '');
      await (channel as TextChannel).send({ content: welcome });
    }

    return { ticketId, channel };
  }

  async closeTicket(channelId: string, closerId?: string, closeReason?: string) {
    const ticket = getTicketByChannel(channelId);
    if (!ticket) throw new Error('Ticket not found');
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) throw new Error('Channel not found or not text');
    const closedAt = Date.now();
    await (channel as TextChannel).send(`Ticket closed by <@${closerId || 'system'}>. Transcript saved.`);

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
          { name: 'Closed because', value: `${closeReason || 'Closed due to inactivity.'}`, inline: true },
          { name: 'Transcript', value: 'Click here' }
        )
        .setTimestamp(closedAt);

      const host = process.env.TRANSCRIPTS_HOST || process.env.HOSTNAME || 'localhost';
      const port = process.env.TRANSCRIPTS_PORT || process.env.PORT || process.env.BOT_API_PORT || '3000';
      const proto = process.env.TRANSCRIPTS_PROTOCOL || process.env.BOT_API_PROTOCOL || 'http';
      const base = `${proto}://${host}:${port}`;
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

    return { transcriptPath, ticketId: ticket.id as number };
  }

  async claimTicket(channelId: string, claimerId: string) {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) throw new Error('Channel not found or not text');
    await (channel as TextChannel).send(`<@${claimerId}> has claimed this ticket.`);
  }
}

export default TicketManager;
