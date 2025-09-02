/**
 * @vitest-environment happy-dom
 */
import { Effect, Layer, Ref, HashSet } from 'effect'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as mainModule from '@/main'
import { main, bootstrap, AppLayer, onCommandEffect, runApp } from '@/main'
import * as loop from '@/runtime/loop'
import * as systems from '@/systems'
import { World } from '@/runtime/world'
import { ComputationWorkerTag } from '@/infrastructure/computation.worker'
import { ChunkDataQueueService } from '@/runtime/services'
import { SystemCommand } from '@/domain/types'

// Mock the game loop
const gameLoopSpy = vi.spyOn(loop, 'gameLoop').mockImplementation(() => Effect.void)

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should pass the correct systems to gameLoop in the correct order', async () => {
    const testLayer = Layer.succeed(World, {
      addArchetype: () => Effect.succeed(0 as any),
    } as any)
    await Effect.runPromise(main.pipe(Effect.provide(testLayer)))

    expect(gameLoopSpy).toHaveBeenCalledOnce()
    const systemsPassed = gameLoopSpy.mock.calls[0][0]
    expect(systemsPassed.slice(0, -1)).toEqual([
      systems.inputPollingSystem,
      systems.cameraControlSystem,
      systems.playerMovementSystem,
      systems.physicsSystem,
      systems.updatePhysicsWorldSystem,
      systems.collisionSystem,
      systems.raycastSystem,
      systems.updateTargetSystem,
      systems.blockInteractionSystem,
      systems.chunkLoadingSystem,
      systems.worldUpdateSystem,
    ])
    expect(Effect.isEffect(systemsPassed[systemsPassed.length - 1])).toBe(true)
  })
})

describe('bootstrap', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('should return a runnable Effect when #app element exists', () => {
    const appElement = document.createElement('div')
    appElement.id = 'app'
    document.body.appendChild(appElement)

    const runnable = bootstrap()

    expect(Effect.isEffect(runnable)).toBe(true)
  })

  it('should throw an error if #app element does not exist', () => {
    expect(() => bootstrap()).toThrow('Root element #app not found')
  })
})

describe('init', () => {
  it('should add DOMContentLoaded listener', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
    mainModule.init()
    expect(addEventListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function))
  })
})

describe('runApp', () => {
  it('should call bootstrap', () => {
    const bootstrapSpy = vi.fn(() => Effect.void)
    runApp(bootstrapSpy)
    expect(bootstrapSpy).toHaveBeenCalled()
  })
})

describe('AppLayer', () => {
  it('should build a layer without errors', () => {
    const appElement = document.createElement('div')
    appElement.id = 'app'
    const layer = AppLayer(appElement)
    expect(layer).toBeDefined()
  })
})

describe('onCommandEffect', () => {
  it('should post a task to the computation worker', async () => {
    const mockPostTask = vi.fn(() => Effect.succeed({} as any))
    const mockWorker = { postTask: mockPostTask }
    const mockQueue: any[] = []
    const mockWorld = {
      state: Ref.unsafeMake({
        globalState: {
          seeds: { main: 0 },
          amplitude: 0,
          editedBlocks: { placed: new Map(), destroyed: HashSet.empty() },
        },
      }),
    } as any

    const testLayer = Layer.succeed(ComputationWorkerTag, mockWorker).pipe(
      Layer.merge(Layer.succeed(ChunkDataQueueService, mockQueue)),
      Layer.merge(Layer.succeed(World, mockWorld)),
    )

    const onCommand = await Effect.runPromise(onCommandEffect.pipe(Effect.provide(testLayer)))
    await Effect.runPromise(onCommand({ type: 'generateChunk' } as SystemCommand))

    expect(mockPostTask).toHaveBeenCalledOnce()
    expect(mockQueue.length).toBe(1)
  })
})
