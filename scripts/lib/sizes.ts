import type { SizeInfo } from '../../src/types'

/**
 * Correspondencia sufijo → talla de Acerbis.
 *
 * Fuente: tablas de tallas de los catálogos Acerbis (S 062 · M 064 · L 066 · XL 068 · XXL 069 ·
 * XXXL 070, XS 061 en algunos artículos y combinadas S/M 063 · L/XL 067 en protecciones),
 * contrastada con las descripciones del propio Excel (ver `sizeEvidence` en el registro de revisión).
 * Los códigos numéricos (030, 032, 033, 043, 050, 052, 054…) NO están en esta tabla: se aceptan solo
 * si la descripción de la propia variante indica la talla.
 */
export const SIZE_TABLE: Record<string, string> = {
  '061': 'XS',
  '062': 'S',
  '063': 'S/M',
  '064': 'M',
  '066': 'L',
  '067': 'L/XL',
  '068': 'XL',
  '069': 'XXL',
  '070': 'XXXL',
}

const TOKEN = 'XXXL|XXL|XL|XS|L\\/XL|S\\/M|S|M|L'

/** Talla declarada explícitamente en la descripción de una variante (o null). */
export function sizeFromDescription(desc: string): string | null {
  let m = new RegExp(`\\btalla\\s+(${TOKEN}|\\d{2})\\b`, 'i').exec(desc)
  if (m) return m[1].toUpperCase()
  m = new RegExp(`\\b(${TOKEN})\\s+\\d{7}`).exec(desc)
  if (m) return m[1]
  m = new RegExp(`\\s(XXXL|XXL|XL|XS)\\s*$`).exec(desc)
  if (m) return m[1]
  return null
}

/** Familias en las que un sufijo numérico distinto de la tabla puede ser una talla. */
export const NUMERIC_SIZE_FAMILIES = new Set(['cascos', 'botas', 'pantalones'])

export interface SizeResolution {
  size: SizeInfo
  version: string | null
  flags: string[]
}

export function resolveSize(
  suffix: string | null,
  ownDescription: string | null,
  familyId: string,
): SizeResolution {
  const empty: SizeInfo = { code: null, label: null, verified: false, source: null }
  if (!suffix) return { size: empty, version: null, flags: [] }

  const declared = ownDescription ? sizeFromDescription(ownDescription) : null
  const tableLabel = SIZE_TABLE[suffix]

  if (tableLabel) {
    const flags: string[] = []
    if (declared && declared !== tableLabel) {
      flags.push(`talla-en-conflicto: descripción dice ${declared}, tabla Acerbis dice ${tableLabel}`)
    }
    return {
      size: {
        code: suffix,
        label: tableLabel,
        verified: true,
        source: declared === tableLabel ? 'descripcion' : 'tabla-acerbis',
      },
      version: null,
      flags,
    }
  }

  if (NUMERIC_SIZE_FAMILIES.has(familyId)) {
    if (declared && /^\d{2}$/.test(declared)) {
      return {
        size: { code: suffix, label: declared, verified: true, source: 'descripcion' },
        version: null,
        flags: [],
      }
    }
    return {
      size: { code: suffix, label: null, verified: false, source: null },
      version: null,
      flags: [`talla-pendiente: sufijo numérico ${suffix} sin equivalencia verificada`],
    }
  }

  // Sufijo que no es talla (versión/aplicación): 003, 016, 023, 098…
  return { size: empty, version: suffix, flags: [`version: sufijo ${suffix} conservado como versión, no como talla`] }
}
