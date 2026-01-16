"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Toggle } from "@/components/ui/toggle"
import { HelpCircle, Plus, Trash2 } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

const CHANNEL_PREFIX_VARIABLES = [
  { name: "{count}", description: "Total ticket count for the guild" },
  { name: "{user}", description: "Username of the ticket creator" },
  { name: "{category}", description: "Category name" },
]

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const TIMEZONES = [
  "UTC", "EST", "CST", "MST", "PST", "GMT", "CET", "IST", "JST", "AEST", "NZST"
]

type WorkingHours = {
  [day: string]: { start: string; end: string } | null
}

export function Settings() {
  const [embedColor, setEmbedColor] = useState("#5865f2")
  const [embedFooter, setEmbedFooter] = useState("Support Team")
  const [claimEnabled, setClaimEnabled] = useState(true)
  const [staffRoles, setStaffRoles] = useState("")
  const [transcriptChannel, setTranscriptChannel] = useState("")
  const [feedbackChannel, setFeedbackChannel] = useState("")
  const [logsChannel, setLogsChannel] = useState("")
  const [channelPrefix, setChannelPrefix] = useState("{category}-{count}")
  const [timezone, setTimezone] = useState("UTC")
  const [workingHours, setWorkingHours] = useState<WorkingHours>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    if (!guildId) return
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = {}
    if (apiKey) headers["X-API-KEY"] = apiKey
    fetch(`${apiBase}/api/guilds/${guildId}/settings`, {
      headers,
    })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.embedColor === "string") setEmbedColor(data.embedColor)
        if (typeof data.embedFooter === "string") setEmbedFooter(data.embedFooter)
        if (typeof data.claimEnabled === "boolean") setClaimEnabled(data.claimEnabled)
        if (typeof data.staffRoles === "string") setStaffRoles(data.staffRoles)
        if (typeof data.transcriptChannel === "string") setTranscriptChannel(data.transcriptChannel)
        if (typeof data.feedbackChannel === "string") setFeedbackChannel(data.feedbackChannel)
        if (typeof data.logsChannel === "string") setLogsChannel(data.logsChannel)
        if (typeof data.channelPrefix === "string") setChannelPrefix(data.channelPrefix)
        if (typeof data.timezone === "string") setTimezone(data.timezone)
        if (typeof data.workingHours === "object" && data.workingHours) setWorkingHours(data.workingHours)
      })
      .catch(() => {})
  }, [])

  const handleWorkingHourChange = (day: string, field: "start" | "end", value: string) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] || { start: "09:00", end: "17:00" }),
        [field]: value,
      },
    }))
  }

  const toggleWorkingDay = (day: string) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: prev[day] ? null : { start: "09:00", end: "17:00" },
    }))
  }

  const handleSave = () => {
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    if (!guildId) return
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    }
    if (apiKey) headers["X-API-KEY"] = apiKey
    setSaving(true)
    fetch(`${apiBase}/api/guilds/${guildId}/settings`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        embedColor,
        embedFooter,
        claimEnabled,
        staffRoles,
        transcriptChannel,
        feedbackChannel,
        logsChannel,
        channelPrefix,
        timezone,
        workingHours,
      }),
    })
      .then(() => {})
      .finally(() => setSaving(false))
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">Configure your ticket system settings</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Embed Settings</CardTitle>
            <CardDescription>Customize how embeds appear in your tickets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="embed-color">Embed Color</Label>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <input
                    id="embed-color"
                    type="color"
                    value={embedColor}
                    onChange={(e) => setEmbedColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer border border-border"
                  />
                  <code className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded">{embedColor}</code>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="embed-footer">Embed Footer</Label>
              <Input
                id="embed-footer"
                type="text"
                value={embedFooter}
                onChange={(e) => setEmbedFooter(e.target.value)}
                placeholder="Footer text for embeds"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="channel-prefix">Channel Name Prefix</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 cursor-help text-muted-foreground hover:text-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <div className="space-y-2">
                      <p className="font-semibold">Available Variables:</p>
                      {CHANNEL_PREFIX_VARIABLES.map((variable) => (
                        <div key={variable.name} className="text-xs">
                          <code className="bg-background/50 px-1 py-0.5 rounded">{variable.name}</code>
                          <p className="text-muted-foreground">{variable.description}</p>
                        </div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="channel-prefix"
                type="text"
                value={channelPrefix}
                onChange={(e) => setChannelPrefix(e.target.value)}
                placeholder="e.g., {category}-{count}"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
            <CardDescription>Enable or disable ticket features</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <Label htmlFor="claim-enabled" className="cursor-pointer font-medium">
                Enable Ticket Claiming
              </Label>
              <Toggle
                pressed={claimEnabled}
                onPressedChange={setClaimEnabled}
                aria-label="Toggle claim"
                className="data-[state=on]:bg-primary"
              >
                {claimEnabled ? "Enabled" : "Disabled"}
              </Toggle>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Working Hours & Timezone</CardTitle>
            <CardDescription>Set your support team's working hours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <Label>Working Hours by Day</Label>
              <div className="space-y-3">
                {DAYS.map((day) => (
                  <div key={day} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <button
                      onClick={() => toggleWorkingDay(day)}
                      className={`w-24 px-3 py-1 rounded text-sm font-medium transition-colors ${
                        workingHours[day]
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted-foreground/20 text-muted-foreground"
                      }`}
                    >
                      {day}
                    </button>
                    {workingHours[day] && (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={workingHours[day]?.start || "09:00"}
                          onChange={(e) => handleWorkingHourChange(day, "start", e.target.value)}
                          className="px-2 py-1 border border-border rounded bg-background text-foreground text-sm"
                        />
                        <span className="text-muted-foreground">to</span>
                        <input
                          type="time"
                          value={workingHours[day]?.end || "17:00"}
                          onChange={(e) => handleWorkingHourChange(day, "end", e.target.value)}
                          className="px-2 py-1 border border-border rounded bg-background text-foreground text-sm"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Discord Channels</CardTitle>
            <CardDescription>Set the channels for different features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label htmlFor="staff-roles">Staff Roles</Label>
              <Input
                id="staff-roles"
                type="text"
                value={staffRoles}
                onChange={(e) => setStaffRoles(e.target.value)}
                placeholder="Role IDs separated by commas (e.g., 123456789, 987654321)"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="transcript-channel">Transcript Channel</Label>
              <Input
                id="transcript-channel"
                type="text"
                value={transcriptChannel}
                onChange={(e) => setTranscriptChannel(e.target.value)}
                placeholder="#channel-name"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="feedback-channel">Feedback Channel</Label>
              <Input
                id="feedback-channel"
                type="text"
                value={feedbackChannel}
                onChange={(e) => setFeedbackChannel(e.target.value)}
                placeholder="#channel-name"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="logs-channel">Logs Channel</Label>
              <Input
                id="logs-channel"
                type="text"
                value={logsChannel}
                onChange={(e) => setLogsChannel(e.target.value)}
                placeholder="#channel-name"
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="w-full sm:w-auto" size="lg" disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  )
}
