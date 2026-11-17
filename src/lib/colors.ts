/** Colores base para el filtro (comparten criterio con scripts/lib/text.ts). */
export const BASE_COLORS: Array<{ id: string; re: RegExp; css: string }> = [
  { id: 'Negro', re: /negr[oa]/i, css: '#111' },
  { id: 'Blanco', re: /blanc[oa]/i, css: '#fff' },
  { id: 'Gris', re: /gris/i, css: '#8a8d93' },
  { id: 'Rojo', re: /roj[oa]/i, css: '#d62828' },
  { id: 'Azul', re: /azul/i, css: '#1f5fbf' },
  { id: 'Amarillo', re: /amarill[oa]/i, css: '#ffd500' },
  { id: 'Naranja', re: /naranja/i, css: '#f26a1b' },
  { id: 'Verde', re: /verde/i, css: '#2f8f4e' },
  { id: 'Marrón', re: /marr[oó]n/i, css: '#7a4a2a' },
  { id: 'Rosa', re: /ros[ae]/i, css: '#e95c9a' },
  { id: 'Oro', re: /\boro\b/i, css: '#c9a227' },
  { id: 'Camuflaje', re: /camuflaje/i, css: '#6b7a4f' },
]

export function baseColorsOf(label: string | null): string[] {
  if (!label) return []
  return BASE_COLORS.filter((c) => c.re.test(label)).map((c) => c.id)
}

export function colorCss(id: string): string {
  return BASE_COLORS.find((c) => c.id === id)?.css ?? '#999'
}
