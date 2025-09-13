# Domain-Driven Design 実装原則

TypeScript Minecraftプロジェクトにおける **Domain-Driven Design (DDD)** の実装は、Effect-TSの強力な型システムと関数型プログラミングパラダイムを活用した独特のアプローチを採用しています。このドキュメントでは、プロジェクトで適用されているDDDの原則と実装パターンについて詳説します。

## DDDの基本概念

### エンティティ (Entities)

エンティティは、ライフサイクルを持ち、一意な識別子によって区別されるドメインオブジェクトです。本プロジェクトでは、Effect-TSの`Data.Class`を使用してエンティティを実装しています。

#### プレイヤーエンティティの実装

```typescript
// src/domain/entities/player.entity.ts
export class Player extends Data.Class<{
  readonly _tag: 'Player'
  readonly id: EntityId
  readonly name: string
  readonly position: Position
  readonly velocity: Velocity
  readonly health: number
  readonly hunger: number
  readonly experience: number
  readonly inventory: PlayerInventory
  readonly gameMode: GameMode
}> {
  static readonly schema = PlayerSchema
}

// エンティティ作成のファクトリー関数
export const createPlayer = (
  id: EntityId,
  name: string,
  position: Position
): Effect.Effect<Player, ValidationError> =>
  Effect.gen(function* () {
    // バリデーション
    yield* validatePlayerName(name)
    yield* validateStartingPosition(position)
    
    return Player.make({
      _tag: 'Player',
      id,
      name,
      position,
      velocity: Velocity.zero(),
      health: 100,
      hunger: 100,
      experience: 0,
      inventory: PlayerInventory.empty(),
      gameMode: GameMode.Survival,
    })
  })
```

**設計原則**:
- **不変性**: すべてのフィールドが`readonly`
- **識別子**: `EntityId`による一意識別
- **タグ**: `_tag`による型区別（ADTパターン）
- **バリデーション**: スキーマベースの型安全性

#### ワールドエンティティの実装

```typescript
// src/domain/entities/world.entity.ts
export class World extends Data.Class<{
  readonly _tag: 'World'
  readonly id: WorldId
  readonly name: string
  readonly seed: number
  readonly chunks: ReadonlyMap<string, Chunk>
  readonly entities: ReadonlyMap<EntityId, Entity>
  readonly gameRules: GameRules
  readonly worldTime: WorldTime
}> {
  static readonly schema = WorldSchema
  
  // ドメインメソッド
  addEntity(entity: Entity): Effect.Effect<World, EntityError> {
    return Effect.gen(function* () {
      yield* validateEntityPlacement(entity, this)
      
      const updatedEntities = new Map(this.entities).set(entity.id, entity)
      return this.copy({ entities: updatedEntities })
    })
  }
  
  removeEntity(entityId: EntityId): Effect.Effect<World, EntityNotFoundError> {
    return Effect.gen(function* () {
      const entity = yield* this.getEntity(entityId)
      yield* notifyEntityRemoval(entity)
      
      const updatedEntities = new Map(this.entities)
      updatedEntities.delete(entityId)
      return this.copy({ entities: updatedEntities })
    })
  }
}
```

### 値オブジェクト (Value Objects)

値オブジェクトは、等価性に基づいて識別され、不変性を持つオブジェクトです。プロジェクトでは、Effect-TSのスキーマシステムを活用して実装しています。

#### 位置値オブジェクトの実装

```typescript
// src/domain/value-objects/coordinates/position.value-object.ts
const X = S.Number.pipe(S.finite(), S.brand('X'))
const Y = S.Number.pipe(S.finite(), S.brand('Y'))  
const Z = S.Number.pipe(S.finite(), S.brand('Z'))

export const Position = S.Struct({
  _tag: S.Literal('Position'),
  x: X,
  y: Y,
  z: Z,
})

export type Position = S.Schema.Type<typeof Position>

// ファクトリー関数とビジネスロジック
export const PositionOps = {
  make: (x: number, y: number, z: number): Effect.Effect<Position, ValidationError> =>
    S.decodeUnknown(Position)({ _tag: 'Position', x, y, z }),
    
  distance: (a: Position, b: Position): number =>
    Math.sqrt(
      Math.pow(a.x - b.x, 2) +
      Math.pow(a.y - b.y, 2) +
      Math.pow(a.z - b.z, 2)
    ),
    
  add: (a: Position, b: Position): Position =>
    Position.make({
      _tag: 'Position',
      x: a.x + b.x,
      y: a.y + b.y,
      z: a.z + b.z,
    }),
    
  isWithinBounds: (pos: Position, bounds: Bounds): boolean =>
    pos.x >= bounds.min.x && pos.x <= bounds.max.x &&
    pos.y >= bounds.min.y && pos.y <= bounds.max.y &&
    pos.z >= bounds.min.z && pos.z <= bounds.max.z,
}
```

#### ベロシティ値オブジェクト

```typescript
// src/domain/value-objects/physics/velocity.value-object.ts
export const Velocity = S.Struct({
  _tag: S.Literal('Velocity'),
  dx: S.Number.pipe(S.finite()),
  dy: S.Number.pipe(S.finite()),
  dz: S.Number.pipe(S.finite()),
})

export const VelocityOps = {
  zero: (): Velocity => 
    Velocity.make({ _tag: 'Velocity', dx: 0, dy: 0, dz: 0 }),
    
  magnitude: (v: Velocity): number =>
    Math.sqrt(v.dx * v.dx + v.dy * v.dy + v.dz * v.dz),
    
  normalize: (v: Velocity): Velocity => {
    const mag = VelocityOps.magnitude(v)
    return mag === 0 ? v : Velocity.make({
      _tag: 'Velocity',
      dx: v.dx / mag,
      dy: v.dy / mag,
      dz: v.dz / mag,
    })
  },
  
  clamp: (v: Velocity, maxSpeed: number): Velocity => {
    const mag = VelocityOps.magnitude(v)
    return mag <= maxSpeed ? v : {
      ...VelocityOps.normalize(v),
      dx: v.dx * maxSpeed / mag,
      dy: v.dy * maxSpeed / mag, 
      dz: v.dz * maxSpeed / mag,
    }
  }
}
```

### ドメインサービス (Domain Services)

ドメインサービスは、エンティティや値オブジェクトに自然に属さない複雑なビジネスロジックを実装します。

#### ワールドドメインサービス

```typescript
// src/domain/services/world.domain-service.ts
export interface WorldDomainService {
  readonly generateTerrain: (
    coordinate: ChunkCoordinate,
    seed: number
  ) => Effect.Effect<TerrainData, TerrainGenerationError>
  
  readonly validateBlockPlacement: (
    position: Position,
    blockType: BlockType,
    world: World
  ) => Effect.Effect<boolean, ValidationError>
  
  readonly calculateLighting: (
    chunk: Chunk,
    neighboringChunks: ReadonlyMap<Direction, Chunk>
  ) => Effect.Effect<LightingData, LightingCalculationError>
  
  readonly processPhysics: (
    entities: ReadonlyArray<Entity>,
    deltaTime: number
  ) => Effect.Effect<ReadonlyArray<Entity>, PhysicsError>
}

// サービス実装
export const WorldDomainServiceLive = Layer.effect(
  WorldDomainService,
  Effect.gen(function* () {
    const terrainGenerator = yield* TerrainGeneratorPort
    const physicsEngine = yield* PhysicsEnginePort
    const lightingCalculator = yield* LightingCalculatorPort
    
    return WorldDomainService.of({
      generateTerrain: (coordinate, seed) =>
        Effect.gen(function* () {
          const noiseMap = yield* terrainGenerator.generateNoise(coordinate, seed)
          const heightMap = yield* generateHeightMap(noiseMap)
          const blocks = yield* generateBlocks(heightMap, coordinate)
          const biome = yield* determineBiome(coordinate, seed)
          
          return TerrainData.make({
            coordinate,
            blocks,
            heightMap,
            biome,
            generationTime: new Date()
          })
        }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new TerrainGenerationError({
                coordinate,
                seed,
                cause: error
              })
            )
          )
        ),
        
      validateBlockPlacement: (position, blockType, world) =>
        Effect.gen(function* () {
          const chunk = yield* world.getChunkAt(position)
          const existingBlock = yield* chunk.getBlockAt(position)
          
          // ビジネスルールの検証
          yield* validateBlockReplacement(existingBlock, blockType)
          yield* validateStructuralIntegrity(position, blockType, chunk)
          yield* validateGameModePermissions(blockType, world.gameRules)
          
          return true
        }).pipe(
          Effect.catchTag('ValidationError', () => Effect.succeed(false))
        )
    })
  })
)
```

#### プレイヤードメインサービス

```typescript
// src/domain/services/player.domain-service.ts
export interface PlayerDomainService {
  readonly movePlayer: (
    player: Player,
    direction: Direction,
    speed: number,
    world: World
  ) => Effect.Effect<Player, MovementError>
  
  readonly updateInventory: (
    player: Player,
    action: InventoryAction
  ) => Effect.Effect<Player, InventoryError>
  
  readonly applyDamage: (
    player: Player,
    damage: Damage
  ) => Effect.Effect<Player, HealthError>
}

export const PlayerDomainServiceLive = Layer.effect(
  PlayerDomainService,
  Effect.gen(function* () {
    const collisionDetector = yield* CollisionDetectorPort
    const inventoryValidator = yield* InventoryValidatorPort
    
    return PlayerDomainService.of({
      movePlayer: (player, direction, speed, world) =>
        Effect.gen(function* () {
          const velocity = yield* calculateMovementVelocity(direction, speed)
          const newPosition = yield* PositionOps.add(player.position, velocity)
          
          const hasCollision = yield* collisionDetector.checkCollision(
            newPosition,
            player.boundingBox,
            world
          )
          
          if (hasCollision) {
            return player
          }
          
          const updatedPlayer = player.copy({
            position: newPosition,
            velocity: velocity
          })
          
          yield* validateMovement(updatedPlayer, world)
          return updatedPlayer
        }),
        
      updateInventory: (player, action) =>
        Match.value(action).pipe(
          Match.when({ _tag: 'AddItem' }, ({ item, quantity }) =>
            Effect.gen(function* () {
              const canAdd = yield* inventoryValidator.canAddItem(
                player.inventory,
                item,
                quantity
              )
              
              if (!canAdd) {
                yield* Effect.fail(new InventoryFullError({ item, quantity }))
              }
              
              const updatedInventory = yield* player.inventory.addItem(item, quantity)
              return player.copy({ inventory: updatedInventory })
            })
          ),
          Match.when({ _tag: 'RemoveItem' }, ({ item, quantity }) =>
            Effect.gen(function* () {
              const hasItem = yield* player.inventory.hasItem(item, quantity)
              
              if (!hasItem) {
                yield* Effect.fail(new InsufficientItemError({ item, quantity }))
              }
              
              const updatedInventory = yield* player.inventory.removeItem(item, quantity)
              return player.copy({ inventory: updatedInventory })
            })
          ),
          Match.exhaustive
        )
    })
  })
)
```

## リポジトリパターン

リポジトリパターンは、ドメインとインフラストラクチャレイヤー間の境界を定義し、データアクセスを抽象化します。

### ポートの定義

```typescript
// src/domain/ports/world-repository.port.ts
export interface WorldRepositoryPort {
  readonly save: (world: World) => Effect.Effect<void, RepositoryError>
  readonly load: (worldId: WorldId) => Effect.Effect<World, WorldNotFoundError>
  readonly delete: (worldId: WorldId) => Effect.Effect<void, RepositoryError>
  readonly exists: (worldId: WorldId) => Effect.Effect<boolean, RepositoryError>
  
  readonly saveChunk: (chunk: Chunk) => Effect.Effect<void, RepositoryError>
  readonly loadChunk: (coordinate: ChunkCoordinate) => Effect.Effect<Chunk, ChunkNotFoundError>
  readonly deleteChunk: (coordinate: ChunkCoordinate) => Effect.Effect<void, RepositoryError>
  
  readonly queryEntitiesInRegion: (
    bounds: Bounds
  ) => Effect.Effect<ReadonlyArray<Entity>, RepositoryError>
}

export const WorldRepositoryPort = Context.GenericTag<WorldRepositoryPort>('WorldRepositoryPort')
```

### インフラストラクチャ実装

```typescript
// src/infrastructure/repositories/world.repository.ts
export const WorldRepositoryLive = Layer.effect(
  WorldRepositoryPort,
  Effect.gen(function* () {
    const storage = yield* StoragePort
    const serializer = yield* SerializationPort
    
    return WorldRepositoryPort.of({
      save: (world) =>
        Effect.gen(function* () {
          const serialized = yield* serializer.serialize(world)
          const key = `world:${world.id}`
          yield* storage.set(key, serialized)
        }),
        
      load: (worldId) =>
        Effect.gen(function* () {
          const key = `world:${worldId}`
          const serialized = yield* storage.get(key)
          const world = yield* serializer.deserialize(serialized, WorldSchema)
          return world
        }).pipe(
          Effect.catchTag('KeyNotFound', () =>
            Effect.fail(new WorldNotFoundError({ worldId }))
          )
        ),
        
      queryEntitiesInRegion: (bounds) =>
        Effect.gen(function* () {
          const chunkCoords = yield* calculateChunksInBounds(bounds)
          const chunks = yield* Effect.forEach(
            chunkCoords,
            (coord) => loadChunk(coord),
            { concurrency: 4 }
          )
          
          const entities = chunks.flatMap(chunk =>
            Array.from(chunk.entities.values()).filter(entity =>
              PositionOps.isWithinBounds(entity.position, bounds)
            )
          )
          
          return entities
        })
    })
  })
)
```

## アグリゲート境界

アグリゲートは、一貫性境界を定義し、トランザクション境界として機能します。

### ワールドアグリゲート

```typescript
// src/domain/aggregates/world.aggregate.ts
export class WorldAggregate extends Data.Class<{
  readonly _tag: 'WorldAggregate'
  readonly world: World
  readonly loadedChunks: ReadonlyMap<string, Chunk>
  readonly activeEntities: ReadonlyMap<EntityId, Entity>
  readonly pendingEvents: ReadonlyArray<DomainEvent>
}> {
  // アグリゲート操作
  loadChunk(coordinate: ChunkCoordinate): Effect.Effect<WorldAggregate, ChunkLoadError> {
    return Effect.gen(function* () {
      const chunk = yield* this.generateOrLoadChunk(coordinate)
      const updatedChunks = new Map(this.loadedChunks).set(
        ChunkCoordinate.toString(coordinate),
        chunk
      )
      
      const chunkLoadedEvent = ChunkLoadedEvent.make({
        worldId: this.world.id,
        coordinate,
        timestamp: new Date()
      })
      
      return this.copy({
        loadedChunks: updatedChunks,
        pendingEvents: [...this.pendingEvents, chunkLoadedEvent]
      })
    })
  }
  
  placeBlock(
    position: Position,
    blockType: BlockType,
    playerId: EntityId
  ): Effect.Effect<WorldAggregate, BlockPlacementError> {
    return Effect.gen(function* () {
      const chunkCoord = yield* ChunkCoordinate.fromPosition(position)
      const chunk = yield* this.getChunk(chunkCoord)
      
      yield* this.validateBlockPlacement(position, blockType, playerId)
      
      const updatedChunk = yield* chunk.setBlock(position, blockType)
      const updatedChunks = new Map(this.loadedChunks).set(
        ChunkCoordinate.toString(chunkCoord),
        updatedChunk
      )
      
      const blockPlacedEvent = BlockPlacedEvent.make({
        worldId: this.world.id,
        position,
        blockType,
        playerId,
        timestamp: new Date()
      })
      
      return this.copy({
        loadedChunks: updatedChunks,
        pendingEvents: [...this.pendingEvents, blockPlacedEvent]
      })
    })
  }
  
  // イベント処理
  commitEvents(): Effect.Effect<ReadonlyArray<DomainEvent>, EventError> {
    return Effect.gen(function* () {
      const events = this.pendingEvents
      yield* Effect.forEach(events, publishEvent, { concurrency: 'unbounded' })
      return events
    })
  }
  
  clearEvents(): WorldAggregate {
    return this.copy({ pendingEvents: [] })
  }
}
```

## ドメインイベント

ドメインイベントは、重要なビジネス事象を表現し、システム間の疎結合を実現します。

```typescript
// src/domain/events/domain-events.ts
export const DomainEvent = S.Union(
  BlockPlacedEvent.schema,
  BlockRemovedEvent.schema,
  PlayerJoinedEvent.schema,
  PlayerLeftEvent.schema,
  ChunkLoadedEvent.schema,
  ChunkUnloadedEvent.schema
)

export type DomainEvent = S.Schema.Type<typeof DomainEvent>

// 具体的なイベント
export const BlockPlacedEvent = S.Struct({
  _tag: S.Literal('BlockPlacedEvent'),
  eventId: EventId,
  worldId: WorldId,
  position: Position,
  blockType: BlockType,
  playerId: EntityId,
  timestamp: S.Date,
})

export const PlayerJoinedEvent = S.Struct({
  _tag: S.Literal('PlayerJoinedEvent'),
  eventId: EventId,
  worldId: WorldId,
  playerId: EntityId,
  playerName: S.String,
  spawnPosition: Position,
  timestamp: S.Date,
})

// イベント発行
export const EventPublisher = Context.GenericTag<{
  readonly publish: (event: DomainEvent) => Effect.Effect<void, EventError>
}>('EventPublisher')

export const publishEvent = (event: DomainEvent): Effect.Effect<void, EventError> =>
  Effect.gen(function* () {
    const publisher = yield* EventPublisher
    yield* publisher.publish(event)
    yield* Effect.logInfo(`Published event: ${event._tag}`)
  })
```

## エラーハンドリング

ドメイン層では、ビジネスルール違反や制約違反を表現する専用のエラー型を定義します。

```typescript
// src/domain/errors/unified-errors.ts
export class EntityNotFoundError extends Data.TaggedError('EntityNotFoundError')<{
  readonly entityId: EntityId
  readonly entityType: string
  readonly operation: string
}> {}

export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly field: string
  readonly value: unknown
  readonly constraint: string
  readonly message: string
}> {}

export class BusinessRuleViolationError extends Data.TaggedError('BusinessRuleViolationError')<{
  readonly rule: string
  readonly context: Record<string, unknown>
  readonly message: string
}> {}

export class ResourceExhaustedError extends Data.TaggedError('ResourceExhaustedError')<{
  readonly resource: string
  readonly current: number
  readonly maximum: number
}> {}

// ドメイン固有のエラー
export class BlockPlacementError extends Data.TaggedError('BlockPlacementError')<{
  readonly position: Position
  readonly blockType: BlockType
  readonly reason: string
}> {}

export class MovementError extends Data.TaggedError('MovementError')<{
  readonly from: Position
  readonly to: Position
  readonly reason: string
}> {}
```

## まとめ

このプロジェクトのDDD実装は、以下の特徴を持ちます：

### 強み
- **型安全性**: Effect-TSスキーマによる実行時バリデーション
- **不変性**: すべてのドメインオブジェクトが不変
- **合成可能性**: Effect型による操作の組み合わせ
- **明示的エラーハンドリング**: タグ付きエラーによる安全な例外処理

### 設計パターン
- **ファクトリーメソッド**: オブジェクト作成の制御
- **仕様パターン**: 複雑なビジネスルールの表現  
- **ドメインイベント**: 疎結合なシステム通信
- **アグリゲート**: 一貫性境界の明確化

### 利点
- **保守性**: 明確な責務分離とレイヤー境界
- **テスト可能性**: 純粋関数による予測可能な動作
- **拡張性**: ポートアダプターパターンによる柔軟な実装
- **パフォーマンス**: ECSとの統合による最適化

この設計により、複雑なゲームロジックを管理しやすく、拡張しやすい形で実装することができています。