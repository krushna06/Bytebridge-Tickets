import { Client, Guild, GuildMember, ChannelType, PermissionFlagsBits, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { createTicketRow, updateTicketRow, getTicketByChannel } from '../lib/database';
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

    const embed = new EmbedBuilder()
      .setTitle('New ticket')
      .setDescription(`Hello ${opener}, thank you for opening a ticket (ID: ${ticketId}).` + (summary ? `\nReason: ${summary}` : ''))
      .setTimestamp();

    const claimButton = new ButtonBuilder()
      .setCustomId(`ticket_claim:${ticketId}`)
      .setLabel('Claim')
      .setStyle(ButtonStyle.Primary);

    const closeButton = new ButtonBuilder()
      .setCustomId(`ticket_close:${ticketId}`)
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(claimButton, closeButton);

    try {
      await (channel as TextChannel).send({ embeds: [embed], components: [row as any] });
    } catch (err) {
      const welcome = `Hello ${opener}, thank you for opening a ticket (ID: ${ticketId}).` + (summary ? `\nReason: ${summary}` : '');
      await (channel as TextChannel).send({ content: welcome });
    }

    return { ticketId, channel };
  }

  async closeTicket(channelId: string, closerId?: string) {
    const ticket = getTicketByChannel(channelId);
    if (!ticket) throw new Error('Ticket not found');
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) throw new Error('Channel not found or not text');

    const transcriptPath = await saveChannelTranscript(channel as TextChannel, ticket.id as number);
    updateTicketRow(ticket.id, { status: 'closed', closedAt: Date.now(), transcriptPath });

    try {
      await (channel as TextChannel).permissionOverwrites.set([
        { id: (channel as TextChannel).guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }
      ]);
    } catch (err) {
      console.warn('Failed to update permissions on close', err);
    }

    await (channel as TextChannel).send(`Ticket closed by <@${closerId || 'system'}>. Transcript saved.`);
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
