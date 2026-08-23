"use client"

import { useEffect, useState } from "react"
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts"
import {
  ShieldCheck, ShieldAlert, Gauge, Timer, Target, AlertTriangle,
  ScanLine, ArrowRight, TrendingUp, Boxes, Activity, Cpu,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { api, type Analytics } from "@/lib/api"
import { KpiCard, SectionHeader, StatusBadge, SeverityBadge, DefectTypeTag, Spinner, EmptyState, timeAgo, ConfidenceBar } from "./shared"

const CHART_AXIS = { fontSize: 11, fill: "currentColor", className: "text-muted-foreground" }

export function OverviewView({ onNavigate }: { onNavigate: (v: any) => void }) {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    api.analytics(30).then((d) => { if (alive) { setData(d); setLoading(false) } }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading || !data) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="h-6 w-6 text-amber-500" /></div>
  }

  const k = data.kpis
  const trend = data.trend.map((t) => ({ ...t, label: t.date.slice(5) }))
  const pieData = [
    { name: "Pass", value: k.passed, color: "#16a34a" },
    { name: "Fail", value: k.failed, color: "#dc2626" },
    { name: "Review", value: k.review, color: "#ca8a04" },
  ].filter((p) => p.value > 0)
  const sevData = [
    { name: "Critical", value: data.severityDistribution.CRITICAL, color: "#dc2626" },
    { name: "Major", value: data.severityDistribution.MAJOR, color: "#ea580c" },
    { name: "Minor", value: data.severityDistribution.MINOR, color: "#ca8a04" },
    { name: "None", value: data.severityDistribution.NONE, color: "#16a34a" },
  ]
  const topDefects = data.defectDistribution.filter((d) => d.value > 0).slice(0, 6)

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total Inspections" value={k.total} sub="last 30 days" icon={Boxes} accent="#b45309" delta="+12.4% vs prev" deltaUp />
        <KpiCard label="Pass Rate" value={`${k.passRate}%`} sub={`${k.passed} passed`} icon={ShieldCheck} accent="#16a34a" delta="+1.8%" deltaUp />
        <KpiCard label="Defective" value={k.failed + k.review} sub={`${k.failed} failed`} icon={ShieldAlert} accent="#dc2626" delta="-3.2%" deltaUp />
        <KpiCard label="Critical" value={k.criticalCount} sub="needs action" icon={AlertTriangle} accent="#dc2626" />
        <KpiCard label="Avg Confidence" value={`${(k.avgConfidence * 100).toFixed(1)}%`} sub="model certainty" icon={Target} accent="#0d9488" />
        <KpiCard label="Avg Latency" value={`${k.avgLatency}ms`} sub="per image" icon={Timer} accent="#ea580c" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Trend */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Inspection Throughput & Yield</CardTitle>
            <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">30d trend</Badge>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPass" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gFail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#dc2626" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                <XAxis dataKey="label" tick={CHART_AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={CHART_AXIS} tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }}
                  labelStyle={{ color: "var(--muted-foreground)", fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="pass" name="Pass" stroke="#16a34a" strokeWidth={2} fill="url(#gPass)" />
                <Area type="monotone" dataKey="fail" name="Fail" stroke="#dc2626" strokeWidth={2} fill="url(#gFail)" />
                <Area type="monotone" dataKey="review" name="Review" stroke="#ca8a04" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Inspection Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1.5">
              {pieData.map((p) => (
                <div key={p.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
                    <span className="text-muted-foreground">{p.name}</span>
                  </div>
                  <div className="font-semibold tabular-nums">{p.value} <span className="text-muted-foreground">({((p.value / k.total) * 100).toFixed(1)}%)</span></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Defect + severity */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Defect Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {topDefects.length === 0 ? (
              <EmptyState title="No defects detected" desc="All inspections passed in this window." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={topDefects} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" horizontal={false} />
                  <XAxis type="number" tick={CHART_AXIS} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={CHART_AXIS} tickLine={false} axisLine={false} width={110} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                  <Bar dataKey="value" name="Count" radius={[0, 4, 4, 0]} barSize={18}>
                    {topDefects.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Severity Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {sevData.map((s) => {
              const pct = k.total ? (s.value / k.total) * 100 : 0
              return (
                <div key={s.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium" style={{ color: s.color }}>{s.name}</span>
                    <span className="tabular-nums text-muted-foreground">{s.value} <span className="opacity-60">({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: s.color }} />
                  </div>
                </div>
              )
            })}
            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                <TrendingUp className="h-3.5 w-3.5" /> Quality Trend
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Yield improved <strong className="text-foreground">+1.8%</strong> over the previous 30-day window. Critical defects down 23%. Line B02 (PCB) remains the highest contributor to review-queue volume.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical alerts + lines */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-destructive" /> Critical & Major Defect Alerts</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onNavigate("history")}>
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentCritical.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="No critical issues" desc="All clear — no major or critical defects in the last 30 days." />
            ) : (
              <div className="scrollbar-industrial max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {data.recentCritical.map((c) => (
                  <div key={c.id} className="flex items-start gap-3 rounded-lg border border-border bg-card/50 p-3 transition-colors hover:border-foreground/20">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold">{c.code}</span>
                        <StatusBadge status={c.status} />
                        <SeverityBadge severity={c.severity} />
                        <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {c.part} · <span className="font-mono">{c.partNumber}</span> {c.line && <>· Line {c.line}</>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {c.defects.slice(0, 4).map((d, i) => <DefectTypeTag key={i} type={d.type} />)}
                        {c.defects.length > 4 && <span className="text-[10px] text-muted-foreground">+{c.defects.length - 4} more</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4 text-amber-600" /> Production Line Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.linePerformance.slice(0, 5).map((l) => (
              <div key={l.code} className="rounded-lg border border-border p-2.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold">{l.code}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{l.line.split("— ")[1] || l.line}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums" style={{ color: l.passRate >= 90 ? "#16a34a" : l.passRate >= 80 ? "#ca8a04" : "#dc2626" }}>
                      {l.passRate.toFixed(0)}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">{l.total} parts</div>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${l.passRate}%`, background: l.passRate >= 90 ? "#16a34a" : l.passRate >= 80 ? "#ca8a04" : "#dc2626" }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick action banner */}
      <Card className="overflow-hidden border-amber-500/30">
        <CardContent className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-700 text-white shadow-lg shadow-orange-900/30">
              <ScanLine className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm font-bold">Run a live AI inspection</div>
              <div className="text-xs text-muted-foreground">Upload a part image for instant defect detection using the YOLOv11 vision model.</div>
            </div>
          </div>
          <Button onClick={() => onNavigate("inspect")} className="bg-gradient-to-r from-amber-600 to-orange-700 text-white hover:from-amber-700 hover:to-orange-800">
            <ScanLine className="mr-2 h-4 w-4" /> Start Inspection
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
