"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle, CheckCircle, Info } from "lucide-react"

interface LogItem {
  id: string
  type: "info" | "success" | "error"
  action: string
  details: string
  timestamp: string
}

export function Logs() {
  const [items, setItems] = useState<LogItem[]>([])
  const [count, setCount] = useState(100)
  const [loading, setLoading] = useState(false)

  const fetchLogs = (logCount: number) => {
    setLoading(true)
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    if (!guildId) return
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = {}
    if (apiKey) headers["X-API-KEY"] = apiKey
    fetch(`${apiBase}/api/guilds/${guildId}/logs?count=${logCount}`, {
      headers,
    })
      .then((res) => res.json())
      .then((data: LogItem[]) => {
        setItems(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchLogs(count)
  }, [])

  const handleCountChange = (newCount: number) => {
    setCount(newCount)
    fetchLogs(newCount)
  }

  const getLogIcon = (type: LogItem["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-emerald-500" />
      case "error":
        return <AlertCircle className="w-5 h-5 text-destructive" />
      case "info":
      default:
        return <Info className="w-5 h-5 text-primary" />
    }
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Logs</h1>
          <p className="text-muted-foreground">System activity and event logs</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-foreground">Show logs:</label>
        <select
          value={count}
          onChange={(e) => handleCountChange(Number(e.target.value))}
          disabled={loading}
          className="px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
        >
          <option value={25}>Last 25</option>
          <option value={50}>Last 50</option>
          <option value={100}>Last 100</option>
          <option value={250}>Last 250</option>
          <option value={500}>Last 500</option>
        </select>
      </div>

      <div className="space-y-2">
        {items.map((log) => (
          <Card key={log.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">{getLogIcon(log.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">{log.action}</p>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{log.details}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <p className="text-muted-foreground text-sm">No logs available yet.</p>
        )}
      </div>
    </div>
  )
}
