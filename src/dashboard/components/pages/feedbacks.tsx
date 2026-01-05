"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Star, User, Trash2 } from "lucide-react"

interface Feedback {
  id: string
  ticketId: string
  userId: string
  score: number
  handledBy: string | null
  date: string
}

export function Feedbacks() {
  const [items, setItems] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

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
        setItems(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchFeedbacks()
  }, [])

  const handleDeleteFeedback = async (feedbackId: string) => {
    if (!confirm("Are you sure you want to delete this feedback?")) return
    setActionLoading(feedbackId)
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
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Feedbacks</h1>
        <p className="text-muted-foreground">Review customer feedback on resolved tickets</p>
      </div>

      <div className="space-y-3">
        {items.map((feedback) => (
          <Card key={feedback.id}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">User {feedback.userId}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(feedback.date).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < feedback.score ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteFeedback(feedback.id)}
                    disabled={actionLoading === feedback.id}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-foreground leading-relaxed">
                Ticket {feedback.ticketId} rated {feedback.score}/5
                {feedback.handledBy ? ` • handled by ${feedback.handledBy}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">Ticket: {feedback.ticketId}</p>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && !loading && (
          <p className="text-muted-foreground text-sm">No feedback has been recorded for this guild yet.</p>
        )}
      </div>
    </div>
  )
}
