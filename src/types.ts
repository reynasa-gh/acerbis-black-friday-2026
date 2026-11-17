/** Tipos compartidos entre el importador (scripts/) y la aplicación (src/). */

export interface SizeInfo {
  /** Código de 3 cifras del sufijo de la referencia (p. ej. "062"), o null. */
  code: string | null
  /** Etiqueta de talla mostrada (p. ej. "S"). null si no está verificada. */
  label: string | null
  verified: boolean
  /** De dónde sale la equivalencia verificada. */
  source: 'tabla-acerbis' | 'descripcion' | null
}

export interface ColorInfo {
  /** Código de 3 cifras tras el modelo (p. ej. "318"). */
  code: string | null
  /** Etiqueta de color extraída de las descripciones del mismo modelo+código. */
  label: string | null
  verified: boolean
}

export interface Variant {
  /** Referencia exacta (texto, con ceros iniciales y sufijo ACB). */
  sku: string
  /** Fila del Excel de origen (1 = cabecera). */
  sourceRow: number
  units: number
  /** Importes en céntimos. El neto se redondea una sola vez, half-up, desde la columna E. */
  pvpCents: number
  netCents: number
  /** Valor original de la columna F (fracción, p. ej. 0.4). */
  discount: number
  /** Porcentaje para mostrar, 2 decimales máx. (40, 45, 29.64). */
  discountPct: number
  /** true si no es el 40 % ni el 45 % de campaña. */
  discountExceptional: boolean
  size: SizeInfo
  color: ColorInfo
  /** Sufijo de 3 cifras que NO es talla (versión/aplicación), p. ej. "098". */
  version: string | null
  image: string
  /** Imagen verificada del mismo producto y color si la propia falla. */
  imageFallback: string | null
  /** Descripción tal cual en el Excel ("0" si venía 0). */
  descriptionOriginal: string
  /** Descripción usada (resuelta si la original era "0"). */
  description: string
  /** SKU de la fila de la que se ha heredado la descripción, si procede. */
  inheritedFrom: string | null
  flags: string[]
}

export interface Product {
  /** Código de modelo: 7 primeras cifras de la referencia. */
  id: string
  name: string
  familyId: string
  subfamilyId: string | null
  variants: Variant[]
  totalUnits: number
  minNetCents: number
  maxNetCents: number
  /** true si hay precios netos distintos entre variantes → "Desde…". */
  priceVaries: boolean
  /** Variante representativa para la tarjeta (índice en variants). */
  coverIndex: number
}

export interface Subfamily {
  id: string
  name: string
}

export interface Family {
  id: string
  name: string
  subfamilies: Subfamily[]
}

export interface CatalogMeta {
  sourceFile: string
  sourceSha256: string
  sheet: string
  /** ISO de la importación (fecha de la "fotografía" de existencias). */
  importedAt: string
  rows: number
  uniqueSkus: number
  totalUnits: number
  products: number
}

export interface Catalog {
  meta: CatalogMeta
  families: Family[]
  products: Product[]
}

/* ---------- Registro de revisión interna ---------- */

export interface ReviewItem {
  sku?: string
  model?: string
  sourceRow?: number
  message: string
}

export interface CheckResult {
  id: string
  label: string
  ok: boolean
  detail: string
}

export interface ReviewLog {
  generatedAt: string
  checks: CheckResult[]
  inheritedDescriptions: Array<{ sku: string; sourceRow: number; from: string; description: string }>
  unresolvedDescriptions: ReviewItem[]
  groups: Array<{
    model: string
    name: string
    family: string
    variants: number
    units: number
    colors: Array<{ code: string | null; label: string | null; variants: number; units: number }>
  }>
  sizeEvidence: Array<{ code: string; label: string; source: string; rowsInExcel: number; confirmedByDescription: number }>
  pendingData: ReviewItem[]
  exceptions: ReviewItem[]
  imageIssues: ReviewItem[]
  classificationNotes: ReviewItem[]
  discrepancyNote: string
}
