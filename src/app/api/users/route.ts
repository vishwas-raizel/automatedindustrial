import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/users — list users for role-based access display
export async function GET() {
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } })
  return NextResponse.json({ users })
}
