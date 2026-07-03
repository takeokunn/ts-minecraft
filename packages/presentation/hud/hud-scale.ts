// Applies the accessibility UI-scale setting to the fixed DOM HUD clusters.
// transform:scale keeps each cluster anchored to its own screen corner via
// a matching transform-origin, so scaled HUDs never drift off-screen.
const SCALED_HUD_ELEMENTS: ReadonlyArray<readonly [string, string]> = [
  ['survival-hud', 'bottom center'],
  ['effects-display', 'top right'],
  ['fps-counter', 'top right'],
  ['autosave-status', 'top right'],
  ['air-display', 'bottom center'],
  ['break-progress', 'top center'],
]

export const applyHudScale = (scale: number): void => {
  /* c8 ignore next */
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return
  for (const [id, origin] of SCALED_HUD_ELEMENTS) {
    const el = document.getElementById(id)
    if (el === null) continue
    el.style.transform = scale === 1 ? '' : `scale(${scale})`
    el.style.transformOrigin = origin
  }
}
