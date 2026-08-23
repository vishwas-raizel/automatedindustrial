import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/audit — paginated audit logs
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action") || undefined
  const severity = searchParams.get("severity") || undefined
  const search = searchParams.get("search") || undefined
  const page = Math.max(1, Number(searchParams.get("page") || 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 25)))

  const where: any = {}
  if (action && action !== "ALL") where.action = action
  if (severity && severity !== "ALL") where.severity = severity
  if (search) {
    where.OR = [
      { userName: { contains: search } },
      { resource: { contains: search } },
      { resourceId: { contains: search } },
      { details: { contains: search } },
    ]
  }

  const [total, items] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({ items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) })
}
