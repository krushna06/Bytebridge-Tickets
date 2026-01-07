import { Router } from "express"
import { getProfile, createOrUpdateProfile } from "../../lib/database"
import db from "../../lib/database"

export function registerProfileRoutes(app: any, requireKey: any) {
  app.get("/api/guilds/:guildId/members/:userId/profile", requireKey, async (req: any, res: any) => {
    try {
      const { guildId, userId } = req.params

      const profile = getProfile(guildId, userId)

      const statsStmt = db.prepare('SELECT closedCount, claimedCount FROM staff_stats WHERE guildId = ? AND userId = ?')
      const stats = statsStmt.get(guildId, userId) as any

      const responseTimeStmt = db.prepare(`
        SELECT AVG(t.closedAt - t.createdAt) as avgResponseTime
        FROM tickets t
        INNER JOIN ticket_meta tm ON t.id = tm.ticketId
        WHERE t.guildId = ? AND tm.claimedBy = ? AND t.closedAt IS NOT NULL
      `)
      const responseTimeResult = responseTimeStmt.get(guildId, userId) as any

      const resolveTimeStmt = db.prepare(`
        SELECT AVG(t.closedAt - t.createdAt) as avgResolveTime
        FROM tickets t
        WHERE t.guildId = ? AND t.closedBy = ? AND t.closedAt IS NOT NULL
      `)
      const resolveTimeResult = resolveTimeStmt.get(guildId, userId) as any

      const feedbackStmt = db.prepare(`
        SELECT AVG(score) as avgFeedbackScore
        FROM ticket_feedback
        WHERE guildId = ? AND handledBy = ?
      `)
      const feedbackResult = feedbackStmt.get(guildId, userId) as any

      res.json({
        bio: profile?.bio || "",
        timezone: profile?.timezone || "UTC",
        activeHours: profile?.activeHours || "",
        closedCount: stats?.closedCount || 0,
        claimedCount: stats?.claimedCount || 0,
        avgResponseTime: responseTimeResult?.avgResponseTime || 0,
        avgResolveTime: resolveTimeResult?.avgResolveTime || 0,
        avgFeedbackScore: feedbackResult?.avgFeedbackScore || 0,
      })
    } catch (error) {
      console.error("Error fetching profile:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  })

  app.post("/api/guilds/:guildId/members/:userId/profile", requireKey, async (req: any, res: any) => {
    try {
      const { guildId, userId } = req.params
      const { bio, timezone, activeHours } = req.body

      createOrUpdateProfile(guildId, userId, bio, timezone, activeHours)

      res.json({
        success: true,
        bio,
        timezone,
        activeHours,
      })
    } catch (error) {
      console.error("Error updating profile:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  })
}
