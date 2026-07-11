// Applies the accessibility UI-scale setting to the fixed DOM HUD clusters.
// transform:scale keeps each cluster anchored to its own screen corner via
// a matching transform-origin, so scaled HUDs never drift off-screen.
const SCALED_HUD_ELEMENTS: ReadonlyArray<readonly [string, string, string]> = [
  ['survival-hud', 'bottom center', 'translateX(-50%)'],
  ['effects-display', 'top right', ''],
  ['fps-counter', 'top right', ''],
  ['autosave-status', 'top right', ''],
  ['air-display', 'bottom center', 'translateX(-50%)'],
  ['break-progress', 'top center', 'translateX(-50%)'],
]

let currentHudScale = 1

export const getHudScale = (): number => currentHudScale

export const applyHudScale = (scale: number): void => {
  currentHudScale = scale
  /* c8 ignore next */
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return
  for (const [id, origin, baseTransform] of SCALED_HUD_ELEMENTS) {
    const el = document.getElementById(id)
    if (el === null) continue
    el.style.transform = [baseTransform, scale === 1 ? '' : `scale(${scale})`]
      .filter(Boolean)
      .join(' ')
    el.style.transformOrigin = origin
  }

  const crosshair = document.getElementById('crosshair')
  if (crosshair !== null) {
    crosshair.style.transform = `translate(-50%, -50%) scale(${scale})`
    crosshair.style.transformOrigin = 'center'
  }
}
