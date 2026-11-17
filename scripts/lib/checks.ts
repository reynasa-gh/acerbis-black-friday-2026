import type { Catalog, CheckResult } from '../../src/types'
import { CAMPAIGN } from '../../src/config/campaign'
import { toCents } from '../../src/lib/money'
import type { RawRow } from './normalize'

const ok = (id: string, label: string, pass: boolean, detail: string): CheckResult => ({ id, label, ok: pass, detail })

/** Comprobaciones de integridad entre el Excel de origen y el catálogo normalizado. */
export function runChecks(raw: RawRow[], catalog: Catalog): CheckResult[] {
  const exp = CAMPAIGN.expectedImport
  const out: CheckResult[] = []
  const variants = catalog.products.flatMap((p) => p.variants)
  const bySku = new Map<string, number>()
  for (const v of variants) bySku.set(v.sku, (bySku.get(v.sku) ?? 0) + 1)

  // 1. Referencias representadas una sola vez
  const missing = raw.filter((r) => bySku.get(r.articulo) !== 1)
  out.push(ok('refs', `Las ${exp.skus} referencias están representadas una sola vez como variantes vendibles`,
    raw.length === exp.skus && variants.length === raw.length && missing.length === 0,
    `Excel: ${raw.length} filas · catálogo: ${variants.length} variantes · fuera de lugar: ${missing.length}`))

  // 2. Stock
  const rawUnits = raw.reduce((s, r) => s + r.unidades, 0)
  const catUnits = variants.reduce((s, v) => s + v.units, 0)
  out.push(ok('stock', `El stock inicial suma ${exp.units} unidades`, rawUnits === exp.units && catUnits === exp.units,
    `Excel: ${rawUnits} · catálogo: ${catUnits}`))

  // 3. Descripciones «0»
  const zeros = raw.filter((r) => r.descripcionEsCero)
  const unresolvedSkus = new Set(variants.filter((v) => v.flags.some((f) => f.startsWith('descripcion-sin-resolver'))).map((v) => v.sku))
  const handled = zeros.filter((r) => {
    const v = variants.find((x) => x.sku === r.articulo)
    return v && (v.inheritedFrom !== null || unresolvedSkus.has(v.sku))
  })
  out.push(ok('zeros', `Las ${exp.zeroDescriptions} descripciones «0» se han resuelto o señalado para revisión`,
    zeros.length === exp.zeroDescriptions && handled.length === zeros.length,
    `${zeros.length} descripciones «0»: ${zeros.length - unresolvedSkus.size} resueltas por herencia validada, ${unresolvedSkus.size} señaladas para revisión`))

  // 4. Grupo Winter Tour
  const wt = CAMPAIGN.special.winterTourGroup
  const wtProduct = catalog.products.find((p) => p.id === wt.model)
  const wtGroup = wtProduct?.variants.filter((v) => v.color.code === wt.colorCode) ?? []
  const wtUnits = wtGroup.reduce((s, v) => s + v.units, 0)
  out.push(ok('winter-tour', `El grupo Winter Tour ${wt.model}.${wt.colorCode} contiene ${wt.variants} variantes y ${wt.units} unidades`,
    wtGroup.length === wt.variants && wtUnits === wt.units,
    `${wtGroup.length} variantes · ${wtUnits} uds. (el modelo completo, con el otro color 090, tiene ${wtProduct?.variants.length} variantes y ${wtProduct?.totalUnits} uds.)`))

  // 5. Sin mezclas
  const problems: string[] = []
  for (const p of catalog.products) {
    const seenSize = new Set<string>()
    for (const v of p.variants) {
      if (!v.sku.startsWith(p.id)) problems.push(`${v.sku} no pertenece al modelo ${p.id}`)
      if (v.color.code !== v.sku.slice(7, 10) && v.color.code !== null) problems.push(`${v.sku}: código de color inconsistente`)
      if (v.inheritedFrom) {
        if (!v.inheritedFrom.startsWith(v.sku.slice(0, 10))) problems.push(`${v.sku} hereda de ${v.inheritedFrom}, que es de otro modelo o color`)
      }
      if (v.size.code) {
        const key = `${v.color.code}|${v.size.code}`
        if (seenSize.has(key)) problems.push(`${v.sku}: talla duplicada en el mismo color`)
        seenSize.add(key)
      }
    }
    if (p.familyId === 'cascos' && /^(interior|visor|visera|forro|mecanismo|ventilaci|lente|gafa)/i.test(p.name)) {
      problems.push(`${p.id} «${p.name}» es un recambio de casco clasificado como casco`)
    }
    if (p.familyId === 'recambios-casco' && /^casco\b/i.test(p.name)) problems.push(`${p.id} «${p.name}» es un casco completo en recambios`)
  }
  out.push(ok('no-mezcla', 'La agrupación no mezcla modelos, colores ni aplicaciones incompatibles', problems.length === 0,
    problems.length ? problems.slice(0, 5).join(' · ') : 'Mismo modelo y código de color en cada herencia; sin tallas duplicadas por color; recambios fuera de «Cascos»'))

  // 6. Precio y existencias por variante
  const diffs = raw.filter((r) => {
    const v = variants.find((x) => x.sku === r.articulo)
    return !v || v.units !== r.unidades || v.pvpCents !== toCents(r.pvp) || v.netCents !== toCents(r.neto) || v.discount !== r.dto
  })
  out.push(ok('precio-stock', 'Cada variante conserva su precio, descuento y existencias', diffs.length === 0, `${diffs.length} diferencias frente al Excel`))

  // 7. Descuento excepcional
  const ex = variants.find((v) => v.sku === CAMPAIGN.special.exceptionalDiscountSku)
  out.push(ok('dto-excepcional', 'El descuento excepcional de las botas X-Rock se conserva (29,64 %)',
    !!ex && ex.discountPct === 29.64 && ex.discountExceptional && ex.pvpCents === 26000 && ex.netCents === 18293,
    ex ? `PVP ${ex.pvpCents / 100} · neto ${ex.netCents / 100} · dto ${ex.discountPct} %` : 'no encontrada'))

  // 8. Variante 0026149290070ACB
  const rv = variants.find((v) => v.sku === CAMPAIGN.special.reviewColorSku)
  out.push(ok('color-0026149290070', '0026149290070ACB no hereda automáticamente el color del bloque anterior',
    !!rv && rv.color.label === null && !rv.color.verified && rv.inheritedFrom === null,
    rv ? `color ${rv.color.code}: ${rv.color.label ?? 'sin etiqueta, pendiente de confirmar'}` : 'no encontrada'))

  // 9. Coherencia de descuentos
  const incoherent = variants.filter((v) => v.flags.some((f) => f.startsWith('descuento-incoherente')))
  out.push(ok('dto-coherente', 'El descuento es coherente con PVP y neto (tolerancia de redondeo 0,5 pp)', incoherent.length === 0,
    `${incoherent.length} incoherentes`))

  // 10. Imágenes y familias
  const noImage = variants.filter((v) => !v.image)
  out.push(ok('imagenes', 'Todas las variantes tienen URL de imagen del Excel', noImage.length === 0, `${noImage.length} sin imagen`))
  const emptyFam = catalog.families.filter((f) => !catalog.products.some((p) => p.familyId === f.id))
  out.push(ok('familias', 'Ninguna familia ni subfamilia está vacía',
    emptyFam.length === 0 && catalog.families.every((f) => f.subfamilies.every((s) => catalog.products.some((p) => p.familyId === f.id && p.subfamilyId === s.id))),
    `${catalog.families.length} familias`))
  return out
}
