import { useMemo, useRef, useState } from 'react'
import { CAMPAIGN } from '../config/campaign'
import { asset } from '../lib/catalog'
import { formatEUR } from '../lib/money'
import { findExactSku, search, type SearchIndexEntry } from '../lib/search'
import { Icon } from './Common'

export function Brand() {
  return (
    <a className="brand" href="./" aria-label={`${CAMPAIGN.title} · ${CAMPAIGN.distributor}`}>
      <span className="brand-reynasa">
        {CAMPAIGN.reynasaLogo ? (
          <span className="brand-logo-row">
            <img src={asset(CAMPAIGN.reynasaLogo)} alt="Reynasa" />
            <span className="brand-moto"><b>MOTO</b></span>
          </span>
        ) : (
          <b>REYNASA MOTO</b>
        )}
      </span>
    </a>
  )
}

interface SearchBoxProps {
  value: string
  onChange: (v: string) => void
  index: SearchIndexEntry[]
  onOpen: (productId: string, sku?: string) => void
  onSubmit: () => void
}

function SearchBox({ value, onChange, index, onOpen, onSubmit }: SearchBoxProps) {
  const [focus, setFocus] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hits = useMemo(() => (value.trim().length >= 2 ? (search(index, value) ?? []) : []), [index, value])
  const top = useMemo(() => [...hits].sort((a, b) => b.score - a.score).slice(0, 6), [hits])
  const open = focus && value.trim().length >= 2

  const submit = () => {
    const exact = findExactSku(index, value)
    if (exact) onOpen(exact.product.id, exact.sku)
    else onSubmit()
    setFocus(false)
    inputRef.current?.blur()
  }

  return (
    <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <Icon name="search" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        placeholder="Buscar referencia, modelo o descripción…"
        aria-label="Buscar en el catálogo"
        aria-expanded={open}
        autoComplete="off"
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button type="button" className="search-clear" aria-label="Borrar búsqueda" onClick={() => { onChange(''); inputRef.current?.focus() }}>
          <Icon name="close" />
        </button>
      )}
      {open && (
        <ul className="suggest" role="listbox">
          {top.length === 0 && <li className="suggest-empty">Sin resultados para «{value}»</li>}
          {top.map((h) => {
            const sku = h.matchedSkus.length === 1 ? h.matchedSkus[0] : undefined
            return (
              <li key={h.product.id} role="option" aria-selected="false">
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onOpen(h.product.id, sku); setFocus(false) }}>
                  <span className="suggest-name">{h.product.name}</span>
                  <span className="suggest-meta">
                    {sku ? <code>{sku}</code> : <>modelo {h.product.id}</>}
                    {h.matchedSkus.length > 1 && <> · {h.matchedSkus.length} referencias coinciden</>}
                  </span>
                </button>
              </li>
            )
          })}
          {hits.length > top.length && (
            <li className="suggest-more">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={submit}>Ver los {hits.length} productos</button>
            </li>
          )}
        </ul>
      )}
    </form>
  )
}

interface HeaderProps extends SearchBoxProps {
  cartUnits: number
  cartCents: number
  onCart: () => void
  favoritesCount: number
  onFavorites: () => void
}

export function Header({ cartUnits, cartCents, onCart, favoritesCount, onFavorites, ...search }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Brand />
        <SearchBox {...search} />
        <button type="button" className="fav-btn-header" onClick={onFavorites} aria-label={`Ver mis favoritos: ${favoritesCount} productos`}>
          <Icon name="star" filled={favoritesCount > 0} />
          <span className="cart-btn-text">
            <b>Favoritos</b>
            <small>{favoritesCount === 0 ? 'Ninguno' : `${favoritesCount} ${favoritesCount === 1 ? 'producto' : 'productos'}`}</small>
          </span>
          {favoritesCount > 0 && <span className="cart-count">{favoritesCount}</span>}
        </button>
        <button type="button" className="cart-btn" onClick={onCart} aria-label={`Abrir el pedido: ${cartUnits} unidades, ${formatEUR(cartCents)}`}>
          <Icon name="cart" />
          <span className="cart-btn-text">
            <b>Mi pedido</b>
            <small>{cartUnits === 0 ? 'Vacío' : formatEUR(cartCents)}</small>
          </span>
          {cartUnits > 0 && <span className="cart-count">{cartUnits}</span>}
        </button>
      </div>
    </header>
  )
}
