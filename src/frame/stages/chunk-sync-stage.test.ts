import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import * as THREE from 'three'
import { createFrameHandler, createFrameHandlers } from '@/frame-handler'
import type { DeltaTimeSecs } from '@ts-minecraft/kernel'
import {
  makeDeps,
  makeInputService,
  makeInventoryRenderer,
  makeServices,
  makeSettingsOverlay,
  runFrame,
} from '../../../test/frame-handler-test-kit'

// ---------------------------------------------------------------------------
// Step 1: Chunk streaming
// ---------------------------------------------------------------------------

describe('step 1 — chunk streaming', () => {
  it.effect('production split handlers keep chunk streaming on maintenance only', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const loadSpy = vi.fn(() => Effect.void)
    const syncSpy = vi.fn(() => Effect.succeed(true as boolean))

    ;(services.chunkManagerService as unknown as { loadChunksAroundPlayer: unknown }).loadChunksAroundPlayer = loadSpy
    ;(services.worldRendererService as unknown as { syncChunksToScene: unknown }).syncChunksToScene = syncSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)

    yield* frameHandler(0.016 as DeltaTimeSecs)
    expect(loadSpy).not.toHaveBeenCalled()
    expect(syncSpy).not.toHaveBeenCalled()

    yield* maintenanceHandler()
    expect(loadSpy).toHaveBeenCalledOnce()
    expect(syncSpy).toHaveBeenCalledOnce()
  }))

  it.effect('calls loadChunksAroundPlayer each frame', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const spy = vi.fn(() => Effect.void)
    ;(services.chunkManagerService as unknown as { loadChunksAroundPlayer: unknown }).loadChunksAroundPlayer = spy

    yield* runFrame(deps, services)

    expect(spy).toHaveBeenCalledOnce()
  }))

  it.effect('calls syncChunksToScene each frame', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const spy = vi.fn(() => Effect.succeed(true as boolean))
    ;(services.worldRendererService as unknown as { syncChunksToScene: unknown }).syncChunksToScene = spy

    yield* runFrame(deps, services)

    expect(spy).toHaveBeenCalledOnce()
  }))

  it.effect('retries chunk sync on the next stationary frame when sync is incomplete', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const loadedChunks = [{ coord: { x: 0, z: 0 }, blocks: new Uint8Array(0), dirty: false }]
    const loadSpy = vi.fn(() => Effect.void)
    const syncSpy = vi.fn(() => Effect.succeed(false as boolean))
    syncSpy.mockImplementationOnce(() => Effect.succeed(false as boolean))
    syncSpy.mockImplementation(() => Effect.succeed(true as boolean))

    ;(services.chunkManagerService as unknown as { loadChunksAroundPlayer: unknown }).loadChunksAroundPlayer = loadSpy
    ;(services.chunkManagerService as unknown as { getLoadedChunks: unknown }).getLoadedChunks = vi.fn(() => Effect.succeed(loadedChunks))
    ;(services.worldRendererService as unknown as { syncChunksToScene: unknown }).syncChunksToScene = syncSpy

    const handler = yield* createFrameHandler(deps, services)
    yield* handler(0.016 as DeltaTimeSecs)
    yield* handler(0.016 as DeltaTimeSecs)

    expect(loadSpy).toHaveBeenCalledTimes(2)
    expect(syncSpy).toHaveBeenCalledTimes(2)
  }))

  it.effect('calls applyFrustumCulling each frame', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const spy = vi.fn(() => Effect.void)
    ;(services.worldRendererService as unknown as { applyFrustumCulling: unknown }).applyFrustumCulling = spy

    yield* runFrame(deps, services)

    expect(spy).toHaveBeenCalledOnce()
  }))

  it.effect('skips applyFrustumCulling once the camera pose stabilizes', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const spy = vi.fn(() => Effect.void)
    ;(services.worldRendererService as unknown as { applyFrustumCulling: unknown }).applyFrustumCulling = spy

    const handler = yield* createFrameHandler(deps, services)
    yield* handler(0.016 as DeltaTimeSecs)
    yield* handler(0.016 as DeltaTimeSecs)
    yield* handler(0.016 as DeltaTimeSecs)

    expect(spy).toHaveBeenCalledTimes(2)
  }))

  it.effect('preserves dirty chunk updates added while maintenance requeues remaining work', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })

    const queuedTargets = [0, 16, 32, 48, 64, 80].map((x) => ({ x, y: 64, z: 0 }))
    let clickCount = 0
    let maintenanceInjectionDone = false
    let updateCount = 0

    ;(services.inputService as unknown as { consumeMouseClick: (button: number) => Effect.Effect<boolean, never> }).consumeMouseClick = (button: number) =>
      Effect.succeed(button === 0 && clickCount < queuedTargets.length)

    ;(services.blockHighlight as unknown as { getTargetBlock: () => Effect.Effect<Option.Option<{ x: number; y: number; z: number }>, never> }).getTargetBlock = () =>
      Effect.succeed(clickCount < queuedTargets.length ? Option.some(queuedTargets[clickCount]!) : Option.none())

    ;(services.blockHighlight as unknown as { getTargetHit: () => Effect.Effect<Option.Option<never>, never> }).getTargetHit = () => Effect.succeed(Option.none())

    ;(services.blockService as unknown as { breakBlock: (pos: { x: number; y: number; z: number }) => Effect.Effect<void, never> }).breakBlock = () =>
      Effect.sync(() => {
        clickCount += 1
      })

    ;(services.chunkManagerService as unknown as { getChunk: (coord: { x: number; z: number }) => Effect.Effect<{ coord: { x: number; z: number }; blocks: Uint8Array; dirty: false }, never> }).getChunk = (coord) =>
      Effect.succeed({ coord, blocks: new Uint8Array(0), dirty: false })

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)

    ;(services.worldRendererService as unknown as { updateChunkInScene: (chunk: { coord: { x: number; z: number } }, scene: THREE.Scene) => Effect.Effect<void, never> }).updateChunkInScene = () =>
      Effect.suspend(() => {
        updateCount += 1
        if (!maintenanceInjectionDone) {
          maintenanceInjectionDone = true
          return frameHandler(0.016 as DeltaTimeSecs).pipe(Effect.asVoid)
        }
        return Effect.void
      })

    for (let index = 0; index < 5; index += 1) {
      yield* frameHandler(0.016 as DeltaTimeSecs)
    }

    yield* maintenanceHandler()
    yield* maintenanceHandler()

    expect(updateCount).toBe(6)
  }))

})
