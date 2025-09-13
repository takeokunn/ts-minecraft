---
title: "開発規約 - Effect-TS 3.17+準拠コーディングガイド"
description: "Effect-TS 3.17+最新パターンによるSchema-first開発、純粋関数型プログラミング、完全型安全性を実現するための包括的コーディング規約とベストプラクティス。"
category: "guide"
difficulty: "intermediate"
tags: ["development-conventions", "effect-ts", "schema", "functional-programming", "coding-standards", "best-practices", "typescript"]
prerequisites: ["basic-typescript", "effect-ts-fundamentals"]
estimated_reading_time: "25分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# 開発規約

このドキュメントでは、Effect-TS 3.17+の最新パターンを活用したts-minecraftプロジェクトの開発規約について説明します。Schema-first開発、純粋関数型プログラミング、完全な型安全性を実現するための規約を定めています。

## 基本設計思想

### Schema-first開発アプローチ

すべてのデータ構造はSchema.Structで定義し、型安全なバリデーションと変換を実現します：

```typescript
import { Schema, Effect } from "effect"

// ✅ Schema-first開発パターン（Effect-TS 3.17+）
const PlayerId = Schema.String.pipe(Schema.brand("PlayerId"))
type PlayerId = Schema.Schema.Type<typeof PlayerId>

const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})
type Position = Schema.Schema.Type<typeof Position>

const Health = Schema.Number.pipe(
  Schema.clamp(0, 100),
  Schema.brand("Health")
)
type Health = Schema.Schema.Type<typeof Health>

const Player = Schema.Struct({
  id: PlayerId,
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(50)
  ),
  position: Position,
  health: Health,
  level: Schema.Number.pipe(
    Schema.int(),
    Schema.positive()
  )
})
type Player = Schema.Schema.Type<typeof Player>

// ❌ 絶対に避けるべきパターン
// - Data.Class, Data.struct の使用
// - interface のみでの型定義（Schemaなし）
// - class キーワードの使用
```

### 早期リターンパターン

バリデーション段階での即座な失敗処理を必須とします：

```typescript
// ✅ 早期リターンによる効率的な処理
const validateAndProcessPlayer = (input: unknown): Effect.Effect<ProcessedPlayer, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: 基本バリデーション
    if (!input || typeof input !== "object") {
      return yield* Effect.fail({
        _tag: "ValidationError" as const,
        message: "Input must be an object",
        field: "root"
      })
    }

    // 早期リターン: Schema検証（最新API使用）
    const player = yield* Schema.decodeUnknown(PlayerSchema)(input).pipe(
      Effect.mapError(error => ({
        _tag: "ValidationError" as const,
        message: "Schema validation failed",
        field: error.path?.toString() || "unknown"
      }))
    )

    // 早期リターン: ビジネスロジック検証
    if (player.health <= 0) {
      return yield* Effect.fail({
        _tag: "ValidationError" as const,
        message: "Player must be alive",
        field: "health"
      })
    }

    return yield* processValidPlayer(player)
  })
```

### 不変性の維持

すべてのデータ構造をimmutableとして扱います：

```typescript
// ❌ ミューテーション
const player = { position: { x: 0, y: 0, z: 0 } }
player.position.x = 10 // ミューテーション

// ✅ 不変なアップデート
const updatePlayerPosition = (player: Player, newX: number): Player => ({
  ...player,
  position: { ...player.position, x: newX }
})
```

### クラス不使用ポリシー

`class` 構文と `this` キーワードは使用禁止です：

```typescript
// ❌ class構文の使用
class EntityManager {
  private entities: Entity[] = []
  
  addEntity(entity: Entity) {
    this.entities.push(entity) // thisとミューテーション
  }
}

// ✅ 関数型アプローチ
interface EntityManager {
  readonly entities: ReadonlyArray<Entity>
}

const addEntity = (manager: EntityManager, entity: Entity): EntityManager => ({
  ...manager,
  entities: [...manager.entities, entity]
})
```

## TypeScript厳格ルール

### 型安全性の維持

```typescript
// ❌ any、unknown、asの不適切な使用
const data: any = getUserData()
const result = data.someProperty as string

// ✅ Schemaを使った型安全なアプローチ
import { Schema } from "effect"

const UserDataSchema = Schema.Struct({
  name: Schema.String,
  age: Schema.Number,
})

const parseUserData = (input: unknown) =>
  Schema.decodeUnknown(UserDataSchema)(input)
```

### 厳格な型チェック設定

tsconfig.jsonの重要な設定：

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

## 命名規則

### ファイルとディレクトリ

```
// ✅ kebab-case
block-interaction.ts
player-movement-system.ts
terrain-generation.service.ts

// ❌ その他のケース
BlockInteraction.ts
player_movement_system.ts
terrainGenerationService.ts
```

### 変数と関数

```typescript
// ✅ camelCase
const playerPosition = { x: 0, y: 0, z: 0 }
const updateChunkData = (chunk: Chunk) => { /* ... */ }
const gameSystemFunction: GameSystemFunction = /* ... */
```

### 型とSchema

```typescript
// ✅ PascalCase
interface Position {
  readonly x: number
  readonly y: number
  readonly z: number
}

const PositionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})
```

### 定数

```typescript
// ✅ UPPER_SNAKE_CASE
const MAX_CHUNK_HEIGHT = 256
const DEFAULT_WORLD_SEED = "default-seed"
const PHYSICS_CONSTANTS = {
  GRAVITY: 9.8,
  AIR_RESISTANCE: 0.99,
} as const
```

### Effect Layer

```typescript
// ✅ PascalCase + "Live" 接尾辞
const RendererLive = Layer.succeed(Renderer, rendererImplementation)
const PhysicsEngineLive = Layer.effect(PhysicsEngine, createPhysicsEngine)
const DatabaseLive = Layer.scoped(Database, createDatabase)
```

## インポートパス規則

### 絶対パス vs 相対パス

```typescript
// ✅ プロジェクト内の絶対パス（@/エイリアス使用）
import { Entity } from "@domain/entities"
import { ChunkRepository } from "@infrastructure/repositories"
import { GameConfig } from "@config/game-config"

// ✅ 同一ディレクトリ内の相対パス
import { helperFunction } from "./utils"
import { LocalComponent } from "../components/local-component"

// ❌ 長い相対パス
import { Entity } from "../../../domain/entities"
```

### インポート順序

```typescript
// 1. Node.jsビルトイン
import path from "node:path"

// 2. サードパーティライブラリ
import { Effect, pipe } from "effect"
import { Schema } from "@effect/schema"
import * as THREE from "three"

// 3. プロジェクト内（@/エイリアス）
import { Entity } from "@domain/entities"
import { ChunkService } from "@application/services"

// 4. 相対パス
import { LocalUtils } from "./utils"
```

## Effect-TSパターン

### 基本的なEffect使用パターン

```typescript
import { Effect, pipe } from "effect"

// Effectの組み合わせ
const complexOperation = Effect.gen(function* () {
  const config = yield* getConfig
  const data = yield* fetchData(config.apiUrl)
  const processed = yield* processData(data)
  yield* saveResult(processed)
  return processed
})

// pipeを使った関数型スタイル
const pipelineOperation = pipe(
  getInitialData,
  Effect.flatMap(validateData),
  Effect.flatMap(transformData),
  Effect.tap(logResult),
)
```

### エラーハンドリング - Effect-TS 3.x最新パターン

```typescript
// Schema.TaggedErrorによる詳細化されたエラーハンドリング
export namespace ValidationSystem {
  export class ValidationError extends Schema.TaggedError("ValidationSystem.ValidationError")<{
    readonly field: string
    readonly rule: string
    readonly actualValue: unknown
    readonly expectedValue?: unknown
    readonly message: string
    readonly context: string
    readonly suggestedFix?: string
    readonly timestamp: number
  }> {}

  export class SchemaParseError extends Schema.TaggedError("ValidationSystem.SchemaParseError")<{
    readonly schemaName: string
    readonly inputType: string
    readonly parseErrors: ReadonlyArray<{
      readonly path: string
      readonly message: string
      readonly code: string
    }>
    readonly rawInput?: unknown
    readonly timestamp: number
  }> {}
}

export namespace NetworkSystem {
  export class NetworkTimeoutError extends Schema.TaggedError("NetworkSystem.NetworkTimeoutError")<{
    readonly url: string
    readonly method: string
    readonly timeoutMs: number
    readonly elapsedMs: number
    readonly retryCount: number
    readonly lastError?: unknown
    readonly networkCondition: string
    readonly timestamp: number
  }> {}

  export class NetworkConnectionError extends Schema.TaggedError("NetworkSystem.NetworkConnectionError")<{
    readonly url: string
    readonly method: string
    readonly statusCode?: number
    readonly statusText?: string
    readonly responseHeaders?: Record<string, string>
    readonly cause: unknown
    readonly isRetryable: boolean
    readonly timestamp: number
  }> {}

  export class NetworkRateLimitError extends Schema.TaggedError("NetworkSystem.NetworkRateLimitError")<{
    readonly url: string
    readonly rateLimitType: string
    readonly requestsPerSecond: number
    readonly maxAllowed: number
    readonly resetTimeMs: number
    readonly retryAfterMs?: number
    readonly timestamp: number
  }> {}
}

export namespace ProcessingSystem {
  export class ProcessingTimeoutError extends Schema.TaggedError("ProcessingSystem.ProcessingTimeoutError")<{
    readonly operation: string
    readonly inputData: unknown
    readonly processingStage: string
    readonly timeoutMs: number
    readonly elapsedMs: number
    readonly partialResult?: unknown
    readonly canResume: boolean
    readonly timestamp: number
  }> {}

  export class ResourceExhaustedError extends Schema.TaggedError("ProcessingSystem.ResourceExhaustedError")<{
    readonly resourceType: string
    readonly requested: number
    readonly available: number
    readonly maxCapacity: number
    readonly utilizationPercent: number
    readonly suggestedAction: string
    readonly timestamp: number
  }> {}

  export class ProcessingError extends Schema.TaggedError("ProcessingSystem.ProcessingError")<{
    readonly operation: string
    readonly inputData: unknown
    readonly processingStage: string
    readonly reason: string
    readonly originalError?: unknown
    readonly recoveryPossible: boolean
    readonly suggestedRetry?: {
      readonly delayMs: number
      readonly maxRetries: number
      readonly backoffMultiplier: number
    }
    readonly timestamp: number
  }> {}
}

export namespace DatabaseSystem {
  export class DatabaseConnectionError extends Schema.TaggedError("DatabaseSystem.DatabaseConnectionError")<{
    readonly connectionString: string
    readonly database: string
    readonly timeout: number
    readonly retryCount: number
    readonly lastError?: unknown
    readonly poolStatus: {
      readonly active: number
      readonly idle: number
      readonly max: number
    }
    readonly timestamp: number
  }> {}

  export class DatabaseQueryError extends Schema.TaggedError("DatabaseSystem.DatabaseQueryError")<{
    readonly query: string
    readonly parameters?: ReadonlyArray<unknown>
    readonly executionTimeMs: number
    readonly affectedRows?: number
    readonly sqlState?: string
    readonly errorCode?: number
    readonly isRetryable: boolean
    readonly timestamp: number
  }> {}

  export class DatabaseIntegrityError extends Schema.TaggedError("DatabaseSystem.DatabaseIntegrityError")<{
    readonly table: string
    readonly constraint: string
    readonly violationType: string
    readonly conflictingData: unknown
    readonly suggestedResolution: string
    readonly isAutoFixable: boolean
    readonly timestamp: number
  }> {}
}

// Union型でのエラー統合管理
export type ValidationError =
  | ValidationSystem.ValidationError
  | ValidationSystem.SchemaParseError

export type NetworkError =
  | NetworkSystem.NetworkTimeoutError
  | NetworkSystem.NetworkConnectionError
  | NetworkSystem.NetworkRateLimitError

export type ProcessingError =
  | ProcessingSystem.ProcessingTimeoutError
  | ProcessingSystem.ResourceExhaustedError
  | ProcessingSystem.ProcessingError

export type DatabaseError =
  | DatabaseSystem.DatabaseConnectionError
  | DatabaseSystem.DatabaseQueryError
  | DatabaseSystem.DatabaseIntegrityError

export type SystemError =
  | ValidationError
  | NetworkError
  | ProcessingError
  | DatabaseError

// 詳細化されたエラーハンドリングの実装例
const safeDataProcessingOperation = Effect.gen(function* () {
  // ネットワークエラーの詳細ハンドリング
  const data = yield* fetchData.pipe(
    Effect.catchTags({
      "NetworkSystem.NetworkTimeoutError": (error) => {
        // タイムアウトの場合はリトライしてデフォルトデータを使用
        return Effect.gen(function* () {
          yield* Effect.logWarning(`Network timeout after ${error.elapsedMs}ms for ${error.url}, using cached data`)
          return yield* getCachedData().pipe(
            Effect.orElse(() => Effect.succeed(getDefaultData()))
          )
        })
      },
      "NetworkSystem.NetworkConnectionError": (error) => {
        // 接続エラーの場合はリトライ可能性をチェック
        if (error.isRetryable) {
          return Effect.gen(function* () {
            yield* Effect.sleep("2 seconds")
            return yield* fetchData // リトライ
          })
        }
        return Effect.fail(new ProcessingSystem.ProcessingError({
          operation: "fetchData",
          inputData: error.url,
          processingStage: "network_request",
          reason: `Network connection failed: ${error.statusCode} ${error.statusText}`,
          originalError: error,
          recoveryPossible: false,
          timestamp: Date.now()
        }))
      },
      "NetworkSystem.NetworkRateLimitError": (error) => {
        // Rate limitの場合は指定時間待機
        return Effect.gen(function* () {
          const waitTime = error.retryAfterMs || 60000
          yield* Effect.logInfo(`Rate limited, waiting ${waitTime}ms before retry`)
          yield* Effect.sleep(`${waitTime} millis`)
          return yield* fetchData
        })
      }
    })
  )

  // バリデーションエラーの詳細ハンドリング
  const validated = yield* validateData(data).pipe(
    Effect.catchTags({
      "ValidationSystem.ValidationError": (error) => {
        yield* Effect.logError(`Validation failed for field '${error.field}': ${error.message}`)

        // 推奨修正がある場合は適用を試みる
        if (error.suggestedFix) {
          yield* Effect.logInfo(`Attempting suggested fix: ${error.suggestedFix}`)
          return yield* applySuggestedFix(data, error.suggestedFix).pipe(
            Effect.flatMap(fixedData => validateData(fixedData)),
            Effect.catchAll(() => Effect.fail(new ProcessingSystem.ProcessingError({
              operation: "validateData",
              inputData: data,
              processingStage: "validation_with_fix",
              reason: `Validation failed even after applying suggested fix: ${error.message}`,
              originalError: error,
              recoveryPossible: false,
              timestamp: Date.now()
            })))
          )
        }

        return Effect.fail(new ProcessingSystem.ProcessingError({
          operation: "validateData",
          inputData: data,
          processingStage: "validation",
          reason: `Data validation failed: ${error.message}`,
          originalError: error,
          recoveryPossible: error.suggestedFix !== undefined,
          suggestedRetry: error.suggestedFix ? {
            delayMs: 1000,
            maxRetries: 3,
            backoffMultiplier: 2
          } : undefined,
          timestamp: Date.now()
        }))
      },
      "ValidationSystem.SchemaParseError": (error) => {
        const errorSummary = error.parseErrors
          .map(e => `${e.path}: ${e.message}`)
          .join(", ")

        yield* Effect.logError(`Schema parsing failed for ${error.schemaName}: ${errorSummary}`)

        return Effect.fail(new ProcessingSystem.ProcessingError({
          operation: "validateData",
          inputData: error.rawInput,
          processingStage: "schema_parsing",
          reason: `Schema parsing failed for ${error.schemaName}: ${errorSummary}`,
          originalError: error,
          recoveryPossible: false,
          timestamp: Date.now()
        }))
      }
    })
  )

  // データベースエラーの詳細ハンドリング
  const result = yield* saveToDatabase(validated).pipe(
    Effect.catchTags({
      "DatabaseSystem.DatabaseConnectionError": (error) => {
        yield* Effect.logError(`Database connection failed: ${error.database} (retries: ${error.retryCount})`)

        // コネクションプールの状態をログ出力
        yield* Effect.logDebug(`Connection pool status: active=${error.poolStatus.active}, idle=${error.poolStatus.idle}, max=${error.poolStatus.max}`)

        return Effect.fail(new ProcessingSystem.ProcessingError({
          operation: "saveToDatabase",
          inputData: validated,
          processingStage: "database_connection",
          reason: `Database connection failed after ${error.retryCount} retries`,
          originalError: error,
          recoveryPossible: true,
          suggestedRetry: {
            delayMs: 5000,
            maxRetries: 5,
            backoffMultiplier: 1.5
          },
          timestamp: Date.now()
        }))
      },
      "DatabaseSystem.DatabaseQueryError": (error) => {
        yield* Effect.logError(`Query execution failed (${error.executionTimeMs}ms): ${error.query}`)

        if (error.isRetryable) {
          yield* Effect.sleep("1 second")
          return yield* saveToDatabase(validated) // リトライ
        }

        return Effect.fail(new ProcessingSystem.ProcessingError({
          operation: "saveToDatabase",
          inputData: validated,
          processingStage: "query_execution",
          reason: `Database query failed: SQL State ${error.sqlState}, Error Code ${error.errorCode}`,
          originalError: error,
          recoveryPossible: false,
          timestamp: Date.now()
        }))
      },
      "DatabaseSystem.DatabaseIntegrityError": (error) => {
        yield* Effect.logWarning(`Integrity constraint violation: ${error.constraint} on table ${error.table}`)

        if (error.isAutoFixable) {
          yield* Effect.logInfo(`Attempting auto-fix: ${error.suggestedResolution}`)
          return yield* applyIntegrityFix(validated, error)
        }

        return Effect.fail(new ProcessingSystem.ProcessingError({
          operation: "saveToDatabase",
          inputData: validated,
          processingStage: "integrity_check",
          reason: `Database integrity constraint violation: ${error.violationType}`,
          originalError: error,
          recoveryPossible: error.isAutoFixable,
          timestamp: Date.now()
        }))
      }
    })
  )

  return result
})

// エラーファクトリー関数
const createValidationError = (params: {
  readonly field: string
  readonly rule: string
  readonly actualValue: unknown
  readonly expectedValue?: unknown
  readonly message: string
  readonly context: string
  readonly suggestedFix?: string
}) => new ValidationSystem.ValidationError({
  ...params,
  timestamp: Date.now()
})

const createNetworkTimeoutError = (params: {
  readonly url: string
  readonly method: string
  readonly timeoutMs: number
  readonly elapsedMs: number
  readonly retryCount: number
  readonly lastError?: unknown
  readonly networkCondition: string
}) => new NetworkSystem.NetworkTimeoutError({
  ...params,
  timestamp: Date.now()
})
```

### Layer の使用

```typescript
import { Context, Effect, Layer } from "effect"

// サービスの定義には"@app/ServiceName"パターンを使用
interface DatabaseServiceInterface {
  readonly find: (id: string) => Effect.Effect<Entity | null, DatabaseError>
  readonly save: (entity: Entity) => Effect.Effect<void, DatabaseError>
}

const DatabaseService = Context.GenericTag<DatabaseServiceInterface>("@app/DatabaseService")

// Layer の作成 - Effect.gen + makeパターンで実装
const makeDatabaseServiceLive = Effect.gen(function* () {
  const config = yield* ConfigService

  // データベース接続の初期化とヘルスチェック
  yield* Effect.logInfo(`Initializing database connection: ${config.database.host}:${config.database.port}`)

  const connectionHealth = yield* checkDatabaseConnection(config.database).pipe(
    Effect.catchAll((error) => {
      return Effect.fail(new DatabaseSystem.DatabaseConnectionError({
        connectionString: `${config.database.host}:${config.database.port}/${config.database.name}`,
        database: config.database.name,
        timeout: config.database.timeout,
        retryCount: 0,
        lastError: error,
        poolStatus: {
          active: 0,
          idle: 0,
          max: config.database.maxConnections
        },
        timestamp: Date.now()
      }))
    })
  )

  yield* Effect.logInfo(`Database connection established successfully: ${connectionHealth.status}`)

  return DatabaseService.of({
    find: (id) => Effect.gen(function* () {
      // 早期リターン: ID検証
      if (!id || id.trim().length === 0) {
        return yield* Effect.fail(createValidationError({
          field: "id",
          rule: "required_non_empty_string",
          actualValue: id,
          expectedValue: "non-empty string",
          message: "Entity ID must be a non-empty string",
          context: "entity_lookup",
          suggestedFix: "Provide a valid entity ID"
        }))
      }

      // IDフォーマット検証
      const idValidation = validateEntityId(id)
      if (!idValidation.valid) {
        return yield* Effect.fail(createValidationError({
          field: "id",
          rule: "entity_id_format",
          actualValue: id,
          expectedValue: "UUID or valid entity identifier",
          message: `Invalid entity ID format: ${idValidation.error}`,
          context: "entity_lookup",
          suggestedFix: "Use a properly formatted entity ID"
        }))
      }

      // エンティティ検索の実装
      return yield* findEntityById(id).pipe(
        Effect.catchTags({
          "DatabaseSystem.DatabaseQueryError": (error) => {
            if (error.sqlState === "42S02") { // Table doesn't exist
              return Effect.fail(new ProcessingSystem.ProcessingError({
                operation: "findEntityById",
                inputData: id,
                processingStage: "table_access",
                reason: "Entity table does not exist",
                originalError: error,
                recoveryPossible: false,
                timestamp: Date.now()
              }))
            }
            return Effect.fail(error)
          },
          "DatabaseSystem.DatabaseConnectionError": (error) => {
            yield* Effect.logWarning(`Database connection lost during entity lookup for ID: ${id}`)

            // キャッシュからのフォールバックを試行
            return yield* getCachedEntity(id).pipe(
              Effect.orElse(() => Effect.fail(new ProcessingSystem.ProcessingError({
                operation: "findEntityById",
                inputData: id,
                processingStage: "database_fallback",
                reason: "Failed to find entity in database and cache",
                originalError: error,
                recoveryPossible: true,
                suggestedRetry: {
                  delayMs: 1000,
                  maxRetries: 3,
                  backoffMultiplier: 1.5
                },
                timestamp: Date.now()
              })))
            )
          }
        })
      )
    }),

    save: (entity) => Effect.gen(function* () {
      // 早期リターン: エンティティ検証
      const validEntity = yield* validateEntity(entity).pipe(
        Effect.catchTag("ValidationSystem.ValidationError", (error) => {
          return Effect.fail(new DatabaseSystem.DatabaseIntegrityError({
            table: "entities",
            constraint: "entity_validation",
            violationType: "schema_validation",
            conflictingData: entity,
            suggestedResolution: error.suggestedFix || "Fix validation errors",
            isAutoFixable: error.suggestedFix !== undefined,
            timestamp: Date.now()
          }))
        })
      )

      return yield* persistEntity(validEntity).pipe(
        Effect.catchTags({
          "DatabaseSystem.DatabaseConnectionError": (error) => {
            yield* Effect.logError(`Failed to persist entity due to connection error: ${error.database}`)
            return Effect.fail(new ProcessingSystem.ProcessingError({
              operation: "persistEntity",
              inputData: validEntity,
              processingStage: "database_persistence",
              reason: "Database connection lost during entity persistence",
              originalError: error,
              recoveryPossible: true,
              suggestedRetry: {
                delayMs: 2000,
                maxRetries: 3,
                backoffMultiplier: 2
              },
              timestamp: Date.now()
            }))
          },
          "DatabaseSystem.DatabaseIntegrityError": (error) => {
            if (error.constraint === "unique_constraint") {
              // 一意制約違反の場合は更新として処理
              yield* Effect.logWarning(`Entity already exists, attempting update instead`)
              return yield* updateEntity(validEntity)
            }
            return Effect.fail(error)
          }
        })
      )
    })
  })
})

const DatabaseServiceLive = Layer.effect(DatabaseService, makeDatabaseServiceLive)

// ヘルパー関数
const validateEntityId = (id: string): { valid: boolean; error?: string } => {
  // UUIDフォーマット検証
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (uuidRegex.test(id)) {
    return { valid: true }
  }

  // カスタムIDフォーマット検証 (entity_123 など)
  const customIdRegex = /^[a-zA-Z]+_[0-9]+$/
  if (customIdRegex.test(id)) {
    return { valid: true }
  }

  return {
    valid: false,
    error: "ID must be either a UUID or match pattern 'prefix_number'"
  }
}

const checkDatabaseConnection = (config: DatabaseConfig): Effect.Effect<{ status: string }, unknown> =>
  Effect.gen(function* () {
    // データベース接続チョックの実装
    yield* Effect.sleep("100 millis") // シミュレーティッドチェック
    return { status: "healthy" }
  })

const getCachedEntity = (id: string): Effect.Effect<Entity | null, never> =>
  Effect.gen(function* () {
    // キャッシュからエンティティを取得する実装
    yield* Effect.logDebug(`Attempting to retrieve entity ${id} from cache`)
    return null // シンプルな実装
  })

const updateEntity = (entity: Entity): Effect.Effect<void, DatabaseError> =>
  Effect.gen(function* () {
    // エンティティ更新の実装
    yield* Effect.logInfo(`Updating entity: ${entity.id}`)
    // 実際の更新処理...
  })

const applySuggestedFix = (data: unknown, fix: string): Effect.Effect<unknown, never> =>
  Effect.gen(function* () {
    yield* Effect.logInfo(`Applying suggested fix: ${fix}`)
    // 修正処理の実装...
    return data
  })

const applyIntegrityFix = (data: unknown, error: DatabaseSystem.DatabaseIntegrityError): Effect.Effect<unknown, ProcessingError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo(`Applying integrity fix for ${error.constraint}: ${error.suggestedResolution}`)
    // 整合性制約違反の修正処理...
    return data
  })

// ヘルパータイプ
interface DatabaseConfig {
  readonly host: string
  readonly port: number
  readonly name: string
  readonly timeout: number
  readonly maxConnections: number
}

interface Entity {
  readonly id: string
  readonly [key: string]: unknown
}

// サービスの使用
const useDatabase = Effect.gen(function* () {
  const db = yield* DatabaseService
  const entity = yield* db.find("some-id")
  return entity
})
```

## テスト作成ガイドライン

### 基本的なテスト構造

```typescript
import { describe, it, expect } from "vitest"
import { Effect } from "effect"

describe("EntityService", () => {
  it("should create entity successfully", async () => {
    const program = Effect.gen(function* () {
      const service = yield* EntityService
      const entity = yield* service.create({ name: "test" })
      return entity
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(EntityServiceLive))
    )

    expect(result.name).toBe("test")
  })
})
```

### Property-Based Testing

```typescript
import { Gen } from "@effect/test"

const entityGen = Gen.struct({
  id: Gen.string,
  position: Gen.struct({
    x: Gen.number,
    y: Gen.number, 
    z: Gen.number,
  }),
})

it("entity operations should be idempotent", () =>
  Effect.gen(function* () {
    yield* Effect.forEach(entityGen, (entity) =>
      Effect.gen(function* () {
        const result1 = yield* processEntity(entity)
        const result2 = yield* processEntity(result1)
        expect(result1).toEqual(result2)
      })
    )
  })
)
```

## アーキテクチャ原則

### レイヤー間の依存関係

```
Presentation → Application → Domain
     ↓              ↓
Infrastructure → Domain
```

### 単一責任の原則

```typescript
// ✅ 単一責任を持つサービス
interface ChunkLoadingServiceInterface {
  readonly loadChunk: (coord: ChunkCoordinate) => Effect.Effect<Chunk, ChunkLoadError>
}

const ChunkLoadingService = Context.GenericTag<ChunkLoadingServiceInterface>("@app/ChunkLoadingService")

// ❌ 複数の責任を持つサービス（classは使用禁止）
class GameService { // 責任が広すぎる + class使用
  loadChunk() { /* ... */ }
  updatePhysics() { /* ... */ }
  renderScene() { /* ... */ }
  handleInput() { /* ... */ }
}

// ✅ 複数のサービスに分割
interface PhysicsServiceInterface {
  readonly update: (deltaTime: number) => Effect.Effect<void, PhysicsError>
}

interface RenderServiceInterface {
  readonly render: (scene: Scene) => Effect.Effect<void, RenderError>
}

interface InputServiceInterface {
  readonly handleInput: (input: InputEvent) => Effect.Effect<void, InputError>
}
```

### ECSアーキテクチャでのパフォーマンス

```typescript
// ✅ Structure of Arrays (SoA) でのクエリ
const updatePositions = (world: World) =>
  world.querySoA("Position", "Velocity").forEach(({ position, velocity }) => {
    // ベクトル化された処理が可能
    position.x += velocity.x
    position.y += velocity.y
    position.z += velocity.z
  })

// ❌ Array of Structures (AoS) 
const updatePositionsInefficient = (entities: Entity[]) => {
  entities.forEach(entity => {
    // キャッシュ効率が悪い
    entity.position.x += entity.velocity.x
    entity.position.y += entity.velocity.y
    entity.position.z += entity.velocity.z
  })
}
```

## パフォーマンス考慮事項

### メモリ効率

```typescript
// ✅ 純粋関数による距離計算（プール不要）
const calculateDistance = (a: Position, b: Position): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// ✅ 必要な場合のみオブジェクトプール使用
const createVectorPool = () => Effect.gen(function* () {
  const pool = yield* Queue.bounded<Vector3>(100)

  // プール初期化
  yield* Effect.forEach(
    Array.from({ length: 100 }),
    () => Queue.offer(pool, { x: 0, y: 0, z: 0 })
  )

  return {
    acquire: Queue.take(pool),
    release: (vector: Vector3) => Queue.offer(pool, vector)
  }
})
```

### 非同期処理の最適化

```typescript
// ✅ 並列処理（Effect.all + concurrency オプション使用）
const loadMultipleChunks = (coordinates: ChunkCoordinate[]) =>
  Effect.all(
    coordinates.map(loadChunk),
    { concurrency: "unbounded" }
  )

// ✅ 制限付き並列処理
const loadMultipleChunksLimited = (coordinates: ChunkCoordinate[]) =>
  Effect.all(
    coordinates.map(loadChunk),
    { concurrency: 5 } // 同時実行数を制限
  )

// ❌ 逐次処理
const loadMultipleChunksSequential = (coordinates: ChunkCoordinate[]) =>
  Effect.all(coordinates.map(loadChunk)) // デフォルトは順次実行
```

このガイドに従うことで、一貫性のある高品質なコードを維持できます。