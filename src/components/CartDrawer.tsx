import { useRef, useState } from 'react'
import { CONDITIONS, VAT_MESSAGE } from '../config/campaign'
import type { CartLine, OrderValidation } from '../lib/cart'
import { VARIANT_BY_SKU } from '../lib/catalog'
import { formatEUR, formatPct } from '../lib/money'
import { describeLines, orderToCsv, type OrderMeta } from '../lib/order'
import { Icon, SafeImage, Stepper, useEscape, useScrollLock } from './Common'
import { VatBadge } from './Hero'
import { CATALOG } from '../lib/catalog'

interface CartProps {
  lines: CartLine[]
  validation: OrderValidation
  closed: boolean
  onSetQty: (sku: string, qty: number) => void
  onRemove: (sku: string) => void
  onClear: () => void
  onOpenProduct: (productId: string, sku: string) => void
  onPrepare: () => void
  onClose: () => void
}

export function CartDrawer({ lines, validation, closed, onSetQty, onRemove, onClear, onOpenProduct, onPrepare, onClose }: CartProps) {
  const [confirmClear, setConfirmClear] = useState(false)
  useScrollLock(true)
  useEscape(onClose, true)
  const rows = lines.map((l) => ({ l, ref: VARIANT_BY_SKU.get(l.sku) })).filter((r) => r.ref)
  const progress = Math.min(100, Math.round((validation.subtotalCents / validation.minOrderCents) * 100))
  const overStock = new Set(validation.issues.map((i) => i.sku).filter(Boolean))

  return (
    <div className="overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <aside className="drawer drawer-cart" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <header className="drawer-head">
          <div>
            <h2 id="cart-title">Mi pedido</h2>
            <p className="card-model">{validation.units} {validation.units === 1 ? 'unidad' : 'unidades'} · {lines.length} {lines.length === 1 ? 'referencia' : 'referencias'}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar pedido"><Icon name="close" /></button>
        </header>

        <div className="drawer-body">
          {rows.length === 0 ? (
            <div className="empty">
              <h3>Tu pedido está vacío</h3>
              <p>Añade referencias desde el catálogo. Podrás elegir varias tallas de un mismo modelo desde su ficha.</p>
              <button type="button" className="btn btn-primary" onClick={onClose}>Seguir viendo ofertas</button>
            </div>
          ) : (
            <ul className="cart-lines">
              {rows.map(({ l, ref }) => {
                const { product, variant: v } = ref!
                const attrs = [v.color.label, v.size.label && `Talla ${v.size.label}`, !v.size.verified && v.size.code ? `Cód. talla ${v.size.code} (por validar)` : null].filter(Boolean).join(' · ')
                return (
                  <li key={l.sku} className={overStock.has(l.sku) ? 'has-issue' : ''}>
                    <button type="button" className="cart-thumb" onClick={() => { onClose(); onOpenProduct(product.id, v.sku) }} aria-label={`Ver ${product.name}`}>
                      <SafeImage variant={v} alt={product.name} />
                    </button>
                    <div className="cart-info">
                      <b>{product.name}</b>
                      <code>{v.sku}</code>
                      {attrs && <span>{attrs}</span>}
                      <span className="cart-unit">{formatEUR(v.netCents)} ud. · <s>{formatEUR(v.pvpCents)}</s> −{formatPct(v.discountPct)}</span>
                    </div>
                    <div className="cart-side">
                      <Stepper value={l.qty} max={v.units} label={v.sku} onChange={(n) => onSetQty(l.sku, n)} />
                      <b className="cart-amount">{formatEUR(v.netCents * l.qty)}</b>
                      <button type="button" className="link-btn danger" onClick={() => onRemove(l.sku)}>Eliminar</button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <footer className="drawer-foot drawer-foot-col">
          <div className="min-box" data-ok={validation.meetsMinimum}>
            <div className="min-text">
              {validation.meetsMinimum
                ? <><Icon name="check" /> Pedido mínimo alcanzado ({formatEUR(validation.minOrderCents)}).</>
                : <><Icon name="alert" /> Te faltan <b>{formatEUR(validation.missingCents)}</b> para el pedido mínimo de {formatEUR(validation.minOrderCents)}.</>}
            </div>
            <div className="min-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso hacia el pedido mínimo"><i style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="foot-total">
            <span>Subtotal (neto de oferta)</span>
            <b>{formatEUR(validation.subtotalCents)}</b>
          </div>
          <VatBadge />
          {validation.issues.map((i, n) => <p key={n} className="issue" role="alert">{i.message}</p>)}
          <ul className="cond-mini">
            {CONDITIONS.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <button type="button" className="btn btn-primary btn-xl" disabled={!validation.canPrepare} onClick={onPrepare}>
            {closed ? 'Campaña finalizada' : 'Preparar pedido'}
          </button>
          {rows.length > 0 && (
            confirmClear ? (
              <div className="confirm-row">
                <span>¿Vaciar todo el pedido?</span>
                <button type="button" className="link-btn danger" onClick={() => { onClear(); setConfirmClear(false) }}>Sí, vaciar</button>
                <button type="button" className="link-btn" onClick={() => setConfirmClear(false)}>Cancelar</button>
              </div>
            ) : <button type="button" className="link-btn" onClick={() => setConfirmClear(true)}>Vaciar pedido</button>
          )}
        </footer>
      </aside>
    </div>
  )
}

export function PrepareOrderModal({ lines, validation, onClose }: { lines: CartLine[]; validation: OrderValidation; onClose: () => void }) {
  const [clientCode, setClientCode] = useState('')
  const [codeError, setCodeError] = useState(false)
  const [customer, setCustomer] = useState('')
  const [customerError, setCustomerError] = useState(false)
  const [notes, setNotes] = useState('')
  const codeRef = useRef<HTMLInputElement>(null)
  const customerRef = useRef<HTMLInputElement>(null)
  useScrollLock(true)
  useEscape(onClose, true)
  const meta: OrderMeta = { clientCode: clientCode.trim(), customer: customer.trim(), notes: notes.trim(), importedAt: CATALOG.meta.importedAt }
  const rows = describeLines(lines)

  const download = () => {
    if (!meta.clientCode) {
      setCodeError(true)
      codeRef.current?.focus()
      return
    }
    if (!meta.customer) {
      setCustomerError(true)
      customerRef.current?.focus()
      return
    }
    const blob = new Blob([orderToCsv(lines, meta)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pedido-black-friday-acerbis-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
  return (
    <div className="overlay overlay-center" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="prep-title">
        <header className="drawer-head">
          <div>
            <h2 id="prep-title">Preparar pedido</h2>
            <p className="card-model">Revisa el resumen y descárgalo.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
        </header>
        <div className="modal-body">
          <div className="notice" role="note">
            <Icon name="alert" />
            <div>
              <p><b>Descarga tu pedido y envíalo a <a href="mailto:motos@reynasa.com">motos@reynasa.com</a></b></p>
              <p><b>Existencias sujetas a confirmación. ¡Unidades limitadas!</b></p>
            </div>
          </div>
          <div className="form-grid">
            <label className="field-wide">
              Código de cliente *
              <input
                ref={codeRef}
                value={clientCode}
                onChange={(e) => { setClientCode(e.target.value); if (codeError) setCodeError(false) }}
                maxLength={40}
                required
                aria-invalid={codeError}
                aria-describedby={codeError ? 'code-error' : undefined}
                className={codeError ? 'is-invalid' : ''}
              />
              {codeError && <small id="code-error" className="field-error">Indica tu código de cliente para poder descargar el pedido.</small>}
            </label>
            <label>
              Razón social *
              <input
                ref={customerRef}
                value={customer}
                onChange={(e) => { setCustomer(e.target.value); if (customerError) setCustomerError(false) }}
                maxLength={120}
                required
                aria-invalid={customerError}
                aria-describedby={customerError ? 'customer-error' : undefined}
                className={customerError ? 'is-invalid' : ''}
              />
              {customerError && <small id="customer-error" className="field-error">Indica la razón social para poder descargar el pedido.</small>}
            </label>
            <label>Observaciones (opcional)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={400} rows={2} /></label>
          </div>
          <div className="sum-wrap">
            <table className="sum-table">
              <thead><tr><th>Referencia</th><th>Producto</th><th className="num">Cant.</th><th className="num">Neto ud.</th><th className="num">Importe</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.sku}>
                    <td data-label="Referencia"><code>{r.sku}</code></td>
                    <td data-label="Producto">{r.productName}<small>{[r.color, r.size && `Talla ${r.size}`].filter(Boolean).join(' · ')}</small></td>
                    <td data-label="Cant." className="num">{r.qty}</td>
                    <td data-label="Neto ud." className="num">{formatEUR(r.netCents)}</td>
                    <td data-label="Importe" className="num"><b>{formatEUR(r.lineCents)}</b></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={4}>Subtotal (neto de oferta){VAT_MESSAGE ? ` · ${VAT_MESSAGE.replace(/\.$/, '')}` : ''}</td><td className="num"><b>{formatEUR(validation.subtotalCents)}</b></td></tr></tfoot>
            </table>
          </div>
          <VatBadge />
        </div>
        <footer className="drawer-foot">
          <button type="button" className="btn btn-primary" onClick={download}>Descargar Pedido</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cerrar</button>
        </footer>
      </div>
    </div>
  )
}
