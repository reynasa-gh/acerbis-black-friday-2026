import { readSheet } from 'read-excel-file/node'
import type { RawRow } from './normalize'

const HEADERS = ['Artículo', 'Descripcion Articulo', 'Unidades en Oferta', 'pvp', 'Neto Oferta', 'Dto en oferta', 'Enlace a imagen']

/** Lee la hoja «Hoja1» (o la primera) conservando todos los datos originales y su número de fila. */
export async function readRows(path: string, sheetName = 'Hoja1'): Promise<{ rows: RawRow[]; sheet: string }> {
  let sheet = sheetName
  let data: unknown[][]
  try {
    data = (await readSheet(path, sheetName)) as unknown[][]
  } catch {
    sheet = '(primera hoja)'
    data = (await readSheet(path)) as unknown[][]
  }
  const header = (data[0] ?? []).map((h) => String(h ?? '').trim().toLowerCase())
  HEADERS.forEach((h, i) => {
    if (header[i] !== h.toLowerCase()) {
      throw new Error(`Cabecera inesperada en la columna ${i + 1}: «${String(data[0]?.[i])}», se esperaba «${h}»`)
    }
  })

  const rows: RawRow[] = []
  data.slice(1).forEach((r, i) => {
    const fila = i + 2
    if (r.every((c) => c === null || c === undefined || c === '')) return
    const num = (v: unknown, col: string): number => {
      const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
      if (!Number.isFinite(n)) throw new Error(`Valor numérico no válido en fila ${fila}, columna ${col}: «${String(v)}»`)
      return n
    }
    const desc = r[1]
    const descStr = desc === null || desc === undefined ? '' : String(desc).trim()
    rows.push({
      fila,
      articulo: String(r[0]).trim(), // referencia siempre como texto
      descripcion: descStr === '' ? '0' : descStr,
      descripcionEsCero: descStr === '' || descStr === '0',
      unidades: num(r[2], 'C'),
      pvp: num(r[3], 'D'),
      neto: num(r[4], 'E'),
      dto: num(r[5], 'F'),
      imagen: String(r[6] ?? '').trim(),
    })
  })
  return { rows, sheet }
}
