import { CAMPAIGN, CONDITIONS } from '../config/campaign'
import type { CartLine } from './cart'
import { VARIANT_BY_SKU } from './catalog'
import { formatEUR } from './money'

export interface OrderLineView {
  sku: string
  productName: string
  size: string
  color: string
  qty: number
  pvpCents: number
  netCents: number
  discountPct: number
  lineCents: number
}

export function describeLines(lines: CartLine[]): OrderLineView[] {
  const out: OrderLineView[] = []
  for (const l of lines) {
    const ref = VARIANT_BY_SKU.get(l.sku)
    if (!ref) continue
    const { product, variant } = ref
    out.push({
      sku: l.sku,
      productName: product.name,
      size: variant.size.label ?? (variant.size.code ? `Cód. ${variant.size.code} (por validar)` : ''),
      color: variant.color.label ?? (variant.color.code && product.variants.some((v) => v.color.code !== variant.color.code) ? `Cód. ${variant.color.code} (por confirmar)` : ''),
      qty: l.qty,
      pvpCents: variant.pvpCents,
      netCents: variant.netCents,
      discountPct: variant.discountPct,
      lineCents: variant.netCents * l.qty,
    })
  }
  return out
}

export interface OrderMeta {
  clientCode: string
  customer: string
  notes: string
  importedAt: string
}

const num = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')
const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`

/** CSV con separador «;» y BOM para abrirlo directamente en Excel en español. */
export function orderToCsv(lines: CartLine[], meta: OrderMeta): string {
  const rows = describeLines(lines)
  const subtotal = rows.reduce((s, r) => s + r.lineCents, 0)
  const out: string[] = []
  out.push(['Referencia', 'Producto', 'Talla', 'Color', 'Cantidad', 'PVP unitario', 'Neto oferta unitario', 'Descuento %', 'Importe línea (neto)'].map(q).join(';'))
  for (const r of rows) {
    out.push([r.sku, r.productName, r.size, r.color, r.qty, num(r.pvpCents), num(r.netCents), String(r.discountPct).replace('.', ','), num(r.lineCents)].map(q).join(';'))
  }
  out.push('')
  out.push([`Subtotal (neto de oferta)`, '', '', '', rows.reduce((s, r) => s + r.qty, 0), '', '', '', num(subtotal)].map(q).join(';'))
  out.push([`Pedido mínimo`, '', '', '', '', '', '', '', num(CAMPAIGN.minOrderCents)].map(q).join(';'))
  out.push('')
  out.push([`Código de cliente`, meta.clientCode].map(q).join(';'))
  if (meta.customer) out.push([`Razón social`, meta.customer].map(q).join(';'))
  if (meta.notes) out.push([`Observaciones`, meta.notes].map(q).join(';'))
  out.push([`Campaña`, `${CAMPAIGN.title} · ${CAMPAIGN.distributor} ${CAMPAIGN.year}`].map(q).join(';'))
  out.push([`Condiciones`, CONDITIONS.join(' ')].map(q).join(';'))
  out.push([`Existencias`, `Fotografía del ${meta.importedAt.slice(0, 10)}; sujetas a confirmación`].map(q).join(';'))
  out.push([`Estado`, `Resumen preparado en la web: NO es un pedido recibido ni confirmado`].map(q).join(';'))
  return '﻿' + out.join('\r\n')
}

/**
 * Punto de conexión con un canal de pedidos. Hoy la web no está conectada con nada (confirmado por Reynasa):
 * solo descarga el CSV. Si algún día se conecta (correo, API, ERP…), implementar aquí el envío y fijar
 * CAMPAIGN.orderChannel.
 */
export async function submitOrder(_lines: CartLine[], _meta: OrderMeta): Promise<never> {
  throw new Error('La web no está conectada con ningún sistema de pedidos.')
}
