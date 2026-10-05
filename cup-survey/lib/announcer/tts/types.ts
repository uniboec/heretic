export type TtsVoice = {
  id: string
  name: string
  language?: string
}

export type TtsAudio = {
  buffer: Buffer
  mimeType: string
  durationMs?: number
}

export interface TtsProvider {
  id: string
  getVoices(): Promise<TtsVoice[]>
  synthesize(input: {
    text: string
    voice: string
    rate: number
  }): Promise<TtsAudio>
  healthCheck(): Promise<boolean>
}
