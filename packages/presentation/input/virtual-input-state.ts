import type { MouseDelta } from '@ts-minecraft/entity/application/player-input-service'

export interface VirtualInputState {
  readonly isKeyPressed: (key: string) => boolean
  readonly consumeKeyPress: (key: string) => boolean
  readonly setKey: (key: string, pressed: boolean) => void
  readonly pulseKey: (key: string) => void
  readonly isMouseDown: (button: number) => boolean
  readonly consumeMouseClick: (button: number) => boolean
  readonly setMouseButton: (button: number, pressed: boolean) => void
  readonly addLookDelta: (x: number, y: number) => void
  readonly consumeLookDelta: () => MouseDelta
  readonly isLookActive: () => boolean
  readonly setLookActive: (active: boolean) => void
  readonly clear: () => void
}

export const createVirtualInputState = (): VirtualInputState => {
  const pressedKeys = new Set<string>()
  const justPressedKeys = new Set<string>()
  const mouseButtons = new Map<number, boolean>()
  const justClickedButtons = new Set<number>()
  let lookDelta: MouseDelta = { x: 0, y: 0 }
  let lookActive = false

  return {
    isKeyPressed: (key) => pressedKeys.has(key),
    consumeKeyPress: (key) => justPressedKeys.delete(key),
    setKey: (key, pressed) => {
      if (pressed) {
        if (!pressedKeys.has(key)) justPressedKeys.add(key)
        pressedKeys.add(key)
      } else {
        pressedKeys.delete(key)
      }
    },
    pulseKey: (key) => { justPressedKeys.add(key) },
    isMouseDown: (button) => mouseButtons.get(button) === true,
    consumeMouseClick: (button) => justClickedButtons.delete(button),
    setMouseButton: (button, pressed) => {
      if (pressed && mouseButtons.get(button) !== true) justClickedButtons.add(button)
      mouseButtons.set(button, pressed)
    },
    addLookDelta: (x, y) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      lookDelta = { x: lookDelta.x + x, y: lookDelta.y + y }
    },
    consumeLookDelta: () => {
      const delta = lookDelta
      lookDelta = { x: 0, y: 0 }
      return delta
    },
    isLookActive: () => lookActive,
    setLookActive: (active) => { lookActive = active },
    clear: () => {
      pressedKeys.clear()
      justPressedKeys.clear()
      mouseButtons.clear()
      justClickedButtons.clear()
      lookDelta = { x: 0, y: 0 }
      lookActive = false
    },
  }
}
