"use client"

import { useState } from "react"
import { FileText, FileSpreadsheet, Download, Loader2, CheckCircle2, FileBarChart, Calendar, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

const WINDOWS = [
  { days: 7, label: "Last 7 days" },
  { days: 14, label: "Last 14 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
]

export function ReportsView() {
  const [days, setDays] = useState(30)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [excelLoading, setExcelLoading] = useState(false)

  const download = async (kind: "pdf" | "excel") => {
    const setLoading = kind === "pdf" ? setPdfLoading : setExcelLoading
    setLoading(true)
    try {
      const r = await fetch(`/api/reports/${kind}?days=${days}`)
      if (!r.ok) throw new Error(`${kind.toUpperCase()} generation failed`)
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `industrial-inspection-report-${days}d.${kind === "pdf" ? "pdf" : "xlsx"}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`${kind.toUpperCase()} report downloaded`)
    } catch (e: any) {
      toast.error(e?.message || "Report generation failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Report Window</Label>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-[200px]"><Calendar className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue /></SelectTrigger>
              <SelectContent>{WINDOWS.map((w) => <SelectItem key={w.days} value={String(w.days)}>{w.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex-1 text-xs text-muted-foreground">
            Reports aggregate all inspection data within the selected window, including KPIs, defect distribution, line yield, model benchmarks, and the critical defect log. All generated reports are recorded in the audit trail.
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* PDF */}
        <Card className="overflow-hidden border-amber-500/20">
          <div className="h-1.5 bg-gradient-to-r from-amber-600 to-orange-700" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><FileText className="h-5 w-5" /></div>
              PDF Inspection Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">A formatted, print-ready executive summary with KPIs, defect charts, line yield table, critical defect log, and model benchmarks. Ideal for compliance audits and management review.</p>
            <div className="space-y-1.5">
              {["Executive KPI summary", "Defect type distribution chart", "Production line yield table", "Critical & major defect log", "Model benchmark comparison", "Audit-ready, single-page vector PDF"].map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /><span className="text-foreground/80">{f}</span></div>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">{days}-day window</Badge>
              <Badge variant="outline">Vector PDF</Badge>
            </div>
            <Button onClick={() => download("pdf")} disabled={pdfLoading} className="w-full bg-gradient-to-r from-amber-600 to-orange-700 text-white hover:from-amber-700 hover:to-orange-800">
              {pdfLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</> : <><Download className="mr-2 h-4 w-4" /> Generate PDF Report</>}
            </Button>
          </CardContent>
        </Card>

        {/* Excel */}
        <Card className="overflow-hidden border-emerald-500/20">
          <div className="h-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><FileSpreadsheet className="h-5 w-5" /></div>
              Excel Data Export
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">A multi-sheet spreadsheet workbook with raw inspection data, defect details, model metrics, and embedded charts. Ideal for data analysis, MES/ERP import, and archival.</p>
            <div className="space-y-1.5">
              {["Executive Summary sheet with KPIs", "Full Inspection Log (all records)", "Defect Details sheet (every finding)", "Model Benchmarks sheet", "Embedded defect-distribution chart", "Formatted, filterable, frozen headers"].map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /><span className="text-foreground/80">{f}</span></div>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400">{days}-day window</Badge>
              <Badge variant="outline">.xlsx</Badge>
            </div>
            <Button onClick={() => download("excel")} disabled={excelLoading} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-700 hover:to-emerald-800">
              {excelLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</> : <><Download className="mr-2 h-4 w-4" /> Generate Excel Report</>}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ERP/MES integration note */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold"><FileBarChart className="h-4 w-4 text-amber-600" /> ERP / MES / SCADA Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">The platform exposes REST APIs for integration with external manufacturing execution systems. Inspection results can be pushed automatically to your ERP/MES via the endpoints below.</p>
          <div className="mt-3 space-y-2">
            {[
              { m: "GET", p: "/api/inspections", d: "Paginated inspection log with full filtering" },
              { m: "GET", p: "/api/analytics?days=30", d: "Aggregated KPIs and defect analytics" },
              { m: "POST", p: "/api/inspect", d: "Submit an image for AI defect detection (multipart)" },
              { m: "GET", p: "/api/reports/pdf?days=30", d: "Generate compliance PDF report" },
              { m: "GET", p: "/api/reports/excel?days=30", d: "Generate Excel data export" },
              { m: "GET", p: "/api/audit", d: "Audit trail with role-based access" },
            ].map((e) => (
              <div key={e.p} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2.5 font-mono text-xs">
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${e.m === "GET" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>{e.m}</span>
                <span className="font-semibold">{e.p}</span>
                <span className="ml-auto hidden font-sans text-muted-foreground sm:inline">{e.d}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/5 p-2.5 text-[11px] text-amber-700 dark:text-amber-400">
            <ShieldCheck className="h-3.5 w-3.5" /> All API endpoints require authentication via Bearer token and are logged to the immutable audit trail.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
