import { describe, expect, it } from 'vitest'
import { CATALOG, VARIANT_BY_SKU } from '../src/lib/catalog'
import { addToCart, aggregateLines, setQty, validateOrder } from '../src/lib/cart'
import { daysLeft, isCampaignClosed, ymdInZone } from '../src/lib/campaign'
import { applyFilters, EMPTY_FILTERS, facetValues } from '../src/lib/filters'
import { discountToPct, formatEUR, formatPct, toCents } from '../src/lib/money'
import { orderToCsv } from '../src/lib/order'
import { buildIndex, findExactSku, search } from '../src/lib/search'

const index = buildIndex(CATALOG.products)
const stockOf = (sku: string) => VARIANT_BY_SKU.get(sku)?.variant.units ?? 0
const priceOf = (sku: string) => VARIANT_BY_SKU.get(sku)?.variant.netCents ?? 0

describe('dinero', () => {
  it('redondea half-up una sola vez desde la columna E', () => {
    expect(toCents(4.932)).toBe(493)
    expect(toCents(5.430000000000001)).toBe(543)
    expect(toCents(182.92499999999998)).toBe(18293)
    expect(toCents(99.979)).toBe(9998)
  })
  it('formatea en español', () => {
    expect(formatEUR(3964).replace(/ /g, ' ')).toBe('39,64 €')
    expect(formatEUR(123456).replace(/ /g, ' ')).toBe('1.234,56 €')
    expect(formatPct(40).replace(/ /g, ' ')).toBe('40 %')
    expect(formatPct(discountToPct(0.29644)).replace(/ /g, ' ')).toBe('29,64 %')
    expect(discountToPct(0.39999999999999997)).toBe(40)
  })
})

describe('cierre de campaña (Madrid)', () => {
  it('sigue abierta todo el 30 de noviembre y cierra a medianoche de Madrid', () => {
    expect(isCampaignClosed(new Date('2026-11-30T22:59:59Z'))).toBe(false) // 23:59:59 en Madrid (UTC+1)
    expect(isCampaignClosed(new Date('2026-11-30T23:00:00Z'))).toBe(true) // 00:00 del 1 dic en Madrid
    expect(ymdInZone(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12-01')
    expect(isCampaignClosed(new Date('2026-11-13T10:00:00Z'))).toBe(false)
  })
  it('cuenta los días restantes', () => {
    expect(daysLeft(new Date('2026-11-13T10:00:00Z'))).toBe(17)
    expect(daysLeft(new Date('2026-11-30T10:00:00Z'))).toBe(0)
    expect(daysLeft(new Date('2026-12-02T10:00:00Z'))).toBeNull()
  })
})

describe('pedido', () => {
  const s1 = '0025593319062ACB' // 2 uds., 39,64 €
  const s2 = '0025593319064ACB' // 3 uds.

  it('no supera las existencias y suma líneas repetidas del mismo SKU', () => {
    expect(stockOf(s1)).toBe(2)
    const a = addToCart([], s1, 5, stockOf)
    expect(a.lines).toEqual([{ sku: s1, qty: 2 }])
    expect(a.added).toBe(2)
    expect(addToCart(a.lines, s1, 1, stockOf).added).toBe(0)
    expect(aggregateLines([{ sku: s1, qty: 1 }, { sku: s1, qty: 2 }])).toEqual([{ sku: s1, qty: 3 }])
    expect(setQty(a.lines, s1, 99, stockOf)).toEqual([{ sku: s1, qty: 2 }])
  })

  it('valida el stock sumando líneas duplicadas antes de comparar', () => {
    const v = validateOrder([{ sku: s1, qty: 1 }, { sku: s1, qty: 2 }], priceOf, stockOf, false)
    expect(v.issues.some((i) => i.sku === s1)).toBe(true)
    expect(v.canPrepare).toBe(false)
  })

  it('valida el mínimo de 100,00 € sobre el conjunto con el neto mostrado', () => {
    const low = validateOrder([{ sku: s1, qty: 2 }], priceOf, stockOf, false)
    expect(low.subtotalCents).toBe(2 * 3964)
    expect(low.missingCents).toBe(10000 - 7928)
    expect(low.canPrepare).toBe(false)
    const ok = validateOrder([{ sku: s1, qty: 2 }, { sku: s2, qty: 1 }], priceOf, stockOf, false)
    expect(ok.subtotalCents).toBe(3 * 3964)
    expect(ok.meetsMinimum).toBe(true)
    expect(ok.canPrepare).toBe(true)
  })

  it('desactiva «Preparar pedido» cuando la campaña ha cerrado', () => {
    const v = validateOrder([{ sku: s1, qty: 2 }, { sku: s2, qty: 3 }], priceOf, stockOf, true)
    expect(v.meetsMinimum).toBe(true)
    expect(v.canPrepare).toBe(false)
  })

  it('el CSV usa el neto unitario mostrado y avisa de que no es un pedido confirmado', () => {
    const csv = orderToCsv([{ sku: s1, qty: 2 }], { clientCode: 'C001', customer: '', notes: '', importedAt: CATALOG.meta.importedAt })
    expect(csv).toContain('"0025593319062ACB"')
    expect(csv).toContain('"39,64"')
    expect(csv).toContain('"79,28"')
    expect(csv).toContain('NO es un pedido recibido ni confirmado')
  })
})

describe('búsqueda', () => {
  it('encuentra por referencia completa, sin ACB, con puntos y parcial', () => {
    const sku = '0025593319061ACB'
    expect(findExactSku(index, sku)?.sku).toBe(sku)
    expect(findExactSku(index, '0025593319061')?.sku).toBe(sku)
    expect(findExactSku(index, '0025593.319.061')?.sku).toBe(sku)
    const partial = search(index, '25593319')!
    expect(partial.some((h) => h.product.id === '0025593')).toBe(true)
  })
  it('encuentra por modelo y por descripción', () => {
    expect(search(index, 'winter tour')!.some((h) => h.product.id === '0025593')).toBe(true)
    expect(search(index, 'Ténéré')!.length).toBe(search(index, 'tenere')!.length) // ignora tildes
    expect(search(index, 'tenere')!.length).toBeGreaterThan(0)
    expect(search(index, 'zzzz-no-existe')).toEqual([])
  })
})

describe('filtros sobre todo el catálogo', () => {
  it('familia, talla, color, precio y descuento actúan sobre las 438 referencias', () => {
    const all = applyFilters(CATALOG.products, index, EMPTY_FILTERS)
    expect(all.reduce((s, r) => s + r.variants.length, 0)).toBe(438)

    const cascos = applyFilters(CATALOG.products, index, { ...EMPTY_FILTERS, family: 'cascos' })
    expect(cascos.every((r) => r.product.familyId === 'cascos')).toBe(true)

    const xl = applyFilters(CATALOG.products, index, { ...EMPTY_FILTERS, sizes: ['XL'] })
    expect(xl.length).toBeGreaterThan(0)
    expect(xl.every((r) => r.variants.every((v) => v.size.label === 'XL' && v.size.verified))).toBe(true)

    const rojo = applyFilters(CATALOG.products, index, { ...EMPTY_FILTERS, colors: ['Rojo'] })
    expect(rojo.every((r) => r.variants.every((v) => /roj/i.test(v.color.label ?? '')))).toBe(true)

    const cheap = applyFilters(CATALOG.products, index, { ...EMPTY_FILTERS, maxNet: 1500 })
    expect(cheap.every((r) => r.variants.every((v) => v.netCents <= 1500))).toBe(true)

    const otros = applyFilters(CATALOG.products, index, { ...EMPTY_FILTERS, discounts: ['otros'] })
    expect(otros.flatMap((r) => r.variants).map((v) => v.sku)).toEqual(['0024289090043ACB'])
  })

  it('ordena por precio, descuento, nombre y disponibilidad', () => {
    const asc = applyFilters(CATALOG.products, index, { ...EMPTY_FILTERS, sort: 'precio-asc' })
    const mins = asc.map((r) => Math.min(...r.variants.map((v) => v.netCents)))
    expect(mins).toEqual([...mins].sort((a, b) => a - b))
    const dto = applyFilters(CATALOG.products, index, { ...EMPTY_FILTERS, sort: 'descuento' })
    expect(Math.max(...dto[0].variants.map((v) => v.discountPct))).toBe(45)
    const units = applyFilters(CATALOG.products, index, { ...EMPTY_FILTERS, sort: 'disponibilidad' })
    expect(units[0].variants.reduce((s, v) => s + v.units, 0)).toBeGreaterThanOrEqual(units[1].variants.reduce((s, v) => s + v.units, 0))
  })

  it('las tallas del filtro son solo las verificadas', () => {
    const f = facetValues(CATALOG.products)
    expect(f.sizes).toEqual(expect.arrayContaining(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']))
    expect(f.sizes.every((s) => !/^\d{3}$/.test(s))).toBe(true)
  })
})

describe('catálogo normalizado', () => {
  const variants = CATALOG.products.flatMap((p) => p.variants)
  it('438 referencias únicas, 809 unidades, referencias como texto', () => {
    expect(variants.length).toBe(438)
    expect(new Set(variants.map((v) => v.sku)).size).toBe(438)
    expect(variants.reduce((s, v) => s + v.units, 0)).toBe(809)
    expect(variants.every((v) => typeof v.sku === 'string' && v.sku.endsWith('ACB'))).toBe(true)
    expect(variants.some((v) => v.sku.startsWith('0000'))).toBe(true)
  })
  it('Winter Tour 0025593.319: siete variantes y 13 unidades; la primera fila no se duplica', () => {
    const p = CATALOG.products.find((x) => x.id === '0025593')!
    const g = p.variants.filter((v) => v.color.code === '319')
    expect(g.length).toBe(7)
    expect(g.reduce((s, v) => s + v.units, 0)).toBe(13)
    expect(g.map((v) => v.sku).sort()).toEqual(['0025593319061ACB', '0025593319062ACB', '0025593319064ACB', '0025593319066ACB', '0025593319068ACB', '0025593319069ACB', '0025593319070ACB'])
  })
  it('0026149290070ACB no hereda color; la excepción de las botas se conserva', () => {
    const v = VARIANT_BY_SKU.get('0026149290070ACB')!.variant
    expect(v.color.label).toBeNull()
    expect(v.color.verified).toBe(false)
    expect(v.inheritedFrom).toBeNull()
    const b = VARIANT_BY_SKU.get('0024289090043ACB')!.variant
    expect([b.pvpCents, b.netCents, b.discountPct, b.discountExceptional]).toEqual([26000, 18293, 29.64, true])
  })
  it('ninguna talla se infiere sin validar y no hay familias vacías', () => {
    expect(variants.filter((v) => v.size.label && !v.size.verified)).toEqual([])
    for (const f of CATALOG.families) expect(CATALOG.products.some((p) => p.familyId === f.id)).toBe(true)
  })
  it('los recambios de casco no están en «Cascos»', () => {
    const cascos = CATALOG.products.filter((p) => p.familyId === 'cascos')
    expect(cascos.every((p) => /^casco/i.test(p.name))).toBe(true)
    const interior = CATALOG.products.find((p) => p.id === '0023934')!
    expect(interior.familyId).toBe('recambios-casco')
    const correas = CATALOG.products.find((p) => p.id === '0000236')!
    expect(correas.familyId).toBe('iluminacion')
  })
})
