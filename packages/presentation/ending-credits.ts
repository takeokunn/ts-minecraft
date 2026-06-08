export const ENDING_CREDITS_DURATION_MS = 60_000

export type EndingCreditsOverlay = {
  readonly element: HTMLDivElement
  readonly show: () => void
  readonly hide: () => void
  readonly destroy: () => void
}

export type EndingCreditsOptions = {
  readonly document?: Document
  readonly durationMs?: number
  readonly onDismiss?: () => void
}

const OVERLAY_STYLE = [
  'position:fixed',
  'inset:0',
  'display:none',
  'align-items:center',
  'justify-content:center',
  'overflow:hidden',
  'background:#050509',
  'color:#f4f4f4',
  'font-family:Georgia,serif',
  'z-index:1200',
  'opacity:0',
  'transition:opacity 1600ms ease',
].join(';')

const SCROLLER_STYLE = [
  'position:absolute',
  'left:50%',
  'top:100%',
  'width:min(720px,78vw)',
  'transform:translateX(-50%)',
  'text-align:center',
  'line-height:1.75',
  'font-size:20px',
  'white-space:pre-line',
].join(';')

const SKIP_STYLE = [
  'position:absolute',
  'right:24px',
  'bottom:20px',
  'font:14px monospace',
  'opacity:0.65',
].join(';')

export const ENDING_CREDITS_TEXT = `The End

And the dragon fell silent.
The island breathed again beneath the stars.

You saw the gateways open.
You saw the egg waiting on the return portal.
You saw experience rise like light from a fountain.

Wake now, player.
Carry the memory home.

Credits

ts-minecraft
An Effect-TS voxel world

Design, code, terrain, entities, rendering, and tests
by the builders of this world.

Thank you for playing.`

export const buildEndingCreditsOverlay = (doc: Document): HTMLDivElement => {
  const overlay = doc.createElement('div')
  overlay.id = 'ending-credits-overlay'
  overlay.style.cssText = OVERLAY_STYLE
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', 'Ending Credits')

  const scroller = doc.createElement('div')
  scroller.id = 'ending-credits-scroll'
  scroller.style.cssText = SCROLLER_STYLE
  scroller.textContent = ENDING_CREDITS_TEXT

  const skip = doc.createElement('div')
  skip.id = 'ending-credits-skip'
  skip.style.cssText = SKIP_STYLE
  skip.textContent = 'ESC / click: return to title'

  overlay.appendChild(scroller)
  overlay.appendChild(skip)
  return overlay
}

export const createEndingCreditsOverlay = (options: EndingCreditsOptions = {}): EndingCreditsOverlay => {
  const doc = options.document ?? document
  const durationMs = options.durationMs ?? ENDING_CREDITS_DURATION_MS
  const overlay = buildEndingCreditsOverlay(doc)
  const scroller = overlay.querySelector<HTMLDivElement>('#ending-credits-scroll')
  const parent = doc.getElementById('game-canvas')?.parentElement ?? doc.body
  let dismissTimer: ReturnType<typeof setTimeout> | null = null

  const clearDismissTimer = (): void => {
    if (dismissTimer === null) return
    clearTimeout(dismissTimer)
    dismissTimer = null
  }

  const hide = (): void => {
    clearDismissTimer()
    overlay.style.opacity = '0'
    overlay.style.display = 'none'
    doc.removeEventListener('keydown', onKeyDown, true)
  }

  const dismiss = (): void => {
    hide()
    options.onDismiss?.()
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    dismiss()
  }

  overlay.addEventListener('click', dismiss)
  parent.appendChild(overlay)

  return {
    element: overlay,
    show: () => {
      clearDismissTimer()
      overlay.style.display = 'flex'
      doc.addEventListener('keydown', onKeyDown, true)
      requestAnimationFrame(() => { overlay.style.opacity = '1' })
      if (scroller !== null) {
        scroller.style.transition = `transform ${durationMs}ms linear`
        requestAnimationFrame(() => { scroller.style.transform = 'translate(-50%, -170%)' })
      }
      dismissTimer = setTimeout(dismiss, durationMs)
    },
    hide,
    destroy: () => {
      hide()
      overlay.removeEventListener('click', dismiss)
      overlay.remove()
    },
  }
}
