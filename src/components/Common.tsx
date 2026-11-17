import { useEffect, useState, type ReactNode } from 'react'
import type { Variant } from '../types'
import { formatEUR, formatPct } from '../lib/money'

/* ---------- Incidencias de imagen en el navegador ---------- */
const INCIDENT_KEY = 'bf-acerbis-imagenes-fallidas'

export function readImageIncidents(): Array<{ sku: string; url: string; at: string }> {
  try {
    return JSON.parse(localStorage.getItem(INCIDENT_KEY) ?? '[]')
  } catch {
    return []
  }
}

function logImageIncident(sku: string, url: string) {
  try {
    const list = readImageIncidents()
    if (!list.some((i) => i.sku === sku && i.url === url)) {
      list.push({ sku, url, at: new Date().toISOString() })
      localStorage.setItem(INCIDENT_KEY, JSON.stringify(list.slice(-200)))
    }
  } catch {
    /* ignorar */
  }
}

/**
 * Imagen de producto: object-fit: contain (nunca recorta), carga diferida y cadena de respaldo:
 * foto de la variante → foto verificada del mismo producto y color → marcador discreto.
 */
export function SafeImage({ variant, alt, eager }: { variant: Variant; alt: string; eager?: boolean }) {
  // Si la importación ya comprobó que la foto da 404, se va directo a la de la referencia padre.
  const known404 = variant.flags.includes('imagen-fallida')
  const chain = (known404 ? [variant.imageFallback] : [variant.image, variant.imageFallback]).filter((u): u is string => !!u)
  const [step, setStep] = useState(0)
  useEffect(() => setStep(0), [variant.sku])
  const src = chain[step]
  if (!src) {
    return (
      <div className="img-missing" role="img" aria-label={`Imagen no disponible: ${alt}`}>
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
          <path fill="none" stroke="currentColor" strokeWidth="1.5" d="M4 6h16v12H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01" />
        </svg>
        <span>Imagen no disponible</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => {
        logImageIncident(variant.sku, src)
        setStep((s) => s + 1)
      }}
    />
  )
}

/* ---------- Precio ---------- */
export function PriceBlock({
  pvpCents, netCents, discountPct, from, size = 'md',
}: { pvpCents: number; netCents: number; discountPct: number; from?: boolean; size?: 'md' | 'lg' }) {
  return (
    <div className={`price price-${size}`}>
      <div className="price-net">
        {from && <span className="price-from">Desde</span>}
        <strong>{formatEUR(netCents)}</strong>
      </div>
      <div className="price-meta">
        <s className="price-pvp" aria-label={`PVP ${formatEUR(pvpCents)}`}>{formatEUR(pvpCents)}</s>
        <span className="badge-dto">−{formatPct(discountPct)}</span>
      </div>
    </div>
  )
}

/* ---------- Selector de cantidad ---------- */
export function Stepper({
  value, max, onChange, label, disabled,
}: { value: number; max: number; onChange: (n: number) => void; label: string; disabled?: boolean }) {
  const clamp = (n: number) => Math.min(max, Math.max(0, Number.isFinite(n) ? Math.floor(n) : 0))
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={disabled || value <= 0} aria-label="Menos">−</button>
      <input
        inputMode="numeric"
        aria-label={`Cantidad: ${label}`}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(clamp(Number(e.target.value.replace(/\D/g, ''))))}
      />
      <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={disabled || value >= max} aria-label="Más">+</button>
    </div>
  )
}

/* ---------- Utilidades ---------- */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [active])
}

export function useEscape(handler: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') handler() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [handler, active])
}

export function Icon({ name, filled }: { name: 'search' | 'cart' | 'close' | 'filter' | 'truck' | 'euro' | 'clock' | 'check' | 'alert' | 'chevron' | 'star'; filled?: boolean }): ReactNode {
  const p = { fill: filled ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  const paths: Record<string, ReactNode> = {
    search: <><circle cx="11" cy="11" r="6.5" {...p} /><path d="m16 16 4.5 4.5" {...p} /></>,
    cart: <><path d="M3 4h2.5l2 11h10l2-8H7" {...p} /><circle cx="9.5" cy="19" r="1.4" {...p} /><circle cx="17" cy="19" r="1.4" {...p} /></>,
    close: <path d="M6 6l12 12M18 6 6 18" {...p} />,
    filter: <path d="M4 6h16M7 12h10M10 18h4" {...p} />,
    truck: <><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" {...p} /><circle cx="7" cy="17.5" r="1.6" {...p} /><circle cx="17" cy="17.5" r="1.6" {...p} /></>,
    euro: <path d="M17.5 7.5A6 6 0 1 0 17.5 16.5M5 10.5h8M5 13.5h8" {...p} />,
    clock: <><circle cx="12" cy="12" r="8.5" {...p} /><path d="M12 7.5V12l3 2" {...p} /></>,
    check: <path d="m5 12.5 4.5 4.5L19 7.5" {...p} />,
    alert: <><path d="M12 4 3 19.5h18z" {...p} /><path d="M12 10v4.5M12 17.2h.01" {...p} /></>,
    chevron: <path d="m9 6 6 6-6 6" {...p} />,
    star: <path d="m12 3.5 2.76 5.59 6.17.9-4.47 4.35 1.06 6.14L12 17.56l-5.52 2.92 1.06-6.14-4.47-4.35 6.17-.9Z" {...p} />,
  }
  return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">{paths[name]}</svg>
}
