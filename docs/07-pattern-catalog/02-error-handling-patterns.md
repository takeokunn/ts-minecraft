---
title: "エラーハンドリングパターンカタログ - Effect-TS完全ガイド"
description: "Effect-TS 3.17+による型安全なエラーハンドリングパターン集。TaggedError、リトライ戦略、回復処理の実装ガイド。"
category: "patterns"
difficulty: "intermediate"
tags: ["error-handling", "effect-ts", "patterns", "tagged-error", "retry", "recovery"]
prerequisites: ["effect-ts-fundamentals", "schema-basics"]
estimated_reading_time: "20分"
dependencies: ["../01-architecture/06-effect-ts-patterns.md", "../03-guides/00-development-conventions.md"]
status: "complete"
---

# エラーハンドリングパターンカタログ

## 概要

このドキュメントは、TypeScript Minecraft CloneプロジェクトにおけるEffect-TS 3.17+を活用したエラーハンドリングパターンの包括的なカタログです。各パターンには適用場面、実装方法、実際のコードサンプル、そしてエラーリカバリー戦略が含まれています。

## パターン一覧

### 1. Effect.catchAll パターン - 包括的エラーハンドリング

**適用場面**: すべてのエラーを統一的に処理したい場合

**実装方法**: `Effect.catchAll`を使用して、発生した全てのエラーを一箇所で処理します。

**実装例**:
```typescript
// プロジェクト内の実装例
export class ChunkGenerationError extends Schema.TaggedError<ChunkGenerationError>()("ChunkGenerationError", {
  coordinate: Schema.String,
  reason: Schema.String
}) {}

const loadChunk = (coordinate: ChunkCoordinate): Effect.Effect<ChunkData, never, ChunkService> =>
  Effect.gen(function* () {
    // チャンク生成処理
    const data = yield* generateChunkData(coordinate)
    yield* saveChunkToCache(coordinate, data)
    return data
  }).pipe(
    // 全てのエラーを包括的に処理
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        // エラーログを記録 - Cause情報も含めて詳細記録
        yield* Effect.logError("Chunk loading failed", { coordinate, error: String(error) })

        // フォールバック処理
        return yield* generateEmptyChunk(coordinate)
      })
    )
  )
```

**エラーリカバリー戦略**:
- フォールバック値の提供
- エラー情報のログ記録
- 統一されたエラー応答の生成

### 2. Effect.catchTag パターン - 型安全な特定エラー処理

**適用場面**: 特定のエラー型に対して異なる処理を行いたい場合

**実装方法**: `Schema.TaggedError`で定義したエラー型に対して`Effect.catchTag`を使用します。

**実装例**:
```typescript
// プロジェクト内の複数エラー型定義
export class ChunkNotFoundError extends Schema.TaggedError<ChunkNotFoundError>()("ChunkNotFoundError", {
  coordinate: Schema.String
}) {}

export class ChunkGenerationError extends Schema.TaggedError<ChunkGenerationError>()("ChunkGenerationError", {
  coordinate: Schema.String,
  reason: Schema.String
}) {}

export class ChunkCorruptedError extends Schema.TaggedError<ChunkCorruptedError>()("ChunkCorruptedError", {
  coordinate: Schema.String,
  corruptionType: Schema.String
}) {}

const processChunk = (coordinate: ChunkCoordinate): Effect.Effect<ChunkData, ChunkGenerationError, ChunkService> =>
  Effect.gen(function* () {
    return yield* loadChunkFromStorage(coordinate)
  }).pipe(
    // 特定エラーへの型安全な対応
    Effect.catchTag("ChunkNotFoundError", () =>
      Effect.gen(function* () {
        yield* Effect.logInfo("Chunk not found, generating new one", { coordinate })
        return yield* generateNewChunk(coordinate)
      })
    ),
    Effect.catchTag("ChunkCorruptedError", (error) =>
      Effect.gen(function* () {
        yield* Effect.logWarning("Corrupted chunk detected, attempting repair", {
          coordinate,
          corruptionType: error.corruptionType
        })
        yield* repairChunk(coordinate)
        return yield* loadChunkFromStorage(coordinate)
      })
    )
  )
```

**エラーリカバリー戦略**:
- エラー型ごとの具体的なリカバリー処理
- 型安全性の保証
- 段階的なエラー処理

### 3. Effect.catchTags パターン - 複数エラー型の同時処理

**適用場面**: 複数の関連するエラー型を効率的に処理したい場合

**実装方法**: オブジェクト形式でエラーハンドラーを定義し、`Effect.catchTags`で一括処理します。

**実装例**:
```typescript
// インベントリシステムのエラー処理
type PlayerId = string & Brand.Brand<"PlayerId">
type ItemId = string & Brand.Brand<"ItemId">

export class InventoryNotFoundError extends Schema.TaggedError<InventoryNotFoundError>()("InventoryNotFoundError", {
  playerId: Schema.String.pipe(Schema.brand("PlayerId"))
}) {}

export class InventoryFullError extends Schema.TaggedError<InventoryFullError>()("InventoryFullError", {
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  currentSize: Schema.Number.pipe(Schema.nonNegative()),
  maxSize: Schema.Number.pipe(Schema.positive())
}) {}

export class InvalidItemError extends Schema.TaggedError<InvalidItemError>()("InvalidItemError", {
  itemId: Schema.String.pipe(Schema.brand("ItemId")),
  reason: Schema.String
}) {}

const addItemToInventory = (playerId: PlayerId, item: Item): Effect.Effect<boolean, InventoryNotFoundError, InventoryService> =>
  Effect.gen(function* () {
    const inventory = yield* getInventory(playerId)
    yield* validateItem(item)
    const result = yield* inventory.addItem(item)
    return result
  }).pipe(
    // 複数エラー型の同時処理
    Effect.catchTags({
      "InventoryFullError": (error) =>
        Effect.gen(function* () {
          yield* Effect.logInfo("Inventory full, notifying player", {
            playerId: error.playerId,
            currentSize: error.currentSize,
            maxSize: error.maxSize
          })
          yield* notifyPlayer(error.playerId, "Inventory is full!")
          // エラーを再スローせず、失敗として正常終了
          return false
        }),

      "InvalidItemError": (error) =>
        Effect.gen(function* () {
          yield* Effect.logWarning("Invalid item rejected", {
            itemId: error.itemId,
            reason: error.reason
          })
          return false // アイテム追加失敗として正常終了
        })
    })
  )
```

**エラーリカバリー戦略**:
- エラー種別ごとの最適化された処理
- ユーザーへの適切な通知
- ビジネスロジックに応じた処理継続判断

### 4. Cause分析パターン - エラー原因の詳細解析

**適用場面**: エラーの詳細な原因分析やデバッグ情報が必要な場合

**実装方法**: `Effect.catchAllCause`を使用してCause情報を分析し、適切な対応を取ります。

**実装例**:
```typescript
export class EnrichedError extends Schema.TaggedError<EnrichedError>()("EnrichedError", {
  originalError: Schema.String,
  context: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  timestamp: Schema.String.pipe(Schema.brand("Timestamp")),
  stackTrace: Schema.optional(Schema.String),
  defects: Schema.Array(Schema.Unknown),
  interruptions: Schema.Array(Schema.Unknown)
}) {}

const processWithCauseAnalysis = <A, E>(data: A): Effect.Effect<ProcessingResult, EnrichedError, ProcessingService> =>
  Effect.gen(function* () {
    return yield* complexProcessing(data)
  }).pipe(
    Effect.catchAllCause((cause) =>
      Effect.gen(function* () {
        // Cause情報の詳細分析
        const analysis = yield* Effect.sync(() => analyzeCause(cause))
        const timestamp = new Date().toISOString()

        // 構造化されたエラー情報を作成
        const enrichedError = new EnrichedError({
          originalError: Cause.pretty(cause),
          context: {
            inputData: data,
            processingStage: "complex_processing"
          },
          timestamp,
          stackTrace: analysis.stackTrace,
          defects: analysis.defects,
          interruptions: analysis.interruptions
        })

        // エラー分析結果をログに記録
        yield* Effect.logError("Processing failed with enriched error context", {
          cause: Cause.pretty(cause),
          defectCount: analysis.defects.length,
          interruptionCount: analysis.interruptions.length
        })

        return yield* Effect.fail(enrichedError)
      })
    )
  )

// Cause分析ヘルパー - より詳細な分析を提供
const analyzeCause = (cause: Cause.Cause<unknown>) => {
  return Cause.match(cause, {
    onEmpty: () => ({
      defects: [],
      failures: [],
      interruptions: [],
      stackTrace: "Empty cause",
      isRecoverable: true
    }),
    onFail: (error) => ({
      defects: [],
      failures: [error],
      interruptions: [],
      stackTrace: Cause.pretty(cause),
      isRecoverable: true
    }),
    onDie: (defect) => ({
      defects: [defect],
      failures: [],
      interruptions: [],
      stackTrace: Cause.pretty(cause),
      isRecoverable: false
    }),
    onInterrupt: (fiberId) => ({
      defects: [],
      failures: [],
      interruptions: [fiberId],
      stackTrace: Cause.pretty(cause),
      isRecoverable: false
    }),
    onSequential: (left, right) => {
      const leftAnalysis = analyzeCause(left)
      const rightAnalysis = analyzeCause(right)
      return {
        defects: [...leftAnalysis.defects, ...rightAnalysis.defects],
        failures: [...leftAnalysis.failures, ...rightAnalysis.failures],
        interruptions: [...leftAnalysis.interruptions, ...rightAnalysis.interruptions],
        stackTrace: Cause.pretty(cause),
        isRecoverable: leftAnalysis.isRecoverable && rightAnalysis.isRecoverable
      }
    },
    onParallel: (left, right) => {
      const leftAnalysis = analyzeCause(left)
      const rightAnalysis = analyzeCause(right)
      return {
        defects: [...leftAnalysis.defects, ...rightAnalysis.defects],
        failures: [...leftAnalysis.failures, ...rightAnalysis.failures],
        interruptions: [...leftAnalysis.interruptions, ...rightAnalysis.interruptions],
        stackTrace: Cause.pretty(cause),
        isRecoverable: leftAnalysis.isRecoverable || rightAnalysis.isRecoverable
      }
    }
  })
}
```

**エラーリカバリー戦略**:
- 詳細なエラー情報の収集
- デバッグに有用な情報の保存
- エラー分析レポートの生成

### 5. Schedule活用リトライパターン - 堅牢なリトライ戦略

**適用場面**: 一時的な障害に対してインテリジェントなリトライを行いたい場合

**実装方法**: `Schedule`と組み合わせたリトライ処理でエラーからの自動復旧を実装します。

**実装例**:
```typescript
export class TemporaryError extends Schema.TaggedError<TemporaryError>()("TemporaryError", {
  operation: Schema.String,
  retryCount: Schema.Number.pipe(Schema.nonNegative()),
  lastAttemptTime: Schema.optional(Schema.String.pipe(Schema.brand("Timestamp"))),
  category: Schema.Literal("Network", "Database", "External")
}) {}

export class PermanentError extends Schema.TaggedError<PermanentError>()("PermanentError", {
  operation: Schema.String,
  reason: Schema.String,
  category: Schema.Literal("Validation", "Authorization", "NotFound", "Critical")
}) {}

// リトライ戦略の定義 - より柔軟で堅牢な戦略
const retryStrategy = pipe(
  Schedule.exponential("100 millis"), // 指数バックオフ
  Schedule.intersect(Schedule.recurs(5)), // 最大5回リトライ
  Schedule.intersect(Schedule.spaced("30 seconds")), // 最大30秒間隔
  Schedule.whileInput((error: unknown) => {
    // Match.instanceOfを使用した型安全なエラー判定
    return pipe(
      error,
      Match.value,
      Match.when(Match.instanceOf(TemporaryError), (tempError) => {
        // ネットワークエラーとデータベースエラーのみリトライ
        return tempError.category === "Network" || tempError.category === "Database"
      }),
      Match.orElse(() => false)
    )
  })
)

// カテゴリ別の専用リトライ戦略
const networkRetryStrategy = pipe(
  Schedule.exponential("200 millis"),
  Schedule.intersect(Schedule.recurs(3)),
  Schedule.intersect(Schedule.upTo("10 seconds"))
)

const databaseRetryStrategy = pipe(
  Schedule.exponential("500 millis"),
  Schedule.intersect(Schedule.recurs(2)),
  Schedule.intersect(Schedule.upTo("5 seconds"))
)

const reliableNetworkOperation = (url: string): Effect.Effect<NetworkResponse, PermanentError, NetworkService> =>
  Effect.gen(function* () {
    const startTime = yield* Effect.sync(() => Date.now())
    return yield* performNetworkRequest(url)
  }).pipe(
    // 特定エラーのみリトライ対象
    Effect.catchTag("TemporaryError", (error) =>
      Effect.gen(function* () {
        yield* Effect.logInfo("Preparing retry for temporary error", {
          operation: error.operation,
          retryCount: error.retryCount,
          category: error.category,
          url
        })
        // エラーを再スローしてリトライを続行
        return yield* Effect.fail(error)
      })
    ),
    // カテゴリ別リトライ戦略の適用
    Effect.retry(retryStrategy),

    // 最終的なエラーハンドリング - Match.instanceOfを使用
    Effect.catchAll((error) =>
      pipe(
        error,
        Match.value,
        Match.when(Match.instanceOf(TemporaryError), (tempError) =>
          Effect.gen(function* () {
            yield* Effect.logError("All retries exhausted for temporary error", {
              operation: tempError.operation,
              category: tempError.category,
              finalRetryCount: tempError.retryCount,
              url
            })
            return yield* Effect.fail(new PermanentError({
              operation: tempError.operation,
              reason: `Retry limit exceeded after ${tempError.retryCount} attempts`,
              category: "Network"
            }))
          })
        ),
        Match.orElse((otherError) => Effect.fail(otherError))
      )
    )
  )
```

**エラーリカバリー戦略**:
- 指数バックオフによる負荷軽減
- リトライ回数の制限
- 一時的vs永続的エラーの分類
- 最終的な失敗への適切な対応

### 6. サーキットブレーカーパターン - システム保護

**適用場面**: 外部システムの障害から自システムを保護したい場合

**実装方法**: サーキットブレーカー状態を管理し、障害時に素早くフォールバックします。

**実装例**:
```typescript
export class CircuitBreakerError extends Schema.TaggedError<CircuitBreakerError>()("CircuitBreakerError", {
  service: Schema.String,
  state: Schema.Literal("Open", "HalfOpen", "Closed"),
  failureCount: Schema.Number.pipe(Schema.nonNegative()),
  lastFailureTime: Schema.optional(Schema.Number.pipe(Schema.brand("Timestamp"))),
  thresholdReached: Schema.Boolean
}) {}

// サーキットブレーカー状態管理 - より詳細な状態追跡
interface CircuitBreakerState {
  readonly failureCount: number
  readonly lastFailureTime: number
  readonly state: "Open" | "HalfOpen" | "Closed"
  readonly successCount: number
  readonly totalAttempts: number
}

interface CircuitBreakerConfig {
  readonly threshold: number
  readonly cooldownMs: number
  readonly halfOpenMaxAttempts: number
}

const createCircuitBreakerService = (
  serviceName: string,
  config: CircuitBreakerConfig = {
    threshold: 5,
    cooldownMs: 60000,
    halfOpenMaxAttempts: 3
  }
) => {
  return Effect.gen(function* () {
    const stateRef = yield* Ref.make<CircuitBreakerState>({
      failureCount: 0,
      lastFailureTime: 0,
      state: "Closed",
      successCount: 0,
      totalAttempts: 0
    })

    const callWithCircuitBreaker = <A, E, R>(
      operation: Effect.Effect<A, E, R>
    ): Effect.Effect<A, E | CircuitBreakerError, R> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(stateRef)
        const now = Date.now()

        // 状態に基づく処理判定
        const stateDecision = pipe(
          currentState.state,
          Match.value,
          Match.when("Open", () => {
            const timeSinceFailure = now - currentState.lastFailureTime
            if (timeSinceFailure >= config.cooldownMs) {
              return Effect.gen(function* () {
                yield* Ref.update(stateRef, s => ({ ...s, state: "HalfOpen" }))
                yield* Effect.logInfo("Circuit breaker transitioning to HalfOpen", {
                  service: serviceName,
                  timeSinceFailure
                })
                return "proceed" as const
              })
            } else {
              return Effect.fail(new CircuitBreakerError({
                service: serviceName,
                state: "Open",
                failureCount: currentState.failureCount,
                lastFailureTime: currentState.lastFailureTime,
                thresholdReached: true
              }))
            }
          }),

          Match.when("HalfOpen", () => {
            if (currentState.totalAttempts >= config.halfOpenMaxAttempts) {
              return Effect.gen(function* () {
                yield* Ref.update(stateRef, s => ({ ...s, state: "Open", lastFailureTime: now }))
                return yield* Effect.fail(new CircuitBreakerError({
                  service: serviceName,
                  state: "Open",
                  failureCount: currentState.failureCount,
                  lastFailureTime: now,
                  thresholdReached: true
                }))
              })
            }
            return Effect.succeed("proceed" as const)
          }),
          Match.when("Closed", () => Effect.succeed("proceed" as const)),
          Match.exhaustive
        )

        yield* stateDecision

        // 操作の実行
        return yield* operation.pipe(
          Effect.tap(() =>
            // 成功時の状態更新
            Ref.update(stateRef, s => ({
              ...s,
              successCount: s.successCount + 1,
              totalAttempts: s.state === "HalfOpen" ? s.totalAttempts + 1 : s.totalAttempts,
              failureCount: 0,
              state: s.state === "HalfOpen" && s.successCount >= 2 ? "Closed" : s.state
            })).pipe(
              Effect.tap(() =>
                Effect.logInfo("Circuit breaker operation succeeded", {
                  service: serviceName,
                  state: currentState.state,
                  successCount: currentState.successCount + 1
                })
              )
            )
          ),
          Effect.tapError((error) =>
            Ref.update(stateRef, s => {
              const newFailureCount = s.failureCount + 1
              const newState = newFailureCount >= config.threshold ? "Open" : s.state
              return {
                ...s,
                failureCount: newFailureCount,
                lastFailureTime: now,
                totalAttempts: s.state === "HalfOpen" ? s.totalAttempts + 1 : s.totalAttempts,
                state: newState
              }
            }).pipe(
              Effect.tap(() =>
                Effect.logWarning("Circuit breaker operation failed", {
                  service: serviceName,
                  error: String(error),
                  failureCount: currentState.failureCount + 1,
                  state: currentState.state
                })
              )
            )
          )
        )
      })

    return { callWithCircuitBreaker }
  })
}
```

**エラーリカバリー戦略**:
- 障害の早期検出と遮断
- 自動復旧の試行
- システム負荷の軽減
- フォールバック処理の提供

## アンチパターンと推奨事項

### ❌ アンチパターン

```typescript
// 1. try/catch の使用（非推奨）
try {
  const result = await dangerousOperation()
  return result
} catch (error) {
  console.log("Error occurred")
  return null
}

// 2. any型でのエラー処理
Effect.catchAll((error: any) => {
  // 型安全性を失う
})

// 3. エラー情報の無視
Effect.catchAll(() => Effect.succeed("ignored"))
```

### ✅ 推奨パターン

```typescript
// 1. Effect.catchAllとMatch.instanceOfによる型安全なエラーハンドリング
const safeOperation = Effect.gen(function* () {
  return yield* dangerousOperation()
}).pipe(
  Effect.catchAll((error) =>
    pipe(
      error,
      Match.value,
      Match.when(Match.instanceOf(NetworkError), (networkError) =>
        Effect.gen(function* () {
          yield* Effect.logWarning("Network error handled", { error: networkError })
          return yield* handleNetworkError(networkError)
        })
      ),
      Match.when(Match.instanceOf(ValidationError), (validationError) =>
        Effect.gen(function* () {
          yield* Effect.logInfo("Validation error handled", { error: validationError })
          return yield* handleValidationError(validationError)
        })
      ),
      Match.orElse((unknownError) =>
        Effect.gen(function* () {
          yield* Effect.logError("Unknown error encountered", { error: unknownError })
          return yield* handleUnknownError(unknownError)
        })
      )
    )
  )
)

// 2. Schema.TaggedError + Branded types（最新構文）
type FieldName = string & Brand.Brand<"FieldName">
type ErrorCode = number & Brand.Brand<"ErrorCode">

class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    field: Schema.String.pipe(Schema.brand("FieldName")),
    message: Schema.String,
    code: Schema.Number.pipe(Schema.brand("ErrorCode"))
  }
) {}

// 3. 構造化されたエラー情報（最新構文）
type CorrelationId = string & Brand.Brand<"CorrelationId">
type Timestamp = string & Brand.Brand<"Timestamp">

class EnhancedError extends Schema.TaggedError<EnhancedError>()(
  "EnhancedError",
  {
    category: Schema.Literal("Network", "Validation", "Business", "System"),
    severity: Schema.Literal("Low", "Medium", "High", "Critical"),
    context: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    timestamp: Schema.String.pipe(Schema.brand("Timestamp")),
    correlationId: Schema.String.pipe(Schema.brand("CorrelationId")),
    recoverable: Schema.Boolean,
    retryable: Schema.Boolean
  }
) {}

// 4. Effect.validateAllによる複数エラーの集約
const validateAllInputs = (inputs: ReadonlyArray<Input>): Effect.Effect<ReadonlyArray<ValidatedInput>, ValidationError, never> =>
  pipe(
    inputs,
    Effect.validateAll((input) => validateSingleInput(input)),
    Effect.mapError((errors) =>
      new ValidationError({
        field: "batch_validation",
        message: `Multiple validation errors: ${errors.length}`,
        code: 4000 as ErrorCode
      })
    )
  )

// 5. Schedule.recurseによる高度なリトライパターン
const smartRetryStrategy = <E>(isRetryable: (error: E) => boolean) =>
  pipe(
    Schedule.exponential("100 millis"),
    Schedule.intersect(Schedule.recurs(3)),
    Schedule.whileInput(isRetryable),
    Schedule.jittered // ジッターを追加してサンダリングハード効果を防ぐ
  )
```

## エラーハンドリングテスト戦略

### テスト可能なエラーハンドリング実装

```typescript
// テスト用エラー生成（最新構文）
class TestValidationError extends Schema.TaggedError<TestValidationError>()("TestValidationError", {
  field: Schema.String,
  expectedType: Schema.String,
  actualValue: Schema.Unknown
}) {}

const testableValidation = <T>(data: unknown): Effect.Effect<T, TestValidationError, ValidationService> =>
  Effect.gen(function* () {
    // バリデーション処理
    const validatedData = yield* validateUserInput(data)
    return yield* processValidData(validatedData)
  }).pipe(
    Effect.catchTag("ValidationError", (error) =>
      Effect.gen(function* () {
        // テスト専用のエラー変換
        yield* Effect.logInfo("Converting validation error for testing", { originalError: error })
        return yield* Effect.fail(new TestValidationError({
          field: error.field,
          expectedType: "string",
          actualValue: data
        }))
      })
    )
  )

// エラーハンドリングの包括的テストスイート
describe("Error Handling Patterns", () => {
  it.effect("should handle validation errors correctly", () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(testableValidation(123))

      expect(result).toEqual(
        Either.left(new TestValidationError({
          field: "input",
          expectedType: "string",
          actualValue: 123
        }))
      )
    })
  )

  it.effect("should retry temporary errors with exponential backoff", () =>
    Effect.gen(function* () {
      let attempt = 0
      const timestamps: number[] = []

      const flakyOperation = Effect.gen(function* () {
        attempt++
        timestamps.push(Date.now())

        if (attempt < 3) {
          return yield* Effect.fail(new TemporaryError({
            operation: "test",
            retryCount: attempt,
            category: "Network"
          }))
        }
        return yield* Effect.succeed("success")
      })

      const result = yield* flakyOperation.pipe(
        Effect.retry(Schedule.exponential("10 millis").pipe(
          Schedule.intersect(Schedule.recurs(3))
        ))
      )

      expect(result).toBe("success")
      expect(attempt).toBe(3)

      // リトライ間隔が指数的に増加していることを確認
      if (timestamps.length >= 2) {
        const interval1 = timestamps[1] - timestamps[0]
        const interval2 = timestamps[2] - timestamps[1]
        expect(interval2).toBeGreaterThan(interval1)
      }
    })
  )

  it.effect("should validate all inputs and aggregate errors", () =>
    Effect.gen(function* () {
      const invalidInputs = ["invalid1", "invalid2", "invalid3"]

      const result = yield* Effect.either(
        pipe(
          invalidInputs,
          Effect.validateAll((input) =>
            input === "valid"
              ? Effect.succeed(input)
              : Effect.fail(new ValidationError({ field: input, message: "Invalid", code: 400 }))
          )
        )
      )

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(Array.isArray(result.left)).toBe(true)
        expect(result.left).toHaveLength(3)
      }
    })
  )

  it.effect("should handle cause analysis correctly", () =>
    Effect.gen(function* () {
      const operation = Effect.gen(function* () {
        return yield* Effect.die(new Error("Critical system failure"))
      })

      const result = yield* Effect.either(
        operation.pipe(
          Effect.catchAllCause((cause) => {
            const analysis = analyzeCause(cause)
            return Effect.fail(new EnrichedError({
              originalError: Cause.pretty(cause),
              context: { analysis },
              timestamp: new Date().toISOString(),
              stackTrace: analysis.stackTrace,
              defects: analysis.defects,
              interruptions: analysis.interruptions
            }))
          })
        )
      )

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(EnrichedError)
        expect(result.left.defects.length).toBeGreaterThan(0)
      }
    })
  )

  // Match.instanceOfを使ったエラー型判定のテスト
  it.effect("should discriminate error types with Match.instanceOf", () =>
    Effect.gen(function* () {
      const networkError = new NetworkError({ message: "Connection failed" })
      const validationError = new ValidationError({ field: "name", message: "Required", code: 400 })

      const handleError = (error: unknown) =>
        pipe(
          error,
          Match.value,
          Match.when(Match.instanceOf(NetworkError), () => "network_handled"),
          Match.when(Match.instanceOf(ValidationError), () => "validation_handled"),
          Match.orElse(() => "unknown_handled")
        )

      expect(handleError(networkError)).toBe("network_handled")
      expect(handleError(validationError)).toBe("validation_handled")
      expect(handleError(new Error("unknown"))).toBe("unknown_handled")
    })
  )

  // フレーキーテストの処理
  it.effect("should handle circuit breaker state transitions", () =>
    it.flakyTest(
      Effect.gen(function* () {
        const { callWithCircuitBreaker } = yield* createCircuitBreakerService("test-service", {
          threshold: 2,
          cooldownMs: 100,
          halfOpenMaxAttempts: 1
        })

        let callCount = 0
        const flakyService = Effect.gen(function* () {
          callCount++
          if (callCount <= 2) {
            return yield* Effect.fail(new Error("Service unavailable"))
          }
          return yield* Effect.succeed("Service OK")
        })

        // 最初の2回の呼び出しは失敗してサーキットがオープンになる
        yield* Effect.either(callWithCircuitBreaker(flakyService))
        yield* Effect.either(callWithCircuitBreaker(flakyService))

        // 3回目は即座に失敗（サーキットオープン）
        const circuitOpenResult = yield* Effect.either(callWithCircuitBreaker(flakyService))
        expect(Either.isLeft(circuitOpenResult)).toBe(true)

        // クールダウン後、サーキットがハーフオープンになって成功
        yield* Effect.sleep("150 millis")
        const recoveryResult = yield* Effect.either(callWithCircuitBreaker(flakyService))
        expect(Either.isRight(recoveryResult)).toBe(true)
      }),
      "10 seconds"
    )
  )
})
```

## まとめ

このエラーハンドリングパターンカタログでは、Effect-TS 3.17+の強力なエラーハンドリング機能を活用した6つの主要パターンを紹介しました：

1. **Effect.catchAll** - 包括的エラーハンドリング
2. **Effect.catchTag** - 型安全な特定エラー処理
3. **Effect.catchTags** - 複数エラー型の効率的処理
4. **Cause分析** - 詳細なエラー原因分析
5. **Schedule活用リトライ** - インテリジェントな自動復旧
6. **サーキットブレーカー** - システム保護メカニズム

各パターンは型安全性、可読性、保守性を重視して設計されており、堅牢なゲームシステムの構築に不可欠な要素です。適切なパターンを選択し、プロジェクトの要件に応じてカスタマイズすることで、信頼性の高いMinecraftクローンを実現できます。