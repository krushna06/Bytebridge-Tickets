"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface ProfileStats {
  bio?: string
  timezone?: string
  activeHours?: string
  closedCount: number
  claimedCount: number
  avgResponseTime?: number
  avgResolveTime?: number
  avgFeedbackScore?: number
}

const TIMEZONES = [
  "UTC",
  "EST",
  "CST",
  "MST",
  "PST",
  "GMT",
  "CET",
  "IST",
  "JST",
  "AEST",
]

function formatDuration(ms?: number): string {
  if (!ms || ms === 0) return "0s"
  
  const seconds = Math.round(ms / 1000)
  const minutes = Math.round(seconds / 60)
  const hours = Math.round(minutes / 60)
  const days = Math.round(hours / 24)
  
  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

export function Profile() {
  const { data: session } = useSession()
  const [bio, setBio] = useState("")
  const [timezone, setTimezone] = useState("")
  const [activeHours, setActiveHours] = useState("")
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const guildId = process.env.NEXT_PUBLIC_GUILD_ID

  useEffect(() => {
    if (!session?.user?.id || !guildId) return

    const fetchProfileAndStats = async () => {
      try {
        setLoading(true)
        const apiUrl = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || "http://localhost:3001"
        const response = await fetch(
          `${apiUrl}/api/guilds/${guildId}/members/${session.user.id}/profile`,
          {
            headers: {
              "X-API-KEY": process.env.NEXT_PUBLIC_DASHBOARD_API_KEY || "",
            },
          }
        )

        if (response.ok) {
          const data = await response.json()
          setBio(data.bio || "")
          setTimezone(data.timezone || "UTC")
          setActiveHours(data.activeHours || "")
          setStats(data)
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error)
        toast.error("Failed to load profile")
      } finally {
        setLoading(false)
      }
    }

    fetchProfileAndStats()
  }, [session?.user?.id, guildId])

  const handleSaveProfile = async () => {
    if (!session?.user?.id || !guildId) return

    try {
      setSaving(true)
      const apiUrl = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || "http://localhost:3001"
      const response = await fetch(
        `${apiUrl}/api/guilds/${guildId}/members/${session.user.id}/profile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": process.env.NEXT_PUBLIC_DASHBOARD_API_KEY || "",
          },
          body: JSON.stringify({
            bio,
            timezone,
            activeHours,
          }),
        }
      )

      if (response.ok) {
        toast.success("Profile updated successfully")
      } else {
        toast.error("Failed to update profile")
      }
    } catch (error) {
      console.error("Failed to save profile:", error)
      toast.error("Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Loading profile...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">Manage your profile and view your statistics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Edit Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your bio, timezone, and active hours</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Bio</label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  className="mt-1"
                  rows={4}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Timezone</label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Active Hours</label>
                <Input
                  value={activeHours}
                  onChange={(e) => setActiveHours(e.target.value)}
                  placeholder="e.g., 9AM-5PM EST"
                  className="mt-1"
                />
              </div>
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Stats Section */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-b pb-4">
                <p className="text-sm text-muted-foreground">Tickets Closed</p>
                <p className="text-3xl font-bold">{stats?.closedCount ?? 0}</p>
              </div>
              <div className="border-b pb-4">
                <p className="text-sm text-muted-foreground">Tickets Claimed</p>
                <p className="text-3xl font-bold">{stats?.claimedCount ?? 0}</p>
              </div>
              <div className="border-b pb-4">
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
                <p className="text-3xl font-bold">{formatDuration(stats?.avgResponseTime)}</p>
              </div>
              <div className="border-b pb-4">
                <p className="text-sm text-muted-foreground">Avg Resolve Time</p>
                <p className="text-3xl font-bold">{formatDuration(stats?.avgResolveTime)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Feedback Score</p>
                <p className="text-3xl font-bold">{(stats?.avgFeedbackScore ?? 0).toFixed(1)}/5</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
