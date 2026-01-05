"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Home } from "@/components/pages/home"
import { Settings } from "@/components/pages/settings"
import { Tickets } from "@/components/pages/tickets"
import { Panels } from "@/components/pages/panels"
import { Transcripts } from "@/components/pages/transcripts"
import { Feedbacks } from "@/components/pages/feedbacks"
import { Logs } from "@/components/pages/logs"

type Page = "home" | "settings" | "tickets" | "panels" | "transcripts" | "feedbacks" | "logs"

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
      case "panels":
        return <Panels />
      case "transcripts":
        return <Transcripts />
      case "feedbacks":
        return <Feedbacks />
      case "logs":
        return <Logs />
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
