/**
 * @vitest-environment happy-dom
 */
import { Effect } from 'effect'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as mainModule from '@/main'
import { main, bootstrap, runApp } from '@/main'
import * as loop from '@/runtime/loop'
import * as systems from '@/systems'

import { ChunkDataQueueService } from '@/runtime/services'
import { Hotbar } from '@/domain/components'
import { provideTestLayer } from 'test/utils'
import { ChunkGenerationResult } from '@/domain/types'

// Mock the game loop
const gameLoopSpy = vi.spyOn(loop, 'gameLoop').mockImplementation(() => Effect.void)

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should pass the correct systems to gameLoop in the correct order', async () => {
    const mockUiSystem = Effect.void
    const program = main(mockUiSystem)
    await Effect.runPromise(Effect.provide(program, provideTestLayer()))

    expect(gameLoopSpy).toHaveBeenCalledOnce()
    const systemsPassed = gameLoopSpy.mock.calls[0]![0]
    expect(systemsPassed).toEqual([
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
      mockUiSystem,
    ])
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

    const runnable = bootstrap(appElement)

    expect(Effect.isEffect(runnable)).toBe(true)
  })
})

describe('init', () => {
  it('should add a DOMContentLoaded listener that calls the provided runner', () => {
    const runnerSpy = vi.fn()
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

    mainModule.init(runnerSpy)

    // Verify that addEventListener was called with the correct event name
    expect(addEventListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function))

    // Get the listener function from the spy
    const domContentLoadedListener = addEventListenerSpy.mock.calls[0]![1] as () => void

    // Call the listener function manually to simulate the event
    domContentLoadedListener()

    // Verify that the runner was called
    expect(runnerSpy).toHaveBeenCalledOnce()
  })
})

describe('runApp', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('should call bootstrap with the app element', () => {
    const appElement = document.createElement('div')
    appElement.id = 'app'
    document.body.appendChild(appElement)

    const bootstrapSpy = vi.fn(() => Effect.void)
    runApp(bootstrapSpy)
    expect(bootstrapSpy).toHaveBeenCalledWith(appElement)
  })

  it('should throw an error if #app element does not exist', () => {
    expect(() => runApp(vi.fn())).toThrow('Root element #app not found')
  })
})

describe('AppLayer', () => {
  it('should build a layer without errors', () => {
    const appElement = document.createElement('div')
    appElement.id = 'app'
    const layer = mainModule.AppLayer(appElement)
    expect(layer).toBeDefined()
  })
})

describe('onCommandEffect', () => {
  it('should post a task to the computation worker', async () => {
    const mockPostTask = vi.fn(() => Effect.succeed({} as ChunkGenerationResult))

    const testEffect = Effect.gen(function* ($) {
      const onCommand = yield* $(mainModule.onCommandEffect)
      yield* $(onCommand({ type: 'GenerateChunk', chunkX: 0, chunkZ: 0 }))
      const queue = yield* $(ChunkDataQueueService)
      expect(mockPostTask).toHaveBeenCalledOnce()
      expect(queue.length).toBe(1)
    })

    const testLayer = provideTestLayer(undefined, {
      computationWorker: {
        postTask: mockPostTask,
      },
    })

    await Effect.runPromise(testEffect.pipe(Effect.provide(testLayer)))
  })
})

describe('hotbarUpdater', () => {
  it('should return Effect.void', () => {
    const hotbar = new Hotbar({ slots: [], selectedIndex: 0 })
    const effect = mainModule.hotbarUpdater(hotbar)
    expect(effect).toBe(Effect.void)
  })
})
