import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, MutableRef, Option } from 'effect'
import { flushPendingSaves } from '@ts-minecraft/app/main/browser-runtime-save-effects'
import { applyPendingResize } from '@ts-minecraft/app/main/browser-runtime-resize-effects'

describe('browser-runtime-effects', () => {
  it('flushes dirty saves and resets the pending flag', async () => {
    const calls: string[] = []
    const pendingSaveDirtyChunksRef = MutableRef.make(true)
    const chunkManagerService = {
      saveDirtyChunks: () => Effect.sync(() => {
        calls.push('saveDirtyChunks')
      }),
    }

    await Effect.runPromise(flushPendingSaves({
      pendingSaveDirtyChunksRef,
      chunkManagerService: chunkManagerService as never,
      persistSessionState: Effect.sync(() => {
        calls.push('persistSessionState')
      }),
      reportAutoSaveStatus: (status) => Effect.sync(() => {
        calls.push(`status:${status}`)
      }),
    }))

    expect(calls).toEqual(['status:saving', 'saveDirtyChunks', 'persistSessionState', 'status:saved'])
    expect(MutableRef.get(pendingSaveDirtyChunksRef)).toBe(false)
  })

  it('reads the pending save flag when the flush effect runs', async () => {
    const calls: string[] = []
    const pendingSaveDirtyChunksRef = MutableRef.make(false)
    const chunkManagerService = {
      saveDirtyChunks: () => Effect.sync(() => {
        calls.push('saveDirtyChunks')
      }),
    }
    const flushEffect = flushPendingSaves({
      pendingSaveDirtyChunksRef,
      chunkManagerService: chunkManagerService as never,
      persistSessionState: Effect.sync(() => {
        calls.push('persistSessionState')
      }),
      reportAutoSaveStatus: (status) => Effect.sync(() => {
        calls.push(`status:${status}`)
      }),
    })

    MutableRef.set(pendingSaveDirtyChunksRef, true)
    await Effect.runPromise(flushEffect)

    expect(calls).toEqual(['status:saving', 'saveDirtyChunks', 'persistSessionState', 'status:saved'])
    expect(MutableRef.get(pendingSaveDirtyChunksRef)).toBe(false)
  })

  it('skips save work and status reporting when no save is pending', async () => {
    const calls: string[] = []
    const pendingSaveDirtyChunksRef = MutableRef.make(false)
    const chunkManagerService = {
      saveDirtyChunks: () => Effect.sync(() => {
        calls.push('saveDirtyChunks')
      }),
    }

    await Effect.runPromise(flushPendingSaves({
      pendingSaveDirtyChunksRef,
      chunkManagerService: chunkManagerService as never,
      persistSessionState: Effect.sync(() => {
        calls.push('persistSessionState')
      }),
      reportAutoSaveStatus: (status) => Effect.sync(() => {
        calls.push(`status:${status}`)
      }),
    }))

    expect(calls).toEqual([])
    expect(MutableRef.get(pendingSaveDirtyChunksRef)).toBe(false)
  })

  it('reports an error and still clears the pending flag when save flush fails', async () => {
    const calls: string[] = []
    const pendingSaveDirtyChunksRef = MutableRef.make(true)
    const chunkManagerService = {
      saveDirtyChunks: () => Effect.fail(new Error('chunk write failed')),
    }

    await Effect.runPromise(flushPendingSaves({
      pendingSaveDirtyChunksRef,
      chunkManagerService: chunkManagerService as never,
      persistSessionState: Effect.sync(() => {
        calls.push('persistSessionState')
      }),
      reportAutoSaveStatus: (status) => Effect.sync(() => {
        calls.push(`status:${status}`)
      }),
    }))

    expect(calls).toEqual(['status:saving', 'status:error'])
    expect(MutableRef.get(pendingSaveDirtyChunksRef)).toBe(false)
  })

  it('applies pending resize and clears the resize ref', async () => {
    const pendingResizeRef = MutableRef.make(Option.some({ width: 320, height: 180 }))
    const settingsService = { getSettings: () => Effect.succeed({ graphicsQuality: 'high' }) }
    const renderer = {
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
    }
    const camera = {
      aspect: 0,
      updateProjectionMatrix: vi.fn(),
    }
    const composer = {
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
    }
    const composerRT = {
      setSize: vi.fn(),
    }
    const worldRendererService = {
      updateWaterResolution: () => Effect.void,
      resizeRefractionRT: () => Effect.void,
      resizeRefractionCamera: () => Effect.void,
    }

    Reflect.set(globalThis as object, 'window', { devicePixelRatio: 2 })

    await Effect.runPromise(applyPendingResize({
      pendingResizeRef,
      settingsService: settingsService as never,
      renderer: renderer as never,
      camera: camera as never,
      composer: composer as never,
      composerRT: composerRT as never,
      worldRendererService: worldRendererService as never,
      gtaoPass: Option.none(),
      bloomPass: Option.none(),
      bokehPass: Option.none(),
      smaaPass: Option.none(),
      godRaysPass: Option.none(),
    }))

    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1.5)
    // updateStyle=false — CSS owns the canvas display size; an inline px style
    // would freeze clientWidth and break future window-resize detection.
    expect(renderer.setSize).toHaveBeenCalledWith(320, 180, false)
    expect(composer.setPixelRatio).toHaveBeenCalledWith(1.5)
    expect(composer.setSize).toHaveBeenCalledWith(320, 180)
    expect(composerRT.setSize).toHaveBeenCalledWith(320, 180)
    expect(camera.aspect).toBeCloseTo(320 / 180)
    expect(Option.isNone(MutableRef.get(pendingResizeRef))).toBe(true)
  })
})
