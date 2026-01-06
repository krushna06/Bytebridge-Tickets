import { ChatInputCommandInteraction } from 'discord.js';
import fs from 'fs';
import { createOrUpdateProfile, getProfile, getLeaderboard, countTicketsByGuild, countOpenTicketsByGuild, listTicketsForGuild, getGuildSettings } from '../lib/database';
import { Ctx, makeEmbed, isStaffFromSettings } from './common';

export const leaderboard = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const rows = getLeaderboard(interaction.guildId!);
  if (!rows.length) return interaction.editReply({ embeds: [makeEmbed('No stats yet.', undefined, interaction.guildId || undefined)] });
  const out = rows.map((r: any, i: number) => `${i + 1}. <@${r.userId}> - closed: ${r.closedCount || 0}, claimed: ${r.claimedCount || 0}`).join('\n');
  return interaction.editReply({ embeds: [makeEmbed(`Leaderboard:\n${out}`, undefined, interaction.guildId || undefined)] });
};

export const setprofile = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const display = interaction.options.getString('display') || interaction.options.getString('name') || undefined;
  const bio = interaction.options.getString('bio') || undefined;
  createOrUpdateProfile(interaction.guildId!, interaction.user.id, display, bio);
  return interaction.editReply({ embeds: [makeEmbed('Profile updated.', undefined, interaction.guildId || undefined)] });
};

export const stats = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const total = countTicketsByGuild(interaction.guildId!);
  const open = countOpenTicketsByGuild(interaction.guildId!);

  const tickets = listTicketsForGuild(interaction.guildId!);

  const closed = tickets.filter(t => t.closedAt && t.closedAt > 0);
  const resolveDurations = closed.map(t => (t.closedAt! - t.createdAt)).filter(d => typeof d === 'number' && d >= 0);
  const avgResolveMs = resolveDurations.length ? Math.round(resolveDurations.reduce((a, b) => a + b, 0) / resolveDurations.length) : null;

  const responseDurations: number[] = [];
  const staffResponseByUser: Record<string, number[]> = {};
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId!) : null;

  const staffCache = new Map<string, boolean>();

  for (const t of tickets) {
    if (!t.transcriptPath) continue;
    let content: string;
    try {
      content = fs.readFileSync(t.transcriptPath, 'utf8');
    } catch (e) {
      continue;
    }
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    let firstStaffFound = false;
    for (const line of lines) {
      const m = line.match(/^\[(.+?)\].*\((\d+)\):\s*(.*)$/);
      if (!m) continue;
      const ts = Date.parse(m[1]);
      const authorId = m[2];
      const msg = m[3] || '';

      try {
        if (ctx.client.user && authorId === ctx.client.user.id) continue;
      } catch {}

      if (authorId === String(t.userId)) continue;

      let isStaff = staffCache.get(authorId);
      if (typeof isStaff === 'undefined') {
        try {
          const member = interaction.guild ? await interaction.guild.members.fetch(authorId).catch(() => null) : null;
          isStaff = isStaffFromSettings(member as any, (settings as any) || undefined);
        } catch (e) {
          isStaff = false;
        }
        staffCache.set(authorId, isStaff);
      }

      if (isStaff) {
        const respMs = ts - t.createdAt;
        if (respMs >= 0) responseDurations.push(respMs);
        // per-user
        if (!staffResponseByUser[authorId]) staffResponseByUser[authorId] = [];
        if (respMs >= 0) staffResponseByUser[authorId].push(respMs);
        firstStaffFound = true;
        break;
      }
    }
    if (!firstStaffFound) continue;
  }

  const avgResponseMs = responseDurations.length ? Math.round(responseDurations.reduce((a, b) => a + b, 0) / responseDurations.length) : null;

  const target = interaction.options.getUser('user', false);
  if (target) {
    const uid = target.id;
    const userResponses = staffResponseByUser[uid] || [];
    const avgUserResponse = userResponses.length ? Math.round(userResponses.reduce((a, b) => a + b, 0) / userResponses.length) : null;

    const closedByUserDurations: number[] = [];
    for (const t of tickets) {
      if (!t.transcriptPath) continue;
      let content: string;
      try { content = fs.readFileSync(t.transcriptPath, 'utf8'); } catch { continue; }
      const m = content.match(/Ticket closed by <@(\d+)>/);
      if (m && m[1] === uid && t.closedAt && t.closedAt > 0) {
        const dur = t.closedAt - t.createdAt;
        if (dur >= 0) closedByUserDurations.push(dur);
      }
    }
    const avgUserResolve = closedByUserDurations.length ? Math.round(closedByUserDurations.reduce((a, b) => a + b, 0) / closedByUserDurations.length) : null;

    const lines = [
      `User stats for ${target.tag}:`,
      `Tickets (server): total ${total}, open ${open}`,
      `Avg response (server-wide): ${formatMs(avgResponseMs)}`,
      `Avg response: ${formatMs(avgUserResponse)} (${userResponses.length} first-responses)` ,
      `Avg resolve: ${formatMs(avgUserResolve)} (${closedByUserDurations.length} closes)`
    ];
    return interaction.editReply({ embeds: [makeEmbed(lines.join('\n'), undefined, interaction.guildId || undefined)] });
  }

  const out = [
    `Tickets: total ${total}, open ${open}`,
    `Avg response time: ${formatMs(avgResponseMs)} (${responseDurations.length} samples)` ,
    `Avg resolve time: ${formatMs(avgResolveMs)} (${resolveDurations.length} samples)`
  ];
  return interaction.editReply({ embeds: [makeEmbed(out.join('\n'), undefined, interaction.guildId || undefined)] });
};

function formatMs(ms: number | null) {
  if (ms === null || typeof ms === 'undefined') return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / (1000 * 60)) % 60;
  const h = Math.floor(ms / (1000 * 60 * 60));
  const parts: string[] = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}

export const viewprofile = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user', true);
  const profile = getProfile(interaction.guildId!, user.id) as any | null;
  if (!profile) return interaction.editReply({ embeds: [makeEmbed('No profile.', undefined, interaction.guildId || undefined)] });
  return interaction.editReply({ embeds: [makeEmbed(`Profile for ${user.tag}: ${profile.displayName || ''} - ${profile.bio || ''}`, undefined, interaction.guildId || undefined)] });
};
