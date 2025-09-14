---
title: "Effect-TS エラーハンドリング - 型安全で堅牢なエラー管理"
description: "Schema.TaggedError、Effect.catchTag、Schedule、Causeを活用した包括的なエラーハンドリング戦略と回復パターン"
category: "architecture"
difficulty: "advanced"
tags: ["effect-ts", "error-handling", "resilience", "schema", "schedule"]
prerequisites: ["effect-ts-basics", "effect-ts-services"]
estimated_reading_time: "30分"
version: "1.0.0"
---

# Effect-TS エラーハンドリング

このドキュメントでは、TypeScript Minecraftプロジェクトにおける**Effect-TS 3.17+** の包括的なエラーハンドリング戦略を解説します。型安全で回復力のあるエラー管理システムを構築する方法を詳しく説明します。

> 📖 **関連ドキュメント**: [Effect-TS 基本概念](./06a-effect-ts-basics.md) | [Effect-TS サービス](./06b-effect-ts-services.md) | [Effect-TS テスト](./06d-effect-ts-testing.md)

## 1. タグ付きエラー (Tagged Errors)

エラーは `Schema.TaggedError` を用いてタグ付きエラー型として定義します。これにより、`Effect.catchTag` を使った型安全なエラーハンドリングが可能になります。

### 1.1 基本的なエラー定義

```typescript
import { Schema, Effect, Match } from "effect";

// ✅ Schema.TaggedError ベースのエラー定義（最新パターン）
class NetworkError extends Schema.TaggedError<NetworkError>()(
  "NetworkError",
  {
    message: Schema.String.pipe(Schema.nonEmpty()),
    code: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    timestamp: Schema.Number.pipe(Schema.brand("Timestamp")),
    retryCount: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
    requestId: Schema.optional(Schema.String.pipe(Schema.uuid()))
  }
) {}

// ✅ エラーファクトリー関数（クラスコンストラクター使用）
const createNetworkError = (
  message: string,
  code: number,
  retryCount?: number,
  requestId?: string
) => new NetworkError({
  message,
  code,
  timestamp: Date.now() as any,
  retryCount,
  requestId
});

class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    field: Schema.String.pipe(Schema.nonEmpty()),
    value: Schema.Unknown,
    constraints: Schema.Array(Schema.String),
    path: Schema.optional(Schema.Array(Schema.String))
  }
) {}

class ChunkError extends Schema.TaggedError<ChunkError>()(
  "ChunkError",
  {
    coordinate: ChunkCoordinate,
    operation: Schema.String,
    reason: Schema.String,
    timestamp: Schema.Number
  }
) {}

// ✅ 階層的エラー型定義
type GameError = NetworkError | ValidationError | ChunkError;
type AllErrors = GameError | SystemError | ResourceError;
```

### 1.2 ドメイン固有エラー

```typescript
// ✅ プレイヤー関連エラー（Schema.TaggedError使用）
class PlayerNotFoundError extends Schema.TaggedError<PlayerNotFoundError>()(
  "PlayerNotFoundError",
  {
    playerId: PlayerId,
    message: Schema.String,
    searchContext: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
  }
) {}

class PlayerCannotMoveError extends Schema.TaggedError<PlayerCannotMoveError>()(
  "PlayerCannotMoveError",
  {
  playerId: PlayerId,
  currentPosition: Position,
  targetPosition: Position,
  reason: Schema.String
});

const MoveDistanceTooFarError = Schema.Struct({
  _tag: Schema.Literal("MoveDistanceTooFarError"),
  playerId: PlayerId,
  attemptedDistance: Schema.Number,
  maxDistance: Schema.Number,
  from: Position,
  to: Position
});

const InvalidPositionError = Schema.Struct({
  _tag: Schema.Literal("InvalidPositionError"),
  position: Position,
  bounds: WorldBounds,
  dimension: Schema.optional(Schema.String)
});

// ✅ ワールド関連エラー
const BlockNotFoundError = Schema.Struct({
  _tag: Schema.Literal("BlockNotFoundError"),
  position: Position,
  message: Schema.String,
  chunkId: Schema.optional(ChunkId)
});

const ChunkNotLoadedError = Schema.Struct({
  _tag: Schema.Literal("ChunkNotLoadedError"),
  coordinate: ChunkCoordinate,
  reason: Schema.String,
  loadAttempts: Schema.Number.pipe(Schema.nonNegative())
});

// ✅ エラーユニオン型
type PlayerError =
  | PlayerNotFoundError
  | PlayerCannotMoveError
  | MoveDistanceTooFarError
  | InvalidPositionError;

type WorldError =
  | BlockNotFoundError
  | ChunkNotLoadedError
  | ChunkError;

type DomainError = PlayerError | WorldError;

// ✅ エラー型との組み合わせ
type MovementResult = Effect.Effect<Player, PlayerError | ValidationError>;
type BlockAccessResult = Effect.Effect<Block, WorldError | NetworkError>;
```

## 2. 型安全なエラーハンドリング

### 2.1 Effect.catchTag による個別エラー処理

```typescript
// ✅ 個別エラータイプの処理
const operation = Effect.gen(function* () {
  const player = yield* getPlayer(playerId);
  return yield* movePlayer(player, targetPosition);
}).pipe(
  Effect.catchTag("PlayerNotFoundError", (error) =>
    Effect.gen(function* () {
      yield* Effect.log(`プレイヤーが見つかりません: ${error.playerId}`);
      return yield* createDefaultPlayer(error.playerId);
    })
  ),
  Effect.catchTag("NetworkError", (error) =>
    Effect.gen(function* () {
      yield* Effect.log(`ネットワークエラー (${error.code}): ${error.message}`);

      // ✅ リトライカウントに基づく処理
      if ((error.retryCount ?? 0) < 3) {
        return yield* retryOperation(error);
      }

      return yield* useCachedData();
    })
  ),
  Effect.catchTag("ValidationError", (error) =>
    Effect.gen(function* () {
      yield* Effect.log(`バリデーションエラー - フィールド: ${error.field}`);
      return yield* getDefaultValue(error.field);
    })
  )
);
```

### 2.2 Effect.catchTags による複数エラー処理

```typescript
// ✅ 複数エラータイプの一括処理
const robustPlayerOperation = (playerId: PlayerId, action: PlayerAction) =>
  Effect.gen(function* () {
    const player = yield* getPlayer(playerId);
    return yield* executePlayerAction(player, action);
  }).pipe(
    Effect.catchTags({
      PlayerNotFoundError: (error) =>
        Effect.gen(function* () {
          yield* Effect.log(`プレイヤー ${error.playerId} が見つかりません`);
          yield* metrics.incrementCounter("player_not_found_errors");
          return yield* createGuestPlayer();
        }),

      PlayerCannotMoveError: (error) =>
        Effect.gen(function* () {
          yield* Effect.log(`プレイヤー ${error.playerId} は移動できません: ${error.reason}`);
          yield* notifyPlayerOfRestriction(error.playerId, error.reason);
          return yield* getCurrentPlayerState(error.playerId);
        }),

      InvalidPositionError: (error) =>
        Effect.gen(function* () {
          yield* Effect.log(`無効な位置: ${JSON.stringify(error.position)}`);
          yield* teleportPlayerToSafeLocation(playerId);
          return yield* getCurrentPlayerState(playerId);
        }),

      NetworkError: (error) =>
        Effect.gen(function* () {
          yield* Effect.log(`ネットワークエラー: ${error.message}`);

          // ✅ パターンマッチングによるエラーコード処理
          return yield* Match.value(error.code).pipe(
            Match.when(404, () => useLocalData()),
            Match.when(500, () => retryWithBackoff(error)),
            Match.when(503, () => useCircuitBreaker()),
            Match.orElse(() => fallbackToOfflineMode())
          );
        })
    })
  );
```

### 2.3 エラー変換と伝播

```typescript
// ✅ エラー変換パターン
const transformErrors = <A, E1, E2>(
  effect: Effect.Effect<A, E1>,
  transform: (error: E1) => E2
): Effect.Effect<A, E2> =>
  effect.pipe(
    Effect.mapError(transform)
  );

// ✅ ドメインエラーへの変換
const toDomainError = (systemError: SystemError): DomainError => {
  return Match.value(systemError).pipe(
    Match.when({ _tag: "FileNotFoundError" }, () => ({
      _tag: "ChunkNotLoadedError" as const,
      coordinate: { x: 0, z: 0 }, // デフォルト値
      reason: "ファイルが見つかりません",
      loadAttempts: 1
    })),
    Match.when({ _tag: "DatabaseConnectionError" }, () => ({
      _tag: "NetworkError" as const,
      message: "データベース接続エラー",
      code: 503,
      timestamp: Date.now() as any
    })),
    Match.orElse(() => ({
      _tag: "ChunkError" as const,
      coordinate: { x: 0, z: 0 },
      operation: "unknown",
      reason: "システムエラーが発生しました",
      timestamp: Date.now()
    }))
  );
};

// ✅ エラー変換の適用
const loadChunkSafely = (coordinate: ChunkCoordinate) =>
  loadChunkFromSystem(coordinate).pipe(
    Effect.mapError(toDomainError),
    Effect.catchTag("ChunkNotLoadedError", (error) =>
      Effect.gen(function* () {
        yield* Effect.log(`チャンク読み込み失敗: ${error.reason}`);
        return yield* generateEmptyChunk(coordinate);
      })
    )
  );
```

## 3. Scheduleによるリトライ戦略

### 3.1 基本的なリトライパターン

```typescript
import { Schedule, Duration } from "effect";

// ✅ 指数バックオフによるリトライ
const retryWithExponentialBackoff = <A, E>(
  effect: Effect.Effect<A, E>,
  maxRetries: number = 3
) =>
  effect.pipe(
    Effect.retry(
      Schedule.exponential("100 millis", 2).pipe(
        Schedule.compose(Schedule.recurs(maxRetries)),
        Schedule.compose(Schedule.jittered) // ジッターを追加
      )
    )
  );

// ✅ 条件付きリトライ
const retryOnSpecificErrors = <A>(effect: Effect.Effect<A, GameError>) =>
  effect.pipe(
    Effect.retry(
      Schedule.recurWhile((error: GameError) =>
        Match.value(error).pipe(
          Match.when({ _tag: "NetworkError" }, (e) => e.code >= 500),
          Match.when({ _tag: "ChunkNotLoadedError" }, (e) => e.loadAttempts < 5),
          Match.orElse(() => false)
        )
      ).pipe(
        Schedule.compose(Schedule.exponential("200 millis")),
        Schedule.compose(Schedule.upTo("30 seconds"))
      )
    )
  );

// ✅ カスタムリトライロジック
const advancedRetryStrategy = <A>(
  effect: Effect.Effect<A, NetworkError>,
  options: {
    maxRetries: number;
    baseDelay: Duration.Duration;
    maxDelay: Duration.Duration;
    backoffFactor: number;
  }
) =>
  effect.pipe(
    Effect.retry(
      Schedule.exponential(options.baseDelay, options.backoffFactor).pipe(
        Schedule.either(Schedule.spaced(options.maxDelay)),
        Schedule.compose(Schedule.recurs(options.maxRetries)),
        Schedule.whileInput((error: NetworkError) => {
          // ✅ リトライ可能なエラーコードのみリトライ
          const retryableCodes = [408, 429, 500, 502, 503, 504];
          return retryableCodes.includes(error.code);
        })
      )
    ),
    Effect.tap(() => Effect.log("リトライが成功しました")),
    Effect.tapError((error) => Effect.log(`最終的にリトライが失敗: ${error.message}`))
  );
```

### 3.2 回路ブレーカーパターン

```typescript
// ✅ 回路ブレーカーの実装
const createCircuitBreaker = <A, E>(
  effect: Effect.Effect<A, E>,
  options: {
    failureThreshold: number;
    successThreshold: number;
    timeout: Duration.Duration;
  }
) =>
  Effect.gen(function* () {
    const state = yield* Ref.make<{
      status: "closed" | "open" | "half-open";
      failureCount: number;
      successCount: number;
      lastFailureTime: number | null;
    }>({
      status: "closed",
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null
    });

    const execute = Effect.gen(function* () {
      const currentState = yield* Ref.get(state);
      const now = Date.now();

      // ✅ 回路ブレーカー状態に基づく処理
      const shouldExecute = Match.value(currentState.status).pipe(
        Match.when("closed", () => true),
        Match.when("open", () => {
          const timeSinceFailure = currentState.lastFailureTime
            ? now - currentState.lastFailureTime
            : 0;
          const timeoutMs = Duration.toMillis(options.timeout);

          if (timeSinceFailure >= timeoutMs) {
            // half-openに移行
            Ref.update(state, s => ({ ...s, status: "half-open", successCount: 0 }));
            return true;
          }
          return false;
        }),
        Match.when("half-open", () => true),
        Match.exhaustive
      );

      if (!shouldExecute) {
        return yield* Effect.fail({
          _tag: "CircuitBreakerOpenError" as const,
          message: "回路ブレーカーが開いています",
          nextRetryTime: (currentState.lastFailureTime ?? 0) + Duration.toMillis(options.timeout)
        });
      }

      try {
        const result = yield* effect;

        // ✅ 成功時の状態更新
        yield* Ref.update(state, s => {
          if (s.status === "half-open") {
            const newSuccessCount = s.successCount + 1;
            if (newSuccessCount >= options.successThreshold) {
              return { ...s, status: "closed", failureCount: 0, successCount: 0 };
            }
            return { ...s, successCount: newSuccessCount };
          }
          return { ...s, failureCount: Math.max(0, s.failureCount - 1) };
        });

        return result;
      } catch (error) {
        // ✅ 失敗時の状態更新
        yield* Ref.update(state, s => {
          const newFailureCount = s.failureCount + 1;
          if (newFailureCount >= options.failureThreshold) {
            return {
              ...s,
              status: "open",
              failureCount: newFailureCount,
              lastFailureTime: now
            };
          }
          return { ...s, failureCount: newFailureCount };
        });

        return yield* Effect.fail(error);
      }
    });

    return {
      execute,
      getState: () => Ref.get(state),
      reset: () => Ref.set(state, {
        status: "closed",
        failureCount: 0,
        successCount: 0,
        lastFailureTime: null
      })
    };
  });
```

## 4. Causeによる詳細エラー分析

### 4.1 根本原因の追跡

```typescript
import { Cause, FiberId } from "effect";

// ✅ Cause分析による詳細エラー情報
const analyzeFailure = <E>(cause: Cause.Cause<E>) =>
  Effect.gen(function* () {
    yield* Effect.log("エラー分析を開始");

    // ✅ エラーの種類に基づく分析
    return yield* Match.value(cause).pipe(
      Match.when(Cause.isEmpty, () =>
        Effect.succeed({ type: "empty", details: "エラーなし" })
      ),
      Match.when(Cause.isFailType, (failCause) =>
        Effect.gen(function* () {
          const error = Cause.failureOption(failCause);
          yield* Effect.log(`アプリケーションエラー: ${JSON.stringify(error)}`);
          return { type: "application", error, recoverable: true };
        })
      ),
      Match.when(Cause.isDieType, (dieCause) =>
        Effect.gen(function* () {
          const defect = Cause.dieOption(dieCause);
          yield* Effect.log(`予期しないエラー (defect): ${JSON.stringify(defect)}`);
          return { type: "defect", error: defect, recoverable: false };
        })
      ),
      Match.when(Cause.isInterruptType, (interruptCause) =>
        Effect.gen(function* () {
          const fiberId = Cause.interruptOption(interruptCause);
          yield* Effect.log(`ファイバー中断: ${FiberId.threadName(fiberId.value)}`);
          return { type: "interrupt", fiberId, recoverable: false };
        })
      ),
      Match.orElse(() =>
        Effect.succeed({ type: "unknown", details: "不明なエラー種別" })
      )
    );
  });

// ✅ エラー回復戦略
const recoverFromFailure = <A, E>(
  effect: Effect.Effect<A, E>,
  recovery: (cause: Cause.Cause<E>) => Effect.Effect<A, never>
) =>
  effect.pipe(
    Effect.sandbox,
    Effect.catchAll((cause) =>
      Effect.gen(function* () {
        const analysis = yield* analyzeFailure(cause);

        yield* Effect.log(`エラー回復を試行: ${analysis.type}`);

        if (analysis.recoverable) {
          return yield* recovery(cause);
        }

        // ✅ 回復不可能なエラーの場合は再スロー
        return yield* Effect.failCause(cause);
      })
    )
  );
```

### 4.2 Defectの適切な処理

```typescript
// ✅ Defectを含む包括的エラーハンドリング
const robustOperation = <A>(effect: Effect.Effect<A, GameError>) =>
  effect.pipe(
    Effect.sandbox, // Defectも含めてCauseとして扱う
    Effect.catchAll((cause) =>
      Effect.gen(function* () {
        // ✅ Causeの詳細分析
        const failures = Cause.failures(cause);
        const defects = Cause.defects(cause);
        const interruptions = Cause.interruptions(cause);

        if (failures.length > 0) {
          yield* Effect.log(`アプリケーションエラー数: ${failures.length}`);
          for (const failure of failures) {
            yield* handleKnownError(failure);
          }
        }

        if (defects.length > 0) {
          yield* Effect.log(`Defect数: ${defects.length}`);
          for (const defect of defects) {
            yield* Effect.log(`Defect詳細: ${String(defect)}`);
            yield* reportDefect(defect); // 外部監視システムに報告
          }
        }

        if (interruptions.length > 0) {
          yield* Effect.log(`中断数: ${interruptions.length}`);
          // 中断は通常正常な動作なので警告レベル
        }

        // ✅ 安全なフォールバック値を返す
        return yield* getDefaultValue();
      })
    )
  );

// ✅ Defect監視とレポート
const reportDefect = (defect: unknown) =>
  Effect.gen(function* () {
    const errorReport = {
      type: "defect",
      message: String(defect),
      stack: defect instanceof Error ? defect.stack : undefined,
      timestamp: new Date().toISOString(),
      context: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage()
      }
    };

    yield* Effect.log(`Defectレポート: ${JSON.stringify(errorReport, null, 2)}`);

    // 外部監視サービスへの送信
    yield* sendToMonitoringService(errorReport);
  });
```

## 5. エラー境界とフォールバック

### 5.1 階層的エラー境界

```typescript
// ✅ 階層的エラー境界の実装
const createErrorBoundary = <A, E>(
  effect: Effect.Effect<A, E>,
  boundaries: {
    level1?: (error: E) => Effect.Effect<A, never>;
    level2?: (error: E) => Effect.Effect<A, never>;
    final: (error: E) => Effect.Effect<A, never>;
  }
) =>
  effect.pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.log(`Level 1 エラー境界でエラーをキャッチ: ${JSON.stringify(error)}`);

        if (boundaries.level1) {
          try {
            return yield* boundaries.level1(error);
          } catch (level1Error) {
            yield* Effect.log(`Level 1 回復失敗: ${String(level1Error)}`);
          }
        }

        if (boundaries.level2) {
          try {
            yield* Effect.log("Level 2 エラー境界を試行");
            return yield* boundaries.level2(error);
          } catch (level2Error) {
            yield* Effect.log(`Level 2 回復失敗: ${String(level2Error)}`);
          }
        }

        yield* Effect.log("最終エラー境界を実行");
        return yield* boundaries.final(error);
      })
    )
  );

// ✅ ゲーム固有のエラー境界
const gameErrorBoundary = (effect: Effect.Effect<GameState, GameError>) =>
  createErrorBoundary(effect, {
    level1: (error) =>
      Match.value(error).pipe(
        Match.when({ _tag: "NetworkError" }, () => loadCachedGameState()),
        Match.when({ _tag: "ChunkNotLoadedError" }, () => generateEmptyChunk()),
        Match.orElse(() => Effect.fail(error))
      ),

    level2: (error) =>
      Effect.gen(function* () {
        yield* Effect.log("セーフモードでゲーム状態を復元");
        return yield* loadSafeGameState();
      }),

    final: () =>
      Effect.gen(function* () {
        yield* Effect.log("新しいゲーム状態を作成");
        return yield* createNewGameState();
      })
  });
```

### 5.2 タイムアウトとフォールバック

```typescript
// ✅ タイムアウト付きフォールバック戦略
const withTimeoutAndFallback = <A, E>(
  primary: Effect.Effect<A, E>,
  fallback: Effect.Effect<A, never>,
  timeout: Duration.Duration
) =>
  primary.pipe(
    Effect.timeout(timeout),
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.log(`プライマリ処理がタイムアウト: ${String(error)}`);
        yield* Effect.log("フォールバック処理を実行");
        return yield* fallback;
      })
    )
  );

// ✅ 段階的フォールバック
const cascadingFallback = <A>(
  attempts: ReadonlyArray<Effect.Effect<A, unknown>>
): Effect.Effect<A, Error> =>
  Effect.gen(function* () {
    if (attempts.length === 0) {
      return yield* Effect.fail(new Error("フォールバック試行がありません"));
    }

    const [first, ...rest] = attempts;

    try {
      return yield* first;
    } catch (error) {
      yield* Effect.log(`試行失敗、次のフォールバックを実行: ${String(error)}`);

      if (rest.length > 0) {
        return yield* cascadingFallback(rest);
      }

      return yield* Effect.fail(new Error("すべてのフォールバックが失敗"));
    }
  });

// ✅ 使用例: データ取得の多段フォールバック
const loadPlayerData = (playerId: PlayerId) =>
  cascadingFallback([
    // 1. ライブデータベースから取得
    loadPlayerFromDatabase(playerId).pipe(
      Effect.timeout("2 seconds")
    ),

    // 2. キャッシュから取得
    loadPlayerFromCache(playerId).pipe(
      Effect.timeout("500 millis")
    ),

    // 3. ローカルストレージから取得
    loadPlayerFromLocalStorage(playerId),

    // 4. デフォルトプレイヤーを作成
    createDefaultPlayer(playerId)
  ]);
```

## 6. 実践的エラーパターン

### 6.1 ユーザー入力検証

```typescript
// ✅ 包括的な入力検証エラー
const UserInputError = Schema.Struct({
  _tag: Schema.Literal("UserInputError"),
  field: Schema.String,
  value: Schema.Unknown,
  violations: Schema.Array(Schema.Struct({
    rule: Schema.String,
    message: Schema.String,
    severity: Schema.Union(
      Schema.Literal("error"),
      Schema.Literal("warning"),
      Schema.Literal("info")
    )
  }))
});
type UserInputError = Schema.Schema.Type<typeof UserInputError>;

// ✅ バリデーションチェーンの実装
const validatePlayerMovement = (input: unknown): Effect.Effect<MovementCommand, UserInputError> =>
  Effect.gen(function* () {
    const violations: Array<{ rule: string; message: string; severity: "error" | "warning" | "info" }> = [];

    // ✅ 基本的な型チェック
    if (typeof input !== "object" || input === null) {
      violations.push({
        rule: "type_check",
        message: "入力はオブジェクトである必要があります",
        severity: "error"
      });

      return yield* Effect.fail({
        _tag: "UserInputError",
        field: "input",
        value: input,
        violations
      });
    }

    const inputObj = input as Record<string, unknown>;

    // ✅ 必須フィールドチェック
    if (!inputObj.playerId) {
      violations.push({
        rule: "required",
        message: "playerId は必須です",
        severity: "error"
      });
    }

    if (!inputObj.targetPosition) {
      violations.push({
        rule: "required",
        message: "targetPosition は必須です",
        severity: "error"
      });
    }

    // ✅ エラーが既にある場合は早期リターン
    if (violations.some(v => v.severity === "error")) {
      return yield* Effect.fail({
        _tag: "UserInputError",
        field: "validation",
        value: input,
        violations
      });
    }

    // ✅ Schemaによる詳細検証
    const validated = yield* Schema.decodeUnknown(MovementCommandSchema)(input).pipe(
      Effect.mapError((parseError) => ({
        _tag: "UserInputError" as const,
        field: "schema",
        value: input,
        violations: [{
          rule: "schema_validation",
          message: `Schema検証エラー: ${parseError.message}`,
          severity: "error" as const
        }]
      }))
    );

    return validated;
  });
```

### 6.2 外部API統合エラー

```typescript
// ✅ 外部API用のエラー型
const ExternalApiError = Schema.Struct({
  _tag: Schema.Literal("ExternalApiError"),
  service: Schema.String,
  endpoint: Schema.String,
  httpStatus: Schema.Number.pipe(Schema.int()),
  responseBody: Schema.optional(Schema.Unknown),
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Number
});
type ExternalApiError = Schema.Schema.Type<typeof ExternalApiError>;

// ✅ 堅牢な外部API呼び出し
const callExternalApi = <A>(
  service: string,
  endpoint: string,
  requestData: unknown
): Effect.Effect<A, ExternalApiError | NetworkError> =>
  Effect.gen(function* () {
    const requestId = crypto.randomUUID();

    yield* Effect.log(`外部API呼び出し開始: ${service}/${endpoint}`, { requestId });

    const response = yield* httpClient.request({
      url: endpoint,
      method: "POST",
      body: requestData,
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId
      }
    }).pipe(
      Effect.timeout("30 seconds"),
      Effect.retry(
        Schedule.exponential("1 second").pipe(
          Schedule.compose(Schedule.recurs(3)),
          Schedule.whileInput((error: any) => {
            // 一時的なエラーのみリトライ
            return error.status >= 500 || error.status === 429;
          })
        )
      ),
      Effect.mapError((httpError) => {
        if (httpError._tag === "TimeoutError") {
          return createNetworkError(
            `${service} APIがタイムアウトしました`,
            408,
            0,
            requestId
          );
        }

        return {
          _tag: "ExternalApiError" as const,
          service,
          endpoint,
          httpStatus: httpError.status ?? 0,
          responseBody: httpError.body,
          requestId,
          timestamp: Date.now()
        };
      })
    );

    // ✅ レスポンス検証
    if (response.status >= 400) {
      return yield* Effect.fail({
        _tag: "ExternalApiError" as const,
        service,
        endpoint,
        httpStatus: response.status,
        responseBody: response.body,
        requestId,
        timestamp: Date.now()
      });
    }

    yield* Effect.log(`外部API呼び出し成功: ${service}/${endpoint}`, {
      requestId,
      status: response.status
    });

    return response.body as A;
  });
```

## 7. エラー監視とメトリクス

### 7.1 エラーメトリクス収集

```typescript
import { Metric, MetricKeyType } from "effect";

// ✅ エラーメトリクスの定義
const errorMetrics = {
  errorCount: Metric.counter("error_count", MetricKeyType.Counter()),
  errorRate: Metric.gauge("error_rate", MetricKeyType.Gauge()),
  errorLatency: Metric.histogram("error_latency", MetricKeyType.Histogram({
    boundaries: [10, 50, 100, 500, 1000, 5000]
  }))
};

// ✅ エラー監視付きの処理
const withErrorMonitoring = <A, E>(
  operation: string,
  effect: Effect.Effect<A, E>
) =>
  Effect.gen(function* () {
    const startTime = Date.now();

    try {
      const result = yield* effect;

      // ✅ 成功メトリクス
      const duration = Date.now() - startTime;
      yield* Metric.increment(errorMetrics.errorCount, 0); // 成功カウント
      yield* Metric.set(errorMetrics.errorRate, 0);

      return result;
    } catch (error) {
      // ✅ エラーメトリクス
      const duration = Date.now() - startTime;
      yield* Metric.increment(errorMetrics.errorCount, 1);
      yield* Metric.record(errorMetrics.errorLatency, duration);

      // ✅ エラータイプ別の集計
      const errorType = (error as any)?._tag ?? "unknown";
      yield* Metric.incrementBy(
        Metric.counter(`error_by_type_${errorType}`, MetricKeyType.Counter()),
        1
      );

      yield* Effect.log(`操作エラー: ${operation}`, {
        error: String(error),
        duration,
        errorType
      });

      return yield* Effect.fail(error);
    }
  });
```

### 7.2 構造化ログとアラート

```typescript
// ✅ 構造化エラーログ
const logError = <E>(
  context: string,
  error: E,
  metadata: Record<string, unknown> = {}
) =>
  Effect.gen(function* () {
    const errorLog = {
      level: "error",
      context,
      timestamp: new Date().toISOString(),
      error: {
        type: (error as any)?._tag ?? typeof error,
        message: String(error),
        details: error
      },
      metadata,
      correlation: {
        traceId: yield* getTraceId(),
        requestId: yield* getRequestId()
      }
    };

    yield* Effect.log(JSON.stringify(errorLog));

    // ✅ 重要なエラーのアラート送信
    const shouldAlert = (error as any)?._tag === "SystemError" ||
                       (error as any)?._tag === "DataCorruptionError";

    if (shouldAlert) {
      yield* sendAlert(errorLog);
    }
  });

// ✅ エラー処理とログの組み合わせ
const processWithLogging = <A, E>(
  operation: string,
  effect: Effect.Effect<A, E>
) =>
  effect.pipe(
    Effect.tapError((error) => logError(operation, error)),
    Effect.tap(() => Effect.log(`操作成功: ${operation}`))
  );
```

## まとめ

このドキュメントで解説したエラーハンドリングパターンにより、以下が実現されます：

### 🎯 **主要な利点**

1. **型安全性**: Schema.TaggedErrorによる完全な型安全性
2. **回復力**: 多層的なフォールバック戦略
3. **観測可能性**: 包括的なエラー監視とメトリクス
4. **保守性**: 構造化されたエラー分類と処理

### 🔧 **実装パターン**

- **Schema.Struct** によるエラー型定義
- **Effect.catchTag/catchTags** による型安全なエラー処理
- **Schedule** による包括的なリトライ戦略
- **Cause** による詳細なエラー分析
- **回路ブレーカー** による障害波及防止

### 📊 **品質管理**

- 構造化ログによる詳細なエラー追跡
- メトリクス収集による継続的な改善
- 階層的エラー境界による堅牢性
- 段階的フォールバックによる可用性確保

これらのパターンを活用することで、予期しない障害に対しても適切に回復し、プレイヤーに安定したゲーム体験を提供できる信頼性の高いMinecraftクローンを実現できます。