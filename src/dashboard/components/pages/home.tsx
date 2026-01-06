"use client"

import { useEffect, useState } from "react"
import { XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type OverviewResponse = {
  totalTickets: number
  openTickets: number
  avgResolveMs: number | null
  avgResponseMs: number | null
}

type StatItem = {
  label: string
  value: string | number
}

function formatDuration(ms: number | null) {
  if (!ms || ms <= 0) return "N/A"
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = seconds / 60
  if (minutes < 60) return `${minutes.toFixed(1)}m`
  const hours = minutes / 60
  if (hours < 24) return `${hours.toFixed(1)}h`
  const days = hours / 24
  return `${days.toFixed(1)}d`
}

function getDurationInBestUnit(ms: number | null): { value: number; unit: string } {
  if (!ms || ms <= 0) return { value: 0, unit: "N/A" }
  const seconds = ms / 1000
  if (seconds < 60) return { value: parseFloat(seconds.toFixed(1)), unit: "s" }
  const minutes = seconds / 60
  if (minutes < 60) return { value: parseFloat(minutes.toFixed(1)), unit: "m" }
  const hours = minutes / 60
  if (hours < 24) return { value: parseFloat(hours.toFixed(1)), unit: "h" }
  const days = hours / 24
  return { value: parseFloat(days.toFixed(1)), unit: "d" }
}

export function Home() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    if (!guildId) {
      setLoading(false)
      return
    }
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = {}
    if (apiKey) headers["X-API-KEY"] = apiKey
    fetch(`${apiBase}/api/guilds/${guildId}/overview`, {
      headers,
    })
      .then((res) => res.json())
      .then((data: OverviewResponse) => {
        setOverview(data)
      })
      .finally(() => setLoading(false))
  }, [])

  const stats: StatItem[] = [
    {
      label: "Total Tickets",
      value: overview ? overview.totalTickets : loading ? "…" : 0,
    },
    {
      label: "Open Tickets",
      value: overview ? overview.openTickets : loading ? "…" : 0,
    },
    {
      label: "Avg Response Time",
      value: overview ? formatDuration(overview.avgResponseMs) : loading ? "…" : "N/A",
    },
    {
      label: "Avg Resolve Time",
      value: overview ? formatDuration(overview.avgResolveMs) : loading ? "…" : "N/A",
    },
  ]

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back to your ticket management system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="discord-card">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">{stat.value}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="discord-card">
        <CardHeader>
          <CardTitle>Time Metrics Comparison</CardTitle>
          <CardDescription>Average response and resolution times based on recent tickets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            {overview ? (
              <>
                {(() => {
                  const responseUnit = getDurationInBestUnit(overview.avgResponseMs)
                  const resolveUnit = getDurationInBestUnit(overview.avgResolveMs)
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          {
                            name: "Response Time",
                            value: responseUnit.value,
                          },
                          {
                            name: "Resolve Time",
                            value: resolveUnit.value,
                          },
                        ]}
                        margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#40444b" />
                        <XAxis dataKey="name" stroke="#949ba4" />
                        <YAxis stroke="#949ba4" label={{ value: `Time (${responseUnit.unit === resolveUnit.unit ? responseUnit.unit : 'mixed'})`, angle: -90, position: 'insideLeft' }} />
                        <Bar
                          dataKey="value"
                          fill="#5865f2"
                          name="Duration"
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                })()}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading chart data...
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
