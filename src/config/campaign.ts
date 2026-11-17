/**
 * Configuración de la campaña «Black Friday Acerbis · Reynasa Moto 2026».
 * Todo lo que cambia entre campañas o está pendiente de confirmar vive aquí, no en los componentes.
 */
import { formatEUR } from '../lib/money'

export type VatStatus = 'pending' | 'included' | 'excluded'

const minOrderCents = 10_000

export const CAMPAIGN = {
  title: 'Black Friday Acerbis',
  distributor: 'Reynasa Moto',
  year: 2026,

  /** Pedido mínimo sobre el conjunto del pedido, calculado con los netos de oferta. */
  minOrderCents,

  /** Último día de validez (inclusive) y zona horaria de referencia. */
  endDate: '2026-11-30',
  timeZone: 'Europe/Madrid',

  /** Mensajes de campaña: únicamente las condiciones facilitadas. No añadir otras sin confirmación. */
  messages: {
    minOrder: `Pedido mínimo: ${formatEUR(minOrderCents)}.`,
    shipping: 'Portes pagados para envíos a Península.',
    validity: 'Oferta válida hasta el 30 de noviembre de 2026 o fin de stock.',
  },

  /**
   * IVA: confirmado por Reynasa -> los precios (PVP y neto) NO incluyen IVA.
   * Se muestra como una condición más. Valores: 'included' | 'excluded' | 'pending'
   * ('pending' vuelve a mostrar un aviso de borrador y no afirma nada sobre el IVA).
   */
  vat: {
    status: 'excluded' as VatStatus,
    label: { included: 'IVA incluido', excluded: 'IVA no incluido', pending: 'IVA: pendiente de confirmar' },
  },

  /**
   * Logotipo de Reynasa (solo «Reynasa»: «Moto» va siempre en texto, no existe un logo «Reynasa Moto»).
   * Se usa la versión en NEGATIVO (sobre la cabecera oscura). La versión en positivo está en
   * public/brand/reynasa-positivo.svg para superficies claras. Si es null se muestra «REYNASA MOTO» en texto.
   */
  reynasaLogo: 'brand/reynasa-negativo.svg' as string | null,

  acerbisLogo: 'brand/acerbis-black.png',

  /**
   * Canal de recepción de pedidos: la web NO está conectada con ningún sistema (confirmado por Reynasa).
   * Ver `submitOrder` en src/lib/order.ts si algún día se conecta.
   */
  orderChannel: null as null | { type: 'email' | 'api' | 'erp'; target: string },

  /** Totales esperados del Excel entregado (sirven para las comprobaciones; cambian con otra versión del Excel). */
  expectedImport: { skus: 438, units: 809, zeroDescriptions: 25 },

  /** Referencias de los casos especiales a conservar/revisar. */
  special: {
    exceptionalDiscountSku: '0024289090043ACB',
    winterTourGroup: { model: '0025593', colorCode: '319', variants: 7, units: 13 },
    reviewColorSku: '0026149290070ACB',
  },
} as const

/** Línea de condición sobre el IVA (null mientras esté pendiente de confirmar). */
export const VAT_MESSAGE: string | null =
  CAMPAIGN.vat.status === 'pending' ? null : `${CAMPAIGN.vat.label[CAMPAIGN.vat.status]}.`

/** Todas las condiciones visibles, en orden. */
export const CONDITIONS: string[] = [
  CAMPAIGN.messages.minOrder,
  CAMPAIGN.messages.shipping,
  CAMPAIGN.messages.validity,
  ...(VAT_MESSAGE ? [VAT_MESSAGE] : []),
]
