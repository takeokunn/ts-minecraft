import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Array as Arr, Effect, MutableRef, Option } from 'effect'
import { createFrameHandlers } from '@ts-minecraft/app'
import type { DeltaTimeSecs } from '@ts-minecraft/kernel'
import {
  makeDeps,
  makeInputService,
  makeInventoryRenderer,
  makeServices,
  makeSettingsOverlay,
  runFrame,
} from '@test/frame-handler-test-kit'

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

    ;(services.chunkManagerService as { loadChunksAroundPlayer: unknown }).loadChunksAroundPlayer = loadSpy
    ;(services.worldRendererService as { syncChunksToScene: unknown }).syncChunksToScene = syncSpy

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
    ;(services.chunkManagerService as { loadChunksAroundPlayer: unknown }).loadChunksAroundPlayer = spy

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
    ;(services.worldRendererService as { syncChunksToScene: unknown }).syncChunksToScene = spy

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

    ;(services.chunkManagerService as { loadChunksAroundPlayer: unknown }).loadChunksAroundPlayer = loadSpy
    ;(services.chunkManagerService as { getLoadedChunks: unknown }).getLoadedChunks = vi.fn(() => Effect.succeed(loadedChunks))
    ;(services.worldRendererService as { syncChunksToScene: unknown }).syncChunksToScene = syncSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    const handler = (deltaTime: DeltaTimeSecs) => maintenanceHandler().pipe(Effect.andThen(frameHandler(deltaTime)))
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
    ;(services.worldRendererService as { applyFrustumCulling: unknown }).applyFrustumCulling = spy

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
    ;(services.worldRendererService as { applyFrustumCulling: unknown }).applyFrustumCulling = spy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    const handler = (deltaTime: DeltaTimeSecs) => maintenanceHandler().pipe(Effect.andThen(frameHandler(deltaTime)))
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

    const queuedTargets = Arr.map([0, 16, 32, 48, 64, 80], (x) => ({ x, y: 64, z: 0 }))
    const clickCountRef = MutableRef.make(0)
    const maintenanceInjectionDoneRef = MutableRef.make(false)
    const updateCountRef = MutableRef.make(0)

    services.inputService.consumeMouseClick = (button: number) =>
      Effect.succeed(button === 0 && MutableRef.get(clickCountRef) < queuedTargets.length)

    services.blockHighlight.getTargetBlock = () =>
      Effect.succeed(MutableRef.get(clickCountRef) < queuedTargets.length ? Option.some(queuedTargets[MutableRef.get(clickCountRef)]!) : Option.none())

    services.blockHighlight.getTargetHit = () => Effect.succeed(Option.none())

    services.blockService.breakBlock = () =>
      Effect.sync(() => {
        MutableRef.update(clickCountRef, n => n + 1)
      })

    services.chunkManagerService.getChunk = (coord) =>
      Effect.succeed({ coord, blocks: new Uint8Array(0), fluid: Option.none() })

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)

    services.worldRendererService.updateChunkInScene = (_chunk, _scene) =>
      Effect.suspend(() => {
        MutableRef.update(updateCountRef, n => n + 1)
        if (!MutableRef.get(maintenanceInjectionDoneRef)) {
          MutableRef.set(maintenanceInjectionDoneRef, true)
          return frameHandler(0.016 as DeltaTimeSecs).pipe(Effect.asVoid)
        }
        return Effect.void
      })

    yield* Effect.forEach(Arr.makeBy(5, (i) => i), () =>
      frameHandler(0.016 as DeltaTimeSecs),
      { concurrency: 1 }
    )

    yield* maintenanceHandler()
    yield* maintenanceHandler()

    expect(MutableRef.get(updateCountRef)).toBe(6)
  }))

})
