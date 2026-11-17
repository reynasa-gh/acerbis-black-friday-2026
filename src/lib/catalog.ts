import raw from '../data/catalog.json'
import review from '../data/review.json'
import type { Catalog, Family, Product, ReviewLog, Variant } from '../types'
import { baseColorsOf } from './colors'

export const CATALOG = raw as unknown as Catalog
export const REVIEW = review as unknown as ReviewLog

export interface VariantRef {
  product: Product
  variant: Variant
}

export const FAMILY_BY_ID = new Map<string, Family>(CATALOG.families.map((f) => [f.id, f]))
export const PRODUCT_BY_ID = new Map<string, Product>(CATALOG.products.map((p) => [p.id, p]))
export const VARIANT_BY_SKU = new Map<string, VariantRef>()
for (const product of CATALOG.products) {
  for (const variant of product.variants) VARIANT_BY_SKU.set(variant.sku, { product, variant })
}

/** Colores base de una variante (solo si la etiqueta está verificada). */
export function variantColorTags(v: Variant): string[] {
  return v.color.verified ? baseColorsOf(v.color.label) : []
}

export function familyLabel(p: Product): string {
  const f = FAMILY_BY_ID.get(p.familyId)
  const s = f?.subfamilies.find((x) => x.id === p.subfamilyId)
  return s ? `${f?.name} · ${s.name}` : (f?.name ?? '')
}

export function variantImage(v: Variant): string {
  return v.image
}

export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`
}
