import { useCallback, useEffect, useMemo, useState } from 'react'
import { CATALOG, PRODUCT_BY_ID, VARIANT_BY_SKU } from './lib/catalog'
import { addToCart, loadCart, removeLine, saveCart, setQty, validateOrder, type CartLine } from './lib/cart'
import { currentNow, isCampaignClosed } from './lib/campaign'
import { applyFilters, countResults, EMPTY_FILTERS, facetValues, type FilterState } from './lib/filters'
import { formatEUR } from './lib/money'
import { buildIndex } from './lib/search'
import { CartDrawer, PrepareOrderModal } from './components/CartDrawer'
import { EmptyState, FamilyChips, FilterPanel, ProductCard, Toolbar, type FamilyCount } from './components/Catalog'
import { Icon, useEscape, useScrollLock } from './components/Common'
import { FavoritesDrawer } from './components/Favorites'
import { Header } from './components/Header'
import { ConditionsBar, Footer, Hero } from './components/Hero'
import { loadFavorites, saveFavorites } from './lib/favorites'
import { ProductDrawer } from './components/ProductDrawer'
import { ReviewPanel } from './components/ReviewPanel'

const PAGE = 24
const STAMP = `${CATALOG.meta.sourceSha256}|${CATALOG.meta.importedAt}`

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const fn = () => setHash(window.location.hash)
    window.addEventListener('hashchange', fn)
    return () => window.removeEventListener('hashchange', fn)
  }, [])
  return hash
}

function parseProductHash(hash: string): { id: string; sku?: string } | null {
  const m = /^#\/p\/(\d{7})(?:\/([0-9A-Za-z]+))?$/.exec(hash)
  return m && PRODUCT_BY_ID.has(m[1]) ? { id: m[1], sku: m[2] } : null
}

const stockOf = (sku: string) => VARIANT_BY_SKU.get(sku)?.variant.units ?? 0
const priceOf = (sku: string) => VARIANT_BY_SKU.get(sku)?.variant.netCents ?? 0

export function App() {
  const hash = useHash()
  if (hash.startsWith('#/revision')) return <ReviewPanel />
  return <Shop hash={hash} />
}

function Shop({ hash }: { hash: string }) {
  const [now, setNow] = useState(() => currentNow())
  useEffect(() => {
    const t = setInterval(() => setNow(currentNow()), 30_000)
    return () => clearInterval(t)
  }, [])
  const closed = isCampaignClosed(now)

  const index = useMemo(() => buildIndex(CATALOG.products), [])
  const facets = useMemo(() => facetValues(CATALOG.products), [])
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [visible, setVisible] = useState(PAGE)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const results = useMemo(() => applyFilters(CATALOG.products, index, filters), [index, filters])
  const counters = useMemo(() => countResults(results), [results])
  const familyCounts = useMemo(() => {
    const all = applyFilters(CATALOG.products, index, filters, { ignoreFamily: true })
    const map = new Map<string, FamilyCount>()
    for (const r of all) {
      const c = map.get(r.product.familyId) ?? { products: 0, variants: 0 }
      c.products += 1
      c.variants += r.variants.length
      map.set(r.product.familyId, c)
    }
    return map
  }, [index, filters])
  const totalAll = useMemo(() => {
    const c = [...familyCounts.values()].reduce((a, b) => ({ products: a.products + b.products, variants: a.variants + b.variants }), { products: 0, variants: 0 })
    return c
  }, [familyCounts])

  const updateFilters = useCallback((f: FilterState) => { setFilters(f); setVisible(PAGE) }, [])
  const reset = useCallback(() => { setFilters(EMPTY_FILTERS); setVisible(PAGE) }, [])
  const onQuery = (query: string) =>
    updateFilters({ ...filters, query, family: query.trim() ? null : filters.family, subfamily: query.trim() ? null : filters.subfamily })

  /* ---- Pedido ---- */
  const [lines, setLines] = useState<CartLine[]>(() =>
    loadCart(STAMP).filter((l) => stockOf(l.sku) > 0).map((l) => ({ sku: l.sku, qty: Math.min(l.qty, stockOf(l.sku)) })))
  useEffect(() => saveCart(STAMP, lines), [lines])
  const [cartOpen, setCartOpen] = useState(false)
  const [prepareOpen, setPrepareOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const validation = useMemo(() => validateOrder(lines, priceOf, stockOf, closed), [lines, closed])
  const inCart = useCallback((sku: string) => lines.find((l) => l.sku === sku)?.qty ?? 0, [lines])

  /* ---- Favoritos ---- */
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites())
  useEffect(() => saveFavorites(favorites), [favorites])
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites])
  const toggleFavorite = useCallback((id: string) => {
    setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
  }, [])

  const addEntries = useCallback((entries: Array<{ sku: string; qty: number }>) => {
    if (closed) return
    let next = lines
    let added = 0
    let wanted = 0
    for (const e of entries) {
      const r = addToCart(next, e.sku, e.qty, stockOf)
      next = r.lines
      added += r.added
      wanted += e.qty
    }
    setLines(next)
    setToast(added < wanted ? `Añadidas ${added} de ${wanted} uds.: tope de existencias` : `${added} ${added === 1 ? 'ud. añadida' : 'uds. añadidas'} al pedido`)
  }, [closed, lines])

  /* ---- Ficha de producto (ruta #/p/modelo[/sku]) ---- */
  const route = parseProductHash(hash)
  const openProduct = useCallback((id: string, sku?: string) => {
    window.location.hash = sku ? `#/p/${id}/${sku}` : `#/p/${id}`
  }, [])
  const closeProduct = useCallback(() => {
    history.pushState(null, '', window.location.pathname + window.location.search)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }, [])
  useEffect(() => { if (route) setCartOpen(false) }, [route?.id, route?.sku]) // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToCatalog = useCallback(() => {
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useScrollLock(filtersOpen)
  useEscape(() => setFiltersOpen(false), filtersOpen)

  const shown = results.slice(0, visible)
  const panel = (
    <FilterPanel filters={filters} onChange={updateFilters} facets={facets} familyCounts={familyCounts} totalProducts={totalAll} onReset={reset} />
  )

  return (
    <>
      <Header
        value={filters.query} onChange={onQuery} index={index}
        onOpen={(id, sku) => { openProduct(id, sku) }} onSubmit={scrollToCatalog}
        cartUnits={validation.units} cartCents={validation.subtotalCents} onCart={() => { setCartOpen(true) }}
        favoritesCount={favorites.length} onFavorites={() => setFavoritesOpen(true)}
      />
      <main>
        <Hero closed={closed} now={now} onSeeOffers={scrollToCatalog} />
        <ConditionsBar closed={closed} />

        <section id="catalogo" className="wrap catalog" aria-label="Catálogo">
          <aside className="sidebar" aria-label="Familias y filtros">{panel}</aside>
          <div className="catalog-main">
            <FamilyChips filters={filters} onChange={updateFilters} familyCounts={familyCounts} />
            <Toolbar counters={counters} filters={filters} onChange={updateFilters} onReset={reset} onOpenFilters={() => setFiltersOpen(true)} />
            {results.length === 0 ? (
              <EmptyState onReset={reset} query={filters.query} />
            ) : (
              <>
                <div className="grid">
                  {shown.map((item) => (
                    <ProductCard
                      key={item.product.id} item={item} closed={closed} inCart={inCart} onOpen={openProduct}
                      onQuickAdd={(sku) => addEntries([{ sku, qty: 1 }])}
                      isFavorite={isFavorite(item.product.id)} onToggleFavorite={() => toggleFavorite(item.product.id)}
                    />
                  ))}
                </div>
                {results.length > shown.length && (
                  <div className="more">
                    <button type="button" className="btn btn-dark btn-xl" onClick={() => setVisible((v) => v + PAGE)}>
                      Mostrar más productos <small>({results.length - shown.length} restantes)</small>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />

      {filtersOpen && (
        <div className="overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setFiltersOpen(false) }}>
          <aside className="drawer drawer-filters" role="dialog" aria-modal="true" aria-label="Filtros">
            <header className="drawer-head">
              <div><h2>Filtros</h2><p className="card-model">{counters.products} productos · {counters.variants} referencias</p></div>
              <button type="button" className="icon-btn" onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros"><Icon name="close" /></button>
            </header>
            <div className="drawer-body">{panel}</div>
            <footer className="drawer-foot">
              <button type="button" className="btn btn-ghost" onClick={reset}>Limpiar filtros</button>
              <button type="button" className="btn btn-primary" onClick={() => setFiltersOpen(false)}>Ver {counters.products} productos</button>
            </footer>
          </aside>
        </div>
      )}

      {route && (
        <ProductDrawer
          key={route.id}
          product={PRODUCT_BY_ID.get(route.id)!}
          initialSku={route.sku}
          closed={closed}
          inCart={inCart}
          onAdd={addEntries}
          onClose={closeProduct}
          isFavorite={isFavorite(route.id)}
          onToggleFavorite={() => toggleFavorite(route.id)}
        />
      )}

      {cartOpen && (
        <CartDrawer
          lines={lines} validation={validation} closed={closed}
          onSetQty={(sku, q) => setLines((l) => setQty(l, sku, q, stockOf))}
          onRemove={(sku) => setLines((l) => removeLine(l, sku))}
          onClear={() => setLines([])}
          onOpenProduct={openProduct}
          onPrepare={() => { if (route) closeProduct(); setCartOpen(false); setPrepareOpen(true) }}
          onClose={() => setCartOpen(false)}
        />
      )}
      {prepareOpen && <PrepareOrderModal lines={lines} validation={validation} onClose={() => setPrepareOpen(false)} />}

      {favoritesOpen && (
        <FavoritesDrawer
          ids={favorites}
          onOpenProduct={openProduct}
          onRemove={toggleFavorite}
          onClose={() => setFavoritesOpen(false)}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          {validation.units > 0 && <button type="button" onClick={() => { setCartOpen(true) }}>Ver pedido · {formatEUR(validation.subtotalCents)}</button>}
        </div>
      )}
    </>
  )
}
