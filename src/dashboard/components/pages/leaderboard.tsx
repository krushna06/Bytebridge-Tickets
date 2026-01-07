"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface LeaderboardEntry {
  userId: string
  value: number
  username?: string
}

type SortType = "resolved" | "response" | "resolve" | "feedback"

function formatDuration(ms?: number): string {
  if (!ms || ms === 0) return "N/A"

  const seconds = Math.round(ms / 1000)
  const minutes = Math.round(seconds / 60)
  const hours = Math.round(minutes / 60)
  const days = Math.round(hours / 24)

  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

function getDisplayValue(value: number, sortType: SortType): string {
  switch (sortType) {
    case "feedback":
      return `${(value || 0).toFixed(1)}/5`
    case "response":
    case "resolve":
      return formatDuration(value)
    case "resolved":
    default:
      return `${value || 0}`
  }
}

function getSortLabel(sortType: SortType): string {
  switch (sortType) {
    case "resolved":
      return "Total Tickets Resolved"
    case "response":
      return "Avg Response Time"
    case "resolve":
      return "Avg Resolve Time"
    case "feedback":
      return "Avg Feedback Score"
  }
}

export function Leaderboard() {
  const [sortBy, setSortBy] = useState<SortType>("resolved")
  const [limit, setLimit] = useState(10)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const guildId = process.env.NEXT_PUBLIC_GUILD_ID
  const apiUrl = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || "http://localhost:3001"
  const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY || ""

  useEffect(() => {
    if (!guildId) return

    const fetchLeaderboard = async () => {
      try {
        setLoading(true)
        const response = await fetch(
          `${apiUrl}/api/guilds/${guildId}/leaderboard?sort=${sortBy}&limit=${limit}`,
          {
            headers: {
              "X-API-KEY": apiKey,
            },
          }
        )

        if (response.ok) {
          const data = await response.json()
          const entriesWithUsernames = await Promise.all(
            (data.entries || []).map(async (entry: LeaderboardEntry) => {
              try {
                const userResponse = await fetch(`${apiUrl}/api/users/${entry.userId}`, {
                  headers: {
                    "X-API-KEY": apiKey,
                  },
                })
                if (userResponse.ok) {
                  const userData = await userResponse.json()
                  return { ...entry, username: userData.username }
                }
              } catch (error) {
                console.error(`Failed to fetch username for ${entry.userId}:`, error)
              }
              return entry
            })
          )
          setEntries(entriesWithUsernames)
        } else {
          toast.error("Failed to load leaderboard")
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error)
        toast.error("Failed to load leaderboard")
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [sortBy, limit, guildId, apiUrl, apiKey])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <p className="text-muted-foreground">View staff rankings and statistics</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff Rankings</CardTitle>
          <CardDescription>Sort by different metrics to see staff performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium">Sort By</label>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortType)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resolved">Total Tickets Resolved</SelectItem>
                  <SelectItem value="response">Avg Response Time</SelectItem>
                  <SelectItem value="resolve">Avg Resolve Time</SelectItem>
                  <SelectItem value="feedback">Avg Feedback Score</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <label className="text-sm font-medium">Show Top</label>
              <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading leaderboard...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No data available</div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-muted rounded-lg font-semibold text-sm">
                <div className="col-span-1">Rank</div>
                <div className="col-span-7">Staff Member</div>
                <div className="col-span-4 text-right">{getSortLabel(sortBy)}</div>
              </div>
              {entries.map((entry, index) => (
                <div key={entry.userId} className="grid grid-cols-12 gap-4 px-4 py-3 border rounded-lg hover:bg-muted/50 transition">
                  <div className="col-span-1 font-bold text-lg">#{index + 1}</div>
                  <div className="col-span-7">
                    <span className="text-sm">
                      {entry.username || `User ${entry.userId}`}
                    </span>
                  </div>
                  <div className="col-span-4 text-right font-semibold">
                    {getDisplayValue(entry.value, sortBy)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
