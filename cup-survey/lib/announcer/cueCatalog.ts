export type CueSoundDefinition = {
  id: string
  label: string
  family: 'bout' | 'award' | 'neutral'
  path: string
  durationMs: number
}

export const CUE_SOUNDS: CueSoundDefinition[] = [
  { id: 'none', label: 'Нет звука', family: 'neutral', path: '', durationMs: 0 },
  {
    id: 'universfield-032',
    label: 'Нотификация 1',
    family: 'neutral',
    path: '/sounds/announcer/universfield-032.mp3',
    durationMs: 2351,
  },
  {
    id: 'universfield-042',
    label: 'Нотификация 2',
    family: 'neutral',
    path: '/sounds/announcer/universfield-042.mp3',
    durationMs: 2038,
  },
  {
    id: 'universfield-054',
    label: 'Нотификация 3',
    family: 'neutral',
    path: '/sounds/announcer/universfield-054.mp3',
    durationMs: 2038,
  },
  {
    id: 'universfield-056',
    label: 'Нотификация 4',
    family: 'neutral',
    path: '/sounds/announcer/universfield-056.mp3',
    durationMs: 1881,
  },
  {
    id: 'universfield-059',
    label: 'Нотификация 5',
    family: 'neutral',
    path: '/sounds/announcer/universfield-059.mp3',
    durationMs: 2247,
  },
  {
    id: 'chime-01',
    label: 'Колокольчик 1',
    family: 'neutral',
    path: '/sounds/announcer/chime-01.mp3',
    durationMs: 2904,
  },
  {
    id: 'chime-02',
    label: 'Колокольчик 2',
    family: 'neutral',
    path: '/sounds/announcer/chime-02.mp3',
    durationMs: 2904,
  },
  {
    id: 'chime-03',
    label: 'Колокольчик 3',
    family: 'neutral',
    path: '/sounds/announcer/chime-03.mp3',
    durationMs: 2904,
  },
  {
    id: 'chime-04',
    label: 'Колокольчик 4',
    family: 'neutral',
    path: '/sounds/announcer/chime-04.mp3',
    durationMs: 2904,
  },
  {
    id: 'chime-05',
    label: 'Колокольчик 5',
    family: 'neutral',
    path: '/sounds/announcer/chime-05.mp3',
    durationMs: 2904,
  },
  {
    id: 'chime-08',
    label: 'Колокольчик 8',
    family: 'neutral',
    path: '/sounds/announcer/chime-08.mp3',
    durationMs: 2904,
  },
  {
    id: 'chime-13',
    label: 'Колокольчик 13',
    family: 'neutral',
    path: '/sounds/announcer/chime-13.mp3',
    durationMs: 2904,
  },
  {
    id: 'chime-14',
    label: 'Колокольчик 14',
    family: 'neutral',
    path: '/sounds/announcer/chime-14.mp3',
    durationMs: 2904,
  },
  {
    id: 'awesome-notification',
    label: 'Яркий сигнал',
    family: 'neutral',
    path: '/sounds/announcer/awesome-notification.mp3',
    durationMs: 2116,
  },
  {
    id: 'soft-alert',
    label: 'Мягкий сигнал',
    family: 'neutral',
    path: '/sounds/announcer/soft-alert.mp3',
    durationMs: 1593,
  },
  {
    id: 'deep-ui-chime',
    label: 'Глубокий звон',
    family: 'neutral',
    path: '/sounds/announcer/deep-ui-chime.mp3',
    durationMs: 2136,
  },
]

export const DEFAULT_BOUT_CUE_SOUND_ID = 'universfield-032'
export const DEFAULT_AWARD_CUE_SOUND_ID = 'chime-01'

const LEGACY_BOUT_CUE_SOUND_IDS = new Set(['bout-two-tone', 'sporty', 'short-single'])
const LEGACY_AWARD_CUE_SOUND_IDS = new Set(['award-three-tone', 'soft-chime'])

export function resolveCueSoundId(
  soundId: string,
  fallbackKind: 'bout' | 'award',
): string {
  if (getCueSoundEntry(soundId)) return soundId
  if (fallbackKind === 'bout' && LEGACY_BOUT_CUE_SOUND_IDS.has(soundId)) {
    return DEFAULT_BOUT_CUE_SOUND_ID
  }
  if (fallbackKind === 'award' && LEGACY_AWARD_CUE_SOUND_IDS.has(soundId)) {
    return DEFAULT_AWARD_CUE_SOUND_ID
  }
  return fallbackKind === 'bout' ? DEFAULT_BOUT_CUE_SOUND_ID : DEFAULT_AWARD_CUE_SOUND_ID
}

export function getCueSoundEntry(id: string): CueSoundDefinition | undefined {
  return CUE_SOUNDS.find((sound) => sound.id === id)
}
