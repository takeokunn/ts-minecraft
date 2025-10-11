# Effect-TS実装パターン集

## 目次

1. [TestClock/TestRandom使用方法](#1-testclocktestrandom使用方法)
2. [Effect.catchTags使用方法](#2-effectcatchtags使用方法)
3. [Supervisor導入方法](#3-supervisor導入方法)
4. [Metric/Tracing統合方法](#4-metrictracing統合方法)

## 1. TestClock/TestRandom使用方法

### 1.1 基本セットアップ

```typescript
// src/__tests__/setup.ts
import { TestContext, TestClock, TestRandom, Layer } from 'effect'

export const testLayer = Layer.mergeAll(TestClock.layer, TestRandom.layer)
```

### 1.2 TestClock使用例

```typescript
import { Effect, Duration, TestClock } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { testLayer } from '@/__tests__/setup'

describe('TestClock Example', () => {
  it.effect('controls time precisely', () =>
    Effect.gen(function* () {
      const startTime = yield* TestClock.currentTimeMillis

      yield* Effect.sleep(Duration.seconds(5))
      yield* TestClock.adjust(Duration.seconds(5))

      const endTime = yield* TestClock.currentTimeMillis
      expect(endTime - startTime).toBe(5000)
    }).pipe(Effect.provide(testLayer))
  )
})
```

### 1.3 TestRandom使用例

```typescript
import { Effect, TestRandom, Random } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { testLayer } from '@/__tests__/setup'

describe('TestRandom Example', () => {
  it.effect('generates predictable random values', () =>
    Effect.gen(function* () {
      yield* TestRandom.feedDoubles(0.1, 0.3, 0.7)

      const values: number[] = []
      for (let i = 0; i < 3; i++) {
        const value = yield* Random.next
        values.push(value)
      }

      expect(values).toEqual([0.1, 0.3, 0.7])
    }).pipe(Effect.provide(testLayer))
  )
})
```

## 2. Effect.catchTags使用方法

### 2.1 基本パターン

```typescript
const result =
  yield *
  generateChunk().pipe(
    Effect.catchTags({
      ChunkGenerationError: (error) => Effect.succeed(createFallbackChunk(error)),
      BiomeNotFoundError: (error) => Effect.fail(WorldGenerationError.biomeRequired(error)),
    })
  )
```

### 2.2 複数エラータイプの処理

```typescript
const result =
  yield *
  loadResource().pipe(
    Effect.catchTags({
      NetworkError: (error) => Effect.retry(loadResource(), Schedule.exponential(Duration.seconds(1))),
      TimeoutError: (error) => Effect.fail(ResourceError.loadTimeout(error)),
      ValidationError: (error) => Effect.succeed(useDefaultResource()),
    })
  )
```

## 3. Supervisor導入方法

### 3.1 基本セットアップ

```typescript
import { Supervisor, Fiber, Effect, Layer, Duration, Schedule } from 'effect'

export const GameLoopSupervisor = Effect.gen(function* () {
  const supervisor = yield* Supervisor.track

  yield* Effect.repeat(
    Effect.gen(function* () {
      const fibers = yield* supervisor.value
      const count = fibers.size
      yield* Effect.logInfo(`Active fibers: ${count}`)

      for (const fiber of fibers) {
        const status = yield* Fiber.status(fiber)
        if (status._tag === 'Done' && !status.exit.isSuccess()) {
          yield* Effect.logError(`Fiber failed: ${fiber.id()}`)
        }
      }
    }),
    Schedule.spaced(Duration.seconds(10))
  )
})

export const GameLoopSupervisorLayer = Layer.scoped(
  GameLoopSupervisor,
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(GameLoopSupervisor)
    yield* Effect.addFinalizer(() => Fiber.interrupt(fiber))
    return {}
  })
)
```

### 3.2 main.tsでの統合

```typescript
import { GameLoopSupervisorLayer } from './application/game_loop/game_loop_supervisor'

const mainLayer = Layer.mergeAll(
  // ... 他のLayer
  GameLoopSupervisorLayer
)
```

## 4. Metric/Tracing統合方法

### 4.1 依存関係追加

```json
{
  "dependencies": {
    "@effect/opentelemetry": "^0.40.0"
  }
}
```

### 4.2 メトリクス定義

```typescript
// src/application/world_generation/metrics.ts
import { Metric, Effect } from 'effect'

export const chunkGenerationDuration = Metric.histogram('chunk_generation_duration_ms', {
  description: 'Chunk generation time in milliseconds',
})

export const chunkGenerationCounter = Metric.counter('chunk_generation_total', {
  description: 'Total number of generated chunks',
})
```

### 4.3 メトリクス使用例

```typescript
export const generateTerrain = (coord: ChunkCoordinate): Effect.Effect<Chunk, GenerationError> =>
  Effect.gen(function* () {
    const startTime = Date.now()

    const chunk = yield* performGeneration(coord)

    const duration = Date.now() - startTime
    yield* chunkGenerationDuration(duration)
    yield* chunkGenerationCounter.increment()

    return chunk
  })
```

## 5. 関連ドキュメント

- [Effect-TS準拠チェックリスト](../../reference/effect-ts-compliance.md)
- [Effect-TSテストパターン](../testing/effect-ts-testing-patterns.md)
- [Effect-TS移行ガイド](./effect-ts-migration-guide.md)
