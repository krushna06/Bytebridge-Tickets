"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Plus } from "lucide-react"

interface Panel {
  id: string
  title: string
  createdAt: string
  buttons: { label: string }[]
}

export function Panels() {
  const [panels, setPanels] = useState<Panel[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newPanelTitle, setNewPanelTitle] = useState("")

  const fetchPanels = () => {
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    if (!guildId) return
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = {}
    if (apiKey) headers["X-API-KEY"] = apiKey
    fetch(`${apiBase}/api/guilds/${guildId}/panels`, {
      headers,
    })
      .then((res) => res.json())
      .then((data: any[]) => {
        const mapped: Panel[] = data.map((p) => ({
          id: String(p.id),
          title: p.title || "Ticket Panel",
          createdAt: new Date(Number(p.createdAt) || Date.now()).toISOString(),
          buttons: Array.isArray(p.buttons)
            ? p.buttons.map((b: any) => ({ label: b && (b.label || b) }))
            : [],
        }))
        setPanels(mapped)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPanels()
  }, [])

  const handleDeletePanel = async (panelId: string) => {
    if (!confirm("Are you sure you want to delete this panel?")) return
    setActionLoading(panelId)
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = {}
    if (apiKey) headers["X-API-KEY"] = apiKey
    try {
      const res = await fetch(`${apiBase}/api/guilds/${guildId}/panels/${panelId}`, {
        method: "DELETE",
        headers,
      })
      if (res.ok) {
        fetchPanels()
      }
    } catch (err) {
      console.error("Error deleting panel:", err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCreatePanel = async () => {
    if (!newPanelTitle.trim()) return
    setActionLoading("create")
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = { "Content-Type": "application/json" }
    if (apiKey) headers["X-API-KEY"] = apiKey
    try {
      const res = await fetch(`${apiBase}/api/guilds/${guildId}/panels`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: newPanelTitle }),
      })
      if (res.ok) {
        setNewPanelTitle("")
        setShowCreateForm(false)
        fetchPanels()
      }
    } catch (err) {
      console.error("Error creating panel:", err)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Panels</h1>
        <p className="text-muted-foreground">View and manage ticket panels configured through Discord commands</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Existing Panels</h2>
          <Button onClick={() => setShowCreateForm(!showCreateForm)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Panel
          </Button>
        </div>

        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Panel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Panel Title</label>
                <Input
                  placeholder="e.g., Support Tickets"
                  value={newPanelTitle}
                  onChange={(e) => setNewPanelTitle(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreatePanel} disabled={actionLoading === "create" || !newPanelTitle.trim()}>
                  Create
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {panels.map((panel) => (
          <Card key={panel.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{panel.title}</CardTitle>
                  <CardDescription>Created at {new Date(panel.createdAt).toLocaleString()}</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeletePanel(panel.id)}
                  disabled={actionLoading === panel.id}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {panel.buttons.map((b, index) => (
                  <Badge key={`${panel.id}-${index}`}>{b.label}</Badge>
                ))}
                {panel.buttons.length === 0 && (
                  <p className="text-sm text-muted-foreground">No buttons configured for this panel.</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {panels.length === 0 && !loading && (
          <p className="text-muted-foreground text-sm">No panels found. Use the /panel command in Discord to create one.</p>
        )}
      </div>
    </div>
  )
}
