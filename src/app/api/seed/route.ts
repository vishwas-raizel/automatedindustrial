import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { DEFECT_LIST, PART_CATALOG, PRODUCTION_LINES, AI_MODELS } from "@/lib/defects"

// Seed the database with realistic Industry 4.0 inspection data.
// Idempotent: only seeds when the DB is empty.

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function randFloat(min: number, max: number, dp = 2) {
  return Number((Math.random() * (max - min) + min).toFixed(dp))
}
function pick<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  const out: T[] = []
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0])
  }
  return out
}

export async function POST() {
  const existing = await db.inspection.count()
  if (existing > 0) {
    return NextResponse.json({ ok: true, skipped: true, message: "Database already seeded" })
  }

  // --- Users ---
  const users = await db.user.createManyAndReturn({
    data: [
      { email: "a.kovacs@plant.example", name: "Alex Kovacs", role: "ADMIN", department: "Operations" },
      { email: "m.chen@plant.example", name: "Mei Chen", role: "ENGINEER", department: "AI / ML Engineering" },
      { email: "r.singh@plant.example", name: "Raj Singh", role: "INSPECTOR", department: "Quality Assurance" },
      { email: "l.muller@plant.example", name: "Lena Müller", role: "VIEWER", department: "Compliance" },
    ],
  })

  // --- Production Lines ---
  const lines = await db.productionLine.createManyAndReturn({
    data: PRODUCTION_LINES.map((l) => ({
      code: l.code,
      name: l.name,
      facility: l.facility,
      productType: l.productType,
      shift: l.shift,
      status: rand(["RUNNING", "RUNNING", "RUNNING", "IDLE", "MAINTENANCE"]),
      throughput: l.throughput,
    })),
  })

  // --- Model Metrics ---
  await db.modelMetric.createMany({
    data: [
      { modelName: "YOLOv11-Defect", version: "v11n", map50: 0.943, map5095: 0.712, precision: 0.951, recall: 0.928, f1: 0.939, inferenceMs: 8.4, paramsMillion: 2.6, dataset: "IndustrialDefect-12k", status: "PRODUCTION" },
      { modelName: "YOLOv8-Defect", version: "v8m", map50: 0.918, map5095: 0.681, precision: 0.933, recall: 0.908, f1: 0.92, inferenceMs: 14.7, paramsMillion: 25.9, dataset: "IndustrialDefect-12k", status: "PRODUCTION" },
      { modelName: "RT-DETR-Defect", version: "r18", map50: 0.937, map5095: 0.704, precision: 0.948, recall: 0.934, f1: 0.941, inferenceMs: 31.2, paramsMillion: 20.0, dataset: "IndustrialDefect-12k", status: "STAGING" },
      { modelName: "EfficientNet-B7", version: "b7", map50: 0.882, map5095: 0.612, precision: 0.901, recall: 0.871, f1: 0.886, inferenceMs: 42.5, paramsMillion: 66.3, dataset: "IndustrialDefect-12k", status: "EXPERIMENTAL" },
      { modelName: "VisionTransformer", version: "vit-l/16", map50: 0.951, map5095: 0.738, precision: 0.958, recall: 0.949, f1: 0.953, inferenceMs: 118.6, paramsMillion: 304.0, dataset: "IndustrialDefect-12k", status: "EXPERIMENTAL" },
    ],
  })

  // --- Historical Inspections (last 30 days) ---
  const inspector = users.find((u) => u.role === "INSPECTOR")!
  const engineer = users.find((u) => u.role === "ENGINEER")!
  const TOTAL = 140
  const now = Date.now()
  const dayMs = 86400000

  const inspections: any[] = []
  for (let i = 0; i < TOTAL; i++) {
    const part = rand(PART_CATALOG)
    const line = rand(lines)
    const model = rand(AI_MODELS)
    const r = Math.random()
    let status: "PASS" | "FAIL" | "REVIEW"
    if (r < 0.76) status = "PASS"
    else if (r < 0.94) status = "FAIL"
    else status = "REVIEW"

    const daysAgo = randInt(0, 29)
    const hoursAgo = randInt(0, 23)
    const createdAt = new Date(now - daysAgo * dayMs - hoursAgo * 3600000)

    const defectCount = status === "PASS" ? 0 : status === "REVIEW" ? randInt(1, 2) : randInt(1, 4)
    const chosenDefects = pick(DEFECT_LIST, defectCount)
    let severity: "NONE" | "MINOR" | "MAJOR" | "CRITICAL" = "NONE"
    if (defectCount > 0) {
      if (chosenDefects.some((d) => ["CRACK", "SHORT_CIRCUIT", "MISSING_COMPONENT"].includes(d.key))) severity = Math.random() < 0.6 ? "CRITICAL" : "MAJOR"
      else severity = rand(["MINOR", "MAJOR"])
    }
    const confidence = status === "PASS" ? randFloat(0.92, 0.99) : randFloat(0.62, 0.95)
    const seq = String(1000 + i).padStart(5, "0")

    inspections.push({
      inspectionCode: `QC-2024-${seq}`,
      partId: `SN-${randInt(100000, 999999)}`,
      partName: part.partName,
      partNumber: part.partNumber,
      productionLineId: line.id,
      inspectorId: Math.random() < 0.7 ? inspector.id : engineer.id,
      modelUsed: model.id,
      imageUrl: null,
      thumbnail: null,
      status,
      severity,
      confidence,
      defectCount,
      processingMs: randInt(6, 180),
      inferenceDevice: model.family === "ViT" ? "GPU-H100" : model.family === "CNN" ? "GPU-A100" : "Edge-Jetson",
      notes: status === "REVIEW" ? "Flagged for secondary manual review by shift supervisor." : null,
      createdAt,
      _defects: chosenDefects.map((d) => ({
        type: d.key,
        severity: severity === "CRITICAL" ? "CRITICAL" : severity === "MAJOR" ? "MAJOR" : "MINOR",
        confidence: randFloat(0.6, 0.97),
        bboxX: randFloat(0.05, 0.7),
        bboxY: randFloat(0.05, 0.7),
        bboxW: randFloat(0.08, 0.28),
        bboxH: randFloat(0.08, 0.28),
        location: rand(["upper-left quadrant", "center region", "lower-right edge", "top surface", "side wall", "bottom-right quadrant"]),
        description: `${d.label} detected on ${part.partName.toLowerCase()}.`,
      })),
    })
  }

  inspections.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  for (const insp of inspections) {
    const { _defects, ...data } = insp
    const created = await db.inspection.create({ data })
    if (_defects.length) {
      await db.defect.createMany({
        data: _defects.map((d: any) => ({ ...d, inspectionId: created.id })),
      })
    }
  }

  // --- Audit Logs ---
  const auditActions = ["LOGIN", "INSPECTION_RUN", "REPORT_GENERATED", "EXPORT", "CONFIG_CHANGE", "ALERT_ACK"]
  for (let i = 0; i < 40; i++) {
    const u = rand(users)
    const action = rand(auditActions)
    await db.auditLog.create({
      data: {
        userId: u.id,
        userName: u.name,
        action,
        resource: action === "INSPECTION_RUN" ? "Inspection" : action === "REPORT_GENERATED" ? "Report" : action === "EXPORT" ? "Export" : "System",
        resourceId: `QC-2024-${String(randInt(1000, 1139)).padStart(5, "0")}`,
        details: `${action.toLowerCase().replace(/_/g, " ")} operation`,
        severity: action === "ALERT_ACK" ? "WARN" : "INFO",
        timestamp: new Date(now - randInt(0, 14) * dayMs - randInt(0, 23) * 3600000),
      },
    })
  }

  await logAudit({ userName: "system", action: "SEED_RUN", resource: "System", details: `Seeded ${TOTAL} inspections, ${users.length} users, ${lines.length} production lines` })

  const counts = {
    users: users.length,
    lines: lines.length,
    inspections: TOTAL,
    models: 5,
    auditLogs: 40,
  }

  return NextResponse.json({ ok: true, seeded: counts })
}
