/**
 * Importación reproducible del Excel de campaña.
 *
 *   npm run importar                      → usa el .xlsx de data/source/
 *   npm run importar -- ruta/al.xlsx      → usa otro archivo
 *   npm run importar -- --imagenes        → además comprueba que carga cada URL de imagen (HEAD)
 *
 * Genera:
 *   src/data/catalog.json        catálogo normalizado que usa la web
 *   src/data/review.json         registro de revisión (herencias, agrupaciones, pendientes, imágenes)
 *   data/output/filas-origen.json   filas originales del Excel con su número de fila
 *   data/output/catalogo-normalizado.csv   una línea por variante (para revisar en Excel)
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { readRows } from './lib/excel'
import { checkImages, parentImageCandidates } from './lib/images'
import { normalize, type ModelOverride } from './lib/normalize'
import { runChecks } from './lib/checks'

const root = resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const withImages = args.includes('--imagenes')
const explicit = args.find((a) => !a.startsWith('--'))

function findSource(): string {
  if (explicit) return resolve(explicit)
  const dir = join(root, 'data', 'source')
  const file = readdirSync(dir).find((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'))
  if (!file) throw new Error(`No hay ningún .xlsx en ${dir}`)
  return join(dir, file)
}

const source = findSource()
const buf = readFileSync(source)
const sha256 = createHash('sha256').update(buf).digest('hex')
console.log(`Origen: ${source}`)

const { rows, sheet } = await readRows(source)
console.log(`Filas leídas: ${rows.length}`)

mkdirSync(join(root, 'data', 'cache'), { recursive: true })
mkdirSync(join(root, 'data', 'output'), { recursive: true })
const cacheFile = join(root, 'data', 'cache', 'imagenes.json')

let imageStatus: Record<string, boolean> | null = null
if (withImages) {
  console.log('Comprobando imágenes (HEAD, sin descargarlas)…')
  imageStatus = await checkImages(rows.map((r) => r.imagen), (d, t) => {
    if (d % 50 === 0 || d === t) console.log(`  ${d}/${t}`)
  })
  const failing = rows.filter((r) => imageStatus![r.imagen] === false)
  const candidates = [...new Set(failing.flatMap((r) => parentImageCandidates(r.articulo, r.imagen)))].filter((u) => !(u in imageStatus!))
  console.log(`Comprobando ${candidates.length} fotos candidatas de la referencia padre para ${failing.length} variantes sin foto…`)
  Object.assign(imageStatus, await checkImages(candidates))
  writeFileSync(cacheFile, JSON.stringify(imageStatus, null, 1))
} else if (existsSync(cacheFile)) {
  imageStatus = JSON.parse(readFileSync(cacheFile, 'utf8'))
  console.log('Usando la última comprobación de imágenes guardada (data/cache/imagenes.json).')
} else {
  console.log('Imágenes sin comprobar (ejecuta con --imagenes).')
}

const ovFile = join(root, 'data', 'overrides', 'models.json')
const overrides: Record<string, ModelOverride> = existsSync(ovFile) ? JSON.parse(readFileSync(ovFile, 'utf8')) : {}

const importedAt = process.env.IMPORT_DATE ?? new Date().toISOString()
const { catalog, review } = normalize({
  rows,
  imageStatus,
  overrides,
  meta: { sourceFile: basename(source), sourceSha256: sha256, sheet, importedAt },
})
review.checks = runChecks(rows, catalog)

writeFileSync(join(root, 'src', 'data', 'catalog.json'), JSON.stringify(catalog))
writeFileSync(join(root, 'src', 'data', 'review.json'), JSON.stringify(review, null, 1))
writeFileSync(join(root, 'data', 'output', 'filas-origen.json'), JSON.stringify(rows, null, 1))

const famName = new Map(catalog.families.map((f) => [f.id, f]))
const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
const header = [
  'Referencia', 'Fila Excel', 'Modelo', 'Producto', 'Familia', 'Subfamilia', 'Talla', 'Código talla', 'Talla verificada',
  'Color', 'Código color', 'Versión', 'Unidades', 'PVP', 'Neto oferta', 'Dto %', 'Dto excepcional',
  'Descripción original', 'Descripción usada', 'Heredada de', 'Imagen', 'Avisos',
]
const lines = [header.map(esc).join(';')]
for (const p of catalog.products) {
  const fam = famName.get(p.familyId)
  for (const v of p.variants) {
    lines.push([
      v.sku, v.sourceRow, p.id, p.name, fam?.name, fam?.subfamilies.find((s) => s.id === p.subfamilyId)?.name ?? '',
      v.size.label ?? '', v.size.code ?? '', v.size.verified ? 'sí' : v.size.code ? 'no' : '',
      v.color.label ?? '', v.color.code ?? '', v.version ?? '', v.units,
      (v.pvpCents / 100).toFixed(2).replace('.', ','), (v.netCents / 100).toFixed(2).replace('.', ','),
      String(v.discountPct).replace('.', ','), v.discountExceptional ? 'sí' : '',
      v.descriptionOriginal, v.description, v.inheritedFrom ?? '', v.image, v.flags.join(' | '),
    ].map(esc).join(';'))
  }
}
writeFileSync(join(root, 'data', 'output', 'catalogo-normalizado.csv'), '﻿' + lines.join('\r\n'))

console.log(`\nProductos: ${catalog.meta.products} · Variantes: ${catalog.meta.uniqueSkus} · Unidades: ${catalog.meta.totalUnits}`)
console.log(`Familias: ${catalog.families.map((f) => `${f.name} (${catalog.products.filter((p) => p.familyId === f.id).length})`).join(' · ')}`)
for (const c of review.checks) console.log(`${c.ok ? '✔' : '✘'} ${c.label} — ${c.detail}`)
console.log(`Herencias de descripción: ${review.inheritedDescriptions.length} · sin resolver: ${review.unresolvedDescriptions.length} · pendientes: ${review.pendingData.length} · imágenes con incidencia: ${review.imageIssues.length}`)
