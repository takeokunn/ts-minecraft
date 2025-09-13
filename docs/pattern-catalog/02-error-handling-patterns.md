# Error Handling Patterns

## Pattern 1: Basic Tagged Error
**使用場面**: 基本的なビジネスエラーの定義

**実装**:
```typescript
export class ValidationError extends Schema.TaggedError("ValidationError")<{
  readonly field: string
  readonly message: string
  readonly timestamp: number
}> {}

// 使用例
const validateUserInput = (input: unknown) => Effect.gen(function* () {
  const result = Schema.decodeUnknownEither(UserSchema)(input)

  if (Either.isLeft(result)) {
    return yield* Effect.fail(new ValidationError({
      field: "user",
      message: "Invalid user data",
      timestamp: Date.now()
    }))
  }

  return result.right
})
```

## Pattern 2: Hierarchical Errors
**使用場面**: エラーの階層化が必要な場合

**実装**:
```typescript
// 基底エラー
export class DomainError extends Schema.TaggedError("DomainError")<{
  readonly message: string
  readonly timestamp: number
  readonly context?: unknown
}> {}

// 特化エラー
export class ChunkError extends DomainError {}

export class ChunkNotFoundError extends Schema.TaggedError("ChunkNotFoundError")<{
  readonly coordinate: ChunkCoordinate
  readonly timestamp: number
}> {}

export class ChunkGenerationError extends Schema.TaggedError("ChunkGenerationError")<{
  readonly coordinate: ChunkCoordinate
  readonly reason: string
  readonly timestamp: number
  readonly cause?: unknown
}> {}
```

## Pattern 3: Error with Recovery
**使用場面**: エラー発生時に代替処理を実行する場合

**実装**:
```typescript
const loadChunkWithFallback = (coord: ChunkCoordinate) => Effect.gen(function* () {
  return yield* chunkStorage.loadChunk(coord).pipe(
    Effect.catchTag("ChunkNotFoundError", () =>
      // チャンクが見つからない場合は生成
      chunkGenerator.generateChunk(coord)
    ),
    Effect.catchTag("ChunkCorruptedError", () =>
      // 破損している場合は再生成
      Effect.gen(function* () {
        yield* Effect.logWarn(`Corrupted chunk detected: ${coord.x},${coord.z}`)
        return yield* chunkGenerator.generateChunk(coord)
      })
    )
  )
})
```

## Pattern 4: Error Accumulation
**使用場面**: 複数のエラーを蓄積して一度に処理する場合

**実装**:
```typescript
export class ValidationErrors extends Schema.TaggedError("ValidationErrors")<{
  readonly errors: ReadonlyArray<ValidationError>
  readonly timestamp: number
}> {}

const validateMultipleFields = (data: unknown) => Effect.gen(function* () {
  const errors: ValidationError[] = []

  // 各フィールドを検証
  const nameResult = yield* validateName(data.name).pipe(Effect.either)
  if (Either.isLeft(nameResult)) {
    errors.push(nameResult.left)
  }

  const emailResult = yield* validateEmail(data.email).pipe(Effect.either)
  if (Either.isLeft(emailResult)) {
    errors.push(emailResult.left)
  }

  const ageResult = yield* validateAge(data.age).pipe(Effect.either)
  if (Either.isLeft(ageResult)) {
    errors.push(ageResult.left)
  }

  if (errors.length > 0) {
    return yield* Effect.fail(new ValidationErrors({
      errors,
      timestamp: Date.now()
    }))
  }

  return {
    name: Either.getOrThrow(nameResult),
    email: Either.getOrThrow(emailResult),
    age: Either.getOrThrow(ageResult)
  }
})
```

## Pattern 5: Retry with Exponential Backoff
**使用場面**: 一時的な失敗に対してリトライを実行する場合

**実装**:
```typescript
const reliableNetworkOperation = (url: string) => Effect.gen(function* () {
  return yield* Effect.tryPromise({
    try: () => fetch(url),
    catch: (cause) => new NetworkError({
      url,
      message: "Network request failed",
      timestamp: Date.now(),
      cause
    })
  }).pipe(
    Effect.retry(
      Schedule.exponential("1 seconds", 2.0).pipe(
        Schedule.recurs(3),
        Schedule.whileInput((error: NetworkError) =>
          // 特定のエラーの場合のみリトライ
          error.message.includes("timeout") ||
          error.message.includes("connection")
        )
      )
    )
  )
})
```

## Pattern 6: Circuit Breaker
**使用場面**: 外部サービスの障害から保護する場合

**実装**:
```typescript
export interface CircuitBreakerService {
  readonly execute: <A, E>(
    operation: Effect.Effect<A, E>
  ) => Effect.Effect<A, E | CircuitBreakerError>
}

export class CircuitBreakerError extends Schema.TaggedError("CircuitBreakerError")<{
  readonly reason: "OPEN" | "TIMEOUT"
  readonly timestamp: number
}> {}

const makeCircuitBreakerService = Effect.gen(function* () {
  const state = yield* Ref.make<"CLOSED" | "OPEN" | "HALF_OPEN">("CLOSED")
  const failures = yield* Ref.make(0)
  const lastFailureTime = yield* Ref.make(0)

  const failureThreshold = 5
  const timeoutDuration = 30000 // 30 seconds

  return CircuitBreakerService.of({
    execute: <A, E>(operation: Effect.Effect<A, E>) => Effect.gen(function* () {
      const currentState = yield* Ref.get(state)
      const now = Date.now()
      const lastFailure = yield* Ref.get(lastFailureTime)

      if (currentState === "OPEN") {
        if (now - lastFailure > timeoutDuration) {
          // HALF_OPEN状態に移行
          yield* Ref.set(state, "HALF_OPEN")
        } else {
          // まだタイムアウト期間中
          return yield* Effect.fail(new CircuitBreakerError({
            reason: "OPEN",
            timestamp: now
          }))
        }
      }

      // 操作を実行
      const result = yield* operation.pipe(Effect.either)

      if (Either.isRight(result)) {
        // 成功時は状態をリセット
        yield* Ref.set(state, "CLOSED")
        yield* Ref.set(failures, 0)
        return result.right
      } else {
        // 失敗時は失敗カウントを増加
        const currentFailures = yield* Ref.updateAndGet(failures, n => n + 1)
        yield* Ref.set(lastFailureTime, now)

        if (currentFailures >= failureThreshold) {
          yield* Ref.set(state, "OPEN")
        }

        return yield* Effect.fail(result.left)
      }
    })
  })
})
```

## Pattern 7: Error Context Enrichment
**使用場面**: エラーに追加のコンテキスト情報を付加する場合

**実装**:
```typescript
const enrichError = <E extends { timestamp: number }>(
  error: E,
  context: Record<string, unknown>
): E & { context: Record<string, unknown> } => ({
  ...error,
  context
})

const processUserAction = (userId: string, action: UserAction) => Effect.gen(function* () {
  return yield* userService.performAction(userId, action).pipe(
    Effect.mapError((error) =>
      enrichError(error, {
        userId,
        action: action.type,
        sessionId: action.sessionId,
        userAgent: action.userAgent
      })
    )
  )
})
```

## Anti-Patterns (避けるべき)

### ❌ Anti-Pattern 1: Try-Catch in Effect Context
```typescript
// 避けるべき
const badErrorHandling = Effect.gen(function* () {
  try {
    const result = yield* someOperation()
    return result
  } catch (error) {
    return yield* Effect.fail(error)
  }
})
```

### ❌ Anti-Pattern 2: Throwing Raw Errors
```typescript
// 避けるべき
const badOperation = () => Effect.gen(function* () {
  if (condition) {
    throw new Error("Something went wrong") // ❌
  }
})

// 正しい方法
const goodOperation = () => Effect.gen(function* () {
  if (condition) {
    return yield* Effect.fail(new OperationError({ // ✅
      message: "Something went wrong",
      timestamp: Date.now()
    }))
  }
})
```

### ❌ Anti-Pattern 3: Unstructured Error Information
```typescript
// 避けるべき
class BadError extends Error {
  constructor(message: string) {
    super(message)
  }
}

// 正しい方法
class GoodError extends Schema.TaggedError("GoodError")<{
  readonly operation: string
  readonly input: unknown
  readonly timestamp: number
  readonly cause?: unknown
}> {}
```

## Best Practices

### 1. Error Naming Convention
- Always use descriptive names ending in "Error"
- Use PascalCase for error class names
- Include the domain/module prefix when appropriate

### 2. Error Information Structure
```typescript
// 常に以下の情報を含める
{
  readonly message: string,           // 人間が読める説明
  readonly timestamp: number,         // エラー発生時刻
  readonly context?: unknown,         // 追加のコンテキスト
  readonly cause?: unknown           // 元の原因
}
```

### 3. Error Recovery Strategy
```typescript
// パターン: fallback → retry → fail
const robustOperation = (input: Input) =>
  primaryOperation(input).pipe(
    Effect.catchTag("TemporaryError", () => fallbackOperation(input)),
    Effect.retry(Schedule.exponential("1 seconds").pipe(Schedule.recurs(3))),
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError("Operation failed permanently", error)
        return yield* Effect.fail(error)
      })
    )
  )
```

### 4. Error Testing
```typescript
// エラーケースのテスト
const testErrorScenarios = Effect.gen(function* () {
  // 正常系のテスト
  const validResult = yield* operation("valid-input")
  assert.strictEqual(validResult.status, "success")

  // エラー系のテスト
  const errorResult = yield* operation("invalid-input").pipe(Effect.either)
  assert(Either.isLeft(errorResult))
  assert(errorResult.left instanceof ValidationError)
})
```