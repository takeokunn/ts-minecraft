# Effect-TS型システム完全移行 実行計画書

## 🔗 GitHub Issue
[#213: Effect-TS型システム完全移行 - 全レイヤー一括リファクタリング](https://github.com/takeokunn/ts-minecraft/issues/213)

## 📋 要求概要
TypeScript Minecraft CloneプロジェクトのTypeScript型システムを完全にEffect-TSベースの型システムに移行し、型安全性を最大化する。

## 🔍 現状分析

### 発見された問題パターン

1. **プリミティブ型の直接使用（200箇所以上）**
   - `unknown`: エラーハンドリングで40箇所以上
   - `any`: frameInfoなど残存
   - `number[]`, `string[]`: 配列型の直接使用
   - `Date`: タイムスタンプで使用
   - `object`: 型安全でない汎用オブジェクト

2. **未活用のEffect-TS機能**
   - 100以上のinterfaceがSchema.Struct未使用
   - Brand型の部分的適用（既存：30種類のみ）
   - Option/Either型の使用が限定的
   - ReadonlyArray/HashMapなどイミュータブルコレクション未使用

3. **型検証の不足**
   - ランタイム型検証の欠如
   - 境界での入力検証不足
   - 手動実装の型ガード関数

## 🎯 機能要件

### 1. 全interface（100+）のSchema.Struct化
- 全てのinterfaceをSchema定義に変換
- ランタイム検証の自動生成
- 型推論による静的型の自動導出

### 2. Brand型の全面適用
- 全ドメイン固有の値にBrand型適用
- 新規Brand型の追加（30種類以上）
- コンパイル時の型安全性保証

### 3. 曖昧な型の撲滅
- `unknown`/`any`の完全排除
- プリミティブ配列→ReadonlyArray
- `Date`→`Timestamp` Brand型
- `object`→具体的なSchema定義

### 4. Effect-TS型機能の活用
- Option型でnull/undefined排除
- Either型でエラーハンドリング
- HashMap/HashSetでイミュータブル操作
- Match APIでswitch文置換

## ⚙️ 非機能要件

### 1. パフォーマンス維持
- ゲームループ内では軽量な型検証
- 60FPS維持
- メモリ使用量2GB以下維持
- Schema検証は境界層に集中

### 2. 段階的移行不可
- 全レイヤー一括移行
- 破壊的変更の全面受容
- テストコード含む全面書き換え

## 🏗️ 技術仕様

### 移行対象
- **ファイル数**: 約150ファイル
- **interface数**: 100以上
- **テストファイル**: 50以上

### 導入するBrand型

```typescript
// 時間関連
export const Timestamp = Schema.Number.pipe(Schema.brand('Timestamp'))
export type Timestamp = Schema.Schema.Type<typeof Timestamp>

export const DeltaTime = Schema.Number.pipe(Schema.brand('DeltaTime'))
export type DeltaTime = Schema.Schema.Type<typeof DeltaTime>

export const FrameTime = Schema.Number.pipe(Schema.brand('FrameTime'))
export type FrameTime = Schema.Schema.Type<typeof FrameTime>

export const Duration = Schema.Number.pipe(Schema.brand('Duration'))
export type Duration = Schema.Schema.Type<typeof Duration>

// 座標関連
export const Vector3D = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
}).pipe(Schema.brand('Vector3D'))
export type Vector3D = Schema.Schema.Type<typeof Vector3D>

// ID関連（既存の拡張）
export const Health = Schema.Number.pipe(
  Schema.between(0, 100),
  Schema.brand('Health')
)
export type Health = Schema.Schema.Type<typeof Health>

export const Score = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('Score')
)
export type Score = Schema.Schema.Type<typeof Score>

export const Level = Schema.Number.pipe(
  Schema.positive(),
  Schema.int(),
  Schema.brand('Level')
)
export type Level = Schema.Schema.Type<typeof Level>

export const Experience = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('Experience')
)
export type Experience = Schema.Schema.Type<typeof Experience>

export const Angle = Schema.Number.pipe(
  Schema.between(0, 360),
  Schema.brand('Angle')
)
export type Angle = Schema.Schema.Type<typeof Angle>

export const Distance = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('Distance')
)
export type Distance = Schema.Schema.Type<typeof Distance>

// 文字列関連
export const PlayerName = Schema.String.pipe(
  Schema.minLength(3),
  Schema.maxLength(16),
  Schema.pattern(/^[a-zA-Z0-9_]+$/),
  Schema.brand('PlayerName')
)
export type PlayerName = Schema.Schema.Type<typeof PlayerName>

export const WorldName = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(32),
  Schema.brand('WorldName')
)
export type WorldName = Schema.Schema.Type<typeof WorldName>

export const ServerAddress = Schema.String.pipe(
  Schema.pattern(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}:[0-9]{1,5}$/),
  Schema.brand('ServerAddress')
)
export type ServerAddress = Schema.Schema.Type<typeof ServerAddress>

export const AssetPath = Schema.String.pipe(
  Schema.pattern(/^[a-zA-Z0-9_/\-]+\.[a-zA-Z0-9]+$/),
  Schema.brand('AssetPath')
)
export type AssetPath = Schema.Schema.Type<typeof AssetPath>
```

### Schema定義パターン

```typescript
// Before: interface
interface PlayerState {
  position: number[]
  health: number
  name: string
  lastUpdate: Date
  inventory?: Item[]
}

// After: Schema
export const PlayerStateSchema = Schema.Struct({
  position: Vector3D,
  health: Health,
  name: PlayerName,
  lastUpdate: Timestamp,
  inventory: Schema.optional(Schema.NonEmptyArray(ItemSchema))
})
export type PlayerState = Schema.Schema.Type<typeof PlayerStateSchema>

// デコード/エンコード
export const decodePlayerState = Schema.decodeUnknown(PlayerStateSchema)
export const encodePlayerState = Schema.encode(PlayerStateSchema)
```

### コレクション型の移行

```typescript
// Before
const players: Player[] = []
const items: string[] = []
const cache: Map<string, Data> = new Map()

// After
const players: ReadonlyArray<Player> = ReadonlyArray.empty()
const items: ReadonlyArray<ItemId> = ReadonlyArray.empty()
const cache: HashMap<ChunkId, ChunkData> = HashMap.empty()
```

### Option/Either活用

```typescript
// Before
function getPlayer(id: string): Player | undefined {
  return players.find(p => p.id === id)
}

// After
const getPlayer = (id: PlayerId): Effect.Effect<Player, PlayerNotFoundError> =>
  Effect.gen(function* () {
    const players = yield* PlayersService
    return yield* pipe(
      players.get(id),
      Option.match({
        onNone: () => Effect.fail(new PlayerNotFoundError(id)),
        onSome: Effect.succeed
      })
    )
  })
```

## 📊 評価指標

- **実現可能性**: 95/100 - 技術的に完全に実現可能
- **忖度回避度**: 100/100 - 技術的妥当性を最優先

## 🚧 制約事項

1. **開発停止期間**: 移行中は新機能開発停止（約2-3日）
2. **既存APIの完全破壊**: 全サービスインターフェース変更
3. **学習曲線**: Effect-TS特有の概念の理解必須

## 🧪 テスト要件

### 1. 型検証テスト
- 全Schemaのdecode/encodeテスト
- Brand型の境界値テスト
- エラーケーステスト

### 2. パフォーマンステスト
- FPS計測テスト
- メモリ使用量監視
- Schema検証のオーバーヘッド測定

### 3. 既存テストの移行
- 全specファイルの書き換え
- Effect-TS用テストヘルパー作成

## 実装順序（詳細版）

### Phase 1: Brand型定義とユーティリティ (src/shared/types/)

#### 1.1 新規ファイル作成

**src/shared/types/time-brands.ts**
```typescript
import { Schema } from 'effect'

// 基本時間型
export const Timestamp = Schema.Number.pipe(
  Schema.positive(),
  Schema.brand('Timestamp'),
  Schema.annotations({
    title: 'Timestamp',
    description: 'Unix timestamp in milliseconds'
  })
)
export type Timestamp = Schema.Schema.Type<typeof Timestamp>

export const DeltaTime = Schema.Number.pipe(
  Schema.between(0, 1000),
  Schema.brand('DeltaTime'),
  Schema.annotations({
    title: 'DeltaTime',
    description: 'Frame delta time in milliseconds'
  })
)
export type DeltaTime = Schema.Schema.Type<typeof DeltaTime>

export const FrameTime = Schema.Number.pipe(
  Schema.positive(),
  Schema.brand('FrameTime')
)
export type FrameTime = Schema.Schema.Type<typeof FrameTime>

export const Duration = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('Duration')
)
export type Duration = Schema.Schema.Type<typeof Duration>

// ヘルパー関数
export const now = (): Timestamp => Date.now() as Timestamp
export const addDuration = (t: Timestamp, d: Duration): Timestamp =>
  (t + d) as Timestamp
```

**src/shared/types/spatial-brands.ts**
```typescript
import { Schema } from 'effect'

// 角度型
export const Angle = Schema.Number.pipe(
  Schema.between(-360, 360),
  Schema.brand('Angle')
)
export type Angle = Schema.Schema.Type<typeof Angle>

export const Radian = Schema.Number.pipe(
  Schema.between(-Math.PI * 2, Math.PI * 2),
  Schema.brand('Radian')
)
export type Radian = Schema.Schema.Type<typeof Radian>

// 3D座標型
export const Vector3DSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
}).pipe(Schema.brand('Vector3D'))
export type Vector3D = Schema.Schema.Type<typeof Vector3DSchema>

export const Rotation3DSchema = Schema.Struct({
  pitch: Angle,
  yaw: Angle,
  roll: Angle
}).pipe(Schema.brand('Rotation3D'))
export type Rotation3D = Schema.Schema.Type<typeof Rotation3DSchema>

// 距離・サイズ型
export const Distance = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('Distance')
)
export type Distance = Schema.Schema.Type<typeof Distance>

export const ChunkCoordinate = Schema.Number.pipe(
  Schema.int(),
  Schema.brand('ChunkCoordinate')
)
export type ChunkCoordinate = Schema.Schema.Type<typeof ChunkCoordinate>

export const BlockCoordinate = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 15),
  Schema.brand('BlockCoordinate')
)
export type BlockCoordinate = Schema.Schema.Type<typeof BlockCoordinate>
```

**src/shared/types/game-brands.ts**
```typescript
import { Schema } from 'effect'

// ゲームステータス型
export const Health = Schema.Number.pipe(
  Schema.between(0, 100),
  Schema.brand('Health')
)
export type Health = Schema.Schema.Type<typeof Health>

export const Hunger = Schema.Number.pipe(
  Schema.between(0, 20),
  Schema.brand('Hunger')
)
export type Hunger = Schema.Schema.Type<typeof Hunger>

export const Experience = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.int(),
  Schema.brand('Experience')
)
export type Experience = Schema.Schema.Type<typeof Experience>

export const Level = Schema.Number.pipe(
  Schema.positive(),
  Schema.int(),
  Schema.brand('Level')
)
export type Level = Schema.Schema.Type<typeof Level>

export const Score = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.int(),
  Schema.brand('Score')
)
export type Score = Schema.Schema.Type<typeof Score>

// アイテム関連
export const StackSize = Schema.Number.pipe(
  Schema.between(1, 64),
  Schema.int(),
  Schema.brand('StackSize')
)
export type StackSize = Schema.Schema.Type<typeof StackSize>

export const Durability = Schema.Number.pipe(
  Schema.between(0, 1),
  Schema.brand('Durability')
)
export type Durability = Schema.Schema.Type<typeof Durability>
```

#### 1.2 既存Brand型の拡張 (src/shared/types/branded.ts)

```typescript
// 既存のBrand型に検証とアノテーション追加
export const PlayerId = Schema.String.pipe(
  Schema.pattern(/^player_[a-zA-Z0-9]{8}$/),
  Schema.brand('PlayerId'),
  Schema.annotations({
    title: 'PlayerId',
    description: 'Unique player identifier',
    examples: ['player_abc12345']
  })
)

export const ChunkId = Schema.String.pipe(
  Schema.pattern(/^chunk_-?\d+_-?\d+_-?\d+$/),
  Schema.brand('ChunkId'),
  Schema.annotations({
    title: 'ChunkId',
    description: 'Chunk identifier in format chunk_x_y_z'
  })
)

export const BlockTypeId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(32),
  Schema.pattern(/^[a-z_]+$/),
  Schema.brand('BlockTypeId')
)
```

### Phase 2: エラー型のSchema化 (src/core/errors/, src/shared/errors/)

#### 2.1 AppError.ts の完全Schema化

```typescript
import { Schema, Context, Effect, pipe } from 'effect'
import { Timestamp } from '@/shared/types/time-brands'

// エラー基底Schema
export const ErrorBaseSchema = Schema.Struct({
  _tag: Schema.String,
  message: Schema.String,
  timestamp: Timestamp,
  stackTrace: Schema.optional(Schema.String),
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

// InitError
export const InitErrorSchema = Schema.Struct({
  ...ErrorBaseSchema.fields,
  _tag: Schema.Literal('InitError'),
  cause: Schema.optional(Schema.lazy(() => ErrorUnionSchema))
})
export type InitError = Schema.Schema.Type<typeof InitErrorSchema>

// ConfigError
export const ConfigErrorSchema = Schema.Struct({
  ...ErrorBaseSchema.fields,
  _tag: Schema.Literal('ConfigError'),
  configPath: Schema.String,
  expectedType: Schema.String,
  actualValue: Schema.Unknown
})
export type ConfigError = Schema.Schema.Type<typeof ConfigErrorSchema>

// エラーユニオン
export const ErrorUnionSchema = Schema.Union(
  InitErrorSchema,
  ConfigErrorSchema
)
export type AppError = Schema.Schema.Type<typeof ErrorUnionSchema>

// エラーコンストラクタ
export const InitError = (
  message: string,
  cause?: AppError
): InitError => ({
  _tag: 'InitError',
  message,
  timestamp: Date.now() as Timestamp,
  cause,
  stackTrace: new Error().stack
})

// デコード/エンコード
export const decodeError = Schema.decode(ErrorUnionSchema)
export const encodeError = Schema.encode(ErrorUnionSchema)

// Effect統合
export const catchAndDecode = <A, E>(
  effect: Effect.Effect<A, E>
): Effect.Effect<A, AppError> =>
  pipe(
    effect,
    Effect.catchAll((error) =>
      pipe(
        Effect.succeed(error),
        Effect.flatMap(decodeError),
        Effect.catchAll(() =>
          Effect.fail(InitError('Unknown error occurred', error as any))
        )
      )
    )
  )
```

### Phase 3: Domain層の完全移行 (src/domain/)

#### 3.1 PlayerService完全移行

```typescript
import { Schema, Context, Effect, pipe, HashMap, Option } from 'effect'
import * as ReadonlyArray from 'effect/ReadonlyArray'

// Player関連Schema
export const PlayerConfigSchema = Schema.Struct({
  name: PlayerName,
  spawnPosition: Vector3D,
  gameMode: Schema.Literal('survival', 'creative', 'adventure', 'spectator')
})
export type PlayerConfig = Schema.Schema.Type<typeof PlayerConfigSchema>

export const PlayerStateSchema = Schema.Struct({
  id: PlayerId,
  name: PlayerName,
  position: Vector3D,
  rotation: Rotation3D,
  velocity: Vector3D,
  health: Health,
  hunger: Hunger,
  experience: Experience,
  level: Level,
  inventory: Schema.ReadonlyArray(ItemSchema),
  equipment: EquipmentSchema,
  lastUpdate: Timestamp,
  metadata: Schema.HashMap(Schema.String, Schema.Unknown)
})
export type PlayerState = Schema.Schema.Type<typeof PlayerStateSchema>

// PlayerService定義
export interface PlayerService {
  readonly createPlayer: (
    config: PlayerConfig
  ) => Effect.Effect<PlayerId, PlayerError>

  readonly getPlayer: (
    id: PlayerId
  ) => Effect.Effect<PlayerState, PlayerNotFoundError>

  readonly getAllPlayers: Effect.Effect<
    ReadonlyArray<PlayerState>,
    never
  >

  readonly updatePosition: (
    id: PlayerId,
    position: Vector3D
  ) => Effect.Effect<void, PlayerError>

  readonly updateHealth: (
    id: PlayerId,
    health: Health
  ) => Effect.Effect<void, PlayerError>

  readonly removePlayer: (
    id: PlayerId
  ) => Effect.Effect<void, PlayerError>
}

export const PlayerService = Context.GenericTag<PlayerService>('PlayerService')

// Live実装
export const PlayerServiceLive = Effect.gen(function* () {
  // 内部状態をHashMapで管理
  const playersRef = yield* Effect.sync(() =>
    Ref.make(HashMap.empty<PlayerId, PlayerState>())
  )

  const generatePlayerId = (): PlayerId => {
    const id = `player_${Math.random().toString(36).substr(2, 8)}`
    return id as PlayerId
  }

  const createPlayer = (config: PlayerConfig) =>
    Effect.gen(function* () {
      const id = generatePlayerId()
      const now = Date.now() as Timestamp

      const playerState: PlayerState = {
        id,
        name: config.name,
        position: config.spawnPosition,
        rotation: { pitch: 0, yaw: 0, roll: 0 } as Rotation3D,
        velocity: { x: 0, y: 0, z: 0 } as Vector3D,
        health: 100 as Health,
        hunger: 20 as Hunger,
        experience: 0 as Experience,
        level: 1 as Level,
        inventory: ReadonlyArray.empty(),
        equipment: createEmptyEquipment(),
        lastUpdate: now,
        metadata: HashMap.empty()
      }

      yield* Ref.update(playersRef, HashMap.set(id, playerState))
      return id
    })

  const getPlayer = (id: PlayerId) =>
    Effect.gen(function* () {
      const players = yield* Ref.get(playersRef)
      const player = HashMap.get(players, id)

      return yield* pipe(
        player,
        Option.match({
          onNone: () => Effect.fail(new PlayerNotFoundError(id)),
          onSome: Effect.succeed
        })
      )
    })

  return {
    createPlayer,
    getPlayer,
    getAllPlayers: Effect.map(
      Ref.get(playersRef),
      HashMap.values
    ),
    updatePosition: (id, position) =>
      updatePlayerField(playersRef, id, 'position', position),
    updateHealth: (id, health) =>
      updatePlayerField(playersRef, id, 'health', health),
    removePlayer: (id) =>
      Ref.update(playersRef, HashMap.remove(id))
  }
})
```

### Phase 4: Infrastructure層の型強化 (src/infrastructure/)

#### 4.1 ECSシステムの完全型安全化

```typescript
// Entity.ts
import { Schema, HashMap, Option, pipe } from 'effect'

export const ComponentTypeIdSchema = Schema.String.pipe(
  Schema.brand('ComponentTypeId')
)
export type ComponentTypeId = Schema.Schema.Type<typeof ComponentTypeIdSchema>

// コンポーネント基底
export const ComponentBaseSchema = Schema.Struct({
  type: ComponentTypeIdSchema,
  entityId: EntityId
})

// Position Component
export const PositionComponentSchema = Schema.Struct({
  ...ComponentBaseSchema.fields,
  type: Schema.Literal('position'),
  position: Vector3D
})
export type PositionComponent = Schema.Schema.Type<typeof PositionComponentSchema>

// Velocity Component
export const VelocityComponentSchema = Schema.Struct({
  ...ComponentBaseSchema.fields,
  type: Schema.Literal('velocity'),
  velocity: Vector3D
})
export type VelocityComponent = Schema.Schema.Type<typeof VelocityComponentSchema>

// Component Union
export const ComponentSchema = Schema.Union(
  PositionComponentSchema,
  VelocityComponentSchema,
  HealthComponentSchema,
  // ... 他のコンポーネント
)
export type Component = Schema.Schema.Type<typeof ComponentSchema>

// Entity
export const EntitySchema = Schema.Struct({
  id: EntityId,
  components: Schema.HashMap(ComponentTypeIdSchema, ComponentSchema),
  tags: Schema.HashSet(Schema.String),
  active: Schema.Boolean
})
export type Entity = Schema.Schema.Type<typeof EntitySchema>

// World
export const WorldStateSchema = Schema.Struct({
  entities: Schema.HashMap(EntityId, EntitySchema),
  systems: Schema.ReadonlyArray(SystemSchema),
  time: Timestamp
})
export type WorldState = Schema.Schema.Type<typeof WorldStateSchema>
```

### Phase 5: テストヘルパーとテスト移行

#### 5.1 Effect-TSテストヘルパー (src/shared/test/effect-helpers.ts)

```typescript
import { Effect, Exit, pipe, Schema } from 'effect'
import { expect } from 'vitest'

// Effect実行ヘルパー
export const runTest = <E, A>(
  effect: Effect.Effect<A, E>
): Promise<A> =>
  Effect.runPromise(
    pipe(
      effect,
      Effect.catchAll((error) =>
        Effect.die(new Error(`Test failed: ${JSON.stringify(error)}`))
      )
    )
  )

// Schema検証ヘルパー
export const expectDecode = async <A, I>(
  schema: Schema.Schema<A, I>,
  input: I,
  expected: A
): Promise<void> => {
  const result = await Effect.runPromise(Schema.decode(schema)(input))
  expect(result).toEqual(expected)
}

export const expectDecodeFail = async <A, I>(
  schema: Schema.Schema<A, I>,
  input: I
): Promise<void> => {
  const exit = await Effect.runPromiseExit(Schema.decode(schema)(input))
  expect(Exit.isFailure(exit)).toBe(true)
}

// Effect assertion
export const expectEffect = async <A>(
  effect: Effect.Effect<A>,
  assertion: (value: A) => void
): Promise<void> => {
  const result = await runTest(effect)
  assertion(result)
}

// プロパティベーステスト
export const effectProperty = <A>(
  name: string,
  effect: Effect.Effect<A>,
  property: (value: A) => boolean
) => {
  it.prop([fc.anything()])(name, async () => {
    const result = await runTest(effect)
    expect(property(result)).toBe(true)
  })
}
```

#### 5.2 テストファイル移行例

```typescript
// PlayerService.spec.ts - 移行後
import { describe, it, expect } from 'vitest'
import { Effect, pipe } from 'effect'
import { runTest, expectEffect, expectDecode } from '@/shared/test/effect-helpers'
import { PlayerServiceLive, PlayerStateSchema } from '@/domain/player/PlayerService'

describe('PlayerService', () => {
  const service = PlayerServiceLive.pipe(Effect.runSync)

  describe('createPlayer', () => {
    it('should create a new player with valid config', async () => {
      await expectEffect(
        service.createPlayer({
          name: 'TestPlayer' as PlayerName,
          spawnPosition: { x: 0, y: 64, z: 0 } as Vector3D,
          gameMode: 'survival'
        }),
        (playerId) => {
          expect(playerId).toMatch(/^player_[a-zA-Z0-9]{8}$/)
        }
      )
    })

    it('should validate player state schema', async () => {
      const playerId = await runTest(
        service.createPlayer(testConfig)
      )

      await expectEffect(
        service.getPlayer(playerId),
        async (state) => {
          await expectDecode(PlayerStateSchema, state, state)
        }
      )
    })
  })

  describe('updateHealth', () => {
    it.prop([
      fc.integer({ min: 0, max: 100 })
    ])('should accept valid health values', async (healthValue) => {
      const playerId = await runTest(service.createPlayer(testConfig))
      const health = healthValue as Health

      await runTest(
        service.updateHealth(playerId, health)
      )

      await expectEffect(
        service.getPlayer(playerId),
        (state) => {
          expect(state.health).toBe(health)
        }
      )
    })
  })
})

### Phase 6: ドキュメント更新（docs/）

#### 6.1 新規ドキュメント作成

**docs/tutorials/effect-ts-fundamentals/effect-ts-type-system.md**
```markdown
# Effect-TS型システム完全ガイド

## 概要
このプロジェクトではEffect-TSの型システムを全面的に採用し、コンパイル時とランタイムの両方で型安全性を保証しています。

## Brand型

### 基本的なBrand型
- `Timestamp`: Unix timestampをミリ秒で表現
- `PlayerId`: プレイヤーの一意識別子
- `Health`: 0-100の範囲のヘルス値
- `Experience`: 非負整数の経験値

### Brand型の作成パターン
\`\`\`typescript
// 数値Brand型
export const Health = Schema.Number.pipe(
  Schema.between(0, 100),
  Schema.brand('Health')
)

// 文字列Brand型with検証
export const PlayerId = Schema.String.pipe(
  Schema.pattern(/^player_[a-zA-Z0-9]{8}$/),
  Schema.brand('PlayerId')
)
\`\`\`

## Schema定義

### 基本的なSchema定義
\`\`\`typescript
export const PlayerStateSchema = Schema.Struct({
  id: PlayerId,
  position: Vector3D,
  health: Health,
  inventory: Schema.ReadonlyArray(ItemSchema)
})

// 型の導出
export type PlayerState = Schema.Schema.Type<typeof PlayerStateSchema>
\`\`\`

### デコード/エンコード
\`\`\`typescript
// デコード（unknown → 型安全な値）
const decode = Schema.decodeUnknown(PlayerStateSchema)

// エンコード（型安全な値 → JSONシリアライズ可能な値）
const encode = Schema.encode(PlayerStateSchema)
\`\`\`

## イミュータブルコレクション

### ReadonlyArray
\`\`\`typescript
import { ReadonlyArray } from 'effect'

const players = ReadonlyArray.empty<Player>()
const withNewPlayer = ReadonlyArray.append(players, newPlayer)
const filtered = ReadonlyArray.filter(players, p => p.health > 0)
\`\`\`

### HashMap
\`\`\`typescript
import { HashMap } from 'effect'

const playerMap = HashMap.empty<PlayerId, Player>()
const updated = HashMap.set(playerMap, playerId, player)
const player = HashMap.get(playerMap, playerId) // Option<Player>
\`\`\`

## エラーハンドリング

### Option型
\`\`\`typescript
import { Option, pipe } from 'effect'

const findPlayer = (id: PlayerId): Option<Player> =>
  pipe(
    players,
    ReadonlyArray.findFirst(p => p.id === id)
  )

// Option処理
pipe(
  findPlayer(id),
  Option.match({
    onNone: () => console.log('Player not found'),
    onSome: (player) => console.log(\`Found: \${player.name}\`)
  })
)
\`\`\`

### Effect型
\`\`\`typescript
const getPlayer = (id: PlayerId): Effect.Effect<Player, PlayerNotFoundError> =>
  Effect.gen(function* () {
    const player = yield* findPlayerEffect(id)
    if (!player) {
      return yield* Effect.fail(new PlayerNotFoundError(id))
    }
    return player
  })
\`\`\`
```

**docs/reference/api/effect-ts-types.md**
```markdown
# Effect-TS型リファレンス

## Brand型一覧

### 時間関連
| 型名 | 基底型 | 制約 | 用途 |
|------|--------|------|------|
| `Timestamp` | number | positive | Unix timestamp (ms) |
| `DeltaTime` | number | 0-1000 | フレーム間の時間差 |
| `FrameTime` | number | positive | フレーム処理時間 |
| `Duration` | number | non-negative | 期間 |

### 空間関連
| 型名 | 基底型 | 制約 | 用途 |
|------|--------|------|------|
| `Vector3D` | {x,y,z} | - | 3D座標 |
| `Rotation3D` | {pitch,yaw,roll} | -360~360 | 3D回転 |
| `Distance` | number | non-negative | 距離 |
| `Angle` | number | -360~360 | 角度（度） |
| `Radian` | number | -2π~2π | 角度（ラジアン） |

### ゲーム固有
| 型名 | 基底型 | 制約 | 用途 |
|------|--------|------|------|
| `Health` | number | 0-100 | 体力 |
| `Hunger` | number | 0-20 | 空腹度 |
| `Experience` | number | non-negative int | 経験値 |
| `Level` | number | positive int | レベル |
| `Score` | number | non-negative int | スコア |

### ID関連
| 型名 | 基底型 | パターン | 用途 |
|------|--------|----------|------|
| `PlayerId` | string | `player_[a-z0-9]{8}` | プレイヤーID |
| `EntityId` | number | positive int | エンティティID |
| `ChunkId` | string | `chunk_x_y_z` | チャンクID |
| `BlockTypeId` | string | `[a-z_]+` | ブロック種別ID |

## Schema定義パターン

### 基本構造体
\`\`\`typescript
const StructSchema = Schema.Struct({
  field1: Type1,
  field2: Type2,
  optional: Schema.optional(Type3)
})
\`\`\`

### ユニオン型
\`\`\`typescript
const UnionSchema = Schema.Union(
  Schema1,
  Schema2,
  Schema3
)
\`\`\`

### 配列型
\`\`\`typescript
// 通常の配列
Schema.Array(ElementSchema)

// 非空配列
Schema.NonEmptyArray(ElementSchema)

// 読み取り専用配列
Schema.ReadonlyArray(ElementSchema)
\`\`\`

### マップ型
\`\`\`typescript
// Record型
Schema.Record(Schema.String, ValueSchema)

// HashMap型
Schema.HashMap(KeySchema, ValueSchema)
\`\`\`
```

**docs/how-to/development/effect-ts-migration.md**
```markdown
# Effect-TS型システム移行ガイド

## 移行チェックリスト

### interface → Schema.Struct
- [ ] interface定義を特定
- [ ] Schema.Structで置換
- [ ] 型を`Schema.Schema.Type`で導出
- [ ] デコード/エンコード関数作成

### プリミティブ型 → Brand型
- [ ] number → 適切なBrand型
- [ ] string → 適切なBrand型
- [ ] Date → Timestamp
- [ ] unknown → Schema定義

### 配列 → イミュータブルコレクション
- [ ] T[] → ReadonlyArray<T>
- [ ] Map → HashMap
- [ ] Set → HashSet

## 移行パターン

### 1. interface移行
\`\`\`typescript
// Before
interface Player {
  id: string
  health: number
  position: { x: number; y: number; z: number }
}

// After
const PlayerSchema = Schema.Struct({
  id: PlayerId,
  health: Health,
  position: Vector3D
})
type Player = Schema.Schema.Type<typeof PlayerSchema>
\`\`\`

### 2. エラーハンドリング移行
\`\`\`typescript
// Before
function getPlayer(id: string): Player | undefined {
  return players.find(p => p.id === id)
}

// After
const getPlayer = (id: PlayerId): Effect.Effect<Player, PlayerNotFoundError> =>
  pipe(
    findPlayer(id),
    Effect.mapError(() => new PlayerNotFoundError(id))
  )
\`\`\`

### 3. 配列操作移行
\`\`\`typescript
// Before
const filtered = players.filter(p => p.health > 0)
const mapped = filtered.map(p => p.name)

// After
const result = pipe(
  players,
  ReadonlyArray.filter(p => p.health > 0),
  ReadonlyArray.map(p => p.name)
)
\`\`\`

## トラブルシューティング

### よくあるエラー

#### 型推論エラー
\`\`\`typescript
// Error: Type 'number' is not assignable to type 'Health'
const health: Health = 100

// Solution: 明示的なキャスト
const health = 100 as Health
// または Schema.decode使用
const health = Schema.decodeSync(Health)(100)
\`\`\`

#### Schema循環参照
\`\`\`typescript
// Error: Circular reference
const NodeSchema = Schema.Struct({
  value: Schema.String,
  children: Schema.Array(NodeSchema) // Error!
})

// Solution: Schema.lazy使用
const NodeSchema: Schema.Schema<Node> = Schema.lazy(() =>
  Schema.Struct({
    value: Schema.String,
    children: Schema.Array(NodeSchema)
  })
)
\`\`\`
```

#### 6.2 既存ドキュメント更新

**docs/tutorials/effect-ts-fundamentals/effect-ts-patterns.md**に追記:
```markdown
## 型システムパターン

### Brand型による型安全性

Brand型は実行時の値は同じでも、TypeScriptの型システム上では異なる型として扱われます。

\`\`\`typescript
const userId = "123" as UserId
const productId = "123" as ProductId

// コンパイルエラー: 型が異なる
function getUser(id: UserId) { /* ... */ }
getUser(productId) // Error!
\`\`\`

### Schema Annotationsによるメタデータ

\`\`\`typescript
const EmailSchema = Schema.String.pipe(
  Schema.pattern(/^[^@]+@[^@]+$/),
  Schema.brand('Email'),
  Schema.annotations({
    title: 'Email',
    description: 'Valid email address',
    examples: ['user@example.com'],
    documentation: 'https://example.com/api/email'
  })
)
\`\`\`
```

**docs/explanations/design-patterns/type-safety-patterns.md**（新規）:
```markdown
# 型安全性パターン

## なぜEffect-TSの型システムか

### 従来のTypeScriptの限界

1. **ランタイム検証の欠如**
   - TypeScriptの型はコンパイル時のみ
   - 外部入力の検証が手動

2. **プリミティブ型の曖昧性**
   - `number`が何を表すか不明確
   - IDと数量を混同するリスク

3. **null/undefined地獄**
   - 至る所でnullチェック必要
   - エラーハンドリングが複雑

### Effect-TSによる解決

1. **Schema = 型 + 検証**
   - コンパイル時とランタイム両方で型安全
   - 自動的なバリデーション生成

2. **Brand型による意味の明確化**
   - `Health`と`Experience`を区別
   - ドメイン知識を型に埋め込み

3. **Option/Eitherによる明示的なエラー処理**
   - nullの代わりにOption
   - try-catchの代わりにEither

## 設計原則

### 1. 境界での検証

\`\`\`typescript
// API境界での検証
const handleRequest = (rawData: unknown) =>
  pipe(
    rawData,
    Schema.decodeUnknown(RequestSchema),
    Effect.flatMap(processValidData),
    Effect.catchAll(handleValidationError)
  )
\`\`\`

### 2. 内部では型を信頼

\`\`\`typescript
// 内部処理では型キャストOK
const updateHealth = (player: Player, damage: Damage) => {
  const newHealth = Math.max(0, player.health - damage) as Health
  return { ...player, health: newHealth }
}
\`\`\`

### 3. エラーの型による分類

\`\`\`typescript
// エラーを型で区別
type GameError =
  | PlayerNotFoundError
  | InvalidInputError
  | NetworkError

// パターンマッチングで処理
pipe(
  result,
  Effect.catchTag('PlayerNotFoundError', handlePlayerNotFound),
  Effect.catchTag('NetworkError', retryWithBackoff)
)
\`\`\`
```

**docs/reference/configuration/typescript-config.md**に追記:
```markdown
## Effect-TS対応設定

### tsconfig.json推奨設定

\`\`\`json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
\`\`\`

これらの設定により、Effect-TSの型システムが最大限に活用されます。
```

#### 6.3 docs/INDEX.mdの更新

```markdown
### 🆕 Effect-TS型システム

完全な型安全性を実現するEffect-TSベースの型システム：

- **[型システム完全ガイド](./tutorials/effect-ts-fundamentals/effect-ts-type-system.md)** - Brand型、Schema、コレクション
- **[型リファレンス](./reference/api/effect-ts-types.md)** - 全Brand型とSchema定義
- **[移行ガイド](./how-to/development/effect-ts-migration.md)** - 既存コードの移行方法
- **[型安全性パターン](./explanations/design-patterns/type-safety-patterns.md)** - 設計原則と背景
```

## 成功基準

- ✅ 全interfaceがSchema.Structに移行完了
- ✅ unknown/any型が0件
- ✅ 全プリミティブ配列がReadonlyArrayに移行
- ✅ Date型が全てTimestamp Brand型に移行
- ✅ 全テストがPASS
- ✅ TypeScriptコンパイルエラー0件
- ✅ 60FPS維持確認
- ✅ メモリ使用量2GB以下確認
- ✅ **ドキュメント更新完了**
  - 新規ドキュメント4件作成
  - 既存ドキュメント3件更新
  - docs/INDEX.md更新