import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { DEFECT_LIST } from "@/lib/defects"

// GET /api/analytics — aggregated dashboard metrics
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const days = Math.min(90, Math.max(1, Number(searchParams.get("days") || 30)))
  const since = new Date(Date.now() - days * 86400000)

  const inspections = await db.inspection.findMany({
    where: { createdAt: { gte: since } },
    include: { defects: true, productionLine: true },
    orderBy: { createdAt: "asc" },
  })

  const total = inspections.length
  const passed = inspections.filter((i) => i.status === "PASS").length
  const failed = inspections.filter((i) => i.status === "FAIL").length
  const review = inspections.filter((i) => i.status === "REVIEW").length
  const passRate = total ? (passed / total) * 100 : 0
  const avgConfidence = total ? inspections.reduce((s, i) => s + i.confidence, 0) / total : 0
  const avgLatency = total ? inspections.reduce((s, i) => s + i.processingMs, 0) / total : 0
  const totalDefects = inspections.reduce((s, i) => s + i.defectCount, 0)

  // Defect type distribution
  const defectCounts: Record<string, number> = {}
  for (const d of DEFECT_LIST) defectCounts[d.key] = 0
  for (const insp of inspections) for (const d of insp.defects) defectCounts[d.type] = (defectCounts[d.type] || 0) + 1
  const defectDistribution = DEFECT_LIST.map((d) => ({ name: d.label, key: d.key, value: defectCounts[d.key] || 0, color: d.color })).sort((a, b) => b.value - a.value)

  // Severity distribution
  const severityCounts = { NONE: 0, MINOR: 0, MAJOR: 0, CRITICAL: 0 }
  for (const i of inspections) severityCounts[i.severity as keyof typeof severityCounts]++

  // Daily trend (pass vs fail per day)
  const byDay: Record<string, { date: string; pass: number; fail: number; review: number; defects: number }> = {}
  for (const i of inspections) {
    const d = i.createdAt.toISOString().slice(0, 10)
    if (!byDay[d]) byDay[d] = { date: d, pass: 0, fail: 0, review: 0, defects: 0 }
    if (i.status === "PASS") byDay[d].pass++
    else if (i.status === "FAIL") byDay[d].fail++
    else byDay[d].review++
    byDay[d].defects += i.defectCount
  }
  const trend = Object.values(byDay)

  // Production line performance
  const lineMap: Record<string, { line: string; code: string; total: number; pass: number; fail: number }> = {}
  for (const i of inspections) {
    const key = i.productionLine?.code || "UNKNOWN"
    if (!lineMap[key]) lineMap[key] = { line: i.productionLine?.name || "Unassigned", code: key, total: 0, pass: 0, fail: 0 }
    lineMap[key].total++
    if (i.status === "PASS") lineMap[key].pass++
    else if (i.status === "FAIL") lineMap[key].fail++
  }
  const linePerformance = Object.values(lineMap).map((l) => ({ ...l, passRate: l.total ? (l.pass / l.total) * 100 : 0 }))

  // Model performance (from metrics table)
  const models = await db.modelMetric.findMany({ orderBy: { map50: "desc" } })

  // Part type defect rate
  const partMap: Record<string, { part: string; total: number; fail: number }> = {}
  for (const i of inspections) {
    if (!partMap[i.partNumber]) partMap[i.partNumber] = { part: i.partName, total: 0, fail: 0 }
    partMap[i.partNumber].total++
    if (i.status === "FAIL") partMap[i.partNumber].fail++
  }
  const partPerformance = Object.entries(partMap).map(([partNumber, v]) => ({ partNumber, ...v, defectRate: v.total ? (v.fail / v.total) * 100 : 0 })).sort((a, b) => b.defectRate - a.defectRate)

  // Recent critical issues
  const recentCritical = inspections
    .filter((i) => i.severity === "CRITICAL" || i.severity === "MAJOR")
    .slice(-8)
    .reverse()
    .map((i) => ({
      id: i.id,
      code: i.inspectionCode,
      part: i.partName,
      partNumber: i.partNumber,
      status: i.status,
      severity: i.severity,
      confidence: i.confidence,
      defectCount: i.defectCount,
      line: i.productionLine?.code,
      createdAt: i.createdAt,
      defects: i.defects.map((d) => ({ type: d.type, severity: d.severity, confidence: d.confidence, location: d.location })),
    }))

  return NextResponse.json({
    windowDays: days,
    kpis: {
      total,
      passed,
      failed,
      review,
      passRate: Number(passRate.toFixed(1)),
      avgConfidence: Number(avgConfidence.toFixed(3)),
      avgLatency: Number(avgLatency.toFixed(0)),
      totalDefects,
      criticalCount: severityCounts.CRITICAL,
    },
    defectDistribution,
    severityDistribution: severityCounts,
    trend,
    linePerformance,
    partPerformance,
    recentCritical,
    models,
  })
}
