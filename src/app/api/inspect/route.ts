import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { runDefectDetection } from "@/lib/vlm-defect"
import { AI_MODELS, PART_PROFILES, SENSITIVITY_PRESETS, profileForPart, type DefectType, type Sensitivity } from "@/lib/defects"
import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"

// POST /api/inspect
// Accepts multipart/form-data:
//   image             — the part image to inspect (required)
//   goldenTemplate    — optional known-good reference image for deviation analysis
//   partId, partName, partNumber, productionLineCode, modelUsed, inspectorName
//   sensitivity       — "strict" | "balanced" | "sensitive" (default: balanced)
//   partProfile       — profile key (optional; auto-detected from partNumber if omitted)
//   enabledDefectTypes — comma-separated defect type keys to enable (optional; all if omitted)
// Runs the precision-enhanced multi-pass ensemble VLM detection, persists the
// inspection + defects + pipeline metadata, returns the full result.

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")

async function fileToDataUrl(file: File): Promise<{ dataUrl: string; ext: string }> {
  const buf = Buffer.from(await file.arrayBuffer())
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase()
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg"
  return { dataUrl: `data:${mime};base64,${buf.toString("base64")}`, ext }
}

async function saveUpload(file: File, ext: string): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer())
  const name = `${randomUUID()}.${ext === "jpeg" ? "jpg" : ext}`
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  await fs.writeFile(path.join(UPLOAD_DIR, name), buf)
  return `/uploads/${name}`
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get("image") as File | null
    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 })
    }

    const partId = (form.get("partId") as string) || `SN-${Math.floor(100000 + Math.random() * 899999)}`
    const partName = (form.get("partName") as string) || "Manufactured Part"
    const partNumber = (form.get("partNumber") as string) || "GEN-0000"
    const lineCode = (form.get("productionLineCode") as string) || (form.get("productionLineId") as string) || ""
    const modelUsed = (form.get("modelUsed") as string) || AI_MODELS[0].id
    const inspectorName = (form.get("inspectorName") as string) || "Raj Singh"
    const sensitivityKey = ((form.get("sensitivity") as string) || "balanced") as Sensitivity
    const profileKey = (form.get("partProfile") as string) || ""
    const enabledTypesRaw = (form.get("enabledDefectTypes") as string) || ""

    // Optional golden template
    const goldenFile = form.get("goldenTemplate") as File | null
    let goldenDataUrl: string | null = null
    let goldenImageUrl: string | null = null
    if (goldenFile && goldenFile.size > 0) {
      const g = await fileToDataUrl(goldenFile)
      goldenDataUrl = g.dataUrl
      try { goldenImageUrl = await saveUpload(goldenFile, g.ext) } catch (e) { console.error("[inspect] golden save failed:", e) }
    }

    // Resolve production line by code (or id) to link the inspection
    let productionLineId: string | null = null
    if (lineCode) {
      const line = await db.productionLine.findFirst({ where: { OR: [{ code: lineCode }, { id: lineCode }] } })
      productionLineId = line?.id ?? null
    }

    // Persist upload
    const { dataUrl, ext } = await fileToDataUrl(file)
    let imageUrl: string | null = null
    try {
      imageUrl = await saveUpload(file, ext)
    } catch (e) {
      console.error("[inspect] save upload failed:", e)
    }

    // Resolve inspector user (best-effort)
    const inspector = await db.user.findFirst({ where: { name: inspectorName } })

    // Resolve detection profile (explicit key, else auto-detect from part number / product type)
    const line = productionLineId ? await db.productionLine.findUnique({ where: { id: productionLineId } }) : null
    const profile =
      PART_PROFILES.find((p) => p.key === profileKey) ||
      profileForPart(partNumber, line?.productType)

    // Resolve sensitivity config
    const sensitivity = SENSITIVITY_PRESETS[sensitivityKey] || SENSITIVITY_PRESETS.balanced

    // Resolve enabled defect types
    let enabledDefectTypes: DefectType[] | null = null
    if (enabledTypesRaw) {
      enabledDefectTypes = enabledTypesRaw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean) as DefectType[]
      if (enabledDefectTypes.length === 0) enabledDefectTypes = null
    }

    // Run the precision-enhanced multi-pass ensemble AI detection
    const result = await runDefectDetection(dataUrl, {
      profile,
      sensitivity,
      goldenTemplateUrl: goldenDataUrl,
      enabledDefectTypes,
      modelUsed,
    })

    // Generate inspection code
    const count = await db.inspection.count()
    const inspectionCode = `QC-2024-${String(2000 + count).padStart(5, "0")}`

    // Determine inference device from model family
    const modelMeta = AI_MODELS.find((m) => m.id === modelUsed)
    const inferenceDevice =
      modelMeta?.family === "ViT" ? "GPU-H100" : modelMeta?.family === "CNN" ? "GPU-A100" : "Edge-Jetson-Orin"

    // Persist inspection (store pipeline metadata in rawAnalysis as JSON)
    const inspection = await db.inspection.create({
      data: {
        inspectionCode,
        partId,
        partName,
        partNumber,
        productionLineId,
        inspectorId: inspector?.id ?? null,
        modelUsed,
        imageUrl,
        thumbnail: imageUrl,
        status: result.status,
        severity: result.severity,
        confidence: result.confidence,
        defectCount: result.defects.length,
        processingMs: result.processingMs,
        inferenceDevice,
        notes: result.summary,
        rawAnalysis: JSON.stringify({
          pipeline: result.pipeline,
          passSummaries: result.pipeline.passes.map((p) => ({ name: p.passName, ok: p.ok, count: p.defects.length, ms: p.durationMs, summary: p.rawSummary })),
          goldenImageUrl,
          partProfile: profile.key,
          sensitivity: sensitivity.key,
        }),
      },
    })

    // Persist defects (with verification metadata encoded in location/description)
    if (result.defects.length) {
      await db.defect.createMany({
        data: result.defects.map((d) => ({
          inspectionId: inspection.id,
          type: d.type,
          severity: d.severity,
          confidence: d.confidence,
          bboxX: d.bboxX,
          bboxY: d.bboxY,
          bboxW: d.bboxW,
          bboxH: d.bboxH,
          location: d.location + (d.verified ? " [verified]" : ""),
          description: d.description + (d.passCount > 1 ? ` (confirmed by ${d.passCount} passes)` : ""),
        })),
      })
    }

    await logAudit({
      userId: inspector?.id,
      userName: inspectorName,
      action: "INSPECTION_RUN",
      resource: "Inspection",
      resourceId: inspectionCode,
      details: `${result.status} — ${result.defects.length} defect(s) [${result.pipeline.verifiedCount} verified], severity ${result.severity}, ${result.pipeline.passes.length} ensemble passes, profile ${profile.key}, sensitivity ${sensitivity.key}${goldenDataUrl ? ", golden-template" : ""}`,
      severity: result.status === "FAIL" ? "WARN" : "INFO",
    })

    const full = await db.inspection.findUnique({
      where: { id: inspection.id },
      include: { defects: true, productionLine: true, inspector: true },
    })

    return NextResponse.json({ ok: true, inspection: full, result })
  } catch (e: any) {
    console.error("[inspect] error:", e)
    return NextResponse.json({ error: e?.message || "Inspection failed" }, { status: 500 })
  }
}
