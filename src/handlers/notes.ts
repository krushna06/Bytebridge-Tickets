import { ChatInputCommandInteraction } from 'discord.js';
import { addNote, getNotesForUser, deleteNote } from '../lib/database';
import { Ctx, makeEmbed, isStaffFromSettings } from './common';

export const note = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const target = interaction.options.getUser('user') || interaction.user;
  const content = interaction.options.getString('text') || interaction.options.getString('content') || '';
  const isPrivate = 1;
  addNote(interaction.guildId!, interaction.user.id, target.id, content, isPrivate);
  try {
    const channel = interaction.channel;
    const settings = interaction.guildId ? (await import('../lib/database')).getGuildSettings(interaction.guildId) : null;
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
};

export const stickynotes = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
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
};

export const viewnotes = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user') || interaction.user;
  const notes = getNotesForUser(interaction.guildId!, user.id);
  if (!notes.length) return interaction.editReply({ embeds: [makeEmbed('No notes found.')] });
  const out = notes.map((n: any) => `- ${n.createdAt}: ${n.content}`).join('\n');
  return interaction.editReply({ embeds: [makeEmbed(`Notes for ${user.tag}:\n${out}`)] });
};
