import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, InteractionType, ChannelType, PermissionFlagsBits, GuildMember, EmbedBuilder, ButtonStyle, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import TicketManager from './structures/TicketManager';
import {
  getTicketByChannel,
  getTicketById,
  getGuildSettings,
  getTag,
  createTag,
  listTags,
  listTicketsForUser,
  listTicketsForGuild,
  addNote,
  getNotesForUser,
  createOrUpdateProfile,
  getProfile,
  incStaffStat,
  getLeaderboard,
  setTicketMeta,
  getTicketMeta,
  countTicketsByGuild,
  countOpenTicketsByGuild
} from './lib/database';
import { startBotApi } from './api/server';

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error('DISCORD_TOKEN not set in env');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel, Partials.Message]
});

client.login(token).catch(err => {
  console.error('Failed to login to Discord:', err);
  process.exit(1);
});

const ticketManager = new TicketManager(client);

import commands from './commands';
const commandsMap = new Map<string, any>();
for (const c of (commands as any[])) {
  try {
    const name = c?.data?.name || (c?.data?.options && c.data.name);
    if (name) commandsMap.set(name, c);
  } catch (e) { /* ignore */ }
}

client.once('ready', () => {
  console.log('Bot ready as', client.user?.tag);
  startBotApi(ticketManager).catch(err => console.warn('Failed to start bot API', err));
});

client.on('interactionCreate', async (interaction: any) => {
  try {
    if (interaction.isButton && interaction.isButton()) {
      const custom = interaction.customId as string;
      if (custom && typeof custom === 'string' && (custom.startsWith('ticket_claim:') || custom.startsWith('ticket_close:'))) {
        const parts = custom.split(':');
        const action = parts[0] + '_' + parts[1];
        const ticketId = Number(parts[1]);
        const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
        const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;

        function isStaff(member: GuildMember | any) {
          try {
            if (!member) return false;
            if (settings && settings.staffRoleId) return member.roles?.cache?.has(settings.staffRoleId);
            return member.permissions?.has(PermissionFlagsBits.ManageChannels) || member.permissions?.has(PermissionFlagsBits.ManageGuild);
          } catch (e) { return false; }
        }

        const ticket = getTicketById(ticketId);
        if (!ticket) return await interaction.reply({ ephemeral: true, content: 'Ticket not found.' });
        if (interaction.channelId !== ticket.channelId) return await interaction.reply({ ephemeral: true, content: 'This button does not belong to this channel.' });

        if (custom.startsWith('ticket_claim:')) {
          if (!isStaff(member)) return await interaction.reply({ ephemeral: true, content: 'You do not have permission to claim tickets.' });
          const meta = getTicketMeta(ticket.id);
          if (meta && meta.claimedBy) {
            return await interaction.reply({ ephemeral: true, content: `Ticket already claimed by <@${meta.claimedBy}>.` });
          }
          await ticketManager.claimTicket(ticket.channelId, interaction.user.id);
          setTicketMeta(ticket.id, { claimedBy: interaction.user.id, guildId: ticket.guildId });
          incStaffStat(ticket.guildId, interaction.user.id, 'claimedCount');
          try {
            const msg = interaction.message;
            if (msg && msg.edit) {
              const newComponents = msg.components.map((row: any) => {
                const action = new ActionRowBuilder<ButtonBuilder>();
                for (const c of row.components) {
                  try {
                    const customId = c.customId ?? c.custom_id;
                    const label = c.label ?? '';
                    const style = c.style ?? ButtonStyle.Secondary;
                    const disabled = (typeof customId === 'string' && customId.startsWith('ticket_claim:')) ? true : (c.disabled ?? false);
                    const btn = new ButtonBuilder()
                      .setCustomId(customId)
                      .setLabel(label)
                      .setStyle(style as any)
                      .setDisabled(disabled as any);
                    action.addComponents(btn as any);
                  } catch (e) {
                  }
                }
                return action;
              });
              await msg.edit({ components: newComponents as any });
            }
          } catch (e) { }
          return await interaction.reply({ ephemeral: true, content: 'Ticket claimed.' });
        }

        if (custom.startsWith('ticket_close:')) {
          if (ticket.userId !== interaction.user.id && !isStaff(member)) return await interaction.reply({ ephemeral: true, content: 'You do not have permission to close this ticket.' });
          const result = await ticketManager.closeTicket(ticket.channelId, interaction.user.id);
          incStaffStat(ticket.guildId, interaction.user.id, 'closedCount');
          return await interaction.reply({ ephemeral: true, content: `Ticket closed. Transcript: ${result.transcriptPath}` });
        }
      }
      return;
    }

    if (interaction.type !== InteractionType.ApplicationCommand) return;
    const name = interaction.commandName;
    const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;

    const mod = commandsMap.get(name);
    if (mod && typeof mod.execute === 'function') {
      try {
        await mod.execute(interaction, { client, ticketManager });
      } catch (err) {
        console.error('Command module error', err);
        if (interaction.deferred) await interaction.editReply({ content: 'An error occurred' }); else await interaction.reply({ content: 'An error occurred', ephemeral: true });
      }
      return;
    }

    function isStaff(member: GuildMember | any) {
      try {
        if (!member) return false;
        if (settings && settings.staffRoleId) return member.roles?.cache?.has(settings.staffRoleId);
        return member.permissions?.has(PermissionFlagsBits.ManageChannels) || member.permissions?.has(PermissionFlagsBits.ManageGuild);
      } catch (e) { return false; }
    }
    // Unified comprehensive command handling
    // --- General ---
    if (name === 'help') {
      await interaction.reply({ ephemeral: true, content: 'Commands: /new /tag /tickets /add /remove /transfer /note /stickynotes /viewnotes /claim /force-close /move /priority /release /leaderboard /setprofile /stats /viewprofile /close /rename /topic /transcript' });
      return;
    }

    if (name === 'new') {
      await interaction.deferReply({ ephemeral: true });
      const reason = interaction.options.getString('reason') || undefined;
      const opener = (interaction.member && 'user' in interaction.member) ? interaction.guild!.members.cache.get(interaction.user.id)! : (interaction.member as any);
      const result = await ticketManager.createTicket(interaction.guild!, opener, reason);
      await interaction.editReply({ content: `Ticket created: <#${result.channel.id}> (ID: ${result.ticketId})` });
      return;
    }

    if (name === 'tag') {
      await interaction.deferReply({ ephemeral: true });
      const tagName = interaction.options.getString('name', true);
      const tag = getTag(interaction.guildId!, tagName);
      if (!tag) return interaction.editReply({ content: `Tag '${tagName}' not found.` });
      return interaction.editReply({ content: tag.content });
    }

    if (name === 'tickets') {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser('user') || interaction.user;
      const rows = listTicketsForUser(interaction.guildId!, user.id);
      if (!rows.length) return interaction.editReply({ content: 'No tickets found.' });
      const list = rows.map((r: any) => `#${r.id} - <#${r.channelId}> - ${r.status}`).join('\n');
      return interaction.editReply({ content: `Tickets for ${user.tag}:\n${list}` });
    }

    // --- Members ---
    if (name === 'add') {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser('user', true);
      const channel = interaction.channel;
      if (!channel || channel.type !== ChannelType.GuildText) return interaction.editReply('This command must be used in a ticket channel');
      const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
      if (!isStaff(member)) return interaction.editReply('You do not have permission to add users to tickets.');
      await channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      return interaction.editReply({ content: `Added ${user.tag} to the ticket.` });
    }

    if (name === 'remove') {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser('user', true);
      const channel = interaction.channel;
      if (!channel || channel.type !== ChannelType.GuildText) return interaction.editReply('This command must be used in a ticket channel');
      const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
      if (!isStaff(member)) return interaction.editReply('You do not have permission to remove users from tickets.');
      await channel.permissionOverwrites.edit(user.id, { ViewChannel: false });
      return interaction.editReply({ content: `Removed ${user.tag} from the ticket.` });
    }

    if (name === 'transfer') {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser('user', true);
      const ticket = getTicketByChannel(interaction.channel?.id || '');
      if (!ticket) return interaction.editReply('This channel is not a ticket.');
      const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
      if (ticket.userId !== interaction.user.id && !isStaff(member)) return interaction.editReply('You do not have permission to transfer this ticket.');
      setTicketMeta(ticket.id, { ownerId: user.id, guildId: ticket.guildId });
      await interaction.editReply({ content: `Ticket transferred to ${user.tag}.` });
      return;
    }

    // --- Notes ---
    if (name === 'note') {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser('user') || interaction.user;
      const content = interaction.options.getString('content', true);
      const isPrivate = 1;
      addNote(interaction.guildId!, interaction.user.id, user.id, content, isPrivate);
      try {
        const channel = interaction.channel;
        if (channel && channel.isTextBased()) {
          const thread = await (channel as any).threads.create({ name: `note-${Date.now()}`, autoArchiveDuration: 60, type: 12 });
          await thread.send({ content: `Private note by <@${interaction.user.id}> for <@${user.id}>:\n${content}` });
          if (settings && settings.staffRoleId) {
            const members = interaction.guild!.members.cache.filter((m: any) => m.roles.cache.has(settings.staffRoleId));
            for (const m of members.values()) {
              try { await thread.members.add(m.user.id); } catch {}
            }
          }
        }
      } catch (e) { /* ignore thread failures */ }
      return interaction.editReply({ content: 'Note created.' });
    }

    if (name === 'stickynotes') {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser('user', true);
      const content = interaction.options.getString('content', true);
      addNote(interaction.guildId!, interaction.user.id, user.id, content, 0);
      return interaction.editReply({ content: `Sticky note saved for ${user.tag}.` });
    }

    if (name === 'viewnotes') {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser('user', true);
      const notes = getNotesForUser(interaction.guildId!, user.id);
      if (!notes.length) return interaction.editReply({ content: 'No notes found.' });
      const out = notes.slice(0, 10).map((n: any) => `[${new Date(n.createdAt).toLocaleString()}] <@${n.authorId}>: ${n.content}`).join('\n');
      return interaction.editReply({ content: `Notes for ${user.tag}:\n${out}` });
    }

    // --- Staff ---
    if (name === 'claim') {
      await interaction.deferReply({ ephemeral: true });
      const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
      if (!isStaff(member)) return interaction.editReply('You do not have permission to claim tickets.');
      const ticket = getTicketByChannel(interaction.channel?.id || '');
      if (!ticket) return interaction.editReply('This channel is not a ticket.');
      await ticketManager.claimTicket(interaction.channel.id, interaction.user.id);
      setTicketMeta(ticket.id, { claimedBy: interaction.user.id, guildId: ticket.guildId });
      incStaffStat(ticket.guildId, interaction.user.id, 'claimedCount');
      return interaction.editReply({ content: 'Ticket claimed.' });
    }

    if (name === 'force-close') {
      await interaction.deferReply({ ephemeral: true });
      const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
      if (!isStaff(member)) return interaction.editReply('You do not have permission to force-close tickets.');
      const ticket = getTicketByChannel(interaction.channel?.id || '');
      if (!ticket) return interaction.editReply('This channel is not a ticket.');
      const result = await ticketManager.closeTicket(interaction.channel.id, interaction.user.id);
      incStaffStat(ticket.guildId, interaction.user.id, 'closedCount');
      return interaction.editReply({ content: `Ticket forcibly closed. Transcript: ${result.transcriptPath}` });
    }

    if (name === 'move') {
      await interaction.deferReply({ ephemeral: true });
      const category = interaction.options.getChannel('category', true);
      const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
      if (!isStaff(member)) return interaction.editReply('You do not have permission to move tickets.');
      if (!interaction.channel || !interaction.channel.isTextBased()) return interaction.editReply('This command must be used in a ticket channel');
      await interaction.channel.setParent(category.id as string);
      return interaction.editReply({ content: `Moved ticket to category ${category.name}.` });
    }

    if (name === 'priority') {
      await interaction.deferReply({ ephemeral: true });
      const level = interaction.options.getString('level', true);
      const ticket = getTicketByChannel(interaction.channel?.id || '');
      if (!ticket) return interaction.editReply('This channel is not a ticket.');
      const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
      if (!isStaff(member)) return interaction.editReply('You do not have permission to set priority.');
      setTicketMeta(ticket.id, { priority: level, guildId: ticket.guildId });
      return interaction.editReply({ content: `Priority set to ${level}.` });
    }

    if (name === 'release') {
      await interaction.deferReply({ ephemeral: true });
      const ticket = getTicketByChannel(interaction.channel?.id || '');
      if (!ticket) return interaction.editReply('This channel is not a ticket.');
      const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
      if (!isStaff(member)) return interaction.editReply('You do not have permission to release tickets.');
      setTicketMeta(ticket.id, { claimedBy: undefined as any, guildId: ticket.guildId });
      return interaction.editReply({ content: 'Ticket released (unclaimed).' });
    }

    // --- Stats ---
    if (name === 'leaderboard') {
      await interaction.deferReply({ ephemeral: true });
      const rows = getLeaderboard(interaction.guildId!);
      if (!rows.length) return interaction.editReply({ content: 'No stats yet.' });
      const out = rows.map((r: any, i: number) => `${i+1}. <@${r.userId}> - closed: ${r.closedCount || 0}, claimed: ${r.claimedCount || 0}`).join('\n');
      return interaction.editReply({ content: `Leaderboard:\n${out}` });
    }

    if (name === 'setprofile') {
      await interaction.deferReply({ ephemeral: true });
      const display = interaction.options.getString('display');
      const bio = interaction.options.getString('bio');
      createOrUpdateProfile(interaction.guildId!, interaction.user.id, display, bio);
      return interaction.editReply({ content: 'Profile updated.' });
    }

    if (name === 'stats') {
      await interaction.deferReply({ ephemeral: true });
      const total = countTicketsByGuild(interaction.guildId!);
      const open = countOpenTicketsByGuild(interaction.guildId!);
      return interaction.editReply({ content: `Tickets: total ${total}, open ${open}` });
    }

    if (name === 'viewprofile') {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser('user', true);
      const profile = getProfile(interaction.guildId!, user.id);
      if (!profile) return interaction.editReply({ content: 'No profile.' });
      return interaction.editReply({ content: `Profile for ${user.tag}: ${profile.displayName || ''} - ${profile.bio || ''}` });
    }

    // --- Ticket ---
    if (name === 'close') {
      await interaction.deferReply({ ephemeral: true });
      if (!interaction.channel) return interaction.editReply('No channel');
      const ticket = getTicketByChannel(interaction.channel.id);
      if (!ticket) return interaction.editReply('This channel is not a ticket.');
      const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
      if (ticket.userId !== interaction.user.id && !isStaff(member)) return interaction.editReply('You do not have permission to close this ticket.');
      const result = await ticketManager.closeTicket(interaction.channel.id, interaction.user.id);
      if (settings && (settings as any).transcriptChannelId && result.transcriptPath) {
        try {
          const tc = await client.channels.fetch((settings as any).transcriptChannelId);
          if (tc && (tc as any).isTextBased()) await (tc as any).send({ content: `Transcript for ticket ${result.ticketId}`, files: [result.transcriptPath] as any });
        } catch(e) {}
      }
      if (ticket) incStaffStat(ticket.guildId, interaction.user.id, 'closedCount');
      return interaction.editReply({ content: `Ticket closed. Transcript: ${result.transcriptPath}` });
    }

    if (name === 'rename') {
      await interaction.deferReply({ ephemeral: true });
      const newName = interaction.options.getString('name', true);
      if (!interaction.channel || !interaction.channel.isTextBased()) return interaction.editReply('This command must be used in a ticket channel');
      const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
      const ticket = getTicketByChannel(interaction.channel.id);
      if (!ticket) return interaction.editReply('This channel is not a ticket.');
      if (ticket.userId !== interaction.user.id && !isStaff(member)) return interaction.editReply('You do not have permission to rename this ticket.');
      await interaction.channel.setName(newName);
      return interaction.editReply({ content: `Channel renamed to ${newName}.` });
    }

    if (name === 'topic') {
      await interaction.deferReply({ ephemeral: true });
      const topic = interaction.options.getString('topic', true);
      if (!interaction.channel || !interaction.channel.isTextBased()) return interaction.editReply('This command must be used in a ticket channel');
      const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
      const ticket = getTicketByChannel(interaction.channel.id);
      if (!ticket) return interaction.editReply('This channel is not a ticket.');
      if (ticket.userId !== interaction.user.id && !isStaff(member)) return interaction.editReply('You do not have permission to set the topic.');
      await interaction.channel.setTopic(topic);
      return interaction.editReply({ content: 'Topic updated.' });
    }

    if (name === 'transcript') {
      await interaction.deferReply({ ephemeral: true });
      const ticket = getTicketByChannel(interaction.channel?.id || '');
      if (!ticket) return interaction.editReply('This channel is not a ticket.');
      if (!ticket.transcriptPath) return interaction.editReply('No transcript saved yet.');
      return interaction.editReply({ content: `Transcript path: ${ticket.transcriptPath}` });
    }

    // fallback
    await interaction.reply({ ephemeral: true, content: 'Unknown command or not implemented.' });
  } catch (err) {
    console.error('Interaction error', err);
    try { if (interaction.deferred) await interaction.editReply({ content: 'An error occurred' }); else await interaction.reply({ content: 'An error occurred', ephemeral: true }); } catch {}
  }
});
