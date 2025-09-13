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
export class ChunkGenerationError extends Schema.TaggedError("ChunkGenerationError")<{
  readonly coordinate: ChunkCoordinate
  readonly reason: string
}> {}

const loadChunk = (coordinate: ChunkCoordinate) =>
  Effect.gen(function* () {
    // チャンク生成処理
    yield* generateChunkData(coordinate)
    yield* saveChunkToCache(coordinate)

    return yield* Effect.succeed(/* chunk data */)
  }).pipe(
    // 全てのエラーを包括的に処理
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        // エラーログを記録
        yield* Effect.log(`Chunk loading failed: ${String(error)}`)

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
export class ChunkNotFoundError extends Schema.TaggedError("ChunkNotFoundError")<{
  readonly coordinate: ChunkCoordinate
}> {}

export class ChunkGenerationError extends Schema.TaggedError("ChunkGenerationError")<{
  readonly coordinate: ChunkCoordinate
  readonly reason: string
}> {}

export class ChunkCorruptedError extends Schema.TaggedError("ChunkCorruptedError")<{
  readonly coordinate: ChunkCoordinate
  readonly corruptionType: string
}> {}

const processChunk = (coordinate: ChunkCoordinate) =>
  Effect.gen(function* () {
    return yield* loadChunkFromStorage(coordinate)
  }).pipe(
    // 特定エラーへの型安全な対応
    Effect.catchTag("ChunkNotFoundError", () =>
      Effect.gen(function* () {
        yield* Effect.log("Chunk not found, generating new one")
        return yield* generateNewChunk(coordinate)
      })
    ),
    Effect.catchTag("ChunkCorruptedError", (error) =>
      Effect.gen(function* () {
        yield* Effect.log(`Corrupted chunk detected: ${error.corruptionType}`)
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
export class InventoryNotFoundError extends Schema.TaggedError("InventorySystem.InventoryNotFoundError")<{
  readonly playerId: string
}> {}

export class InventoryFullError extends Schema.TaggedError("InventorySystem.InventoryFullError")<{
  readonly playerId: string
  readonly currentSize: number
  readonly maxSize: number
}> {}

export class InvalidItemError extends Schema.TaggedError("InventorySystem.InvalidItemError")<{
  readonly itemId: string
  readonly reason: string
}> {}

const addItemToInventory = (playerId: string, item: Item) =>
  Effect.gen(function* () {
    const inventory = yield* getInventory(playerId)
    yield* validateItem(item)
    return yield* inventory.addItem(item)
  }).pipe(
    // 複数エラー型の同時処理
    Effect.catchTags({
      "InventorySystem.InventoryFullError": (error) =>
        Effect.gen(function* () {
          yield* Effect.log(`Inventory full for player ${error.playerId}`)
          yield* notifyPlayer(error.playerId, "Inventory is full!")
          return yield* Effect.fail(error)
        }),

      "InventorySystem.InvalidItemError": (error) =>
        Effect.gen(function* () {
          yield* Effect.log(`Invalid item: ${error.itemId} - ${error.reason}`)
          return yield* Effect.succeed(false) // アイテム追加失敗として正常終了
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
export class EnrichedError extends Schema.TaggedError("EnrichedError")<{
  readonly originalError: string
  readonly context: Record<string, unknown>
  readonly timestamp: string
}> {}

const processWithCauseAnalysis = (data: unknown) =>
  Effect.gen(function* () {
    return yield* complexProcessing(data)
  }).pipe(
    Effect.catchAllCause((cause) =>
      Effect.gen(function* () {
        // Cause情報の詳細分析
        const analysis = analyzeCause(cause)

        return yield* Effect.fail(new EnrichedError({
          originalError: cause.toString(),
          context: {
            timestamp: new Date().toISOString(),
            stackTrace: analysis.stackTrace,
            defects: analysis.defects,
            interruptions: analysis.interruptions
          },
          timestamp: new Date().toISOString()
        }))
      })
    )
  )

// Cause分析ヘルパー
const analyzeCause = (cause: Cause.Cause<unknown>) => {
  const defects = Cause.defects(cause)
  const failures = Cause.failures(cause)
  const interruptions = Cause.interruptions(cause)

  return {
    defects: Array.from(defects),
    failures: Array.from(failures),
    interruptions: Array.from(interruptions),
    stackTrace: Cause.pretty(cause)
  }
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
export class TemporaryError extends Schema.TaggedError("TemporaryError")<{
  readonly operation: string
  readonly retryCount: number
}> {}

export class PermanentError extends Schema.TaggedError("PermanentError")<{
  readonly operation: string
  readonly reason: string
}> {}

// リトライ戦略の定義
const retryStrategy = pipe(
  Schedule.exponential("100 millis"), // 指数バックオフ
  Schedule.compose(Schedule.recurs(3)), // 最大3回リトライ
  Schedule.whileInput((error: unknown) =>
    // 一時的エラーのみリトライ
    error instanceof TemporaryError
  )
)

const reliableNetworkOperation = (url: string) =>
  Effect.gen(function* () {
    return yield* performNetworkRequest(url)
  }).pipe(
    // 特定エラーのみリトライ対象
    Effect.catchTag("TemporaryError", (error) =>
      Effect.gen(function* () {
        yield* Effect.log(`Retrying operation: ${error.operation} (attempt ${error.retryCount})`)
        return yield* Effect.fail(error)
      })
    ),
    // リトライスケジュールの適用
    Effect.retry(retryStrategy),

    // 最終的なエラーハンドリング
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        if (error instanceof TemporaryError) {
          yield* Effect.log(`All retries failed for: ${error.operation}`)
          return yield* Effect.fail(new PermanentError({
            operation: error.operation,
            reason: "Retry limit exceeded"
          }))
        }
        return yield* Effect.fail(error)
      })
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
export class CircuitBreakerError extends Schema.TaggedError("CircuitBreakerError")<{
  readonly service: string
  readonly state: "Open" | "HalfOpen" | "Closed"
  readonly failureCount: number
}> {}

// サーキットブレーカー状態管理
interface CircuitBreakerState {
  readonly failureCount: number
  readonly lastFailureTime: number
  readonly state: "Open" | "HalfOpen" | "Closed"
}

const createCircuitBreakerService = (serviceName: string, threshold: number = 5) => {
  const stateRef = Ref.make<CircuitBreakerState>({
    failureCount: 0,
    lastFailureTime: 0,
    state: "Closed"
  })

  const callWithCircuitBreaker = <A, E, R>(
    operation: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E | CircuitBreakerError, R> =>
    Effect.gen(function* () {
      const state = yield* stateRef

      // Open状態では即座に失敗
      if (state.current.state === "Open") {
        const timeSinceFailure = Date.now() - state.current.lastFailureTime
        if (timeSinceFailure < 60000) { // 1分間のクールダウン
          return yield* Effect.fail(new CircuitBreakerError({
            service: serviceName,
            state: "Open",
            failureCount: state.current.failureCount
          }))
        } else {
          // HalfOpen状態に移行
          yield* state.update(s => ({ ...s, state: "HalfOpen" }))
        }
      }

      // 操作の実行
      return yield* operation.pipe(
        Effect.tap(() =>
          // 成功時：状態をリセット
          state.update(_ => ({
            failureCount: 0,
            lastFailureTime: 0,
            state: "Closed"
          }))
        ),
        Effect.tapError(() =>
          // 失敗時：カウンターを増加
          state.update(s => {
            const newFailureCount = s.failureCount + 1
            return {
              failureCount: newFailureCount,
              lastFailureTime: Date.now(),
              state: newFailureCount >= threshold ? "Open" : s.state
            }
          })
        )
      )
    }).pipe(Effect.provide(stateRef))

  return { callWithCircuitBreaker }
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
// 1. Effect.catchAllによる型安全なエラーハンドリング
const safeOperation = Effect.gen(function* () {
  return yield* dangerousOperation()
}).pipe(
  Effect.catchAll((error) =>
    pipe(
      error,
      Match.value,
      Match.when(
        Schema.is(NetworkError),
        (networkError) => handleNetworkError(networkError)
      ),
      Match.when(
        Schema.is(ValidationError),
        (validationError) => handleValidationError(validationError)
      ),
      Match.orElse(() => handleUnknownError(error))
    )
  )
)

// 2. Schema.TaggedError + Branded types
class ValidationError extends Schema.TaggedError("ValidationError")<{
  readonly field: string & Brand.Brand<"FieldName">
  readonly message: string
  readonly code: number & Brand.Brand<"ErrorCode">
}> {}

// 3. 構造化されたエラー情報
class EnhancedError extends Schema.TaggedError("EnhancedError")<{
  readonly category: "Network" | "Validation" | "Business"
  readonly severity: "Low" | "Medium" | "High" | "Critical"
  readonly context: Record<string, unknown>
  readonly timestamp: string
  readonly correlationId: string
}> {}
```

## エラーハンドリングテスト戦略

### テスト可能なエラーハンドリング実装

```typescript
// テスト用エラー生成
class TestValidationError extends Schema.TaggedError("TestValidationError")<{
  readonly field: string
  readonly expectedType: string
  readonly actualValue: unknown
}> {}

const testableValidation = (data: unknown) =>
  Effect.gen(function* () {
    // バリデーション処理
    yield* validateUserInput(data)
    return yield* processValidData(data)
  }).pipe(
    Effect.catchTag("ValidationError", (error) =>
      Effect.fail(new TestValidationError({
        field: error.field,
        expectedType: "string",
        actualValue: data
      }))
    )
  )

// エラーハンドリングの包括的テストスイート
describe("Error Handling Patterns", () => {
  it.effect("should handle validation errors correctly", () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(testableValidation(123))

      expect(result).toStrictEqual(
        Either.left(new TestValidationError({
          field: "input",
          expectedType: "string",
          actualValue: 123
        }))
      )
    })
  )

  it.effect("should retry temporary errors", () =>
    Effect.gen(function* () {
      let attempt = 0
      const flakyOperation = Effect.gen(function* () {
        attempt++
        if (attempt < 3) {
          return yield* Effect.fail(new TemporaryError({
            operation: "test",
            retryCount: attempt
          }))
        }
        return yield* Effect.succeed("success")
      })

      const result = yield* flakyOperation.pipe(
        Effect.retry(Schedule.recurs(3))
      )

      expect(result).toBe("success")
      expect(attempt).toBe(3)
    })
  )

  // フレーキーテストの処理
  it.effect("should handle circuit breaker", () =>
    it.flakyTest(
      Effect.gen(function* () {
        // サーキットブレーカーのテスト
      }),
      "5 seconds"
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