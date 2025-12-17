import fs from 'fs';
import path from 'path';
import { TextChannel, NewsChannel, Message } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const TRANSCRIPTS_PATH = process.env.TRANSCRIPTS_PATH || path.resolve(process.cwd(), 'transcripts');
if (!fs.existsSync(TRANSCRIPTS_PATH)) fs.mkdirSync(TRANSCRIPTS_PATH, { recursive: true });

export async function saveChannelTranscript(channel: TextChannel | NewsChannel, ticketId: number) {
  const parts: string[] = [];
  let lastId: string | undefined;
  while (true) {
    const options: any = { limit: 100 };
    if (lastId) options.before = lastId;
    const messages: any = await channel.messages.fetch(options);
    if (!messages || (messages.size !== undefined && messages.size === 0)) break;
    const arr = Array.from((messages.values && messages.values()) || []).reverse();
    for (const m of arr) {
      parts.push(formatMessage(m));
    }
    lastId = (messages.last && messages.last()?.id) || undefined;
    if (messages.size !== undefined && messages.size < 100) break;
  }

  const filename = `ticket-${channel.guild.id}-${ticketId}-${Date.now()}.txt`;
  const filepath = path.join(TRANSCRIPTS_PATH, filename);
  fs.writeFileSync(filepath, parts.join('\n'));
  return filepath;
}

function formatMessage(m: any) {
  const time = new Date(m.createdTimestamp).toISOString();
  const author = `${m.author?.tag || m.author?.username || 'unknown'} (${m.author?.id || 'unknown'})`;
  const content = m.content || '';
  const attachments = (m.attachments && m.attachments.size) ? ` [${Array.from(m.attachments.values()).map((a: any) => a.url).join(', ')}]` : '';
  return `[${time}] ${author}: ${content}${attachments}`;
}
