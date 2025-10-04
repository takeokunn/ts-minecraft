import { describe, expect, it } from '@effect/vitest'
import { ConfigProvider, Effect, Either, Layer } from 'effect'
import * as Match from 'effect/Match'
import { provideLayers } from '../testing/effect'
import {
  AppServiceTag,
  ConfigLayer,
  MainLayer,
  TestLayer,
  makeAppService,
  makeConfigService,
} from './infrastructure'
import { ConfigService, ConfigServiceTag } from './application'
import { BootstrapConfigDefaults, bootstrapConfigSnapshot } from './domain'
import { reviveEpochZero, unsafeEpochMilliseconds } from './domain/value'

const providerLayer = (entries: Record<string, string>) =>
  Layer.succeed(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromMap(new Map(Object.entries(entries)))
  )

const successProvider = providerLayer({
  APP_DEBUG: 'true',
  APP_FPS: '90',
  APP_MEMORY_LIMIT: '512',
})

const invalidProvider = providerLayer({
  APP_DEBUG: 'true',
  APP_FPS: '0',
  APP_MEMORY_LIMIT: '512',
})

describe('bootstrap/infrastructure/makeConfigService', () => {
  it.effect('reloadはConfigProviderからの設定を適用する', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const service = yield* makeConfigService
        const snapshot = yield* service.reload
        expect(snapshot.config.debug).toBe(true)
        expect(snapshot.config.fps).toBe(90)
        expect(snapshot.config.memoryLimit).toBe(512)
        const current = yield* service.current
        expect(current).toStrictEqual(snapshot.config)
      }).pipe(Effect.provide(successProvider))
    )
  )

  it.effect('reloadは不正な設定値でAppError.Configを返す', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const service = yield* makeConfigService
        const result = yield* service.reload.pipe(Effect.either)
        Match.value(result).pipe(
          Match.when({ _tag: 'Left' }, ({ left }) => {
            expect(left._tag).toBe('Config')
          }),
          Match.exhaustive
        )
      }).pipe(Effect.provide(invalidProvider))
    )
  )
})

describe('bootstrap/infrastructure/makeAppService', () => {
  const snapshotValue = Effect.runSync(
    bootstrapConfigSnapshot({
      config: BootstrapConfigDefaults,
      loadedAt: reviveEpochZero(),
    })
  )

  const stubConfigService: ConfigService = ConfigServiceTag.of({
    snapshot: Effect.succeed(snapshotValue),
    snapshotResult: Effect.succeed(Either.right(snapshotValue)),
    reload: Effect.succeed(snapshotValue),
    reloadResult: Effect.succeed(Either.right(snapshotValue)),
    current: Effect.succeed(snapshotValue.config),
    currentResult: Effect.succeed(Either.right(snapshotValue.config)),
    refresh: Effect.succeed(snapshotValue.config),
    refreshResult: Effect.succeed(Either.right(snapshotValue.config)),
  })

  const stubConfigServiceLayer = Layer.succeed(ConfigServiceTag, stubConfigService)

  it.effect('initializeで未初期化状態をreadyへ遷移させる', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const appService = yield* makeAppService
        const before = yield* appService.readiness.pipe(Effect.either)
        expect(before._tag).toBe('Left')

        const init = yield* appService.initialize
        expect(init.ready).toBe(true)
        expect(init.fresh).toBe(true)

        const readiness = yield* appService.readiness
        expect(readiness.ready).toBe(true)

        const second = yield* appService.initializeResult
        Match.value(second).pipe(
          Match.when({ _tag: 'Right' }, ({ right }) => {
            expect(right.fresh).toBe(false)
          }),
          Match.exhaustive
        )

        const lifecycle = yield* appService.lifecycle
        expect(lifecycle.state).toBe('ready')
        expect(lifecycle.initializedAt).toBe(lifecycle.updatedAt)
      }).pipe(provideLayers(stubConfigServiceLayer))
    )
  )
})

describe('bootstrap/infrastructure layers', () => {
  it('ConfigLayerはLayerインスタンスである', () => {
    expect(Layer.isLayer(ConfigLayer)).toBe(true)
  })

  it('TestLayerはLayerインスタンスである', () => {
    expect(Layer.isLayer(TestLayer)).toBe(true)
  })

  it('MainLayerはLayer合成として定義されている', () => {
    expect(MainLayer).toBeDefined()
  })
})
