import {
  Client,
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
  Channel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';

import {
  getTicketByChannel,
  getGuildSettings,
  getTag,
  createTag,
  listTags,
  listTicketsForUser,
  listTicketsForGuild,
  addNote,
  getNotesForUser,
  deleteNote,
  createOrUpdateProfile,
  getProfile,
  incStaffStat,
  getLeaderboard,
  setTicketMeta,
  getTicketMeta,
  countTicketsByGuild,
  countOpenTicketsByGuild,
  createPanel,
  getLatestPanelForGuild,
  getPanelById,
  updatePanelMessage,
  getPanelByChannel,
  listPanels,
  deletePanel
} from '../lib/database';

export type Ctx = { client: Client; ticketManager: any };

function isStaffFromSettings(member: GuildMember | null | undefined, settings: any) {
  try {
    if (!member) return false;
    if (settings && settings.staffRoleId) return member.roles?.cache?.has(settings.staffRoleId) ?? false;
    return (
      member.permissions?.has(PermissionFlagsBits.ManageGuild) ||
      member.permissions?.has(PermissionFlagsBits.ManageChannels)
    );
  } catch (e) {
    return false;
  }
}

interface TicketRecord {
  id: number;
  userId: string;
  channelId: string;
  guildId: string;
  transcriptPath?: string;
  status?: string;
}

interface TagRecord {
  content: string;
}

interface ProfileRecord {
  displayName?: string;
  bio?: string;
}

function makeEmbed(desc: string, title?: string) {
  const e = new EmbedBuilder().setDescription(desc);
  if (title) e.setTitle(title);
  return e;
}

export default {
  async help(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.reply({ embeds: [makeEmbed('Commands: /new /tag /tickets /add /remove /transfer /note /stickynotes /viewnotes /claim /force-close /move /priority /release /leaderboard /setprofile /stats /viewprofile /close /rename /topic /transcript')], ephemeral: true });
  },

  async new(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const reason = interaction.options.getString('title') || interaction.options.getString('reason') || undefined;
    const category = interaction.options.getChannel('category') as any;
    const opener = interaction.guild?.members.cache.get(interaction.user.id) ?? (interaction.member as any);
    const result = await ctx.ticketManager.createTicket(interaction.guild!, opener, reason, category && category.id ? category.id : undefined);
    await interaction.editReply({ embeds: [makeEmbed(`Ticket created: <#${result.channel.id}> (ID: ${result.ticketId})`)] });
  },

  async tag(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
  const tagName = interaction.options.getString('name', true);
  const tag = getTag(interaction.guildId!, tagName) as TagRecord | null;
    if (!tag) return interaction.editReply({ embeds: [makeEmbed(`Tag '${tagName}' not found.`)] });
    return interaction.editReply({ embeds: [makeEmbed(tag.content)] });
  },

  async tickets(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const user = interaction.options.getUser('user') || interaction.user;
    const rows = listTicketsForUser(interaction.guildId!, user.id);
    if (!rows.length) return interaction.editReply({ embeds: [makeEmbed('No tickets found.')] });
    const list = rows.map((r: any) => `#${r.id} - <#${r.channelId}> - ${r.status}`).join('\n');
    return interaction.editReply({ embeds: [makeEmbed(`Tickets:\n${list}`)] });
  },

  async add(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const user = interaction.options.getUser('user', true);
    const channel = interaction.channel as Channel | null;
  if (!channel || !('isTextBased' in channel) || !(channel as any).isTextBased()) return interaction.editReply({ embeds: [makeEmbed('This command must be used in a ticket channel')] });
    const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
    const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
    if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to add users to tickets.')] });
    await (channel as any).permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
    return interaction.editReply({ embeds: [makeEmbed(`Added ${user.tag} to the ticket.`)] });
  },

  async remove(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const user = interaction.options.getUser('user', true);
    const channel = interaction.channel as Channel | null;
  if (!channel || !('isTextBased' in channel) || !(channel as any).isTextBased()) return interaction.editReply({ embeds: [makeEmbed('This command must be used in a ticket channel')] });
    const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
    const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
    if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to remove users from tickets.')] });
    await (channel as any).permissionOverwrites.edit(user.id, { ViewChannel: false });
    return interaction.editReply({ embeds: [makeEmbed(`Removed ${user.tag} from the ticket.`)] });
  },

  async transfer(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const user = interaction.options.getUser('user', true);
  const ticket = getTicketByChannel(interaction.channel?.id || '') as TicketRecord | null;
  if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.')] });
    const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
    const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
    if (ticket.userId !== interaction.user.id && !isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to transfer this ticket.')] });
    setTicketMeta(ticket.id, { ownerId: user.id, guildId: ticket.guildId });
    return interaction.editReply({ embeds: [makeEmbed(`Ticket transferred to ${user.tag}.`)] });
  },

  async note(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('user') || interaction.user;
    const content = interaction.options.getString('text') || interaction.options.getString('content') || '';
    const isPrivate = 1;
    addNote(interaction.guildId!, interaction.user.id, target.id, content, isPrivate);
    try {
      const channel = interaction.channel;
      const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
      if (channel && (channel as any).isTextBased && (channel as any).isTextBased()) {
        const thread = await (channel as any).threads.create({ name: `note-${Date.now()}`, autoArchiveDuration: 60, type: 12 });
        await thread.send({ content: `Private note by <@${interaction.user.id}> for <@${target.id}>:\n${content}` });
        if (settings && settings.staffRoleId) {
          const members = interaction.guild!.members.cache.filter((m: any) => m.roles.cache.has(settings.staffRoleId));
          for (const m of members.values()) {
            try { await thread.members.add(m.user.id); } catch {}
          }
        }
      }
    } catch (e) {
      // ignore
    }
    return interaction.editReply({ embeds: [makeEmbed('Note created.')] });
  },

  async stickynotes(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    // subcommands: add, list, remove
    let sub = 'add';
    try { sub = interaction.options.getSubcommand(); } catch (e) { sub = 'add'; }
    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      const content = interaction.options.getString('text');
  if (!user) return interaction.editReply({ embeds: [makeEmbed('Please specify a user to attach the sticky note to.')] });
  if (!content) return interaction.editReply({ embeds: [makeEmbed('Please provide the note text.')] });
  addNote(interaction.guildId!, interaction.user.id, user.id, content, 0);
  return interaction.editReply({ embeds: [makeEmbed(`Sticky note saved for ${user.tag}.`)] });
    } else if (sub === 'list') {
      const user = interaction.options.getUser('user') || interaction.user;
      const notes = getNotesForUser(interaction.guildId!, user.id);
  if (!notes.length) return interaction.editReply({ embeds: [makeEmbed('No sticky notes found.')] });
  const out = notes.map((n: any) => `#${n.id} - ${new Date(n.createdAt).toISOString()}: ${n.content}`).join('\n');
  return interaction.editReply({ embeds: [makeEmbed(`Sticky notes for ${user.tag}:\n${out}`)] });
    } else if (sub === 'remove') {
      const id = interaction.options.getInteger('id');
      if (typeof id !== 'number') return interaction.editReply({ embeds: [makeEmbed('Please provide the note id to remove.')] });
      const changes = (deleteNote as any)(id, interaction.guildId!);
      if (changes) return interaction.editReply({ embeds: [makeEmbed(`Removed sticky note #${id}.`)] });
      return interaction.editReply({ embeds: [makeEmbed(`No sticky note found with id ${id}.`)] });
    }
  },

  async viewnotes(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const user = interaction.options.getUser('user', true);
    const notes = getNotesForUser(interaction.guildId!, user.id);
    if (!notes.length) return interaction.editReply({ embeds: [makeEmbed('No notes found.')] });
    const out = notes.map((n: any) => `- ${n.createdAt}: ${n.content}`).join('\n');
    return interaction.editReply({ embeds: [makeEmbed(`Notes for ${user.tag}:\n${out}`)] });
  },

  async claim(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
    const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to claim tickets.')] });
  const ticket = getTicketByChannel(interaction.channel?.id || '') as TicketRecord | null;
  if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.')] });
    const meta = getTicketMeta(ticket.id as number);
    if (meta && meta.claimedBy) return interaction.editReply({ embeds: [makeEmbed(`Ticket already claimed by <@${meta.claimedBy}>.`)] });
    await ctx.ticketManager.claimTicket(interaction.channel!.id, interaction.user.id);
    setTicketMeta(ticket.id, { claimedBy: interaction.user.id, guildId: ticket.guildId });
    incStaffStat(ticket.guildId, interaction.user.id, 'claimedCount');
    return interaction.editReply({ embeds: [makeEmbed('Ticket claimed.')] });
  },

  async forceClose(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
    const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
    if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to force-close tickets.')] });
  const ticket = getTicketByChannel(interaction.channel?.id || '') as TicketRecord | null;
    if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.')] });
    const result = await ctx.ticketManager.closeTicket(interaction.channel!.id, interaction.user.id);
    incStaffStat(ticket.guildId, interaction.user.id, 'closedCount');
    return interaction.editReply({ embeds: [makeEmbed(`Ticket forcibly closed. Transcript: ${result.transcriptPath}`)] });
  },

  async move(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const category = interaction.options.getChannel('channel', true) || interaction.options.getChannel('category', true);
    const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
    const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to move tickets.')] });
  if (!interaction.channel || !('setParent' in interaction.channel)) return interaction.editReply({ embeds: [makeEmbed('This command must be used in a ticket channel')] });
    await (interaction.channel as any).setParent((category as any).id as string);
    return interaction.editReply({ embeds: [makeEmbed(`Moved ticket to category ${(category as any).name}.`)] });
  },

  async priority(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const level = interaction.options.getString('level', true);
  const ticket = getTicketByChannel(interaction.channel?.id || '') as TicketRecord | null;
  if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.')] });
    const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
    const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
    if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to set priority.')] });
    setTicketMeta(ticket.id, { priority: level, guildId: ticket.guildId });
    return interaction.editReply({ embeds: [makeEmbed(`Priority set to ${level}.`)] });
  },

  async release(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
  const ticket = getTicketByChannel(interaction.channel?.id || '') as TicketRecord | null;
    if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.')] });
    const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
    const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
    if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to release tickets.')] });
    setTicketMeta(ticket.id, { claimedBy: undefined as any, guildId: ticket.guildId });
    return interaction.editReply({ embeds: [makeEmbed('Ticket released (unclaimed).')] });
  },

  async leaderboard(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const rows = getLeaderboard(interaction.guildId!);
    if (!rows.length) return interaction.editReply({ embeds: [makeEmbed('No stats yet.')] });
    const out = rows.map((r: any, i: number) => `${i + 1}. <@${r.userId}> - closed: ${r.closedCount || 0}, claimed: ${r.claimedCount || 0}`).join('\n');
    return interaction.editReply({ embeds: [makeEmbed(`Leaderboard:\n${out}`)] });
  },

  async setprofile(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const display = interaction.options.getString('display') || interaction.options.getString('name') || undefined;
    const bio = interaction.options.getString('bio') || undefined;
    createOrUpdateProfile(interaction.guildId!, interaction.user.id, display, bio);
    return interaction.editReply({ embeds: [makeEmbed('Profile updated.')] });
  },

  async stats(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const total = countTicketsByGuild(interaction.guildId!);
    const open = countOpenTicketsByGuild(interaction.guildId!);
    return interaction.editReply({ embeds: [makeEmbed(`Tickets: total ${total}, open ${open}`)] });
  },

  async viewprofile(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const user = interaction.options.getUser('user', true);
  const profile = getProfile(interaction.guildId!, user.id) as ProfileRecord | null;
    if (!profile) return interaction.editReply({ embeds: [makeEmbed('No profile.')] });
    return interaction.editReply({ embeds: [makeEmbed(`Profile for ${user.tag}: ${profile.displayName || ''} - ${profile.bio || ''}`)] });
  },

  async close(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
  if (!interaction.channel) return interaction.editReply({ embeds: [makeEmbed('No channel')] });
  const ticket = getTicketByChannel(interaction.channel.id) as TicketRecord | null;
  if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.')] });
    const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
    const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (ticket.userId !== interaction.user.id && !isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to close this ticket.')] });
  const result = await ctx.ticketManager.closeTicket(interaction.channel.id, interaction.user.id);
    if (settings && (settings as any).transcriptChannelId && result.transcriptPath) {
      try {
        const tc = await ctx.client.channels.fetch((settings as any).transcriptChannelId);
        if (tc && (tc as any).isTextBased()) await (tc as any).send({ content: `Transcript for ticket ${result.ticketId}`, files: [result.transcriptPath] as any });
      } catch(e) {}
    }
    if (ticket) incStaffStat(ticket.guildId, interaction.user.id, 'closedCount');
    return interaction.editReply({ embeds: [makeEmbed(`Ticket closed. Transcript: ${result.transcriptPath}`)] });
  },

  async rename(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const newName = interaction.options.getString('name', true);
    if (!interaction.channel || !('isTextBased' in interaction.channel) || !(interaction.channel as any).isTextBased()) return interaction.editReply('This command must be used in a ticket channel');
    const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
    const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  const ticket = getTicketByChannel(interaction.channel.id) as TicketRecord | null;
    if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.')] });
    if (ticket.userId !== interaction.user.id && !isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to rename this ticket.')] });
    await (interaction.channel as any).setName(newName);
    return interaction.editReply({ embeds: [makeEmbed(`Channel renamed to ${newName}.`)] });
  },

  async topic(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const topic = interaction.options.getString('topic', true);
    if (!interaction.channel || !('isTextBased' in interaction.channel) || !(interaction.channel as any).isTextBased()) return interaction.editReply('This command must be used in a ticket channel');
    const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
    const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  const ticket = getTicketByChannel(interaction.channel.id) as TicketRecord | null;
    if (!ticket) return interaction.editReply('This channel is not a ticket.');
    if (ticket.userId !== interaction.user.id && !isStaffFromSettings(member, settings)) return interaction.editReply('You do not have permission to set the topic.');
    await (interaction.channel as any).setTopic(topic);
    return interaction.editReply({ content: 'Topic updated.' });
  },

  async transcript(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
  const ticket = getTicketByChannel(interaction.channel?.id || '') as TicketRecord | null;
    if (!ticket) return interaction.editReply('This channel is not a ticket.');
    if (!ticket.transcriptPath) return interaction.editReply('No transcript saved yet.');
    return interaction.editReply({ content: `Transcript path: ${ticket.transcriptPath}` });
  },

  async panel(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
    const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
    if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to manage panels.')] });
    let sub = 'create';
    try { sub = interaction.options.getSubcommand(); } catch (e) { sub = 'create'; }
    if (sub === 'create') {
      const title = interaction.options.getString('title') || null;
      const buttons: Array<{ label: string; categoryId?: string | null }> = [];
      for (let i = 1; i <= 5; i++) {
        const b = interaction.options.getString(`button${i}` as any);
        const cat = interaction.options.getChannel(`button${i}_category` as any) as any;
        if (b && b.trim()) buttons.push({ label: b.trim(), categoryId: cat && cat.id ? cat.id : null });
      }
      if (!buttons.length) return interaction.editReply({ embeds: [makeEmbed('Please provide at least one button label (up to 5).')] });
      const panelId = createPanel(interaction.guildId!, title, interaction.user.id, buttons as any);
      const postChannel = interaction.options.getChannel('post_channel') as any;
      if (postChannel && postChannel.isTextBased && postChannel.isTextBased()) {
        // post immediately
        const panel = getPanelById(panelId as number);
        if (panel) {
          const embed = new EmbedBuilder().setTitle(panel.title || 'Ticket Panel').setDescription('Click a button below to open a ticket.');
          const row = new ActionRowBuilder<ButtonBuilder>();
          panel.buttons.slice(0,5).forEach((b: any, idx: number) => {
            const label = (b && (b.label || b)) || `Category ${idx + 1}`;
            const btn = new ButtonBuilder().setCustomId(`panel_open:${panel.id}:${idx}`).setLabel(label).setStyle(ButtonStyle.Primary as any);
            row.addComponents(btn as any);
          });
          const sent = await postChannel.send({ embeds: [embed], components: [row as any] });
          updatePanelMessage(panel.id, postChannel.id, sent.id);
        }
        return interaction.editReply({ embeds: [makeEmbed(`Panel created and posted to ${postChannel}.`)] });
      }
      return interaction.editReply({ embeds: [makeEmbed(`Panel created with id ${panelId}. Run /sendpanel to post it to a channel.`)] });
    }
    if (sub === 'list') {
      const panels = listPanels(interaction.guildId!);
      if (!panels.length) return interaction.editReply({ embeds: [makeEmbed('No panels found for this guild.')] });
      const out = panels.map((p: any) => `#${p.id} - ${p.title || 'Untitled'} - posted in <#${p.channelId}> message ${p.messageId || 'N/A'}`).join('\n');
      return interaction.editReply({ embeds: [makeEmbed(`Panels:\n${out}`)] });
    }

    if (sub === 'delete') {
      const id = interaction.options.getInteger('id');
      const channel = interaction.options.getChannel('channel') as any;
      let panel: any = null;
      if (typeof id === 'number') panel = getPanelById(id);
      else if (channel) panel = getPanelByChannel(channel.id);
      if (!panel) return interaction.editReply({ embeds: [makeEmbed('Panel not found. Provide a valid id or the channel where it was posted.')] });
      // try delete posted message
      if (panel.channelId && panel.messageId) {
        try {
          const ch = await ctx.client.channels.fetch(panel.channelId as string) as any;
          if (ch && ch.isTextBased && ch.isTextBased()) {
            try { const msg = await ch.messages.fetch(panel.messageId as string); if (msg) await msg.delete(); } catch (e) {}
          }
        } catch (e) {}
      }
      deletePanel(panel.id);
      return interaction.editReply({ embeds: [makeEmbed(`Panel #${panel.id} deleted.`)] });
    }

    return interaction.editReply({ embeds: [makeEmbed('Unknown panel subcommand.')] });
  },

  async sendpanel(interaction: ChatInputCommandInteraction, ctx: Ctx) {
    await interaction.deferReply({ ephemeral: true });
    const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
    const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
    if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to send panels.')] });
    const channel = interaction.options.getChannel('channel') as any;
    if (!channel || !('isTextBased' in channel) || !channel.isTextBased()) return interaction.editReply({ embeds: [makeEmbed('Please provide a valid text channel.')] });
    const panel = getLatestPanelForGuild(interaction.guildId!);
    if (!panel) return interaction.editReply({ embeds: [makeEmbed('No saved panel found for this guild. Create one with /panel create.')] });
    const embed = new EmbedBuilder().setTitle(panel.title || 'Ticket Panel').setDescription('Click a button below to open a ticket.');
    const row = new ActionRowBuilder<ButtonBuilder>();
    panel.buttons.slice(0,5).forEach((b: any, idx: number) => {
      const label = (b && (b.label || b)) || `Category ${idx + 1}`;
      const btn = new ButtonBuilder().setCustomId(`panel_open:${panel.id}:${idx}`).setLabel(label).setStyle(ButtonStyle.Primary as any);
      row.addComponents(btn as any);
    });
    const sent = await channel.send({ embeds: [embed], components: [row as any] });
    updatePanelMessage(panel.id, channel.id, sent.id);
    return interaction.editReply({ embeds: [makeEmbed(`Panel sent to ${channel}`)] });
  }
};
