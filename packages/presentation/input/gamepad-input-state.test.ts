import { describe, expect, it } from '@effect/vitest'
import { KeyMappings } from '@ts-minecraft/entity/domain/key-mappings'
import { collectGamepadSnapshot, createGamepadEdgeTracker } from './gamepad-input-state'

const button = (pressed: boolean, value = pressed ? 1 : 0): GamepadButton => ({ pressed, value })

const gamepad = ({
  axes = [],
  buttons = [],
  connected = true,
}: {
  readonly axes?: readonly number[]
  readonly buttons?: readonly GamepadButton[]
  readonly connected?: boolean
} = {}): Gamepad => ({
  axes,
  buttons,
  connected,
  id: 'test-gamepad',
  index: 0,
  mapping: 'standard',
  timestamp: 0,
  vibrationActuator: null,
  hapticActuators: [],
} as unknown as Gamepad)

const buttonsWith = (entries: ReadonlyArray<readonly [number, GamepadButton]>): GamepadButton[] => {
  const buttons = Array.from({ length: 16 }, () => button(false))
  for (const [index, value] of entries) buttons[index] = value
  return buttons
}

describe('collectGamepadSnapshot', () => {
  it('treats the deadzone boundary as neutral and values above it as input', () => {
    const boundary = collectGamepadSnapshot([gamepad({ axes: [0.15, -0.15, 0.15, -0.15] })])
    const above = collectGamepadSnapshot([gamepad({ axes: [0.151, -0.151, 0.151, -0.151] })])

    expect(boundary.pressedKeys.size).toBe(0)
    expect(boundary.mouseDelta).toEqual({ x: 0, y: 0 })
    expect(above.pressedKeys).toEqual(new Set([KeyMappings.MOVE_RIGHT, KeyMappings.MOVE_FORWARD]))
    expect(above.mouseDelta.x).toBeGreaterThan(0)
    expect(above.mouseDelta.y).toBeLessThan(0)
  })

  it('ignores disconnected controllers and non-finite axes', () => {
    const snapshot = collectGamepadSnapshot([
      gamepad({ connected: false, axes: [1, 1, 1, 1], buttons: buttonsWith([[0, button(true)]]) }),
      gamepad({ axes: [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN] }),
    ])

    expect(snapshot.pressedKeys.size).toBe(0)
    expect(snapshot.mouseDelta).toEqual({ x: 0, y: 0 })
  })

  it('merges button state and sums opposing look input from multiple controllers', () => {
    const snapshot = collectGamepadSnapshot([
      gamepad({ axes: [-1, 0, 1, 0], buttons: buttonsWith([[0, button(true)]]) }),
      gamepad({ axes: [1, 0, -1, 0], buttons: buttonsWith([[1, button(true)]]) }),
    ])

    expect(snapshot.pressedKeys).toEqual(new Set([
      KeyMappings.MOVE_LEFT,
      KeyMappings.MOVE_RIGHT,
      KeyMappings.JUMP,
      KeyMappings.SNEAK,
    ]))
    expect(snapshot.mouseDelta).toEqual({ x: 0, y: 0 })
  })

  it('maps triggers and bumpers to typed mouse and wheel buttons', () => {
    const snapshot = collectGamepadSnapshot([gamepad({ buttons: buttonsWith([
      [4, button(true)],
      [5, button(true)],
      [6, button(false, 0.1)],
      [7, button(false, 0.1)],
    ]) })])

    expect(snapshot.mouseButtons).toEqual(new Set([0, 2]))
    expect(snapshot.wheelButtons).toEqual(new Set([4, 5]))
  })
})

describe('GamepadEdgeTracker', () => {
  it('emits one edge while held, then another after release and repress', () => {
    const tracker = createGamepadEdgeTracker()
    const released = collectGamepadSnapshot([])
    const pressed = collectGamepadSnapshot([gamepad({ buttons: buttonsWith([
      [0, button(true)],
      [4, button(true)],
      [7, button(true)],
    ]) })])

    tracker.update(pressed)
    expect(tracker.consumeKeyPress(KeyMappings.JUMP)).toBe(true)
    expect(tracker.consumeMouseClick(0)).toBe(true)
    expect(tracker.consumeWheelDelta()).toBe(-120)

    tracker.update(pressed)
    expect(tracker.consumeKeyPress(KeyMappings.JUMP)).toBe(false)
    expect(tracker.consumeMouseClick(0)).toBe(false)
    expect(tracker.consumeWheelDelta()).toBe(0)

    tracker.update(released)
    tracker.update(pressed)
    expect(tracker.consumeKeyPress(KeyMappings.JUMP)).toBe(true)
    expect(tracker.consumeMouseClick(0)).toBe(true)
    expect(tracker.consumeWheelDelta()).toBe(-120)
  })

  it('clear removes held and pending edge state', () => {
    const tracker = createGamepadEdgeTracker()
    tracker.update(collectGamepadSnapshot([gamepad({ buttons: buttonsWith([
      [0, button(true)],
      [5, button(true)],
      [6, button(true)],
    ]) })]))

    tracker.clear()

    expect(tracker.getState().snapshot.pressedKeys.size).toBe(0)
    expect(tracker.consumeKeyPress(KeyMappings.JUMP)).toBe(false)
    expect(tracker.consumeMouseClick(2)).toBe(false)
    expect(tracker.consumeWheelDelta()).toBe(0)
  })
})
