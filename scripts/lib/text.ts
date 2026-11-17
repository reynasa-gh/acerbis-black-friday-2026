import { fold } from './reference'

const W =
  'negr[oa]s?|blanc[oa]s?|gris(?:es)?|roj[oa]s?|azul(?:es)?|amarill[oa]s?|naranja|verde|marr[oó]n|ros[ae]|oro|plata|camuflaje|militar|claro|fluor|fluo|mate|glossy|oscuro'

/** Frase de color: "negro y amarillo fluor mate", "blanco, azul y rojo", "Naranja 2016"… */
const COLOR_PHRASE = new RegExp(
  `(?:\\bcolor\\s+)?\\b(?:${W})(?:(?:\\s*[,/]\\s*|\\s+y\\s+|\\s+|-)(?:${W})\\b)*(?:\\s+(?:19|20)\\d\\d)?`,
  'gi',
)

const CODE_RE = /\b\d{7}(?:[.\-_]\d{3}){0,2}\b/g
const SIZE_RE = /\btalla\s+(?:XXXL|XXL|XL|XS|L\/XL|S\/M|S|M|L|\d{2})\b/gi

/** Separa letras pegadas a un código de 7 cifras: "gris0027097.070" → "gris 0027097.070". */
export function splitGlued(s: string): string {
  return s.replace(/([A-Za-zñÑáéíóúÁÉÍÓÚ])(\d{7})/g, '$1 $2')
}

export function extractColorPhrases(desc: string): string[] {
  const s = splitGlued(desc).replace(CODE_RE, ' ')
  const out: string[] = []
  for (const m of s.matchAll(COLOR_PHRASE)) {
    const phrase = m[0].replace(/^color\s+/i, '').replace(/\s+/g, ' ').trim()
    if (phrase) out.push(normalizeColorLabel(phrase))
  }
  return out
}

export function normalizeColorLabel(phrase: string): string {
  let t = phrase.toLowerCase()
  if (t.includes('/')) {
    const parts = t.split('/').map((x) => x.trim()).filter(Boolean)
    t = parts.length > 2 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts.join(' y ')
  }
  t = t
    .replace(/\s*,\s*/g, ', ')
    .replace(/\bnegros\b/g, 'negro')
    .replace(/\bblancos\b/g, 'blanco')
    .replace(/\s+/g, ' ')
    .trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Colores base (para el filtro) contenidos en una etiqueta de color. */
export const BASE_COLORS: Array<{ id: string; re: RegExp }> = [
  { id: 'Negro', re: /negr[oa]/i },
  { id: 'Blanco', re: /blanc[oa]/i },
  { id: 'Gris', re: /gris/i },
  { id: 'Rojo', re: /roj[oa]/i },
  { id: 'Azul', re: /azul/i },
  { id: 'Amarillo', re: /amarill[oa]/i },
  { id: 'Naranja', re: /naranja/i },
  { id: 'Verde', re: /verde/i },
  { id: 'Marrón', re: /marr[oó]n/i },
  { id: 'Rosa', re: /ros[ae]/i },
  { id: 'Oro', re: /\boro\b/i },
  { id: 'Camuflaje', re: /camuflaje/i },
]

export function baseColorsOf(label: string | null): string[] {
  if (!label) return []
  return BASE_COLORS.filter((c) => c.re.test(label)).map((c) => c.id)
}

/** Limpia una descripción de Excel para usarla como nombre de producto. */
export function cleanName(desc: string): string {
  let s = splitGlued(String(desc))
  s = s.replace(CODE_RE, ' ')
  s = s.replace(SIZE_RE, ' ')
  s = s.replace(/\b[úu]ltima unidad\b/gi, ' ')
  s = s.replace(COLOR_PHRASE, ' ')
  s = s.replace(/\bAcerbis\s+Acerbis\b/gi, 'Acerbis')
  s = s.replace(/\bacerbis\s+acerbis\b/gi, 'Acerbis')
  s = s.replace(/\s+[-–]\s*(?=[-–]|$)/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/^[\s\-–,.]+|[\s\-–,.]+$/g, '')
  s = s.replace(/\s+([,.])/g, '$1')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export { fold }
