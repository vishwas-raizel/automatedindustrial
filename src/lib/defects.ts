// Industrial Defect Taxonomy & domain constants
// Central definition of defect types, severities, statuses, models, and colors

export type DefectType =
  | "CRACK"
  | "SCRATCH"
  | "DENT"
  | "CORROSION"
  | "DISCOLORATION"
  | "BURR"
  | "POROSITY"
  | "MISALIGNMENT"
  | "CONTAMINATION"
  | "WARPING"
  | "SHORT_CIRCUIT"
  | "MISSING_COMPONENT"

export type Severity = "NONE" | "MINOR" | "MAJOR" | "CRITICAL"
export type InspectionStatus = "PASS" | "FAIL" | "REVIEW" | "PENDING"
export type UserRole = "ADMIN" | "ENGINEER" | "INSPECTOR" | "VIEWER"

export interface DefectMeta {
  key: DefectType
  label: string
  description: string
  color: string // hex
  category: "Surface" | "Structural" | "Geometric" | "Electrical" | "Material"
}

// Color palette avoids blue/indigo — uses amber/crimson/emerald/slate industrial tones
export const DEFECT_TYPES: Record<DefectType, DefectMeta> = {
  CRACK: { key: "CRACK", label: "Crack", description: "Surface or structural fracture line", color: "#dc2626", category: "Structural" },
  SCRATCH: { key: "SCRATCH", label: "Scratch", description: "Surface scoring or abrasion mark", color: "#f59e0b", category: "Surface" },
  DENT: { key: "DENT", label: "Dent", description: "Physical indentation or depression", color: "#b45309", category: "Geometric" },
  CORROSION: { key: "CORROSION", label: "Corrosion", description: "Oxidation, rust, or chemical degradation", color: "#7c2d12", category: "Material" },
  DISCOLORATION: { key: "DISCOLORATION", label: "Discoloration", description: "Inconsistent color or surface finish", color: "#d97706", category: "Surface" },
  BURR: { key: "BURR", label: "Burr", description: "Rough edge or material protrusion", color: "#92400e", category: "Geometric" },
  POROSITY: { key: "POROSITY", label: "Porosity", description: "Surface voids or gas pockets", color: "#ea580c", category: "Material" },
  MISALIGNMENT: { key: "MISALIGNMENT", label: "Misalignment", description: "Component positioning deviation", color: "#0d9488", category: "Geometric" },
  CONTAMINATION: { key: "CONTAMINATION", label: "Contamination", description: "Foreign material or residue", color: "#65a30d", category: "Material" },
  WARPING: { key: "WARPING", label: "Warping", description: "Dimensional deformation or bowing", color: "#ca8a04", category: "Geometric" },
  SHORT_CIRCUIT: { key: "SHORT_CIRCUIT", label: "Short Circuit", description: "Unintended electrical connection", color: "#be123c", category: "Electrical" },
  MISSING_COMPONENT: { key: "MISSING_COMPONENT", label: "Missing Component", description: "Absent or uninstalled part", color: "#9f1239", category: "Electrical" },
}

export const DEFECT_LIST = Object.values(DEFECT_TYPES)

export const SEVERITY_META: Record<Severity, { label: string; color: string; bg: string; weight: number }> = {
  NONE: { label: "None", color: "#16a34a", bg: "rgba(22,163,74,0.12)", weight: 0 },
  MINOR: { label: "Minor", color: "#ca8a04", bg: "rgba(202,138,4,0.14)", weight: 1 },
  MAJOR: { label: "Major", color: "#ea580c", bg: "rgba(234,88,12,0.14)", weight: 2 },
  CRITICAL: { label: "Critical", color: "#dc2626", bg: "rgba(220,38,38,0.16)", weight: 3 },
}

export const STATUS_META: Record<InspectionStatus, { label: string; color: string; bg: string }> = {
  PASS: { label: "Pass", color: "#16a34a", bg: "rgba(22,163,74,0.12)" },
  FAIL: { label: "Fail", color: "#dc2626", bg: "rgba(220,38,38,0.12)" },
  REVIEW: { label: "Review", color: "#ca8a04", bg: "rgba(202,138,4,0.14)" },
  PENDING: { label: "Pending", color: "#737373", bg: "rgba(115,115,115,0.12)" },
}

export const AI_MODELS = [
  { id: "YOLOv11-Defect", name: "YOLOv11-Defect", family: "YOLO", version: "v11n", paramsM: 2.6, status: "PRODUCTION", desc: "Real-time one-stage detector optimized for edge deployment" },
  { id: "YOLOv8-Defect", name: "YOLOv8-Defect", family: "YOLO", version: "v8m", paramsM: 25.9, status: "PRODUCTION", desc: "Balanced accuracy/speed for line-side GPU inference" },
  { id: "RT-DETR-Defect", name: "RT-DETR-Defect", family: "DETR", version: "r18", paramsM: 20.0, status: "STAGING", desc: "Transformer-based detector, strong on small defects" },
  { id: "EfficientNet-B7", name: "EfficientNet-B7", family: "CNN", version: "b7", paramsM: 66.3, status: "EXPERIMENTAL", desc: "Classification backbone for defect categorization" },
  { id: "VisionTransformer", name: "VisionTransformer", family: "ViT", version: "vit-l/16", paramsM: 304.0, status: "EXPERIMENTAL", desc: "Large ViT for offline high-precision re-inspection" },
]

export const PART_CATALOG = [
  { partNumber: "ALC-4045", partName: "Aluminum Engine Block", productType: "Aluminum Casting" },
  { partNumber: "PCB-MB-7A", partName: "Motherboard PCB Assembly", productType: "PCB Assembly" },
  { partNumber: "STL-BR-90", partName: "Steel Brake Rotor", productType: "Steel Forging" },
  { partNumber: "PLT-PN-22", partName: "Composite Panel Sheet", productType: "Composite Sheet" },
  { partNumber: "COP-HS-15", partName: "Copper Heat Sink", productType: "Copper Extrusion" },
  { partNumber: "TIT-BLD-3", partName: "Titanium Turbine Blade", productType: "Titanium Forging" },
  { partNumber: "PLA-ENC-8", partName: "Plastic Enclosure Housing", productType: "Injection Molded" },
  { partNumber: "GLS-LNS-4", partName: "Optical Glass Lens", productType: "Precision Glass" },
]

export const PRODUCTION_LINES = [
  { code: "PL-A01", name: "Line A01 — Engine Blocks", facility: "Plant 1 — Detroit", productType: "Aluminum Casting", shift: "Day", throughput: 240 },
  { code: "PL-B02", name: "Line B02 — PCB Assembly", facility: "Plant 1 — Detroit", productType: "PCB Assembly", shift: "Day", throughput: 1800 },
  { code: "PL-C03", name: "Line C03 — Brake Systems", facility: "Plant 2 — Stuttgart", productType: "Steel Forging", shift: "Night", throughput: 320 },
  { code: "PL-D04", name: "Line D04 — Composites", facility: "Plant 2 — Stuttgart", productType: "Composite Sheet", shift: "Day", throughput: 95 },
  { code: "PL-E05", name: "Line E05 — Heat Sinks", facility: "Plant 3 — Shenzhen", productType: "Copper Extrusion", shift: "Night", throughput: 1400 },
]

export function severityFromConfidence(conf: number): Severity {
  if (conf >= 0.85) return "CRITICAL"
  if (conf >= 0.7) return "MAJOR"
  if (conf >= 0.5) return "MINOR"
  return "MINOR"
}

export function statusFromDefects(defects: { severity: string }[]): { status: InspectionStatus; severity: Severity } {
  if (defects.length === 0) return { status: "PASS", severity: "NONE" }
  const hasCritical = defects.some((d) => d.severity === "CRITICAL")
  const hasMajor = defects.some((d) => d.severity === "MAJOR")
  if (hasCritical) return { status: "FAIL", severity: "CRITICAL" }
  if (hasMajor) return { status: "FAIL", severity: "MAJOR" }
  if (defects.length >= 3) return { status: "REVIEW", severity: "MAJOR" }
  return { status: "REVIEW", severity: "MINOR" }
}

// ---- Part-type detection profiles ------------------------------------------
// Each profile tailors the inspection prompt to the part's material/process,
// focusing the VLM on the defect vocabulary and inspection criteria relevant
// to that manufacturing method. This materially improves precision.

export interface PartProfile {
  key: string
  label: string
  productType: string
  // Defects most relevant to this part type (focused vocabulary)
  primaryDefects: DefectType[]
  // Inspection focus areas the VLM should pay attention to
  focusAreas: string
  // Tolerances / acceptance criteria context
  acceptanceCriteria: string
}

export const PART_PROFILES: PartProfile[] = [
  {
    key: "casting",
    label: "Aluminum / Metal Casting",
    productType: "Aluminum Casting",
    primaryDefects: ["POROSITY", "CRACK", "SHRINKAGE" as DefectType, "INCLUSION" as DefectType, "DISCOLORATION", "WARPING", "BURR"],
    focusAreas: "surface porosity (gas pockets, pinholes), shrinkage cavities near thick sections, cold shuts, oxide inclusions, flash/burr at parting lines, dimensional warping, heat-treat discoloration",
    acceptanceCriteria: "No surface-breaking cracks or porosity > 0.5mm. Shrinkage in non-critical zones only. Burr height < 0.2mm.",
  },
  {
    key: "pcb",
    label: "PCB / Electronics Assembly",
    productType: "PCB Assembly",
    primaryDefects: ["SHORT_CIRCUIT", "MISSING_COMPONENT", "MISALIGNMENT", "DISCOLORATION", "CONTAMINATION", "CRACK"],
    focusAreas: "solder bridges between pads, missing/tombstoned components, misaligned ICs, cold or cracked solder joints, burnt/discolored areas, flux residue contamination, lifted pads, hairline traces",
    acceptanceCriteria: "Zero solder bridges. All BOM components present and aligned within 0.1mm. No cold joints. Flux residue < 5%.",
  },
  {
    key: "steel",
    label: "Steel / Forged Metal",
    productType: "Steel Forging",
    primaryDefects: ["CRACK", "SCRATCH", "DENT", "CORROSION", "DISCOLORATION", "BURR"],
    focusAreas: "surface and edge cracks, forging laps/folds, scratch scores, dent indentations, rust/pitting corrosion, heat-treat scale, machining burrs on cut edges",
    acceptanceCriteria: "No cracks of any length. Scratch depth < 0.05mm. No active corrosion. Dent diameter < 1mm in non-functional zones.",
  },
  {
    key: "composite",
    label: "Composite / Sheet Panel",
    productType: "Composite Sheet",
    primaryDefects: ["WARPING", "DISCOLORATION", "DELAMINATION" as DefectType, "POROSITY", "CONTAMINATION", "CRACK"],
    focusAreas: "delamination or fiber pull-out, warp/bow deviation, resin-rich/starved zones, discoloration from uneven cure, embedded foreign material, surface blistering",
    acceptanceCriteria: "No delamination. Warp < 0.5mm/m. No blisters. Cure discoloration within spec band.",
  },
  {
    key: "extrusion",
    label: "Copper / Extruded Metal",
    productType: "Copper Extrusion",
    primaryDefects: ["SCRATCH", "DISCOLORATION", "CORROSION", "BURR", "WARPING", "MISALIGNMENT"],
    focusAreas: "die lines and longitudinal scratches, oxidation/tarnish discoloration, pitting corrosion, fin burrs, bow/twist deviation, segment misalignment",
    acceptanceCriteria: "Die line depth < 0.02mm. Tarnish within color spec. Bow < 0.3mm/m. No pitting in contact zones.",
  },
  {
    key: "titanium",
    label: "Titanium / Precision Forging",
    productType: "Titanium Forging",
    primaryDefects: ["CRACK", "POROSITY", "DISCOLORATION", "SCRATCH", "DENT"],
    focusAreas: "alpha-case cracks, micro-porosity, foreign material contamination, surface scratches and handling dents, heat-tint discoloration indicating over-temp",
    acceptanceCriteria: "Zero cracks. Porosity < 0.1mm. No alpha-case. Handling damage not in critical fillet radii.",
  },
  {
    key: "injection",
    label: "Plastic / Injection Molded",
    productType: "Injection Molded",
    primaryDefects: ["WARPING", "DISCOLORATION", "BURR", "POROSITY", "DENT", "MISALIGNMENT"],
    focusAreas: "sink marks and warp, short shots, flash at parting lines, burn marks/discoloration, vacuum voids, ejector-pin dents, mold-half misalignment",
    acceptanceCriteria: "Warp < 0.3mm. No flash. Sink depth < 0.1mm. No burn marks.",
  },
  {
    key: "glass",
    label: "Optical / Precision Glass",
    productType: "Precision Glass",
    primaryDefects: ["SCRATCH", "CRACK", "POROSITY", "DISCOLORATION", "CONTAMINATION"],
    focusAreas: "surface scratches and digs, edge chips and cracks, bubbles/inclusions, coating discoloration or streaks, dust and fingerprint contamination",
    acceptanceCriteria: "Scratch length < 3mm in zone A. No edge chips > 0.2mm. Bubble < 0.05mm. Zero contamination.",
  },
  {
    key: "general",
    label: "General / Auto-detect",
    productType: "Unknown",
    primaryDefects: ["CRACK", "SCRATCH", "DENT", "CORROSION", "DISCOLORATION", "BURR", "POROSITY", "MISALIGNMENT", "CONTAMINATION", "WARPING", "SHORT_CIRCUIT", "MISSING_COMPONENT"],
    focusAreas: "any visible surface, structural, geometric, material, or electrical defect",
    acceptanceCriteria: "industry-standard AOI pass/fail thresholds",
  },
]

export function profileForPart(partNumber: string, productType?: string): PartProfile {
  const pt = (productType || "").toLowerCase()
  const byType = PART_PROFILES.find((p) => pt.includes(p.productType.toLowerCase().split(" ")[0].toLowerCase()))
  if (byType) return byType
  const pn = partNumber.toLowerCase()
  if (pn.startsWith("alc")) return PART_PROFILES[0]
  if (pn.startsWith("pcb")) return PART_PROFILES[1]
  if (pn.startsWith("stl")) return PART_PROFILES[2]
  if (pn.startsWith("plt")) return PART_PROFILES[3]
  if (pn.startsWith("cop")) return PART_PROFILES[4]
  if (pn.startsWith("tit")) return PART_PROFILES[5]
  if (pn.startsWith("pla")) return PART_PROFILES[6]
  if (pn.startsWith("gls")) return PART_PROFILES[7]
  return PART_PROFILES[8]
}

// ---- Sensitivity presets ---------------------------------------------------
// Control how aggressively the pipeline filters/retains detections.

export type Sensitivity = "strict" | "balanced" | "sensitive"

export interface SensitivityConfig {
  key: Sensitivity
  label: string
  confidenceThreshold: number // reject detections below this
  iouThreshold: number // NMS dedup threshold (higher = less aggressive merge)
  ensemblePasses: number // how many VLM passes to run
  description: string
}

export const SENSITIVITY_PRESETS: Record<Sensitivity, SensitivityConfig> = {
  strict: {
    key: "strict",
    label: "Strict",
    confidenceThreshold: 0.75,
    iouThreshold: 0.4,
    ensemblePasses: 2,
    description: "High precision — only high-confidence detections reported. Minimizes false positives. Use for safety-critical parts.",
  },
  balanced: {
    key: "balanced",
    label: "Balanced",
    confidenceThreshold: 0.55,
    iouThreshold: 0.5,
    ensemblePasses: 2,
    description: "Recommended default. Tuned trade-off between precision and recall for general production.",
  },
  sensitive: {
    key: "sensitive",
    label: "Sensitive",
    confidenceThreshold: 0.35,
    iouThreshold: 0.6,
    ensemblePasses: 3,
    description: "Maximum recall — flags any plausible defect. Use when missing a defect is costly; expect more review items.",
  },
}
