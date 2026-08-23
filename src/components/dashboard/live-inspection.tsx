"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  ScanLine, Upload, ImageIcon, Loader2, CheckCircle2, XCircle, AlertCircle,
  Cpu, MapPin, Zap, RefreshCw, FileImage, Sparkles, Settings2, Layers,
  ShieldCheck, Target, GitCompare, Flame, Eye, BadgeCheck, Filter, Info,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { api, type Inspection, type InspectionResultExt } from "@/lib/api"
import {
  AI_MODELS, PART_CATALOG, PRODUCTION_LINES, DEFECT_TYPES, DEFECT_LIST,
  PART_PROFILES, SENSITIVITY_PRESETS, profileForPart,
  type DefectType, type Sensitivity,
} from "@/lib/defects"
import { StatusBadge, SeverityBadge, DefectTypeTag, ConfidenceBar, Spinner, fmtDateTime } from "./shared"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const SAMPLE_IMAGES = [
  { label: "Metal Casting", url: "/samples/metal-casting.jpg", profile: "casting" },
  { label: "Circuit Board", url: "/samples/circuit-board.jpg", profile: "pcb" },
  { label: "Steel Surface", url: "/samples/steel-surface.jpg", profile: "steel" },
]

const PASS_LABELS = ["Broad Scan", "Focused Refinement", "Deep Anomaly", "Golden-Template Deviation"]

type Phase = "idle" | "preview" | "scanning" | "done" | "error"

export function LiveInspectionView() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [result, setResult] = useState<Inspection | null>(null)
  const [pipeline, setPipeline] = useState<InspectionResultExt | null>(null)
  const [progress, setProgress] = useState(0)
  const [scanLine, setScanLine] = useState(0)
  const [activePass, setActivePass] = useState(0)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [showBoxes, setShowBoxes] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const goldenRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  // form
  const [partName, setPartName] = useState(PART_CATALOG[0].partName)
  const [partNumber, setPartNumber] = useState(PART_CATALOG[0].partNumber)
  const [partId, setPartId] = useState(`SN-${Math.floor(100000 + Math.random() * 899999)}`)
  const [lineCode, setLineCode] = useState(PRODUCTION_LINES[0].code)
  const [model, setModel] = useState(AI_MODELS[0].id)
  const [inspector, setInspector] = useState("Raj Singh")

  // precision controls
  const [sensitivity, setSensitivity] = useState<Sensitivity>("balanced")
  const [profileKey, setProfileKey] = useState<string>("auto")
  const [goldenFile, setGoldenFile] = useState<File | null>(null)
  const [goldenPreview, setGoldenPreview] = useState<string | null>(null)
  const [enabledTypes, setEnabledTypes] = useState<Set<DefectType>>(new Set())
  const [useTypeFilter, setUseTypeFilter] = useState(false)

  // scan line animation + active pass simulation
  useEffect(() => {
    if (phase !== "scanning") return
    const t = setInterval(() => setScanLine((p) => (p + 2) % 100), 30)
    const passes = SENSITIVITY_PRESETS[sensitivity].ensemblePasses + (goldenFile ? 1 : 0)
    const passDuration = 4000 / passes
    const p2 = setInterval(() => setActivePass((p) => Math.min(passes - 1, p + 1)), passDuration)
    return () => { clearInterval(t); clearInterval(p2) }
  }, [phase, sensitivity, goldenFile])

  // auto-set profile when part changes
  useEffect(() => {
    if (profileKey === "auto") return // keep auto
    // no-op; explicit
  }, [partNumber, profileKey])

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImageDataUrl(reader.result as string)
      setPreviewUrl(reader.result as string)
      setPhase("preview")
      setResult(null)
      setPipeline(null)
      setProgress(0)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleSample = useCallback(async (url: string, profile?: string) => {
    try {
      const r = await fetch(url)
      const blob = await r.blob()
      const reader = new FileReader()
      reader.onload = () => {
        setImageDataUrl(reader.result as string)
        setPreviewUrl(reader.result as string)
        setPhase("preview")
        setResult(null)
        setPipeline(null)
      }
      reader.readAsDataURL(blob)
      if (profile) setProfileKey(profile)
    } catch {
      toast.error("Failed to load sample image")
    }
  }, [])

  const handleGolden = useCallback((file: File | null) => {
    if (!file) {
      setGoldenFile(null)
      setGoldenPreview(null)
      return
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Golden template must be an image")
      return
    }
    setGoldenFile(file)
    const reader = new FileReader()
    reader.onload = () => setGoldenPreview(reader.result as string)
    reader.readAsDataURL(file)
  }, [])

  const toggleType = (t: DefectType) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const runInspection = useCallback(async () => {
    if (!imageDataUrl) return
    setPhase("scanning")
    setProgress(0)
    setActivePass(0)
    setResult(null)
    setPipeline(null)
    const totalPasses = SENSITIVITY_PRESETS[sensitivity].ensemblePasses + (goldenFile ? 1 : 0)
    const p = setInterval(() => setProgress((v) => Math.min(94, v + Math.random() * (8 / totalPasses))), 400)
    try {
      const blob = await (await fetch(imageDataUrl)).blob()
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" })
      const form = new FormData()
      form.append("image", file)
      form.append("partId", partId)
      form.append("partName", partName)
      form.append("partNumber", partNumber)
      const line = PRODUCTION_LINES.find((l) => l.code === lineCode)
      form.append("productionLineCode", line ? line.code : "")
      form.append("modelUsed", model)
      form.append("inspectorName", inspector)
      form.append("sensitivity", sensitivity)
      if (profileKey !== "auto") form.append("partProfile", profileKey)
      if (goldenFile) form.append("goldenTemplate", goldenFile)
      if (useTypeFilter && enabledTypes.size > 0) {
        form.append("enabledDefectTypes", Array.from(enabledTypes).join(","))
      }

      const j = await api.inspect(form)
      clearInterval(p)
      setProgress(100)
      if (j.error) {
        setPhase("error")
        toast.error(j.error)
      } else {
        setResult(j.inspection)
        setPipeline(j.result || null)
        setPhase("done")
        const verified = j.result?.pipeline?.verifiedCount ?? 0
        toast.success(`Inspection ${j.inspection.inspectionCode} complete — ${j.inspection.status} (${j.inspection.defectCount} defects, ${verified} verified)`)
      }
    } catch (e: any) {
      clearInterval(p)
      setPhase("error")
      toast.error(e?.message || "Inspection failed")
    }
  }, [imageDataUrl, partId, partName, partNumber, lineCode, model, inspector, sensitivity, profileKey, goldenFile, useTypeFilter, enabledTypes])

  const reset = () => {
    setPhase("idle")
    setPreviewUrl(null)
    setImageDataUrl(null)
    setResult(null)
    setPipeline(null)
    setProgress(0)
    setActivePass(0)
    setPartId(`SN-${Math.floor(100000 + Math.random() * 899999)}`)
  }

  const activeProfile = profileKey === "auto" ? profileForPart(partNumber) : PART_PROFILES.find((p) => p.key === profileKey) || PART_PROFILES[8]
  const sensConfig = SENSITIVITY_PRESETS[sensitivity]
  const totalPasses = sensConfig.ensemblePasses + (goldenFile ? 1 : 0)

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      {/* Left: capture / preview */}
      <div className="xl:col-span-3">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ScanLine className="h-4 w-4 text-amber-600" /> Inspection Capture
            </CardTitle>
            {phase === "done" && result && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
                  <button onClick={() => setShowBoxes(true)} className={cn("rounded px-2 py-1 text-[10px] font-semibold", showBoxes ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                    <Eye className="h-3 w-3 inline mr-1" />Boxes
                  </button>
                  <button onClick={() => setShowHeatmap(!showHeatmap)} className={cn("rounded px-2 py-1 text-[10px] font-semibold", showHeatmap ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                    <Flame className="h-3 w-3 inline mr-1" />Heatmap
                  </button>
                </div>
                <Button variant="outline" size="sm" className="h-7" onClick={reset}>
                  <RefreshCw className="mr-1.5 h-3 w-3" /> New
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {phase === "idle" && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                className={cn(
                  "relative flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed transition-colors",
                  dragOver ? "border-amber-500 bg-amber-500/5" : "border-border bg-muted/30"
                )}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-700/20 text-amber-600">
                  <Upload className="h-7 w-7" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold">Drop part image here</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">or click to browse · JPG, PNG, WebP up to 10MB</div>
                </div>
                <Button onClick={() => fileRef.current?.click()} variant="outline" size="sm">
                  <FileImage className="mr-2 h-4 w-4" /> Select Image
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

                <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
                    <Sparkles className="h-3 w-3 text-amber-500" /> or try a sample:
                    {SAMPLE_IMAGES.map((s) => (
                      <button key={s.url} onClick={() => handleSample(s.url, s.profile)} className="font-semibold text-amber-600 hover:underline dark:text-amber-400">
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(phase === "preview" || phase === "scanning" || phase === "done" || phase === "error") && previewUrl && (
              <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
                { }
                <img src={previewUrl} alt="Inspection capture" className="h-full w-full object-contain" />

                {/* grid overlay */}
                <div className="pointer-events-none absolute inset-0 bg-grid-dark opacity-30" />

                {/* heatmap overlay */}
                {phase === "done" && showHeatmap && result && result.defects.length > 0 && (
                  <div className="pointer-events-none absolute inset-0">
                    {result.defects.map((d, i) => {
                      const conf = d.confidence
                      return (
                        <div
                          key={i}
                          className="absolute rounded-full blur-2xl"
                          style={{
                            left: `${(d.bboxX + d.bboxW / 2) * 100}%`,
                            top: `${(d.bboxY + d.bboxH / 2) * 100}%`,
                            width: `${Math.max(d.bboxW, 0.15) * 100}%`,
                            height: `${Math.max(d.bboxH, 0.15) * 100}%`,
                            transform: "translate(-50%, -50%)",
                            background: `radial-gradient(circle, rgba(220,38,38,${conf * 0.6}) 0%, rgba(234,88,12,${conf * 0.3}) 50%, transparent 70%)`,
                          }}
                        />
                      )
                    })}
                  </div>
                )}

                {/* scanning line */}
                {phase === "scanning" && (
                  <>
                    <div className="absolute inset-x-0 h-0.5 bg-amber-400 shadow-[0_0_12px_2px_rgba(251,191,36,0.7)]" style={{ top: `${scanLine}%` }} />
                    <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent" />
                    <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-semibold text-amber-400 backdrop-blur">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Ensemble pass {activePass + 1}/{totalPasses}: {PASS_LABELS[activePass] || "Analyzing"}…
                    </div>
                  </>
                )}

                {/* bounding boxes */}
                {phase === "done" && showBoxes && result?.defects.map((d, i) => {
                  const m = DEFECT_TYPES[d.type as keyof typeof DEFECT_TYPES] || { color: "#dc2626", label: d.type }
                  const left = d.bboxX * 100, top = d.bboxY * 100, w = d.bboxW * 100, h = d.bboxH * 100
                  const verified = d.location?.includes("[verified]") || d.description?.includes("confirmed by")
                  return (
                    <div key={i} className="absolute border-2" style={{ left: `${left}%`, top: `${top}%`, width: `${w}%`, height: `${h}%`, borderColor: m.color, boxShadow: `0 0 0 1px rgba(0,0,0,0.4), 0 0 14px ${m.color}55` }}>
                      <span className="absolute -top-5 left-0 flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ background: m.color }}>
                        {m.label} · {(d.confidence * 100).toFixed(0)}%
                        {verified && <BadgeCheck className="h-2.5 w-2.5" />}
                      </span>
                    </div>
                  )
                })}

                {/* result badge */}
                {phase === "done" && result && (
                  <div className="absolute right-3 top-3 flex items-center gap-2 rounded-lg bg-black/70 px-3 py-1.5 backdrop-blur">
                    {result.status === "PASS" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : result.status === "REVIEW" ? <AlertCircle className="h-4 w-4 text-amber-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
                    <span className="text-sm font-bold text-white">{result.status}</span>
                  </div>
                )}

                {phase === "error" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                    <div className="text-center">
                      <XCircle className="mx-auto h-10 w-10 text-red-400" />
                      <div className="mt-2 text-sm font-semibold text-white">Analysis failed</div>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => setPhase("preview")}>Retry</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {phase === "scanning" && (
              <div className="mt-3 space-y-2">
                {/* pass indicators */}
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: totalPasses }).map((_, i) => (
                    <div key={i} className="flex-1">
                      <div className={cn("h-1.5 rounded-full transition-colors", i < activePass ? "bg-emerald-500" : i === activePass ? "bg-amber-500" : "bg-muted")} />
                      <div className={cn("mt-1 text-center text-[9px] font-semibold", i <= activePass ? "text-foreground" : "text-muted-foreground")}>
                        {PASS_LABELS[i] || `Pass ${i + 1}`}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3" /> {model} · {activeProfile.label}</span>
                  <span className="font-mono">{progress.toFixed(0)}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            )}

            {phase === "preview" && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Running <strong className="text-foreground">{totalPasses} ensemble passes</strong> with <strong className="text-foreground">{activeProfile.label}</strong> profile · {sensConfig.label} sensitivity
                </div>
                <Button onClick={runInspection} className="bg-gradient-to-r from-amber-600 to-orange-700 text-white hover:from-amber-700 hover:to-orange-800">
                  <Zap className="mr-2 h-4 w-4" /> Run Precision Inspection
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline visualization (when done) */}
        {phase === "done" && pipeline && (
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4 text-amber-600" /> Detection Pipeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* pipeline stats */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <PipelineStat icon={Layers} label="Ensemble Passes" value={String(pipeline.pipeline.passes.length)} color="#b45309" />
                <PipelineStat icon={GitCompare} label="NMS Merged" value={String(pipeline.pipeline.ensembleMerged)} color="#0d9488" />
                <PipelineStat icon={BadgeCheck} label="Verified" value={String(pipeline.pipeline.verifiedCount)} color="#16a34a" />
                <PipelineStat icon={Target} label="Conf. Threshold" value={`${Math.round(pipeline.pipeline.confidenceThreshold * 100)}%`} color="#ea580c" />
              </div>

              {/* per-pass breakdown */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Per-Pass Breakdown</div>
                {pipeline.pipeline.passes.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                    <div className={cn("flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold", p.ok ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-destructive/15 text-destructive")}>
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{p.passName}</span>
                        {p.ok ? <BadgeCheck className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-destructive" />}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">{p.rawSummary}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold tabular-nums">{p.defects.length}</div>
                      <div className="text-[9px] text-muted-foreground">{p.durationMs}ms</div>
                    </div>
                  </div>
                ))}
              </div>

              {pipeline.pipeline.goldenTemplateUsed && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-[11px]">
                  <GitCompare className="h-3.5 w-3.5 text-amber-600" />
                  <span>Golden-template deviation analysis found <strong className="text-foreground">{pipeline.pipeline.goldenDeviations}</strong> deviation(s) vs the reference part.</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right: config + results */}
      <div className="space-y-4 xl:col-span-2">
        {/* Precision controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4 text-amber-600" /> Precision Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Sensitivity */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Detection Sensitivity</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["strict", "balanced", "sensitive"] as Sensitivity[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSensitivity(s)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-center transition-all",
                      sensitivity === s
                        ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/20"
                    )}
                  >
                    <div className="text-xs font-bold">{SENSITIVITY_PRESETS[s].label}</div>
                    <div className="text-[9px] opacity-70">{SENSITIVITY_PRESETS[s].ensemblePasses} passes</div>
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground">{sensConfig.description}</div>
            </div>

            {/* Part profile */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Part Inspection Profile</Label>
              <Select value={profileKey} onValueChange={setProfileKey}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect ({profileForPart(partNumber).label})</SelectItem>
                  {PART_PROFILES.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="rounded-lg bg-muted/40 p-2 text-[10px] text-muted-foreground">
                <div className="font-semibold text-foreground/80">Focus: {activeProfile.focusAreas.slice(0, 90)}…</div>
                <div className="mt-0.5">Criteria: {activeProfile.acceptanceCriteria.slice(0, 80)}…</div>
              </div>
            </div>

            {/* Golden template */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Golden-Template Comparison</Label>
                <Switch checked={!!goldenFile} onCheckedChange={(v) => !v && handleGolden(null)} />
              </div>
              {goldenFile ? (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
                  {goldenPreview && <img src={goldenPreview} alt="golden" className="h-10 w-10 rounded object-cover" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold">{goldenFile.name}</div>
                    <div className="text-[10px] text-muted-foreground">Reference part loaded</div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleGolden(null)}><XCircle className="h-3.5 w-3.5" /></Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="h-8 w-full text-xs" onClick={() => goldenRef.current?.click()}>
                  <GitCompare className="mr-1.5 h-3 w-3" /> Upload Reference (Golden) Part
                </Button>
              )}
              <input ref={goldenRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleGolden(f) }} />
            </div>

            {/* Defect type filter */}
            <Accordion type="single" collapsible>
              <AccordionItem value="types" className="border-0">
                <AccordionTrigger className="py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3 w-3" /> Defect Type Filter
                    <Switch checked={useTypeFilter} onCheckedChange={setUseTypeFilter} onClick={(e) => e.stopPropagation()} />
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-wrap gap-1">
                    {DEFECT_LIST.map((d) => {
                      const on = !useTypeFilter || enabledTypes.has(d.key)
                      return (
                        <button
                          key={d.key}
                          disabled={!useTypeFilter}
                          onClick={() => toggleType(d.key)}
                          className={cn(
                            "rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-all",
                            on ? "border-current/30" : "border-border opacity-40",
                            useTypeFilter && "cursor-pointer"
                          )}
                          style={{ borderColor: `${d.color}40`, background: `${d.color}14`, color: d.color }}
                        >
                          {d.label}
                        </button>
                      )
                    })}
                  </div>
                  {useTypeFilter && (
                    <div className="mt-2 flex gap-2">
                      <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setEnabledTypes(new Set(DEFECT_LIST.map((d) => d.key)))}>Select all</Button>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setEnabledTypes(new Set())}>Clear</Button>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Part metadata */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Settings2 className="h-4 w-4 text-amber-600" /> Part Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Part</Label>
                <Select value={partNumber} onValueChange={(v) => { const p = PART_CATALOG.find((x) => x.partNumber === v)!; setPartNumber(v); setPartName(p.partName); setProfileKey("auto") }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PART_CATALOG.map((p) => <SelectItem key={p.partNumber} value={p.partNumber}>{p.partName} · {p.partNumber}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Serial ID</Label>
                <Input value={partId} onChange={(e) => setPartId(e.target.value)} className="h-9 font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Line</Label>
                <Select value={lineCode} onValueChange={setLineCode}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCTION_LINES.map((l) => <SelectItem key={l.code} value={l.code}>{l.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">AI Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="font-semibold">{m.name}</span>{" "}
                        <span className="text-[10px] text-muted-foreground">({m.family})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Inspector</Label>
                <Select value={inspector} onValueChange={setInspector}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Raj Singh">Raj Singh</SelectItem>
                    <SelectItem value="Mei Chen">Mei Chen</SelectItem>
                    <SelectItem value="Alex Kovacs">Alex Kovacs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {phase === "done" && result && (
          <Card className="border-amber-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-semibold">
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Detection Results</span>
                <span className="font-mono text-xs text-muted-foreground">{result.inspectionCode}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</div>
                  <div className="mt-1"><StatusBadge status={result.status} /></div>
                </div>
                <div className="rounded-lg border border-border p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Severity</div>
                  <div className="mt-1"><SeverityBadge severity={result.severity} /></div>
                </div>
                <div className="rounded-lg border border-border p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Defects</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">{result.defectCount}</div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-muted-foreground">Overall Confidence</span>
                  <span className="font-mono font-bold">{(result.confidence * 100).toFixed(1)}%</span>
                </div>
                <ConfidenceBar value={result.confidence} />
                <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> {result.processingMs}ms total</span>
                  <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> {result.inferenceDevice}</span>
                  <span>{fmtDateTime(result.createdAt)}</span>
                </div>
              </div>

              {result.notes && (
                <div className="rounded-lg bg-muted/50 p-2.5 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Summary: </span>{result.notes}
                </div>
              )}

              {result.defects.length > 0 ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Detected Defects</div>
                    {pipeline && pipeline.pipeline.verifiedCount > 0 && (
                      <Badge variant="outline" className="border-emerald-500/30 text-[10px] text-emerald-600 dark:text-emerald-400">
                        <BadgeCheck className="mr-1 h-2.5 w-2.5" /> {pipeline.pipeline.verifiedCount} verified
                      </Badge>
                    )}
                  </div>
                  <div className="scrollbar-industrial max-h-[300px] space-y-2 overflow-y-auto pr-1">
                    {result.defects.map((d, i) => {
                      const m = DEFECT_TYPES[d.type as keyof typeof DEFECT_TYPES] || { label: d.type, color: "#dc2626" }
                      const verified = d.location?.includes("[verified]") || d.description?.includes("confirmed by")
                      return (
                        <div key={i} className="rounded-lg border border-border p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <DefectTypeTag type={d.type} />
                              {verified && <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />}
                            </div>
                            <SeverityBadge severity={d.severity} />
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {d.location?.replace("[verified]", "").trim()}
                          </div>
                          <div className="mt-1 text-[11px] text-foreground/80">{d.description}</div>
                          <div className="mt-1.5"><ConfidenceBar value={d.confidence} /></div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="mx-auto mb-1 h-5 w-5" />
                  No defects detected across {pipeline?.pipeline.passes.length || 1} ensemble passes — part passed inspection.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {phase !== "done" && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <div className="text-sm font-semibold text-muted-foreground">Awaiting inspection</div>
              <div className="mt-1 text-xs text-muted-foreground/70">Upload an image, tune precision controls, and run analysis.</div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function PipelineStat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" style={{ color }} /> {label}
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums" style={{ color }}>{value}</div>
    </div>
  )
}
