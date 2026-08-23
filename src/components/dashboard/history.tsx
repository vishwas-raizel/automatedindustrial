"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Search, Filter, ChevronLeft, ChevronRight, Download, Eye, Trash2,
  X, FileImage, Boxes, RefreshCw,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, type Inspection } from "@/lib/api"
import { AI_MODELS, DEFECT_TYPES } from "@/lib/defects"
import { StatusBadge, SeverityBadge, DefectTypeTag, ConfidenceBar, Spinner, EmptyState, fmtDateTime, timeAgo } from "./shared"
import { toast } from "sonner"

const STATUS_OPTS = ["ALL", "PASS", "FAIL", "REVIEW", "PENDING"]
const SEV_OPTS = ["ALL", "NONE", "MINOR", "MAJOR", "CRITICAL"]

export function HistoryView() {
  const [items, setItems] = useState<Inspection[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(12)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("ALL")
  const [severity, setSeverity] = useState("ALL")
  const [model, setModel] = useState("ALL")
  const [detail, setDetail] = useState<Inspection | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.inspections({ page, pageSize, search, status, severity, model })
      setItems(r.items)
      setTotal(r.total)
      setTotalPages(r.totalPages)
    } catch {
      toast.error("Failed to load inspections")
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, status, severity, model])

  useEffect(() => { load() }, [load])

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { if (page !== 1) setPage(1); else load() }, 350)
    return () => clearTimeout(t)
     
  }, [search])

  const remove = async (id: string) => {
    if (!confirm("Delete this inspection record? This action is logged in the audit trail.")) return
    try {
      await fetch(`/api/inspections/${id}`, { method: "DELETE" })
      toast.success("Inspection deleted")
      load()
    } catch {
      toast.error("Delete failed")
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by code, part ID, name, or part number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
              <SelectTrigger className="h-9 w-[120px]"><span className="flex items-center gap-1.5"><Filter className="h-3 w-3 text-muted-foreground" /><SelectValue /></span></SelectTrigger>
              <SelectContent>{STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{s === "ALL" ? "All Status" : s}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={severity} onValueChange={(v) => { setSeverity(v); setPage(1) }}>
              <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>{SEV_OPTS.map((s) => <SelectItem key={s} value={s}>{s === "ALL" ? "All Severity" : s}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={model} onValueChange={(v) => { setModel(v); setPage(1) }}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">All Models</SelectItem>{AI_MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} className="h-9"><RefreshCw className="h-3.5 w-3.5" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span><Boxes className="mr-1 inline h-3.5 w-3.5" />{total} inspections</span>
          {(status !== "ALL" || severity !== "ALL" || model !== "ALL" || search) && (
            <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">Filters active</Badge>
          )}
        </div>
        <div>Page {page} of {totalPages}</div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center"><Spinner className="h-6 w-6 text-amber-500" /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={Search} title="No inspections found" desc="Try adjusting your filters or search terms." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[110px]">Code</TableHead>
                    <TableHead>Part</TableHead>
                    <TableHead className="w-[90px]">Status</TableHead>
                    <TableHead className="w-[90px]">Severity</TableHead>
                    <TableHead className="w-[110px]">Confidence</TableHead>
                    <TableHead className="w-[70px] text-center">Defects</TableHead>
                    <TableHead className="w-[140px]">Model</TableHead>
                    <TableHead className="w-[100px]">Line</TableHead>
                    <TableHead className="w-[140px]">When</TableHead>
                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((i) => (
                    <TableRow key={i.id} className="cursor-pointer" onClick={() => setDetail(i)}>
                      <TableCell className="font-mono text-xs font-bold">{i.inspectionCode}</TableCell>
                      <TableCell>
                        <div className="font-medium">{i.partName}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{i.partNumber} · {i.partId}</div>
                      </TableCell>
                      <TableCell><StatusBadge status={i.status} /></TableCell>
                      <TableCell><SeverityBadge severity={i.severity} /></TableCell>
                      <TableCell><ConfidenceBar value={i.confidence} /></TableCell>
                      <TableCell className="text-center font-semibold tabular-nums">{i.defectCount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.modelUsed}</TableCell>
                      <TableCell className="font-mono text-xs">{i.productionLine?.code || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{timeAgo(i.createdAt)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDetail(i)}><Eye className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => remove(i.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /> Prev</Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(7, totalPages) }).map((_, idx) => {
              const p = Math.max(1, Math.min(totalPages - 6, page - 3)) + idx
              if (p < 1 || p > totalPages) return null
              return (
                <Button key={p} variant={p === page ? "default" : "outline"} size="sm" className="h-8 w-8 p-0" onClick={() => setPage(p)}>{p}</Button>
              )
            })}
          </div>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto scrollbar-industrial">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="font-mono">{detail?.inspectionCode}</span>
              {detail && <StatusBadge status={detail.status} />}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              {detail.imageUrl && (
                <div className="relative overflow-hidden rounded-lg border border-border bg-black">
                  { }
                  <img src={detail.imageUrl} alt={detail.partName} className="max-h-[320px] w-full object-contain" />
                  {detail.defects.map((d, i) => {
                    const m = DEFECT_TYPES[d.type as keyof typeof DEFECT_TYPES] || { color: "#dc2626", label: d.type }
                    return (
                      <div key={i} className="absolute border-2" style={{ left: `${d.bboxX * 100}%`, top: `${d.bboxY * 100}%`, width: `${d.bboxW * 100}%`, height: `${d.bboxH * 100}%`, borderColor: m.color }}>
                        <span className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ background: m.color }}>{m.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Part" value={detail.partName} />
                <Field label="Part Number" value={detail.partNumber} mono />
                <Field label="Serial ID" value={detail.partId} mono />
                <Field label="Severity"><SeverityBadge severity={detail.severity} /></Field>
                <Field label="Model" value={detail.modelUsed} />
                <Field label="Inference Device" value={detail.inferenceDevice} />
                <Field label="Latency" value={`${detail.processingMs} ms`} />
                <Field label="Confidence" value={`${(detail.confidence * 100).toFixed(1)}%`} />
                <Field label="Production Line" value={detail.productionLine?.code || "—"} mono />
                <Field label="Inspector" value={detail.inspector?.name || "system"} />
                <Field label="Created" value={fmtDateTime(detail.createdAt)} />
                <Field label="Defects" value={String(detail.defectCount)} />
              </div>
              {detail.notes && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Summary</div>
                  {detail.notes}
                </div>
              )}
              {detail.defects.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Defect Details ({detail.defects.length})</div>
                  <div className="space-y-2">
                    {detail.defects.map((d, i) => (
                      <div key={i} className="rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <DefectTypeTag type={d.type} />
                          <SeverityBadge severity={d.severity} />
                        </div>
                        <div className="mt-1.5 text-xs text-muted-foreground">📍 {d.location}</div>
                        <div className="mt-1 text-sm">{d.description}</div>
                        <div className="mt-2"><ConfidenceBar value={d.confidence} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, value, mono, children }: { label: string; value?: string; mono?: boolean; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={mono ? "mt-0.5 font-mono text-xs font-semibold" : "mt-0.5 text-sm font-semibold"}>{value || children}</div>
    </div>
  )
}
