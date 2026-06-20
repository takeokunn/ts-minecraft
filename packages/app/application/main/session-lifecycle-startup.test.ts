import { describe, it } from '@effect/vitest'
import { Effect, Exit, FiberId, MutableRef, Option, Ref, TestContext, type Fiber } from 'effect'
import { expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildSessionRuntime: vi.fn(),
  installBrowserEventBridge: vi.fn(),
  installPerfHudCounters: vi.fn(),
  startSessionAutoSaveDaemon: vi.fn(),
  waitForInitialFrameRate: vi.fn(),
  runBestEffortQuitStep: vi.fn(),
}))

vi.mock('@ts-minecraft/app/main/session-runtime', () => ({
  buildSessionRuntime: mocks.buildSessionRuntime,
}))

vi.mock('@ts-minecraft/app/main/browser-runtime', () => ({
  installBrowserEventBridge: mocks.installBrowserEventBridge,
}))

vi.mock('@ts-minecraft/rendering', () => ({
  installPerfHudCounters: mocks.installPerfHudCounters,
}))

vi.mock('@ts-minecraft/app/main/session-autosave', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ts-minecraft/app/main/session-autosave')>()

  return {
    ...actual,
    startSessionAutoSaveDaemon: mocks.startSessionAutoSaveDaemon,
  }
})

vi.mock('@ts-minecraft/app/main/session-loading-gates', () => ({
  waitForInitialFrameRate: mocks.waitForInitialFrameRate,
}))

vi.mock('@ts-minecraft/app/main/session-lifecycle-quit', () => ({
  QUIT_CLEANUP_TIMEOUT: 'quit-timeout',
  runBestEffortQuitStep: mocks.runBestEffortQuitStep,
}))

import { runSessionLifecycleStartup } from '@ts-minecraft/app/main/session-lifecycle-startup'

describe('runSessionLifecycleStartup', () => {
  it('boots the runtime, mounts browser effects, and waits for the loading gate', async () => {
    const frameHandlerWithBrowserEvents = vi.fn(() => Effect.void)
    const maintenanceHandler = vi.fn(() => Effect.void)
    const terrainPool = {
      queueDepth: vi.fn(() => 17),
    }
    const loadingScreen = {
      hide: vi.fn(() => Effect.void),
    }
    const bootCtx = {
      canvas: { tag: 'canvas' } as never,
      perfHud: { tag: 'perf-hud' } as never,
    }
    const gameLoopService = {
      start: vi.fn(() => Effect.void),
      startMaintenance: vi.fn(() => Effect.void),
      stop: vi.fn(() => Effect.void),
    }
    const inputPointerLock = Effect.void
    const saveDirtyChunksRunSpy = vi.fn()
    const persistSessionStateRunSpy = vi.fn()
    const saveDirtyChunksEffect = Effect.sync(() => {
      saveDirtyChunksRunSpy()
    })
    const persistSessionStateEffect = Effect.sync(() => {
      persistSessionStateRunSpy()
    })
    const runtimeServices = {
      chunkManagerService: {
        saveDirtyChunks: vi.fn(() => saveDirtyChunksEffect),
      },
      inputService: {
        requestPointerLock: vi.fn(() => inputPointerLock),
      },
    }
    const pendingResizeRef = MutableRef.make(Option.none())
    const pendingSaveDirtyChunksRef = MutableRef.make(false)
    const gamePausedRef = Effect.runSync(Ref.make(false))
    const runtimeParams = {
      hud: {
        fpsElement: { tag: 'fps-element' } as never,
      },
      state: {
        pendingResizeRef,
        pendingSaveDirtyChunksRef,
        gamePausedRef,
        persistSessionState: vi.fn(() => persistSessionStateEffect),
      },
    }
    const buildSessionRuntimeResult = {
      frameHandlerWithBrowserEvents,
      maintenanceHandler,
    }

    mocks.buildSessionRuntime.mockReturnValue(Effect.succeed(buildSessionRuntimeResult))
    mocks.installBrowserEventBridge.mockReturnValue(Effect.void)
    mocks.installPerfHudCounters.mockReturnValue(Effect.void)
    mocks.startSessionAutoSaveDaemon.mockReturnValue(
      Effect.succeed({
        await: Effect.succeed(Exit.interrupt(FiberId.none)),
        interruptAsFork: () => Effect.void,
      } as Fiber.RuntimeFiber<number, never>),
    )
    mocks.waitForInitialFrameRate.mockReturnValue(Effect.void)
    mocks.runBestEffortQuitStep.mockImplementation((effect: Effect.Effect<unknown, unknown>) => effect)

    await Effect.runPromise(
      Effect.scoped(
        runSessionLifecycleStartup({
          bootCtx: bootCtx as never,
          gameLoopService: gameLoopService as never,
          loadingScreen: loadingScreen as never,
          terrainPool: terrainPool as never,
          runtimeParams: runtimeParams as never,
          runtimeServices: runtimeServices as never,
        }).pipe(Effect.provide(TestContext.TestContext)),
      ),
    )

    expect(mocks.buildSessionRuntime).toHaveBeenCalledOnce()
    expect(mocks.buildSessionRuntime).toHaveBeenCalledWith(runtimeParams, runtimeServices)
    expect(runtimeServices.inputService.requestPointerLock).toHaveBeenCalledOnce()
    expect(mocks.installBrowserEventBridge).toHaveBeenCalledOnce()
    const browserBridgeDeps = mocks.installBrowserEventBridge.mock.calls[0]?.[0]
    expect(browserBridgeDeps).toMatchObject({
      canvas: bootCtx.canvas,
      inputPointerLock,
      gamePausedRef,
      pendingResizeRef,
      pendingSaveDirtyChunksRef,
      gameLoopService,
      frameHandler: frameHandlerWithBrowserEvents,
    })
    expect(browserBridgeDeps.bestEffortSave).toBeDefined()
    expect(mocks.installPerfHudCounters).toHaveBeenCalledOnce()
    expect(mocks.installPerfHudCounters).toHaveBeenCalledWith(
      bootCtx.perfHud,
      runtimeServices.chunkManagerService,
      expect.any(Function),
    )
    expect(mocks.startSessionAutoSaveDaemon).toHaveBeenCalledOnce()
    expect(mocks.startSessionAutoSaveDaemon).toHaveBeenCalledWith(
      saveDirtyChunksEffect,
      persistSessionStateEffect,
    )
    expect(gameLoopService.start).toHaveBeenCalledOnce()
    expect(gameLoopService.start).toHaveBeenCalledWith(frameHandlerWithBrowserEvents)
    expect(gameLoopService.startMaintenance).toHaveBeenCalledOnce()
    expect(gameLoopService.startMaintenance).toHaveBeenCalledWith(maintenanceHandler)
    expect(mocks.runBestEffortQuitStep).toHaveBeenCalledTimes(2)
    expect(mocks.waitForInitialFrameRate).toHaveBeenCalledOnce()
    expect(mocks.waitForInitialFrameRate).toHaveBeenCalledWith(runtimeParams.hud.fpsElement)
    expect(loadingScreen.hide).toHaveBeenCalledOnce()
    expect(terrainPool.queueDepth).not.toHaveBeenCalled()

    MutableRef.set(pendingSaveDirtyChunksRef, true)
    await Effect.runPromise(browserBridgeDeps.bestEffortSave)
    expect(saveDirtyChunksRunSpy).toHaveBeenCalledOnce()
    expect(persistSessionStateRunSpy).toHaveBeenCalledOnce()
    expect(MutableRef.get(pendingSaveDirtyChunksRef)).toBe(false)
  })
})
