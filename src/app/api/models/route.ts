import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/models — model performance metrics for comparison
export async function GET() {
  const models = await db.modelMetric.findMany({ orderBy: { map50: "desc" } })
  return NextResponse.json({ models })
}
