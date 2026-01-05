"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trash2, Lock, Unlock } from "lucide-react"

interface LiveTicket {
  id: number
  userId: string
  status: string
  createdAt: number
  closedAt?: number | null
}

export function Tickets() {
  const [liveTickets, setLiveTickets] = useState<LiveTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const fetchTickets = () => {
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    if (!guildId) return
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = {}
    if (apiKey) headers["X-API-KEY"] = apiKey
    fetch(`${apiBase}/api/guilds/${guildId}/tickets`, {
      headers,
    })
      .then((res) => res.json())
      .then((rows: any[]) => {
        const mapped: LiveTicket[] = rows.map((r) => ({
          id: r.id,
          userId: String(r.userId),
          status: String(r.status),
          createdAt: Number(r.createdAt),
          closedAt: typeof r.closedAt === "number" ? r.closedAt : null,
        }))
        setLiveTickets(mapped)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchTickets()
  }, [])

  const handleCloseTicket = async (ticketId: number) => {
    setActionLoading(ticketId)
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = { "Content-Type": "application/json" }
    if (apiKey) headers["X-API-KEY"] = apiKey
    try {
      const res = await fetch(`${apiBase}/api/guilds/${guildId}/tickets/${ticketId}/close`, {
        method: "POST",
        headers,
        body: JSON.stringify({ closerId: "dashboard" }),
      })
      if (res.ok) {
        fetchTickets()
      }
    } catch (err) {
      console.error("Error closing ticket:", err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReopenTicket = async (ticketId: number) => {
    setActionLoading(ticketId)
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = { "Content-Type": "application/json" }
    if (apiKey) headers["X-API-KEY"] = apiKey
    try {
      const res = await fetch(`${apiBase}/api/guilds/${guildId}/tickets/${ticketId}/reopen`, {
        method: "POST",
        headers,
      })
      if (res.ok) {
        fetchTickets()
      }
    } catch (err) {
      console.error("Error reopening ticket:", err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteTicket = async (ticketId: number) => {
    if (!confirm("Are you sure you want to delete this ticket?")) return
    setActionLoading(ticketId)
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = {}
    if (apiKey) headers["X-API-KEY"] = apiKey
    try {
      const res = await fetch(`${apiBase}/api/guilds/${guildId}/tickets/${ticketId}`, {
        method: "DELETE",
        headers,
      })
      if (res.ok) {
        fetchTickets()
      }
    } catch (err) {
      console.error("Error deleting ticket:", err)
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-green-100 text-green-800"
      case "closed":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-blue-100 text-blue-800"
    }
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Tickets</h1>
        <p className="text-muted-foreground">View and manage tickets created in your Discord server</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">Tickets</h2>
        {liveTickets.map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ticket #{t.id}</CardTitle>
                  <CardDescription>
                    <Badge className={getStatusColor(t.status)}>{t.status}</Badge>
                    <span className="ml-2">User {t.userId}</span>
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {t.status === "open" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCloseTicket(t.id)}
                      disabled={actionLoading === t.id}
                      className="gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      Close
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReopenTicket(t.id)}
                      disabled={actionLoading === t.id}
                      className="gap-2"
                    >
                      <Unlock className="w-4 h-4" />
                      Reopen
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteTicket(t.id)}
                    disabled={actionLoading === t.id}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Created at {new Date(t.createdAt).toLocaleString()}
                {t.closedAt ? ` • Closed at ${new Date(t.closedAt).toLocaleString()}` : ""}
              </p>
            </CardContent>
          </Card>
        ))}
        {liveTickets.length === 0 && !loading && (
          <p className="text-muted-foreground text-sm">No tickets have been recorded for this guild yet.</p>
        )}
      </div>
    </div>
  )
}
