# Domain-Driven Design 実装原則

TypeScript Minecraftプロジェクトにおける **Domain-Driven Design (DDD)** の実装は、Effect-TSの強力な型システムと関数型プログラミングパラダイムを活用した独特のアプローチを採用しています。このドキュメントでは、プロジェクトで適用されているDDDの原則と実装パターンについて詳説します。

## DDDの基本概念

### エンティティ (Entities)

エンティティは、ライフサイクルを持ち、一意な識別子によって区別されるドメインオブジェクトです。本プロジェクトでは、Effect-TSの`Schema.Struct`を使用してエンティティを実装し、操作は純粋関数として分離しています。

#### プレイヤーエンティティの実装

```typescript
// src/domain/entities/player.entity.ts
export const Player = Schema.Struct({
  _tag: Schema.Literal('Player'),
  id: EntityId.schema,
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(16)),
  position: Position.schema,
  velocity: Velocity.schema,
  health: Schema.Number.pipe(Schema.between(0, 100)),
  hunger: Schema.Number.pipe(Schema.between(0, 100)),
  experience: Schema.Number.pipe(Schema.nonNegative()),
  inventory: PlayerInventory.schema,
  gameMode: GameMode.schema,
})

export type Player = Schema.Schema.Type<typeof Player>

// エンティティ作成のファクトリー関数
export const createPlayer = (
  id: EntityId,
  name: string,
  position: Position
): Effect.Effect<Player, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: バリデーション失敗時
    if (name.length === 0) {
      return yield* Effect.fail(createValidationError(
        'Player name cannot be empty',
        'name'
      ))
    }

    // 早期リターン: 名前長制限
    if (name.length > 16) {
      return yield* Effect.fail(createValidationError(
        'Player name too long (max 16 characters)',
        'name'
      ))
    }

    // 位置検証の早期リターン
    const validPosition = yield* validateStartingPosition(position)
    if (!validPosition) {
      return yield* Effect.fail(createValidationError(
        'Invalid starting position',
        'position'
      ))
    }

    return Schema.decodeUnknownSync(Player)({
      _tag: 'Player',
      id,
      name,
      position,
      velocity: VelocityOps.zero(),
      health: 100,
      hunger: 100,
      experience: 0,
      inventory: PlayerInventoryOps.empty(),
      gameMode: GameMode.Survival,
    })
  })

// プレイヤー操作の純粋関数群（PBT対応）
export const PlayerOps = {
  // 単一責務: 位置更新のみ
  moveTo: (player: Player, newPosition: Position): Player => ({
    ...player,
    position: newPosition
  }),

  // 単一責務: ヘルス更新のみ
  updateHealth: (player: Player, health: number): Player => ({
    ...player,
    health: Math.max(0, Math.min(100, health))
  }),

  // 単一責務: 体力減少のみ
  takeDamage: (player: Player, damage: number): Player =>
    PlayerOps.updateHealth(player, player.health - damage),

  // 純粋関数: 距離計算
  distanceTo: (player: Player, target: Position): number =>
    Math.sqrt(
      Math.pow(target.x - player.position.x, 2) +
      Math.pow(target.y - player.position.y, 2) +
      Math.pow(target.z - player.position.z, 2)
    ),

  // 純粋関数: 生存判定
  isAlive: (player: Player): boolean => player.health > 0,

  // 純粋関数: プレイヤー能力判定
  canMove: (player: Player): boolean => player.health > 0 && !player.abilities.frozen,

  // 純粋関数: 経験値レベル計算
  calculateLevel: (experience: number): number => Math.floor(Math.sqrt(experience / 100)),

  // 純粋関数: ダメージ計算
  calculateDamage: (baseDamage: number, armor: number, enchantments: EnchantmentEffect[]): number => {
    const armorReduction = Math.min(0.8, armor * 0.04)
    const enchantmentReduction = enchantments.reduce((acc, ench) => acc + ench.protection, 0) * 0.01
    return Math.max(1, baseDamage * (1 - armorReduction) * (1 - enchantmentReduction))
  },
}
```

**設計原則**:
- **不変性**: すべてのフィールドが`readonly`
- **識別子**: `EntityId`による一意識別
- **タグ**: `_tag`による型区別（ADTパターン）
- **バリデーション**: スキーマベースの型安全性
- **純粋関数**: 副作用のない操作関数の分離
- **単一責務**: 各関数が一つの責務のみを持つ

#### ワールドエンティティの実装

```typescript
// src/domain/entities/world.entity.ts
export const World = Schema.Struct({
  _tag: Schema.Literal('World'),
  id: WorldId.schema,
  name: Schema.String.pipe(Schema.minLength(1)),
  seed: Schema.Number.pipe(Schema.int()),
  chunks: Schema.ReadonlyMap({
    key: Schema.String,
    value: Chunk.schema
  }),
  entities: Schema.ReadonlyMap({
    key: EntityId.schema,
    value: Entity.schema
  }),
  gameRules: GameRules.schema,
  worldTime: WorldTime.schema,
})

export type World = Schema.Schema.Type<typeof World>

// ワールド操作の純粋関数群
export const WorldOps = {
  // 単一責務: エンティティ追加
  addEntity: (world: World, entity: Entity): World => ({
    ...world,
    entities: new Map(world.entities).set(entity.id, entity)
  }),

  // 単一責務: エンティティ削除
  removeEntity: (world: World, entityId: EntityId): World => {
    const updatedEntities = new Map(world.entities)
    updatedEntities.delete(entityId)
    return { ...world, entities: updatedEntities }
  },

  // 純粋関数: エンティティ検索
  findEntity: (world: World, entityId: EntityId): Entity | undefined =>
    world.entities.get(entityId),

  // 純粋関数: チャンク検索
  findChunkByCoordinate: (world: World, coordinate: string): Chunk | undefined =>
    world.chunks.get(coordinate),

  // 純粋関数: エンティティ数カウント
  getEntityCount: (world: World): number => world.entities.size,
}

// Effect包装された操作関数
export const addEntitySafe = (
  world: World,
  entity: Entity
): Effect.Effect<World, EntityError> =>
  Effect.gen(function* () {
    // 早期リターン: 重複チェック
    if (world.entities.has(entity.id)) {
      return yield* Effect.fail(EntityError.make({
        _tag: 'EntityError',
        entityId: entity.id,
        reason: 'Entity already exists',
        timestamp: Date.now()
      }))
    }

    // バリデーション
    const isValidPlacement = yield* validateEntityPlacement(entity, world)
    if (!isValidPlacement) {
      return yield* Effect.fail(EntityError.make({
        _tag: 'EntityError',
        entityId: entity.id,
        reason: 'Invalid entity placement',
        timestamp: Date.now()
      }))
    }

    return WorldOps.addEntity(world, entity)
  })

export const removeEntitySafe = (
  world: World,
  entityId: EntityId
): Effect.Effect<World, EntityNotFoundError> =>
  Effect.gen(function* () {
    // 早期リターン: 存在チェック
    const entity = WorldOps.findEntity(world, entityId)
    if (!entity) {
      return yield* Effect.fail(EntityNotFoundError.make({
        _tag: 'EntityNotFoundError',
        entityId,
        message: 'Entity not found',
        timestamp: Date.now()
      }))
    }

    yield* notifyEntityRemoval(entity)
    return WorldOps.removeEntity(world, entityId)
  })
```

### 値オブジェクト (Value Objects)

値オブジェクトは、等価性に基づいて識別され、不変性を持つオブジェクトです。プロジェクトでは、Effect-TSの`Schema.Struct`を活用して実装し、操作は純粋関数として分離しています。

#### 位置値オブジェクトの実装

```typescript
// src/domain/value-objects/coordinates/position.value-object.ts
const X = Schema.Number.pipe(Schema.finite(), Schema.brand('X'))
const Y = Schema.Number.pipe(Schema.finite(), Schema.brand('Y'))
const Z = Schema.Number.pipe(Schema.finite(), Schema.brand('Z'))

export const Position = Schema.Struct({
  _tag: Schema.Literal('Position'),
  x: X,
  y: Y,
  z: Z,
})

export type Position = Schema.Schema.Type<typeof Position>

// PBT対応の純粋関数群
export const PositionOps = {
  // ファクトリー関数（早期リターン対応）
  make: (x: number, y: number, z: number): Effect.Effect<Position, ValidationError> =>
    Effect.gen(function* () {
      // 早期リターン: 無限値チェック
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return yield* Effect.fail(createValidationError(
          'Coordinates must be finite numbers',
          'coordinates'
        ))
      }

      // 早期リターン: 世界境界チェック
      if (!isWithinWorldBounds(x, y, z)) {
        return yield* Effect.fail(createValidationError(
          'Coordinates are outside world bounds',
          'coordinates'
        ))
      }

      return Schema.decodeUnknownSync(Position)({ _tag: 'Position', x, y, z })
    }),

  // 純粋関数: 世界境界判定
  isWithinWorldBounds: (position: Position): boolean =>
    isWithinWorldBounds(position.x, position.y, position.z),

  // 純粋関数: 距離計算（PBTテスト対応）
  distance: (a: Position, b: Position): number =>
    Math.sqrt(
      Math.pow(a.x - b.x, 2) +
      Math.pow(a.y - b.y, 2) +
      Math.pow(a.z - b.z, 2)
    ),

  // 純粋関数: マンハッタン距離
  manhattanDistance: (a: Position, b: Position): number =>
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z),

  // 純粋関数: 位置加算
  add: (a: Position, b: Position): Position => ({
    _tag: 'Position',
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  }),

  // 純粋関数: 位置減算
  subtract: (a: Position, b: Position): Position => ({
    _tag: 'Position',
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  }),

  // 純粋関数: スケーリング
  scale: (position: Position, factor: number): Position => ({
    _tag: 'Position',
    x: position.x * factor,
    y: position.y * factor,
    z: position.z * factor,
  }),

  // 純粋関数: 境界判定
  isWithinBounds: (pos: Position, bounds: Bounds): boolean =>
    pos.x >= bounds.min.x && pos.x <= bounds.max.x &&
    pos.y >= bounds.min.y && pos.y <= bounds.max.y &&
    pos.z >= bounds.min.z && pos.z <= bounds.max.z,

  // 純粋関数: 原点からの距離
  magnitude: (position: Position): number =>
    Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z),

  // 純粋関数: 正規化
  normalize: (position: Position): Position => {
    const mag = PositionOps.magnitude(position)
    return mag === 0 ? position : PositionOps.scale(position, 1 / mag)
  },
}
```

#### ベロシティ値オブジェクト

```typescript
// src/domain/value-objects/physics/velocity.value-object.ts
export const Velocity = Schema.Struct({
  _tag: Schema.Literal('Velocity'),
  dx: Schema.Number.pipe(Schema.finite()),
  dy: Schema.Number.pipe(Schema.finite()),
  dz: Schema.Number.pipe(Schema.finite()),
})

export type Velocity = Schema.Schema.Type<typeof Velocity>

// 純粋関数による物理計算（PBT対応）
export const VelocityOps = {
  // ファクトリー関数: ゼロベロシティ
  zero: (): Velocity => ({
    _tag: 'Velocity',
    dx: 0,
    dy: 0,
    dz: 0,
  }),

  // ファクトリー関数: 方向ベクトルから生成
  fromDirection: (direction: Direction, speed: number): Velocity => ({
    _tag: 'Velocity',
    dx: direction.x * speed,
    dy: direction.y * speed,
    dz: direction.z * speed,
  }),

  // 純粋関数: 大きさ計算
  magnitude: (v: Velocity): number =>
    Math.sqrt(v.dx * v.dx + v.dy * v.dy + v.dz * v.dz),

  // 純粋関数: 正規化
  normalize: (v: Velocity): Velocity => {
    const mag = VelocityOps.magnitude(v)
    return mag === 0 ? v : {
      _tag: 'Velocity',
      dx: v.dx / mag,
      dy: v.dy / mag,
      dz: v.dz / mag,
    }
  },

  // 純粋関数: 速度制限
  clamp: (v: Velocity, maxSpeed: number): Velocity => {
    const mag = VelocityOps.magnitude(v)
    return mag <= maxSpeed ? v : {
      ...VelocityOps.normalize(v),
      dx: (v.dx / mag) * maxSpeed,
      dy: (v.dy / mag) * maxSpeed,
      dz: (v.dz / mag) * maxSpeed,
    }
  },

  // 純粋関数: ベロシティ加算
  add: (a: Velocity, b: Velocity): Velocity => ({
    _tag: 'Velocity',
    dx: a.dx + b.dx,
    dy: a.dy + b.dy,
    dz: a.dz + b.dz,
  }),

  // 純粋関数: スケーリング
  scale: (v: Velocity, factor: number): Velocity => ({
    _tag: 'Velocity',
    dx: v.dx * factor,
    dy: v.dy * factor,
    dz: v.dz * factor,
  }),

  // 純粋関数: 摩擦適用
  applyFriction: (v: Velocity, frictionCoeff: number): Velocity =>
    VelocityOps.scale(v, Math.max(0, 1 - frictionCoeff)),

  // 純粋関数: 重力適用
  applyGravity: (v: Velocity, gravity: number, deltaTime: number): Velocity => ({
    _tag: 'Velocity',
    dx: v.dx,
    dy: v.dy - gravity * deltaTime,
    dz: v.dz,
  }),
}
```

### ドメインサービス (Domain Services)

ドメインサービスは、エンティティや値オブジェクトに自然に属さない複雑なビジネスロジックを実装します。クラスではなく、`Context.GenericTag`と純粋関数の組み合わせで実装します。

#### ワールドドメインサービス

```typescript
// src/domain/services/world.domain-service.ts
interface WorldDomainServiceInterface {
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

export const WorldDomainService = Context.GenericTag<WorldDomainServiceInterface>('@app/WorldDomainService')

// 純粋関数による地形生成ロジック分割（PBTテスト対応）
const generateNoiseMap = (coordinate: ChunkCoordinate, seed: number): Effect.Effect<NoiseMap, never> =>
  Effect.succeed(createPerlinNoiseMap(coordinate, seed))

const createPerlinNoiseMap = (coordinate: ChunkCoordinate, seed: number): NoiseMap => {
  const noise = new PerlinNoise(seed)
  const map: number[][] = Array(16).fill(null).map(() => Array(16).fill(0))

  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) {
      const worldX = coordinate.x * 16 + x
      const worldZ = coordinate.z * 16 + z
      map[x][z] = noise.noise(worldX * 0.01, worldZ * 0.01)
    }
  }

  return { coordinate, values: map }
}

const createHeightMap = (noiseMap: NoiseMap): Effect.Effect<HeightMap, never> =>
  Effect.succeed(/* 高度マップ変換 */)

const generateBlocksFromHeight = (heightMap: HeightMap, coordinate: ChunkCoordinate): Effect.Effect<BlockArray, never> =>
  Effect.succeed(/* ブロック配置ロジック */)

const determineBiomeType = (coordinate: ChunkCoordinate, seed: number): Effect.Effect<BiomeType, never> =>
  Effect.succeed(/* バイオーム決定 */)

// サービス実装
const makeWorldDomainServiceLive = Effect.gen(function* () {
  const terrainGenerator = yield* TerrainGeneratorPort
  const physicsEngine = yield* PhysicsEnginePort
  const lightingCalculator = yield* LightingCalculatorPort

  return WorldDomainService.of({
    generateTerrain: (coordinate, seed) =>
      Effect.gen(function* () {
        // 早期リターン: 座標検証
        if (!isValidChunkCoordinate(coordinate)) {
          return yield* Effect.fail(createTerrainGenerationError(
            coordinate,
            'Invalid chunk coordinate'
          ))
        }

        // 早期リターン: シード値検証
        if (!isValidSeed(seed)) {
          return yield* Effect.fail(createTerrainGenerationError(
            coordinate,
            'Invalid seed value'
          ))
        }

        // 単一責務の関数を順次実行
        const noiseMap = yield* generateNoiseMap(coordinate, seed)
        const heightMap = yield* createHeightMap(noiseMap)
        const blocks = yield* generateBlocksFromHeight(heightMap, coordinate)
        const biome = yield* determineBiomeType(coordinate, seed)

        return {
          _tag: 'TerrainData' as const,
          coordinate,
          blocks,
          heightMap,
          biome,
          generationTime: Date.now()
        }
      }),

    validateBlockPlacement: (position, blockType, world) =>
      Effect.gen(function* () {
        // 早期リターン: 境界チェック
        if (!PositionOps.isWithinBounds(position, world.bounds)) {
          return yield* Effect.succeed(false)
        }

        const chunk = yield* getChunkAtPosition(world, position)
        const existingBlock = yield* getBlockAtPosition(chunk, position)

        // 複数の検証を並列実行
        const validations = yield* Effect.all([
          validateBlockReplacement(existingBlock, blockType),
          validateStructuralIntegrity(position, blockType, chunk),
          validateGameModePermissions(blockType, world.gameRules)
        ], { concurrency: 3 })

        return validations.every(result => result === true)
      }).pipe(
        Effect.catchAll(() => Effect.succeed(false))
      )
  })
})

export const WorldDomainServiceLive = Layer.effect(WorldDomainService, makeWorldDomainServiceLive)
```

#### プレイヤードメインサービス

```typescript
// src/domain/services/player.domain-service.ts

// インベントリアクションのTagged Union定義
type InventoryAction =
  | { readonly _tag: 'AddItem'; readonly item: Item; readonly quantity: number }
  | { readonly _tag: 'RemoveItem'; readonly item: Item; readonly quantity: number }
  | { readonly _tag: 'MoveItem'; readonly fromSlot: number; readonly toSlot: number }
  | { readonly _tag: 'SwapItems'; readonly slot1: number; readonly slot2: number }

interface PlayerDomainServiceInterface {
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
    damage: DamageSource
  ) => Effect.Effect<Player, HealthError>
}

export const PlayerDomainService = Context.GenericTag<PlayerDomainServiceInterface>('@app/PlayerDomainService')

// 純粋関数による移動計算（PBTテスト対応）
const calculateNewVelocity = (direction: Direction, speed: number): Velocity => {
  // 早期リターン: 無効なパラメータ
  if (speed <= 0 || !isValidDirection(direction)) {
    return VelocityOps.zero()
  }

  return VelocityOps.fromDirection(normalizeDirection(direction), speed)
}

const isValidDirection = (direction: Direction): boolean =>
  Number.isFinite(direction.x) && Number.isFinite(direction.y) && Number.isFinite(direction.z)

const normalizeDirection = (direction: Direction): Direction => {
  const magnitude = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2)
  return magnitude === 0 ? direction : {
    x: direction.x / magnitude,
    y: direction.y / magnitude,
    z: direction.z / magnitude
  }
}

const calculateNewPosition = (position: Position, velocity: Velocity, deltaTime: number): Position =>
  PositionOps.add(position, PositionOps.scale({
    _tag: 'Position',
    x: velocity.dx,
    y: velocity.dy,
    z: velocity.dz,
  }, deltaTime))

// 純粋関数による体力計算
const calculateDamageReduction = (player: Player, damage: DamageSource): number =>
  Match.value(damage).pipe(
    Match.tag('PhysicalDamage', ({ amount }) => amount * (1 - player.armor.physicalResistance)),
    Match.tag('FireDamage', ({ amount }) => amount * (1 - player.armor.fireResistance)),
    Match.tag('FallDamage', ({ amount, height }) => Math.max(0, amount - player.enchantments.featherFalling)),
    Match.exhaustive
  )

const makePlayerDomainServiceLive = Effect.gen(function* () {
  const collisionDetector = yield* CollisionDetectorPort
  const inventoryValidator = yield* InventoryValidatorPort

  return PlayerDomainService.of({
    movePlayer: (player, direction, speed, world) =>
      Effect.gen(function* () {
        // 早期リターン: プレイヤー生存チェック
        if (!PlayerOps.isAlive(player)) {
          return yield* Effect.fail(createMovementError(
            player.position,
            player.position,
            'Dead player cannot move',
            player.id
          ))
        }

        // 早期リターン: 移動能力チェック
        if (!PlayerOps.canMove(player)) {
          return yield* Effect.fail(createMovementError(
            player.position,
            player.position,
            'Player cannot move due to status effects',
            player.id
          ))
        }

        const velocity = calculateNewVelocity(direction, speed)
        const newPosition = calculateNewPosition(player.position, velocity, 1/60) // 60fps想定

        // 衝突判定
        const hasCollision = yield* collisionDetector.checkCollision(
          newPosition,
          player.boundingBox,
          world
        )

        // 早期リターン: 衝突時は現在位置を維持
        if (hasCollision) {
          return PlayerOps.moveTo(player, player.position)
        }

        const updatedPlayer = PlayerOps.moveTo(player, newPosition)
        yield* validateMovement(updatedPlayer, world)
        return updatedPlayer
      }),

    updateInventory: (player, action) =>
      Match.value(action).pipe(
        Match.tag('AddItem', ({ item, quantity }) =>
          Effect.gen(function* () {
            // 早期リターン: 数量チェック
            if (quantity <= 0) {
              return yield* Effect.fail(createInventoryError(
                player.id,
                'Invalid quantity',
                item.id
              ))
            }

            // 早期リターン: アイテム有効性チェック
            if (!isValidItem(item)) {
              return yield* Effect.fail(createInventoryError(
                player.id,
                'Invalid item',
                item.id
              ))
            }

            const canAdd = yield* inventoryValidator.canAddItem(
              player.inventory,
              item,
              quantity
            )

            if (!canAdd) {
              return yield* Effect.fail(createInventoryError(
                player.id,
                'Inventory full',
                item.id
              ))
            }

            const updatedInventory = yield* addItemToInventory(player.inventory, item, quantity)
            return { ...player, inventory: updatedInventory }
          })
        ),
        Match.tag('RemoveItem', ({ item, quantity }) =>
          Effect.gen(function* () {
            const hasItem = yield* checkItemInInventory(player.inventory, item, quantity)

            // 早期リターン: アイテム不足
            if (!hasItem) {
              return yield* Effect.fail(InventoryError.make({
                _tag: 'InventoryError',
                reason: 'Insufficient items',
                playerId: player.id,
                timestamp: Date.now()
              }))
            }

            const updatedInventory = yield* removeItemFromInventory(player.inventory, item, quantity)
            return { ...player, inventory: updatedInventory }
          })
        ),
        Match.tag('MoveItem', ({ fromSlot, toSlot }) =>
          Effect.gen(function* () {
            const updatedInventory = yield* moveItemBetweenSlots(player.inventory, fromSlot, toSlot)
            return { ...player, inventory: updatedInventory }
          })
        ),
        Match.tag('SwapItems', ({ slot1, slot2 }) =>
          Effect.gen(function* () {
            const updatedInventory = yield* swapItemsInSlots(player.inventory, slot1, slot2)
            return { ...player, inventory: updatedInventory }
          })
        ),
        Match.exhaustive
      ),

    applyDamage: (player, damageSource) =>
      Effect.gen(function* () {
        // 早期リターン: 既に死んでいる場合
        if (!PlayerOps.isAlive(player)) {
          return player
        }

        const actualDamage = calculateDamageReduction(player, damageSource)
        const updatedPlayer = PlayerOps.takeDamage(player, actualDamage)

        // ダメージイベントを発行
        yield* publishDamageEvent(player.id, damageSource, actualDamage)

        return updatedPlayer
      })
  })
})

export const PlayerDomainServiceLive = Layer.effect(PlayerDomainService, makePlayerDomainServiceLive)
```

## リポジトリパターン

リポジトリパターンは、ドメインとインフラストラクチャレイヤー間の境界を定義し、データアクセスを抽象化します。`Context.GenericTag`による型安全なポート定義と、Effect包装によるエラーハンドリングを実装します。

### ポートの定義

```typescript
// src/domain/ports/world-repository.port.ts

// 検索条件のTagged Union定義
type EntityQuery =
  | { readonly _tag: 'ByRegion'; readonly bounds: Bounds }
  | { readonly _tag: 'ByType'; readonly entityType: EntityType }
  | { readonly _tag: 'ByPlayer'; readonly playerId: EntityId }
  | { readonly _tag: 'NearPosition'; readonly position: Position; readonly radius: number }

interface WorldRepositoryPortInterface {
  readonly save: (world: World) => Effect.Effect<void, RepositoryError>
  readonly load: (worldId: WorldId) => Effect.Effect<World, WorldNotFoundError>
  readonly delete: (worldId: WorldId) => Effect.Effect<void, RepositoryError>
  readonly exists: (worldId: WorldId) => Effect.Effect<boolean, RepositoryError>

  readonly saveChunk: (chunk: Chunk) => Effect.Effect<void, RepositoryError>
  readonly loadChunk: (coordinate: ChunkCoordinate) => Effect.Effect<Chunk, ChunkNotFoundError>
  readonly deleteChunk: (coordinate: ChunkCoordinate) => Effect.Effect<void, RepositoryError>
  readonly preloadChunks: (coordinates: ReadonlyArray<ChunkCoordinate>) => Effect.Effect<ReadonlyArray<Chunk>, RepositoryError>

  readonly queryEntities: (query: EntityQuery) => Effect.Effect<ReadonlyArray<Entity>, RepositoryError>
  readonly countEntities: (query: EntityQuery) => Effect.Effect<number, RepositoryError>
}

export const WorldRepositoryPort = Context.GenericTag<WorldRepositoryPortInterface>('@app/WorldRepositoryPort')

// 純粋関数による座標計算
const calculateChunksInBounds = (bounds: Bounds): ReadonlyArray<ChunkCoordinate> => {
  const chunkSize = 16
  const coords: ChunkCoordinate[] = []

  for (let x = Math.floor(bounds.min.x / chunkSize); x <= Math.ceil(bounds.max.x / chunkSize); x++) {
    for (let z = Math.floor(bounds.min.z / chunkSize); z <= Math.ceil(bounds.max.z / chunkSize); z++) {
      coords.push({ x, z })
    }
  }

  return coords
}

const isEntityInBounds = (entity: Entity, bounds: Bounds): boolean =>
  PositionOps.isWithinBounds(entity.position, bounds)

const calculateDistance = (from: Position, to: Position): number =>
  PositionOps.distance(from, to)
```

### インフラストラクチャ実装

```typescript
// src/infrastructure/repositories/world.repository.ts

// 純粋関数によるデータ変換
const createWorldKey = (worldId: WorldId): string => `world:${worldId}`
const createChunkKey = (coordinate: ChunkCoordinate): string => `chunk:${coordinate.x}:${coordinate.z}`

const filterEntitiesByQuery = (entities: ReadonlyArray<Entity>, query: EntityQuery): ReadonlyArray<Entity> =>
  Match.value(query).pipe(
    Match.tag('ByRegion', ({ bounds }) =>
      entities.filter(entity => isEntityInBounds(entity, bounds))
    ),
    Match.tag('ByType', ({ entityType }) =>
      entities.filter(entity => entity.type === entityType)
    ),
    Match.tag('ByPlayer', ({ playerId }) =>
      entities.filter(entity => entity._tag === 'Player' && entity.id === playerId)
    ),
    Match.tag('NearPosition', ({ position, radius }) =>
      entities.filter(entity => calculateDistance(entity.position, position) <= radius)
    ),
    Match.exhaustive
  )

const makeWorldRepositoryLive = Effect.gen(function* () {
  const storage = yield* StoragePort
  const serializer = yield* SerializationPort
  const cacheManager = yield* CacheManagerPort

  return WorldRepositoryPort.of({
    save: (world) =>
      Effect.gen(function* () {
        // 早期リターン: 世界IDの検証
        if (!world.id || world.id.length === 0) {
          return yield* Effect.fail(RepositoryError.make({
            _tag: 'RepositoryError',
            operation: 'save',
            reason: 'Invalid world ID',
            timestamp: Date.now()
          }))
        }

        const serialized = yield* serializer.serialize(world)
        const key = createWorldKey(world.id)

        // 並列でストレージとキャッシュを更新
        yield* Effect.all([
          storage.set(key, serialized),
          cacheManager.set(key, world, { ttl: 3600 }) // 1時間キャッシュ
        ], { concurrency: 2 })

        yield* Effect.logInfo(`World saved: ${world.id}`)
      }),

    load: (worldId) =>
      Effect.gen(function* () {
        const key = createWorldKey(worldId)

        // 早期リターン: キャッシュから取得
        const cached = yield* cacheManager.get(key).pipe(
          Effect.catchAll(() => Effect.succeed(undefined))
        )

        if (cached) {
          return cached
        }

        const serialized = yield* storage.get(key)
        const world = yield* serializer.deserialize(serialized, World)

        // バックグラウンドでキャッシュ更新
        yield* cacheManager.set(key, world).pipe(Effect.fork)

        return world
      }).pipe(
        Effect.catchTag('KeyNotFound', () =>
          Effect.fail(WorldNotFoundError.make({
            _tag: 'WorldNotFoundError',
            worldId,
            message: `World not found: ${worldId}`,
            timestamp: Date.now()
          }))
        )
      ),

    preloadChunks: (coordinates) =>
      Effect.gen(function* () {
        // 並列でチャンク読み込み
        const chunks = yield* Effect.forEach(
          coordinates,
          (coord) => loadChunkWithRetry(coord),
          { concurrency: 8, batching: true }
        )

        return chunks
      }),

    queryEntities: (query) =>
      Effect.gen(function* () {
        const relevantChunks = yield* Match.value(query).pipe(
          Match.tag('ByRegion', ({ bounds }) =>
            Effect.gen(function* () {
              const chunkCoords = calculateChunksInBounds(bounds)
              return yield* Effect.forEach(
                chunkCoords,
                coord => loadChunkWithRetry(coord),
                { concurrency: 4 }
              )
            })
          ),
          Match.tag('ByType', ({ entityType }) =>
            // 型別インデックスから高速検索
            Effect.gen(function* () {
              const indexKey = `entities:type:${entityType}`
              const entityIds = yield* storage.get(indexKey)
              return yield* loadEntitiesByIds(entityIds)
            })
          ),
          Match.tag('ByPlayer', ({ playerId }) =>
            // 単一プレイヤーの効率的な検索
            Effect.gen(function* () {
              const playerChunk = yield* findPlayerChunk(playerId)
              return [playerChunk]
            })
          ),
          Match.tag('NearPosition', ({ position, radius }) =>
            Effect.gen(function* () {
              const bounds = createBoundsAroundPosition(position, radius)
              const chunkCoords = calculateChunksInBounds(bounds)
              return yield* Effect.forEach(
                chunkCoords,
                coord => loadChunkWithRetry(coord),
                { concurrency: 4 }
              )
            })
          ),
          Match.exhaustive
        )

        const allEntities = relevantChunks.flatMap(chunk =>
          Array.from(chunk.entities.values())
        )

        return filterEntitiesByQuery(allEntities, query)
      }),

    countEntities: (query) =>
      Effect.gen(function* () {
        const entities = yield* this.queryEntities(query)
        return entities.length
      })
  })
})

export const WorldRepositoryLive = Layer.effect(WorldRepositoryPort, makeWorldRepositoryLive)

// リトライ機能付きチャンク読み込み
const loadChunkWithRetry = (coordinate: ChunkCoordinate): Effect.Effect<Chunk, ChunkNotFoundError> =>
  loadChunk(coordinate).pipe(
    Effect.retry(
      Schedule.exponential("100 millis").pipe(
        Schedule.intersect(Schedule.recurs(3))
      )
    ),
    Effect.timeout("5 seconds")
  )
```

## アグリゲート境界

アグリゲートは、一貫性境界を定義し、トランザクション境界として機能します。クラスではなく、`Schema.Struct`と純粋関数による関数型実装を採用します。

### ワールドアグリゲート

```typescript
// src/domain/aggregates/world.aggregate.ts

// アグリゲートルートの定義
export const WorldAggregate = Schema.Struct({
  _tag: Schema.Literal('WorldAggregate'),
  world: World,
  loadedChunks: Schema.ReadonlyMap({
    key: Schema.String,
    value: Chunk.schema
  }),
  activeEntities: Schema.ReadonlyMap({
    key: EntityId.schema,
    value: Entity.schema
  }),
  pendingEvents: Schema.Array(DomainEvent),
  version: Schema.Number.pipe(Schema.nonNegative()),
  lastModified: Schema.Number.pipe(Schema.default(() => Date.now())),
})

export type WorldAggregate = Schema.Schema.Type<typeof WorldAggregate>

// 純粋関数によるアグリゲート操作
export const WorldAggregateOps = {
  // ファクトリー関数
  create: (world: World): WorldAggregate => ({
    _tag: 'WorldAggregate',
    world,
    loadedChunks: new Map(),
    activeEntities: new Map(),
    pendingEvents: [],
    version: 0,
    lastModified: Date.now(),
  }),

  // 純粋関数: チャンク追加
  addChunk: (aggregate: WorldAggregate, chunkKey: string, chunk: Chunk): WorldAggregate => ({
    ...aggregate,
    loadedChunks: new Map(aggregate.loadedChunks).set(chunkKey, chunk),
    version: aggregate.version + 1,
    lastModified: Date.now(),
  }),

  // 純粋関数: イベント追加
  addEvent: (aggregate: WorldAggregate, event: DomainEvent): WorldAggregate => ({
    ...aggregate,
    pendingEvents: [...aggregate.pendingEvents, event],
    version: aggregate.version + 1,
    lastModified: Date.now(),
  }),

  // 純粋関数: イベントクリア
  clearEvents: (aggregate: WorldAggregate): WorldAggregate => ({
    ...aggregate,
    pendingEvents: [],
    version: aggregate.version + 1,
    lastModified: Date.now(),
  }),

  // 純粋関数: エンティティ追加
  addEntity: (aggregate: WorldAggregate, entity: Entity): WorldAggregate => ({
    ...aggregate,
    activeEntities: new Map(aggregate.activeEntities).set(entity.id, entity),
    version: aggregate.version + 1,
    lastModified: Date.now(),
  }),
}

// Effect包装されたアグリゲート操作
export const loadChunkSafe = (
  aggregate: WorldAggregate,
  coordinate: ChunkCoordinate
): Effect.Effect<WorldAggregate, ChunkLoadError> =>
  Effect.gen(function* () {
    // 早期リターン: 既に読み込み済み
    const chunkKey = createChunkKey(coordinate)
    if (aggregate.loadedChunks.has(chunkKey)) {
      return aggregate
    }

    // バリデーション
    const isValidCoord = validateChunkCoordinate(coordinate)
    if (!isValidCoord) {
      return yield* Effect.fail(ChunkLoadError.make({
        _tag: 'ChunkLoadError',
        coordinate,
        reason: 'Invalid chunk coordinate',
        timestamp: Date.now()
      }))
    }

    const chunk = yield* generateOrLoadChunk(coordinate)

    const chunkLoadedEvent = ChunkLoadedEvent.make({
      _tag: 'ChunkLoadedEvent',
      worldId: aggregate.world.id,
      coordinate,
      timestamp: Date.now()
    })

    return WorldAggregateOps.addEvent(
      WorldAggregateOps.addChunk(aggregate, chunkKey, chunk),
      chunkLoadedEvent
    )
  })

export const placeBlockSafe = (
  aggregate: WorldAggregate,
  position: Position,
  blockType: BlockType,
  playerId: EntityId
): Effect.Effect<WorldAggregate, BlockPlacementError> =>
  Effect.gen(function* () {
    // 早期リターン: プレイヤー権限チェック
    const player = aggregate.activeEntities.get(playerId)
    if (!player || player._tag !== 'Player') {
      return yield* Effect.fail(BlockPlacementError.make({
        _tag: 'BlockPlacementError',
        position,
        reason: 'Player not found or not active',
        timestamp: Date.now()
      }))
    }

    const chunkCoord = yield* getChunkCoordinateFromPosition(position)
    const chunkKey = createChunkKey(chunkCoord)
    const chunk = aggregate.loadedChunks.get(chunkKey)

    // 早期リターン: チャンク未読み込み
    if (!chunk) {
      return yield* Effect.fail(BlockPlacementError.make({
        _tag: 'BlockPlacementError',
        position,
        reason: 'Chunk not loaded',
        timestamp: Date.now()
      }))
    }

    // バリデーション
    const isValidPlacement = yield* validateBlockPlacement(position, blockType, aggregate.world)
    if (!isValidPlacement) {
      return yield* Effect.fail(BlockPlacementError.make({
        _tag: 'BlockPlacementError',
        position,
        reason: 'Invalid block placement',
        timestamp: Date.now()
      }))
    }

    const updatedChunk = yield* setBlockInChunk(chunk, position, blockType)

    const blockPlacedEvent = BlockPlacedEvent.make({
      _tag: 'BlockPlacedEvent',
      worldId: aggregate.world.id,
      position,
      blockType,
      playerId,
      timestamp: Date.now()
    })

    return WorldAggregateOps.addEvent(
      WorldAggregateOps.addChunk(aggregate, chunkKey, updatedChunk),
      blockPlacedEvent
    )
  })

// Match.valueを使ったイベント処理
export const commitEvents = (
  aggregate: WorldAggregate
): Effect.Effect<ReadonlyArray<DomainEvent>, EventError> =>
  Effect.gen(function* () {
    const events = aggregate.pendingEvents

    // 早期リターン: イベントなし
    if (events.length === 0) {
      return []
    }

    // イベント並列発行
    yield* Effect.forEach(
      events,
      (event) => publishEvent(event),
      { concurrency: 'unbounded' }
    )

    // 統計情報更新
    yield* updateAggregateMetrics(aggregate.world.id, events.length)

    return events
  })

// 純粋関数による補助操作
const createChunkKey = (coordinate: ChunkCoordinate): string =>
  `${coordinate.x}:${coordinate.z}`

const validateChunkCoordinate = (coordinate: ChunkCoordinate): boolean =>
  Number.isInteger(coordinate.x) && Number.isInteger(coordinate.z)
```

## ドメインイベント

ドメインイベントは、重要なビジネス事象を表現し、システム間の疎結合を実現します。Tagged Union Typesと`Match.value`による高度なパターンマッチングを活用します。

```typescript
// src/domain/events/domain-events.ts

// Tagged Union定義によるドメインイベント
export const BlockPlacedEvent = Schema.Struct({
  _tag: Schema.Literal('BlockPlacedEvent'),
  eventId: EventId.schema,
  worldId: WorldId.schema,
  position: Position,
  blockType: BlockType.schema,
  playerId: EntityId.schema,
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now())),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const BlockRemovedEvent = Schema.Struct({
  _tag: Schema.Literal('BlockRemovedEvent'),
  eventId: EventId.schema,
  worldId: WorldId.schema,
  position: Position,
  blockType: BlockType.schema,
  playerId: EntityId.schema,
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now())),
  droppedItems: Schema.Array(ItemStack.schema),
})

export const PlayerJoinedEvent = Schema.Struct({
  _tag: Schema.Literal('PlayerJoinedEvent'),
  eventId: EventId.schema,
  worldId: WorldId.schema,
  playerId: EntityId.schema,
  playerName: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(16)),
  spawnPosition: Position,
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now())),
  gameMode: GameMode.schema,
})

export const PlayerLeftEvent = Schema.Struct({
  _tag: Schema.Literal('PlayerLeftEvent'),
  eventId: EventId.schema,
  worldId: WorldId.schema,
  playerId: EntityId.schema,
  playerName: Schema.String,
  lastPosition: Position,
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now())),
  reason: Schema.String.pipe(Schema.optional()),
})

export const ChunkLoadedEvent = Schema.Struct({
  _tag: Schema.Literal('ChunkLoadedEvent'),
  eventId: EventId.schema,
  worldId: WorldId.schema,
  coordinate: ChunkCoordinate.schema,
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now())),
  loadTimeMs: Schema.Number.pipe(Schema.nonNegative()),
})

export const ChunkUnloadedEvent = Schema.Struct({
  _tag: Schema.Literal('ChunkUnloadedEvent'),
  eventId: EventId.schema,
  worldId: WorldId.schema,
  coordinate: ChunkCoordinate.schema,
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now())),
  reason: Schema.String,
})

// Union型の定義
export const DomainEvent = Schema.Union(
  BlockPlacedEvent,
  BlockRemovedEvent,
  PlayerJoinedEvent,
  PlayerLeftEvent,
  ChunkLoadedEvent,
  ChunkUnloadedEvent
)

export type DomainEvent = Schema.Schema.Type<typeof DomainEvent>

// イベントファクトリー関数
export const DomainEventOps = {
  BlockPlacedEvent: {
    make: (
      worldId: WorldId,
      position: Position,
      blockType: BlockType,
      playerId: EntityId
    ): BlockPlacedEvent => ({
      _tag: 'BlockPlacedEvent',
      eventId: generateEventId(),
      worldId,
      position,
      blockType,
      playerId,
      timestamp: Date.now(),
    }),
  },

  PlayerJoinedEvent: {
    make: (
      worldId: WorldId,
      playerId: EntityId,
      playerName: string,
      spawnPosition: Position,
      gameMode: GameMode
    ): PlayerJoinedEvent => ({
      _tag: 'PlayerJoinedEvent',
      eventId: generateEventId(),
      worldId,
      playerId,
      playerName,
      spawnPosition,
      gameMode,
      timestamp: Date.now(),
    }),
  },

  ChunkLoadedEvent: {
    make: (
      worldId: WorldId,
      coordinate: ChunkCoordinate,
      loadTimeMs: number
    ): ChunkLoadedEvent => ({
      _tag: 'ChunkLoadedEvent',
      eventId: generateEventId(),
      worldId,
      coordinate,
      loadTimeMs,
      timestamp: Date.now(),
    }),
  },
}

// Context定義（最新パターン）
interface EventPublisherInterface {
  readonly publish: (event: DomainEvent) => Effect.Effect<void, EventError>
  readonly publishBatch: (events: ReadonlyArray<DomainEvent>) => Effect.Effect<void, EventError>
  readonly subscribe: (handler: EventHandler) => Effect.Effect<void, EventError>
}

export const EventPublisher = Context.GenericTag<EventPublisherInterface>('@app/EventPublisher')

// Match.valueによる高度なイベント処理
export const publishEvent = (event: DomainEvent): Effect.Effect<void, EventError> =>
  Effect.gen(function* () {
    const publisher = yield* EventPublisher

    // 早期リターン: イベント検証
    const validationResult = yield* validateEvent(event)
    if (!validationResult.isValid) {
      return yield* Effect.fail(EventError.make({
        _tag: 'EventError',
        eventId: event.eventId,
        reason: validationResult.error,
        timestamp: Date.now()
      }))
    }

    // イベントメタデータの追加
    const enrichedEvent = yield* enrichEventWithMetadata(event)

    yield* publisher.publish(enrichedEvent)
    yield* Effect.logInfo(`Published event: ${event._tag} (${event.eventId})`)

    // イベント後処理をMatch.valueで実装
    yield* Match.value(event).pipe(
      Match.tag('BlockPlacedEvent', ({ position, blockType }) =>
        Effect.gen(function* () {
          yield* updateBlockStatistics(blockType)
          yield* invalidateChunkCache(position)
        })
      ),
      Match.tag('PlayerJoinedEvent', ({ playerId, worldId }) =>
        Effect.gen(function* () {
          yield* updatePlayerMetrics(worldId)
          yield* loadPlayerData(playerId)
        })
      ),
      Match.tag('ChunkLoadedEvent', ({ coordinate, loadTimeMs }) =>
        Effect.gen(function* () {
          yield* recordChunkLoadTime(coordinate, loadTimeMs)
          yield* preloadNeighboringChunks(coordinate)
        })
      ),
      Match.orElse(() => Effect.unit) // その他のイベントは何もしない
    )
  })

// バッチ処理
export const publishEventBatch = (events: ReadonlyArray<DomainEvent>): Effect.Effect<void, EventError> =>
  Effect.gen(function* () {
    // 早期リターン: 空の場合
    if (events.length === 0) {
      return
    }

    const publisher = yield* EventPublisher

    // イベント種類別にグループ化
    const eventGroups = groupEventsByTag(events)

    // 並列でバッチ処理
    yield* Effect.forEach(
      Object.entries(eventGroups),
      ([tag, groupEvents]) => processBatchByType(tag, groupEvents),
      { concurrency: 4 }
    )

    yield* publisher.publishBatch(events)
    yield* Effect.logInfo(`Published ${events.length} events in batch`)
  })

// 純粋関数による補助処理
const generateEventId = (): EventId => crypto.randomUUID() as EventId

const groupEventsByTag = (events: ReadonlyArray<DomainEvent>): Record<string, ReadonlyArray<DomainEvent>> =>
  events.reduce((groups, event) => {
    const tag = event._tag
    return {
      ...groups,
      [tag]: [...(groups[tag] || []), event]
    }
  }, {} as Record<string, ReadonlyArray<DomainEvent>>)

const validateEvent = (event: DomainEvent): Effect.Effect<{ isValid: boolean; error?: string }, never> =>
  Effect.gen(function* () {
    //基本的な検証
    if (!event.eventId || !event.timestamp) {
      return { isValid: false, error: 'Missing required event fields' }
    }

    if (event.timestamp > Date.now()) {
      return { isValid: false, error: 'Future timestamp not allowed' }
    }

    return { isValid: true }
  })
```

## エラーハンドリング

ドメイン層では、ビジネスルール違反や制約違反を表現する専用のエラー型を定義します。`Data.TaggedError`ではなく、`Schema.Struct`による統一的なエラー定義を採用します。

```typescript
// src/domain/errors/unified-errors.ts

// 基本エラー構造
const BaseError = Schema.Struct({
  _tag: Schema.String,
  message: Schema.String,
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now())),
  correlationId: Schema.String.pipe(Schema.optional()),
  metadata: Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  }).pipe(Schema.optional()),
})

// 汎用エラー定義
export const EntityNotFoundError = Schema.Struct({
  ...BaseError.fields,
  _tag: Schema.Literal('EntityNotFoundError'),
  entityId: EntityId.schema,
  entityType: Schema.String,
  operation: Schema.String,
})

export const ValidationError = Schema.Struct({
  ...BaseError.fields,
  _tag: Schema.Literal('ValidationError'),
  field: Schema.String,
  value: Schema.Unknown,
  constraint: Schema.String,
  expectedType: Schema.String.pipe(Schema.optional()),
})

export const BusinessRuleViolationError = Schema.Struct({
  ...BaseError.fields,
  _tag: Schema.Literal('BusinessRuleViolationError'),
  rule: Schema.String,
  context: Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  }),
  severity: Schema.Union(
    Schema.Literal('Warning'),
    Schema.Literal('Error'),
    Schema.Literal('Critical')
  ).pipe(Schema.default(() => 'Error' as const)),
})

export const ResourceExhaustedError = Schema.Struct({
  ...BaseError.fields,
  _tag: Schema.Literal('ResourceExhaustedError'),
  resource: Schema.String,
  current: Schema.Number.pipe(Schema.nonNegative()),
  maximum: Schema.Number.pipe(Schema.nonNegative()),
  unit: Schema.String.pipe(Schema.optional()),
})

// ドメイン固有のエラー
export const BlockPlacementError = Schema.Struct({
  ...BaseError.fields,
  _tag: Schema.Literal('BlockPlacementError'),
  position: Position,
  blockType: BlockType.schema.pipe(Schema.optional()),
  reason: Schema.String,
  playerId: EntityId.schema.pipe(Schema.optional()),
})

export const MovementError = Schema.Struct({
  ...BaseError.fields,
  _tag: Schema.Literal('MovementError'),
  from: Position,
  to: Position,
  reason: Schema.String,
  playerId: EntityId.schema,
})

export const ChunkLoadError = Schema.Struct({
  ...BaseError.fields,
  _tag: Schema.Literal('ChunkLoadError'),
  coordinate: ChunkCoordinate.schema,
  reason: Schema.String,
  retryCount: Schema.Number.pipe(Schema.nonNegative(), Schema.default(() => 0)),
})

export const InventoryError = Schema.Struct({
  ...BaseError.fields,
  _tag: Schema.Literal('InventoryError'),
  playerId: EntityId.schema,
  reason: Schema.String,
  itemId: Schema.String.pipe(Schema.optional()),
  slotIndex: Schema.Number.pipe(Schema.optional()),
})

export const EventError = Schema.Struct({
  ...BaseError.fields,
  _tag: Schema.Literal('EventError'),
  eventId: EventId.schema,
  reason: Schema.String,
  retryable: Schema.Boolean.pipe(Schema.default(() => true)),
})

// Union型でまとめた統一エラー型
export const DomainError = Schema.Union(
  EntityNotFoundError,
  ValidationError,
  BusinessRuleViolationError,
  ResourceExhaustedError,
  BlockPlacementError,
  MovementError,
  ChunkLoadError,
  InventoryError,
  EventError
)

export type DomainError = Schema.Schema.Type<typeof DomainError>

// エラーファクトリー関数
export const DomainErrorOps = {
  EntityNotFoundError: {
    make: (entityId: EntityId, entityType: string, operation: string): EntityNotFoundError => ({
      _tag: 'EntityNotFoundError',
      entityId,
      entityType,
      operation,
      message: `${entityType} with ID ${entityId} not found during ${operation}`,
      timestamp: Date.now(),
    }),
  },

  ValidationError: {
    make: (field: string, value: unknown, constraint: string): ValidationError => ({
      _tag: 'ValidationError',
      field,
      value,
      constraint,
      message: `Validation failed for field '${field}': ${constraint}`,
      timestamp: Date.now(),
    }),
  },

  BlockPlacementError: {
    make: (position: Position, reason: string, playerId?: EntityId): BlockPlacementError => ({
      _tag: 'BlockPlacementError',
      position,
      reason,
      playerId,
      message: `Block placement failed at ${JSON.stringify(position)}: ${reason}`,
      timestamp: Date.now(),
    }),
  },
}

// Match.valueによるエラーハンドリング
export const handleDomainError = (error: DomainError): Effect.Effect<string, never> =>
  Match.value(error).pipe(
    Match.tag('EntityNotFoundError', ({ entityType, entityId, operation }) =>
      Effect.succeed(`Entity ${entityType}(${entityId}) not found during ${operation}`)
    ),
    Match.tag('ValidationError', ({ field, constraint, message }) =>
      Effect.succeed(`Validation error in ${field}: ${constraint}. ${message}`)
    ),
    Match.tag('BusinessRuleViolationError', ({ rule, severity, message }) =>
      Effect.succeed(`Business rule violation [${severity}]: ${rule}. ${message}`)
    ),
    Match.tag('ResourceExhaustedError', ({ resource, current, maximum }) =>
      Effect.succeed(`Resource exhausted: ${resource} (${current}/${maximum})`)
    ),
    Match.tag('BlockPlacementError', ({ position, reason }) =>
      Effect.succeed(`Block placement failed at (${position.x}, ${position.y}, ${position.z}): ${reason}`)
    ),
    Match.tag('MovementError', ({ from, to, reason, playerId }) =>
      Effect.succeed(`Player ${playerId} movement failed from ${JSON.stringify(from)} to ${JSON.stringify(to)}: ${reason}`)
    ),
    Match.tag('ChunkLoadError', ({ coordinate, reason, retryCount }) =>
      Effect.succeed(`Chunk load failed at (${coordinate.x}, ${coordinate.z}) after ${retryCount} retries: ${reason}`)
    ),
    Match.tag('InventoryError', ({ playerId, reason }) =>
      Effect.succeed(`Inventory operation failed for player ${playerId}: ${reason}`)
    ),
    Match.tag('EventError', ({ eventId, reason, retryable }) =>
      Effect.succeed(`Event ${eventId} failed: ${reason} (retryable: ${retryable})`)
    ),
    Match.exhaustive
  )

// エラー回復戦略
export const recoverFromError = <A>(
  effect: Effect.Effect<A, DomainError>,
  recovery: Partial<Record<DomainError['_tag'], Effect.Effect<A, never>>>
): Effect.Effect<A, DomainError> =>
  effect.pipe(
    Effect.catchAll((error) =>
      Match.value(error).pipe(
        Match.when(
          (e): e is EntityNotFoundError => e._tag === 'EntityNotFoundError',
          () => recovery.EntityNotFoundError || Effect.fail(error)
        ),
        Match.when(
          (e): e is ValidationError => e._tag === 'ValidationError',
          () => recovery.ValidationError || Effect.fail(error)
        ),
        Match.when(
          (e): e is ChunkLoadError => e._tag === 'ChunkLoadError',
          () => recovery.ChunkLoadError || Effect.fail(error)
        ),
        Match.orElse(() => Effect.fail(error))
      )
    )
  )

// ログ出力とメトリクス更新
export const logAndMetricError = (error: DomainError): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const errorMessage = yield* handleDomainError(error)

    yield* Effect.logError(`Domain Error: ${errorMessage}`, {
      errorTag: error._tag,
      timestamp: error.timestamp,
      correlationId: error.correlationId,
    })

    // エラーメトリクス更新
    yield* updateErrorMetrics(error._tag)
  })
```

## まとめ

このプロジェクトのDDD実装は、Effect-TSの2024年最新パターンを活用した現代的なアプローチを採用しており、以下の特徴を持ちます：

### 技術的特徴
- **関数型アプローチ**: classを排除し、interface + pure functions パターンを徹底
- **Schema.Struct統一**: `Data.Class`を完全に置換し、型安全性を向上
- **Match.valueパターン**: if/else/switchを排除し、高度なパターンマッチングを実現
- **早期リターン**: バリデーション段階での即座な失敗処理によりパフォーマンス向上
- **Context.GenericTag**: 最新のサービス定義パターンで依存注入を型安全化

### DDDパターンの現代化
- **Value Objects**: Schema.Structによる不変データ構造と純粋関数操作
- **Entities**: IDを含むSchema定義 + 操作関数の完全分離
- **Aggregates**: ルート管理の関数型実装とイベントソーシング対応
- **Domain Events**: Tagged Union Types + Match.value処理による疎結合
- **Domain Services**: Context.GenericTag + Layer実装の標準化
- **Repositories**: Effect包装 + エラーハンドリング + キャッシング戦略

### 設計原則の実装
- **単一責務原則**: 各関数が一つの責務のみを持つよう細分化
- **早期リターン**: バリデーション失敗時の即座な処理終了
- **純粋関数**: 副作用のない計算ロジックでPBTテスト対応
- **不変性**: すべてのデータ構造が不変で並行処理安全
- **合成可能性**: Effect.genによる操作の組み合わせ

### パフォーマンス最適化
- **並列処理**: Effect.allによるバッチ操作の高速化
- **リトライ機能**: Schedule.exponentialによる堅牢な障害対応
- **キャッシング**: レイヤー別キャッシュ戦略によるレスポンス向上
- **早期リターン**: 不要な処理の回避によるCPU効率化
- **バッチング**: イベント処理の効率化

### エラーハンドリング戦略
- **統一エラー型**: Schema.Structベースのエラー定義
- **Match.valueパターン**: エラー種別による適切な処理分岐
- **回復戦略**: エラー種別に応じた自動回復機能
- **ログとメトリクス**: 包括的な監視とデバッグ支援

### テスタビリティ
- **純粋関数**: 副作用のない関数によるテスト容易性
- **PBT対応**: Property-Based Testingに適した粒度の関数設計
- **モック対応**: Context.GenericTagによる依存注入でテスト用実装差し替え
- **決定的動作**: 同一入力に対する同一出力の保証

### 保守性・拡張性
- **明確な境界**: レイヤー間の責務分離とインターフェース定義
- **型安全性**: コンパイル時エラー検出による品質向上
- **ドキュメント化**: スキーマによる自己記述的なコード
- **リファクタリング安全性**: 型システムによる変更影響範囲の明確化

この現代化されたDDD実装により、複雑なMinecraftゲームロジックを**型安全**で**保守しやすく**、**テストしやすい**形で管理できています。また、Effect-TSの最新機能を活用することで、**高パフォーマンス**かつ**スケーラブル**なアーキテクチャを実現しています。