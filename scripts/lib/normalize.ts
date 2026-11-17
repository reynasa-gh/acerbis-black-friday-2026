import type {
  Catalog, ColorInfo, Family, Product, ReviewItem, ReviewLog, Variant,
} from '../../src/types'
import { discountToPct, toCents } from '../../src/lib/money'
import { parentImageCandidates } from './images'
import { parseSku } from './reference'
import { classifyModel, TAXONOMY } from './families'
import { resolveSize, SIZE_TABLE } from './sizes'
import { cleanName, extractColorPhrases } from './text'

export interface RawRow {
  /** Fila en el Excel (la 1 es la cabecera). */
  fila: number
  articulo: string
  /** Descripción tal cual; "0" si venía 0. */
  descripcion: string
  descripcionEsCero: boolean
  unidades: number
  pvp: number
  neto: number
  dto: number
  imagen: string
}

export interface ModelOverride {
  name?: string
  familyId?: string
  subfamilyId?: string | null
  note?: string
}

export interface NormalizeInput {
  rows: RawRow[]
  /** url → ¿carga?  (resultado de `npm run imagenes`). null = no comprobado. */
  imageStatus: Record<string, boolean> | null
  overrides: Record<string, ModelOverride>
  meta: { sourceFile: string; sourceSha256: string; sheet: string; importedAt: string }
}

const SIZE_PHRASE = /\btalla\s+(?:XXXL|XXL|XL|XS|L\/XL|S\/M|S|M|L|\d{2})\b/gi
const stripSize = (s: string) => s.replace(SIZE_PHRASE, ' ').replace(/\s+/g, ' ').trim()

function pickMostCommon(values: string[]): string | null {
  if (values.length === 0) return null
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0]
}

export function normalize(input: NormalizeInput): { catalog: Catalog; review: ReviewLog } {
  const { rows, imageStatus, overrides, meta } = input
  const imageOk = (url: string) => imageStatus === null || imageStatus[url] !== false

  const pendingData: ReviewItem[] = []
  const exceptions: ReviewItem[] = []
  const imageIssues: ReviewItem[] = []
  const classificationNotes: ReviewItem[] = []
  const inheritedDescriptions: ReviewLog['inheritedDescriptions'] = []
  const unresolvedDescriptions: ReviewItem[] = []
  const groupsLog: ReviewLog['groups'] = []

  // ---- 1. Validar y agrupar por modelo (orden de primera aparición) ----
  const byModel = new Map<string, Array<{ r: RawRow; colorCode: string | null; suffix: string | null }>>()
  const seen = new Set<string>()
  for (const r of rows) {
    const p = parseSku(r.articulo)
    if (!p) throw new Error(`Referencia con formato no reconocido en la fila ${r.fila}: «${r.articulo}»`)
    if (seen.has(r.articulo)) throw new Error(`Referencia duplicada en la fila ${r.fila}: ${r.articulo}`)
    seen.add(r.articulo)
    if (!byModel.has(p.model)) byModel.set(p.model, [])
    byModel.get(p.model)!.push({ r, colorCode: p.colorCode, suffix: p.suffix })
  }

  const products: Product[] = []
  const usedSubs = new Set<string>()
  const usedFamilies = new Set<string>()
  const sizeCounters = new Map<string, { rows: number; confirmed: number }>()
  for (const code of Object.keys(SIZE_TABLE)) sizeCounters.set(code, { rows: 0, confirmed: 0 })

  for (const [model, items] of byModel) {
    const ov = overrides[model] ?? {}
    const nonZero = items.filter((i) => !i.r.descripcionEsCero)

    // ---- 2. Familia / subfamilia ----
    const cls = classifyModel(nonZero.map((i) => i.r.descripcion))
    const familyId = ov.familyId ?? cls.familyId
    const subfamilyId = ov.subfamilyId !== undefined ? ov.subfamilyId : ov.familyId ? null : cls.subfamilyId
    if (cls.uncertain && !ov.familyId) {
      classificationNotes.push({ model, message: `${cls.reason}. Quedan en «${subfamilyId}»; revisar.` })
    }
    if (ov.note) classificationNotes.push({ model, message: ov.note })

    // ---- 3. Nombre ----
    const cleaned = nonZero.map((i) => cleanName(i.r.descripcion)).filter(Boolean)
    const name = ov.name ?? pickMostCommon(cleaned) ?? `Modelo ${model}`

    // ---- 4. Colores por código dentro del modelo ----
    const codes: Array<string | null> = []
    for (const i of items) if (!codes.includes(i.colorCode)) codes.push(i.colorCode)
    const labelByCode = new Map<string | null, string | null>()
    for (const code of codes) {
      const phrases = nonZero
        .filter((i) => i.colorCode === code)
        .flatMap((i) => extractColorPhrases(i.r.descripcion).slice(0, 1))
      const distinct = new Set(phrases)
      if (distinct.size > 1) {
        pendingData.push({
          model,
          message: `Colores contradictorios en las descripciones del código ${code}: ${[...distinct].join(' / ')}. Se usa el más frecuente.`,
        })
      }
      labelByCode.set(code, pickMostCommon(phrases))
    }
    // Etiquetas repetidas en el mismo modelo (p. ej. dos «Negro»): se distinguen con el código.
    const labelCount = new Map<string, number>()
    for (const l of labelByCode.values()) if (l) labelCount.set(l, (labelCount.get(l) ?? 0) + 1)
    const displayLabel = (code: string | null): string | null => {
      const l = labelByCode.get(code) ?? null
      if (!l) return null
      return (labelCount.get(l) ?? 0) > 1 ? `${l} · ${code}` : l
    }

    // ---- 5. Variantes ----
    const variants: Variant[] = items.map((it, idx) => {
      const { r, colorCode, suffix } = it
      const flags: string[] = []

      // Descripción: herencia solo desde filas del MISMO modelo y MISMO código de color.
      let description = r.descripcion
      let inheritedFrom: string | null = null
      if (r.descripcionEsCero) {
        const same = (j: number) =>
          !items[j].r.descripcionEsCero && items[j].colorCode === colorCode
        let src = -1
        for (let j = idx - 1; j >= 0; j--) if (same(j)) { src = j; break }
        if (src < 0) for (let j = idx + 1; j < items.length; j++) if (same(j)) { src = j; break }
        if (src >= 0) {
          inheritedFrom = items[src].r.articulo
          description = stripSize(items[src].r.descripcion)
          flags.push(`descripcion-heredada: «0» sustituido por la descripción de ${inheritedFrom} (mismo modelo y código de color ${colorCode})`)
          inheritedDescriptions.push({ sku: r.articulo, sourceRow: r.fila, from: inheritedFrom, description })
        } else {
          description = name
          flags.push('descripcion-sin-resolver: sin otra fila del mismo modelo y código de color; pendiente de confirmar color')
          unresolvedDescriptions.push({
            sku: r.articulo,
            sourceRow: r.fila,
            model,
            message: `Descripción «0» sin fila hermana con el mismo código de color (${colorCode}). No se hereda el color del bloque anterior; queda pendiente de confirmar.`,
          })
        }
      }

      // Talla
      const sz = resolveSize(suffix, r.descripcionEsCero ? null : r.descripcion, familyId)
      flags.push(...sz.flags.filter((f) => !f.startsWith('version:')))
      if (sz.size.code && SIZE_TABLE[sz.size.code]) {
        const c = sizeCounters.get(sz.size.code)!
        c.rows++
        if (sz.size.source === 'descripcion') c.confirmed++
      }
      if (sz.size.code && !sz.size.verified) {
        pendingData.push({ sku: r.articulo, model, sourceRow: r.fila, message: `Talla sin equivalencia verificada (sufijo ${sz.size.code}).` })
      }
      if (sz.version) {
        pendingData.push({ sku: r.articulo, model, sourceRow: r.fila, message: `Sufijo ${sz.version} conservado como versión/aplicación (no es talla); confirmar su significado.` })
      }

      // Color
      const label = displayLabel(colorCode)
      const color: ColorInfo = { code: colorCode, label, verified: label !== null }
      if (colorCode && !label) {
        flags.push(`color-pendiente: sin descripción de color para el código ${colorCode}`)
        if (codes.length > 1 || r.descripcionEsCero) {
          pendingData.push({ sku: r.articulo, model, sourceRow: r.fila, message: `Color del código ${colorCode} sin confirmar (no se infiere de otros bloques).` })
        }
      }

      // Precios
      const pvpCents = toCents(r.pvp)
      const netCents = toCents(r.neto)
      const pct = discountToPct(r.dto)
      const exceptional = pct !== 40 && pct !== 45
      const expected = 1 - r.neto / r.pvp
      if (Math.abs(expected - r.dto) > 0.005) {
        flags.push(`descuento-incoherente: F=${r.dto} vs ${(expected).toFixed(4)} calculado de PVP y neto`)
        pendingData.push({ sku: r.articulo, model, sourceRow: r.fila, message: `Descuento (${pct} %) no coincide con PVP y neto (${(expected * 100).toFixed(2)} %).` })
      }
      if (exceptional) {
        flags.push('descuento-excepcional')
        exceptions.push({
          sku: r.articulo, model, sourceRow: r.fila,
          message: `Descuento del ${String(pct).replace('.', ',')} % (ni 40 % ni 45 %): PVP ${r.pvp.toFixed(2)} → neto ${(netCents / 100).toFixed(2)}. Se conserva tal cual.`,
        })
      }

      return {
        sku: r.articulo,
        sourceRow: r.fila,
        units: r.unidades,
        pvpCents,
        netCents,
        discount: r.dto,
        discountPct: pct,
        discountExceptional: exceptional,
        size: sz.size,
        color,
        version: sz.version,
        image: r.imagen,
        imageFallback: null,
        descriptionOriginal: r.descripcion,
        description,
        inheritedFrom,
        flags,
      }
    })

    // ---- 6. Imágenes: fallback verificado del mismo producto y color ----
    for (const v of variants) {
      if (imageOk(v.image)) continue
      v.flags.push('imagen-fallida')
      // 1) Foto de la referencia padre (modelo + color) si responde como imagen.
      const parent = imageStatus ? parentImageCandidates(v.sku, v.image).find((u) => imageStatus[u] === true) : undefined
      // 2) Si no, la de otra variante verificada del mismo producto y color.
      const alt = variants.find((o) => o !== v && o.color.code === v.color.code && imageOk(o.image) && o.image !== v.image)
      if (parent) {
        v.imageFallback = parent
        v.flags.push('imagen-padre')
        imageIssues.push({ sku: v.sku, model, sourceRow: v.sourceRow, message: `Imagen no disponible (${v.image}); se usa la de la referencia padre (${parent}).` })
      } else if (alt) {
        v.imageFallback = alt.image
        imageIssues.push({ sku: v.sku, model, sourceRow: v.sourceRow, message: `Imagen no disponible (${v.image}); sin foto de la referencia padre, se usa la de ${alt.sku} (mismo producto y color).` })
      } else {
        imageIssues.push({ sku: v.sku, model, sourceRow: v.sourceRow, message: `Imagen no disponible (${v.image}) y no hay foto de la referencia padre ni de otra variante del mismo color: se muestra marcador.` })
      }
    }

    // ---- 7. Orden: por color (orden de aparición) y talla ----
    const colorOrder = new Map(codes.map((c, i) => [c, i]))
    variants.sort((a, b) =>
      (colorOrder.get(a.color.code) ?? 0) - (colorOrder.get(b.color.code) ?? 0) ||
      (a.size.code ?? '').localeCompare(b.size.code ?? '') ||
      a.sku.localeCompare(b.sku))

    const nets = variants.map((v) => v.netCents)
    const minNet = Math.min(...nets)
    const maxNet = Math.max(...nets)
    const coverIndex = Math.max(0, variants.findIndex((v) => imageOk(v.image) || v.imageFallback))

    products.push({
      id: model, name, familyId, subfamilyId,
      variants,
      totalUnits: variants.reduce((s, v) => s + v.units, 0),
      minNetCents: minNet, maxNetCents: maxNet, priceVaries: minNet !== maxNet,
      coverIndex,
    })
    usedFamilies.add(familyId)
    if (subfamilyId) usedSubs.add(`${familyId}/${subfamilyId}`)

    groupsLog.push({
      model, name, family: familyId,
      variants: variants.length,
      units: variants.reduce((s, v) => s + v.units, 0),
      colors: codes.map((code) => {
        const vs = variants.filter((v) => v.color.code === code)
        return { code, label: displayLabel(code), variants: vs.length, units: vs.reduce((s, v) => s + v.units, 0) }
      }),
    })
  }

  // ---- 8. Familias (sin categorías vacías) ----
  const families: Family[] = TAXONOMY
    .filter((f) => usedFamilies.has(f.id))
    .map((f) => ({
      ...f,
      subfamilies: f.subfamilies.filter((s) => usedSubs.has(`${f.id}/${s.id}`)),
    }))

  const allVariants = products.flatMap((p) => p.variants)
  const catalog: Catalog = {
    meta: {
      ...meta,
      rows: rows.length,
      uniqueSkus: new Set(allVariants.map((v) => v.sku)).size,
      totalUnits: allVariants.reduce((s, v) => s + v.units, 0),
      products: products.length,
    },
    families,
    products,
  }

  const sizeEvidence = Object.entries(SIZE_TABLE).map(([code, label]) => {
    const c = sizeCounters.get(code)!
    return {
      code, label,
      source: 'Tablas de tallas Acerbis + descripciones del Excel',
      rowsInExcel: c.rows,
      confirmedByDescription: c.confirmed,
    }
  })

  const review: ReviewLog = {
    generatedAt: meta.importedAt,
    checks: [],
    inheritedDescriptions,
    unresolvedDescriptions,
    groups: groupsLog,
    sizeEvidence,
    pendingData,
    exceptions,
    imageIssues,
    classificationNotes,
    discrepancyNote:
      'El encargo menciona 419 referencias; el Excel contiene 438 referencias únicas y 809 unidades. Se trabaja con las 438 (no se ha eliminado ningún artículo para forzar 419). Diferencia: 19 referencias. Pendiente de aclarar con Reynasa a qué corresponde la cifra de 419.',
  }
  return { catalog, review }
}
