"use client"

import { useEffect, useState } from "react"
import { XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, Legend, Tooltip } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type OverviewResponse = {
  totalTickets: number
  openTickets: number
  avgResolveMs: number | null
  avgResponseMs: number | null
  totalClosed?: number
  totalClaimed?: number
  volumeData?: Array<{ date: string; open: number; closed: number }>
}

type StatItem = {
  label: string
  value: string | number
}

export function Home() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || "http://localhost:3001"
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
        console.log("Overview data:", data)
        setOverview(data)
      })
      .catch((err) => console.error("Failed to fetch overview:", err))
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
      label: "Total Closed",
      value: overview ? overview.totalClosed ?? 0 : loading ? "…" : 0,
    },
    {
      label: "Total Claimed",
      value: overview ? overview.totalClaimed ?? 0 : loading ? "…" : 0,
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
          <CardTitle>Ticket Volume Over Time</CardTitle>
          <CardDescription>Open vs Closed tickets over the last 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            {overview && overview.volumeData ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overview.volumeData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#40444b" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#949ba4"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="#949ba4"
                    label={{ value: 'Number of Tickets', angle: -90, position: 'insideLeft', offset: 10 }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#2c2f33', border: '1px solid #40444b', borderRadius: '4px' }}
                    labelStyle={{ color: '#dcddde' }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="line"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="open" 
                    stroke="#faa61a" 
                    strokeWidth={2}
                    dot={{ fill: '#faa61a', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Open Tickets"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="closed" 
                    stroke="#43b581" 
                    strokeWidth={2}
                    dot={{ fill: '#43b581', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Closed Tickets"
                  />
                </LineChart>
              </ResponsiveContainer>
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
