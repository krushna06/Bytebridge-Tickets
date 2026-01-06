"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Toggle } from "@/components/ui/toggle"

export function Settings() {
  const [embedColor, setEmbedColor] = useState("#5865f2")
  const [embedFooter, setEmbedFooter] = useState("Support Team")
  const [claimEnabled, setClaimEnabled] = useState(true)
  const [staffRoles, setStaffRoles] = useState("")
  const [transcriptChannel, setTranscriptChannel] = useState("")
  const [feedbackChannel, setFeedbackChannel] = useState("")
  const [logsChannel, setLogsChannel] = useState("")
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
      })
      .catch(() => {})
  }, [])

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
