"use client"

import { useEffect, useState } from "react"
import { Users, Cpu, Shield, Server, KeyRound, Bell, Webhook, Database, GitBranch, Container, Activity, Save } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, type User, type ModelMetric } from "@/lib/api"
import { Spinner, SectionHeader } from "./shared"
import { toast } from "sonner"

const ROLE_COLOR: Record<string, string> = {
  ADMIN: "#dc2626", ENGINEER: "#b45309", INSPECTOR: "#0d9488", VIEWER: "#737373",
}

export function SettingsView() {
  const [users, setUsers] = useState<User[]>([])
  const [models, setModels] = useState<ModelMetric[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.all([api.users(), api.models()]).then(([u, m]) => {
      if (!alive) return
      setUsers(u.users)
      setModels(m.models)
      setLoading(false)
    }).catch(() => setLoading(false))
    return () => { alive = false }
  }, [])

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner className="h-6 w-6 text-amber-500" /></div>

  return (
    <div className="space-y-5">
      {/* Users & RBAC */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-amber-600" /> User Accounts & Role-Based Access</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-3">User</th>
                <th className="pb-2 pr-3">Department</th>
                <th className="pb-2 pr-3">Role</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/60 hover:bg-muted/30">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold" style={{ background: `${ROLE_COLOR[u.role]}20`, color: ROLE_COLOR[u.role] }}>
                        {u.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <div className="font-semibold">{u.name}</div>
                        <div className="text-[10px] text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground">{u.department}</td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: `${ROLE_COLOR[u.role]}20`, color: ROLE_COLOR[u.role] }}>{u.role}</span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1.5 text-xs"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {u.status}</span>
                  </td>
                  <td className="py-2.5 text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap gap-2 rounded-lg bg-muted/40 p-3 text-[11px]">
            <div className="flex items-center gap-1.5"><span className="font-semibold">RBAC Matrix:</span></div>
            <Badge variant="outline" className="border-red-500/30 text-red-600 dark:text-red-400">ADMIN · full access</Badge>
            <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">ENGINEER · models + config</Badge>
            <Badge variant="outline" className="border-teal-500/30 text-teal-600 dark:text-teal-400">INSPECTOR · run + view</Badge>
            <Badge variant="outline" className="border-muted-foreground/30">VIEWER · read-only</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Model config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Cpu className="h-4 w-4 text-amber-600" /> Active Model Configuration</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Production Model (Line-side)</Label>
              <Select defaultValue="YOLOv11-Defect">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{models.map((m) => <SelectItem key={m.id} value={m.modelName}>{m.modelName} · {m.version}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Secondary Review Model</Label>
              <Select defaultValue="RT-DETR-Defect">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{models.map((m) => <SelectItem key={m.id} value={m.modelName}>{m.modelName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Confidence Threshold (auto-fail)</Label>
              <Input type="number" defaultValue="0.85" step="0.01" min="0" max="1" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Inference Device</Label>
              <Select defaultValue="GPU-A100">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GPU-A100">NVIDIA A100 (Cloud)</SelectItem>
                  <SelectItem value="GPU-H100">NVIDIA H100 (Cloud)</SelectItem>
                  <SelectItem value="Edge-Jetson">NVIDIA Jetson Orin (Edge)</SelectItem>
                  <SelectItem value="CPU">CPU Fallback</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Max Batch Size</Label>
              <Input type="number" defaultValue="16" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div><div className="text-sm font-medium">Auto-retrain on drift</div><div className="text-[11px] text-muted-foreground">Trigger retraining when mAP drops &gt;3%</div></div>
              <Switch defaultChecked />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm font-semibold"><Webhook className="h-4 w-4 text-amber-600" /> External Integrations</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {[
              { n: "SAP ERP", s: "Connected", on: true, i: Database },
              { n: "Siemens MES (Opcenter)", s: "Connected", on: true, i: Server },
              { n: "Wonderware SCADA", s: "Connected", on: true, i: Activity },
              { n: "Microsoft Teams Alerts", s: "Webhook active", on: true, i: Bell },
              { n: "Splunk (log streaming)", s: "Disabled", on: false, i: GitBranch },
            ].map((it) => (
              <div key={it.n} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><it.i className="h-4 w-4 text-muted-foreground" /></div>
                  <div><div className="text-sm font-medium">{it.n}</div><div className="text-[10px] text-muted-foreground">{it.s}</div></div>
                </div>
                <Switch defaultChecked={it.on} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-amber-600" /> Security & Deployment</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3"><div><div className="text-sm font-medium">Two-factor authentication</div><div className="text-[11px] text-muted-foreground">Required for ADMIN & ENGINEER roles</div></div><Switch defaultChecked /></div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3"><div><div className="text-sm font-medium">API key rotation</div><div className="text-[11px] text-muted-foreground">Auto-rotate every 90 days</div></div><Switch defaultChecked /></div>
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold"><Container className="h-3.5 w-3.5 text-amber-600" /> Deployment Environment</div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <div>Runtime: <span className="font-mono text-foreground">Next.js 16</span></div>
                <div>DB: <span className="font-mono text-foreground">SQLite/Prisma</span></div>
                <div>AI: <span className="font-mono text-foreground">VLM (z-ai-sdk)</span></div>
                <div>Infra: <span className="font-mono text-foreground">Docker + Caddy</span></div>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => toast.success("Settings saved to audit trail")}><Save className="mr-2 h-3.5 w-3.5" /> Save Configuration</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
