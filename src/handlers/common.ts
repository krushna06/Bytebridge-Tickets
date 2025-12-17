import { Client, GuildMember, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export type Ctx = { client: Client; ticketManager: any };

export function isStaffFromSettings(member: GuildMember | null | undefined, settings: any) {
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

export function makeEmbed(desc: string, title?: string) {
  const e = new EmbedBuilder().setDescription(desc);
  if (title) e.setTitle(title);
  return e;
}
