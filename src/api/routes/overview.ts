import fs from 'fs';
import { listTicketsForGuild, countTicketsByGuild, countOpenTicketsByGuild, getLeaderboard } from '../../lib/database';

export function registerOverviewRoutes(app: any, requireKey: any) {
  app.get('/api/guilds/:guildId/overview', requireKey, (req: any, res: any) => {
    const guildId = req.params.guildId;
    const totalTickets = countTicketsByGuild(guildId);
    const openTickets = countOpenTicketsByGuild(guildId);
    const tickets = listTicketsForGuild(guildId);
    
    const closed = tickets.filter((t: any) => t.closedAt && t.closedAt > 0);
    const resolveDurations = closed
      .map((t: any) => Number(t.closedAt) - Number(t.createdAt))
      .filter((d: any) => typeof d === 'number' && d >= 0);
    const avgResolveMs = resolveDurations.length
      ? Math.round(resolveDurations.reduce((a: number, b: number) => a + b, 0) / resolveDurations.length)
      : null;

    const responseDurations: number[] = [];
    for (const t of tickets as any[]) {
      if (!t.transcriptPath) continue;
      let content: string;
      try {
        content = fs.readFileSync(t.transcriptPath, 'utf8');
      } catch (e) {
        continue;
      }
      const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        const m = line.match(/^\[(.+?)\].*\((\d+)\):\s*(.*)$/);
        if (!m) continue;
        const ts = Date.parse(m[1]);
        const authorId = m[2];
        if (authorId === String(t.userId)) continue;
        const respMs = ts - Number(t.createdAt);
        if (respMs >= 0) responseDurations.push(respMs);
        break;
      }
    }
    const avgResponseMs = responseDurations.length
      ? Math.round(responseDurations.reduce((a, b) => a + b, 0) / responseDurations.length)
      : null;

    const leaderboard = getLeaderboard(guildId, 100);
    const totalClosed = leaderboard.reduce((sum: number, staff: any) => sum + (staff.closedCount || 0), 0);
    const totalClaimed = leaderboard.reduce((sum: number, staff: any) => sum + (staff.claimedCount || 0), 0);

    const volumeData: Array<{ date: string; open: number; closed: number }> = [];
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < 7; i++) {
      const dayStart = sevenDaysAgo + (i * 24 * 60 * 60 * 1000);
      const dayEnd = dayStart + (24 * 60 * 60 * 1000);
      
      const date = new Date(dayStart);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      const dayTickets = tickets.filter((t: any) => {
        const createdAt = Number(t.createdAt);
        return createdAt >= dayStart && createdAt < dayEnd;
      });
      
      const openCount = dayTickets.filter((t: any) => !t.closedAt || t.closedAt === 0).length;
      const closedCount = dayTickets.filter((t: any) => t.closedAt && t.closedAt > 0).length;
      
      volumeData.push({
        date: dateStr,
        open: openCount,
        closed: closedCount
      });
    }

    res.json({
      totalTickets,
      openTickets,
      avgResolveMs,
      avgResponseMs,
      totalClosed,
      totalClaimed,
      volumeData
    });
  });
}
