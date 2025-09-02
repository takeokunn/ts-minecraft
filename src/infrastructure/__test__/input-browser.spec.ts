import { Effect, Layer, Ref } from 'effect'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InputManager, InputState, InputManagerLive } from '../input-browser'
import type { PointerLockControls as LockableControls } from 'three/examples/jsm/controls/PointerLockControls.js'

class MockControls extends EventTarget {
  isLocked = false
  lock = vi.fn(() => {
    this.isLocked = true
    this.dispatchEvent(new Event('lock'))
  })
  unlock = vi.fn(() => {
    this.isLocked = false
    this.dispatchEvent(new Event('unlock'))
  })
  connect = vi.fn()
  disconnect = vi.fn()
  getDirection = vi.fn()
  moveForward = vi.fn()
  moveRight = vi.fn()
  getObject = vi.fn()
  minPolarAngle = 0
  maxPolarAngle = Math.PI
  pointerSpeed = 1
  domElement = document.createElement('div')
  enabled = true
  dispose = vi.fn()
}

describe('InputManager', () => {
  let mockControls: LockableControls

  beforeEach(() => {
    mockControls = new MockControls() as unknown as LockableControls
  })

  const runTestWithManager = (testEffect: Effect.Effect<void, unknown, InputManager>) => {
    return Effect.runPromise(Effect.provide(testEffect, InputManagerLive))
  }

  it('should register and cleanup event listeners', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const controlsAddSpy = vi.spyOn(mockControls, 'addEventListener')

    const program = Effect.gen(function* (_) {
      const manager = yield* _(InputManager)
      yield* _(Effect.scoped(manager.registerListeners(mockControls)))
    })

    await runTestWithManager(program)

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('keyup', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(controlsAddSpy).toHaveBeenCalledWith('lock', expect.any(Function))
    expect(controlsAddSpy).toHaveBeenCalledWith('unlock', expect.any(Function))
  })

  it('should update keyboard state on keydown and keyup', async () => {
    const program = Effect.gen(function* (_) {
      const manager = yield* _(InputManager)

      yield* _(Effect.scoped(manager.registerListeners(mockControls)))

      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
      let state = yield* _(manager.getState)
      expect(state.keyboard.has('KeyW')).toBe(true)

      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
      state = yield* _(manager.getState)
      expect(state.keyboard.has('KeyW')).toBe(false)
    })

    await runTestWithManager(program)
  })

  it('should update mouse delta on mousemove', async () => {
    const program = Effect.gen(function* (_) {
      const manager = yield* _(InputManager)
      yield* _(Effect.scoped(manager.registerListeners(mockControls)))
      document.dispatchEvent(new MouseEvent('mousemove', { movementX: 10, movementY: -20 }))
      const delta = yield* _(manager.getMouseDelta)
      expect(delta).toEqual({ dx: 10, dy: -20 })
    })

    await runTestWithManager(program)
  })

  it('should update lock state on lock/unlock events', async () => {
    const program = Effect.gen(function* (_) {
      const manager = yield* _(InputManager)
      yield* _(Effect.scoped(manager.registerListeners(mockControls)))

      mockControls.lock()
      let state = yield* _(manager.getState)
      expect(state.isLocked).toBe(true)

      mockControls.unlock()
      state = yield* _(manager.getState)
      expect(state.isLocked).toBe(false)
    })

    await runTestWithManager(program)
  })
})


class MockControls extends EventTarget {
  isLocked = false
  lock = vi.fn(() => {
    this.isLocked = true
    this.dispatchEvent(new Event('lock'))
  })
  unlock = vi.fn(() => {
    this.isLocked = false
    this.dispatchEvent(new Event('unlock'))
  })
  connect = vi.fn()
  disconnect = vi.fn()
  getDirection = vi.fn()
  moveForward = vi.fn()
  moveRight = vi.fn()
  getObject = vi.fn()
  minPolarAngle = 0
  maxPolarAngle = Math.PI
  pointerSpeed = 1
  domElement = document.createElement('div')
  enabled = true
  dispose = vi.fn()
}

describe('InputManager', () => {
  let mockControls: LockableControls

  beforeEach(() => {
    mockControls = new MockControls() as unknown as LockableControls
  })

  import { Effect, Layer, Ref } from 'effect'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InputManager, InputState, InputManagerLive } from '../input-browser'
import type { PointerLockControls as LockableControls } from 'three/examples/jsm/controls/PointerLockControls.js'

class MockControls extends EventTarget {
  isLocked = false
  lock = vi.fn(() => {
    this.isLocked = true
    this.dispatchEvent(new Event('lock'))
  })
  unlock = vi.fn(() => {
    this.isLocked = false
    this.dispatchEvent(new Event('unlock'))
  })
  connect = vi.fn()
  disconnect = vi.fn()
  getDirection = vi.fn()
  moveForward = vi.fn()
  moveRight = vi.fn()
  getObject = vi.fn()
  minPolarAngle = 0
  maxPolarAngle = Math.PI
  pointerSpeed = 1
  domElement = document.createElement('div')
  enabled = true
  dispose = vi.fn()
}

describe('InputManager', () => {
  let mockControls: LockableControls

  beforeEach(() => {
    mockControls = new MockControls() as unknown as LockableControls
  })

  const runTestWithManager = (testEffect: Effect.Effect<void, unknown, InputManager>) => {
    return Effect.runPromise(Effect.provide(testEffect, InputManagerLive))
  }

  it('should register and cleanup event listeners', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const controlsAddSpy = vi.spyOn(mockControls, 'addEventListener')

    const program = Effect.gen(function* (_) {
      const manager = yield* _(InputManager)
      yield* _(Effect.scoped(manager.registerListeners(mockControls)))
    })

    await runTestWithManager(program)

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('keyup', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(controlsAddSpy).toHaveBeenCalledWith('lock', expect.any(Function))
    expect(controlsAddSpy).toHaveBeenCalledWith('unlock', expect.any(Function))
  })

  it('should update keyboard state on keydown and keyup', async () => {
    const program = Effect.gen(function* (_) {
      const manager = yield* _(InputManager)

      yield* _(Effect.scoped(manager.registerListeners(mockControls)))

      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
      let state = yield* _(manager.getState)
      expect(state.keyboard.has('KeyW')).toBe(true)

      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
      state = yield* _(manager.getState)
      expect(state.keyboard.has('KeyW')).toBe(false)
    })

    await runTestWithManager(program)
  })

  it('should update mouse delta on mousemove', async () => {
    const program = Effect.gen(function* (_) {
      const manager = yield* _(InputManager)
      yield* _(Effect.scoped(manager.registerListeners(mockControls)))
      document.dispatchEvent(new MouseEvent('mousemove', { movementX: 10, movementY: -20 }))
      const delta = yield* _(manager.getMouseDelta)
      expect(delta).toEqual({ dx: 10, dy: -20 })
    })

    await runTestWithManager(program)
  })

  it('should update lock state on lock/unlock events', async () => {
    const program = Effect.gen(function* (_) {
      const manager = yield* _(InputManager)
      yield* _(Effect.scoped(manager.registerListeners(mockControls)))

      mockControls.lock()
      let state = yield* _(manager.getState)
      expect(state.isLocked).toBe(true)

      mockControls.unlock()
      state = yield* _(manager.getState)
      expect(state.isLocked).toBe(false)
    })

    await runTestWithManager(program)
  })
})


  it('should register and cleanup event listeners', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const controlsAddSpy = vi.spyOn(mockControls, 'addEventListener')

    await runTestWithManager(Effect.void)

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('keyup', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(controlsAddSpy).toHaveBeenCalledWith('lock', expect.any(Function))
    expect(controlsAddSpy).toHaveBeenCalledWith('unlock', expect.any(Function))
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

    await runTestWithManager(program)
  })

  it('should update mouse delta on mousemove', async () => {
    const program = Effect.gen(function* (_) {
      const manager = yield* _(InputManager)
      document.dispatchEvent(new MouseEvent('mousemove', { movementX: 10, movementY: -20 }))
      const delta = yield* _(manager.getMouseDelta)
      expect(delta).toEqual({ dx: 10, dy: -20 })
    })

    await runTestWithManager(program)
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

    await runTestWithManager(program)
  })
})