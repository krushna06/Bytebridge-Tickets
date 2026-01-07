"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Home } from "@/components/pages/home"
import { Settings } from "@/components/pages/settings"
import { Tickets } from "@/components/pages/tickets"
import { Categories } from "@/components/pages/categories"
import { Panels } from "@/components/pages/panels"
import { Logs } from "@/components/pages/logs"
import { Profile } from "@/components/pages/profile"

type Page = "home" | "settings" | "tickets" | "categories" | "panels" | "logs" | "profile"

export default function Dashboard() {
  const [currentPage, setCurrentPage] = useState<Page>("home")

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <Home />
      case "settings":
        return <Settings />
      case "tickets":
        return <Tickets />
      case "categories":
        return <Categories />
      case "panels":
        return <Panels />
      case "logs":
        return <Logs />
      case "profile":
        return <Profile />
      default:
        return <Home />
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      <main className="flex-1 overflow-auto">{renderPage()}</main>
    </div>
  )
}
