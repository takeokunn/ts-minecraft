# 開発規約

このドキュメントでは、最新のEffect-TSパターン（2024年版）を活用したts-minecraftプロジェクトで使用する開発規約とアーキテクチャパターンについて説明します。Schema-first開発、関数型プログラミング、型安全性を重視した規約を中心に扱います。

## 基本設計思想

### Schema-first開発アプローチ

すべてのデータ構造はSchema.Structから始まり、型安全なバリデーションと変換を行います：

```typescript
import { Schema } from "@effect/schema"
import { Match } from "effect"

// ✅ Schema-first開発パターン
const PlayerSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("PlayerId")),
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(50)),
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  health: Schema.Number.pipe(Schema.clamp(0, 100)),
  level: Schema.Number.pipe(Schema.int(), Schema.positive())
})

type Player = Schema.Schema.Type<typeof PlayerSchema>

// ❌ 避けるべきData.struct使用
const OldPlayer = Data.struct<Player>({
  id: "",
  name: "",
  position: { x: 0, y: 0, z: 0 },
  health: 100,
  level: 1
})
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

    // 早期リターン: Schema検証
    const player = yield* Schema.decodeUnknownEither(PlayerSchema)(input).pipe(
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

// ✅ @effect/schemaを使った型安全なアプローチ
import { Schema } from "@effect/schema"

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

### エラーハンドリング

```typescript
// 型安全なエラーハンドリング
class ValidationError {
  readonly _tag = "ValidationError"
  constructor(readonly message: string) {}
}

class NetworkError {
  readonly _tag = "NetworkError" 
  constructor(readonly cause: unknown) {}
}

const safeOperation = Effect.gen(function* () {
  const data = yield* fetchData.pipe(
    Effect.catchTag("NetworkError", (error) =>
      Effect.succeed(defaultData)
    )
  )
  
  const validated = yield* validateData(data).pipe(
    Effect.catchTag("ValidationError", (error) => 
      Effect.fail(new ProcessingError(error.message))
    )
  )
  
  return validated
})
```

### Layer の使用

```typescript
import { Context, Effect, Layer } from "effect"

// サービスの定義
class DatabaseService extends Context.Tag("DatabaseService")<
  DatabaseService,
  {
    readonly find: (id: string) => Effect.Effect<Entity | null, DatabaseError>
    readonly save: (entity: Entity) => Effect.Effect<void, DatabaseError>
  }
>() {}

// Layer の作成
const DatabaseServiceLive = Layer.succeed(DatabaseService, {
  find: (id) => /* 実装 */,
  save: (entity) => /* 実装 */,
})

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
class ChunkLoadingService extends Context.Tag("ChunkLoadingService")<
  ChunkLoadingService,
  {
    readonly loadChunk: (coord: ChunkCoordinate) => Effect.Effect<Chunk, ChunkLoadError>
  }
>() {}

// ❌ 複数の責任を持つサービス
class GameService { // 責任が広すぎる
  loadChunk() { /* ... */ }
  updatePhysics() { /* ... */ }
  renderScene() { /* ... */ }
  handleInput() { /* ... */ }
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
// ✅ オブジェクトプール使用
const vectorPool = createObjectPool(() => ({ x: 0, y: 0, z: 0 }))

const calculateDistance = (a: Position, b: Position) => {
  const temp = vectorPool.acquire()
  temp.x = a.x - b.x
  temp.y = a.y - b.y
  temp.z = a.z - b.z
  const distance = Math.sqrt(temp.x * temp.x + temp.y * temp.y + temp.z * temp.z)
  vectorPool.release(temp)
  return distance
}
```

### 非同期処理の最適化

```typescript
// ✅ 並列処理
const loadMultipleChunks = (coordinates: ChunkCoordinate[]) =>
  Effect.allPar(coordinates.map(loadChunk))

// ❌ 逐次処理
const loadMultipleChunksSequential = (coordinates: ChunkCoordinate[]) =>
  Effect.all(coordinates.map(loadChunk)) // 順次実行
```

このガイドに従うことで、一貫性のある高品質なコードを維持できます。