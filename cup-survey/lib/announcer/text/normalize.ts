const ONES = [
  '',
  'один',
  'два',
  'три',
  'четыре',
  'пять',
  'шесть',
  'семь',
  'восемь',
  'девять',
  'десять',
  'одиннадцать',
  'двенадцать',
  'тринадцать',
  'четырнадцать',
  'пятнадцать',
  'шестнадцать',
  'семнадцать',
  'восемнадцать',
  'девятнадцать',
]
const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']

function numberToWordsRu(n: number): string {
  if (n < 0 || n > 99) return String(n)
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return o === 0 ? TENS[t] : `${TENS[t]} ${ONES[o]}`
}

export function normalizeMatNumber(matIndex: number): string {
  return `татами номер ${numberToWordsRu(matIndex)}`
}

function replaceSpeechSeparators(text: string): string {
  return text
    .replace(/[·•∙⋅]/g, ', ')
    .replace(/[×✕✖]/g, ' ')
    .replace(/\*/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*/g, ', ')
    .replace(/,{2,}/g, ',')
}

export function normalizeAnnouncerText(text: string): string {
  let result = replaceSpeechSeparators(text)

  result = result.replace(/татами\s*№\s*(\d+)/gi, (_, n) => normalizeMatNumber(Number(n)))
  result = result.replace(/-(\d+)\s*кг/gi, (_, w) => `до ${numberToWordsRu(Number(w))} килограммов`)
  result = result.replace(/(\d+)\s*–\s*(\d+)\s*лет/g, (_, a, b) =>
    `${numberToWordsRu(Number(a))}–${numberToWordsRu(Number(b))} лет`,
  )

  return result.replace(/\s+/g, ' ').trim()
}
