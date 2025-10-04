import { describe, expect, it, prop } from '@effect/vitest'
import * as FC from 'effect/FastCheck'
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

  prop(
    'axis updates are visible through axisValue lookup',
    [FC.integer({ min: 0, max: 7 }), FC.double({ min: -1, max: 1 })],
    ([axisIndex, axisValueSample]) => {
      const axis = AxisId(axisIndex)
      const value = AxisValue(axisValueSample)
      const snapshot = makeSnapshot(InputTimestamp(0))
      const updated = applyEvent(snapshot, {
        _tag: 'GamepadAxisChanged',
        axis,
        value,
        timestamp: InputTimestamp(1),
      })
      const observed = axisValue(updated, axis)
      expect(Option.isSome(observed)).toBe(true)
      expect(Option.getOrElse(observed, () => AxisValue(0))).toBeCloseTo(value, 5)
    }
  )
})
