import { Router } from "express"
import db from "../../lib/database"

let client: any = null

export function setLeaderboardClient(discordClient: any) {
  client = discordClient
}

export function registerLeaderboardRoutes(app: any, requireKey: any) {
  app.get("/api/guilds/:guildId/leaderboard", requireKey, async (req: any, res: any) => {
    try {
      const { guildId } = req.params
      const sortBy = req.query.sort || "resolved"
      const limit = Math.min(parseInt(req.query.limit) || 10, 100)

      let query = ""

      switch (sortBy) {
        case "resolved":
          query = `
            SELECT ss.userId, ss.closedCount as value
            FROM staff_stats ss
            WHERE ss.guildId = ?
            ORDER BY ss.closedCount DESC
            LIMIT ?
          `
          break
        case "response":
          query = `
            SELECT tm.claimedBy as userId, AVG(t.closedAt - t.createdAt) as value
            FROM tickets t
            INNER JOIN ticket_meta tm ON t.id = tm.ticketId
            WHERE t.guildId = ? AND t.closedAt IS NOT NULL AND tm.claimedBy IS NOT NULL
            GROUP BY tm.claimedBy
            ORDER BY value ASC
            LIMIT ?
          `
          break
        case "resolve":
          query = `
            SELECT t.closedBy as userId, AVG(t.closedAt - t.createdAt) as value
            FROM tickets t
            WHERE t.guildId = ? AND t.closedAt IS NOT NULL AND t.closedBy IS NOT NULL
            GROUP BY t.closedBy
            ORDER BY value ASC
            LIMIT ?
          `
          break
        case "feedback":
          query = `
            SELECT tf.handledBy as userId, AVG(tf.score) as value
            FROM ticket_feedback tf
            WHERE tf.guildId = ?
            GROUP BY tf.handledBy
            ORDER BY value DESC
            LIMIT ?
          `
          break
        default:
          return res.status(400).json({ error: "Invalid sort parameter" })
      }

      const stmt = db.prepare(query)
      const entries = stmt.all(guildId, limit) as any[]

      res.json({
        sortBy,
        limit,
        entries: entries.map((e) => ({
          userId: e.userId,
          value: e.value || 0,
        })),
      })
    } catch (error) {
      console.error("Error fetching leaderboard:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  })

  app.get("/api/users/:userId", requireKey, async (req: any, res: any) => {
    try {
      const { userId } = req.params

      if (!client) {
        return res.status(500).json({ error: "Discord client not available" })
      }

      const user = await client.users.fetch(userId).catch(() => null)

      if (!user) {
        return res.status(404).json({ error: "User not found" })
      }

      res.json({
        id: user.id,
        username: user.username,
        avatar: user.avatar,
      })
    } catch (error) {
      console.error("Error fetching user:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  })
}
