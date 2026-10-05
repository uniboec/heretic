/**
 * @deprecated Use `npm run announcer:install-sounds` (Kenney CC0 interface sounds).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

function createToneWav(durationMs, frequencyHz, volume = 0.35) {
  const sampleRate = 44100
  const numSamples = Math.max(1, Math.floor((sampleRate * durationMs) / 1000))
  const dataSize = numSamples * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  for (let i = 0; i < numSamples; i += 1) {
    const t = i / sampleRate
    const envelope = Math.min(1, i / 200, (numSamples - i) / 200)
    const sample = Math.sin(2 * Math.PI * frequencyHz * t) * envelope * volume
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2)
  }

  return buffer
}

function createSequenceWav(sequence) {
  const sampleRate = 44100
  const parts = sequence.map(({ ms, hz }) => createToneWav(ms, hz))
  const dataBuffers = parts.map((part) => part.subarray(44))
  const totalData = dataBuffers.reduce((sum, chunk) => sum + chunk.length, 0)
  const buffer = Buffer.alloc(44 + totalData)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + totalData, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(totalData, 40)
  let offset = 44
  for (const chunk of dataBuffers) {
    chunk.copy(buffer, offset)
    offset += chunk.length
  }
  return buffer
}

const sounds = {
  'short-single.wav': createToneWav(400, 880),
  'bout-two-tone.wav': createSequenceWav([
    { ms: 220, hz: 660 },
    { ms: 80, hz: 0 },
    { ms: 220, hz: 990 },
  ]),
  'award-three-tone.wav': createSequenceWav([
    { ms: 180, hz: 523 },
    { ms: 60, hz: 0 },
    { ms: 180, hz: 659 },
    { ms: 60, hz: 0 },
    { ms: 220, hz: 784 },
  ]),
  'soft-chime.wav': createToneWav(500, 740, 0.25),
  'sporty.wav': createSequenceWav([
    { ms: 150, hz: 1200 },
    { ms: 50, hz: 0 },
    { ms: 150, hz: 900 },
  ]),
}

const targetDir = path.join(process.cwd(), 'public', 'sounds', 'announcer')
await mkdir(targetDir, { recursive: true })

for (const [name, buffer] of Object.entries(sounds)) {
  await writeFile(path.join(targetDir, name), buffer)
}

console.log(`Generated ${Object.keys(sounds).length} cue sounds in ${targetDir}`)
