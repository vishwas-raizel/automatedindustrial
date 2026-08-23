// Client-side API helpers and shared types for the industrial dashboard.

export interface Kpis {
  total: number
  passed: number
  failed: number
  review: number
  passRate: number
  avgConfidence: number
  avgLatency: number
  totalDefects: number
  criticalCount: number
}

export interface DefectDistItem { name: string; key: string; value: number; color: string }
export interface TrendItem { date: string; pass: number; fail: number; review: number; defects: number }
export interface LinePerfItem { code: string; line: string; total: number; pass: number; fail: number; passRate: number }
export interface PartPerfItem { partNumber: string; part: string; total: number; fail: number; defectRate: number }
export interface ModelMetric {
  id: string; modelName: string; version: string; map50: number; map5095: number;
  precision: number; recall: number; f1: number; inferenceMs: number; paramsMillion: number;
  dataset: string; status: string; evaluatedAt: string;
}
export interface CriticalItem {
  id: string; code: string; part: string; partNumber: string; status: string; severity: string;
  confidence: number; defectCount: number; line?: string; createdAt: string;
  defects: { type: string; severity: string; confidence: number; location: string }[]
}

export interface Analytics {
  windowDays: number
  kpis: Kpis
  defectDistribution: DefectDistItem[]
  severityDistribution: { NONE: number; MINOR: number; MAJOR: number; CRITICAL: number }
  trend: TrendItem[]
  linePerformance: LinePerfItem[]
  partPerformance: PartPerfItem[]
  recentCritical: CriticalItem[]
  models: ModelMetric[]
}

export interface Defect {
  id: string; inspectionId: string; type: string; severity: string; confidence: number;
  bboxX: number; bboxY: number; bboxW: number; bboxH: number; location: string; description: string; createdAt: string;
}

// Precision pipeline metadata returned by the ensemble VLM detection
export interface PassInfo {
  passIndex: number; passName: string; defects: any[]; rawSummary: string; durationMs: number; ok: boolean;
}
export interface PipelineInfo {
  passes: PassInfo[]
  ensembleMerged: number
  verifiedCount: number
  goldenTemplateUsed: boolean
  goldenDeviations: number
  sensitivity: string
  partProfile: string
  confidenceThreshold: number
  iouThreshold: number
}
export interface InspectionResultExt {
  status: "PASS" | "FAIL" | "REVIEW"
  severity: string
  confidence: number
  defects: any[]
  summary: string
  processingMs: number
  raw: string
  pipeline: PipelineInfo
}
export interface Inspection {
  id: string; inspectionCode: string; partId: string; partName: string; partNumber: string;
  productionLineId: string | null; inspectorId: string | null; modelUsed: string;
  imageUrl: string | null; thumbnail: string | null; status: string; severity: string;
  confidence: number; defectCount: number; processingMs: number; inferenceDevice: string;
  notes: string | null; rawAnalysis: string | null; createdAt: string; updatedAt: string;
  defects: Defect[]
  productionLine?: { id: string; code: string; name: string; facility: string } | null
  inspector?: { id: string; name: string; role: string } | null
}

export interface AuditLog {
  id: string; userId: string | null; userName: string; action: string; resource: string;
  resourceId: string | null; details: string | null; ipAddress: string; severity: string; timestamp: string;
}

export interface User {
  id: string; email: string; name: string; role: string; department: string; status: string; createdAt: string;
}

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

export const api = {
  seed: () => jget<{ ok: boolean; skipped?: boolean; seeded?: any }>("/api/seed").then((_) => fetch("/api/seed", { method: "POST" }).then((r) => r.json())),
  seedStatus: () => jget<{ ok: boolean; seeded?: any; skipped?: boolean }>("/api/seed").catch(() => ({ ok: false })),
  inspect: (form: FormData) =>
    fetch("/api/inspect", { method: "POST", body: form }).then((r) => r.json()),
  inspections: (params: Record<string, string | number>) => {
    const q = new URLSearchParams(params as any).toString()
    return jget<{ items: Inspection[]; total: number; page: number; pageSize: number; totalPages: number }>(`/api/inspections?${q}`)
  },
  inspection: (id: string) => jget<Inspection>(`/api/inspections/${id}`),
  analytics: (days = 30) => jget<Analytics>(`/api/analytics?days=${days}`),
  audit: (params: Record<string, string | number>) => {
    const q = new URLSearchParams(params as any).toString()
    return jget<{ items: AuditLog[]; total: number; page: number; pageSize: number; totalPages: number }>(`/api/audit?${q}`)
  },
  models: () => jget<{ models: ModelMetric[] }>("/api/models"),
  users: () => jget<{ users: User[] }>("/api/users"),
}
