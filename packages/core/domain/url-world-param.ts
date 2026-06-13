export const parseWorldParam = (search: string): string | null => {
  const v = new URLSearchParams(search).get('world')
  return v !== null && v.length > 0 ? v : null
}

export const setWorldParam = (worldId: string): void => {
  history.replaceState({}, '', `?${new URLSearchParams({ world: worldId }).toString()}`)
}

export const clearWorldParam = (): void => {
  history.replaceState({}, '', '/')
}
