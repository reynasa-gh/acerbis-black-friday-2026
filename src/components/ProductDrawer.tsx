import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { familyLabel } from '../lib/catalog'
import { formatEUR, formatPct } from '../lib/money'
import type { Product, Variant } from '../types'
import { Icon, PriceBlock, SafeImage, Stepper, useEscape, useScrollLock } from './Common'

interface Props {
  product: Product
  initialSku?: string
  closed: boolean
  inCart: (sku: string) => number
  onAdd: (entries: Array<{ sku: string; qty: number }>) => void
  onClose: () => void
  isFavorite: boolean
  onToggleFavorite: () => void
}

interface ColorGroup {
  code: string | null
  label: string | null
  variants: Variant[]
  units: number
}

function sizeCell(v: Variant): { text: string; warn: boolean } {
  if (v.size.verified && v.size.label) return { text: v.size.label, warn: false }
  if (v.size.code) return { text: `Cód. ${v.size.code} · por validar`, warn: true }
  if (v.version) return { text: `Versión ${v.version}`, warn: false }
  return { text: '—', warn: false }
}

export function ProductDrawer({ product, initialSku, closed, inCart, onAdd, onClose, isFavorite, onToggleFavorite }: Props) {
  const groups = useMemo<ColorGroup[]>(() => {
    const out: ColorGroup[] = []
    for (const v of product.variants) {
      let g = out.find((x) => x.code === v.color.code)
      if (!g) { g = { code: v.color.code, label: v.color.label, variants: [], units: 0 }; out.push(g) }
      g.variants.push(v)
      g.units += v.units
    }
    return out
  }, [product])

  const startSku = initialSku && product.variants.some((v) => v.sku === initialSku)
    ? initialSku
    : (product.variants.find((v) => v.units > 0) ?? product.variants[0]).sku
  const [selectedSku, setSelectedSku] = useState(startSku)
  const [drafts, setDrafts] = useState<Record<string, number>>({})
  const closeRef = useRef<HTMLButtonElement>(null)
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})

  useEffect(() => { setSelectedSku(startSku); setDrafts({}) }, [product.id, startSku])
  useEffect(() => { closeRef.current?.focus() }, [product.id])
  useEffect(() => {
    if (initialSku) rowRefs.current[initialSku]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [initialSku, product.id])
  useScrollLock(true)
  useEscape(onClose, true)

  const selected = product.variants.find((v) => v.sku === selectedSku) ?? product.variants[0]
  const group = groups.find((g) => g.code === selected.color.code) ?? groups[0]
  const maxFor = (v: Variant) => Math.max(0, v.units - inCart(v.sku))

  const verifiedColors = groups.filter((g) => g.label)
  const sizeChips = group.variants.filter((v) => v.size.verified && v.size.label)

  const pick = (v: Variant | undefined) => v && setSelectedSku(v.sku)
  const pickColor = (g: ColorGroup) => {
    const same = g.variants.find((v) => v.size.label && v.size.label === selected.size.label && v.units > 0)
    pick(same ?? g.variants.find((v) => v.units > 0) ?? g.variants[0])
  }

  const draftUnits = Object.values(drafts).reduce((s, n) => s + n, 0)
  const draftCents = product.variants.reduce((s, v) => s + (drafts[v.sku] ?? 0) * v.netCents, 0)
  const setDraft = (v: Variant, n: number) => setDrafts((d) => ({ ...d, [v.sku]: Math.min(n, maxFor(v)) }))
  const addDrafts = () => {
    const entries = Object.entries(drafts).filter(([, q]) => q > 0).map(([sku, qty]) => ({ sku, qty }))
    if (entries.length) { onAdd(entries); setDrafts({}) }
  }

  const varies = product.priceVaries
  const header = varies ? product.variants.find((v) => v.netCents === product.minNetCents)! : selected

  return (
    <div className="overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <aside className="drawer drawer-product" role="dialog" aria-modal="true" aria-labelledby="pd-title">
        <header className="drawer-head">
          <div>
            <p className="card-family">{familyLabel(product)}</p>
            <h2 id="pd-title">{product.name}</h2>
            <p className="card-model">Modelo <code>{product.id}</code> · {product.variants.length} {product.variants.length === 1 ? 'variante' : 'variantes'}</p>
          </div>
          <div className="drawer-head-actions">
            <button
              type="button"
              className={`icon-btn fav-btn-drawer ${isFavorite ? 'is-on' : ''}`}
              onClick={onToggleFavorite}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            >
              <Icon name="star" filled={isFavorite} />
            </button>
            <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar ficha"><Icon name="close" /></button>
          </div>
        </header>

        <div className="drawer-body">
          <section className="pd-top">
            <div className="pd-photo">
              <SafeImage variant={selected} alt={`${product.name} ${selected.color.label ?? ''} ${selected.size.label ?? ''}`.trim()} eager />
            </div>
            <div className="pd-info">
              <p className="pd-ref">Referencia elegida <code>{selected.sku}</code></p>
              <p className="pd-attrs">
                {[selected.color.label, selected.size.verified ? selected.size.label && `Talla ${selected.size.label}` : null].filter(Boolean).join(' · ') || 'Sin talla ni color'}
              </p>
              <PriceBlock pvpCents={selected.pvpCents} netCents={selected.netCents} discountPct={selected.discountPct} size="lg" />
              {varies && <p className="pd-from">El modelo parte desde <b>{formatEUR(header.netCents)}</b>: el precio cambia según la variante.</p>}
              {selected.discountExceptional && <p className="pd-note">Descuento especial de esta referencia: {formatPct(selected.discountPct)}.</p>}
              {selected.description && selected.description !== product.name && <p className="pd-desc">{selected.description}</p>}
            </div>
          </section>

          {(verifiedColors.length > 1 || sizeChips.length > 1) && (
            <section className="pd-selectors" aria-label="Selección de variante">
              {verifiedColors.length > 1 && (
                <div>
                  <h3>Color <small>{group.label ?? ''}</small></h3>
                  <div className="color-chips">
                    {verifiedColors.map((g) => (
                      <button key={g.code} type="button" className={`color-chip ${g.code === group.code ? 'is-on' : ''}`} onClick={() => pickColor(g)} aria-pressed={g.code === group.code} disabled={g.units === 0}>
                        <span className="color-thumb"><SafeImage variant={g.variants[0]} alt="" /></span>
                        <span className="color-name">{g.label}</span>
                        {g.units === 0 && <small>Agotado</small>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {sizeChips.length > 1 && (
                <div>
                  <h3>Talla</h3>
                  <div className="chips">
                    {sizeChips.map((v) => (
                      <button key={v.sku} type="button" className={`chip chip-size ${v.sku === selected.sku ? 'is-on' : ''}`} onClick={() => pick(v)} aria-pressed={v.sku === selected.sku} disabled={v.units === 0}>
                        {v.size.label}{v.units === 0 && <small>Agotado</small>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <section aria-labelledby="pd-table-title">
            <h3 id="pd-table-title" className="pd-table-title">Tabla de referencias</h3>
            <table className="vtable">
              <thead>
                <tr>
                  <th>Referencia</th><th>Talla</th><th>Color</th><th className="num">Disponibilidad</th>
                  <th className="num">PVP</th><th className="num">Neto oferta</th><th className="num">Dto.</th><th className="qty-col">Cantidad</th>
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.code ?? 'sin'}>
                  {groups.length > 1 && (
                    <tr className="group-row">
                      <th colSpan={8} scope="rowgroup">
                        <span className="dot" /> {g.label ?? (g.code ? `Color por confirmar · cód. ${g.code}` : 'Sin color')}
                        <small> {g.code && <>· {product.id}.{g.code} </>}· {g.variants.length} {g.variants.length === 1 ? 'variante' : 'variantes'}</small>
                      </th>
                    </tr>
                  )}
                  {g.variants.map((v) => {
                    const sc = sizeCell(v)
                    const max = maxFor(v)
                    const out = v.units <= 0
                    return (
                      <Fragment key={v.sku}>
                        <tr
                          ref={(el) => { rowRefs.current[v.sku] = el }}
                          className={`${v.sku === selected.sku ? 'is-selected' : ''} ${out ? 'is-out' : ''}`}
                          onClick={() => setSelectedSku(v.sku)}
                        >
                          <td data-label="Referencia"><code>{v.sku}</code></td>
                          <td data-label="Talla" className={sc.warn ? 'warn' : ''}>{sc.text}</td>
                          <td data-label="Color" className={!v.color.label && v.color.code && groups.length > 1 ? 'warn' : ''}>
                            {v.color.label ?? (v.color.code && groups.length > 1 ? `Por confirmar · cód. ${v.color.code}` : '—')}
                          </td>
                          <td data-label="Disponibilidad" className="num">{out ? 'Agotado' : 'Disponible'}</td>
                          <td data-label="PVP" className="num"><s>{formatEUR(v.pvpCents)}</s></td>
                          <td data-label="Neto oferta" className="num"><b>{formatEUR(v.netCents)}</b></td>
                          <td data-label="Dto." className="num"><span className="badge-dto badge-sm">−{formatPct(v.discountPct)}</span></td>
                          <td data-label="Cantidad" className="qty-col" onClick={(e) => e.stopPropagation()}>
                            <Stepper
                              value={drafts[v.sku] ?? 0} max={max}
                              disabled={closed || out || max <= 0}
                              label={v.sku}
                              onChange={(n) => setDraft(v, n)}
                            />
                            {inCart(v.sku) > 0 && <small className="in-cart">En pedido: {inCart(v.sku)}</small>}
                          </td>
                        </tr>
                      </Fragment>
                    )
                  })}
                </tbody>
              ))}
            </table>
            <p className="fine">Las existencias son una fotografía del Excel de campaña y están sujetas a confirmación. Importes sin redondeos intermedios: el neto se redondea una vez por unidad.</p>
          </section>
        </div>

        <footer className="drawer-foot">
          <div className="foot-total">
            <span>{draftUnits} {draftUnits === 1 ? 'ud.' : 'uds.'} seleccionadas</span>
            <b>{formatEUR(draftCents)}</b>
          </div>
          <button type="button" className="btn btn-primary btn-xl" onClick={addDrafts} disabled={closed || draftUnits === 0}>
            {closed ? 'Campaña finalizada' : 'Añadir selección al pedido'}
          </button>
        </footer>
      </aside>
    </div>
  )
}
