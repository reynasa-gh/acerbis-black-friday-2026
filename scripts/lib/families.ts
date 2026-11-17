import type { Family } from '../../src/types'
import { fold } from './reference'

/** Estructura inicial de familias (orden de navegación). Solo se publican las que tienen productos. */
export const TAXONOMY: Family[] = [
  { id: 'cascos', name: 'Cascos', subfamilies: [
    { id: 'integrales', name: 'Integrales' },
    { id: 'modulares', name: 'Modulares' },
    { id: 'jet', name: 'Jet' },
    { id: 'off-road', name: 'Off-road' },
    { id: 'otros-cascos', name: 'Otros cascos' },
  ] },
  { id: 'guantes', name: 'Guantes', subfamilies: [] },
  { id: 'chaquetas', name: 'Chaquetas', subfamilies: [
    { id: 'chaquetas-moto', name: 'Chaquetas' },
    { id: 'accesorios-chaqueta', name: 'Accesorios de chaqueta' },
  ] },
  { id: 'pantalones', name: 'Pantalones y vaqueros', subfamilies: [
    { id: 'pantalones-moto', name: 'Pantalones' },
    { id: 'vaqueros', name: 'Vaqueros' },
  ] },
  { id: 'ropa-complementos', name: 'Ropa técnica y complementos', subfamilies: [
    { id: 'calcetines', name: 'Calcetines' },
    { id: 'jerseys', name: 'Jerseys' },
  ] },
  { id: 'lluvia', name: 'Ropa de lluvia y cubrebotas', subfamilies: [
    { id: 'trajes-lluvia', name: 'Trajes y conjuntos' },
    { id: 'chubasqueros', name: 'Chubasqueros' },
    { id: 'pantalon-lluvia', name: 'Pantalones de lluvia' },
    { id: 'cubrebotas', name: 'Cubrebotas' },
  ] },
  { id: 'botas', name: 'Botas', subfamilies: [] },
  { id: 'protecciones', name: 'Protecciones del motorista', subfamilies: [
    { id: 'petos-armaduras', name: 'Petos y armaduras' },
    { id: 'espalderas', name: 'Espalderas' },
    { id: 'rodilleras', name: 'Rodilleras' },
    { id: 'fajas', name: 'Fajas' },
    { id: 'collarines', name: 'Collarines' },
    { id: 'otras-protecciones', name: 'Otras protecciones' },
  ] },
  { id: 'recambios-casco', name: 'Recambios y accesorios de casco', subfamilies: [
    { id: 'visores', name: 'Visores y pantallas' },
    { id: 'interiores', name: 'Interiores' },
    { id: 'mecanismos', name: 'Mecanismos' },
    { id: 'ventilaciones', name: 'Ventilaciones' },
  ] },
  { id: 'paramanos-proteccion', name: 'Paramanos y protecciones de la moto', subfamilies: [
    { id: 'paramanos', name: 'Paramanos y kits de montaje' },
    { id: 'chasis-motor', name: 'Chasis, basculante y motor' },
    { id: 'frenos-palancas', name: 'Frenos y palancas' },
    { id: 'suspension-radiador', name: 'Horquilla, amortiguador y radiador' },
    { id: 'otras-protecciones-moto', name: 'Otras protecciones' },
  ] },
  { id: 'carroceria', name: 'Carrocería y plásticos', subfamilies: [
    { id: 'guardabarros', name: 'Guardabarros' },
    { id: 'tapas-kits', name: 'Tapas laterales y kits' },
  ] },
  { id: 'filtros-admision', name: 'Filtros de aire y admisión', subfamilies: [
    { id: 'filtros-aire', name: 'Filtros de aire' },
    { id: 'cajas-aire', name: 'Airbox y tapas de caja' },
  ] },
  { id: 'iluminacion', name: 'Iluminación, retrovisores y portamatrículas', subfamilies: [
    { id: 'faros', name: 'Faros' },
    { id: 'fijaciones-faro', name: 'Fijaciones de faro' },
    { id: 'retrovisores', name: 'Retrovisores' },
    { id: 'portamatriculas', name: 'Portamatrículas' },
  ] },
  { id: 'bolsas', name: 'Bolsas, riñoneras y transporte', subfamilies: [
    { id: 'rinoneras', name: 'Riñoneras' },
    { id: 'bolsas-casco', name: 'Bolsas' },
  ] },
  { id: 'taller', name: 'Taller y otros accesorios', subfamilies: [
    { id: 'taller-general', name: 'Taller' },
    { id: 'grifos', name: 'Grifos de gasolina' },
  ] },
]

interface Rule { re: RegExp; family: string; sub: string | null }

/** Reglas por inicio/palabras clave de la descripción (texto sin acentos y en minúsculas). El orden importa. */
const RULES: Rule[] = [
  { re: /^(visor|visera|lente pinlock|gafa abatible)/, family: 'recambios-casco', sub: 'visores' },
  { re: /^(interior casco|forro interior)/, family: 'recambios-casco', sub: 'interiores' },
  { re: /^mecanismo/, family: 'recambios-casco', sub: 'mecanismos' },
  { re: /^ventilacion/, family: 'recambios-casco', sub: 'ventilaciones' },
  { re: /^casco/, family: 'cascos', sub: null },
  { re: /^guantes?\b/, family: 'guantes', sub: null },
  { re: /^membrana/, family: 'chaquetas', sub: 'accesorios-chaqueta' },
  { re: /^chaqueta/, family: 'chaquetas', sub: 'chaquetas-moto' },
  { re: /^pantalon.*(transparente|rain)/, family: 'lluvia', sub: 'pantalon-lluvia' },
  { re: /^pantalon/, family: 'pantalones', sub: 'pantalones-moto' },
  { re: /^vaqueros/, family: 'pantalones', sub: 'vaqueros' },
  { re: /^(traje de (agua|lluvia)|acerbis rain set)/, family: 'lluvia', sub: 'trajes-lluvia' },
  { re: /^chubasquero/, family: 'lluvia', sub: 'chubasqueros' },
  { re: /^cubre ?(botas|calzados)/, family: 'lluvia', sub: 'cubrebotas' },
  { re: /^botas?\b/, family: 'botas', sub: null },
  { re: /^(peto|armadura|protector integral)/, family: 'protecciones', sub: 'petos-armaduras' },
  { re: /^(espaldera|protector de espalda|protecciones acerbis coluna)/, family: 'protecciones', sub: 'espalderas' },
  { re: /^rodillera/, family: 'protecciones', sub: 'rodilleras' },
  { re: /^faja/, family: 'protecciones', sub: 'fajas' },
  { re: /^collar cervical/, family: 'protecciones', sub: 'collarines' },
  { re: /^protector de palma/, family: 'protecciones', sub: 'otras-protecciones' },
  { re: /^calcetines/, family: 'ropa-complementos', sub: 'calcetines' },
  { re: /^jersey/, family: 'ropa-complementos', sub: 'jerseys' },
  { re: /paramanos|cubremanos|^kit de montaje/, family: 'paramanos-proteccion', sub: 'paramanos' },
  { re: /^protector puños|^protector punos/, family: 'paramanos-proteccion', sub: 'otras-protecciones-moto' },
  { re: /^correas de montaje para faro/, family: 'iluminacion', sub: 'fijaciones-faro' },
  { re: /^faro\b/, family: 'iluminacion', sub: 'faros' },
  { re: /^retrovisor/, family: 'iluminacion', sub: 'retrovisores' },
  { re: /^portamatricula/, family: 'iluminacion', sub: 'portamatriculas' },
  { re: /^(protecci(on|ones) (acerbis )?(chasis|basculante)|protector(es)? (de )?chasis|cubrecarter|protector tapas motor|protector de escape)/, family: 'paramanos-proteccion', sub: 'chasis-motor' },
  { re: /(disco|palanca de freno|maneta freno|tapas bomba freno)/, family: 'paramanos-proteccion', sub: 'frenos-palancas' },
  { re: /(horquilla|amortiguadro|amortiguador|rejillas proteccion)/, family: 'paramanos-proteccion', sub: 'suspension-radiador' },
  { re: /^guardabarros/, family: 'carroceria', sub: 'guardabarros' },
  { re: /^(tapas laterales|kit de carroceria)/, family: 'carroceria', sub: 'tapas-kits' },
  { re: /filtro de aire/, family: 'filtros-admision', sub: 'filtros-aire' },
  { re: /^(airbox|tapa de caja de aire)/, family: 'filtros-admision', sub: 'cajas-aire' },
  { re: /^rinonera/, family: 'bolsas', sub: 'rinoneras' },
  { re: /^bolsa/, family: 'bolsas', sub: 'bolsas-casco' },
  { re: /^probeta/, family: 'taller', sub: 'taller-general' },
  { re: /^grifo/, family: 'taller', sub: 'grifos' },
]

export interface Classification {
  familyId: string
  subfamilyId: string | null
  /** true si se ha tenido que usar la familia de reserva o la subfamilia genérica. */
  uncertain: boolean
  reason: string
}

function helmetSub(texts: string[]): string {
  const all = texts.join(' | ')
  if (/modular/.test(all)) return 'modulares'
  if (/\bjet\b/.test(all)) return 'jet'
  if (/integral\b/.test(all)) return 'integrales'
  if (/off.?road|infantil|motocross/.test(all)) return 'off-road'
  return 'otros-cascos'
}

/** Clasifica un modelo por votación entre todas sus descripciones (no por una sola fila). */
export function classifyModel(descriptions: string[]): Classification {
  const folded = descriptions.map((d) => fold(d).replace(/\s+/g, ' ').trim())
  const votes = new Map<number, number>()
  for (const d of folded) {
    const idx = RULES.findIndex((r) => r.re.test(d))
    if (idx >= 0) votes.set(idx, (votes.get(idx) ?? 0) + 1)
  }
  if (votes.size === 0) {
    return { familyId: 'taller', subfamilyId: 'taller-general', uncertain: true, reason: 'Sin regla aplicable: familia de reserva «Taller y otros accesorios»' }
  }
  const [best] = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])
  const rule = RULES[best[0]]
  if (rule.family === 'cascos') {
    const sub = helmetSub(folded)
    return {
      familyId: 'cascos',
      subfamilyId: sub,
      uncertain: sub === 'otros-cascos',
      reason: sub === 'otros-cascos' ? 'Los datos no permiten distinguir si es integral, modular, jet u off-road' : `Tipo de casco deducido de la descripción (${sub})`,
    }
  }
  return { familyId: rule.family, subfamilyId: rule.sub, uncertain: false, reason: 'Regla por palabra clave de la descripción' }
}
