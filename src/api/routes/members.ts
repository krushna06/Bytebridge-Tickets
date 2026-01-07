import { Router } from "express"
import { client } from "../server"

export function registerMemberRoutes(app: any, requireKey: any) {
  app.get("/api/guilds/:guildId/members/:userId", requireKey, async (req: any, res: any) => {
    try {
      const { guildId, userId } = req.params

      const guild = client.guilds.cache.get(guildId)
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" })
      }

      const member = await guild.members.fetch(userId).catch(() => null)
      if (!member) {
        return res.status(404).json({ error: "Member not found" })
      }

      const permissions = member.permissions.toArray()
      const isAdmin = member.permissions.has("Administrator")
      const canManageGuild = member.permissions.has("ManageGuild")

      const roles = member.roles.cache
        .filter((r) => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => ({ id: r.id, name: r.name, position: r.position, color: r.color }))

      const topRole = roles.length > 0 ? roles[0].name : "Unknown"

      res.json({
        id: member.id,
        username: member.user.username,
        avatar: member.user.avatar,
        isAdmin,
        canManageGuild,
        permissions,
        roles,
        topRole,
      })
    } catch (error) {
      console.error("Error fetching member:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  })
}
