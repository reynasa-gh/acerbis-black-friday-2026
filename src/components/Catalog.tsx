import { useMemo } from 'react'
import { CATALOG, FAMILY_BY_ID, familyLabel } from '../lib/catalog'
import { BASE_COLORS, colorCss } from '../lib/colors'
import {
  EMPTY_FILTERS, hasActiveFilters, sortSizes, type Counters, type DiscountBucket, type FilterState, type ResultItem, type SortKey,
} from '../lib/filters'
import { formatEUR, formatPct } from '../lib/money'
import type { Variant } from '../types'
import { Icon, PriceBlock, SafeImage } from './Common'

export interface FacetValues { sizes: string[]; colors: string[]; minNet: number; maxNet: number }
export interface FamilyCount { products: number; variants: number }

/* ---------------- Filtros ---------------- */

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

export function FilterPanel({
  filters, onChange, facets, familyCounts, totalProducts, onReset,
}: {
  filters: FilterState
  onChange: (f: FilterState) => void
  facets: FacetValues
  familyCounts: Map<string, FamilyCount>
  totalProducts: FamilyCount
  onReset: () => void
}) {
  const active = hasActiveFilters(filters)
  const euros = (c: number | null) => (c === null ? '' : String(c / 100).replace('.', ','))
  const parse = (s: string): number | null => {
    const n = Number(s.replace(',', '.'))
    return s.trim() === '' || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100)
  }
  const colorsPresent = BASE_COLORS.filter((c) => facets.colors.includes(c.id))
  const discounts: Array<{ id: DiscountBucket; label: string }> = [
    { id: '40', label: '40 %' }, { id: '45', label: '45 %' }, { id: 'otros', label: 'Otro descuento' },
  ]

  return (
    <div className="filters">
      <div className="filters-head">
        <h2>Familias</h2>
        <button type="button" className="link-btn" onClick={onReset} disabled={!active}>Limpiar filtros</button>
      </div>
      <nav aria-label="Familias de producto">
        <ul className="family-nav">
          <li>
            <button type="button" className={!filters.family ? 'is-active' : ''} onClick={() => onChange({ ...filters, family: null, subfamily: null })}>
              <span>Todo el catálogo</span>
              <small>{totalProducts.products} prod. · {totalProducts.variants} ref.</small>
            </button>
          </li>
          {CATALOG.families.map((f) => {
            const c = familyCounts.get(f.id) ?? { products: 0, variants: 0 }
            const current = filters.family === f.id
            return (
              <li key={f.id}>
                <button
                  type="button"
                  className={current && !filters.subfamily ? 'is-active' : current ? 'is-open' : ''}
                  disabled={c.products === 0 && !current}
                  onClick={() => onChange({ ...filters, family: f.id, subfamily: null })}
                >
                  <span>{f.name}</span>
                  <small>{c.products} prod. · {c.variants} ref.</small>
                </button>
                {current && f.subfamilies.length > 1 && (
                  <ul className="sub-nav">
                    {f.subfamilies.map((s) => (
                      <li key={s.id}>
                        <button type="button" className={filters.subfamily === s.id ? 'is-active' : ''} onClick={() => onChange({ ...filters, subfamily: filters.subfamily === s.id ? null : s.id })}>
                          {s.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <h2 className="filters-title">Filtrar</h2>

      {facets.sizes.length > 0 && (
        <fieldset>
          <legend>Talla <small>(verificadas)</small></legend>
          <div className="chips">
            {facets.sizes.map((s) => (
              <button key={s} type="button" className={`chip ${filters.sizes.includes(s) ? 'is-on' : ''}`} aria-pressed={filters.sizes.includes(s)} onClick={() => onChange({ ...filters, sizes: toggle(filters.sizes, s) })}>{s}</button>
            ))}
          </div>
        </fieldset>
      )}

      {colorsPresent.length > 0 && (
        <fieldset>
          <legend>Color <small>(verificados)</small></legend>
          <div className="swatches">
            {colorsPresent.map((c) => (
              <button
                key={c.id} type="button"
                className={`swatch ${filters.colors.includes(c.id) ? 'is-on' : ''}`}
                aria-pressed={filters.colors.includes(c.id)}
                title={c.id}
                onClick={() => onChange({ ...filters, colors: toggle(filters.colors, c.id) })}
              >
                <i style={{ background: colorCss(c.id) }} />
                <span>{c.id}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend>Precio neto (€)</legend>
        <div className="range">
          <input inputMode="decimal" aria-label="Precio neto mínimo" placeholder={String(Math.floor(facets.minNet / 100))} defaultValue={euros(filters.minNet)} key={`min-${filters.minNet}`}
            onBlur={(e) => onChange({ ...filters, minNet: parse(e.target.value) })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
          <span>a</span>
          <input inputMode="decimal" aria-label="Precio neto máximo" placeholder={String(Math.ceil(facets.maxNet / 100))} defaultValue={euros(filters.maxNet)} key={`max-${filters.maxNet}`}
            onBlur={(e) => onChange({ ...filters, maxNet: parse(e.target.value) })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Descuento</legend>
        <div className="checks">
          {discounts.map((d) => (
            <label key={d.id}>
              <input type="checkbox" checked={filters.discounts.includes(d.id)} onChange={() => onChange({ ...filters, discounts: toggle(filters.discounts, d.id) })} />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

/* ---------------- Barra de resultados ---------------- */

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: 'relevancia', label: 'Relevancia / familia' },
  { id: 'precio-asc', label: 'Precio neto: menor a mayor' },
  { id: 'precio-desc', label: 'Precio neto: mayor a menor' },
  { id: 'descuento', label: 'Mayor descuento' },
  { id: 'nombre', label: 'Nombre (A–Z)' },
  { id: 'disponibilidad', label: 'Mayor disponibilidad' },
]

export function Toolbar({
  counters, filters, onChange, onReset, onOpenFilters,
}: { counters: Counters; filters: FilterState; onChange: (f: FilterState) => void; onReset: () => void; onOpenFilters: () => void }) {
  const active = hasActiveFilters(filters)
  const fam = filters.family ? FAMILY_BY_ID.get(filters.family)?.name : null
  return (
    <div className="toolbar">
      <div className="toolbar-count" aria-live="polite">
        <h2>{fam ?? 'Catálogo completo'}</h2>
        <p>
          <b>{counters.products}</b> {counters.products === 1 ? 'producto' : 'productos'} · <b>{counters.variants}</b> {counters.variants === 1 ? 'referencia' : 'referencias'} · <b>{counters.units}</b> uds.
          {active && <span className="muted"> (de {CATALOG.meta.products} productos y {CATALOG.meta.uniqueSkus} referencias)</span>}
        </p>
      </div>
      <div className="toolbar-actions">
        <button type="button" className="btn btn-ghost only-mobile" onClick={onOpenFilters}><Icon name="filter" /> Filtros</button>
        {active && <button type="button" className="btn btn-ghost" onClick={onReset}>Limpiar filtros</button>}
        <label className="sort">
          <span>Ordenar</span>
          <select value={filters.sort} onChange={(e) => onChange({ ...filters, sort: e.target.value as SortKey })}>
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}

/** Chips de familia para móvil (desplazamiento horizontal interno, sin desbordar la página). */
export function FamilyChips({ filters, onChange, familyCounts }: { filters: FilterState; onChange: (f: FilterState) => void; familyCounts: Map<string, FamilyCount> }) {
  return (
    <div className="family-chips" role="tablist" aria-label="Familias">
      <button type="button" className={!filters.family ? 'is-active' : ''} onClick={() => onChange({ ...filters, family: null, subfamily: null })}>Todo</button>
      {CATALOG.families.map((f) => (
        <button key={f.id} type="button" className={filters.family === f.id ? 'is-active' : ''} disabled={(familyCounts.get(f.id)?.products ?? 0) === 0 && filters.family !== f.id} onClick={() => onChange({ ...filters, family: f.id, subfamily: null })}>
          {f.name} <small>{familyCounts.get(f.id)?.products ?? 0}</small>
        </button>
      ))}
    </div>
  )
}

/* ---------------- Tarjeta ---------------- */

export function ProductCard({
  item, closed, inCart, onOpen, onQuickAdd, isFavorite, onToggleFavorite,
}: {
  item: ResultItem
  closed: boolean
  inCart: (sku: string) => number
  onOpen: (productId: string, sku?: string) => void
  onQuickAdd: (sku: string) => void
  isFavorite: boolean
  onToggleFavorite: () => void
}) {
  const { product, variants } = item
  const info = useMemo(() => {
    const cover: Variant =
      variants.find((v) => v.sku === item.matchedSkus[0]) ??
      (variants.includes(product.variants[product.coverIndex]) ? product.variants[product.coverIndex] : variants[0])
    const cheapest = variants.reduce((a, b) => (b.netCents < a.netCents ? b : a), variants[0])
    const varies = new Set(variants.map((v) => v.netCents)).size > 1
    const dtos = [...new Set(variants.map((v) => v.discountPct))].sort((a, b) => b - a)
    const sizes = sortSizes([...new Set(variants.filter((v) => v.size.verified && v.size.label).map((v) => v.size.label as string))])
    const colors = new Set(variants.map((v) => v.color.code)).size
    return { cover, cheapest, varies, dtos, sizes, colors }
  }, [variants, product, item.matchedSkus])

  const single = product.variants.length === 1
  const only = product.variants[0]
  const atMax = single && inCart(only.sku) >= only.units
  const multiDto = info.dtos.length > 1

  return (
    <article className="card">
      <div className="card-media-wrap">
        <button type="button" className="card-media" onClick={() => onOpen(product.id, item.matchedSkus.length === 1 ? item.matchedSkus[0] : undefined)} aria-label={`Ver ${product.name}`}>
          <SafeImage variant={info.cover} alt={product.name} />
          <span className="card-dto">{multiDto ? 'Hasta ' : ''}−{formatPct(info.dtos[0])}</span>
        </button>
        <button
          type="button"
          className={`fav-btn ${isFavorite ? 'is-on' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Quitar ${product.name} de favoritos` : `Añadir ${product.name} a favoritos`}
        >
          <Icon name="star" filled={isFavorite} />
        </button>
      </div>
      <div className="card-body">
        <p className="card-family">{familyLabel(product)}</p>
        <h3 className="card-title"><button type="button" onClick={() => onOpen(product.id)}>{product.name}</button></h3>
        <p className="card-model">Modelo <code>{product.id}</code>{single && <> · <code>{only.sku}</code></>}</p>
        <PriceBlock pvpCents={info.cheapest.pvpCents} netCents={info.cheapest.netCents} discountPct={info.cheapest.discountPct} from={info.varies} />
        <ul className="card-facts">
          {!single && <li>{variants.length} {variants.length === 1 ? 'variante' : 'variantes'}{info.colors > 1 ? ` · ${info.colors} colores` : ''}</li>}
          {info.sizes.length > 0 && <li className="card-sizes">Tallas: {info.sizes.join(' · ')}</li>}
        </ul>
        {item.matchedSkus.length > 0 && <p className="card-match">Coincide: <code>{item.matchedSkus.slice(0, 2).join(', ')}</code>{item.matchedSkus.length > 2 ? ` y ${item.matchedSkus.length - 2} más` : ''}</p>}
      </div>
      <div className="card-actions">
        {single ? (
          <button type="button" className="btn btn-primary btn-block" disabled={closed || atMax || only.units <= 0} onClick={() => onQuickAdd(only.sku)}>
            {closed ? 'Campaña finalizada' : atMax ? 'Máximo en pedido' : 'Añadir al pedido'}
          </button>
        ) : (
          <button type="button" className="btn btn-dark btn-block" onClick={() => onOpen(product.id, item.matchedSkus.length === 1 ? item.matchedSkus[0] : undefined)}>
            Ver tallas y opciones
          </button>
        )}
      </div>
    </article>
  )
}

export function EmptyState({ onReset, query }: { onReset: () => void; query: string }) {
  return (
    <div className="empty" role="status">
      <h3>Sin resultados</h3>
      <p>{query.trim() ? <>Nada coincide con «{query}» y los filtros activos.</> : 'Ningún producto cumple los filtros activos.'} Prueba con otra referencia, quita algún filtro o vuelve a todo el catálogo.</p>
      <button type="button" className="btn btn-primary" onClick={onReset}>Limpiar filtros</button>
    </div>
  )
}

export { EMPTY_FILTERS, formatEUR }
