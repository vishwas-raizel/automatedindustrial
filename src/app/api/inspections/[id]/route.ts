import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/inspections/[id] — single inspection with defects
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const inspection = await db.inspection.findUnique({
    where: { id },
    include: { defects: true, productionLine: true, inspector: true },
  })
  if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(inspection)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.inspection.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
