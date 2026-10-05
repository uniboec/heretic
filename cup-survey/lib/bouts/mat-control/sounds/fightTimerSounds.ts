import { withBasePath } from '@/lib/basePath'

export type FightTimerSoundId =
  | 'bell-classic'
  | 'bell-loud'
  | 'gong'
  | 'whistle-rest'
  | 'horn-block'
  | 'chime-soft'
  | 'beep-warning'

export const FIGHT_TIMER_SOUND_PATHS: Record<FightTimerSoundId, string> = {
  'bell-classic': '/sounds/fight-timer/bell-classic.wav',
  'bell-loud': '/sounds/fight-timer/bell-loud.wav',
  gong: '/sounds/fight-timer/gong.wav',
  'whistle-rest': '/sounds/fight-timer/whistle-rest.wav',
  'horn-block': '/sounds/fight-timer/horn-block.wav',
  'chime-soft': '/sounds/fight-timer/chime-soft.flac',
  'beep-warning': '/sounds/fight-timer/beep-warning.wav',
}

/** Старт раунда / ФАЙТ */
export const JUDGE_BOUT_START_SOUND: FightTimerSoundId = 'bell-classic'

/** Конец раунда / ТАЙМ */
export const JUDGE_BOUT_END_SOUND: FightTimerSoundId = 'bell-loud'

/** Предупреждение за 10 секунд до конца периода */
export const JUDGE_PERIOD_WARNING_SOUND: FightTimerSoundId = 'beep-warning'

export const JUDGE_PERIOD_WARNING_SECONDS = 10

class FightTimerSoundPlayer {
  private cache = new Map<FightTimerSoundId, HTMLAudioElement>()
  private volume = 0.85
  private enabled = true
  private lastPlayed: { soundId: FightTimerSoundId; at: number } | null = null

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume))
  }

  /** Preload bout sounds after a user gesture (takeover / first ФАЙТ). */
  unlock(): void {
    if (typeof window === 'undefined') return
    for (const soundId of [
      JUDGE_BOUT_START_SOUND,
      JUDGE_BOUT_END_SOUND,
      JUDGE_PERIOD_WARNING_SOUND,
    ]) {
      if (!this.cache.has(soundId)) {
        const audio = new Audio(withBasePath(FIGHT_TIMER_SOUND_PATHS[soundId]))
        audio.preload = 'auto'
        this.cache.set(soundId, audio)
      }
    }
  }

  async play(soundId: FightTimerSoundId, volumeOverride?: number): Promise<void> {
    if (typeof window === 'undefined' || !this.enabled) return

    const now = Date.now()
    if (this.lastPlayed?.soundId === soundId && now - this.lastPlayed.at < 1500) {
      return
    }
    this.lastPlayed = { soundId, at: now }

    let audio = this.cache.get(soundId)
    if (!audio) {
      audio = new Audio(withBasePath(FIGHT_TIMER_SOUND_PATHS[soundId]))
      audio.preload = 'auto'
      this.cache.set(soundId, audio)
    }

    audio.volume = volumeOverride ?? this.volume
    audio.currentTime = 0

    try {
      await audio.play()
    } catch {
      // Browser may block autoplay until user gesture — ignore silently.
    }
  }
}

export const fightTimerSoundPlayer = new FightTimerSoundPlayer()
