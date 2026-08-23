import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { DEFECT_LIST } from "@/lib/defects"
import { writeFile, readFile, unlink, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomUUID } from "node:crypto"
import { spawn } from "node:child_process"

const GEN_SCRIPT = join(process.cwd(), "scripts", "gen_excel.py")

async function runScript(script: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const pyCandidates = [process.env.PYTHON_BIN, "python", "py", "python3"].filter(Boolean) as string[]
  
  for (const pyCmd of pyCandidates) {
    const res = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(pyCmd, [script, ...args], { cwd: process.cwd() })
      let stdout = ""
      let stderr = ""
      child.stdout?.on("data", (d) => (stdout += d.toString()))
      child.stderr?.on("data", (d) => (stderr += d.toString()))
      child.on("error", () => resolve({ code: 127, stdout: "", stderr: "command not found" }))
      child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }))
    })
    if (res.code === 0) return res
  }
  return { code: 1, stdout: "", stderr: "No working python binary found on system" }
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

  const total = inspections.length
  const passed = inspections.filter((i) => i.status === "PASS").length
  const failed = inspections.filter((i) => i.status === "FAIL").length
  const review = inspections.filter((i) => i.status === "REVIEW").length
  const avgConfidence = total ? inspections.reduce((s, i) => s + i.confidence, 0) / total : 0
  const avgLatency = total ? inspections.reduce((s, i) => s + i.processingMs, 0) / total : 0

  const defectCounts: Record<string, number> = {}
  for (const d of DEFECT_LIST) defectCounts[d.key] = 0
  const allDefects: any[] = []
  for (const insp of inspections) {
    for (const d of insp.defects) {
      defectCounts[d.type] = (defectCounts[d.type] || 0) + 1
      allDefects.push({ ...d, inspectionCode: insp.inspectionCode, partName: insp.partName })
    }
  }
  const defectDistribution = DEFECT_LIST.map((d) => ({ name: d.label, key: d.key, value: defectCounts[d.key] || 0 })).sort((a, b) => b.value - a.value)

  const lineMap: Record<string, any> = {}
  for (const i of inspections) {
    const code = i.productionLine?.code || "—"
    if (!lineMap[code]) lineMap[code] = { code, line: i.productionLine?.name || "Unassigned", total: 0, pass: 0, fail: 0 }
    lineMap[code].total++
    if (i.status === "PASS") lineMap[code].pass++
    else if (i.status === "FAIL") lineMap[code].fail++
  }
  const linePerformance = Object.values(lineMap).map((l: any) => ({ ...l, passRate: l.total ? (l.pass / l.total) * 100 : 0 }))

  const models = await db.modelMetric.findMany({ orderBy: { map50: "desc" } })

  const payload = {
    generatedAt: new Date().toISOString(),
    windowDays: days,
    kpis: {
      total, passed, failed, review,
      passRate: total ? Number(((passed / total) * 100).toFixed(1)) : 0,
      avgConfidence: Number(avgConfidence.toFixed(3)),
      avgLatency: Number(avgLatency.toFixed(0)),
      totalDefects: allDefects.length,
      criticalCount: inspections.filter((i) => i.severity === "CRITICAL").length,
    },
    inspections: inspections.map((i) => ({
      inspectionCode: i.inspectionCode,
      partId: i.partId,
      partName: i.partName,
      partNumber: i.partNumber,
      status: i.status,
      severity: i.severity,
      confidence: i.confidence,
      defectCount: i.defectCount,
      modelUsed: i.modelUsed,
      processingMs: i.processingMs,
      createdAt: i.createdAt.toISOString(),
      productionLine: i.productionLine ? { code: i.productionLine.code } : null,
      inspector: i.inspector ? { name: i.inspector.name } : null,
    })),
    defects: allDefects,
    models,
    defectDistribution,
    linePerformance,
  }

  const tmpDir = join(tmpdir(), "reports")
  await mkdir(tmpDir, { recursive: true })
  const id = randomUUID()
  const jsonPath = join(tmpDir, `${id}.json`)
  const xlsxPath = join(tmpDir, `${id}.xlsx`)
  await writeFile(jsonPath, JSON.stringify(payload))

  const { code, stderr } = await runScript(GEN_SCRIPT, [jsonPath, xlsxPath])
  if (code !== 0) {
    console.error("[excel] script failed:", stderr)
    return NextResponse.json({ error: "Excel generation failed" }, { status: 500 })
  }

  const buffer = await readFile(xlsxPath)
  await Promise.all([unlink(jsonPath), unlink(xlsxPath).catch(() => {})])

  await logAudit({ userName: "system", action: "REPORT_GENERATED", resource: "Report", resourceId: `excel-${days}d`, details: `Excel report (${days}d window, ${inspections.length} inspections)` })

  const fname = `industrial-inspection-report-${days}d.xlsx`
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  })
}
