import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { DEFECT_LIST, SEVERITY_META, STATUS_META } from "@/lib/defects"
import { writeFile, readFile, unlink, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomUUID } from "node:crypto"
import { spawn } from "node:child_process"

const HTML2POSTER = join(process.cwd(), "scripts", "html2poster.js")
const NODE = process.env.NODE_BIN || "node"

function runNode(script: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(NODE, [script, ...args])
    let stderr = ""
    child.stderr.on("data", (d) => (stderr += d.toString()))
    child.on("close", (code) => resolve({ code: code ?? 0, stderr }))
  })
}

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string))
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const days = Math.min(90, Math.max(1, Number(searchParams.get("days") || 30)))
  const since = new Date(Date.now() - days * 86400000)

  const inspections = await db.inspection.findMany({
    where: { createdAt: { gte: since } },
    include: { defects: true, productionLine: true, inspector: true },
    orderBy: { createdAt: "desc" },
  })
  const models = await db.modelMetric.findMany({ orderBy: { map50: "desc" } })

  const total = inspections.length
  const passed = inspections.filter((i) => i.status === "PASS").length
  const failed = inspections.filter((i) => i.status === "FAIL").length
  const review = inspections.filter((i) => i.status === "REVIEW").length
  const avgConf = total ? inspections.reduce((s, i) => s + i.confidence, 0) / total : 0
  const avgLat = total ? inspections.reduce((s, i) => s + i.processingMs, 0) / total : 0
  const critCount = inspections.filter((i) => i.severity === "CRITICAL").length
  const passRate = total ? (passed / total) * 100 : 0

  // defect distribution
  const dc: Record<string, number> = {}
  for (const d of DEFECT_LIST) dc[d.key] = 0
  for (const i of inspections) for (const d of i.defects) dc[d.type] = (dc[d.type] || 0) + 1
  const defectDist = DEFECT_LIST.map((d) => ({ ...d, count: dc[d.key] })).sort((a, b) => b.count - a.count)
  const maxD = Math.max(1, ...defectDist.map((d) => d.count))

  // line performance
  const lm: Record<string, any> = {}
  for (const i of inspections) {
    const code = i.productionLine?.code || "—"
    if (!lm[code]) lm[code] = { code, name: i.productionLine?.name || "Unassigned", total: 0, pass: 0, fail: 0 }
    lm[code].total++
    if (i.status === "PASS") lm[code].pass++
    else if (i.status === "FAIL") lm[code].fail++
  }
  const linePerf = Object.values(lm).map((l: any) => ({ ...l, rate: l.total ? (l.pass / l.total) * 100 : 0 }))

  const recentCritical = inspections.filter((i) => i.severity === "CRITICAL" || i.severity === "MAJOR").slice(0, 8)

  const generatedAt = new Date().toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })

  const kpiCard = (label: string, value: string, sub: string, color: string) => `
    <div class="kpi">
      <div class="kpi-label">${esc(label)}</div>
      <div class="kpi-value" style="color:${color}">${esc(value)}</div>
      <div class="kpi-sub">${esc(sub)}</div>
    </div>`

  const defectBars = defectDist.filter((d) => d.count > 0).map((d) => `
    <div class="bar-row">
      <div class="bar-label">${esc(d.label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(d.count / maxD) * 100}%;background:${d.color}"></div></div>
      <div class="bar-val">${d.count}</div>
    </div>`).join("")

  const lineRows = linePerf.map((l) => `
    <tr>
      <td><strong>${esc(l.code)}</strong></td>
      <td>${esc(l.name)}</td>
      <td style="text-align:right">${l.total}</td>
      <td style="text-align:right;color:#16a34a">${l.pass}</td>
      <td style="text-align:right;color:#dc2626">${l.fail}</td>
      <td style="text-align:right"><strong>${l.rate.toFixed(1)}%</strong></td>
    </tr>`).join("")

  const criticalRows = recentCritical.map((i) => {
    const sm = STATUS_META[i.status as keyof typeof STATUS_META]
    const sev = SEVERITY_META[i.severity as keyof typeof SEVERITY_META]
    return `
    <tr>
      <td><strong>${esc(i.inspectionCode)}</strong></td>
      <td>${esc(i.partName)}<div style="font-size:9px;color:#737373">${esc(i.partNumber)}</div></td>
      <td><span class="pill" style="background:${sm.bg};color:${sm.color}">${sm.label}</span></td>
      <td><span class="pill" style="background:${sev.bg};color:${sev.color}">${sev.label}</span></td>
      <td style="text-align:right">${(i.confidence * 100).toFixed(1)}%</td>
      <td style="text-align:right">${i.defectCount}</td>
      <td>${esc(i.defects.map((d) => d.type).join(", ") || "—")}</td>
    </tr>`
  }).join("")

  const modelRows = models.map((m) => `
    <tr>
      <td><strong>${esc(m.modelName)}</strong><div style="font-size:9px;color:#737373">${esc(m.version)} · ${esc(m.status)}</div></td>
      <td style="text-align:right">${(m.map50 * 100).toFixed(1)}%</td>
      <td style="text-align:right">${(m.map5095 * 100).toFixed(1)}%</td>
      <td style="text-align:right">${(m.precision * 100).toFixed(1)}%</td>
      <td style="text-align:right">${(m.recall * 100).toFixed(1)}%</td>
      <td style="text-align:right">${m.inferenceMs.toFixed(1)}</td>
    </tr>`).join("")

  const html = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @page { size: 900px auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #18181b; }
  .poster { width: 900px; padding: 40px 44px; background: #ffffff; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #b45309; padding-bottom: 18px; margin-bottom: 22px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .logo { width: 44px; height: 44px; border-radius: 10px; background: linear-gradient(135deg,#b45309,#ea580c); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:20px; }
  .brand-text .t1 { font-size: 18px; font-weight: 800; letter-spacing: 0.3px; color:#18181b; }
  .brand-text .t2 { font-size: 11px; color: #737373; letter-spacing: 0.8px; text-transform: uppercase; }
  .meta { text-align: right; font-size: 10px; color: #737373; line-height: 1.6; }
  .meta strong { color: #18181b; }
  h1 { font-size: 26px; font-weight: 800; margin: 0 0 4px; color:#18181b; letter-spacing:-0.3px; }
  .subtitle { font-size: 13px; color: #525252; margin-bottom: 22px; }
  .section { margin-bottom: 22px; }
  .section-title { font-size: 11px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; color: #b45309; margin-bottom: 10px; display:flex; align-items:center; gap:8px; }
  .section-title::before { content:""; width: 14px; height: 2px; background:#b45309; display:inline-block; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .kpi { background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 10px; padding: 14px 16px; }
  .kpi-label { font-size: 9px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #78716c; }
  .kpi-value { font-size: 26px; font-weight: 800; margin: 4px 0 2px; line-height:1; }
  .kpi-sub { font-size: 10px; color: #78716c; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; background: #1f2937; color: #fff; padding: 8px 10px; font-size: 9px; letter-spacing: 0.8px; text-transform: uppercase; font-weight: 700; }
  th:first-child { border-top-left-radius: 8px; } th:last-child { border-top-right-radius: 8px; }
  td { padding: 7px 10px; border-bottom: 1px solid #e7e5e4; vertical-align: middle; }
  tr:nth-child(even) td { background: #fafaf9; }
  .bar-row { display: grid; grid-template-columns: 130px 1fr 36px; gap: 10px; align-items: center; margin-bottom: 7px; font-size: 11px; }
  .bar-label { color: #44403c; font-weight: 600; }
  .bar-track { background: #f5f5f4; border-radius: 4px; height: 14px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; }
  .bar-val { text-align: right; font-weight: 700; color: #18181b; }
  .pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 9px; font-weight: 700; letter-spacing: 0.4px; }
  .footer { margin-top: 26px; padding-top: 14px; border-top: 1px solid #e7e5e4; display:flex; justify-content:space-between; font-size: 9px; color: #78716c; }
  .badge { display:inline-block; background:#fef3c7; color:#b45309; padding:3px 10px; border-radius:6px; font-size:9px; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; }
</style></head>
<body>
<div class="poster">
  <div class="top">
    <div class="brand">
      <div class="logo">QC</div>
      <div class="brand-text">
        <div class="t1">DefectVision AI</div>
        <div class="t2">Industrial Quality Inspection Platform</div>
      </div>
    </div>
    <div class="meta">
      <div><strong>INSPECTION REPORT</strong></div>
      <div>Generated: ${esc(generatedAt)} UTC</div>
      <div>Analysis Window: ${days} days</div>
      <div>Report ID: RPT-${Date.now().toString(36).toUpperCase()}</div>
    </div>
  </div>

  <h1>Automated Defect Detection — Quality Report</h1>
  <div class="subtitle">Comprehensive analysis of ${total} manufactured-part inspections across ${linePerf.length} production lines, covering defect classification, severity, model performance, and line-level yield.</div>

  <div class="section">
    <div class="section-title">Key Performance Indicators</div>
    <div class="kpi-grid">
      ${kpiCard("Total Inspections", String(total), `${days}-day window`, "#18181b")}
      ${kpiCard("Pass Rate", passRate.toFixed(1) + "%", `${passed} passed`, "#16a34a")}
      ${kpiCard("Failed", String(failed), `${review} flagged for review`, "#dc2626")}
      ${kpiCard("Critical Defects", String(critCount), "require immediate action", "#dc2626")}
      ${kpiCard("Avg Confidence", (avgConf * 100).toFixed(1) + "%", "model certainty", "#b45309")}
      ${kpiCard("Avg Latency", avgLat.toFixed(0) + " ms", "per-image inference", "#0d9488")}
      ${kpiCard("Total Defects", String(inspections.reduce((s,i)=>s+i.defectCount,0)), "across all parts", "#ea580c")}
      ${kpiCard("Lines Monitored", String(linePerf.length), "active production lines", "#18181b")}
    </div>
  </div>

  <div class="two-col">
    <div class="section">
      <div class="section-title">Defect Type Distribution</div>
      ${defectBars || '<div style="font-size:11px;color:#78716c;padding:12px 0">No defects recorded in this window.</div>'}
    </div>
    <div class="section">
      <div class="section-title">Production Line Yield</div>
      <table>
        <thead><tr><th>Line</th><th style="text-align:right">Total</th><th style="text-align:right">Pass</th><th style="text-align:right">Fail</th><th style="text-align:right">Yield</th></tr></thead>
        <tbody>
          ${linePerf.map((l:any)=>`<tr><td><strong>${esc(l.code)}</strong></td><td style="text-align:right">${l.total}</td><td style="text-align:right;color:#16a34a">${l.pass}</td><td style="text-align:right;color:#dc2626">${l.fail}</td><td style="text-align:right"><strong>${l.rate.toFixed(1)}%</strong></td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Critical &amp; Major Defect Log</div>
    <table>
      <thead><tr><th>Code</th><th>Part</th><th>Status</th><th>Severity</th><th style="text-align:right">Conf.</th><th style="text-align:right">Defects</th><th>Types</th></tr></thead>
      <tbody>${criticalRows || '<tr><td colspan="7" style="text-align:center;color:#78716c;padding:14px">No critical or major defects in this window.</td></tr>'}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Model Benchmark Comparison</div>
    <table>
      <thead><tr><th>Model</th><th style="text-align:right">mAP@0.5</th><th style="text-align:right">mAP@0.5:0.95</th><th style="text-align:right">Precision</th><th style="text-align:right">Recall</th><th style="text-align:right">Latency (ms)</th></tr></thead>
      <tbody>${modelRows}</tbody>
    </table>
  </div>

  <div class="footer">
    <div><span class="badge">Confidential</span> &nbsp; Generated by DefectVision AI — Automated Industrial Defect Detection System</div>
    <div>Page 1 · ${esc(generatedAt)}</div>
  </div>
</div>
</body></html>`

  const tmpDir = join(tmpdir(), "reports")
  await mkdir(tmpDir, { recursive: true })
  const id = randomUUID()
  const htmlPath = join(tmpDir, `${id}.html`)
  const pdfPath = join(tmpDir, `${id}.pdf`)
  await writeFile(htmlPath, html)

  const { code, stderr } = await runNode(HTML2POSTER, [htmlPath, "--output", pdfPath, "--width", "900px"])
  if (code !== 0) {
    console.error("[pdf] html2poster failed:", stderr)
    return NextResponse.json({ error: "PDF generation failed", detail: stderr.slice(0, 500) }, { status: 500 })
  }

  const buffer = await readFile(pdfPath)
  await Promise.all([unlink(htmlPath), unlink(pdfPath).catch(() => {})])

  await logAudit({ userName: "system", action: "REPORT_GENERATED", resource: "Report", resourceId: `pdf-${days}d`, details: `PDF report (${days}d window, ${inspections.length} inspections)` })

  const fname = `industrial-inspection-report-${days}d.pdf`
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  })
}
