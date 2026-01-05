"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, MessageSquare } from "lucide-react"

interface Transcript {
  id: string
  ticketId: string
  date: string
  messages: number
  path: string
}

export function Transcripts() {
  const [items, setItems] = useState<Transcript[]>([])

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    if (!guildId) return
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = {}
    if (apiKey) headers["X-API-KEY"] = apiKey
    fetch(`${apiBase}/api/guilds/${guildId}/transcripts`, {
      headers,
    })
      .then((res) => res.json())
      .then((data: Transcript[]) => {
        setItems(data)
      })
      .catch(() => {})
  }, [])

  const handleDownload = (t: Transcript) => {
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const params = new URLSearchParams()
    params.set("path", t.path)
    if (apiKey) params.set("apiKey", apiKey)
    const url = `${apiBase}/api/transcript?${params.toString()}`
    if (typeof window !== "undefined") {
      window.open(url, "_blank")
    }
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Transcripts</h1>
        <p className="text-muted-foreground">View and download ticket transcripts</p>
      </div>

      <div className="space-y-3">
        {items.map((transcript) => (
          <Card key={transcript.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">Ticket #{transcript.ticketId}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(transcript.date).toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {transcript.messages} messages
                  </div>
                </div>
                <Button variant="default" className="gap-2 flex-shrink-0" onClick={() => handleDownload(transcript)}>
                  <Download className="w-4 h-4" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <p className="text-muted-foreground text-sm">No transcripts found for this guild yet.</p>
        )}
      </div>
    </div>
  )
}
