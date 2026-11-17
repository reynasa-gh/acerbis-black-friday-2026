import type { Product, Variant } from '../types'
import { variantColorTags } from './catalog'
import { search, type SearchIndexEntry } from './search'

export type SortKey = 'relevancia' | 'precio-asc' | 'precio-desc' | 'descuento' | 'nombre' | 'disponibilidad'
export type DiscountBucket = '40' | '45' | 'otros'

export interface FilterState {
  query: string
  family: string | null
  subfamily: string | null
  sizes: string[]
  colors: string[]
  /** Neto unitario en céntimos (mín/máx), null = sin límite. */
  minNet: number | null
  maxNet: number | null
  discounts: DiscountBucket[]
  sort: SortKey
}

export const EMPTY_FILTERS: FilterState = {
  query: '', family: null, subfamily: null, sizes: [], colors: [],
  minNet: null, maxNet: null, discounts: [], sort: 'relevancia',
}

export function hasActiveFilters(f: FilterState): boolean {
  return !!(f.query.trim() || f.family || f.subfamily || f.sizes.length || f.colors.length ||
    f.minNet !== null || f.maxNet !== null || f.discounts.length)
}

export function discountBucket(v: Variant): DiscountBucket {
  return v.discountPct === 40 ? '40' : v.discountPct === 45 ? '45' : 'otros'
}

export interface ResultItem {
  product: Product
  /** Variantes que cumplen los filtros de atributo (talla, color, precio, descuento). */
  variants: Variant[]
  matchedSkus: string[]
  exact: boolean
  score: number
}

function variantPasses(v: Variant, f: FilterState): boolean {
  if (f.sizes.length && !(v.size.verified && v.size.label && f.sizes.includes(v.size.label))) return false
  if (f.colors.length && !variantColorTags(v).some((c) => f.colors.includes(c))) return false
  if (f.minNet !== null && v.netCents < f.minNet) return false
  if (f.maxNet !== null && v.netCents > f.maxNet) return false
  if (f.discounts.length && !f.discounts.includes(discountBucket(v))) return false
  return true
}

/** Filtros sobre TODO el catálogo (la paginación se aplica después, solo para pintar). */
export function applyFilters(
  products: Product[],
  index: SearchIndexEntry[],
  f: FilterState,
  opts: { ignoreFamily?: boolean } = {},
): ResultItem[] {
  const hits = search(index, f.query)
  const hitBySku = hits ? new Map(hits.map((h) => [h.product.id, h])) : null
  const out: ResultItem[] = []
  for (const product of products) {
    const hit = hitBySku?.get(product.id)
    if (hitBySku && !hit) continue
    if (!opts.ignoreFamily) {
      if (f.family && product.familyId !== f.family) continue
      if (f.subfamily && product.subfamilyId !== f.subfamily) continue
    }
    const variants = product.variants.filter((v) => variantPasses(v, f))
    if (variants.length === 0) continue
    out.push({
      product, variants,
      matchedSkus: hit?.matchedSkus ?? [],
      exact: hit?.exact ?? false,
      score: hit?.score ?? 0,
    })
  }
  return sortResults(out, f.sort, !!f.query.trim())
}

const nameCmp = (a: ResultItem, b: ResultItem) => a.product.name.localeCompare(b.product.name, 'es')

export function sortResults(items: ResultItem[], sort: SortKey, hasQuery: boolean): ResultItem[] {
  const minNet = (r: ResultItem) => Math.min(...r.variants.map((v) => v.netCents))
  const maxNet = (r: ResultItem) => Math.max(...r.variants.map((v) => v.netCents))
  const maxDto = (r: ResultItem) => Math.max(...r.variants.map((v) => v.discountPct))
  const units = (r: ResultItem) => r.variants.reduce((s, v) => s + v.units, 0)
  const copy = [...items]
  switch (sort) {
    case 'precio-asc': return copy.sort((a, b) => minNet(a) - minNet(b) || nameCmp(a, b))
    case 'precio-desc': return copy.sort((a, b) => maxNet(b) - maxNet(a) || nameCmp(a, b))
    case 'descuento': return copy.sort((a, b) => maxDto(b) - maxDto(a) || nameCmp(a, b))
    case 'nombre': return copy.sort(nameCmp)
    case 'disponibilidad': return copy.sort((a, b) => units(b) - units(a) || nameCmp(a, b))
    default:
      // Relevancia con búsqueda; sin búsqueda se respeta el orden del catálogo (familia y Excel).
      return hasQuery ? copy.sort((a, b) => b.score - a.score || nameCmp(a, b)) : copy
  }
}

export interface Counters {
  products: number
  variants: number
  units: number
}

export function countResults(items: ResultItem[]): Counters {
  return {
    products: items.length,
    variants: items.reduce((s, r) => s + r.variants.length, 0),
    units: items.reduce((s, r) => s + r.variants.reduce((u, v) => u + v.units, 0), 0),
  }
}

const SIZE_ORDER = ['XS', 'S', 'S/M', 'M', 'L', 'L/XL', 'XL', 'XXL', 'XXXL']
const sizeRank = (s: string) => (SIZE_ORDER.includes(s) ? SIZE_ORDER.indexOf(s) : 100 + (Number(s) || 0))
export const sortSizes = (labels: string[]) => [...labels].sort((a, b) => sizeRank(a) - sizeRank(b))

/** Valores disponibles para los filtros de talla y color (solo equivalencias verificadas). */
export function facetValues(products: Product[]): { sizes: string[]; colors: string[]; minNet: number; maxNet: number } {
  const sizes = new Set<string>()
  const colors = new Set<string>()
  let minNet = Infinity
  let maxNet = 0
  for (const p of products) {
    for (const v of p.variants) {
      if (v.size.verified && v.size.label) sizes.add(v.size.label)
      variantColorTags(v).forEach((c) => colors.add(c))
      minNet = Math.min(minNet, v.netCents)
      maxNet = Math.max(maxNet, v.netCents)
    }
  }
  return { sizes: sortSizes([...sizes]), colors: [...colors].sort(), minNet, maxNet }
}
