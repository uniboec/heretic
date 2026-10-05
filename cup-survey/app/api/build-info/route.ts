import { NextResponse } from 'next/server'

export async function GET() {
  const releaseId = process.env.CUP_RELEASE_ID ?? ''
  const gitSha = process.env.CUP_GIT_SHA ?? ''
  if (!releaseId || !gitSha) {
    return NextResponse.json(
      { error: 'Build identity not configured' },
      { status: 503 },
    )
  }
  return NextResponse.json({ releaseId, gitSha })
}
