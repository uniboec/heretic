/**
 * Local OpenAI-compatible TTS for dev when cloud APIs are unreachable.
 * Windows: System.Speech (offline). Other OS: not supported yet.
 */
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const execFileAsync = promisify(execFile)
const PORT = Number(process.env.EDGE_TTS_PORT ?? 5500)
const HOST = process.env.EDGE_TTS_HOST ?? '127.0.0.1'

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function clampRate(rate) {
  const value = Number.isFinite(rate) ? rate : 1
  return Math.max(0.7, Math.min(1.3, value))
}

function sapiRate(rate) {
  return Math.max(-10, Math.min(10, Math.round((clampRate(rate) - 1) * 10)))
}

function voiceGender(voice) {
  const id = String(voice ?? '').toLowerCase()
  if (id.includes('svetlana') || id.includes('female') || id.includes('alena')) return 'female'
  if (id.includes('dmitry') || id.includes('male') || id.includes('filipp')) return 'male'
  return 'any'
}

async function synthesizeWindows({ text, voice, rate }) {
  if (process.platform !== 'win32') {
    throw new Error('Local offline TTS is only available on Windows (System.Speech)')
  }

  const dir = await mkdtemp(join(tmpdir(), 'cup-tts-'))
  const outPath = join(dir, `${randomUUID()}.wav`)
  const textB64 = Buffer.from(text, 'utf8').toString('base64')
  const gender = voiceGender(voice)
  const psRate = sapiRate(rate)

  const ps = `
$ErrorActionPreference = 'Stop'
$text = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${textB64}'))
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$ruVoices = @($synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'ru-*' })
if ($ruVoices.Count -eq 0) {
  $ruVoices = @($synth.GetInstalledVoices())
}
$pick = $null
if ('${gender}' -eq 'female') {
  $pick = $ruVoices | Where-Object { $_.VoiceInfo.Gender -eq [System.Speech.Synthesis.VoiceGender]::Female } | Select-Object -First 1
}
if ('${gender}' -eq 'male' -and -not $pick) {
  $pick = $ruVoices | Where-Object { $_.VoiceInfo.Gender -eq [System.Speech.Synthesis.VoiceGender]::Male } | Select-Object -First 1
}
if (-not $pick) { $pick = $ruVoices | Select-Object -First 1 }
if ($pick) { $synth.SelectVoice($pick.VoiceInfo.Name) }
$synth.Rate = ${psRate}
$synth.SetOutputToWaveFile('${outPath.replace(/\\/g, '\\\\')}')
$synth.Speak($text)
$synth.Dispose()
`

  try {
    await execFileAsync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 },
    )
    const buffer = await readFile(outPath)
    if (buffer.length < 44) throw new Error('TTS produced empty audio')
    return buffer
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ok')
      return
    }

    if (req.method !== 'POST' || req.url !== '/v1/audio/speech') {
      json(res, 404, { error: 'Not found' })
      return
    }

    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    const text = String(body.input ?? body.text ?? '').trim()
    if (!text) {
      json(res, 400, { error: 'input is required' })
      return
    }

    const audio = await synthesizeWindows({
      text,
      voice: body.voice,
      rate: body.rate,
    })

    res.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Cache-Control': 'no-store',
    })
    res.end(audio)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TTS failed'
    console.error('[local-tts]', message)
    json(res, 500, { error: message })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[local-tts] listening on http://${HOST}:${PORT}`)
})
