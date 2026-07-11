import { Effect } from 'effect'
import { KeyMappings } from '@ts-minecraft/entity/domain/key-mappings'
import { InputService, MouseButton } from '@ts-minecraft/presentation/input/input-service'
import { TOUCH_CONTROLS_STYLE_ID, touchControlsCss } from './touch-controls-styles'

const LOOK_SENSITIVITY = 0.42
const STICK_RADIUS = 42
const MOVE_DEAD_ZONE = 0.18

type VirtualInput = Pick<InputService,
  | 'addVirtualLookDelta'
  | 'clearVirtualInput'
  | 'pulseVirtualKey'
  | 'setVirtualKey'
  | 'setVirtualLookActive' | 'setVirtualMouseButton'
>

type PointerCleanup = () => void

export interface ExclusiveMountOwner {
  readonly claim: (cleanup: PointerCleanup) => PointerCleanup
  readonly release: PointerCleanup
}

export const createExclusiveMountOwner = (): ExclusiveMountOwner => {
  let active: PointerCleanup | undefined
  const release = () => {
    const cleanup = active
    active = undefined
    cleanup?.()
  }
  return {
    release,
    claim: (cleanup) => {
      release()
      let disposed = false
      const ownedCleanup = () => {
        if (disposed) return
        disposed = true
        if (active === ownedCleanup) active = undefined
        cleanup()
      }
      active = ownedCleanup
      return ownedCleanup
    },
  }
}

const touchControlsMountOwner = createExclusiveMountOwner()

const runInput = (effect: Effect.Effect<void, never>): void => Effect.runSync(effect)

const makeButton = (control: string, label: string, accessibleName: string, held = false): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'touch-button'
  button.dataset['touchControl'] = control
  button.setAttribute('aria-label', accessibleName)
  if (held) button.setAttribute('aria-pressed', 'false')
  button.textContent = label
  return button
}

export const bindHeldInput = (
  button: HTMLButtonElement,
  onChange: (pressed: boolean) => void,
  resets: PointerCleanup[],
): PointerCleanup => {
  const activeSources = new Set<string>()
  const update = () => {
    const pressed = activeSources.size > 0
    button.setAttribute('aria-pressed', String(pressed))
    onChange(pressed)
  }
  const down = (event: PointerEvent) => {
    event.preventDefault()
    activeSources.add(`pointer:${event.pointerId}`)
    button.setPointerCapture(event.pointerId)
    update()
  }
  const release = (event: PointerEvent) => {
    if (!activeSources.delete(`pointer:${event.pointerId}`)) return
    update()
  }
  const keyDown = (event: KeyboardEvent) => {
    if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return
    event.preventDefault()
    activeSources.add(`key:${event.key}`)
    update()
  }
  const keyUp = (event: KeyboardEvent) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    if (!activeSources.delete(`key:${event.key}`)) return
    update()
  }
  button.addEventListener('pointerdown', down)
  button.addEventListener('pointerup', release)
  button.addEventListener('pointercancel', release)
  button.addEventListener('lostpointercapture', release)
  button.addEventListener('keydown', keyDown)
  button.addEventListener('keyup', keyUp)
  resets.push(() => {
    activeSources.clear()
    button.setAttribute('aria-pressed', 'false')
  })
  return () => {
    button.removeEventListener('pointerdown', down)
    button.removeEventListener('pointerup', release)
    button.removeEventListener('pointercancel', release)
    button.removeEventListener('lostpointercapture', release)
    button.removeEventListener('keydown', keyDown)
    button.removeEventListener('keyup', keyUp)
  }
}

export const bindPulseInput = (button: HTMLButtonElement, pulse: () => void): PointerCleanup => {
  const click = (event: MouseEvent) => {
    event.preventDefault()
    pulse()
  }
  button.addEventListener('click', click)
  return () => {
    button.removeEventListener('click', click)
  }
}

const bindMoveStick = (surface: HTMLElement, knob: HTMLElement, input: VirtualInput, resets: PointerCleanup[]): PointerCleanup => {
  let pointerId: number | null = null
  const setDirection = (x: number, y: number) => {
    const magnitude = Math.min(1, Math.hypot(x, y))
    const active = magnitude >= MOVE_DEAD_ZONE
    runInput(input.setVirtualKey(KeyMappings.MOVE_LEFT, active && x < -MOVE_DEAD_ZONE))
    runInput(input.setVirtualKey(KeyMappings.MOVE_RIGHT, active && x > MOVE_DEAD_ZONE))
    runInput(input.setVirtualKey(KeyMappings.MOVE_FORWARD, active && y < -MOVE_DEAD_ZONE))
    runInput(input.setVirtualKey(KeyMappings.MOVE_BACKWARD, active && y > MOVE_DEAD_ZONE))
    knob.style.transform = `translate(${x * STICK_RADIUS}px,${y * STICK_RADIUS}px)`
  }
  const update = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    const rect = surface.getBoundingClientRect()
    const x = event.clientX - (rect.left + rect.width / 2)
    const y = event.clientY - (rect.top + rect.height / 2)
    const length = Math.max(STICK_RADIUS, Math.hypot(x, y))
    setDirection(x / length, y / length)
  }
  const down = (event: PointerEvent) => {
    if (pointerId !== null) return
    event.preventDefault()
    pointerId = event.pointerId
    surface.setPointerCapture(event.pointerId)
    update(event)
  }
  const release = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    pointerId = null
    setDirection(0, 0)
  }
  surface.addEventListener('pointerdown', down)
  surface.addEventListener('pointermove', update)
  surface.addEventListener('pointerup', release)
  surface.addEventListener('pointercancel', release)
  surface.addEventListener('lostpointercapture', release)
  resets.push(() => {
    pointerId = null
    knob.style.transform = 'translate(0px,0px)'
  })
  return () => {
    surface.removeEventListener('pointerdown', down)
    surface.removeEventListener('pointermove', update)
    surface.removeEventListener('pointerup', release)
    surface.removeEventListener('pointercancel', release)
    surface.removeEventListener('lostpointercapture', release)
  }
}

const bindLookSurface = (surface: HTMLElement, input: VirtualInput, resets: PointerCleanup[]): PointerCleanup => {
  const positions = new Map<number, readonly [number, number]>()
  const down = (event: PointerEvent) => {
    event.preventDefault()
    if (positions.size === 0) runInput(input.setVirtualLookActive(true))
    positions.set(event.pointerId, [event.clientX, event.clientY])
    surface.setPointerCapture(event.pointerId)
  }
  const move = (event: PointerEvent) => {
    const previous = positions.get(event.pointerId)
    if (previous === undefined) return
    event.preventDefault()
    runInput(input.addVirtualLookDelta(
      (event.clientX - previous[0]) * LOOK_SENSITIVITY,
      (event.clientY - previous[1]) * LOOK_SENSITIVITY,
    ))
    positions.set(event.pointerId, [event.clientX, event.clientY])
  }
  const release = (event: PointerEvent) => {
    if (!positions.delete(event.pointerId)) return
    if (positions.size === 0) runInput(input.setVirtualLookActive(false))
  }
  surface.addEventListener('pointerdown', down)
  surface.addEventListener('pointermove', move)
  surface.addEventListener('pointerup', release)
  surface.addEventListener('pointercancel', release)
  surface.addEventListener('lostpointercapture', release)
  resets.push(() => {
    positions.clear()
    runInput(input.setVirtualLookActive(false))
  })
  return () => {
    surface.removeEventListener('pointerdown', down)
    surface.removeEventListener('pointermove', move)
    surface.removeEventListener('pointerup', release)
    surface.removeEventListener('pointercancel', release)
    surface.removeEventListener('lostpointercapture', release)
  }
}

export const mountTouchControls = (input: VirtualInput): PointerCleanup => {
  touchControlsMountOwner.release()

  const style = document.createElement('style')
  style.id = TOUCH_CONTROLS_STYLE_ID
  style.textContent = touchControlsCss
  document.head.appendChild(style)

  const root = document.createElement('div')
  root.id = 'touch-controls'
  root.dataset['touchControls'] = 'true'
  root.setAttribute('role', 'group')
  root.setAttribute('aria-label', 'Touch game controls')

  const look = document.createElement('div')
  look.id = 'touch-look'
  look.dataset['touchControl'] = 'look'
  look.setAttribute('aria-hidden', 'true')
  root.appendChild(look)

  const move = document.createElement('div')
  move.id = 'touch-move'
  move.dataset['touchControl'] = 'move'
  move.setAttribute('aria-hidden', 'true')
  const knob = document.createElement('div')
  knob.id = 'touch-move-knob'
  knob.setAttribute('aria-hidden', 'true')
  move.appendChild(knob)
  root.appendChild(move)

  const actions = document.createElement('div')
  actions.id = 'touch-actions'
  actions.className = 'touch-cluster'
  const controls = [
    ['break', 'BREAK', 'Break or attack', (pressed: boolean) => runInput(input.setVirtualMouseButton(MouseButton.LEFT, pressed))],
    ['use', 'USE', 'Place or use item', (pressed: boolean) => runInput(input.setVirtualMouseButton(MouseButton.RIGHT, pressed))],
    ['sneak', 'SNEAK', 'Sneak', (pressed: boolean) => runInput(input.setVirtualKey(KeyMappings.SNEAK, pressed))],
    ['sprint', 'RUN', 'Sprint', (pressed: boolean) => runInput(input.setVirtualKey(KeyMappings.SPRINT, pressed))],
    ['jump', 'JUMP', 'Jump', (pressed: boolean) => runInput(input.setVirtualKey(KeyMappings.JUMP, pressed))],
  ] as const
  const cleanups: PointerCleanup[] = []
  const resets: PointerCleanup[] = []
  for (const [name, label, accessibleName, change] of controls) {
    const button = makeButton(name, label, accessibleName, true)
    button.id = `touch-${name}`
    actions.appendChild(button)
    cleanups.push(bindHeldInput(button, change, resets))
  }
  root.appendChild(actions)

  const menu = document.createElement('div')
  menu.id = 'touch-menu'
  menu.className = 'touch-cluster'
  const inventory = makeButton('inventory', '\u25A6', 'Open inventory')
  const pause = makeButton('pause', '\u2161', 'Pause game')
  menu.append(inventory, pause)
  cleanups.push(bindPulseInput(inventory, () => runInput(input.pulseVirtualKey(KeyMappings.INVENTORY_OPEN))))
  cleanups.push(bindPulseInput(pause, () => runInput(input.pulseVirtualKey('Escape'))))
  root.appendChild(menu)

  const hotbar = document.createElement('div')
  hotbar.id = 'touch-hotbar'
  hotbar.className = 'touch-cluster'
  hotbar.setAttribute('role', 'group')
  hotbar.setAttribute('aria-label', 'Select hotbar slot')
  for (let slot = 1; slot <= 9; slot += 1) {
    const button = makeButton(`hotbar-${slot}`, String(slot), `Select hotbar slot ${slot}`)
    hotbar.appendChild(button)
    cleanups.push(bindPulseInput(button, () => runInput(input.pulseVirtualKey(`Digit${slot}`))))
  }
  root.appendChild(hotbar)

  const orientation = document.createElement('div')
  orientation.id = 'touch-orientation'
  orientation.setAttribute('role', 'status')
  orientation.setAttribute('aria-live', 'polite')
  orientation.innerHTML = '<div><strong>Rotate to landscape</strong><span>Landscape gives you a wider view and room for every control.</span></div>'
  root.appendChild(orientation)

  document.body.appendChild(root)
  cleanups.push(bindMoveStick(move, knob, input, resets), bindLookSurface(look, input, resets))

  const clear = () => {
    runInput(input.clearVirtualInput())
    for (const reset of resets) reset()
    root.querySelectorAll('[aria-pressed="true"]').forEach((element) => element.setAttribute('aria-pressed', 'false'))
  }
  const visibility = () => { if (document.hidden) clear() }
  window.addEventListener('blur', clear)
  window.addEventListener('pagehide', clear)
  document.addEventListener('visibilitychange', visibility)

  return touchControlsMountOwner.claim(() => {
    for (const cleanup of cleanups) cleanup()
    window.removeEventListener('blur', clear)
    window.removeEventListener('pagehide', clear)
    document.removeEventListener('visibilitychange', visibility)
    clear()
    root.remove()
    style.remove()
  })
}

export class TouchControlsService extends Effect.Service<TouchControlsService>()(
  '@minecraft/presentation/TouchControlsService',
  {
    scoped: Effect.gen(function* () {
      const input = yield* InputService
      if (typeof document === 'undefined' || typeof window === 'undefined') {
        return { mounted: Boolean(false) }
      }
      const cleanup = yield* Effect.acquireRelease(
        Effect.sync(() => mountTouchControls(input)),
        (dispose) => Effect.sync(dispose),
      )
      void cleanup
      return { mounted: Boolean(true) }
    }),
  },
) {}
