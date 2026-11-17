/**
 * Comprobación de imágenes: una petición HEAD por URL única (GET parcial si el servidor no admite HEAD).
 * No se descarga ni se guarda ninguna imagen; solo se anota si responde 200 con tipo image/*.
 */
export async function checkImages(
  urls: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Record<string, boolean>> {
  const unique = [...new Set(urls)]
  const status: Record<string, boolean> = {}
  let done = 0
  let cursor = 0

  async function probe(url: string): Promise<boolean> {
    const attempt = async (method: 'HEAD' | 'GET') => {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 15_000)
      try {
        const res = await fetch(url, {
          method,
          signal: ctrl.signal,
          headers: method === 'GET' ? { Range: 'bytes=0-0' } : undefined,
        })
        return res
      } finally {
        clearTimeout(timer)
      }
    }
    try {
      let res = await attempt('HEAD')
      if (res.status === 405 || res.status === 403 || res.status === 501) res = await attempt('GET')
      const type = res.headers.get('content-type') ?? ''
      return (res.ok || res.status === 206) && type.startsWith('image/')
    } catch {
      return false
    }
  }

  async function worker() {
    while (cursor < unique.length) {
      const url = unique[cursor++]
      status[url] = await probe(url)
      onProgress?.(++done, unique.length)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return status
}


/**
 * URLs candidatas de la imagen de la REFERENCIA PADRE de una variante (modelo + color, sin talla).
 * Las variantes hijas (tallas) comparten la foto de su referencia principal; cuando la propia foto
 * da 404 se usa la del padre. Nombres de archivo habituales del servidor de imágenes: 0022649.090.jpg,
 * 0022649_090.jpg, 0022649090.jpg… Solo se acepta una URL que responda como imagen.
 */
export function parentImageCandidates(sku: string, image: string): string[] {
  const m = /^(\d{7})(\d{3})?(\d{3})?ACB$/.exec(sku)
  if (!m) return []
  const dir = image.slice(0, image.lastIndexOf('/') + 1)
  const stem = image.slice(image.lastIndexOf('/') + 1).replace(/\.jpg$/i, '')
  const [, model, color] = m
  const names: string[] = []
  if (color) names.push(`${model}.${color}`, `${model}_${color}`, `${model}${color}`, `${model}${color}ACB`, `${model}.${color}ACB`)
  else names.push(model, `${model}ACB`)
  // Derivadas del nombre que figura en el Excel (punto final o doble punto, separador, sin sufijo de talla)
  names.push(stem.replace(/\.+$/, ''))
  names.push(stem.replace(/^(\d{7})\.(\d{3})(?:\.\d{3})?$/, '$1_$2'))
  names.push(stem.replace(/^(\d{7})\.(\d{3})\.\d{3}$/, '$1.$2'))
  return [...new Set(names)].map((n) => `${dir}${n}.jpg`).filter((u) => u !== image)
}
