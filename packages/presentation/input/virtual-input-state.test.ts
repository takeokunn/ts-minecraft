import { describe, expect, it } from 'vitest'
import { createVirtualInputState } from './virtual-input-state'

describe('VirtualInputState', () => {
  it('emits one key edge per release-to-press transition', () => {
    const state = createVirtualInputState()
    state.setKey('Space', true)
    state.setKey('Space', true)
    expect(state.isKeyPressed('Space')).toBe(true)
    expect(state.consumeKeyPress('Space')).toBe(true)
    expect(state.consumeKeyPress('Space')).toBe(false)
    state.setKey('Space', false)
    state.setKey('Space', true)
    expect(state.consumeKeyPress('Space')).toBe(true)
  })

  it('pulses a key edge without changing its held state', () => {
    const state = createVirtualInputState()

    state.pulseKey('Space')

    expect(state.isKeyPressed('Space')).toBe(false)
    expect(state.consumeKeyPress('Space')).toBe(true)
    expect(state.consumeKeyPress('Space')).toBe(false)
  })

  it('emits one mouse edge per release-to-press transition', () => {
    const state = createVirtualInputState()
    state.setMouseButton(0, true)
    state.setMouseButton(0, true)
    expect(state.isMouseDown(0)).toBe(true)
    expect(state.consumeMouseClick(0)).toBe(true)
    expect(state.consumeMouseClick(0)).toBe(false)
  })

  it('accumulates finite look deltas and consumes them once', () => {
    const state = createVirtualInputState()
    state.addLookDelta(4, -2)
    state.addLookDelta(3, 1)
    state.addLookDelta(Number.NaN, Number.POSITIVE_INFINITY)
    expect(state.consumeLookDelta()).toEqual({ x: 7, y: -1 })
    expect(state.consumeLookDelta()).toEqual({ x: 0, y: 0 })
  })

  it('clears held, edge, look and activation state atomically', () => {
    const state = createVirtualInputState()
    state.setKey('KeyW', true)
    state.setMouseButton(2, true)
    state.setLookActive(true)
    state.addLookDelta(1, 2)
    state.clear()
    expect(state.isKeyPressed('KeyW')).toBe(false)
    expect(state.consumeKeyPress('KeyW')).toBe(false)
    expect(state.isMouseDown(2)).toBe(false)
    expect(state.consumeMouseClick(2)).toBe(false)
    expect(state.isLookActive()).toBe(false)
    expect(state.consumeLookDelta()).toEqual({ x: 0, y: 0 })
  })
})
