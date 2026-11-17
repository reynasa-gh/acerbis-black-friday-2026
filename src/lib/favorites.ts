const KEY = 'bf-acerbis-2026-favoritos'

export function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function saveFavorites(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    /* sin almacenamiento: los favoritos viven solo en memoria */
  }
}
