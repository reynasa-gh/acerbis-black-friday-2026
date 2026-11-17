import { describe, expect, it } from 'vitest'
import { parentImageCandidates } from '../scripts/lib/images'
import { CATALOG, VARIANT_BY_SKU } from '../src/lib/catalog'
import { CONDITIONS, VAT_MESSAGE } from '../src/config/campaign'

const base = 'https://imagenesweb.reynasa.com/catalogo/'

describe('imagen de la referencia padre', () => {
  it('propone la foto de modelo + color para una talla hija', () => {
    const c = parentImageCandidates('0022649090068ACB', `${base}0022649.090.068.jpg`)
    expect(c).toContain(`${base}0022649.090.jpg`)
    expect(c).toContain(`${base}0022649_090.jpg`)
    expect(c).not.toContain(`${base}0022649.090.068.jpg`)
  })
  it('corrige el doble punto y el separador del nombre del Excel', () => {
    expect(parentImageCandidates('0007841ACB', `${base}0007841..jpg`)).toContain(`${base}0007841.jpg`)
    expect(parentImageCandidates('0026618223ACB', `${base}0024288.223.jpg`)).toContain(`${base}0024288_223.jpg`)
  })
})

describe('catálogo con foto de respaldo', () => {
  const variants = CATALOG.products.flatMap((p) => p.variants)
  it('toda variante con foto caída tiene respaldo o queda señalada con marcador', () => {
    const failed = variants.filter((v) => v.flags.includes('imagen-fallida'))
    expect(failed.length).toBe(59)
    const withParent = failed.filter((v) => v.flags.includes('imagen-padre'))
    expect(withParent.every((v) => v.imageFallback && v.imageFallback !== v.image)).toBe(true)
    expect(VARIANT_BY_SKU.get('0016428318068ACB')!.variant.imageFallback).toContain('0016428')
  })
})

describe('condiciones', () => {
  it('IVA no incluido forma parte de las condiciones visibles', () => {
    expect(VAT_MESSAGE).toBe('IVA no incluido.')
    expect(CONDITIONS).toHaveLength(4)
    expect(CONDITIONS[3]).toBe('IVA no incluido.')
  })
})
