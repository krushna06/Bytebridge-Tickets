"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trash2, Lock, Eye, X, Download, Star } from "lucide-react"

interface LiveTicket {
  id: number
  userId: string
  status: string
  createdAt: number
  closedAt?: number | null
  transcriptPath?: string | null
}

interface Feedback {
  id: string
  ticketId: string
  userId: string
  score: number
  handledBy: string | null
  date: string
}

export function Tickets() {
  const [liveTickets, setLiveTickets] = useState<LiveTicket[]>([])
  const [feedbacks, setFeedbacks] = useState<Map<number, Feedback>>(new Map())
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [viewingTranscriptId, setViewingTranscriptId] = useState<number | null>(null)

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
          transcriptPath: r.transcriptPath || null,
        }))
        setLiveTickets(mapped)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const fetchFeedbacks = () => {
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    if (!guildId) return
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = {}
    if (apiKey) headers["X-API-KEY"] = apiKey
    fetch(`${apiBase}/api/guilds/${guildId}/feedbacks`, {
      headers,
    })
      .then((res) => res.json())
      .then((data: Feedback[]) => {
        const feedbackMap = new Map<number, Feedback>()
        data.forEach((f) => {
          feedbackMap.set(Number(f.ticketId), f)
        })
        setFeedbacks(feedbackMap)
      })
      .catch((err) => console.error("Failed to fetch feedbacks:", err))
  }

  useEffect(() => {
    fetchTickets()
    fetchFeedbacks()
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

  const handleDeleteFeedback = async (feedbackId: string) => {
    if (!confirm("Are you sure you want to delete this feedback?")) return
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = {}
    if (apiKey) headers["X-API-KEY"] = apiKey
    try {
      const res = await fetch(`${apiBase}/api/guilds/${guildId}/feedbacks/${feedbackId}`, {
        method: "DELETE",
        headers,
      })
      if (res.ok) {
        fetchFeedbacks()
      }
    } catch (err) {
      console.error("Error deleting feedback:", err)
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

  const handleDownloadTranscript = (ticket: LiveTicket) => {
    if (!ticket.transcriptPath) return
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const params = new URLSearchParams()
    params.set("path", ticket.transcriptPath)
    if (apiKey) params.set("apiKey", apiKey)
    const url = `${apiBase}/api/transcript?${params.toString()}`
    if (typeof window !== "undefined") {
      window.open(url, "_blank")
    }
  }

  if (viewingTranscriptId !== null) {
    const ticket = liveTickets.find(t => t.id === viewingTranscriptId)
    if (!ticket || !ticket.transcriptPath) {
      return (
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-foreground">Transcript Not Available</h1>
            <Button
              variant="outline"
              onClick={() => setViewingTranscriptId(null)}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Back
            </Button>
          </div>
        </div>
      )
    }

    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const params = new URLSearchParams()
    params.set("path", ticket.transcriptPath)
    if (apiKey) params.set("apiKey", apiKey)
    const transcriptUrl = `${apiBase}/api/transcript-html?${params.toString()}`

    return (
      <div className="p-8 space-y-8 h-screen flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Transcript Viewer</h1>
            <p className="text-muted-foreground">Ticket #{ticket.id}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              onClick={() => handleDownloadTranscript(ticket)}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
            <Button
              variant="outline"
              onClick={() => setViewingTranscriptId(null)}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Back
            </Button>
          </div>
        </div>

        <Card className="discord-card flex-1 overflow-hidden">
          <CardContent className="p-0 h-full">
            <iframe
              src={transcriptUrl}
              className="w-full h-full border-0"
              title="Transcript"
            />
          </CardContent>
        </Card>
      </div>
    )
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
                  <CardDescription className="flex items-center gap-3 mt-2">
                    <Badge className={getStatusColor(t.status)}>{t.status}</Badge>
                    <span>User {t.userId}</span>
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {t.status === "open" && (
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
                  )}
                  {t.transcriptPath && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewingTranscriptId(t.id)}
                      className="gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View
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
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Created at {new Date(t.createdAt).toLocaleString()}
                  </p>
                  {t.closedAt && (
                    <p className="text-sm text-muted-foreground">
                      Closed at {new Date(t.closedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                {feedbacks.has(t.id) && (
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const feedback = feedbacks.get(t.id)!
                          return (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < feedback.score ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                              }`}
                            />
                          )
                        })}
                      </div>
                      <span className="text-sm text-muted-foreground">{feedbacks.get(t.id)?.score}/5</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteFeedback(feedbacks.get(t.id)!.id)}
                        className="ml-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
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
