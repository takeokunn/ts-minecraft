import { Effect, Layer } from 'effect'
import { describe, it, expect, vi } from 'vitest'
import * as main from '@/main'
import * as World from '@/domain/world'
import { InputManagerService } from '@/infrastructure/input-browser'
import { RendererService } from '@/runtime/services'

vi.mock('@/runtime/loop', () => ({
  gameLoop: () => Effect.void,
}))

const MockRendererLive = Layer.succeed(RendererService, {
  processRenderQueue: Effect.void,
  syncCameraToWorld: Effect.void,
  updateHighlight: Effect.void,
  updateInstancedMeshes: Effect.void,
  renderScene: Effect.void,
})

const MockInputManagerLive = Layer.succeed(InputManagerService, {
  getState: Effect.succeed({ keyboard: new Set(), mouse: { dx: 0, dy: 0 }, isLocked: false }),
  getMouseDelta: Effect.succeed({ dx: 0, dy: 0 }),
  registerListeners: () => Effect.void,
})

describe('main', () => {
  it('should create a runnable bootstrap effect that completes without errors', async () => {
    const appElement = document.createElement('div')
    appElement.id = 'app'
    document.body.appendChild(appElement)

    const TestLayer = Layer.mergeAll(World.worldLayer, MockRendererLive, MockInputManagerLive).pipe(
      Layer.provide(Layer.succeed(RendererService, {} as any)), // Mock other services if needed
    )

    const runnable = main.bootstrap.pipe(Effect.provide(TestLayer))

    await expect(Effect.runPromise(runnable)).resolves.toBeUndefined()
  })

  it('should log an error if the root element is not found', async () => {
    const logErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    document.body.innerHTML = ''

    const TestLayer = Layer.mergeAll(World.worldLayer, MockRendererLive, MockInputManagerLive).pipe(
      Layer.provide(Layer.succeed(RendererService, {} as any)), // Mock other services if needed
    )

    const runnable = main.bootstrap.pipe(Effect.provide(TestLayer))
    await Effect.runPromise(runnable)

    expect(logErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Root element not found'))
    logErrorSpy.mockRestore()
  })
})
