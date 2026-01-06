import { TextChannel, NewsChannel } from 'discord.js';
import { createTranscript, ExportReturnType } from 'discord-html-transcripts';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const TRANSCRIPTS_PATH = process.env.TRANSCRIPTS_PATH || path.resolve(process.cwd(), 'transcripts');

if (!fs.existsSync(TRANSCRIPTS_PATH)) {
  fs.mkdirSync(TRANSCRIPTS_PATH, { recursive: true });
}

export async function saveChannelTranscript(channel: TextChannel | NewsChannel, ticketId: number) {
  try {
    const filename = `ticket-${channel.guild.id}-${ticketId}-${Date.now()}.html`;
    const filepath = path.join(TRANSCRIPTS_PATH, filename);

    const htmlContent = await createTranscript(channel, {
      limit: -1,
      returnType: ExportReturnType.String,
      saveImages: true,
      poweredBy: false,
    });

    if (!htmlContent || typeof htmlContent !== 'string') {
      throw new Error('Failed to create transcript - invalid content');
    }

    fs.writeFileSync(filepath, htmlContent);

    return filepath;
  } catch (err) {
    console.error('Error creating transcript:', err);
    throw err;
  }
}
