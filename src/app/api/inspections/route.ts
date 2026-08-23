import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/inspections — paginated, filtered list
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") || undefined
  const severity = searchParams.get("severity") || undefined
  const model = searchParams.get("model") || undefined
  const line = searchParams.get("line") || undefined
  const search = searchParams.get("search") || undefined
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const page = Math.max(1, Number(searchParams.get("page") || 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20)))

  const where: any = {}
  if (status && status !== "ALL") where.status = status
  if (severity && severity !== "ALL") where.severity = severity
  if (model && model !== "ALL") where.modelUsed = model
  if (line && line !== "ALL") where.productionLineId = line
  if (search) {
    where.OR = [
      { inspectionCode: { contains: search } },
      { partId: { contains: search } },
      { partName: { contains: search } },
      { partNumber: { contains: search } },
    ]
  }
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59")
  }

  const [total, items] = await Promise.all([
    db.inspection.count({ where }),
    db.inspection.findMany({
      where,
      include: { defects: true, productionLine: true, inspector: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
}
