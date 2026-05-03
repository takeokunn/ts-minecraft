import { afterEach, describe, expect, it, vi } from 'vitest'
import { Effect, MutableRef, Option } from 'effect'
import { installBrowserEventBridge, wrapFrameHandlerWithBrowserEffects } from '@ts-minecraft/app/main/browser-runtime'

const restoreGlobals = () => {
  Reflect.deleteProperty(globalThis as object, 'window')
  Reflect.deleteProperty(globalThis as object, 'document')
}

afterEach(() => {
  restoreGlobals()
})

describe('browser-runtime', () => {
  it('bridges browser events into refs and pointer lock requests', async () => {
    const windowListeners = new Map<string, EventListener>()
    const documentListeners = new Map<string, EventListener>()
    const canvasListeners = new Map<string, EventListener>()
    const pointerLockSpy = vi.fn(() => Effect.void)
    const pendingResizeRef = MutableRef.make(Option.none<{ width: number; height: number }>())
    const pendingSaveDirtyChunksRef = MutableRef.make(false)

    const canvas = {
      clientWidth: 800,
      clientHeight: 600,
      addEventListener: vi.fn((type: string, handler: EventListener) => { canvasListeners.set(type, handler) }),
      removeEventListener: vi.fn((type: string) => { canvasListeners.delete(type) }),
    } as HTMLCanvasElement

    Reflect.set(globalThis as object, 'window', {
      addEventListener: vi.fn((type: string, handler: EventListener) => { windowListeners.set(type, handler) }),
      removeEventListener: vi.fn((type: string) => { windowListeners.delete(type) }),
    })
    Reflect.set(globalThis as object, 'document', {
      hidden: true,
      addEventListener: vi.fn((type: string, handler: EventListener) => { documentListeners.set(type, handler) }),
      removeEventListener: vi.fn((type: string) => { documentListeners.delete(type) }),
    })

    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      yield* installBrowserEventBridge({
        canvas,
        inputPointerLock: pointerLockSpy(),
        pendingResizeRef,
        pendingSaveDirtyChunksRef,
      })

      windowListeners.get('resize')?.(new Event('resize'))
      documentListeners.get('visibilitychange')?.(new Event('visibilitychange'))
      windowListeners.get('beforeunload')?.(new Event('beforeunload'))
      canvasListeners.get('mousedown')?.(new Event('mousedown'))

      expect(Option.getOrNull(MutableRef.get(pendingResizeRef))).toEqual({ width: 800, height: 600 })
      expect(MutableRef.get(pendingSaveDirtyChunksRef)).toBe(true)
    })))

    expect(pointerLockSpy).toHaveBeenCalledOnce()
    expect(windowListeners.size).toBe(0)
    expect(documentListeners.size).toBe(0)
    expect(canvasListeners.size).toBe(0)
  })

  it('wraps save, resize, and frame work in order', async () => {
    const pendingResizeRef = MutableRef.make(Option.some({ width: 320, height: 200 }))
    const pendingSaveDirtyChunksRef = MutableRef.make(true)
    const calls: string[] = []

    Reflect.set(globalThis as object, 'window', { devicePixelRatio: 2 })

    const renderer = {
      setPixelRatio: vi.fn(() => calls.push('renderer.setPixelRatio')),
      setSize: vi.fn(() => calls.push('renderer.setSize')),
    }
    const composer = {
      setPixelRatio: vi.fn(() => calls.push('composer.setPixelRatio')),
      setSize: vi.fn(() => calls.push('composer.setSize')),
    }
    const composerRT = { setSize: vi.fn(() => calls.push('composerRT.setSize')) }
    const camera = { aspect: 1, updateProjectionMatrix: vi.fn(() => calls.push('camera.updateProjectionMatrix')) }
    const settingsService = { getSettings: () => Effect.succeed({ graphicsQuality: 'high' }) }
    const chunkManagerService = { saveDirtyChunks: () => Effect.sync(() => { calls.push('saveDirtyChunks') }) }
    const worldRendererService = {
      updateWaterResolution: () => Effect.sync(() => { calls.push('updateWaterResolution') }),
      resizeRefractionRT: () => Effect.sync(() => { calls.push('resizeRefractionRT') }),
      resizeRefractionCamera: () => Effect.sync(() => { calls.push('resizeRefractionCamera') }),
    }
    const frameHandler = vi.fn(() => Effect.sync(() => { calls.push('frameHandler') }))
    const pass = { enabled: true, setSize: vi.fn(() => calls.push('pass.setSize')) }

    const wrapped = wrapFrameHandlerWithBrowserEffects({
      pendingResizeRef,
      pendingSaveDirtyChunksRef,
      chunkManagerService: chunkManagerService as never,
      persistSessionState: Effect.sync(() => { calls.push('persistSessionState') }),
      settingsService: settingsService as never,
      renderer: renderer as never,
      camera: camera as never,
      composer: composer as never,
      composerRT: composerRT as never,
      worldRendererService: worldRendererService as never,
      gtaoPass: Option.some(pass as never),
      bloomPass: Option.some(pass as never),
      bokehPass: Option.some(pass as never),
      smaaPass: Option.some(pass as never),
      godRaysPass: Option.some(pass as never),
      frameHandler: frameHandler as never,
    })

    await Effect.runPromise(wrapped(0.016 as never))

    expect(calls[0]).toBe('saveDirtyChunks')
    expect(calls).toContain('persistSessionState')
    expect(calls).toContain('renderer.setPixelRatio')
    expect(calls).toContain('resizeRefractionCamera')
    expect(calls[calls.length - 1]).toBe('frameHandler')
    expect(MutableRef.get(pendingSaveDirtyChunksRef)).toBe(false)
    expect(Option.isNone(MutableRef.get(pendingResizeRef))).toBe(true)
  })
})
