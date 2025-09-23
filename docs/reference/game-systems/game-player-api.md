---
title: 'Game Player API Reference'
description: 'TypeScript Minecraft Clone プレイヤー管理システムの完全APIリファレンス。Effect-TS 3.17+による型安全なプレイヤー操作、移動、インベントリ、戦闘システムの実装者向けガイド。'
category: 'reference'
difficulty: 'advanced'
tags: ['api-reference', 'player-management', 'effect-ts', 'domain-api', 'game-player']
prerequisites: ['effect-ts-fundamentals', 'player-system-basics', 'ddd-architecture', 'ecs-patterns']
estimated_reading_time: '45分'
related_patterns: ['service-patterns', 'state-management-patterns', 'domain-patterns']
related_docs:
  [
    '../../explanations/game-mechanics/core-features/player-system.md',
    './game-inventory-api.md',
    '../api/domain-apis.md',
  ]
search_keywords:
  primary: ['player-api', 'minecraft-player', 'player-management', 'game-api']
  secondary: ['player-movement', 'player-stats', 'player-actions']
  context: ['minecraft-development', 'game-programming', 'api-reference']
---

# Game Player API Reference

TypeScript Minecraft Clone プレイヤー管理システムの完全APIリファレンスです。Effect-TS 3.17+とDDDパターンを活用した高性能プレイヤーシステムの実装ガイド。

## 📋 概要

プレイヤー管理システムは以下の機能を提供します：

- **プレイヤー基本操作**: エンティティの作成・更新・削除・検索
- **移動・物理システム**: 3D移動、ジャンプ、物理演算、衝突検出
- **インベントリ統合**: アイテム管理、装備着脱、クラフト処理
- **アクション処理**: ブロック配置/破壊、アイテム使用、攻撃
- **体力・生存システム**: HP、空腹度、経験値、自然回復
- **マルチプレイヤー同期**: ネットワーク同期、予測、補間
- **ECS統合**: 高性能なコンポーネントベースアーキテクチャ
- **入力処理**: キーボード・マウス入力の統合ハンドリング

### システム全体像

プレイヤー管理システムは以下の主要サービスで構成されています：

- **PlayerService**: プレイヤーエンティティの基本CRUD操作
- **PlayerMovementService**: 移動・物理演算・衝突検出
- **PlayerActionProcessor**: プレイヤーアクションの統合処理
- **HealthSystem**: 体力・空腹度・回復システム
- **PlayerSyncService**: マルチプレイヤー同期・予測
- **InputService**: 入力イベントの処理・変換
- **PlayerECSSystem**: ECS統合・高性能処理

> **🔗 概念的理解**: プレイヤーシステムの設計思想と詳細な実装パターンは [Player System Specification](../../explanations/game-mechanics/core-features/player-system.md) を参照してください。

## 📊 データ構造

### コア型定義

```typescript
import { Effect, Layer, Context, Schema, pipe, Match, STM, Ref, Stream } from 'effect'
import { Brand, Option } from 'effect'

// ブランド型定義（型安全性確保）
export const PlayerIdSchema = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  Schema.brand('PlayerId')
)
export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>

export const PlayerNameSchema = Schema.String.pipe(
  Schema.minLength(3),
  Schema.maxLength(16),
  Schema.pattern(/^[a-zA-Z0-9_]+$/),
  Schema.brand('PlayerName')
)
export type PlayerName = Schema.Schema.Type<typeof PlayerNameSchema>

export const ExperienceSchema = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('Experience'))
export type Experience = Schema.Schema.Type<typeof ExperienceSchema>
```

### 座標・物理系

```typescript
// 座標系の厳密な制約 - World boundaries with overflow protection
export const WorldPositionSchema = Schema.Struct({
  x: Schema.Number.pipe(
    Schema.between(-30000000, 30000000),
    Schema.filter((x) => Number.isFinite(x) && !Number.isNaN(x)),
    Schema.brand('WorldX')
  ),
  y: Schema.Number.pipe(
    Schema.between(-64, 320), // Minecraft Y range
    Schema.filter((y) => Number.isInteger(y)),
    Schema.brand('WorldY')
  ),
  z: Schema.Number.pipe(
    Schema.between(-30000000, 30000000),
    Schema.filter((z) => Number.isFinite(z) && !Number.isNaN(z)),
    Schema.brand('WorldZ')
  ),
}).pipe(
  Schema.filter((pos) => {
    // Additional semantic validation
    const distanceFromOrigin = Math.sqrt(pos.x * pos.x + pos.z * pos.z)
    return distanceFromOrigin <= 30000000 // Prevent floating point errors
  }),
  Schema.annotations({
    identifier: 'WorldPosition',
    title: 'World Position',
    description: '3D position within Minecraft world boundaries with overflow protection',
  })
)
export type WorldPosition = Schema.Schema.Type<typeof WorldPositionSchema>

// Relative position with clamping
export const RelativePositionSchema = Schema.Struct({
  x: Schema.Number.pipe(
    Schema.between(-128, 128),
    Schema.filter((x) => Number.isFinite(x)),
    Schema.brand('RelativeX')
  ),
  y: Schema.Number.pipe(
    Schema.between(-128, 128),
    Schema.filter((y) => Number.isFinite(y)),
    Schema.brand('RelativeY')
  ),
  z: Schema.Number.pipe(
    Schema.between(-128, 128),
    Schema.filter((z) => Number.isFinite(z)),
    Schema.brand('RelativeZ')
  ),
}).pipe(
  Schema.filter((pos) => {
    // Ensure relative positions don't create impossible vectors
    const magnitude = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z)
    return magnitude <= 221.7 // Maximum 3D distance in 128^3 cube
  }),
  Schema.annotations({
    identifier: 'RelativePosition',
    title: 'Relative Position',
    description: 'Position relative to a reference point with magnitude validation',
  })
)
export type RelativePosition = Schema.Schema.Type<typeof RelativePositionSchema>

// Backward compatibility aliases
export const Position3DSchema = WorldPositionSchema
export type Position3D = WorldPosition

// Rotation with overflow protection
export const RotationSchema = Schema.Struct({
  yaw: Schema.Number.pipe(
    Schema.between(-180, 180),
    Schema.filter((yaw) => Number.isFinite(yaw)),
    Schema.brand('Yaw')
  ),
  pitch: Schema.Number.pipe(
    Schema.between(-90, 90),
    Schema.filter((pitch) => Number.isFinite(pitch)),
    Schema.brand('Pitch')
  ),
}).pipe(
  Schema.annotations({
    identifier: 'Rotation',
    title: 'Player Rotation',
    description: 'Player view rotation with clamped angles',
  })
)
export type Rotation = Schema.Schema.Type<typeof RotationSchema>

// Velocity with physics constraints
export const Velocity3DSchema = Schema.Struct({
  x: Schema.Number.pipe(
    Schema.between(-100, 100), // Max velocity constraint
    Schema.filter((x) => Number.isFinite(x)),
    Schema.brand('VelocityX')
  ),
  y: Schema.Number.pipe(
    Schema.between(-100, 100),
    Schema.filter((y) => Number.isFinite(y)),
    Schema.brand('VelocityY')
  ),
  z: Schema.Number.pipe(
    Schema.between(-100, 100),
    Schema.filter((z) => Number.isFinite(z)),
    Schema.brand('VelocityZ')
  ),
}).pipe(
  Schema.filter((velocity) => {
    // Terminal velocity check
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z)
    return speed <= 78.4 // Maximum realistic speed
  }),
  Schema.annotations({
    identifier: 'Velocity3D',
    title: '3D Velocity',
    description: 'Player velocity with physics constraints',
  })
)
export type Velocity3D = Schema.Schema.Type<typeof Velocity3DSchema>
```

### プレイヤー統計・状態

```typescript
// Health with game mechanics validation
export const HealthSchema = Schema.Number.pipe(
  Schema.between(0, 20),
  Schema.multipleOf(0.5), // Half-heart increments
  Schema.filter((health) => health >= 0 && health <= 20),
  Schema.brand('Health'),
  Schema.annotations({
    identifier: 'Health',
    title: 'Player Health',
    description: 'Health points in half-heart increments (0.5, 1.0, 1.5, ..., 20.0)',
  })
)
export type Health = Schema.Schema.Type<typeof HealthSchema>

// Helper functions for experience calculations
const calculateLevelFromPoints = (points: number): number => {
  // Minecraft experience calculation
  if (points < 352) return Math.floor(Math.sqrt(points + 9) - 3)
  if (points < 1507) return Math.floor((Math.sqrt(40 * points - 7839) + 81) / 20)
  return Math.floor((Math.sqrt(72 * points - 54215) + 325) / 36)
}

const getLevelRequiredPoints = (level: number): number => {
  if (level <= 16) return level * level + 6 * level
  if (level <= 31) return 2.5 * level * level - 40.5 * level + 360
  return 4.5 * level * level - 162.5 * level + 2220
}

const calculateProgressInLevel = (points: number, level: number): number => {
  const levelPoints = getLevelRequiredPoints(level)
  const nextLevelPoints = getLevelRequiredPoints(level + 1)
  const pointsInLevel = points - levelPoints
  const pointsNeeded = nextLevelPoints - levelPoints
  return Math.max(0, Math.min(1, pointsInLevel / pointsNeeded))
}

// Experience with level correlation validation
export const PlayerExperienceSchema = Schema.Struct({
  points: Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand('ExperiencePoints')),
  level: Schema.Number.pipe(Schema.int(), Schema.between(0, 2147483647), Schema.brand('ExperienceLevel')),
  progress: Schema.Number.pipe(
    Schema.between(0, 1),
    Schema.filter((progress) => Number.isFinite(progress)),
    Schema.brand('ExperienceProgress')
  ),
}).pipe(
  Schema.filter((exp) => {
    // Validate level-points correlation
    const expectedLevel = calculateLevelFromPoints(exp.points)
    const expectedProgress = calculateProgressInLevel(exp.points, expectedLevel)
    return Math.abs(exp.level - expectedLevel) <= 1 && Math.abs(exp.progress - expectedProgress) <= 0.01
  }),
  Schema.annotations({
    identifier: 'PlayerExperience',
    title: 'Player Experience',
    description: 'Experience system with validated level-points correlation',
  })
)
export type PlayerExperience = Schema.Schema.Type<typeof PlayerExperienceSchema>

// プレイヤーステータス - Schema.Structによる型安全な定義
export const PlayerStatsSchema = Schema.Struct({
  health: HealthSchema,
  hunger: Schema.Number.pipe(Schema.between(0, 20), Schema.multipleOf(0.5), Schema.brand('Hunger')),
  saturation: Schema.Number.pipe(
    Schema.between(0, 20),
    Schema.filter((sat, ctx) => {
      // Saturation cannot exceed hunger level
      const hunger = ctx.parent?.hunger
      return hunger ? sat <= hunger : true
    }),
    Schema.brand('Saturation')
  ),
  experience: PlayerExperienceSchema,
  armor: Schema.Number.pipe(Schema.between(0, 20), Schema.multipleOf(0.5), Schema.brand('Armor')),
}).pipe(
  Schema.filter((stats) => {
    // Cross-field validation
    if (stats.saturation > stats.hunger) return false
    if (stats.health === 0 && stats.hunger > 0) {
      // Dead players should have no hunger
      return false
    }
    return true
  }),
  Schema.annotations({
    identifier: 'PlayerStats',
    title: 'Player Statistics',
    description: 'Complete player statistics with cross-field validation',
  })
)
export type PlayerStats = Schema.Schema.Type<typeof PlayerStatsSchema>

// Backward compatibility
export const ExperienceSchema = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('Experience'))
export type Experience = Schema.Schema.Type<typeof ExperienceSchema>
```

### プレイヤーアグリゲート（ルート）

```typescript
// プレイヤーアグリゲートルート - 完全なプレイヤー表現
export const PlayerSchema = Schema.Struct({
  id: PlayerIdSchema,
  name: PlayerNameSchema,
  position: Position3DSchema,
  rotation: RotationSchema,
  velocity: Velocity3DSchema,
  stats: PlayerStatsSchema,
  inventory: Schema.suspend(() => InventorySchema), // 循環参照回避
  equipment: Schema.suspend(() => EquipmentSchema),
  gameMode: Schema.Literal('survival', 'creative', 'adventure', 'spectator'),
  abilities: Schema.Struct({
    canFly: Schema.Boolean,
    isFlying: Schema.Boolean,
    canBreakBlocks: Schema.Boolean,
    canPlaceBlocks: Schema.Boolean,
    invulnerable: Schema.Boolean,
    walkSpeed: Schema.Number,
    flySpeed: Schema.Number,
  }),
  metadata: Schema.Struct({
    createdAt: Schema.Date,
    lastActive: Schema.Date,
    playTime: Schema.Number.pipe(Schema.nonNegative()),
  }),
})
export type Player = Schema.Schema.Type<typeof PlayerSchema>
```

### 移動・アクション関連

```typescript
// 移動方向定義
export const DirectionSchema = Schema.Struct({
  forward: Schema.Boolean,
  backward: Schema.Boolean,
  left: Schema.Boolean,
  right: Schema.Boolean,
  jump: Schema.Boolean,
  sneak: Schema.Boolean,
  sprint: Schema.Boolean,
})
export type Direction = Schema.Schema.Type<typeof DirectionSchema>

// プレイヤーアクション（Tagged Union）
export const PlayerActionSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Move'),
    direction: DirectionSchema,
    deltaTime: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Jump'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Attack'),
    target: Schema.String.pipe(Schema.brand('EntityId')),
  }),
  Schema.Struct({
    _tag: Schema.Literal('UseItem'),
    item: Schema.suspend(() => ItemStackSchema),
    target: Schema.optional(Position3DSchema),
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlaceBlock'),
    position: Position3DSchema,
    face: Schema.Literal('top', 'bottom', 'north', 'south', 'east', 'west'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('BreakBlock'),
    position: Position3DSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('OpenContainer'),
    position: Position3DSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('DropItem'),
    slotIndex: Schema.Number.pipe(Schema.int(), Schema.between(0, 44)),
    count: Schema.Number.pipe(Schema.int(), Schema.positive()),
  })
)
export type PlayerAction = Schema.Schema.Type<typeof PlayerActionSchema>
```

## 🏗️ 主要インターフェース

### PlayerService - プレイヤー基本操作

```typescript
import { Effect, Context, Schema } from 'effect'

export interface PlayerService {
  // プレイヤー基本操作
  readonly create: (params: Schema.Schema.Type<typeof CreatePlayerParams>) => Effect.Effect<Player, PlayerCreationError>
  readonly findById: (playerId: PlayerId) => Effect.Effect<Player, PlayerNotFoundError>
  readonly updatePosition: (
    params: Schema.Schema.Type<typeof UpdatePositionParams>
  ) => Effect.Effect<Player, InvalidMovementError>
  readonly updateStats: (
    params: Schema.Schema.Type<typeof UpdateStatsParams>
  ) => Effect.Effect<Player, PlayerUpdateError>
  readonly updateGameMode: (
    playerId: PlayerId,
    gameMode: Schema.Schema.Type<typeof GameMode>
  ) => Effect.Effect<Player, PlayerUpdateError>
  readonly delete: (playerId: PlayerId) => Effect.Effect<void, PlayerNotFoundError>

  // インベントリ統合操作
  readonly addItem: (
    playerId: PlayerId,
    item: Schema.Schema.Type<typeof ItemStack>
  ) => Effect.Effect<boolean, InventoryError>
  readonly removeItem: (
    playerId: PlayerId,
    slot: number,
    quantity?: number
  ) => Effect.Effect<ItemStack | null, InventoryError>
  readonly swapItems: (playerId: PlayerId, slot1: number, slot2: number) => Effect.Effect<void, InventoryError>

  // 体力・状態管理
  readonly heal: (playerId: PlayerId, amount: number) => Effect.Effect<Player, never>
  readonly damage: (playerId: PlayerId, amount: number, source: DamageSource) => Effect.Effect<Player, PlayerDeathError>
  readonly feed: (playerId: PlayerId, food: number, saturation: number) => Effect.Effect<Player, never>
  readonly addExperience: (playerId: PlayerId, amount: number) => Effect.Effect<Player, never>

  // クエリ・検索
  readonly findNearbyPlayers: (center: Position3D, radius: number) => Effect.Effect<ReadonlyArray<Player>, never>
  readonly getPlayerCount: () => Effect.Effect<number, never>
  readonly validatePlayerName: (name: string) => Effect.Effect<boolean, ValidationError>
}

export const PlayerService = Context.GenericTag<PlayerService>('@app/PlayerService')
```

### PlayerMovementService - 移動・物理システム

```typescript
export interface PlayerMovementService {
  readonly move: (player: Player, direction: Direction, deltaTime: number) => Effect.Effect<Player, MovementError>

  readonly jump: (player: Player) => Effect.Effect<Player, JumpError>

  readonly applyPhysics: (player: Player, deltaTime: number) => Effect.Effect<Player, never>

  readonly checkCollisions: (player: Player, world: World) => Effect.Effect<CollisionResult, never>

  readonly teleport: (player: Player, destination: Position3D) => Effect.Effect<Player, TeleportError>
}

export const PlayerMovementService = Context.GenericTag<PlayerMovementService>('@app/PlayerMovementService')
```

### PlayerActionProcessor - アクション処理

```typescript
export interface PlayerActionProcessor {
  readonly process: (player: Player, action: PlayerAction) => Effect.Effect<Player, ActionError>

  readonly validateAction: (player: Player, action: PlayerAction) => Effect.Effect<boolean, ValidationError>

  readonly getActionCooldown: (player: Player, actionType: string) => Effect.Effect<number, never>
}

export const PlayerActionProcessor = Context.GenericTag<PlayerActionProcessor>('@app/PlayerActionProcessor')
```

### HealthSystem - 体力・生存システム

```typescript
export interface HealthSystem {
  readonly damage: (player: Player, amount: number, source: DamageSource) => Effect.Effect<Player, PlayerDeathError>

  readonly heal: (player: Player, amount: number) => Effect.Effect<Player, never>

  readonly updateHunger: (player: Player, deltaTime: number) => Effect.Effect<Player, never>

  readonly regenerate: (player: Player, deltaTime: number) => Effect.Effect<Player, never>

  readonly applyStatusEffects: (player: Player, effects: ReadonlyArray<StatusEffect>) => Effect.Effect<Player, never>
}

export const HealthSystem = Context.GenericTag<HealthSystem>('@app/HealthSystem')
```

### InputService - 入力処理

```typescript
export interface InputService {
  readonly processInput: (events: ReadonlyArray<InputEvent>) => Effect.Effect<InputState, never>

  readonly getMovementDirection: (state: InputState) => Effect.Effect<Direction, never>

  readonly getMouseLook: (
    state: InputState,
    sensitivity: number
  ) => Effect.Effect<{ deltaYaw: number; deltaPitch: number }, never>
}

export const InputService = Context.GenericTag<InputService>('@app/InputService')
```

### PlayerSyncService - マルチプレイヤー同期

```typescript
export interface PlayerSyncService {
  readonly sendPlayerUpdate: (player: Player) => Effect.Effect<void, NetworkError>

  readonly receivePlayerUpdates: () => Effect.Effect<ReadonlyArray<PlayerSyncData>, NetworkError>

  readonly interpolatePlayerPosition: (
    playerId: PlayerId,
    currentTime: number
  ) => Effect.Effect<Option.Option<Position3D>, never>

  readonly predictPlayerMovement: (player: Player, input: InputState, deltaTime: number) => Effect.Effect<Player, never>
}

export const PlayerSyncService = Context.GenericTag<PlayerSyncService>('@app/PlayerSyncService')

// Layerベース実装パターン
export const PlayerServiceLive = Layer.effect(
  PlayerService,
  Effect.gen(function* () {
    const repository = yield* PlayerRepository
    const eventBus = yield* EventBus
    const validator = yield* SchemaValidator

    return PlayerService.of({
      create: (params) =>
        Effect.gen(function* () {
          const validated = yield* Schema.decodeUnknown(CreatePlayerParams)(params)
          const player = createPlayerEntity(validated)
          yield* repository.save(player)
          yield* eventBus.publish(PlayerEvent.Created(player))
          return player
        }),
      findById: (playerId) => repository.findById(playerId),
      updatePosition: (params) =>
        Effect.gen(function* () {
          const validated = yield* Schema.decodeUnknown(UpdatePositionParams)(params)
          const player = yield* repository.findById(validated.playerId)
          const updated = yield* updatePlayerPositionLogic(player, validated)
          yield* repository.update(updated)
          return updated
        }),
      updateStats: (params) =>
        Effect.gen(function* () {
          const validated = yield* Schema.decodeUnknown(UpdateStatsParams)(params)
          const player = yield* repository.findById(validated.playerId)
          const updated = PlayerStateUpdates.updateStats(player, validated)
          yield* repository.update(updated)
          return updated
        }),
      delete: (playerId) =>
        Effect.gen(function* () {
          yield* repository.delete(playerId)
          yield* eventBus.publish(PlayerEvent.Deleted({ playerId, timestamp: Date.now() }))
        }),
    })
  })
)

// Schema定義
export const CreatePlayerParamsSchema = Schema.Struct({
  id: PlayerIdSchema,
  name: Schema.String.pipe(
    Schema.minLength(3, { message: () => 'プレイヤー名は3文字以上必要です' }),
    Schema.maxLength(16, { message: () => 'プレイヤー名は16文字以下必要です' }),
    Schema.pattern(/^[a-zA-Z0-9_]+$/, { message: () => 'プレイヤー名は英数字とアンダースコアのみ使用可能です' })
  ),
  position: Schema.Struct({
    x: Schema.Number.pipe(Schema.finite()),
    y: Schema.Number.pipe(Schema.finite(), Schema.between(-256, 320)),
    z: Schema.Number.pipe(Schema.finite()),
  }),
  gameMode: Schema.Union(
    Schema.Literal('survival'),
    Schema.Literal('creative'),
    Schema.Literal('adventure'),
    Schema.Literal('spectator')
  ),
}).pipe(
  Schema.annotations({
    identifier: 'CreatePlayerParams',
    description: 'プレイヤー作成パラメータ',
    examples: [
      {
        id: 'player-123',
        name: 'Steve',
        position: { x: 0, y: 64, z: 0 },
        gameMode: 'survival',
      },
    ],
    jsonSchema: {
      title: 'Create Player Parameters',
      description: 'TypeScriptミネクラフトプレイヤー作成用完全パラメータセット',
    },
  })
)
export type CreatePlayerParams = Schema.Schema.Type<typeof CreatePlayerParamsSchema>

// 高度なバリデーション拡張
export const CreatePlayerParamsWithAdvancedValidationSchema = CreatePlayerParamsSchema.pipe(
  Schema.transform(
    Schema.Struct({
      id: PlayerIdSchema,
      name: PlayerNameSchema,
      position: Schema.Struct({
        x: Schema.Number,
        y: Schema.Number,
        z: Schema.Number,
      }),
      gameMode: Schema.Union(
        Schema.Literal('survival'),
        Schema.Literal('creative'),
        Schema.Literal('adventure'),
        Schema.Literal('spectator')
      ),
      // 拡張フィールド
      initialStats: Schema.optional(
        Schema.Struct({
          health: Schema.Number.pipe(Schema.between(1, 20)),
          hunger: Schema.Number.pipe(Schema.between(0, 20)),
          experience: Schema.Number.pipe(Schema.nonNegative()),
        })
      ),
      spawnProtection: Schema.optional(Schema.Boolean),
    }),
    {
      strict: false,
      decode: (input) => ({
        ...input,
        metadata: {
          createdAt: Date.now(),
          version: '1.0.0',
          clientInfo: process.env.CLIENT_VERSION || 'unknown',
        },
      }),
      encode: (output) => output,
    }
  )
)
export type CreatePlayerParamsWithAdvancedValidation = Schema.Schema.Type<
  typeof CreatePlayerParamsWithAdvancedValidationSchema
>

export const UpdatePositionParamsSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  position: Position3DSchema,
  rotation: RotationSchema,
})
export type UpdatePositionParams = Schema.Schema.Type<typeof UpdatePositionParamsSchema>

export const UpdateStatsParamsSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  health: Schema.optional(Schema.Number.pipe(Schema.between(0, 20))),
  hunger: Schema.optional(Schema.Number.pipe(Schema.between(0, 20))),
  experience: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
})
export type UpdateStatsParams = Schema.Schema.Type<typeof UpdateStatsParamsSchema>
```

### IPlayerMovementService - プレイヤー移動

```typescript
// 移動サービスインターフェース
export interface IPlayerMovementService {
  readonly move: (params: Schema.Schema.Type<typeof MovePlayerParams>) => Effect.Effect<Position3D, MovementError>
  readonly jump: (playerId: PlayerId) => Effect.Effect<Player, JumpError>
  readonly applyPhysics: (playerId: PlayerId, deltaTime: number) => Effect.Effect<Player, never>
  readonly checkCollision: (playerId: PlayerId, newPosition: Position3D) => Effect.Effect<CollisionResult, never>
  readonly teleport: (params: Schema.Schema.Type<typeof TeleportParams>) => Effect.Effect<Player, TeleportError>
}

export const PlayerMovementService = Context.GenericTag<IPlayerMovementService>('@app/PlayerMovementService')

// 移動方向定義
export const DirectionSchema = Schema.Struct({
  forward: Schema.Boolean,
  backward: Schema.Boolean,
  left: Schema.Boolean,
  right: Schema.Boolean,
  jump: Schema.Boolean,
  sneak: Schema.Boolean,
  sprint: Schema.Boolean,
})
export type Direction = Schema.Schema.Type<typeof DirectionSchema>

export const MovePlayerParamsSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  direction: DirectionSchema,
  deltaTime: Schema.Number.pipe(Schema.positive()),
  inputVector: Schema.Struct({
    x: Schema.Number.pipe(Schema.between(-1, 1)),
    z: Schema.Number.pipe(Schema.between(-1, 1)),
  }),
})
export type MovePlayerParams = Schema.Schema.Type<typeof MovePlayerParamsSchema>

export const TeleportParamsSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  destination: Position3DSchema,
  preserveRotation: Schema.optional(Schema.Boolean),
})
export type TeleportParams = Schema.Schema.Type<typeof TeleportParamsSchema>

// 衝突結果
export const CollisionResultSchema = Schema.Struct({
  hasCollision: Schema.Boolean,
  resolvedPosition: Schema.optional(Position3DSchema),
  collisionAxis: Schema.optional(Schema.Union(Schema.Literal('x'), Schema.Literal('y'), Schema.Literal('z'))),
  isOnGround: Schema.Boolean,
})
export type CollisionResult = Schema.Schema.Type<typeof CollisionResultSchema>
```

### IPlayerInventoryService - インベントリ管理

```typescript
// インベントリサービスインターフェース
export interface IPlayerInventoryService {
  readonly addItem: (
    params: Schema.Schema.Type<typeof AddItemParams>
  ) => Effect.Effect<Player, InventoryFullError | InvalidItemError>
  readonly removeItem: (
    params: Schema.Schema.Type<typeof RemoveItemParams>
  ) => Effect.Effect<Option.Option<ItemStack>, ItemNotFoundError>
  readonly moveItem: (params: Schema.Schema.Type<typeof MoveItemParams>) => Effect.Effect<Player, ItemTransferError>
  readonly equipItem: (params: Schema.Schema.Type<typeof EquipItemParams>) => Effect.Effect<Player, EquipError>
  readonly getInventory: (playerId: PlayerId) => Effect.Effect<Inventory, PlayerNotFoundError>
  readonly setSelectedSlot: (playerId: PlayerId, slotIndex: number) => Effect.Effect<Player, InvalidSlotError>
}

export const PlayerInventoryService = Context.GenericTag<IPlayerInventoryService>('@app/PlayerInventoryService')

// インベントリ操作パラメータ
export const AddItemParamsSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  item: Schema.suspend(() => ItemStackSchema),
  preferredSlot: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 35))),
})
export type AddItemParams = Schema.Schema.Type<typeof AddItemParamsSchema>

export const RemoveItemParamsSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  slotIndex: Schema.Number.pipe(Schema.int(), Schema.between(0, 35)),
  count: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
})
export type RemoveItemParams = Schema.Schema.Type<typeof RemoveItemParamsSchema>

export const MoveItemParamsSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  fromSlot: Schema.Number.pipe(Schema.int(), Schema.between(0, 35)),
  toSlot: Schema.Number.pipe(Schema.int(), Schema.between(0, 35)),
  amount: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
})
export type MoveItemParams = Schema.Schema.Type<typeof MoveItemParamsSchema>

export const EquipItemParamsSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  slotIndex: Schema.Number.pipe(Schema.int(), Schema.between(0, 35)),
  equipmentSlot: Schema.Union(
    Schema.Literal('helmet'),
    Schema.Literal('chestplate'),
    Schema.Literal('leggings'),
    Schema.Literal('boots'),
    Schema.Literal('mainHand'),
    Schema.Literal('offHand')
  ),
})
export type EquipItemParams = Schema.Schema.Type<typeof EquipItemParamsSchema>
```

### IPlayerActionProcessor - アクション処理

```typescript
// プレイヤーアクション統合処理
export interface IPlayerActionProcessor {
  readonly process: (playerId: PlayerId, action: PlayerAction) => Effect.Effect<ActionResult, ActionError>
  readonly processSequence: (
    playerId: PlayerId,
    actions: ReadonlyArray<PlayerAction>
  ) => Effect.Effect<ReadonlyArray<ActionResult>, ActionError>
  readonly validateAction: (playerId: PlayerId, action: PlayerAction) => Effect.Effect<boolean, ValidationError>
}

export const PlayerActionProcessor = Context.GenericTag<IPlayerActionProcessor>('@app/PlayerActionProcessor')

// プレイヤーアクション定義（Tagged Union）
export const PlayerActionSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Move'),
    direction: DirectionSchema,
    deltaTime: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Jump'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlaceBlock'),
    position: Position3DSchema,
    blockType: Schema.String.pipe(Schema.brand('BlockType')),
    face: Schema.Union(
      Schema.Literal('top'),
      Schema.Literal('bottom'),
      Schema.Literal('north'),
      Schema.Literal('south'),
      Schema.Literal('east'),
      Schema.Literal('west')
    ),
  }),
  Schema.Struct({
    _tag: Schema.Literal('BreakBlock'),
    position: Position3DSchema,
    tool: Schema.optional(Schema.String.pipe(Schema.brand('ItemId'))),
  }),
  Schema.Struct({
    _tag: Schema.Literal('UseItem'),
    item: Schema.String.pipe(Schema.brand('ItemId')),
    target: Schema.optional(Position3DSchema),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Attack'),
    target: Schema.String.pipe(Schema.brand('EntityId')),
    weapon: Schema.optional(Schema.String.pipe(Schema.brand('ItemId'))),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Interact'),
    target: Schema.Union(
      Schema.Struct({
        type: Schema.Literal('block'),
        position: Position3DSchema,
      }),
      Schema.Struct({
        type: Schema.Literal('entity'),
        entityId: Schema.String.pipe(Schema.brand('EntityId')),
      })
    ),
  })
)
export type PlayerAction = Schema.Schema.Type<typeof PlayerActionSchema>

export const ActionResultSchema = Schema.Struct({
  success: Schema.Boolean,
  timestamp: Schema.Number,
  result: Schema.optional(Schema.Unknown),
  sideEffects: Schema.optional(
    Schema.Array(
      Schema.Struct({
        type: Schema.String,
        description: Schema.String,
        data: Schema.Unknown,
      })
    )
  ),
})
export type ActionResult = Schema.Schema.Type<typeof ActionResultSchema>
```

### IPlayerHealthSystem - 体力・空腹度管理

```typescript
// 体力システムインターフェース
export interface IPlayerHealthSystem {
  readonly damage: (params: Schema.Schema.Type<typeof DamageParams>) => Effect.Effect<Player, PlayerDeathError>
  readonly heal: (params: Schema.Schema.Type<typeof HealParams>) => Effect.Effect<Player, never>
  readonly feed: (params: Schema.Schema.Type<typeof FeedParams>) => Effect.Effect<Player, never>
  readonly updateHunger: (playerId: PlayerId, deltaTime: number) => Effect.Effect<Player, never>
  readonly regenerate: (playerId: PlayerId, deltaTime: number) => Effect.Effect<Player, never>
  readonly applyStatusEffect: (
    params: Schema.Schema.Type<typeof StatusEffectParams>
  ) => Effect.Effect<Player, InvalidEffectError>
}

export const PlayerHealthSystem = Context.GenericTag<IPlayerHealthSystem>('@app/PlayerHealthSystem')

// 体力関連パラメータ
export const DamageParamsSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  amount: Schema.Number.pipe(Schema.nonNegative()),
  source: Schema.Union(
    Schema.Literal('fall'),
    Schema.Literal('fire'),
    Schema.Literal('drowning'),
    Schema.Literal('suffocation'),
    Schema.Literal('mob'),
    Schema.Literal('player'),
    Schema.Literal('environment'),
    Schema.Literal('void')
  ),
  damageType: Schema.Union(
    Schema.Literal('direct'),
    Schema.Literal('magic'),
    Schema.Literal('projectile'),
    Schema.Literal('explosion')
  ),
})
export type DamageParams = Schema.Schema.Type<typeof DamageParamsSchema>

export const HealParamsSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  amount: Schema.Number.pipe(Schema.positive()),
  source: Schema.Union(
    Schema.Literal('food'),
    Schema.Literal('potion'),
    Schema.Literal('regeneration'),
    Schema.Literal('command')
  ),
})
export type HealParams = Schema.Schema.Type<typeof HealParamsSchema>

export const FeedParamsSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  hunger: Schema.Number.pipe(Schema.between(0, 20)),
  saturation: Schema.Number.pipe(Schema.between(0, 20)),
})
export type FeedParams = Schema.Schema.Type<typeof FeedParamsSchema>

export const StatusEffectParamsSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  effect: Schema.Struct({
    type: Schema.Union(
      Schema.Literal('speed'),
      Schema.Literal('slowness'),
      Schema.Literal('jump_boost'),
      Schema.Literal('regeneration'),
      Schema.Literal('poison'),
      Schema.Literal('night_vision'),
      Schema.Literal('invisibility')
    ),
    amplifier: Schema.Number.pipe(Schema.int(), Schema.between(0, 255)),
    duration: Schema.Number.pipe(Schema.positive()), // ティック数
  }),
})
export type StatusEffectParams = Schema.Schema.Type<typeof StatusEffectParamsSchema>
```

## メソッド詳細

### プレイヤー作成・管理

#### createPlayer

```typescript
// プレイヤーの新規作成
const createPlayer = (params: CreatePlayerParams) =>
  Effect.gen(function* () {
    // パラメータバリデーション
    const validated = yield* Schema.decodeUnknownSync(CreatePlayerParams)(params)

    // 名前重複チェック
    const existing = yield* PlayerRepository.pipe(
      Effect.flatMap((repo) => repo.findByName(validated.name)),
      Effect.option
    )

    yield* pipe(
      existing,
      Option.match({
        onNone: () => Effect.unit,
        onSome: () =>
          Effect.fail(
            PlayerCreationError({
              message: 'Player name already exists',
              playerName: validated.name,
            })
          ),
      })
    )

    // プレイヤー作成
    const player = {
      id: validated.id,
      name: validated.name,
      position: validated.position,
      rotation: { yaw: 0, pitch: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      stats: {
        health: 20,
        hunger: 20,
        saturation: 5,
        experience: 0,
        level: 0,
        armor: 0,
      },
      inventory: createEmptyInventory(),
      equipment: createEmptyEquipment(),
      gameMode: validated.gameMode,
      abilities: determineAbilities(validated.gameMode),
    }

    // 保存
    yield* PlayerRepository.pipe(Effect.flatMap((repo) => repo.save(player)))

    // イベント発行
    yield* EventBus.pipe(
      Effect.flatMap((bus) =>
        bus.publish({
          _tag: 'PlayerCreated',
          playerId: player.id,
          position: player.position,
        })
      )
    )

    return player
  })

// 使用例
const result =
  yield *
  PlayerService.pipe(
    Effect.flatMap((service) =>
      service.create({
        id: 'player-123',
        name: 'Steve',
        position: { x: 0, y: 64, z: 0 },
        gameMode: 'survival',
      })
    )
  )
```

#### updatePlayerPosition

```typescript
// プレイヤー位置更新
const updatePlayerPosition = (params: UpdatePositionParams) =>
  Effect.gen(function* () {
    const validated = yield* Schema.decodeUnknownSync(UpdatePositionParams)(params)

    const player = yield* PlayerRepository.pipe(Effect.flatMap((repo) => repo.findById(validated.playerId)))

    // 移動距離チェック
    const distance = calculateDistance(player.position, validated.position)
    const maxDistance = player.gameMode === 'creative' ? 100 : 10

    if (distance > maxDistance) {
      return yield* Effect.fail(
        InvalidMovementError({
          message: 'Movement distance too large',
          playerId: validated.playerId,
          actualDistance: distance,
          maxAllowed: maxDistance,
        })
      )
    }

    // 衝突チェック
    const collision = yield* PlayerMovementService.pipe(
      Effect.flatMap((service) => service.checkCollision(validated.playerId, validated.position))
    )

    const finalPosition = collision.hasCollision ? (collision.resolvedPosition ?? player.position) : validated.position

    // 更新
    const updatedPlayer = {
      ...player,
      position: finalPosition,
      rotation: validated.rotation,
    }

    yield* PlayerRepository.pipe(Effect.flatMap((repo) => repo.update(updatedPlayer)))

    return updatedPlayer
  })
```

### プレイヤー移動と物理演算

#### movePlayer

```typescript
// プレイヤー移動処理
const movePlayer = (params: MovePlayerParams) =>
  Effect.gen(function* () {
    const validated = yield* Schema.decodeUnknownSync(MovePlayerParams)(params)

    const player = yield* PlayerRepository.pipe(Effect.flatMap((repo) => repo.findById(validated.playerId)))

    // 移動速度計算
    const baseSpeed =
      player.gameMode === 'creative' && player.abilities.isFlying
        ? player.abilities.flySpeed
        : player.abilities.walkSpeed

    const sprintMultiplier = validated.direction.sprint && player.stats.hunger > 6 ? 1.3 : 1.0
    const finalSpeed = baseSpeed * sprintMultiplier

    // 移動ベクトル計算
    const moveVector = calculateMovementVector(validated.direction, player.rotation, finalSpeed, validated.deltaTime)

    // 新しい位置計算
    const newPosition = {
      x: player.position.x + moveVector.x,
      y: player.position.y + moveVector.y,
      z: player.position.z + moveVector.z,
    }

    // 物理演算適用
    const physicsResult = yield* PlayerMovementService.pipe(
      Effect.flatMap((service) => service.applyPhysics(validated.playerId, validated.deltaTime))
    )

    // 空腹度減少（スプリント時）
    const updatedStats = validated.direction.sprint
      ? { ...player.stats, hunger: Math.max(0, player.stats.hunger - 0.1 * validated.deltaTime) }
      : player.stats

    const updatedPlayer = {
      ...physicsResult,
      position: newPosition,
      stats: updatedStats,
    }

    yield* PlayerRepository.pipe(Effect.flatMap((repo) => repo.update(updatedPlayer)))

    return newPosition
  })

// 使用例
const newPosition =
  yield *
  PlayerMovementService.pipe(
    Effect.flatMap((service) =>
      service.move({
        playerId: 'player-123',
        direction: {
          forward: true,
          backward: false,
          left: false,
          right: false,
          jump: false,
          sneak: false,
          sprint: true,
        },
        deltaTime: 0.016, // 60 FPS
        inputVector: { x: 0, z: 1 },
      })
    )
  )
```

#### jumpPlayer

```typescript
// プレイヤージャンプ処理
const jumpPlayer = (playerId: PlayerId) =>
  Effect.gen(function* () {
    const player = yield* PlayerRepository.pipe(Effect.flatMap((repo) => repo.findById(playerId)))

    // 地面判定
    const collision = yield* PlayerMovementService.pipe(
      Effect.flatMap((service) => service.checkCollision(playerId, player.position))
    )

    if (!collision.isOnGround && player.gameMode !== 'creative') {
      return yield* Effect.fail(
        JumpError({
          message: 'Player is not on ground',
          playerId,
        })
      )
    }

    // ジャンプ力計算
    const jumpVelocity = player.gameMode === 'creative' ? 0.5 : 0.42

    // ジャンプブーストエフェクト考慮
    const jumpBoost = getActiveStatusEffect(player, 'jump_boost')
    const finalJumpVelocity = jumpBoost ? jumpVelocity * (1 + jumpBoost.amplifier * 0.1) : jumpVelocity

    // 空腹度消費
    const newHunger = Math.max(0, player.stats.hunger - 0.05)

    const updatedPlayer = {
      ...player,
      velocity: {
        ...player.velocity,
        y: finalJumpVelocity,
      },
      stats: {
        ...player.stats,
        hunger: newHunger,
      },
    }

    yield* PlayerRepository.pipe(Effect.flatMap((repo) => repo.update(updatedPlayer)))

    return updatedPlayer
  })
```

### インベントリ操作

#### addItemToInventory

```typescript
// アイテムをインベントリに追加
const addItemToInventory = (params: AddItemParams) =>
  Effect.gen(function* () {
    const validated = yield* Schema.decodeUnknownSync(AddItemParams)(params)

    const player = yield* PlayerRepository.pipe(Effect.flatMap((repo) => repo.findById(validated.playerId)))

    // スタック可能チェック
    const stackableSlot = findStackableSlot(player.inventory, validated.item)

    return yield* Match.value(stackableSlot).pipe(
      Match.when(Option.isSome, ({ value: slot }) =>
        Effect.gen(function* () {
          // 既存スタックに追加
          const maxStack = getMaxStackSize(validated.item.itemId)
          const canAdd = Math.min(validated.item.count, maxStack - slot.item.count)

          if (canAdd === 0) {
            return yield* Effect.fail(
              InventoryFullError({
                message: 'Cannot stack more items',
                playerId: validated.playerId,
              })
            )
          }

          const updatedStack = {
            ...slot.item,
            count: slot.item.count + canAdd,
          }

          const updatedSlots = [...player.inventory.slots]
          updatedSlots[slot.index] = updatedStack

          const updatedPlayer = {
            ...player,
            inventory: {
              ...player.inventory,
              slots: updatedSlots,
            },
          }

          yield* PlayerRepository.pipe(Effect.flatMap((repo) => repo.update(updatedPlayer)))

          // 残りアイテムがあれば再帰的に追加
          if (canAdd < validated.item.count) {
            const remainingItem = {
              ...validated.item,
              count: validated.item.count - canAdd,
            }
            return yield* addItemToInventory({
              playerId: validated.playerId,
              item: remainingItem,
            })
          }

          return updatedPlayer
        })
      ),
      Match.orElse(() =>
        Effect.gen(function* () {
          // 空きスロットを探す
          const emptySlot = findEmptySlot(player.inventory)

          if (Option.isNone(emptySlot)) {
            return yield* Effect.fail(
              InventoryFullError({
                message: 'No empty slots available',
                playerId: validated.playerId,
              })
            )
          }

          const updatedSlots = [...player.inventory.slots]
          updatedSlots[emptySlot.value] = validated.item

          const updatedPlayer = {
            ...player,
            inventory: {
              ...player.inventory,
              slots: updatedSlots,
            },
          }

          yield* PlayerRepository.pipe(Effect.flatMap((repo) => repo.update(updatedPlayer)))

          return updatedPlayer
        })
      )
    )
  })

// 使用例
const result =
  yield *
  PlayerInventoryService.pipe(
    Effect.flatMap((service) =>
      service.addItem({
        playerId: 'player-123',
        item: {
          itemId: 'minecraft:stone',
          count: 32,
          durability: 1.0,
        },
      })
    )
  )
```

### 体力・空腹度システム

#### damagePlayer

```typescript
// プレイヤーダメージ処理
const damagePlayer = (params: DamageParams) =>
  Effect.gen(function* () {
    const validated = yield* Schema.decodeUnknownSync(DamageParams)(params)

    const player = yield* PlayerRepository.pipe(Effect.flatMap((repo) => repo.findById(validated.playerId)))

    // 無敵判定
    if (player.abilities.invulnerable) {
      return player
    }

    // アーマー計算
    const armorReduction = calculateArmorReduction(player.stats.armor, validated.damageType)

    const finalDamage = Math.max(0, validated.amount - armorReduction)
    const newHealth = Math.max(0, player.stats.health - finalDamage)

    // 死亡判定
    if (newHealth === 0) {
      yield* handlePlayerDeath(player, validated.source)
      return yield* Effect.fail(
        PlayerDeathError({
          message: 'Player died',
          playerId: validated.playerId,
          cause: validated.source,
        })
      )
    }

    const updatedPlayer = {
      ...player,
      stats: {
        ...player.stats,
        health: newHealth,
      },
    }

    yield* PlayerRepository.pipe(Effect.flatMap((repo) => repo.update(updatedPlayer)))

    // ダメージイベント発行
    yield* EventBus.pipe(
      Effect.flatMap((bus) =>
        bus.publish({
          _tag: 'PlayerDamaged',
          playerId: validated.playerId,
          damage: finalDamage,
          source: validated.source,
          newHealth,
        })
      )
    )

    return updatedPlayer
  })

// 使用例
const result =
  yield *
  PlayerHealthSystem.pipe(
    Effect.flatMap((service) =>
      service.damage({
        playerId: 'player-123',
        amount: 5,
        source: 'fall',
        damageType: 'direct',
      })
    )
  )
```

## プレイヤー状態管理

### プレイヤー状態定義

```typescript
// プレイヤーエンティティ完全定義
export const PlayerDetailedSchema = Schema.Struct({
  // 基本情報
  id: PlayerIdSchema,
  name: PlayerNameSchema,

  // 位置・回転
  position: Position3DSchema,
  rotation: RotationSchema,
  velocity: Velocity3DSchema,

  // ステータス
  stats: PlayerStatsSchema,

  // インベントリ・装備
  inventory: Schema.suspend(() => InventorySchema),
  equipment: Schema.suspend(() => EquipmentSchema),

  // ゲーム設定
  gameMode: Schema.Union(
    Schema.Literal('survival'),
    Schema.Literal('creative'),
    Schema.Literal('adventure'),
    Schema.Literal('spectator')
  ),

  abilities: Schema.Struct({
    canFly: Schema.Boolean,
    isFlying: Schema.Boolean,
    canBreakBlocks: Schema.Boolean,
    canPlaceBlocks: Schema.Boolean,
    invulnerable: Schema.Boolean,
    walkSpeed: Schema.Number.pipe(Schema.positive()),
    flySpeed: Schema.Number.pipe(Schema.positive()),
  }),

  // ステータスエフェクト
  statusEffects: Schema.Array(
    Schema.Struct({
      type: Schema.String,
      amplifier: Schema.Number.pipe(Schema.int(), Schema.between(0, 255)),
      duration: Schema.Number.pipe(Schema.positive()),
      showParticles: Schema.Boolean,
      showIcon: Schema.Boolean,
    })
  ),

  // メタデータ
  metadata: Schema.Struct({
    lastLogin: Schema.Number,
    playtime: Schema.Number,
    worldId: Schema.String.pipe(Schema.brand('WorldId')),
    bedPosition: Schema.optional(Position3DSchema),
  }),
})
export type PlayerDetailed = Schema.Schema.Type<typeof PlayerDetailedSchema>
```

### 状態更新パターン

```typescript
// 状態更新の型安全なパターン
export const PlayerStateUpdates = {
  // 部分更新（不変性保持）
  updatePosition: (player: Player, newPosition: Position3D): Player => ({
    ...player,
    position: newPosition,
  }),

  updateStats: (player: Player, statsUpdate: Partial<PlayerStats>): Player => ({
    ...player,
    stats: { ...player.stats, ...statsUpdate },
  }),

  addStatusEffect: (player: Player, effect: StatusEffect): Player => ({
    ...player,
    statusEffects: [...player.statusEffects, effect],
  }),

  removeStatusEffect: (player: Player, effectType: string): Player => ({
    ...player,
    statusEffects: player.statusEffects.filter((e) => e.type !== effectType),
  }),
}
```

## イベントシステム

### プレイヤーイベント定義

```typescript
// プレイヤー関連イベント
export const PlayerEventSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('PlayerCreated'),
    playerId: PlayerIdSchema,
    position: Position3DSchema,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlayerMoved'),
    playerId: PlayerIdSchema,
    from: Position3DSchema,
    to: Position3DSchema,
    distance: Schema.Number,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlayerJumped'),
    playerId: PlayerIdSchema,
    position: Position3DSchema,
    jumpHeight: Schema.Number,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlayerDamaged'),
    playerId: PlayerIdSchema,
    damage: Schema.Number,
    source: Schema.String,
    newHealth: Schema.Number,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlayerHealed'),
    playerId: PlayerIdSchema,
    amount: Schema.Number,
    newHealth: Schema.Number,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlayerDied'),
    playerId: PlayerIdSchema,
    cause: Schema.String,
    position: Position3DSchema,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlayerInventoryChanged'),
    playerId: PlayerIdSchema,
    slotIndex: Schema.Number,
    oldItem: Schema.Union(
      Schema.suspend(() => ItemStackSchema),
      Schema.Null
    ),
    newItem: Schema.Union(
      Schema.suspend(() => ItemStackSchema),
      Schema.Null
    ),
    timestamp: Schema.Number,
  })
)
export type PlayerEvent = Schema.Schema.Type<typeof PlayerEventSchema>

// イベントハンドラー例
export const PlayerEventHandlers = {
  onPlayerMoved: (event: Extract<PlayerEvent, { _tag: 'PlayerMoved' }>) =>
    Effect.gen(function* () {
      // チャンク境界チェック
      const oldChunk = positionToChunk(event.from)
      const newChunk = positionToChunk(event.to)

      if (!chunkPositionEquals(oldChunk, newChunk)) {
        yield* ChunkLoader.pipe(Effect.flatMap((loader) => loader.loadChunk(newChunk)))
      }

      // 近くのプレイヤーに同期
      yield* PlayerSyncService.pipe(Effect.flatMap((sync) => sync.broadcastPlayerPosition(event.playerId, event.to)))
    }),

  onPlayerDamaged: (event: Extract<PlayerEvent, { _tag: 'PlayerDamaged' }>) =>
    Effect.gen(function* () {
      // ダメージエフェクト表示
      yield* EffectRenderer.pipe(Effect.flatMap((renderer) => renderer.showDamageEffect(event.playerId, event.damage)))

      // 低体力警告
      if (event.newHealth <= 4) {
        yield* NotificationService.pipe(
          Effect.flatMap((service) => service.showWarning(event.playerId, '体力が少なくなっています！'))
        )
      }
    }),
}
```

## マルチプレイヤー対応

### プレイヤー同期サービス

```typescript
// マルチプレイヤー同期
export interface IPlayerSyncService {
  readonly sendPlayerUpdate: (playerId: PlayerId) => Effect.Effect<void, NetworkError>
  readonly receivePlayerUpdates: () => Effect.Effect<ReadonlyArray<PlayerSyncData>, NetworkError>
  readonly interpolatePlayerPosition: (
    playerId: PlayerId,
    timestamp: number
  ) => Effect.Effect<Option.Option<Position3D>, never>
  readonly predictPlayerMovement: (
    playerId: PlayerId,
    input: InputState,
    deltaTime: number
  ) => Effect.Effect<Player, never>
}

export const PlayerSyncService = Context.GenericTag<IPlayerSyncService>('@app/PlayerSyncService')

// 同期データ定義
export const PlayerSyncDataSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  position: Position3DSchema,
  rotation: RotationSchema,
  velocity: Velocity3DSchema,
  animationState: Schema.String,
  timestamp: Schema.Number,
  sequenceNumber: Schema.Number,
})
export type PlayerSyncData = Schema.Schema.Type<typeof PlayerSyncDataSchema>

// クライアント側予測
const predictPlayerMovement = (playerId: PlayerId, input: InputState, deltaTime: number) =>
  Effect.gen(function* () {
    const player = yield* PlayerRepository.pipe(Effect.flatMap((repo) => repo.findById(playerId)))

    // ローカル予測実行
    const movement = determineMovementFromInput(input)
    const predictedPlayer = yield* PlayerMovementService.pipe(
      Effect.flatMap((service) =>
        service.move({
          playerId,
          direction: movement,
          deltaTime,
          inputVector: input.movementVector,
        })
      )
    )

    // 予測結果をサーバーに送信
    yield* PlayerSyncService.pipe(Effect.flatMap((sync) => sync.sendPlayerUpdate(playerId)))

    return predictedPlayer
  })

// サーバー権威調整
const reconcileServerUpdate = (playerId: PlayerId, serverData: PlayerSyncData) =>
  Effect.gen(function* () {
    const localPlayer = yield* PlayerRepository.pipe(Effect.flatMap((repo) => repo.findById(playerId)))

    // 位置差分チェック
    const positionDiff = calculateDistance(localPlayer.position, serverData.position)

    // 閾値を超えている場合はサーバー位置を採用
    if (positionDiff > POSITION_SYNC_THRESHOLD) {
      const correctedPlayer = {
        ...localPlayer,
        position: serverData.position,
        rotation: serverData.rotation,
      }

      yield* PlayerRepository.pipe(Effect.flatMap((repo) => repo.update(correctedPlayer)))

      return correctedPlayer
    }

    return localPlayer
  })
```

## 使用例とベストプラクティス

### プレイヤーAPIテストパターン

#### 単体テスト例（@effect/vitest統合）

```typescript
import { Effect, TestContext, Layer } from 'effect'
import { describe, it, expect } from '@effect/vitest'

// テスト専用Layerの作成
const TestPlayerServiceLayer = Layer.succeed(
  PlayerService,
  PlayerService.of({
    create: (params) => Effect.succeed(mockPlayer(params)),
    findById: (id) => Effect.succeed(mockPlayer({ id })),
    updatePosition: () => Effect.succeed(mockPlayer()),
    updateStats: () => Effect.succeed(mockPlayer()),
    delete: () => Effect.unit,
  })
)

describe('Player API', () => {
  it('should create player successfully', () =>
    Effect.gen(function* () {
      const service = yield* PlayerService
      const result = yield* service.create({
        id: 'test-player',
        name: 'TestSteve',
        position: { x: 0, y: 64, z: 0 },
        gameMode: 'creative',
      })

      expect(result.id).toBe('test-player')
      expect(result.name).toBe('TestSteve')
      expect(result.gameMode).toBe('creative')
    }).pipe(Effect.provide(TestPlayerServiceLayer)))

  it('should handle player not found error', () =>
    Effect.gen(function* () {
      const service = yield* PlayerService
      const result = yield* service.findById('nonexistent').pipe(Effect.exit)

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        expect(result.cause._tag).toBe('PlayerNotFoundError')
      }
    }).pipe(Effect.provide(TestPlayerServiceLayer)))
})

// Property-based testing with fast-check
import * as fc from 'fast-check'

const PlayerIdArb = fc.string({ minLength: 5, maxLength: 20 })
const PositionArb = fc.record({
  x: fc.double({ min: -1000, max: 1000 }),
  y: fc.double({ min: -256, max: 320 }),
  z: fc.double({ min: -1000, max: 1000 }),
})

const CreatePlayerParamsArb = fc.record({
  id: PlayerIdArb,
  name: fc.string({ minLength: 3, maxLength: 16 }).filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
  position: PositionArb,
  gameMode: fc.constantFrom('survival', 'creative', 'adventure', 'spectator'),
})

describe('Player Creation Property Tests', () => {
  it('should always create valid players from valid params', () =>
    fc.assert(
      fc.asyncProperty(CreatePlayerParamsArb, (params) =>
        Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* PlayerService
            const player = yield* service.create(params)

            return {
              hasValidId: typeof player.id === 'string' && player.id.length > 0,
              hasValidName: typeof player.name === 'string' && player.name === params.name,
              hasValidPosition: player.position.x === params.position.x,
              hasValidGameMode: player.gameMode === params.gameMode,
            }
          }).pipe(Effect.provide(TestPlayerServiceLayer))
        )

        expect(result.hasValidId).toBe(true)
        expect(result.hasValidName).toBe(true)
        expect(result.hasValidPosition).toBe(true)
        expect(result.hasValidGameMode).toBe(true)
      })
    ))
})
```

#### 統合テスト例（リアルデータベース使用）

```typescript
import { PgClient, SqlSchema } from '@effect/sql'
import { TestContainer } from 'testcontainers'

const TestDatabaseLayer = Layer.scoped(
  PgClient.PgClient,
  Effect.gen(function* () {
    // テスト用PostgreSQLコンテナ起動
    const container = yield* Effect.promise(() =>
      new TestContainer('postgres:15')
        .withEnvironment({
          POSTGRES_DB: 'minecraft_test',
          POSTGRES_USER: 'test',
          POSTGRES_PASSWORD: 'test',
        })
        .start()
    )

    const client = yield* PgClient.make({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      username: 'test',
      password: 'test',
      database: 'minecraft_test',
    })

    // テーブル作成
    yield* SqlSchema.make({
      client,
      migrations: [
        `CREATE TABLE players (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          position_x REAL NOT NULL,
          position_y REAL NOT NULL,
          position_z REAL NOT NULL,
          game_mode TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )`,
      ],
    })

    return client
  })
)

describe('Player Integration Tests', () => {
  it('should persist player to database', () =>
    Effect.gen(function* () {
      const service = yield* PlayerService

      const created = yield* service.create({
        id: 'integration-test-player',
        name: 'IntegrationSteve',
        position: { x: 100, y: 64, z: 200 },
        gameMode: 'survival',
      })

      const retrieved = yield* service.findById(created.id)

      expect(retrieved.id).toBe(created.id)
      expect(retrieved.name).toBe(created.name)
      expect(retrieved.position).toEqual(created.position)
    }).pipe(Effect.provide(Layer.merge(PlayerSystemLayer, TestDatabaseLayer))))
})
```

### 基本的なプレイヤー操作

```typescript
// プレイヤー作成からログアウトまでの完全な流れ
const playerLifecycle = Effect.gen(function* () {
  // 1. プレイヤー作成
  const player = yield* PlayerService.pipe(
    Effect.flatMap((service) =>
      service.create({
        id: generatePlayerId(),
        name: 'Steve',
        position: { x: 0, y: 64, z: 0 },
        gameMode: 'survival',
      })
    )
  )

  // 2. 初期装備配布
  yield* PlayerInventoryService.pipe(
    Effect.flatMap((service) =>
      service.addItem({
        playerId: player.id,
        item: {
          itemId: 'minecraft:wooden_sword',
          count: 1,
          durability: 1.0,
        },
      })
    )
  )

  // 3. ゲームループ（移動・アクション処理）
  yield* Effect.repeat(
    Effect.gen(function* () {
      // 入力処理
      const input = yield* InputService.pipe(Effect.flatMap((service) => service.getCurrentInput()))

      // プレイヤーアクション処理
      const actions = yield* InputService.pipe(Effect.flatMap((service) => service.inputToActions(input)))

      // アクション実行
      yield* Effect.forEach(
        actions,
        (action) => PlayerActionProcessor.pipe(Effect.flatMap((processor) => processor.process(player.id, action))),
        { concurrency: 1 }
      )

      // 物理更新
      yield* PlayerMovementService.pipe(Effect.flatMap((service) => service.applyPhysics(player.id, 0.016)))

      // 体力システム更新
      yield* PlayerHealthSystem.pipe(Effect.flatMap((system) => system.updateHunger(player.id, 0.016)))
    }),
    Schedule.spaced('16 millis') // 60 FPS
  )
})

// エラーハンドリング付きの安全な実行
const safePlayerOperation = playerLifecycle.pipe(
  Effect.catchTags({
    PlayerCreationError: (error) => Effect.logError(`プレイヤー作成失敗: ${error.message}`),
    MovementError: (error) => Effect.logWarning(`移動エラー: ${error.message}`),
    InventoryError: (error) => Effect.logInfo(`インベントリエラー: ${error.message}`),
  }),
  Effect.retry(Schedule.exponential('100 millis').pipe(Schedule.recurs(3)))
)
```

### パフォーマンス最適化

```typescript
// バッチ処理によるパフォーマンス最適化
const batchPlayerUpdates = (playerIds: ReadonlyArray<PlayerId>, deltaTime: number) =>
  Effect.gen(function* () {
    // 並列処理でプレイヤー更新
    const results = yield* Effect.all(
      playerIds.map((playerId) =>
        Effect.all(
          [
            PlayerMovementService.pipe(Effect.flatMap((service) => service.applyPhysics(playerId, deltaTime))),
            PlayerHealthSystem.pipe(Effect.flatMap((system) => system.updateHunger(playerId, deltaTime))),
            PlayerHealthSystem.pipe(Effect.flatMap((system) => system.regenerate(playerId, deltaTime))),
          ],
          { concurrency: 3 }
        )
      ),
      { concurrency: 8, batching: true } // バッチサイズ制限
    )

    // 結果統合
    return results.map(([movement, hunger, regen]) => ({
      movement,
      hunger,
      regen,
    }))
  })

// メモリ効率的なプレイヤーキャッシュ
const PlayerCache = Effect.gen(function* () {
  const cache = yield* Cache.make({
    capacity: 1000,
    timeToLive: '5 minutes',
    lookup: (playerId: PlayerId) => PlayerRepository.pipe(Effect.flatMap((repo) => repo.findById(playerId))),
  })

  return {
    getPlayer: (playerId: PlayerId) => Cache.get(cache, playerId),
    invalidatePlayer: (playerId: PlayerId) => Cache.invalidate(cache, playerId),
    refreshPlayer: (playerId: PlayerId) => Cache.refresh(cache, playerId),
  }
})
```

## エラーハンドリング

### プレイヤーシステムエラー

```typescript
// プレイヤーシステム固有エラー
export namespace PlayerSystemErrors {
  export const PlayerNotFoundError = Schema.TaggedError('PlayerSystem.PlayerNotFoundError')<{
    readonly playerId: string
    readonly searchContext: string
    readonly timestamp: number
  }>

  export const InvalidMovementError = Schema.TaggedError('PlayerSystem.InvalidMovementError')<{
    readonly playerId: string
    readonly currentPosition: Position3D
    readonly targetPosition: Position3D
    readonly reason: string
    readonly maxAllowedDistance: number
    readonly actualDistance: number
    readonly timestamp: number
  }>

  export const InventoryFullError = Schema.TaggedError('PlayerSystem.InventoryFullError')<{
    readonly playerId: string
    readonly inventoryId: string
    readonly attemptedItem: string
    readonly availableSlots: number
    readonly timestamp: number
  }>

  export const PlayerDeathError = Schema.TaggedError('PlayerSystem.PlayerDeathError')<{
    readonly playerId: string
    readonly cause: string
    readonly position: Position3D
    readonly timestamp: number
  }>
}

// エラーハンドリングパターン
export const handlePlayerError = <A>(
  effect: Effect.Effect<A, PlayerSystemErrors.PlayerNotFoundError | PlayerSystemErrors.InvalidMovementError>
): Effect.Effect<A | null, never> =>
  effect.pipe(
    Effect.catchTags({
      'PlayerSystem.PlayerNotFoundError': (error) =>
        Effect.gen(function* () {
          yield* Effect.logError(`プレイヤーが見つかりません: ${error.playerId}`)
          yield* NotificationService.pipe(Effect.flatMap((service) => service.showError('プレイヤーが見つかりません')))
          return null
        }),
      'PlayerSystem.InvalidMovementError': (error) =>
        Effect.gen(function* () {
          yield* Effect.logWarning(`不正な移動: ${error.reason}`)
          // プレイヤーを前の位置に戻す
          yield* PlayerService.pipe(
            Effect.flatMap((service) =>
              service.updatePosition({
                playerId: error.playerId,
                position: error.currentPosition,
                rotation: { yaw: 0, pitch: 0 },
              })
            )
          )
          return null
        }),
    })
  )
```

## サービス統合

### Layer定義

```typescript
// プレイヤーシステム全体のLayer構成
export const PlayerSystemLayer = Layer.mergeAll(
  PlayerServiceLive,
  PlayerMovementServiceLive,
  PlayerInventoryServiceLive,
  PlayerActionProcessorLive,
  PlayerHealthSystemLive,
  PlayerSyncServiceLive
).pipe(
  Layer.provide(
    Layer.mergeAll(
      PlayerRepositoryLive,
      EventBusServiceLive,
      PhysicsServiceLive,
      CollisionServiceLive,
      NetworkServiceLive
    )
  )
)

// アプリケーション全体での使用
export const MinecraftApp = Effect.gen(function* () {
  // プレイヤーシステム初期化
  const playerService = yield* PlayerService
  const movementService = yield* PlayerMovementService

  // メインゲームループ
  yield* gameLoop
}).pipe(Effect.provide(PlayerSystemLayer))
```

## 関連ドキュメント

**Core Systems**:

- [Player System Specification](../../explanations/game-mechanics/core-features/player-system.md) - プレイヤーシステム詳細仕様
- [Inventory System](../../explanations/game-mechanics/core-features/inventory-system.md) - インベントリシステム仕様
- [Health & Hunger System](../../explanations/game-mechanics/core-features/health-hunger-system.md) - 体力・空腹度システム

**API Design**:

- [Domain & Application APIs](../../explanations/architecture/domain-application-apis.md) - ドメイン・アプリケーション層API
- [Event Bus Specification](../../explanations/architecture/event-bus-specification.md) - イベントバス仕様

**Architecture**:

- [Effect-TS Patterns](../../explanations/design-patterns/README.md) - Effect-TSパターン詳細
- [Architecture Overview](../../explanations/architecture/README.md) - アーキテクチャ概要

**Reference**:

- [Effect-TS Schema API](./effect-ts-schema-api.md) - Schema API詳細
- [Game World API](./game-world-api.md) - ワールド管理API

## 用語集

- **Aggregate (アグリゲート)**: DDDにおけるビジネスルール管理単位 ([詳細](../reference/glossary.md#aggregate))
- **Effect (エフェクト)**: Effect-TSの副作用管理型 ([詳細](../reference/glossary.md#effect))
- **Entity Component System (ECS)**: ゲーム開発アーキテクチャ ([詳細](../reference/glossary.md#ecs))
- **Schema (スキーマ)**: Effect-TSの型安全なデータ定義 ([詳細](../reference/glossary.md#schema))
- **Service (サービス)**: ビジネスロジックを含むオブジェクト ([詳細](../reference/glossary.md#service))

このAPIリファレンスにより、TypeScript Minecraftクローンの実装者は型安全で保守性の高いプレイヤー管理システムを構築できます。
