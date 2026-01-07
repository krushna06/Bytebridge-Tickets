export function getTranscriptBaseUrl(): string {
  const transcriptsUrl = process.env.TRANSCRIPTS_URL || process.env.BOT_API_URL || 'http://localhost:3001';
  return transcriptsUrl.replace(/\/$/, '');
}
