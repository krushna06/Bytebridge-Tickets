"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Eye, X } from "lucide-react"

interface Transcript {
  id: string
  ticketId: string
  date: string
  path: string
}

export function Transcripts() {
  const [items, setItems] = useState<Transcript[]>([])
  const [viewingTranscript, setViewingTranscript] = useState<Transcript | null>(null)

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

  if (viewingTranscript) {
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const params = new URLSearchParams()
    params.set("path", viewingTranscript.path)
    if (apiKey) params.set("apiKey", apiKey)
    const transcriptUrl = `${apiBase}/api/transcript-html?${params.toString()}`

    return (
      <div className="p-8 space-y-8 h-screen flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Transcript Viewer</h1>
            <p className="text-muted-foreground">Ticket #{viewingTranscript.ticketId}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              onClick={() => handleDownload(viewingTranscript)}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
            <Button
              variant="outline"
              onClick={() => setViewingTranscript(null)}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Close
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
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setViewingTranscript(transcript)}
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </Button>
                  <Button
                    variant="default"
                    className="gap-2"
                    onClick={() => handleDownload(transcript)}
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </Button>
                </div>
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
