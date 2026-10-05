import { NextResponse } from 'next/server'
import { listClubs } from '@/lib/registration/clubs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? undefined
  const clubs = await listClubs(q)
  return NextResponse.json({ clubs })
}
