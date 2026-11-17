import fs from 'node:fs'
import path from 'node:path'

const catalog = JSON.parse(fs.readFileSync('src/data/catalog.json', 'utf8'))
const outDir = path.resolve('public/catalogo-fotos')
fs.mkdirSync(outDir, { recursive: true })

const jobs = []
for (const p of catalog.products) {
  for (const v of p.variants) {
    jobs.push({ sku: v.sku, url: v.image, fallbackUrl: v.imageFallback })
  }
}

console.log(`Total referencias: ${jobs.length}`)

let ok = 0
let failed = []
const urlCache = new Map()

async function fetchWithRetry(url, tries = 3) {
  if (urlCache.has(url)) return urlCache.get(url)
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      urlCache.set(url, buf)
      return buf
    } catch (e) {
      if (i === tries - 1) throw e
      await new Promise((r) => setTimeout(r, 300 * (i + 1)))
    }
  }
}

const concurrency = 12
let idx = 0
async function worker() {
  while (idx < jobs.length) {
    const job = jobs[idx++]
    const dest = path.join(outDir, `${job.sku}.jpg`)
    try {
      const buf = await fetchWithRetry(job.url)
      fs.writeFileSync(dest, buf)
      ok++
    } catch (e) {
      if (job.fallbackUrl && job.fallbackUrl !== job.url) {
        try {
          const buf = await fetchWithRetry(job.fallbackUrl)
          fs.writeFileSync(dest, buf)
          ok++
          continue
        } catch (e2) {
          failed.push({ sku: job.sku, url: job.url, fallbackUrl: job.fallbackUrl, error: String(e2) })
          continue
        }
      }
      failed.push({ sku: job.sku, url: job.url, error: String(e) })
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker))

console.log(`Descargadas: ${ok} / ${jobs.length}`)
if (failed.length) {
  console.log(`Fallidas: ${failed.length}`)
  fs.writeFileSync('data/output/fotos-fallidas.json', JSON.stringify(failed, null, 2))
  for (const f of failed.slice(0, 20)) console.log(' -', f.sku, f.error)
}
