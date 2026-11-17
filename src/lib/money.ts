/**
 * Aritmética monetaria en céntimos enteros.
 * Política de redondeo: half-up, aplicado UNA sola vez al precio unitario
 * (columna E / columna D). Los totales se calculan con ese precio unitario mostrado.
 */

/** Convierte un importe decimal del Excel a céntimos (half-up, inmune al ruido binario). */
export function toCents(value: number): number {
  // toFixed(6) elimina ruido tipo 5.430000000000001 o 182.92499999999998
  return Math.round(Number((value * 100).toFixed(6)))
}

const NBSP = ' '

/** 3964 → "39,64 €". Miles con punto: 123456 → "1.234,56 €". */
export function formatEUR(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const euros = Math.floor(abs / 100)
  const rest = String(abs % 100).padStart(2, '0')
  const grouped = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${grouped},${rest}${NBSP}€`
}

/** 40 → "40 %", 29.64 → "29,64 %". */
export function formatPct(pct: number): string {
  const rounded = Number(pct.toFixed(2))
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace('.', ',')
  return `${text}${NBSP}%`
}

/** Porcentaje de descuento (2 decimales) desde la fracción original de la columna F. */
export function discountToPct(fraction: number): number {
  return Number((fraction * 100).toFixed(2))
}

export function formatUnits(n: number): string {
  return `${n} ${n === 1 ? 'ud.' : 'uds.'}`
}
