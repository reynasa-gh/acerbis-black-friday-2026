import { familyLabel, PRODUCT_BY_ID } from '../lib/catalog'
import { formatEUR, formatPct } from '../lib/money'
import { Icon, SafeImage, useEscape, useScrollLock } from './Common'

export function FavoritesDrawer({
  ids, onOpenProduct, onRemove, onClose,
}: { ids: string[]; onOpenProduct: (id: string) => void; onRemove: (id: string) => void; onClose: () => void }) {
  useScrollLock(true)
  useEscape(onClose, true)
  const products = ids.map((id) => PRODUCT_BY_ID.get(id)).filter((p): p is NonNullable<typeof p> => !!p)

  return (
    <div className="overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <aside className="drawer drawer-cart" role="dialog" aria-modal="true" aria-labelledby="fav-title">
        <header className="drawer-head">
          <div>
            <h2 id="fav-title">Mis favoritos</h2>
            <p className="card-model">{products.length} {products.length === 1 ? 'producto' : 'productos'}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar favoritos"><Icon name="close" /></button>
        </header>

        <div className="drawer-body">
          {products.length === 0 ? (
            <div className="empty">
              <h3>Sin favoritos todavía</h3>
              <p>Pulsa la estrella de un producto del catálogo o de su ficha para guardarlo aquí.</p>
              <button type="button" className="btn btn-primary" onClick={onClose}>Seguir viendo ofertas</button>
            </div>
          ) : (
            <ul className="cart-lines">
              {products.map((p) => {
                const cover = p.variants[p.coverIndex]
                return (
                  <li key={p.id}>
                    <button type="button" className="cart-thumb" onClick={() => { onOpenProduct(p.id); onClose() }} aria-label={`Ver ${p.name}`}>
                      <SafeImage variant={cover} alt={p.name} />
                    </button>
                    <div className="cart-info">
                      <b>{p.name}</b>
                      <span>{familyLabel(p)}</span>
                      <span className="cart-unit">
                        {p.priceVaries ? 'Desde ' : ''}{formatEUR(p.minNetCents)} · <s>{formatEUR(cover.pvpCents)}</s> −{formatPct(cover.discountPct)}
                      </span>
                    </div>
                    <div className="cart-side">
                      <button type="button" className="link-btn" onClick={() => { onOpenProduct(p.id); onClose() }}>Ver ficha</button>
                      <button type="button" className="link-btn danger" onClick={() => onRemove(p.id)}>Quitar</button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}
