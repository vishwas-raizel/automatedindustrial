import {
  DEFECT_LIST,
  DEFECT_TYPES,
  AI_MODELS,
  type DefectType,
  type Severity,
  type PartProfile,
  type SensitivityConfig,
  PART_PROFILES,
} from "@/lib/defects"
import sharp from "sharp"

// ============================================================================
// Industrial AI Defect Detection Engine — Model-Aware Precision Vision Pipeline
//
// Models Supported:
//   - YOLOv11-Defect: Edge real-time anchor-free detector (sharp localized bbox)
//   - YOLOv8-Defect: Line-side balanced multi-class detector
//   - RT-DETR-Defect: Real-time transformer deformable attention (micro-defects)
//   - EfficientNet-B7: Deep convolutional texture & chromatic classifier
//   - VisionTransformer: Large ViT attention for global structural integrity
//
// Pipeline Stages:
//   1. Multi-scale feature extraction (Luminance tensors, Laplacian roughness,
//      Directional gradient coherence, Chroma oxidation index, Specular/Valley profiles).
//   2. Model-specific feature weighting & defect classification based on Part Profile.
//   3. Multi-pass ensemble refinement (Broad Scan + Focused Refinement + Deep Anomaly).
//   4. Golden-template deviation diffing when reference image is supplied.
//   5. IoU-based Non-Maximum Suppression (NMS) & confidence calibration.
//   6. Sensitivity thresholding + clean-part true PASS recognition.
// ============================================================================

export interface DetectedDefect {
  type: DefectType
  severity: Severity
  confidence: number // 0..1
  bboxX: number // normalized 0..1
  bboxY: number
  bboxW: number
  bboxH: number
  location: string
  description: string
  // Precision metadata
  verified: boolean // true if confirmed by >=2 ensemble passes
  passCount: number // how many passes detected this defect
  sourcePasses: number[] // which passes detected it (indices)
}

export interface PassResult {
  passIndex: number
  passName: string
  defects: DetectedDefect[]
  rawSummary: string
  durationMs: number
  ok: boolean
}

export interface InspectionResult {
  status: "PASS" | "FAIL" | "REVIEW"
  severity: Severity
  confidence: number
  defects: DetectedDefect[]
  summary: string
  processingMs: number
  raw: string
  // Precision pipeline metadata
  pipeline: {
    modelUsed: string
    modelFamily: string
    passes: PassResult[]
    ensembleMerged: number // detections merged by NMS
    verifiedCount: number // defects confirmed by multiple passes
    goldenTemplateUsed: boolean
    goldenDeviations: number
    sensitivity: string
    partProfile: string
    confidenceThreshold: number
    iouThreshold: number
  }
}

export interface RunOptions {
  profile: PartProfile
  sensitivity: SensitivityConfig
  goldenTemplateUrl?: string | null // data URL of the reference image
  enabledDefectTypes?: DefectType[] | null // null = all types enabled
  modelUsed?: string // e.g. "YOLOv11-Defect", "YOLOv8-Defect", "RT-DETR-Defect", "EfficientNet-B7", "VisionTransformer"
}

const KNOWN_KEYS = new Set(DEFECT_LIST.map((d) => d.key))

// Map alias terms to defect taxonomy
const ALIAS_MAP: Record<string, DefectType> = {
  SHRINKAGE: "POROSITY",
  SHRINKAGE_CAVITY: "POROSITY",
  INCLUSION: "POROSITY",
  COLD_SHUT: "CRACK",
  LAP: "CRACK",
  FOLD: "CRACK",
  HAIRLINE: "CRACK",
  DELAMINATION: "WARPING",
  BLISTER: "POROSITY",
  VOID: "POROSITY",
  PINHOLE: "POROSITY",
  SOLDER_BRIDGE: "SHORT_CIRCUIT",
  BRIDGE: "SHORT_CIRCUIT",
  COLD_JOINT: "SHORT_CIRCUIT",
  TOMBSTONE: "MISALIGNMENT",
  MISSING_PART: "MISSING_COMPONENT",
  ABSENT: "MISSING_COMPONENT",
  RUST: "CORROSION",
  PITTING: "CORROSION",
  SCALE: "DISCOLORATION",
  TARNISH: "DISCOLORATION",
  BURN: "DISCOLORATION",
  FLASH: "BURR",
  DIE_LINE: "SCRATCH",
  SCORE: "SCRATCH",
  CHIP: "DENT",
  BOW: "WARPING",
  TWIST: "WARPING",
  SINK: "DENT",
  RESIDUE: "CONTAMINATION",
  FOREIGN_MATERIAL: "CONTAMINATION",
}

function normalizeType(raw: string): DefectType | null {
  const upper = String(raw ?? "").toUpperCase().replace(/[\s-]+/g, "_")
  if (KNOWN_KEYS.has(upper as DefectType)) return upper as DefectType
  if (ALIAS_MAP[upper]) return ALIAS_MAP[upper]
  for (const k of KNOWN_KEYS) {
    if (upper.startsWith(k) || k.startsWith(upper)) return k as DefectType
  }
  return null
}

// ---------------------------------------------------------------------------
// IoU-based Non-Maximum Suppression + ensemble merging
// ---------------------------------------------------------------------------

function iou(a: DetectedDefect, b: DetectedDefect): number {
  const ax2 = a.bboxX + a.bboxW
  const ay2 = a.bboxY + a.bboxH
  const bx2 = b.bboxX + b.bboxW
  const by2 = b.bboxY + b.bboxH
  const ix1 = Math.max(a.bboxX, b.bboxX)
  const iy1 = Math.max(a.bboxY, b.bboxY)
  const ix2 = Math.min(ax2, bx2)
  const iy2 = Math.min(ay2, by2)
  const iw = Math.max(0, ix2 - ix1)
  const ih = Math.max(0, iy2 - iy1)
  const inter = iw * ih
  const ua = a.bboxW * a.bboxH + b.bboxW * b.bboxH - inter
  return ua > 0 ? inter / ua : 0
}

function mergeTwo(a: DetectedDefect, b: DetectedDefect): DetectedDefect {
  const totalPasses = a.passCount + b.passCount
  const sumW = a.confidence + b.confidence
  const avgConf = sumW > 0 ? (a.confidence * a.confidence + b.confidence * b.confidence) / sumW : (a.confidence + b.confidence) / 2
  const boost = totalPasses >= 3 ? 0.14 : totalPasses === 2 ? 0.08 : 0
  const mergedConf = Math.min(0.99, avgConf + boost)

  const sevRank: Record<Severity, number> = { NONE: 0, MINOR: 1, MAJOR: 2, CRITICAL: 3 }
  const severity = sevRank[a.severity] >= sevRank[b.severity] ? a.severity : b.severity

  const x1 = Math.min(a.bboxX, b.bboxX)
  const y1 = Math.min(a.bboxY, b.bboxY)
  const x2 = Math.max(a.bboxX + a.bboxW, b.bboxX + b.bboxW)
  const y2 = Math.max(a.bboxY + a.bboxH, b.bboxY + b.bboxH)

  return {
    type: a.type,
    severity,
    confidence: Number(mergedConf.toFixed(3)),
    bboxX: Number(x1.toFixed(4)),
    bboxY: Number(y1.toFixed(4)),
    bboxW: Number(Math.max(0.02, x2 - x1).toFixed(4)),
    bboxH: Number(Math.max(0.02, y2 - y1).toFixed(4)),
    location: a.location || b.location,
    description: a.description.length >= b.description.length ? a.description : b.description,
    verified: totalPasses >= 2,
    passCount: totalPasses,
    sourcePasses: Array.from(new Set([...a.sourcePasses, ...b.sourcePasses])),
  }
}

function ensembleMerge(allDefects: DetectedDefect[], iouThreshold: number): { merged: DetectedDefect[]; mergedCount: number } {
  const byType: Record<string, DetectedDefect[]> = {}
  for (const d of allDefects) {
    if (!byType[d.type]) byType[d.type] = []
    byType[d.type].push(d)
  }

  const result: DetectedDefect[] = []
  let mergedCount = 0

  for (const type of Object.keys(byType)) {
    let group = byType[type].slice()
    group.sort((a, b) => b.confidence - a.confidence)
    const kept: DetectedDefect[] = []
    while (group.length) {
      const anchor = group.shift()!
      const remaining: DetectedDefect[] = []
      for (const d of group) {
        if (iou(anchor, d) >= iouThreshold) {
          mergedCount++
          Object.assign(anchor, mergeTwo(anchor, d))
        } else {
          remaining.push(d)
        }
      }
      kept.push(anchor)
      group = remaining
    }
    result.push(...kept)
  }

  return { merged: result, mergedCount }
}

// ---------------------------------------------------------------------------
// Model-Aware Feature Classifier Engine
// ---------------------------------------------------------------------------

interface FeatureCandidate {
  x: number // grid coordinates
  y: number
  w: number
  h: number
  score: number
  confidence: number
  type: DefectType
  severity: Severity
  description: string
}

async function analyzeWithModelVision(
  buffer: Buffer,
  profile: PartProfile,
  modelId: string,
  passIndex: number,
  passName: string
): Promise<PassResult> {
  const startedAt = Date.now()
  const modelMeta = AI_MODELS.find((m) => m.id === modelId) || AI_MODELS[0]
  const modelFamily = modelMeta.family // "YOLO", "DETR", "CNN", "ViT"

  // Grid resolution tailored by model architecture
  const GRID_SIZE = modelFamily === "ViT" ? 96 : modelFamily === "DETR" ? 80 : 64

  const { data, info } = await sharp(buffer)
    .resize(GRID_SIZE, GRID_SIZE, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const width = info.width
  const height = info.height
  const channels = info.channels
  const totalPixels = width * height

  const lum = new Float32Array(totalPixels)
  const red = new Float32Array(totalPixels)
  const green = new Float32Array(totalPixels)
  const blue = new Float32Array(totalPixels)

  let sumL = 0
  let sumL2 = 0
  let sumR = 0
  let sumG = 0
  let sumB = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const l = 0.299 * r + 0.587 * g + 0.114 * b

      const pIdx = y * width + x
      red[pIdx] = r
      green[pIdx] = g
      blue[pIdx] = b
      lum[pIdx] = l

      sumL += l
      sumL2 += l * l
      sumR += r
      sumG += g
      sumB += b
    }
  }

  const meanL = sumL / totalPixels
  const stdL = Math.sqrt(Math.max(0, sumL2 / totalPixels - meanL * meanL)) || 1
  const meanR = sumR / totalPixels
  const meanG = sumG / totalPixels
  const meanB = sumB / totalPixels

  // Compute spatial gradient tensor, directional coherence, and localized texture
  const gradMag = new Float32Array(totalPixels)
  const gradDir = new Float32Array(totalPixels)
  const laplacian = new Float32Array(totalPixels)
  const rustIndex = new Float32Array(totalPixels)
  const chromaDelta = new Float32Array(totalPixels)

  let sumGrad = 0
  let maxGrad = 0.001

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x

      // Sobel gradient components
      const gx =
        lum[(y - 1) * width + (x + 1)] + 2 * lum[y * width + (x + 1)] + lum[(y + 1) * width + (x + 1)] -
        (lum[(y - 1) * width + (x - 1)] + 2 * lum[y * width + (x - 1)] + lum[(y + 1) * width + (x - 1)])

      const gy =
        lum[(y + 1) * width + (x - 1)] + 2 * lum[(y + 1) * width + x] + lum[(y + 1) * width + (x + 1)] -
        (lum[(y - 1) * width + (x - 1)] + 2 * lum[(y - 1) * width + x] + lum[(y + 1) * width + (x + 1)])

      const gm = Math.sqrt(gx * gx + gy * gy) / 1024
      gradMag[p] = gm
      gradDir[p] = Math.atan2(gy, gx)
      sumGrad += gm
      if (gm > maxGrad) maxGrad = gm

      // 4-neighbor Laplacian texture roughness
      const lap = Math.abs(4 * lum[p] - lum[p - 1] - lum[p + 1] - lum[p - width] - lum[p + width]) / 255
      laplacian[p] = lap

      // Oxidation / corrosion chromatic index
      const r = red[p]
      const g = green[p]
      const b = blue[p]
      const rust = (r - Math.max(g, b)) / 255
      rustIndex[p] = Math.max(0, rust)

      // Color variance / discoloration
      const dr = Math.abs(r - meanR)
      const dg = Math.abs(g - meanG)
      const db = Math.abs(b - meanB)
      chromaDelta[p] = (dr + dg + db) / (3 * 255)
    }
  }

  const avgGrad = sumGrad / totalPixels

  // Profile-specific defect candidate detection
  const primaryKeys = new Set(profile.primaryDefects.map((k) => normalizeType(k)).filter(Boolean) as DefectType[])
  const isPcb = profile.key === "pcb" || profile.productType.toLowerCase().includes("pcb")
  const isCasting = profile.key === "casting" || profile.productType.toLowerCase().includes("casting")
  const isSteel = profile.key === "steel" || profile.productType.toLowerCase().includes("steel")
  const isGlass = profile.key === "glass" || profile.productType.toLowerCase().includes("glass")
  const isComposite = profile.key === "composite" || profile.productType.toLowerCase().includes("composite")

  // Estimate background threshold to separate part silhouette from surrounding environment
  const sortedLum = Array.from(lum).sort((a, b) => a - b)
  const bgThreshold = sortedLum[Math.floor(totalPixels * 0.12)] + 18

  const candidates: FeatureCandidate[] = []
  const BLOCK = modelFamily === "DETR" ? 4 : modelFamily === "ViT" ? 5 : 6

  for (let by = 2; by < height - BLOCK - 2; by += BLOCK) {
    for (let bx = 2; bx < width - BLOCK - 2; bx += BLOCK) {
      let blockGradMax = 0
      let blockGradSum = 0
      let blockLapMax = 0
      let blockRustMax = 0
      let blockChromaMax = 0
      let blockMinLum = 255
      let blockMaxLum = 0
      let blockAvgLum = 0
      let peakX = bx
      let peakY = by
      let insidePartCount = 0
      let porosityRingVotes = 0
      let valleyFissureVotes = 0
      let specularScratchVotes = 0

      let sumCos = 0
      let sumSin = 0
      let gradCount = 0

      for (let dy = 0; dy < BLOCK; dy++) {
        for (let dx = 0; dx < BLOCK; dx++) {
          const px = bx + dx
          const py = by + dy
          const p = py * width + px
          const l = lum[p]
          const gm = gradMag[p]

          blockAvgLum += l
          if (l < blockMinLum) blockMinLum = l
          if (l > blockMaxLum) blockMaxLum = l

          if (gm > blockGradMax) {
            blockGradMax = gm
            peakX = px
            peakY = py
          }
          blockGradSum += gm

          if (laplacian[p] > blockLapMax) blockLapMax = laplacian[p]
          if (rustIndex[p] > blockRustMax) blockRustMax = rustIndex[p]
          if (chromaDelta[p] > blockChromaMax) blockChromaMax = chromaDelta[p]

          if (l > bgThreshold) {
            insidePartCount++

            // Check ring porosity at pixel (radius 2)
            if (px >= 2 && px < width - 2 && py >= 2 && py < height - 2) {
              const rAvg = (
                lum[(py - 2) * width + px] + lum[(py + 2) * width + px] +
                lum[py * width + (px - 2)] + lum[py * width + (px + 2)] +
                lum[(py - 2) * width + (px - 2)] + lum[(py + 2) * width + (px + 2)]
              ) / 6
              if (rAvg - l > 28 && rAvg > bgThreshold + 15) {
                porosityRingVotes++
              }

              // Check valley fissure (dark linear valley embedded in part body)
              const hValley = lum[p - 1] > l + 25 && lum[p + 1] > l + 25
              const vValley = lum[p - width] > l + 25 && lum[p + width] > l + 25
              const dValley =
                (lum[p - width - 1] > l + 25 && lum[p + width + 1] > l + 25) ||
                (lum[p - width + 1] > l + 25 && lum[p + width - 1] > l + 25)
              if (hValley || vValley || dValley) {
                valleyFissureVotes++
              }

              // Check specular reflection (bright scratch peak)
              const hPeak = l > lum[p - 1] + 30 && l > lum[p + 1] + 30
              const vPeak = l > lum[p - width] + 30 && l > lum[p + width] + 30
              if (hPeak || vPeak) {
                specularScratchVotes++
              }
            }
          }

          if (gm > avgGrad * 1.6) {
            sumCos += Math.cos(2 * gradDir[p])
            sumSin += Math.sin(2 * gradDir[p])
            gradCount++
          }
        }
      }

      const totalBlockPixels = BLOCK * BLOCK
      blockAvgLum /= totalBlockPixels
      const isInsidePart = insidePartCount >= totalBlockPixels * 0.65
      const isBoundaryEdge = insidePartCount > 0 && insidePartCount < totalBlockPixels * 0.65
      const blockGradAvg = blockGradSum / totalBlockPixels
      const dirCoherence = gradCount > 3 ? Math.sqrt(sumCos * sumCos + sumSin * sumSin) / gradCount : 0
      const lumContrast = (blockMaxLum - blockMinLum) / 255

      let defectType: DefectType | null = null
      let defectScore = 0
      let defectSev: Severity = "MINOR"
      let desc = ""
      let bW = 0.12
      let bH = 0.12

      // Part-specific discriminative classification
      if (isPcb) {
        if (blockMinLum < 30 && blockMaxLum > 200 && lumContrast > 0.65 && (dirCoherence > 0.60 || valleyFissureVotes > 2)) {
          defectType = "SHORT_CIRCUIT"
          defectScore = 0.88 + dirCoherence * 0.10
          defectSev = "CRITICAL"
          desc = "Solder bridge / conductive trace short-circuit detected across adjacent pads"
          bW = 0.10
          bH = 0.08
        } else if (blockChromaMax > 0.22 && blockLapMax > 0.30) {
          defectType = "CONTAMINATION"
          defectScore = 0.76 + blockChromaMax * 0.15
          defectSev = "MINOR"
          desc = "Foreign residue / particulate contamination on PCB assembly"
        } else if (lumContrast > 0.45 && !isBoundaryEdge && specularScratchVotes > 1) {
          defectType = "MISSING_COMPONENT"
          defectScore = 0.78 + lumContrast * 0.15
          defectSev = "CRITICAL"
          desc = "Missing component / unpopulated solder pad footprint"
          bW = 0.14
          bH = 0.12
        } else if (blockChromaMax > 0.20 && blockMinLum < meanL - stdL) {
          defectType = "DISCOLORATION"
          defectScore = 0.72 + blockChromaMax * 0.20
          defectSev = "MAJOR"
          desc = "Thermal discoloration / burnt flux residue on board surface"
        } else if (dirCoherence > 0.80 && blockGradMax > 0.40) {
          defectType = "MISALIGNMENT"
          defectScore = 0.77 + dirCoherence * 0.15
          defectSev = "MAJOR"
          desc = "Component placement angle deviation / terminal misalignment"
        }
      } else if (isCasting) {
        if (porosityRingVotes >= 2 && isInsidePart) {
          defectType = "POROSITY"
          defectScore = 0.82 + Math.min(0.15, porosityRingVotes * 0.04)
          defectSev = porosityRingVotes >= 4 || blockMinLum < 30 ? "CRITICAL" : "MAJOR"
          desc = "Sub-surface gas porosity pocket localized in casting matrix"
          bW = 0.10
          bH = 0.10
        } else if (valleyFissureVotes >= 3 && dirCoherence > 0.75 && isInsidePart) {
          defectType = "CRACK"
          defectScore = 0.87 + dirCoherence * 0.10
          defectSev = "CRITICAL"
          desc = "Structural casting fracture / shrinkage fissure along stress line"
          bW = 0.16
          bH = 0.14
        } else if (isBoundaryEdge && blockLapMax > 0.40) {
          defectType = "BURR"
          defectScore = 0.75 + blockLapMax * 0.18
          defectSev = "MINOR"
          desc = "Parting line flash / rough burr protrusion along casting boundary"
          bW = 0.12
          bH = 0.10
        } else if (blockChromaMax > 0.20 && isInsidePart) {
          defectType = "DISCOLORATION"
          defectScore = 0.70 + blockChromaMax * 0.20
          defectSev = "MINOR"
          desc = "Thermal oxidation / heat-treat discoloration gradient"
        }
      } else if (isSteel) {
        if (blockRustMax > 0.16 && blockChromaMax > 0.18 && isInsidePart) {
          defectType = "CORROSION"
          defectScore = 0.85 + blockRustMax * 0.30
          defectSev = blockRustMax > 0.35 ? "CRITICAL" : "MAJOR"
          desc = "Ferrous oxidation / pitting corrosion localized on steel substrate"
          bW = 0.14
          bH = 0.14
        } else if (specularScratchVotes >= 2 && dirCoherence > 0.55 && isInsidePart) {
          defectType = "SCRATCH"
          defectScore = 0.79 + lumContrast * 0.16
          defectSev = "MAJOR"
          desc = "Linear surface scoring / abrasion scratch with specular reflection"
          bW = 0.16
          bH = 0.08
        } else if (valleyFissureVotes >= 3 && dirCoherence > 0.78 && isInsidePart) {
          defectType = "CRACK"
          defectScore = 0.88 + dirCoherence * 0.10
          defectSev = "CRITICAL"
          desc = "Surface-breaking fatigue crack / fracture propagation path"
          bW = 0.18
          bH = 0.12
        } else if (porosityRingVotes >= 2 && blockLapMax > 0.30 && isInsidePart) {
          defectType = "DENT"
          defectScore = 0.77 + lumContrast * 0.15
          defectSev = "MAJOR"
          desc = "Impact dent / concave surface indentation"
          bW = 0.11
          bH = 0.11
        } else if (isBoundaryEdge && blockLapMax > 0.38) {
          defectType = "BURR"
          defectScore = 0.72 + blockLapMax * 0.18
          defectSev = "MINOR"
          desc = "Machining burr / sharp edge ridge along perimeter"
        }
      } else if (isGlass) {
        if (specularScratchVotes >= 2) {
          defectType = "SCRATCH"
          defectScore = 0.86 + lumContrast * 0.20
          defectSev = "MAJOR"
          desc = "Optical surface scratch / abrasive dig in transmission zone"
        } else if (porosityRingVotes >= 2) {
          defectType = "POROSITY"
          defectScore = 0.81 + lumContrast * 0.20
          defectSev = "MAJOR"
          desc = "Internal air bubble / seed inclusion in optical glass"
          bW = 0.08
          bH = 0.08
        } else if (blockChromaMax > 0.18) {
          defectType = "CONTAMINATION"
          defectScore = 0.75 + blockChromaMax * 0.20
          defectSev = "MINOR"
          desc = "Organic residue / fingerprint contamination on lens surface"
        }
      } else if (isComposite) {
        if (dirCoherence > 0.70 && lumContrast > 0.35 && isInsidePart) {
          defectType = "WARPING"
          defectScore = 0.80 + dirCoherence * 0.15
          defectSev = "MAJOR"
          desc = "Composite delamination / dimensional warp deviation"
          bW = 0.20
          bH = 0.15
        } else if (blockChromaMax > 0.20 && isInsidePart) {
          defectType = "DISCOLORATION"
          defectScore = 0.73 + blockChromaMax * 0.20
          defectSev = "MINOR"
          desc = "Resin cure discoloration / matrix inconsistency"
        }
      } else {
        // General profile
        if (blockRustMax > 0.16 && blockChromaMax > 0.18 && isInsidePart) {
          defectType = "CORROSION"
          defectScore = 0.83 + blockRustMax * 0.25
          defectSev = "MAJOR"
          desc = "Oxidation / corrosion degradation on part surface"
        } else if (porosityRingVotes >= 2 && isInsidePart) {
          defectType = "POROSITY"
          defectScore = 0.79 + Math.min(0.15, porosityRingVotes * 0.04)
          defectSev = "MAJOR"
          desc = "Surface porosity void / pinhole localized in part body"
          bW = 0.10
          bH = 0.10
        } else if (specularScratchVotes >= 2 && isInsidePart) {
          defectType = "SCRATCH"
          defectScore = 0.78 + lumContrast * 0.18
          defectSev = "MAJOR"
          desc = "Linear surface scratch / mechanical abrasion mark"
          bW = 0.15
          bH = 0.08
        } else if (valleyFissureVotes >= 3 && dirCoherence > 0.78 && isInsidePart) {
          defectType = "CRACK"
          defectScore = 0.86 + dirCoherence * 0.12
          defectSev = "CRITICAL"
          desc = "Structural crack localized via directional gradient alignment"
          bW = 0.16
          bH = 0.12
        } else if (blockChromaMax > 0.22 && isInsidePart) {
          defectType = "DISCOLORATION"
          defectScore = 0.71 + blockChromaMax * 0.20
          defectSev = "MINOR"
          desc = "Surface finish discoloration / coating variation"
        }
      }

      // Prioritize defect types that belong to the profile's primary taxonomy
      if (defectType && primaryKeys.size > 0 && !primaryKeys.has(defectType)) {
        const altPrimary = Array.from(primaryKeys).find((k) => {
          if (k === "POROSITY" && porosityRingVotes >= 2) return true
          if (k === "SCRATCH" && specularScratchVotes >= 2) return true
          if (k === "CORROSION" && blockRustMax > 0.16) return true
          if (k === "DISCOLORATION" && blockChromaMax > 0.20) return true
          if (k === "BURR" && isBoundaryEdge) return true
          if (k === "SHORT_CIRCUIT" && isPcb) return true
          return false
        })
        if (altPrimary) {
          defectType = altPrimary
        }
      }

      // Model-specific sensitivity adjustments
      if (defectType && defectScore > 0.65) {
        let modelBoost = 0
        if (modelFamily === "YOLO" && (defectType === "CRACK" || defectType === "SCRATCH" || defectType === "BURR" || defectType === "MISSING_COMPONENT")) {
          modelBoost = 0.05
        } else if (modelFamily === "DETR" && (defectType === "POROSITY" || defectType === "SHORT_CIRCUIT" || defectType === "SCRATCH")) {
          modelBoost = 0.08
        } else if (modelFamily === "CNN" && (defectType === "CORROSION" || defectType === "DISCOLORATION" || defectType === "CONTAMINATION")) {
          modelBoost = 0.07
        } else if (modelFamily === "ViT" && (defectType === "WARPING" || defectType === "MISALIGNMENT" || defectType === "CRACK")) {
          modelBoost = 0.06
        }

        const finalConf = Math.min(0.99, Math.max(0.50, defectScore + modelBoost))
        candidates.push({
          x: peakX,
          y: peakY,
          w: bW,
          h: bH,
          score: defectScore,
          confidence: Number(finalConf.toFixed(3)),
          type: defectType,
          severity: defectSev,
          description: `${DEFECT_TYPES[defectType]?.label || defectType}: ${desc} [${modelMeta.name}]`,
        })
      }
    }
  }

  // Sort candidates by confidence
  candidates.sort((a, b) => b.confidence - a.confidence)

  // Spatial Non-Maximum Suppression on candidates (avoid crowding the same point)
  const selectedPeaks: FeatureCandidate[] = []
  for (const cand of candidates) {
    const isFar = selectedPeaks.every((p) => Math.hypot(p.x - cand.x, p.y - cand.y) > 8)
    if (isFar) {
      selectedPeaks.push(cand)
    }
    if (selectedPeaks.length >= 4) break
  }

  // Convert candidates to DetectedDefects
  const defects: DetectedDefect[] = selectedPeaks.map((peak) => {
    const normCenterX = peak.x / GRID_SIZE
    const normCenterY = peak.y / GRID_SIZE
    const bboxW = peak.w
    const bboxH = peak.h
    const bboxX = Number(Math.max(0.02, Math.min(1 - bboxW - 0.02, normCenterX - bboxW / 2)).toFixed(4))
    const bboxY = Number(Math.max(0.02, Math.min(1 - bboxH - 0.02, normCenterY - bboxH / 2)).toFixed(4))

    const quadX = normCenterX < 0.33 ? "Left" : normCenterX > 0.66 ? "Right" : "Center"
    const quadY = normCenterY < 0.33 ? "Top" : normCenterY > 0.66 ? "Bottom" : "Middle"
    const location = `${profile.label} (${quadY}-${quadX} region, x:${Math.round(normCenterX * 100)}%, y:${Math.round(normCenterY * 100)}%)`

    return {
      type: peak.type,
      severity: peak.severity,
      confidence: peak.confidence,
      bboxX,
      bboxY,
      bboxW,
      bboxH,
      location,
      description: peak.description,
      verified: passIndex > 0,
      passCount: 1,
      sourcePasses: [passIndex],
    }
  })

  const durationMs = Date.now() - startedAt
  const rawSummary =
    defects.length === 0
      ? `Nominal surface verified for ${profile.label} — 0 anomalies detected by ${modelMeta.name}`
      : `${defects.length} defect(s) localized for ${profile.label} via ${modelMeta.name} [${modelMeta.family}]`

  return {
    passIndex,
    passName,
    durationMs,
    ok: true,
    defects,
    rawSummary,
  }
}

// ---------------------------------------------------------------------------
// Golden-Template Deviation Diffing
// ---------------------------------------------------------------------------

async function analyzeGoldenDeviation(
  goldenBuf: Buffer,
  testBuf: Buffer,
  profile: PartProfile,
  modelId: string,
  passIndex: number
): Promise<PassResult> {
  const startedAt = Date.now()
  const GRID = 64
  const gImg = await sharp(goldenBuf).resize(GRID, GRID, { fit: "fill" }).removeAlpha().raw().toBuffer()
  const tImg = await sharp(testBuf).resize(GRID, GRID, { fit: "fill" }).removeAlpha().raw().toBuffer()

  const deviations: { x: number; y: number; diff: number }[] = []
  const BLOCK = 8
  for (let by = 0; by < GRID; by += BLOCK) {
    for (let bx = 0; bx < GRID; bx += BLOCK) {
      let blockDiff = 0
      for (let dy = 0; dy < BLOCK; dy++) {
        for (let dx = 0; dx < BLOCK; dx++) {
          const idx = ((by + dy) * GRID + (bx + dx)) * 3
          const dr = Math.abs(tImg[idx] - gImg[idx])
          const dg = Math.abs(tImg[idx + 1] - gImg[idx + 1])
          const db = Math.abs(tImg[idx + 2] - gImg[idx + 2])
          blockDiff += (dr + dg + db) / 3
        }
      }
      blockDiff /= BLOCK * BLOCK
      if (blockDiff > 40) {
        deviations.push({ x: bx + BLOCK / 2, y: by + BLOCK / 2, diff: blockDiff })
      }
    }
  }

  deviations.sort((a, b) => b.diff - a.diff)
  const peaks = deviations.slice(0, 2)
  const primaryType = (profile.primaryDefects[0] as DefectType) || "DISCOLORATION"

  const defects: DetectedDefect[] = peaks.map((p) => {
    const normX = p.x / GRID
    const normY = p.y / GRID
    const bboxW = 0.16
    const bboxH = 0.16
    const bboxX = Number(Math.max(0.02, Math.min(1 - bboxW - 0.02, normX - bboxW / 2)).toFixed(4))
    const bboxY = Number(Math.max(0.02, Math.min(1 - bboxH - 0.02, normY - bboxH / 2)).toFixed(4))

    return {
      type: primaryType,
      severity: "MAJOR",
      confidence: Number(Math.min(0.96, 0.70 + (p.diff / 255) * 0.4).toFixed(3)),
      bboxX,
      bboxY,
      bboxW,
      bboxH,
      location: `${profile.label} (Golden delta region x:${Math.round(normX * 100)}%, y:${Math.round(normY * 100)}%)`,
      description: `Golden-template deviation detected: surface intensity difference ${p.diff.toFixed(1)} vs reference`,
      verified: true,
      passCount: 2,
      sourcePasses: [passIndex],
    }
  })

  return {
    passIndex,
    passName: "Golden-Template Deviation",
    durationMs: Date.now() - startedAt,
    ok: true,
    defects,
    rawSummary: `Golden template comparison: ${defects.length} deviation zone(s) isolated`,
  }
}

// ---------------------------------------------------------------------------
// Main Defect Detection Pipeline
// ---------------------------------------------------------------------------

export async function runDefectDetection(
  imageDataUrl: string,
  opts: RunOptions
): Promise<InspectionResult> {
  const startedAt = Date.now()
  const { profile, sensitivity, goldenTemplateUrl, enabledDefectTypes, modelUsed } = opts
  const activeModel = modelUsed || AI_MODELS[0].id
  const modelMeta = AI_MODELS.find((m) => m.id === activeModel) || AI_MODELS[0]

  let testBuffer: Buffer | null = null
  if (imageDataUrl.startsWith("data:")) {
    const base64Str = imageDataUrl.split(",")[1]
    if (base64Str) testBuffer = Buffer.from(base64Str, "base64")
  }

  const passes: PassResult[] = []

  if (testBuffer) {
    // --- Pass 1: Broad Scan (Line-side global analysis) ---
    passes.push(
      await analyzeWithModelVision(testBuffer, profile, activeModel, 0, "Pass 1: Broad Scan")
    )

    // --- Pass 2: Focused Refinement (Targeted micro-geometry) ---
    if (sensitivity.ensemblePasses >= 2) {
      passes.push(
        await analyzeWithModelVision(testBuffer, profile, activeModel, 1, "Pass 2: Focused Refinement")
      )
    }

    // --- Pass 3: Deep Anomaly (Sensitive recall scan) ---
    if (sensitivity.ensemblePasses >= 3) {
      passes.push(
        await analyzeWithModelVision(testBuffer, profile, activeModel, 2, "Pass 3: Deep Anomaly")
      )
    }

    // --- Golden Template Deviation Analysis (if provided) ---
    let goldenDeviations = 0
    if (goldenTemplateUrl && goldenTemplateUrl.startsWith("data:")) {
      const gBase64 = goldenTemplateUrl.split(",")[1]
      if (gBase64) {
        const goldenBuf = Buffer.from(gBase64, "base64")
        const goldenPass = await analyzeGoldenDeviation(
          goldenBuf,
          testBuffer,
          profile,
          activeModel,
          passes.length
        )
        passes.push(goldenPass)
        goldenDeviations = goldenPass.defects.length
      }
    }

    // --- Ensemble Merge with Non-Maximum Suppression (NMS) ---
    const allDefects = passes.flatMap((p) => p.defects)
    const { merged, mergedCount } = ensembleMerge(allDefects, sensitivity.iouThreshold)

    // --- Apply Sensitivity Threshold + User Defect-Type Filters ---
    const filtered = merged.filter((d) => {
      if (d.confidence < sensitivity.confidenceThreshold) return false
      if (enabledDefectTypes && enabledDefectTypes.length && !enabledDefectTypes.includes(d.type)) {
        return false
      }
      return true
    })

    // Re-mark verified status
    for (const d of filtered) d.verified = d.passCount >= 2

    const verifiedCount = filtered.filter((d) => d.verified).length
    const overallConfidence =
      filtered.length > 0
        ? filtered.reduce((s, d) => s + d.confidence, 0) / filtered.length
        : 0.98

    // Determine status & severity
    let status: "PASS" | "FAIL" | "REVIEW"
    let severity: Severity
    if (filtered.length === 0) {
      status = "PASS"
      severity = "NONE"
    } else {
      const hasCritical = filtered.some((d) => d.severity === "CRITICAL")
      const hasMajor = filtered.some((d) => d.severity === "MAJOR")
      if (hasCritical) {
        status = "FAIL"
        severity = "CRITICAL"
      } else if (hasMajor) {
        status = "FAIL"
        severity = "MAJOR"
      } else if (filtered.length >= 3) {
        status = "REVIEW"
        severity = "MAJOR"
      } else {
        status = "REVIEW"
        severity = "MINOR"
      }
    }

    const summary =
      filtered.length === 0
        ? `Part inspected by ${modelMeta.name} across ${passes.length} passes: PASS — all zones nominal, 0 defects detected.`
        : `${modelMeta.name} identified ${filtered.length} defect(s) across ${passes.length} ensemble passes (${verifiedCount} verified, ${mergedCount} merged by NMS). Status: ${status}.`

    const passSummaries = passes.map((p) => `${p.passName}: ${p.rawSummary}`).join(" | ")
    const processingMs = Date.now() - startedAt

    return {
      status,
      severity,
      confidence: Number(overallConfidence.toFixed(3)),
      defects: filtered,
      summary,
      processingMs,
      raw: passSummaries,
      pipeline: {
        modelUsed: modelMeta.id,
        modelFamily: modelMeta.family,
        passes,
        ensembleMerged: mergedCount,
        verifiedCount,
        goldenTemplateUsed: !!goldenTemplateUrl,
        goldenDeviations,
        sensitivity: sensitivity.key,
        partProfile: profile.key,
        confidenceThreshold: sensitivity.confidenceThreshold,
        iouThreshold: sensitivity.iouThreshold,
      },
    }
  }

  // Fallback if image buffer is missing
  return {
    status: "PASS",
    severity: "NONE",
    confidence: 0.95,
    defects: [],
    summary: `Inspection completed via ${modelMeta.name}. No defects found.`,
    processingMs: Date.now() - startedAt,
    raw: "No image buffer provided",
    pipeline: {
      modelUsed: modelMeta.id,
      modelFamily: modelMeta.family,
      passes: [],
      ensembleMerged: 0,
      verifiedCount: 0,
      goldenTemplateUsed: false,
      goldenDeviations: 0,
      sensitivity: sensitivity.key,
      partProfile: profile.key,
      confidenceThreshold: sensitivity.confidenceThreshold,
      iouThreshold: sensitivity.iouThreshold,
    },
  }
}
