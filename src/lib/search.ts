import type { Product, Variant } from '../types'

export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Referencia normalizada: sin puntos, guiones ni espacios, en mayúsculas ("0025593.319.061" → "0025593319061"). */
export function refKey(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export interface SearchIndexEntry {
  product: Product
  text: string
  refs: Array<{ variant: Variant; full: string; short: string }>
}

export function buildIndex(products: Product[]): SearchIndexEntry[] {
  return products.map((product) => {
    const parts = [product.name, product.id]
    for (const v of product.variants) {
      parts.push(v.description, v.color.label ?? '', v.size.label ?? '', v.version ?? '')
    }
    return {
      product,
      text: fold(parts.join(' ')),
      refs: product.variants.map((variant) => ({
        variant,
        full: refKey(variant.sku),
        short: refKey(variant.sku).replace(/ACB$/, ''),
      })),
    }
  })
}

export interface SearchHit {
  product: Product
  /** Variantes cuya referencia coincide con algún término numérico de la búsqueda. */
  matchedSkus: string[]
  /** true si la búsqueda es exactamente una referencia (completa, sin ACB o con puntos). */
  exact: boolean
  score: number
}

/** Una búsqueda por texto y/o referencia. Cada término debe coincidir (en texto o en alguna referencia). */
export function search(index: SearchIndexEntry[], query: string): SearchHit[] | null {
  const q = query.trim()
  if (!q) return null
  const tokens = q.split(/\s+/).filter(Boolean)
  const wholeKey = refKey(q)
  const hits: SearchHit[] = []

  for (const entry of index) {
    let ok = true
    const matched = new Set<string>()
    let score = 0

    for (const token of tokens) {
      const t = fold(token)
      const rk = refKey(token)
      const hasDigit = /\d/.test(token)
      const textHit = entry.text.includes(t)
      const refHits = hasDigit && rk.length >= 3 ? entry.refs.filter((r) => r.full.includes(rk)) : []
      if (!textHit && refHits.length === 0) { ok = false; break }
      refHits.forEach((r) => matched.add(r.variant.sku))
      score += refHits.length ? 5 : 1
    }
    if (!ok) continue

    const exactRefs = wholeKey.length >= 7
      ? entry.refs.filter((r) => r.full === wholeKey || r.short === wholeKey)
      : []
    if (exactRefs.length) {
      exactRefs.forEach((r) => matched.add(r.variant.sku))
      score += 100
    }
    hits.push({ product: entry.product, matchedSkus: [...matched], exact: exactRefs.length === 1, score })
  }
  return hits
}

/** Si la búsqueda es exactamente una referencia, devuelve su producto y SKU. */
export function findExactSku(index: SearchIndexEntry[], query: string): { product: Product; sku: string } | null {
  const key = refKey(query)
  if (key.length < 10) return null
  for (const entry of index) {
    const r = entry.refs.find((x) => x.full === key || x.short === key)
    if (r) return { product: entry.product, sku: r.variant.sku }
  }
  return null
}
