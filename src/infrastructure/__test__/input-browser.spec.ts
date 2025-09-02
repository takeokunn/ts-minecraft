import { Effect } from 'effect'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InputManager, InputManagerLive, type LockableControls } from '../input-browser'

type MockControls = LockableControls & {
  listeners: Map<string, () => void>
  isLocked: boolean
}

const createMockControls = (): MockControls => {
  const listeners = new Map<string, () => void>()
  return {
    isLocked: false,
    lock: vi.fn(function (this: MockControls) {
      this.isLocked = true
      this.listeners.get('lock')?.()
    }),
    unlock: vi.fn(function (this: MockControls) {
      this.isLocked = false
      this.listeners.get('unlock')?.()
    }),
    listeners,
    addEventListener: vi.fn(function (this: MockControls, type, listener) {
      this.listeners.set(type, listener)
    }),
    removeEventListener: vi.fn(function (this: MockControls, type) {
      this.listeners.delete(type)
    }),
  }
}

describe('InputManager', () => {
  let mockControls: MockControls

  beforeEach(() => {
    mockControls = createMockControls()
  })

  const setupAndRun = <A, E>(program: Effect.Effect<A, E, InputManager>, controls: LockableControls = mockControls) => {
    const fullProgram = Effect.gen(function* (_) {
      const manager = yield* _(InputManager)
      yield* _(manager.registerListeners(controls))
      const result = yield* _(program)
      yield* _(manager.cleanup)
      return result
    })
    return Effect.runPromise(Effect.provide(fullProgram, InputManagerLive))
  }

  it('should register and cleanup event listeners', async () => {
    const addListenerSpy = vi.spyOn(document, 'addEventListener')
    const removeListenerSpy = vi.spyOn(document, 'removeEventListener')

    await setupAndRun(Effect.void)

    expect(addListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(addListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function))
    expect(addListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(addListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function))
    expect(addListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    expect(mockControls.addEventListener).toHaveBeenCalledWith('lock', expect.any(Function))
    expect(mockControls.addEventListener).toHaveBeenCalledWith('unlock', expect.any(Function))

    expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(removeListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function))
    expect(removeListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(removeListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function))
    expect(removeListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    expect(mockControls.removeEventListener).toHaveBeenCalledWith('lock', expect.any(Function))
    expect(mockControls.removeEventListener).toHaveBeenCalledWith('unlock', expect.any(Function))
  })

  it('should update keyboard state on keydown and keyup', async () => {
    const program = Effect.gen(function* (_) {
      const manager = yield* _(InputManager)

      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
      let state = yield* _(manager.getState)
      expect(state.keyboard.has('KeyW')).toBe(true)

      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
      state = yield* _(manager.getState)
      expect(state.keyboard.has('KeyW')).toBe(false)
    })

    await setupAndRun(program)
  })

  it('should lock controls on mousedown when not locked', async () => {
    const program = Effect.sync(() => {
      document.dispatchEvent(new MouseEvent('mousedown'))
      expect(mockControls.lock).toHaveBeenCalled()
    })
    await setupAndRun(program)
  })

  it('should update mouse state on mousedown when locked', async () => {
    const program = Effect.gen(function* (_) {
      const manager = yield* _(InputManager)
      mockControls.lock() // Simulate lock

      document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
      let state = yield* _(manager.getState)
      expect(state.keyboard.has('Mouse0')).toBe(true)

      document.dispatchEvent(new MouseEvent('mouseup', { button: 0 }))
      state = yield* _(manager.getState)
      expect(state.keyboard.has('Mouse0')).toBe(false)
    })
    await setupAndRun(program)
  })

  it.skip('should update mouse delta on mousemove when locked', async () => {
    const program = Effect.gen(function* (_) {
      const manager = yield* _(InputManager)
      mockControls.lock() // Simulate lock

      const lockedState = yield* _(manager.getState)
      expect(lockedState.isLocked).toBe(true)

      document.dispatchEvent(new MouseEvent('mousemove', { movementX: 10, movementY: -20 }))
      const delta = yield* _(manager.getMouseDelta)
      expect(delta).toEqual({ dx: 10, dy: -20 })

      // Delta should be reset
      const nextDelta = yield* _(manager.getMouseDelta)
      expect(nextDelta).toEqual({ dx: 0, dy: 0 })
    })
    await setupAndRun(program)
  })

  it('should not update mouse delta on mousemove when not locked', async () => {
    const program = Effect.gen(function* (_) {
      const manager = yield* _(InputManager)
      document.dispatchEvent(new MouseEvent('mousemove', { movementX: 10, movementY: -20 }))
      const delta = yield* _(manager.getMouseDelta)
      expect(delta).toEqual({ dx: 0, dy: 0 })
    })
    await setupAndRun(program)
  })

  it('should update lock state on lock/unlock events', async () => {
    const program = Effect.gen(function* (_) {
      const manager = yield* _(InputManager)

      mockControls.lock()
      let state = yield* _(manager.getState)
      expect(state.isLocked).toBe(true)

      mockControls.unlock()
      state = yield* _(manager.getState)
      expect(state.isLocked).toBe(false)
    })

    await setupAndRun(program)
  })
})
