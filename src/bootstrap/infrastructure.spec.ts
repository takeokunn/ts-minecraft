import { describe, expect, it } from '@effect/vitest'
import * as FC from 'effect/FastCheck'
import { Schema } from '@effect/schema'
import { Effect, ConfigProvider, Layer, Either } from 'effect'
import { vi } from 'vitest'
import type { ThreeRenderer as ThreeRendererService } from '@mc/bc-world/infrastructure/rendering/disabled/three-renderer'
import { AppService, ConfigService } from './application'

vi.mock('@mc/bc-world/infrastructure/rendering/disabled/ThreeRendererLive', async () => {
  const { Layer, Effect } = await import('effect')
  const { ThreeRenderer } = await import('@mc/bc-world/infrastructure/rendering/disabled/three-renderer')

  const stub: ThreeRendererService = {
    initialize: () => Effect.void,
    render: () => Effect.void,
    resize: () => Effect.void,
    enableWebGL2Features: () => Effect.void,
    configureShadowMap: () => Effect.void,
    configureAntialiasing: () => Effect.void,
    setupPostprocessing: () => Effect.void,
    getPerformanceStats: () =>
      Effect.succeed({
        fps: 0,
        frameTime: 0,
        memory: { geometries: 0, textures: 0 },
        render: { calls: 0, triangles: 0 },
      }),
    getRenderer: () => Effect.succeed(null),
    isWebGL2Supported: () => Effect.succeed(false),
    dispose: () => Effect.void,
  }

  return {
    ThreeRendererLive: Layer.succeed(ThreeRenderer, stub),
  }
})

import { AppServiceLayer, ConfigLayer, MainLayer, TestLayer } from './infrastructure'
import {
  AppInitializationResultSchema,
  AppReadinessSchema,
  BootstrapConfigDefaults,
  BootstrapConfigSchema,
  bootstrapConfig,
} from './domain'

const providerLayer = (entries: Record<string, string>) =>
  Layer.succeed(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromMap(new Map(Object.entries(entries)), { pathDelim: '_', seqDelim: ',' })
  )

const configLayerFor = (entries: Record<string, string>) =>
  ConfigLayer.pipe(Layer.provide(providerLayer(entries)))

const appLayerFor = (entries: Record<string, string>) =>
  AppServiceLayer.pipe(Layer.provide(configLayerFor(entries)))

const configTestLayer = (entries: Record<string, string>) => configLayerFor(entries)

const appTestLayer = (entries: Record<string, string>) =>
  Layer.mergeAll(configLayerFor(entries), appLayerFor(entries))

const expectSuccess = async <A>(effect: Effect.Effect<A>) => Effect.runPromise(effect)


describe('bootstrap/infrastructure - ConfigService', () => {
  it('loads defaults when no provider values are supplied', async () => {
    const program = Effect.gen(function* () {
      const service = yield* ConfigService
      const snapshot = yield* service.snapshot
      expect(snapshot.config).toStrictEqual(BootstrapConfigDefaults)
    })

    await expectSuccess(program.pipe(Effect.provide(configTestLayer({}))))
  })

  it('hydrates configuration from map provider (property)', async () => {
    const booleanToEntry = (value: boolean) => (value ? 'true' : 'false')

    const configProperty = FC.property(
      FC.record({
        debug: FC.boolean(),
        fps: FC.integer({ min: 1, max: 120 }),
        memoryLimit: FC.integer({ min: 1, max: 2048 }),
      }),
      (generated) => {
        const entries = {
          APP_DEBUG: booleanToEntry(generated.debug),
          APP_FPS: `${generated.fps}`,
          APP_MEMORY_LIMIT: `${generated.memoryLimit}`,
        }

        const program = Effect.gen(function* () {
          const service = yield* ConfigService
          const snapshot = yield* service.snapshot
          const encoded = Effect.runSync(
            Schema.encode(BootstrapConfigSchema)(snapshot.config)
          )
          expect(encoded).toStrictEqual(generated)
        })

        Effect.runSync(program.pipe(Effect.provide(configTestLayer(entries))))
      }
    )

    await Effect.runPromise(
      Effect.sync(() => FC.assert(configProperty, { numRuns: 50 }))
    )
  })
  it('exposes Either-based results for reload failures', async () => {
    const entries = {
      APP_DEBUG: 'true',
      APP_FPS: '999',
      APP_MEMORY_LIMIT: '10',
    }

    const program = Effect.gen(function* () {
      const service = yield* ConfigService
      const exit = yield* service.reloadResult
      expect(Either.isLeft(exit)).toBe(true)
    })

    await expectSuccess(program.pipe(Effect.provide(configTestLayer(entries))))
  })
})

describe('bootstrap/infrastructure - AppService', () => {
  it('fails readiness before initialization', async () => {
    const entries = {}

    const program = Effect.gen(function* () {
      const service = yield* AppService
      const exit = yield* service.readinessResult
      expect(Either.isLeft(exit)).toBe(true)
    })

    await expectSuccess(program.pipe(Effect.provide(appTestLayer(entries))))
  })

  it('performs initialization workflow and marks readiness', async () => {
    const entries = {
      APP_DEBUG: 'false',
      APP_FPS: '60',
      APP_MEMORY_LIMIT: '2048',
    }

    const program = Effect.gen(function* () {
      const service = yield* AppService
      const init = yield* service.initialize
      const readiness = yield* service.readiness
      const initEncoded = Effect.runSync(Schema.encode(AppInitializationResultSchema)(init))
      const readyEncoded = Effect.runSync(Schema.encode(AppReadinessSchema)(readiness))
      expect(initEncoded.ready).toBe(true)
      expect(readyEncoded.ready).toBe(true)
    })

    await expectSuccess(program.pipe(Effect.provide(appTestLayer(entries))))
  })

  it('returns cached result on second initialization', async () => {
    const entries = {}

    const program = Effect.gen(function* () {
      const service = yield* AppService
      yield* service.initialize
      const result = yield* service.initialize
      expect(result.fresh).toBe(false)
    })

    await expectSuccess(program.pipe(Effect.provide(appTestLayer(entries))))
  })
})

describe('bootstrap/infrastructure - Layers', () => {
  it('TestLayer provides ConfigService and AppService', async () => {
    const program = Effect.gen(function* () {
      const config = yield* ConfigService
      const app = yield* AppService
      const snapshot = yield* config.snapshot
      const exit = yield* app.readinessResult
      expect(snapshot.config).toStrictEqual(BootstrapConfigDefaults)
      expect(Either.isLeft(exit)).toBe(true)
    })

    await expectSuccess(program.pipe(Effect.provide(appTestLayer({}))))
  })

  it('MainLayer resolves without throwing when composed', async () => {
    const program = Effect.gen(function* () {
      const config = yield* ConfigService
      const app = yield* AppService
      const snapshot = yield* config.snapshot
      expect(snapshot.config).toStrictEqual(BootstrapConfigDefaults)
      const readiness = yield* app.readinessResult
      expect(Either.isLeft(readiness)).toBe(true)
    })

    const effect = program.pipe(
      Effect.provide(providerLayer({})),
      Effect.provide(MainLayer),
      Effect.scoped
    )

    await expectSuccess(effect)
  })
})
