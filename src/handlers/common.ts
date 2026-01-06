import { Client, GuildMember, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getGuildSettings } from '../lib/database';

export type Ctx = { client: Client; ticketManager: any };

export function isStaffFromSettings(member: GuildMember | null | undefined, settings: any) {
  try {
    if (!member) return false;

    if (settings && settings.staffRoleId) {
      if (member.roles?.cache?.has(settings.staffRoleId)) return true;
    }

    if (settings && settings.allowedRoles) {
      let roles: string[] = [];
      try {
        if (typeof settings.allowedRoles === 'string') {
          const s = settings.allowedRoles.trim();
          if (s.startsWith('[')) {
            roles = JSON.parse(s) as string[];
          } else if (s.length) {
            roles = s.split(',').map((p: string) => p.trim()).filter(Boolean);
          }
        } else if (Array.isArray(settings.allowedRoles)) {
          roles = settings.allowedRoles;
        }
      } catch (e) {
        roles = [];
      }
      for (const r of roles) {
        if (member.roles?.cache?.has(r)) return true;
      }
    }

    return (
      member.permissions?.has(PermissionFlagsBits.ManageGuild) ||
      member.permissions?.has(PermissionFlagsBits.ManageChannels)
    );
  } catch (e) {
    return false;
  }
}

export function makeEmbed(desc: string, title?: string, guildId?: string) {
  const e = new EmbedBuilder().setDescription(desc);
  if (title) e.setTitle(title);
  
  if (guildId) {
    const settings = getGuildSettings(guildId);
    if (settings?.embedColor) {
      const colorNum = parseInt(settings.embedColor.replace('#', ''), 16);
      e.setColor(colorNum);
    }
  }
  
  return e;
}
