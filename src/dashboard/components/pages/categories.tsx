"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Plus, Edit2, HelpCircle } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

interface Category {
  id: string
  name: string
  title?: string | null
  description?: string | null
  discordCategoryId?: string | null
  createdAt: string
}

interface DiscordCategory {
  id: string
  name: string
}

const VARIABLES = [
  { name: "{user}", description: "Mentions the user who opened the ticket" },
  { name: "{ticket}", description: "The ticket ID number" },
  { name: "{category}", description: "The category name" },
]

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [discordCategories, setDiscordCategories] = useState<DiscordCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryTitle, setNewCategoryTitle] = useState("")
  const [newCategoryDescription, setNewCategoryDescription] = useState("")
  const [selectedDiscordCategory, setSelectedDiscordCategory] = useState("")

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
          title: c.title || null,
          description: c.description || null,
          discordCategoryId: c.discordCategoryId || null,
          createdAt: new Date(Number(c.createdAt) || Date.now()).toISOString(),
        }))
        setCategories(mapped)
      })
      .catch((err) => {
        console.error("Error fetching categories:", err)
      })
      .finally(() => setLoading(false))
  }

  const fetchDiscordCategories = () => {
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    if (!guildId) return
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = {}
    if (apiKey) headers["X-API-KEY"] = apiKey
    fetch(`${apiBase}/api/guilds/${guildId}/discord-categories`, {
      headers,
    })
      .then((res) => res.json())
      .then((data: any[]) => {
        const mapped: DiscordCategory[] = data.map((c) => ({
          id: String(c.id),
          name: c.name || "Unknown",
        }))
        setDiscordCategories(mapped)
      })
      .catch((err) => {
        console.error("Error fetching Discord categories:", err)
      })
  }

  useEffect(() => {
    fetchCategories()
    fetchDiscordCategories()
  }, [])

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return
    setActionLoading(categoryId)
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = {}
    if (apiKey) headers["X-API-KEY"] = apiKey
    try {
      const res = await fetch(`${apiBase}/api/guilds/${guildId}/categories/${categoryId}`, {
        method: "DELETE",
        headers,
      })
      if (res.ok) {
        fetchCategories()
      }
    } catch (err) {
      console.error("Error deleting category:", err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleEditCategory = (category: Category) => {
    setEditingId(category.id)
    setNewCategoryName(category.name)
    setNewCategoryTitle(category.title || "")
    setNewCategoryDescription(category.description || "")
    setSelectedDiscordCategory(category.discordCategoryId || "")
    setShowCreateForm(true)
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    setActionLoading(editingId || "create")
    const apiBase = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""
    const guildId = process.env.NEXT_PUBLIC_GUILD_ID
    const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY
    const headers: HeadersInit = { "Content-Type": "application/json" }
    if (apiKey) headers["X-API-KEY"] = apiKey
    try {
      const url = editingId 
        ? `${apiBase}/api/guilds/${guildId}/categories/${editingId}`
        : `${apiBase}/api/guilds/${guildId}/categories`
      const method = editingId ? "PUT" : "POST"
      
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({ 
          name: newCategoryName,
          title: newCategoryTitle || null,
          description: newCategoryDescription || null,
          discordCategoryId: selectedDiscordCategory || null
        }),
      })
      if (res.ok) {
        setNewCategoryName("")
        setNewCategoryTitle("")
        setNewCategoryDescription("")
        setSelectedDiscordCategory("")
        setShowCreateForm(false)
        setEditingId(null)
        fetchCategories()
      }
    } catch (err) {
      console.error("Error saving category:", err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setNewCategoryName("")
    setNewCategoryTitle("")
    setNewCategoryDescription("")
    setSelectedDiscordCategory("")
    setShowCreateForm(false)
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Categories</h1>
        <p className="text-muted-foreground">Create and manage ticket categories for your panels</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Existing Categories</h2>
          <Button onClick={() => {
            handleCancelEdit()
            setShowCreateForm(!showCreateForm)
          }} className="gap-2">
            <Plus className="w-4 h-4" />
            New Category
          </Button>
        </div>

        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? "Edit Category" : "Create New Category"}</CardTitle>
              <CardDescription>Set up a category with custom welcome message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Category Name</label>
                <Input
                  placeholder="e.g., Payment Related, Technical Support"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Welcome Title (Optional)</label>
                <Input
                  placeholder="e.g., Welcome to Support"
                  value={newCategoryTitle}
                  onChange={(e) => setNewCategoryTitle(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-sm font-medium">Welcome Description (Optional)</label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-4 h-4 cursor-help text-muted-foreground hover:text-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <div className="space-y-2">
                        <p className="font-semibold">Available Variables:</p>
                        {VARIABLES.map((variable) => (
                          <div key={variable.name} className="text-xs">
                            <code className="bg-background/50 px-1 py-0.5 rounded">{variable.name}</code>
                            <p className="text-muted-foreground">{variable.description}</p>
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <textarea
                  placeholder="e.g., {user} Thank you for opening {ticket}. We will handle your issue quickly. Category: {category}"
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm mt-1 min-h-24"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Discord Category (Optional)</label>
                <select
                  value={selectedDiscordCategory}
                  onChange={(e) => setSelectedDiscordCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm mt-1"
                >
                  <option value="">None - Use default category</option>
                  {discordCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateCategory} disabled={actionLoading === (editingId || "create") || !newCategoryName.trim()}>
                  {editingId ? "Update" : "Create"}
                </Button>
                <Button variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {categories.map((category) => (
          <Card key={category.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle>{category.name}</CardTitle>
                  <CardDescription className="space-y-2 mt-2">
                    <div>Created at {new Date(category.createdAt).toLocaleString()}</div>
                    {category.title && <div className="font-medium text-foreground">Title: {category.title}</div>}
                    {category.description && <div className="text-sm">Description: {category.description}</div>}
                    <div className="flex gap-3">
                      <span className={category.discordCategoryId ? "text-emerald-600" : "text-muted-foreground"}>
                        {category.discordCategoryId ? "Linked to Discord category" : "No Discord category linked"}
                      </span>
                    </div>
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditCategory(category)}
                    disabled={actionLoading === category.id}
                    className="gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteCategory(category.id)}
                    disabled={actionLoading === category.id}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
        {categories.length === 0 && !loading && (
          <p className="text-muted-foreground text-sm">No categories found. Create one to get started.</p>
        )}
      </div>
    </div>
  )
}

