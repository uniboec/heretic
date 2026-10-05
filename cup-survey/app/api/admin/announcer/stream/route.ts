import { refreshAnnouncerDashboard } from '@/lib/announcer/lifecycle'
import { requireAnnouncerAdmin } from '@/lib/announcer/adminAuth'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  const encoder = new TextEncoder()
  let closed = false
  let interval: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    async start(controller) {
      const closeStream = () => {
        if (closed) return
        closed = true
        if (interval) clearInterval(interval)
        try {
          controller.close()
        } catch {
          // already closed
        }
      }

      const safeEnqueue = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          closeStream()
        }
      }

      const send = async () => {
        if (closed) return
        try {
          const dashboard = await refreshAnnouncerDashboard()
          if (closed) return
          safeEnqueue(`data: ${JSON.stringify(dashboard)}\n\n`)
        } catch (error) {
          if (closed) return
          const message = error instanceof Error ? error.message : 'stream error'
          safeEnqueue(`event: error\ndata: ${JSON.stringify({ message })}\n\n`)
        }
      }

      await send()
      interval = setInterval(() => {
        void send()
      }, 2000)

      request.signal.addEventListener('abort', closeStream)
    },
    cancel() {
      closed = true
      if (interval) clearInterval(interval)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
