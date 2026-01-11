"use client"

import { Home, Settings, Ticket, LayoutGrid, MessageSquare, History, Tag, LogOut, User, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"

type Page = "home" | "settings" | "tickets" | "panels" | "categories" | "logs" | "profile" | "leaderboard"

interface SidebarProps {
  currentPage: Page
  onPageChange: (page: Page) => void
}

const menuItems = [
  { id: "home" as Page, label: "Home", icon: Home },
  { id: "profile" as Page, label: "My Profile", icon: User },
  { id: "leaderboard" as Page, label: "Leaderboard", icon: Trophy },
  { id: "settings" as Page, label: "Settings", icon: Settings },
  { id: "tickets" as Page, label: "Tickets", icon: Ticket },
  { id: "categories" as Page, label: "Categories", icon: Tag },
  { id: "panels" as Page, label: "Panels", icon: LayoutGrid },
  { id: "logs" as Page, label: "Logs", icon: History },
]

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const { data: session } = useSession()

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-2xl font-bold text-sidebar-foreground flex items-center gap-3">
          Bytebridge
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id

          return (
            <Button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              variant={isActive ? "default" : "ghost"}
              className={cn("w-full justify-start gap-3 h-auto py-2.5", isActive && "bg-sidebar-primary")}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{item.label}</span>
            </Button>
          )
        })}
      </nav>

      {/* User profile section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent">
          {session?.user?.image && (
            <img
              src={session.user.image}
              alt={session.user.username || "User"}
              className="w-10 h-10 rounded-full flex-shrink-0"
            />
          )}
          {!session?.user?.image && (
            <div className="w-10 h-10 bg-sidebar-primary rounded-full flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{session?.user?.username}</p>
            <p className="text-xs text-sidebar-accent-foreground truncate">{session?.user?.topRole}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex-shrink-0 p-1 hover:bg-sidebar-primary rounded transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 text-sidebar-foreground" />
          </button>
        </div>
      </div>
    </aside>
  )
}
