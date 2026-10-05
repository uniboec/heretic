import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Survey is closed. Historical responses remain available in the admin dashboard.' },
    { status: 410 },
  )
}
