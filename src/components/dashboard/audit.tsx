"use client"

import { useEffect, useState, useCallback } from "react"
import { Shield, Search, Filter, ChevronLeft, ChevronRight, User, FileText, Download, AlertTriangle, Info, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { api, type AuditLog } from "@/lib/api"
import { Spinner, EmptyState, fmtDateTime } from "./shared"
import { toast } from "sonner"

const ACTIONS = ["ALL", "LOGIN", "LOGOUT", "INSPECTION_RUN", "INSPECTION_VIEW", "REPORT_GENERATED", "EXPORT", "CONFIG_CHANGE", "USER_CREATE", "ALERT_ACK", "DATA_DELETE", "SEED_RUN"]
const SEV = ["ALL", "INFO", "WARN", "CRITICAL"]

const SEV_COLOR: Record<string, string> = { INFO: "#0d9488", WARN: "#ca8a04", CRITICAL: "#dc2626" }
const ACTION_ICON: Record<string, any> = {
  LOGIN: User, LOGOUT: User, INSPECTION_RUN: Search, INSPECTION_VIEW: Search,
  REPORT_GENERATED: FileText, EXPORT: Download, CONFIG_CHANGE: Shield,
  USER_CREATE: User, ALERT_ACK: AlertTriangle, DATA_DELETE: AlertTriangle, SEED_RUN: Info,
}

export function AuditView() {
  const [items, setItems] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [action, setAction] = useState("ALL")
  const [severity, setSeverity] = useState("ALL")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.audit({ page, pageSize: 20, search, action, severity })
      setItems(r.items)
      setTotal(r.total)
      setTotalPages(r.totalPages)
    } catch {
      toast.error("Failed to load audit logs")
    } finally {
      setLoading(false)
    }
  }, [page, search, action, severity])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setTimeout(() => { if (page !== 1) setPage(1); else load() }, 350)
    return () => clearTimeout(t)
     
  }, [search])

  return (
    <div className="space-y-4">
      {/* Compliance banner */}
      <Card className="border-amber-500/20">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600"><Shield className="h-5 w-5" /></div>
          <div className="flex-1">
            <div className="text-sm font-semibold">Immutable Audit Trail — ISO 9001 / IATF 16949 Compliant</div>
            <div className="text-xs text-muted-foreground">Every user action, inspection, report generation, and configuration change is permanently recorded. {total} events logged.</div>
          </div>
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400">Tamper-proof</Badge>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by user, resource, resource ID, or details…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={action} onValueChange={(v) => { setAction(v); setPage(1) }}>
              <SelectTrigger className="h-9 w-[160px]"><span className="flex items-center gap-1.5"><Filter className="h-3 w-3 text-muted-foreground" /><SelectValue /></span></SelectTrigger>
              <SelectContent>{ACTIONS.map((a) => <SelectItem key={a} value={a}>{a === "ALL" ? "All Actions" : a.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={severity} onValueChange={(v) => { setSeverity(v); setPage(1) }}>
              <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>{SEV.map((s) => <SelectItem key={s} value={s}>{s === "ALL" ? "All Severity" : s}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} className="h-9"><RefreshCw className="h-3.5 w-3.5" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center"><Spinner className="h-6 w-6 text-amber-500" /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={Shield} title="No audit events" desc="No events match the current filters." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[60px]">Sev</TableHead>
                    <TableHead className="w-[150px]">Action</TableHead>
                    <TableHead className="w-[120px]">User</TableHead>
                    <TableHead className="w-[120px]">Resource</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="w-[120px]">IP Address</TableHead>
                    <TableHead className="w-[150px]">Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((l) => {
                    const Icon = ACTION_ICON[l.action] || Info
                    return (
                      <TableRow key={l.id} className="hover:bg-muted/30">
                        <TableCell>
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: `${SEV_COLOR[l.severity]}20`, color: SEV_COLOR[l.severity] }}>{l.severity}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-mono text-xs font-semibold">{l.action.replace(/_/g, " ")}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{l.userName}</TableCell>
                        <TableCell>
                          <div className="text-xs font-medium">{l.resource}</div>
                          {l.resourceId && <div className="font-mono text-[10px] text-muted-foreground">{l.resourceId}</div>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.details || "—"}</TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">{l.ipAddress}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDateTime(l.timestamp)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /> Prev</Button>
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages} · {total} events</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  )
}
