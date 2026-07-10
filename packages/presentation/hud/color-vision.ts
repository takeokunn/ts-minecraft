// Applies the accessibility colorblind-correction setting. The actual filters
// (SVG feColorMatrix daltonization) live in index.html; this just flips the
// body data attribute the CSS rules key on.
export type ColorVisionModeValue = 'off' | 'protanopia' | 'deuteranopia' | 'tritanopia'

export const applyColorVisionMode = (mode: ColorVisionModeValue): void => {
  /* c8 ignore next */
  if (typeof document === 'undefined' || typeof document.body === 'undefined') return
  if (mode === 'off') {
    delete document.body.dataset['colorVision']
  } else {
    document.body.dataset['colorVision'] = mode
  }
}
