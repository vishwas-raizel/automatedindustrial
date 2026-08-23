"use client"

import { useEffect, useState } from "react"
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ScatterChart, Scatter, ZAxis,
  BarChart, Bar, Cell,
} from "recharts"
import { Cpu, Zap, Target, TrendingUp, Award, Activity, Boxes } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, type Analytics, type ModelMetric } from "@/lib/api"
import { AI_MODELS } from "@/lib/defects"
import { Spinner, SectionHeader, KpiCard } from "./shared"

const AX = { fontSize: 11, fill: "currentColor", className: "text-muted-foreground" }

const STATUS_COLOR: Record<string, string> = {
  PRODUCTION: "#16a34a", STAGING: "#ca8a04", EXPERIMENTAL: "#ea580c", DEPRECATED: "#737373",
}

export function AnalyticsView() {
  const [data, setData] = useState<Analytics | null>(null)
  const [models, setModels] = useState<ModelMetric[]>([])
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [compareModel, setCompareModel] = useState("YOLOv11-Defect")

  useEffect(() => {
    let alive = true
    Promise.all([api.analytics(days), api.models()]).then(([a, m]) => {
      if (!alive) return
      setData(a)
      setModels(m.models)
      setLoading(false)
    }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [days])

  if (loading || !data) return <div className="flex h-64 items-center justify-center"><Spinner className="h-6 w-6 text-amber-500" /></div>

  const trend = data.trend.map((t) => ({ ...t, label: t.date.slice(5), defectsScaled: t.defects }))
  const selectedModel = models.find((m) => m.modelName === compareModel) || models[0]

  // radar data (normalized 0-100)
  const radarKeys = ["map50", "precision", "recall", "f1", "map5095"]
  const radarData = radarKeys.map((k) => ({
    metric: k === "map50" ? "mAP@50" : k === "map5095" ? "mAP@50:95" : k.charAt(0).toUpperCase() + k.slice(1),
    ...Object.fromEntries(models.map((m) => [m.modelName, Math.round((m as any)[k] * 100)])),
  }))

  // scatter: accuracy vs latency
  const scatterData = models.map((m) => ({
    name: m.modelName, x: m.inferenceMs, y: Math.round(m.map50 * 100), z: m.paramsMillion, status: m.status,
  }))

  // part performance
  const partData = data.partPerformance.slice(0, 8)

  // best model
  const best = [...models].sort((a, b) => b.f1 - a.f1)[0]

  return (
    <div className="space-y-5">
      {/* Window selector + model KPIs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Analysis window:</span>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">
          <Activity className="mr-1 h-3 w-3" /> {data.kpis.total} inspections analyzed
        </Badge>
      </div>

      {/* Model KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Best Model" value={best?.modelName.split("-")[0] || "—"} sub={`F1: ${(best?.f1 * 100).toFixed(1)}%`} icon={Award} accent="#16a34a" />
        <KpiCard label="Top mAP@50" value={`${((models[0]?.map50 || 0) * 100).toFixed(1)}%`} sub={models[0]?.modelName || "—"} icon={Target} accent="#b45309" />
        <KpiCard label="Fastest Inference" value={`${Math.min(...models.map((m) => m.inferenceMs)).toFixed(1)}ms`} sub={models.reduce((a, b) => (a.inferenceMs < b.inferenceMs ? a : b)).modelName} icon={Zap} accent="#0d9488" />
        <KpiCard label="Models Deployed" value={models.filter((m) => m.status === "PRODUCTION").length} sub={`${models.length} total registered`} icon={Cpu} accent="#ea580c" />
      </div>

      {/* Model comparison table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Cpu className="h-4 w-4 text-amber-600" /> Model Benchmark Comparison</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-3">Model</th>
                <th className="pb-2 pr-3 text-right">mAP@50</th>
                <th className="pb-2 pr-3 text-right">mAP@50:95</th>
                <th className="pb-2 pr-3 text-right">Precision</th>
                <th className="pb-2 pr-3 text-right">Recall</th>
                <th className="pb-2 pr-3 text-right">F1</th>
                <th className="pb-2 pr-3 text-right">Latency</th>
                <th className="pb-2 pr-3 text-right">Params</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id} className="border-b border-border/60 transition-colors hover:bg-muted/30">
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold">{m.modelName}</div>
                    <div className="text-[10px] text-muted-foreground">{m.version} · {m.paramsMillion}M params</div>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{(m.map50 * 100).toFixed(1)}%</td>
                  <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{(m.map5095 * 100).toFixed(1)}%</td>
                  <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{(m.precision * 100).toFixed(1)}%</td>
                  <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{(m.recall * 100).toFixed(1)}%</td>
                  <td className="py-2.5 pr-3 text-right font-mono font-bold tabular-nums">{(m.f1 * 100).toFixed(1)}%</td>
                  <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{m.inferenceMs.toFixed(1)}ms</td>
                  <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{m.paramsMillion}M</td>
                  <td className="py-2.5">
                    <span className="inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: `${STATUS_COLOR[m.status]}20`, color: STATUS_COLOR[m.status] }}>{m.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Radar + scatter */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Multi-Model Performance Radar</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="currentColor" className="text-border" />
                <PolarAngleAxis dataKey="metric" tick={AX} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={AX} />
                {models.map((m, i) => (
                  <Radar key={m.modelName} name={m.modelName} dataKey={m.modelName} stroke={AI_MODELS[i % AI_MODELS.length].family === "YOLO" ? "#b45309" : AI_MODELS[i % AI_MODELS.length].family === "DETR" ? "#0d9488" : AI_MODELS[i % AI_MODELS.length].family === "CNN" ? "#ea580c" : "#dc2626"} fillOpacity={m.modelName === compareModel ? 0.25 : 0.05} strokeWidth={m.modelName === compareModel ? 2.5 : 1.5} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Accuracy vs Latency Trade-off</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                <XAxis type="number" dataKey="x" name="Latency" unit="ms" tick={AX} tickLine={false} axisLine={false} label={{ value: "Inference latency (ms)", position: "insideBottom", offset: -4, fill: "currentColor", fontSize: 11 }} />
                <YAxis type="number" dataKey="y" name="mAP@50" unit="%" domain={[80, 100]} tick={AX} tickLine={false} axisLine={false} />
                <ZAxis type="number" dataKey="z" range={[80, 400]} name="Params" unit="M" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3", stroke: "currentColor" }}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0].payload as any
                    return (
                      <div className="rounded-lg border border-border bg-popover p-2 text-xs shadow-lg">
                        <div className="font-bold">{p.name}</div>
                        <div className="text-muted-foreground">Latency: {p.x}ms · mAP: {p.y}% · {p.z}M params</div>
                      </div>
                    )
                  }}
                />
                <Scatter data={scatterData} fill="#b45309">
                  {scatterData.map((d, i) => <Cell key={i} fill={STATUS_COLOR[d.status]} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-[10px] text-muted-foreground">
              {Object.entries(STATUS_COLOR).map(([k, c]) => (
                <span key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{k}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Defect trend + part performance */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-amber-600" /> Defect Detection Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                <XAxis dataKey="label" tick={AX} tickLine={false} axisLine={false} />
                <YAxis tick={AX} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="pass" name="Pass" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="fail" name="Fail" stroke="#dc2626" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="review" name="Review" stroke="#ca8a04" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Boxes className="h-4 w-4 text-amber-600" /> Defect Rate by Part Type</CardTitle>
          </CardHeader>
          <CardContent>
            {partData.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">No part data</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={partData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" horizontal={false} />
                  <XAxis type="number" tick={AX} tickLine={false} axisLine={false} unit="%" />
                  <YAxis type="category" dataKey="partNumber" tick={AX} tickLine={false} axisLine={false} width={90} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    formatter={(v: any, _n, p: any) => [`${v}% (${p.payload.fail}/${p.payload.total})`, "Defect rate"]}
                  />
                  <Bar dataKey="defectRate" name="Defect Rate" radius={[0, 4, 4, 0]} barSize={16}>
                    {partData.map((p, i) => <Cell key={i} fill={p.defectRate > 30 ? "#dc2626" : p.defectRate > 15 ? "#ea580c" : p.defectRate > 5 ? "#ca8a04" : "#16a34a"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Model details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Cpu className="h-4 w-4 text-amber-600" /> Registered AI Models ({AI_MODELS.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {AI_MODELS.map((m) => {
              const metric = models.find((x) => x.modelName === m.id)
              return (
                <div key={m.id} className="rounded-xl border border-border p-3.5 transition-colors hover:border-amber-500/40">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.family} · {m.version}</div>
                    </div>
                    <Badge variant="outline" className="border-amber-500/30 text-[9px] uppercase text-amber-600 dark:text-amber-400">{m.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{m.desc}</p>
                  {metric && (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded bg-muted/50 py-1.5"><div className="text-[9px] uppercase text-muted-foreground">mAP</div><div className="font-bold">{(metric.map50 * 100).toFixed(1)}%</div></div>
                      <div className="rounded bg-muted/50 py-1.5"><div className="text-[9px] uppercase text-muted-foreground">F1</div><div className="font-bold">{(metric.f1 * 100).toFixed(1)}%</div></div>
                      <div className="rounded bg-muted/50 py-1.5"><div className="text-[9px] uppercase text-muted-foreground">Latency</div><div className="font-bold">{metric.inferenceMs.toFixed(0)}ms</div></div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
