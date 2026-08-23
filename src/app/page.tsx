"use client"

import { useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, ScanLine, History, BarChart3, FileText, ShieldCheck,
  Settings as SettingsIcon, Sun, Moon, Factory, Bell, Search, ChevronRight,
  Activity, Cpu, Database, CircleDot, Menu, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/dashboard/shared"
import { OverviewView } from "@/components/dashboard/overview"
import { LiveInspectionView } from "@/components/dashboard/live-inspection"
import { HistoryView } from "@/components/dashboard/history"
import { AnalyticsView } from "@/components/dashboard/analytics"
import { ReportsView } from "@/components/dashboard/reports"
import { AuditView } from "@/components/dashboard/audit"
import { SettingsView } from "@/components/dashboard/settings"
import { toast } from "sonner"

type ViewKey = "overview" | "inspect" | "history" | "analytics" | "reports" | "audit" | "settings"

const NAV: { key: ViewKey; label: string; icon: any; desc: string }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, desc: "Real-time KPIs & system status" },
  { key: "inspect", label: "Live Inspection", icon: ScanLine, desc: "AI defect detection on captured parts" },
  { key: "history", label: "Inspection Log", icon: History, desc: "Full searchable inspection history" },
  { key: "analytics", label: "Analytics", icon: BarChart3, desc: "Model benchmarks & defect trends" },
  { key: "reports", label: "Reports", icon: FileText, desc: "Generate PDF / Excel compliance reports" },
  { key: "audit", label: "Audit Trail", icon: ShieldCheck, desc: "Role-based access & action logs" },
  { key: "settings", label: "Settings", icon: SettingsIcon, desc: "Users, models & system config" },
]

const VIEW_TITLES: Record<ViewKey, { title: string; sub: string }> = {
  overview: { title: "Operations Overview", sub: "Plant-wide quality inspection command center" },
  inspect: { title: "Live AI Inspection", sub: "Upload a part image for real-time defect detection" },
  history: { title: "Inspection Log", sub: "Searchable record of all quality inspections" },
  analytics: { title: "Analytics & Model Benchmarks", sub: "Defect trends and AI model performance comparison" },
  reports: { title: "Compliance Reports", sub: "Generate auditable PDF and Excel inspection reports" },
  audit: { title: "Audit Trail", sub: "Immutable log of system and user actions" },
  settings: { title: "System Settings", sub: "Users, roles, models and integration configuration" },
}

export default function Home() {
  const [view, setView] = useState<ViewKey>("overview")
  const [theme, setTheme] = useState<"light" | "dark">("dark")
  const [booting, setBooting] = useState(true)
  const [seeded, setSeeded] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [now, setNow] = useState(new Date())

  // theme bootstrap
  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("qc-theme")) as "light" | "dark" | null
    const initial = saved || "dark"
    setTheme(initial)
    document.documentElement.classList.toggle("dark", initial === "dark")
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    try { localStorage.setItem("qc-theme", theme) } catch {}
  }, [theme])

  // clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // seed on first load
  const ensureSeeded = useCallback(async () => {
    setBooting(true)
    try {
      const r = await fetch("/api/seed", { method: "POST" })
      const j = await r.json()
      if (j.ok && !j.skipped) {
        setSeeded(true)
        toast.success(`System initialized — ${j.seeded.inspections} inspections seeded`)
      } else {
        setSeeded(true)
      }
    } catch (e) {
      toast.error("Failed to initialize system data")
    } finally {
      setBooting(false)
    }
  }, [])

  useEffect(() => { ensureSeeded() }, [ensureSeeded])

  const activeMeta = VIEW_TITLES[view]
  const activeNav = NAV.find((n) => n.key === view)!

  return (
    <div className="flex min-h-screen flex-col bg-background bg-grid">
      {/* Top accent line */}
      <div className="h-1 w-full bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700" />

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0",
            mobileNav ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-700 font-extrabold text-white shadow-lg shadow-orange-900/30">
              QC
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-tight">DefectVision AI</div>
              <div className="truncate text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Industrial QC Platform</div>
            </div>
            <button className="ml-auto text-sidebar-foreground/60 lg:hidden" onClick={() => setMobileNav(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="scrollbar-industrial flex-1 space-y-1 overflow-y-auto px-3 py-4">
            <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Quality Operations</div>
            {NAV.map((item) => {
              const Icon = item.icon
              const active = view === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => { setView(item.key); setMobileNav(false) }}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className={cn("h-4.5 w-4.5 shrink-0", active ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground")} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{item.label}</div>
                    <div className={cn("truncate text-[10px]", active ? "text-sidebar-primary-foreground/70" : "text-sidebar-foreground/45")}>{item.desc}</div>
                  </div>
                  {active && <ChevronRight className="h-4 w-4 shrink-0 text-sidebar-primary-foreground/70" />}
                </button>
              )
            })}
          </nav>

          {/* System status */}
          <div className="border-t border-sidebar-border px-3 py-3">
            <div className="rounded-lg bg-sidebar-accent/50 p-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-sidebar-accent-foreground">
                <CircleDot className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                System Operational
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] text-sidebar-foreground/60">
                <div className="flex items-center gap-1"><Cpu className="h-3 w-3" /> GPU-A100</div>
                <div className="flex items-center gap-1"><Activity className="h-3 w-3" /> 8.4ms avg</div>
                <div className="flex items-center gap-1"><Database className="h-3 w-3" /> SQLite</div>
                <div className="flex items-center gap-1"><Factory className="h-3 w-3" /> 5 lines</div>
              </div>
            </div>
          </div>

          {/* User card */}
          <div className="border-t border-sidebar-border px-3 py-3">
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-600/20 text-sm font-bold text-amber-400">RS</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">Raj Singh</div>
                <div className="truncate text-[10px] text-sidebar-foreground/50">Inspector · QA Dept.</div>
              </div>
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-[9px] font-bold uppercase text-amber-400">Online</Badge>
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileNav && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileNav(false)} />}

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
            <div className="flex items-center gap-4 px-4 py-3 sm:px-6">
              <button className="lg:hidden" onClick={() => setMobileNav(true)}>
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">{activeMeta.title}</h1>
                  <Badge variant="outline" className="hidden border-amber-500/30 bg-amber-500/10 text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400 sm:inline-flex">
                    Industry 4.0
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{activeMeta.sub}</p>
              </div>

              <div className="hidden items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground md:flex">
                <Search className="h-3.5 w-3.5" />
                <input
                  placeholder="Search inspections, parts, defects…"
                  className="w-40 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/60 xl:w-56"
                  onFocus={() => setView("history")}
                />
              </div>

              <div className="hidden flex-col items-end text-right lg:flex">
                <div className="font-mono text-xs font-semibold tabular-nums">{now.toLocaleTimeString("en-US", { hour12: false })}</div>
                <div className="text-[10px] text-muted-foreground">{now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · UTC-5</div>
              </div>

              <button className="relative rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground">
                <Bell className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
              </button>

              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </header>

          {/* Content */}
          <main className="scrollbar-industrial px-4 py-5 sm:px-6">
            {booting ? (
              <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-700 opacity-20 blur-xl" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-700 font-extrabold text-white">
                    QC
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold">Initializing inspection database…</div>
                  <div className="mt-1 text-xs text-muted-foreground">Seeding production lines, models & historical inspections</div>
                </div>
                <Spinner className="h-5 w-5 text-amber-500" />
              </div>
            ) : (
              <div className="mx-auto max-w-[1400px]">
                {view === "overview" && <OverviewView onNavigate={setView} />}
                {view === "inspect" && <LiveInspectionView />}
                {view === "history" && <HistoryView />}
                {view === "analytics" && <AnalyticsView />}
                {view === "reports" && <ReportsView />}
                {view === "audit" && <AuditView />}
                {view === "settings" && <SettingsView />}
              </div>
            )}
          </main>

          {/* Footer */}
          <footer className="mt-auto border-t border-border bg-card/50 px-4 py-3 sm:px-6">
            <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 text-[11px] text-muted-foreground sm:flex-row">
              <div className="flex items-center gap-2">
                <Factory className="h-3.5 w-3.5 text-amber-600" />
                <span><strong className="text-foreground">DefectVision AI</strong> · Automated Industrial Defect Detection · Industry 4.0 Smart Factory</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> API v2.1</span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">YOLOv11 · RT-DETR · EfficientNet · ViT</span>
                <span className="hidden sm:inline">·</span>
                <span>© 2024 Plant Operations</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
