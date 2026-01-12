"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Plus, Send, ChevronDown } from "lucide-react"

interface Panel {
  id: string
  title: string
  description?: string
  embedColor?: string
  createdAt: string
  buttons: { label: string; categoryId?: string | null; color?: string | null; emoji?: string | null }[]
  channelId?: string | null
  messageId?: string | null
  includeStats?: number
  statsMessageId?: string | null
}

interface Category {
  id: string
  name: string
}

interface Channel {
  id: string
  name: string
}

export function Panels() {
  const [panels, setPanels] = useState<Panel[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null)
  const [newPanelTitle, setNewPanelTitle] = useState("")
  const [newPanelDescription, setNewPanelDescription] = useState("")
  const [newPanelColor, setNewPanelColor] = useState("#5865f2")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [buttonConfigs, setButtonConfigs] = useState<Record<string, { color: string; emoji: string }>>({})
  const [sendingPanelId, setSendingPanelId] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<string>("")
  const [includeStats, setIncludeStats] = useState(false)

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
          description: p.description || "",
          embedColor: p.embedColor || "#5865f2",
          createdAt: new Date(Number(p.createdAt) || Date.now()).toISOString(),
          buttons: Array.isArray(p.buttons)
            ? p.buttons.map((b: any) => ({ 
                label: b && (b.label || b),
                categoryId: b?.categoryId || null
              }))
            : [],
          channelId: p.channelId || null,
          messageId: p.messageId || null,
          includeStats: p.includeStats || 0,
          statsMessageId: p.statsMessageId || null,
        }))
        setPanels(mapped)
      })
      .catch((err) => console.error("Error fetching panels:", err))
      .finally(() => setLoading(false))
  }

  const fetchCategories = () => {
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    if (!guildId) return
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = {}
    if (apiKey) headers["X-API-KEY"] = apiKey
    fetch(`${apiBase}/api/guilds/${guildId}/categories`, {
      headers,
    })
      .then((res) => res.json())
      .then((data: any[]) => {
        const mapped: Category[] = data.map((c) => ({
          id: String(c.id),
          name: c.name || "Untitled",
        }))
        setCategories(mapped)
      })
      .catch((err) => console.error("Error fetching categories:", err))
  }

  const fetchChannels = () => {
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    if (!guildId) return
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = {}
    if (apiKey) headers["X-API-KEY"] = apiKey
    fetch(`${apiBase}/api/guilds/${guildId}/channels`, {
      headers,
    })
      .then((res) => res.json())
      .then((data: any[]) => {
        const mapped: Channel[] = data.map((ch) => ({
          id: String(ch.id),
          name: ch.name || "Unknown",
        }))
        setChannels(mapped)
      })
      .catch((err) => console.error("Error fetching channels:", err))
  }

  useEffect(() => {
    fetchPanels()
    fetchCategories()
    fetchChannels()
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
    if (!newPanelTitle.trim() || selectedCategories.length === 0) return
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
        body: JSON.stringify({ 
          title: newPanelTitle,
          description: newPanelDescription,
          embedColor: newPanelColor,
          categoryIds: selectedCategories,
          buttons: buttonConfigs
        }),
      })
      if (res.ok) {
        setNewPanelTitle("")
        setNewPanelDescription("")
        setNewPanelColor("#5865f2")
        setSelectedCategories([])
        setButtonConfigs({})
        setShowCreateForm(false)
        fetchPanels()
      }
    } catch (err) {
      console.error("Error creating panel:", err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleSendPanel = async (panelId: string) => {
    if (!selectedChannel) {
      alert("Please select a channel")
      return
    }
    setSendingPanelId(panelId)
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = { "Content-Type": "application/json" }
    if (apiKey) headers["X-API-KEY"] = apiKey
    try {
      const res = await fetch(`${apiBase}/api/guilds/${guildId}/panels/${panelId}/send`, {
        method: "POST",
        headers,
        body: JSON.stringify({ channelId: selectedChannel, includeStats }),
      })
      if (res.ok) {
        fetchPanels()
        setSelectedChannel("")
        setIncludeStats(false)
      }
    } catch (err) {
      console.error("Error sending panel:", err)
    } finally {
      setSendingPanelId(null)
    }
  }

  const handleEditPanel = (panel: Panel) => {
    setEditingPanelId(panel.id)
    setNewPanelTitle(panel.title)
    setNewPanelDescription(panel.description || "")
    setNewPanelColor(panel.embedColor || "#5865f2")
    const categoryIds = panel.buttons
      .map(b => {
        const cat = categories.find(c => c.name === b.label)
        return cat ? cat.id : null
      })
      .filter((id): id is string => id !== null)
    setSelectedCategories(categoryIds)
    
    const configs: Record<string, { color: string; emoji: string }> = {}
    panel.buttons.forEach((b, idx) => {
      const cat = categories.find(c => c.name === b.label)
      if (cat) {
        configs[cat.id] = {
          color: b.color || 'Primary',
          emoji: b.emoji || ''
        }
      }
    })
    setButtonConfigs(configs)
  }

  const handleSaveEdit = async (panelId: string) => {
    if (!newPanelTitle.trim() || selectedCategories.length === 0) return
    setActionLoading(`edit-${panelId}`)
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = { "Content-Type": "application/json" }
    if (apiKey) headers["X-API-KEY"] = apiKey
    try {
      const res = await fetch(`${apiBase}/api/guilds/${guildId}/panels/${panelId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          title: newPanelTitle,
          description: newPanelDescription,
          embedColor: newPanelColor,
          categoryIds: selectedCategories,
          buttons: buttonConfigs
        }),
      })
      if (res.ok) {
        setEditingPanelId(null)
        setNewPanelTitle("")
        setNewPanelDescription("")
        setNewPanelColor("#5865f2")
        setSelectedCategories([])
        setButtonConfigs({})
        fetchPanels()
      }
    } catch (err) {
      console.error("Error updating panel:", err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelEdit = () => {
    setEditingPanelId(null)
    setNewPanelTitle("")
    setNewPanelDescription("")
    setNewPanelColor("#5865f2")
    setSelectedCategories([])
    setButtonConfigs({})
  }

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Panels</h1>
        <p className="text-muted-foreground">Create and manage ticket panels with categories</p>
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
              <div>
                <label className="text-sm font-medium">Description (Markdown supported)</label>
                <textarea
                  placeholder="e.g., Click a button below to open a ticket. Supports **bold**, *italic*, etc."
                  value={newPanelDescription}
                  onChange={(e) => setNewPanelDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm mt-1 min-h-24"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Embed Color</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="color"
                    value={newPanelColor}
                    onChange={(e) => setNewPanelColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer border border-input"
                  />
                  <code className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded">{newPanelColor}</code>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Select Categories</label>
                <div className="space-y-2">
                  {categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No categories found. Create one first.</p>
                  ) : (
                    categories.map((category) => (
                      <label key={category.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category.id)}
                          onChange={() => toggleCategory(category.id)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{category.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              {selectedCategories.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Button Customization</label>
                  <div className="space-y-3 bg-muted p-3 rounded-md">
                    {selectedCategories.map((catId) => {
                      const category = categories.find(c => c.id === catId)
                      const config = buttonConfigs[catId] || { color: 'Primary', emoji: '' }
                      return (
                        <div key={catId} className="space-y-2 p-2 bg-background rounded border border-input">
                          <p className="text-sm font-medium">{category?.name}</p>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-xs text-muted-foreground">Button Color</label>
                              <select
                                value={config.color}
                                onChange={(e) => setButtonConfigs(prev => ({
                                  ...prev,
                                  [catId]: { ...config, color: e.target.value }
                                }))}
                                className="w-full px-2 py-1 bg-background border border-input rounded text-sm mt-1"
                              >
                                <option value="Primary">Primary (Blue)</option>
                                <option value="Secondary">Secondary (Gray)</option>
                                <option value="Success">Success (Green)</option>
                                <option value="Danger">Danger (Red)</option>
                              </select>
                            </div>
                            <div className="flex-1">
                              <label className="text-xs text-muted-foreground">Emoji</label>
                              <input
                                type="text"
                                placeholder="e.g., 🎫"
                                value={config.emoji}
                                onChange={(e) => setButtonConfigs(prev => ({
                                  ...prev,
                                  [catId]: { ...config, emoji: e.target.value }
                                }))}
                                className="w-full px-2 py-1 bg-background border border-input rounded text-sm mt-1"
                                maxLength={2}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button 
                  onClick={handleCreatePanel} 
                  disabled={actionLoading === "create" || !newPanelTitle.trim() || selectedCategories.length === 0}
                >
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
                <div className="flex-1">
                  <CardTitle>{panel.title}</CardTitle>
                  <CardDescription className="space-y-2 mt-2">
                    <div>Created at {new Date(panel.createdAt).toLocaleString()}</div>
                    <div>
                      <span className={panel.channelId && panel.messageId ? "text-emerald-600" : "text-muted-foreground"}>
                        Posted
                      </span>
                    </div>
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditPanel(panel)}
                    className="gap-2"
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSendingPanelId(panel.id)}
                    className="gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </Button>
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
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingPanelId === panel.id ? (
                <div className="space-y-4 p-4 bg-muted rounded-lg">
                  <div>
                    <label className="text-sm font-medium">Panel Title</label>
                    <Input
                      placeholder="e.g., Support Tickets"
                      value={newPanelTitle}
                      onChange={(e) => setNewPanelTitle(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description (Markdown supported)</label>
                    <textarea
                      placeholder="e.g., Click a button below to open a ticket. Supports **bold**, *italic*, etc."
                      value={newPanelDescription}
                      onChange={(e) => setNewPanelDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm mt-1 min-h-24"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Embed Color</label>
                    <div className="flex items-center gap-3 mt-1">
                      <input
                        type="color"
                        value={newPanelColor}
                        onChange={(e) => setNewPanelColor(e.target.value)}
                        className="w-12 h-10 rounded cursor-pointer border border-input"
                      />
                      <code className="text-sm text-muted-foreground bg-background px-3 py-1 rounded">{newPanelColor}</code>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Select Categories</label>
                    <div className="space-y-2">
                      {categories.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No categories found.</p>
                      ) : (
                        categories.map((category) => (
                          <label key={category.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedCategories.includes(category.id)}
                              onChange={() => toggleCategory(category.id)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">{category.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  {selectedCategories.length > 0 && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Button Customization</label>
                      <div className="space-y-3 bg-background p-3 rounded-md border border-input">
                        {selectedCategories.map((catId) => {
                          const category = categories.find(c => c.id === catId)
                          const config = buttonConfigs[catId] || { color: 'Primary', emoji: '' }
                          return (
                            <div key={catId} className="space-y-2 p-2 bg-muted rounded border border-input">
                              <p className="text-sm font-medium">{category?.name}</p>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="text-xs text-muted-foreground">Button Color</label>
                                  <select
                                    value={config.color}
                                    onChange={(e) => setButtonConfigs(prev => ({
                                      ...prev,
                                      [catId]: { ...config, color: e.target.value }
                                    }))}
                                    className="w-full px-2 py-1 bg-background border border-input rounded text-sm mt-1"
                                  >
                                    <option value="Primary">Primary (Blue)</option>
                                    <option value="Secondary">Secondary (Gray)</option>
                                    <option value="Success">Success (Green)</option>
                                    <option value="Danger">Danger (Red)</option>
                                  </select>
                                </div>
                                <div className="flex-1">
                                  <label className="text-xs text-muted-foreground">Emoji</label>
                                  <input
                                    type="text"
                                    placeholder="e.g., 🎫"
                                    value={config.emoji}
                                    onChange={(e) => setButtonConfigs(prev => ({
                                      ...prev,
                                      [catId]: { ...config, emoji: e.target.value }
                                    }))}
                                    className="w-full px-2 py-1 bg-background border border-input rounded text-sm mt-1"
                                    maxLength={2}
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSaveEdit(panel.id)}
                      disabled={actionLoading === `edit-${panel.id}` || !newPanelTitle.trim() || selectedCategories.length === 0}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {panel.description && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Description</label>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{panel.description}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Categories</label>
                    <div className="flex flex-wrap gap-2">
                      {panel.buttons.map((b, index) => (
                        <Badge key={`${panel.id}-${index}`}>{b.label}</Badge>
                      ))}
                      {panel.buttons.length === 0 && (
                        <p className="text-sm text-muted-foreground">No categories configured for this panel.</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {sendingPanelId === panel.id && (
                <div className="space-y-2 pt-4 border-t">
                  <label className="text-sm font-medium">Select Channel to Send To</label>
                  <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
                  >
                    <option value="">Choose a channel...</option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        #{ch.name}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeStats}
                      onChange={(e) => setIncludeStats(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Include stats embed below panel</span>
                  </label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSendPanel(panel.id)}
                      disabled={!selectedChannel || sendingPanelId === `sending-${panel.id}`}
                    >
                      Send to Channel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSendingPanelId(null)
                        setIncludeStats(false)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {panels.length === 0 && !loading && (
          <p className="text-muted-foreground text-sm">No panels found. Create one to get started.</p>
        )}
      </div>
    </div>
  )
}
