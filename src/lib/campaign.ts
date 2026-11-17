import { CAMPAIGN } from '../config/campaign'

/** Fecha (AAAA-MM-DD) en la zona horaria de la campaña (Madrid). */
export function ymdInZone(now: Date, timeZone: string = CAMPAIGN.timeZone): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** La campaña termina al acabar el día `endDate` (inclusive) hora de Madrid. */
export function isCampaignClosed(now: Date, endDate: string = CAMPAIGN.endDate): boolean {
  return ymdInZone(now) > endDate
}

/** Días naturales que quedan, contando hoy (0 si es el último día; null si ya cerró). */
export function daysLeft(now: Date, endDate: string = CAMPAIGN.endDate): number | null {
  const today = ymdInZone(now)
  if (today > endDate) return null
  const a = Date.parse(`${today}T00:00:00Z`)
  const b = Date.parse(`${endDate}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

/** En desarrollo se puede simular la fecha con ?ahora=2026-12-01T10:00:00 */
export function currentNow(): Date {
  if (import.meta.env.DEV) {
    const sim = new URLSearchParams(window.location.search).get('ahora')
    if (sim) {
      const d = new Date(sim)
      if (!Number.isNaN(d.getTime())) return d
    }
  }
  return new Date()
}
