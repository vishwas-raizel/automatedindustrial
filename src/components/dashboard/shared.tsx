"use client"

import { cn } from "@/lib/utils"
import { STATUS_META, SEVERITY_META, DEFECT_TYPES } from "@/lib/defects"
import type { InspectionStatus, Severity, DefectType } from "@/lib/defects"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"

export function StatusBadge({ status, className }: { status: InspectionStatus | string; className?: string }) {
  const m = STATUS_META[status as InspectionStatus] || STATUS_META.PENDING
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide", className)}
      style={{ background: m.bg, color: m.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  )
}

export function SeverityBadge({ severity, className }: { severity: Severity | string; className?: string }) {
  const m = SEVERITY_META[severity as Severity] || SEVERITY_META.NONE
  return (
    <span
      className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide", className)}
      style={{ background: m.bg, color: m.color }}
    >
      {m.label.toUpperCase()}
    </span>
  )
}

export function DefectTypeTag({ type, className }: { type: DefectType | string; className?: string }) {
  const m = DEFECT_TYPES[type as DefectType] || { label: type, color: "#737373" }
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium", className)}
      style={{ borderColor: `${m.color}40`, background: `${m.color}14`, color: m.color }}
    >
      <span className="h-2 w-2 rounded-sm" style={{ background: m.color }} />
      {m.label}
    </span>
  )
}

export function KpiCard({
  label, value, sub, icon: Icon, accent = "#b45309", delta, deltaUp,
}: {
  label: string
  value: string | number
  sub?: string
  icon?: any
  accent?: string
  delta?: string
  deltaUp?: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-full opacity-[0.06] blur-2xl" style={{ background: accent }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">{value}</div>
          {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
        </div>
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${accent}18`, color: accent }}>
            <Icon className="h-4 w-4" strokeWidth={2} />
          </div>
        )}
      </div>
      {delta && (
        <div className={cn("mt-2 inline-flex items-center gap-1 text-[11px] font-semibold", deltaUp ? "text-success" : "text-destructive")}>
          {deltaUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {delta}
        </div>
      )}
    </div>
  )
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function ConfidenceBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(value * 100)
  const color = pct >= 90 ? "#16a34a" : pct >= 75 ? "#ca8a04" : pct >= 50 ? "#ea580c" : "#dc2626"
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-10 text-right text-[11px] font-semibold tabular-nums" style={{ color }}>{pct}%</span>
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)} />
  )
}

export function EmptyState({ icon: Icon, title, desc }: { icon?: any; title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
      {Icon && <Icon className="mb-3 h-8 w-8 text-muted-foreground/50" />}
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {desc && <div className="mt-1 max-w-sm text-xs text-muted-foreground">{desc}</div>}
    </div>
  )
}

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime()
  const diff = Date.now() - d
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}
