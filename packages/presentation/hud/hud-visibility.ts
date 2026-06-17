export const GAMEPLAY_HUD_HIDDEN_CLASS = 'hud-hidden'

const getBody = (): HTMLElement | null => {
  if (typeof document === 'undefined') return null
  return document.body
}

export const isGameplayHudHidden = (): boolean =>
  getBody()?.classList.contains(GAMEPLAY_HUD_HIDDEN_CLASS) ?? false

export const toggleGameplayHudVisibility = (): boolean => {
  const body = getBody()
  if (body === null) return false
  return body.classList.toggle(GAMEPLAY_HUD_HIDDEN_CLASS)
}

export const setGameplayHudHidden = (hidden: boolean): void => {
  const body = getBody()
  if (body === null) return
  body.classList.toggle(GAMEPLAY_HUD_HIDDEN_CLASS, hidden)
}
