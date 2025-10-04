import { describe, expect, it } from '@effect/vitest'
import { Option } from 'effect'
import { AxisId, AxisValue, InputTimestamp, KeyCode, MouseButton, type InputEvent } from '../model'
import { applyEvent, axisValue, isKeyActive, isMouseButtonActive, makeSnapshot } from '../state'

describe('state', () => {
  it('marks key as active after KeyPressed event', () => {
    const snapshot = makeSnapshot(InputTimestamp(0))
    const event: InputEvent = {
      _tag: 'KeyPressed',
      key: KeyCode('KeyW'),
      timestamp: InputTimestamp(1),
    }
    const updated = applyEvent(snapshot, event)
    expect(isKeyActive(updated, KeyCode('KeyW'))).toBe(true)
  })

  it('releases key after KeyReleased event', () => {
    const initial = makeSnapshot(InputTimestamp(0))
    const pressed = applyEvent(initial, {
      _tag: 'KeyPressed',
      key: KeyCode('KeyA'),
      timestamp: InputTimestamp(1),
    })
    const released = applyEvent(pressed, {
      _tag: 'KeyReleased',
      key: KeyCode('KeyA'),
      timestamp: InputTimestamp(2),
    })
    expect(isKeyActive(released, KeyCode('KeyA'))).toBe(false)
  })

  it('tracks mouse button state', () => {
    const snapshot = makeSnapshot(InputTimestamp(0))
    const pressed = applyEvent(snapshot, {
      _tag: 'MouseButtonPressed',
      button: MouseButton('left'),
      timestamp: InputTimestamp(1),
    })
    expect(isMouseButtonActive(pressed, MouseButton('left'))).toBe(true)
  })

  it('axis updates are visible through axisValue lookup', () => {
    const snapshot = makeSnapshot(InputTimestamp(0))
    const updated = applyEvent(snapshot, {
      _tag: 'GamepadAxisChanged',
      axis: AxisId(1),
      value: AxisValue(0.6),
      timestamp: InputTimestamp(2),
    })

    const value = axisValue(updated, AxisId(1))
    expect(Option.isSome(value)).toBe(true)
    expect(value).toEqual(Option.some(AxisValue(0.6)))

    const empty = axisValue(updated, AxisId(2))
    expect(empty).toEqual(Option.none())
  })
})
