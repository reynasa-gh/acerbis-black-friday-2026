import { CAMPAIGN } from '../config/campaign'

export interface CartLine {
  sku: string
  qty: number
}

export type StockOf = (sku: string) => number

/** Suma las cantidades de líneas con el mismo SKU (antes de comprobar stock). */
export function aggregateLines(lines: CartLine[]): CartLine[] {
  const map = new Map<string, number>()
  for (const l of lines) map.set(l.sku, (map.get(l.sku) ?? 0) + l.qty)
  return [...map.entries()].map(([sku, qty]) => ({ sku, qty }))
}

/** Añade unidades de un SKU sin superar sus existencias. Devuelve la nueva lista y lo realmente añadido. */
export function addToCart(lines: CartLine[], sku: string, qty: number, stockOf: StockOf): { lines: CartLine[]; added: number } {
  const merged = aggregateLines([...lines, { sku, qty: 0 }])
  const current = merged.find((l) => l.sku === sku)!.qty
  const max = Math.max(0, stockOf(sku))
  const next = Math.min(max, current + Math.max(0, Math.floor(qty)))
  const added = next - current
  const out = merged.filter((l) => l.sku !== sku || next > 0).map((l) => (l.sku === sku ? { sku, qty: next } : l))
  return { lines: out.filter((l) => l.qty > 0), added }
}

export function setQty(lines: CartLine[], sku: string, qty: number, stockOf: StockOf): CartLine[] {
  const max = Math.max(0, stockOf(sku))
  const q = Math.min(max, Math.max(0, Math.floor(qty)))
  return aggregateLines(lines).map((l) => (l.sku === sku ? { sku, qty: q } : l)).filter((l) => l.qty > 0)
}

export function removeLine(lines: CartLine[], sku: string): CartLine[] {
  return lines.filter((l) => l.sku !== sku)
}

export interface OrderIssue {
  sku?: string
  message: string
}

export interface OrderValidation {
  subtotalCents: number
  units: number
  minOrderCents: number
  /** Céntimos que faltan para alcanzar el pedido mínimo (0 si se alcanza). */
  missingCents: number
  meetsMinimum: boolean
  issues: OrderIssue[]
  canPrepare: boolean
}

/**
 * Valida el pedido completo: stock por SKU (sumando líneas repetidas), pedido mínimo sobre el
 * conjunto y cierre de campaña. El importe usa el neto unitario mostrado (céntimos × unidades).
 */
export function validateOrder(
  lines: CartLine[],
  priceOf: (sku: string) => number,
  stockOf: StockOf,
  closed: boolean,
  minOrderCents: number = CAMPAIGN.minOrderCents,
): OrderValidation {
  const agg = aggregateLines(lines).filter((l) => l.qty > 0)
  const issues: OrderIssue[] = []
  let subtotal = 0
  let units = 0
  for (const l of agg) {
    const stock = stockOf(l.sku)
    if (l.qty > stock) issues.push({ sku: l.sku, message: `${l.sku}: la cantidad pedida supera las existencias disponibles.` })
    subtotal += priceOf(l.sku) * l.qty
    units += l.qty
  }
  const missing = Math.max(0, minOrderCents - subtotal)
  if (closed) issues.push({ message: 'La campaña ha finalizado: ya no se pueden preparar pedidos con esta promoción.' })
  return {
    subtotalCents: subtotal, units, minOrderCents, missingCents: missing,
    meetsMinimum: subtotal >= minOrderCents, issues,
    canPrepare: !closed && agg.length > 0 && issues.length === 0 && subtotal >= minOrderCents,
  }
}

const KEY = 'bf-acerbis-2026-pedido'

export function loadCart(stamp: string): CartLine[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as { stamp: string; lines: CartLine[] }
    // Si cambia el catálogo (nuevo Excel), se descarta el pedido guardado.
    return data.stamp === stamp && Array.isArray(data.lines) ? data.lines : []
  } catch {
    return []
  }
}

export function saveCart(stamp: string, lines: CartLine[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ stamp, lines }))
  } catch {
    /* sin almacenamiento: el pedido vive solo en memoria */
  }
}
