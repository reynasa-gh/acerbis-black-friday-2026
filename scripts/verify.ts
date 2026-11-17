/**
 * Verificación independiente: relee el Excel de origen y el catálogo ya generado (src/data/catalog.json)
 * y repite las comprobaciones de integridad. Sale con código 1 si alguna falla.
 *
 *   npm run verificar
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Catalog } from '../src/types'
import { readRows } from './lib/excel'
import { runChecks } from './lib/checks'

const root = resolve(import.meta.dirname, '..')
const dir = join(root, 'data', 'source')
const file = readdirSync(dir).find((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'))
if (!file) throw new Error(`No hay .xlsx en ${dir}`)

const { rows } = await readRows(join(dir, file))
const catalog = JSON.parse(readFileSync(join(root, 'src', 'data', 'catalog.json'), 'utf8')) as Catalog
const checks = runChecks(rows, catalog)

let failed = 0
for (const c of checks) {
  if (!c.ok) failed++
  console.log(`${c.ok ? '✔' : '✘'} ${c.label}\n    ${c.detail}`)
}
console.log(`\n${checks.length - failed}/${checks.length} comprobaciones correctas`)
if (failed) process.exit(1)
