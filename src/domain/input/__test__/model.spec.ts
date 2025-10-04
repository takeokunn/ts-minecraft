import { describe, expect, it } from '@effect/vitest'
import { Either } from 'effect'
import {
  AxisValue,
  InputTimestamp,
  KeyCode,
  MouseButton,
  decodeInputEvent,
  decodeKeyCode,
  decodeMouseButton,
} from '../model'

describe('model', () => {
  it('decodes known key codes', () => {
    const result = decodeKeyCode('KeyW')
    expect(Either.isRight(result)).toBe(true)
    expect(Either.getOrElse(result, () => KeyCode('KeyW'))).toEqual(KeyCode('KeyW'))
  })

  it('rejects malformed key codes', () => {
    const result = decodeKeyCode('invalid_code')
    expect(Either.isLeft(result)).toBe(true)
  })

  it('decodes mouse button literals', () => {
    const result = decodeMouseButton('left')
    expect(Either.isRight(result)).toBe(true)
    expect(Either.getOrElse(result, () => MouseButton('left'))).toEqual(MouseButton('left'))
  })

  it('AxisValue schema constrains values to [-1, 1]', () => {
    expect(AxisValue(-1)).toBe(-1)
    expect(AxisValue(0)).toBe(0)
    expect(AxisValue(1)).toBe(1)

    expect(() => AxisValue(-1.01)).toThrow()
    expect(() => AxisValue(1.01)).toThrow()
  })

  it('decodes input events structurally', () => {
    const event = {
      _tag: 'MouseMoved',
      timestamp: InputTimestamp(1),
      position: { x: 1, y: 2 },
      delta: { x: 0.1, y: -0.2 },
    }
    const result = decodeInputEvent(event)
    expect(Either.isRight(result)).toBe(true)
  })
})
