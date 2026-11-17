/**
 * Descomposición de una referencia Acerbis de Reynasa.
 *
 *   0025593 319 061 ACB
 *   └modelo┘ └color┘ └sufijo┘ (sufijo opcional)
 *
 * Longitudes válidas (con "ACB"): 10 (solo modelo), 13 (modelo+color), 16 (modelo+color+sufijo).
 * Las referencias se tratan SIEMPRE como texto (ceros iniciales y sufijo ACB intactos).
 */
export interface ParsedSku {
  sku: string
  model: string
  colorCode: string | null
  suffix: string | null
}

const SKU_RE = /^(\d{7})(\d{3})?(\d{3})?ACB$/

export function parseSku(sku: string): ParsedSku | null {
  const m = SKU_RE.exec(sku)
  if (!m) return null
  return { sku, model: m[1], colorCode: m[2] ?? null, suffix: m[3] ?? null }
}

/** Texto sin acentos, minúsculas, para reglas y búsquedas. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}
