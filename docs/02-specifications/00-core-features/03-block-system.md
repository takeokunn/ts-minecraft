# ブロックシステム - ブロック管理システム

## 概要

ブロックシステムは、TypeScript Minecraftクローンの基本要素であるブロックの完全な管理システムです。Effect-TS 3.17+の最新パターン（Schema.Struct、@app/ServiceNameネームスペース）とDDDの値オブジェクトパターンを活用し、400+種類のブロックを純粋関数型で管理します。

本システムは以下の機能を提供します：
- **ブロックレジストリ**: バニラMinecraft互換の400+ブロック定義
- **状態管理**: 向き・接続・電源等の動的状態管理
- **更新システム**: リアルタイムな隣接ブロック相互作用
- **物理演算**: 重力・流体・レッドストーンへの応答
- **インタラクション**: 配置・破壊・アクティベーション処理
- **メッシュ生成**: グリーディメッシング最適化

## ブロックタイプ定義

### ブロックスキーマ

```typescript
import { Effect, Layer, Context, Schema, pipe, Match } from "effect"
import { Brand, Option, ReadonlyArray } from "effect"

// ブロックID（ブランド型）
export const BlockId = Schema.String.pipe(
  Schema.pattern(/^[a-z]+:[a-z_]+$/),
  Schema.brand("BlockId")
)
export type BlockId = Schema.Schema.Type<typeof BlockId>

// ブロック状態
export const BlockState = Schema.Struct({
  facing: Schema.optional(
    Schema.Literal("north", "south", "east", "west", "up", "down")
  ),
  powered: Schema.optional(Schema.Boolean),
  waterlogged: Schema.optional(Schema.Boolean),
  lit: Schema.optional(Schema.Boolean),
  open: Schema.optional(Schema.Boolean),
  half: Schema.optional(Schema.Literal("top", "bottom")),
  shape: Schema.optional(
    Schema.Literal("straight", "inner_left", "inner_right", "outer_left", "outer_right")
  ),
  axis: Schema.optional(Schema.Literal("x", "y", "z"))
})

// ブロック属性
export const BlockProperties = Schema.Struct({
  hardness: pipe(Schema.Number, Schema.nonNegative()),
  resistance: pipe(Schema.Number, Schema.nonNegative()),
  luminance: pipe(Schema.Number, Schema.int(), Schema.between(0, 15)),
  opacity: pipe(Schema.Number, Schema.int(), Schema.between(0, 15)),
  flammability: pipe(Schema.Number, Schema.int(), Schema.between(0, 300)),
  slipperiness: pipe(Schema.Number, Schema.between(0.4, 1.0)),
  jumpVelocityModifier: Schema.Number,
  velocityModifier: Schema.Number,
  soundType: Schema.Literal("stone", "wood", "gravel", "grass", "metal", "glass", "wool", "sand", "snow")
})

// ブロック定義
export const BlockDefinition = Schema.Struct({
  id: BlockId,
  name: Schema.String,
  properties: BlockProperties,
  defaultState: BlockState,
  boundingBox: Schema.Struct({
    min: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
    max: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number })
  }),
  material: Schema.Literal(
    "air", "structure_void", "portal", "carpet", "plant", "water", "lava",
    "snow", "fire", "decoration", "web", "sculk", "buildable_glass",
    "clay", "dirt", "grass", "ice", "sand", "sponge", "wood", "wool",
    "stone", "metal", "repair_station", "barrier", "piston"
  ),
  isSolid: Schema.Boolean,
  isTransparent: Schema.Boolean,
  isFlammable: Schema.Boolean,
  isReplaceable: Schema.Boolean,
  toolRequired: Schema.optional(
    Schema.Literal("pickaxe", "axe", "shovel", "hoe", "shears")
  ),
  harvestLevel: Schema.optional(
    pipe(Schema.Number, Schema.int(), Schema.between(0, 4))
  ),
  drops: Schema.Array(
    Schema.Struct({
      item: Schema.String,
      count: Schema.Struct({
        min: Schema.Number,
        max: Schema.Number
      }),
      chance: pipe(Schema.Number, Schema.between(0, 1))
    })
  )
})

export type BlockDefinition = Schema.Schema.Type<typeof BlockDefinition>
```

## ブロックレジストリ

### ブロック登録サービス

```typescript
// BlockRegistryインターフェース
interface BlockRegistryInterface {
  readonly register: (block: BlockDefinition) => Effect.Effect<void, RegistrationError>
  readonly get: (id: BlockId) => Effect.Effect<BlockDefinition, BlockNotFoundError>
  readonly getAll: () => Effect.Effect<ReadonlyArray<BlockDefinition>, never>
  readonly getByMaterial: (material: string) => Effect.Effect<ReadonlyArray<BlockDefinition>, never>
  readonly getByProperty: (
    predicate: (props: BlockProperties) => boolean
  ) => Effect.Effect<ReadonlyArray<BlockDefinition>, never>
}

// Context Tag（最新パターン）
export const BlockRegistry = Context.GenericTag<BlockRegistryInterface>("@app/BlockRegistry")

// Live実装作成関数
const makeBlockRegistry = Effect.gen(function* () {
  const registry = yield* Ref.make(new Map<BlockId, BlockDefinition>())

    // バニラブロックの登録
    const registerVanillaBlocks = Effect.gen(function* () {
      const vanillaBlocks: BlockDefinition[] = [
        {
          id: "minecraft:stone" as BlockId,
          name: "石",
          properties: {
            hardness: 1.5,
            resistance: 6.0,
            luminance: 0,
            opacity: 15,
            flammability: 0,
            slipperiness: 0.6,
            jumpVelocityModifier: 1.0,
            velocityModifier: 1.0,
            soundType: "stone"
          },
          defaultState: {},
          boundingBox: {
            min: { x: 0, y: 0, z: 0 },
            max: { x: 1, y: 1, z: 1 }
          },
          material: "stone",
          isSolid: true,
          isTransparent: false,
          isFlammable: false,
          isReplaceable: false,
          toolRequired: "pickaxe",
          harvestLevel: 0,
          drops: [{
            item: "minecraft:cobblestone",
            count: { min: 1, max: 1 },
            chance: 1.0
          }]
        },
        {
          id: "minecraft:grass_block" as BlockId,
          name: "草ブロック",
          properties: {
            hardness: 0.6,
            resistance: 0.6,
            luminance: 0,
            opacity: 15,
            flammability: 0,
            slipperiness: 0.6,
            jumpVelocityModifier: 1.0,
            velocityModifier: 1.0,
            soundType: "grass"
          },
          defaultState: {},
          boundingBox: {
            min: { x: 0, y: 0, z: 0 },
            max: { x: 1, y: 1, z: 1 }
          },
          material: "grass",
          isSolid: true,
          isTransparent: false,
          isFlammable: false,
          isReplaceable: false,
          toolRequired: "shovel",
          drops: [{
            item: "minecraft:dirt",
            count: { min: 1, max: 1 },
            chance: 1.0
          }]
        },
        {
          id: "minecraft:water" as BlockId,
          name: "水",
          properties: {
            hardness: 100.0,
            resistance: 100.0,
            luminance: 0,
            opacity: 3,
            flammability: 0,
            slipperiness: 0.6,
            jumpVelocityModifier: 1.0,
            velocityModifier: 0.5,
            soundType: "water"
          },
          defaultState: {},
          boundingBox: {
            min: { x: 0, y: 0, z: 0 },
            max: { x: 1, y: 0.875, z: 1 }
          },
          material: "water",
          isSolid: false,
          isTransparent: true,
          isFlammable: false,
          isReplaceable: true,
          drops: []
        }
        // 他のバニラブロック定義...
      ]

      for (const block of vanillaBlocks) {
        yield* register(block)
      }
    })

    // 初期化時にバニラブロックを登録
    yield* registerVanillaBlocks

    const register = (block: BlockDefinition) =>
      Ref.get(registry).pipe(
        Effect.flatMap(current =>
          current.has(block.id)
            ? Effect.fail(new BlockAlreadyRegisteredError(block.id))
            : Ref.update(registry, map => new Map(map).set(block.id, block))
        )
      )

    const get = (id: BlockId) =>
      Ref.get(registry).pipe(
        Effect.flatMap(current => {
          const block = current.get(id)
          return block
            ? Effect.succeed(block)
            : Effect.fail(new BlockNotFoundError(id))
        })
      )

    const getAll = () =>
      Ref.get(registry).pipe(
        Effect.map(current => ReadonlyArray.fromIterable(current.values()))
      )

    const getByMaterial = (material: string) =>
      getAll().pipe(
        Effect.map(blocks => ReadonlyArray.filter(blocks, block => block.material === material))
      )

    const getByProperty = (predicate: (props: BlockProperties) => boolean) =>
      getAll().pipe(
        Effect.map(blocks => ReadonlyArray.filter(blocks, block => predicate(block.properties)))
      )

    return BlockRegistry.of({ register, get, getAll, getByMaterial, getByProperty })
  })

// Live Layer
export const BlockRegistryLive = Layer.effect(
  BlockRegistry,
  makeBlockRegistry
)
```

## ブロック更新システム

### ブロック更新サービス

```typescript
// BlockUpdate型定義
export type BlockUpdateType =
  | "neighbor_changed"
  | "random_tick"
  | "scheduled_tick"
  | "block_event"

export interface BlockUpdate {
  readonly position: WorldPosition
  readonly type: BlockUpdateType
  readonly source?: WorldPosition
  readonly data?: unknown
}

// BlockUpdateServiceインターフェース
interface BlockUpdateServiceInterface {
  readonly scheduleUpdate: (
    position: WorldPosition,
    delay: number
  ) => Effect.Effect<void, never>

  readonly processUpdate: (
    update: BlockUpdate
  ) => Effect.Effect<void, UpdateError>

  readonly neighborChanged: (
    position: WorldPosition,
    source: WorldPosition
  ) => Effect.Effect<void, never>

  readonly randomTick: (
    position: WorldPosition
  ) => Effect.Effect<void, never>
}

// Context Tag（最新パターン）
export const BlockUpdateService = Context.GenericTag<BlockUpdateServiceInterface>("@app/BlockUpdateService")

// Live実装作成関数
const makeBlockUpdateService = Effect.gen(function* () {
  const world = yield* WorldService
  const physics = yield* PhysicsService
  const updateQueue = yield* Queue.unbounded<BlockUpdate>()

    // 更新処理ループ
    const processUpdateLoop = Effect.gen(function* () {
      yield* Effect.forever(
        Effect.gen(function* () {
          const update = yield* Queue.take(updateQueue)
          yield* processUpdate(update).pipe(
            Effect.catchAll((error) =>
              Effect.log(`ブロック更新エラー: ${error}`)
            )
          )
        })
      )
    })

    // バックグラウンドで更新処理を実行
    yield* Effect.forkDaemon(processUpdateLoop)

    const scheduleUpdate = (position: WorldPosition, delay: number) =>
      Effect.gen(function* () {
        yield* Effect.sleep(Duration.millis(delay))
        yield* Queue.offer(updateQueue, {
          position,
          type: "scheduled_tick"
        })
      }).pipe(Effect.forkDaemon)

    const processUpdate = (update: BlockUpdate) =>
      Effect.gen(function* () {
        const block = yield* world.getBlock(update.position)
        const definition = yield* BlockRegistry.get(block.id)

        yield* Match.value(update).pipe(
          Match.when(
            (update): update is BlockUpdate & { type: "neighbor_changed" } =>
              update.type === "neighbor_changed",
            (update) => handleNeighborChange(update.position, update.source!)
          ),
          Match.when(
            (update): update is BlockUpdate & { type: "random_tick" } =>
              update.type === "random_tick",
            (update) => handleRandomTick(update.position, definition)
          ),
          Match.when(
            (update): update is BlockUpdate & { type: "scheduled_tick" } =>
              update.type === "scheduled_tick",
            (update) => handleScheduledTick(update.position, definition)
          ),
          Match.when(
            (update): update is BlockUpdate & { type: "block_event" } =>
              update.type === "block_event",
            (update) => handleBlockEvent(update.position, update.data)
          ),
          Match.exhaustive
        )
      })

    const neighborChanged = (position: WorldPosition, source: WorldPosition) =>
      Queue.offer(updateQueue, {
        position,
        type: "neighbor_changed",
        source
      })

    const randomTick = (position: WorldPosition) =>
      Queue.offer(updateQueue, {
        position,
        type: "random_tick"
      })

    // 具体的な更新ハンドラー
    const handleNeighborChange = (position: WorldPosition, source: WorldPosition) =>
      world.getBlock(position).pipe(
        Effect.flatMap(block =>
          Match.value(block.id).pipe(
            Match.when(
              (id) => id === "minecraft:sand" || id === "minecraft:gravel",
              () => handleFallingBlock(position, block)
            ),
            Match.when(
              isRedstoneComponent,
              () => updateRedstoneNetwork(position)
            ),
            Match.when(
              (id) => id === "minecraft:water",
              () => updateWaterFlow(position)
            ),
            Match.orElse(() => Effect.void)
          )
        )
      )

    const handleFallingBlock = (position: WorldPosition, block: BlockDefinition) =>
      world.getBlock({ ...position, y: position.y - 1 }).pipe(
        Effect.flatMap(blockBelow =>
          blockBelow.isSolid
            ? Effect.void // 早期リターン: 支持ブロックがある場合
            : Effect.all([
                physics.addFallingBlock(position, block),
                world.setBlock(position, "minecraft:air" as BlockId)
              ]).pipe(Effect.asVoid)
        )
      )

    const handleRandomTick = (position: WorldPosition, definition: BlockDefinition) =>
      Effect.gen(function* () {
        // 草の成長
        if (definition.id === "minecraft:grass_block") {
          yield* spreadGrass(position)
        }

        // 作物の成長
        if (isCrop(definition.id)) {
          yield* growCrop(position)
        }

        // 氷の融解
        if (definition.id === "minecraft:ice") {
          const lightLevel = yield* world.getLightLevel(position)
          if (lightLevel > 11) {
            yield* world.setBlock(position, "minecraft:water" as BlockId)
          }
        }
      })

    return BlockUpdateService.of({ scheduleUpdate, processUpdate, neighborChanged, randomTick })
  })

// Live Layer
export const BlockUpdateServiceLive = Layer.effect(
  BlockUpdateService,
  makeBlockUpdateService
)
```

## ブロックインタラクションシステム

### ブロックインタラクションサービス

```typescript
// BlockInteractionServiceインターフェース
interface BlockInteractionServiceInterface {
  readonly onBlockPlace: (
    position: WorldPosition,
    block: BlockId,
    placer: PlayerId,
    face: BlockFace
  ) => Effect.Effect<void, PlaceError>

  readonly onBlockBreak: (
    position: WorldPosition,
    breaker: PlayerId,
    tool?: ItemStack
  ) => Effect.Effect<ReadonlyArray<ItemStack>, BreakError>

  readonly onBlockActivate: (
    position: WorldPosition,
    player: PlayerId,
    hand: "main" | "off"
  ) => Effect.Effect<boolean, ActivateError>

  readonly onBlockCollide: (
    position: WorldPosition,
    entity: EntityId,
    velocity: Vector3
  ) => Effect.Effect<void, never>
}

// Context Tag（最新パターン）
export const BlockInteractionService = Context.GenericTag<BlockInteractionServiceInterface>("@app/BlockInteractionService")

// Live実装作成関数
const makeBlockInteractionService = Effect.gen(function* () {
  const world = yield* WorldService
  const registry = yield* BlockRegistry
  const events = yield* EventBus
  const inventory = yield* InventoryService

    const onBlockPlace = (
      position: WorldPosition,
      blockId: BlockId,
      placer: PlayerId,
      face: BlockFace
    ) => Effect.gen(function* () {
      // 配置位置の検証
      const targetPos = getPlacementPosition(position, face)
      const currentBlock = yield* world.getBlock(targetPos)

      // 早期リターン: 置き換え不可能なブロックの場合
      if (!currentBlock.isReplaceable) {
        return yield* Effect.fail(new BlockNotReplaceableError())
      }

      // 早期リターン: エンティティが阻害している場合
      const entities = yield* world.getEntitiesAt(targetPos)
      if (entities.length > 0) {
        return yield* Effect.fail(new EntityObstructionError())
      }

      // ブロック配置
      const definition = yield* registry.get(blockId)
      const state = getStateForPlacement(definition, position, face, placer)

      yield* world.setBlock(targetPos, blockId, state)

      // イベント発行
      yield* events.publish({
        type: "block_placed",
        position: targetPos,
        block: blockId,
        placer,
        timestamp: Date.now()
      })

      // 隣接ブロックに更新通知
      yield* notifyNeighbors(targetPos)
    })

    const onBlockBreak = (
      position: WorldPosition,
      breaker: PlayerId,
      tool?: ItemStack
    ) => Effect.gen(function* () {
      const block = yield* world.getBlock(position)
      const definition = yield* registry.get(block.id)

      // 早期リターン: 破壊不可能なブロックの場合
      if (definition.hardness < 0) {
        return yield* Effect.fail(new UnbreakableBlockError())
      }

      // 早期リターン: 不適切なツールの場合（ドロップなし）
      if (definition.toolRequired && (!tool || !isCorrectTool(tool, definition))) {
        yield* world.setBlock(position, "minecraft:air" as BlockId)
        return []
      }

      // ドロップ計算
      const drops = calculateDrops(definition, tool)

      // ブロック削除
      yield* world.setBlock(position, "minecraft:air" as BlockId)

      // イベント発行
      yield* events.publish({
        type: "block_broken",
        position,
        block: block.id,
        breaker,
        drops,
        timestamp: Date.now()
      })

      // 隣接ブロックに更新通知
      yield* notifyNeighbors(position)

      return drops
    })

    const onBlockActivate = (
      position: WorldPosition,
      player: PlayerId,
      hand: "main" | "off"
    ) => Effect.gen(function* () {
      const block = yield* world.getBlock(position)
      const definition = yield* registry.get(block.id)

      // Match パターンによるインタラクティブブロック処理
      return yield* pipe(
        block.id,
        Match.value,
        Match.when(
          (id) => id === "minecraft:chest",
          () => Effect.gen(function* () {
            yield* openContainer(position, player)
            return true
          })
        ),
        Match.when(
          (id) => id === "minecraft:crafting_table",
          () => Effect.gen(function* () {
            yield* openCraftingInterface(player)
            return true
          })
        ),
        Match.when(
          (id) => id === "minecraft:door" || id === "minecraft:trapdoor",
          () => Effect.gen(function* () {
            yield* toggleDoor(position)
            return true
          })
        ),
        Match.when(
          (id) => id === "minecraft:lever" || id === "minecraft:button",
          () => Effect.gen(function* () {
            yield* toggleRedstone(position)
            return true
          })
        ),
        Match.orElse(() => Effect.succeed(false))
      )
    })

    const onBlockCollide = (
      position: WorldPosition,
      entity: EntityId,
      velocity: Vector3
    ) => Effect.gen(function* () {
      const block = yield* world.getBlock(position)

      // Match パターンによる特殊ブロック衝突処理
      yield* pipe(
        block.id,
        Match.value,
        Match.when(
          (id) => id === "minecraft:slime_block",
          () => bounceEntity(entity, velocity)
        ),
        Match.when(
          (id) => id === "minecraft:soul_sand",
          () => slowEntity(entity)
        ),
        Match.when(
          (id) => id === "minecraft:cactus",
          () => damageEntity(entity, 1)
        ),
        Match.when(
          (id) => id === "minecraft:lava",
          () => burnEntity(entity)
        ),
        Match.orElse(() => Effect.void)
      )
    })

    return BlockInteractionService.of({ onBlockPlace, onBlockBreak, onBlockActivate, onBlockCollide })
  })

// Live Layer
export const BlockInteractionServiceLive = Layer.effect(
  BlockInteractionService,
  makeBlockInteractionService
)
```

## ブロックレンダリング

### ブロックメッシュ生成

```typescript
// BlockMeshServiceインターフェース
interface BlockMeshServiceInterface {
  readonly generateMesh: (
    block: BlockDefinition,
    state: BlockState,
    neighbors: NeighborBlocks
  ) => Effect.Effect<BlockMesh, never>

  readonly generateChunkMesh: (
    chunk: Chunk
  ) => Effect.Effect<ChunkMesh, never>

  readonly updateMesh: (
    position: WorldPosition
  ) => Effect.Effect<void, never>
}

// Context Tag（最新パターン）
export const BlockMeshService = Context.GenericTag<BlockMeshServiceInterface>("@app/BlockMeshService")

// Live実装
export const BlockMeshServiceLive = Layer.succeed(
  BlockMeshService,
  BlockMeshService.of({
    generateMesh: (block, state, neighbors) =>
      Effect.gen(function* () {
        const vertices: number[] = []
        const uvs: number[] = []
        const normals: number[] = []
        const indices: number[] = []

        // 各面の可視性チェック
        const faces = {
          top: !neighbors.top || neighbors.top.isTransparent,
          bottom: !neighbors.bottom || neighbors.bottom.isTransparent,
          north: !neighbors.north || neighbors.north.isTransparent,
          south: !neighbors.south || neighbors.south.isTransparent,
          east: !neighbors.east || neighbors.east.isTransparent,
          west: !neighbors.west || neighbors.west.isTransparent
        }

        // 可視面のメッシュ生成
        if (faces.top) addFace(vertices, uvs, normals, indices, "top", block)
        if (faces.bottom) addFace(vertices, uvs, normals, indices, "bottom", block)
        if (faces.north) addFace(vertices, uvs, normals, indices, "north", block)
        if (faces.south) addFace(vertices, uvs, normals, indices, "south", block)
        if (faces.east) addFace(vertices, uvs, normals, indices, "east", block)
        if (faces.west) addFace(vertices, uvs, normals, indices, "west", block)

        return {
          vertices: new Float32Array(vertices),
          uvs: new Float32Array(uvs),
          normals: new Float32Array(normals),
          indices: new Uint16Array(indices)
        }
      }),

    generateChunkMesh: (chunk) =>
      Effect.gen(function* () {
        // グリーディメッシング最適化
        const meshData = yield* greedyMeshing(chunk)
        return createOptimizedMesh(meshData)
      }),

    updateMesh: (position) =>
      Effect.gen(function* () {
        const chunkCoord = worldToChunkCoord(position)
        const chunk = yield* ChunkManager.getChunk(chunkCoord)
        const mesh = yield* generateChunkMesh(chunk)
        yield* RenderingService.updateChunkMesh(chunkCoord, mesh)
      })
  })
)
```

## 完全なブロックシステムレイヤー

```typescript
export const BlockSystemLayer = Layer.mergeAll(
  BlockRegistryLive,
  BlockUpdateServiceLive,
  BlockInteractionServiceLive,
  BlockMeshServiceLive
).pipe(
  Layer.provide(WorldServiceLive),
  Layer.provide(PhysicsServiceLive),
  Layer.provide(EventBusLive),
  Layer.provide(InventoryServiceLive),
  Layer.provide(ChunkManagerLive),
  Layer.provide(RenderingServiceLive)
)
```

## ブロック物理システム

### 物理エンジン統合

```typescript
// ブロック物理システム
interface BlockPhysicsServiceInterface {
  readonly processGravity: (
    position: WorldPosition
  ) => Effect.Effect<void, PhysicsError>

  readonly simulateFluidFlow: (
    position: WorldPosition,
    fluidType: "water" | "lava"
  ) => Effect.Effect<void, FluidError>

  readonly handleExplosion: (
    center: WorldPosition,
    power: number,
    createFire: boolean
  ) => Effect.Effect<void, ExplosionError>

  readonly processBlockFalling: (
    position: WorldPosition
  ) => Effect.Effect<void, never>
}

// Context Tag（最新パターン）
export const BlockPhysicsService = Context.GenericTag<BlockPhysicsServiceInterface>("@app/BlockPhysicsService")

// Live実装
const makeBlockPhysicsService = Effect.gen(function* () {
  const world = yield* WorldService
  const entity = yield* EntityService
  const particle = yield* ParticleService

  const processGravity = (position: WorldPosition) =>
    Effect.gen(function* () {
      const block = yield* world.getBlock(position)

      // 重力の影響を受けるブロックかチェック
      if (!isGravityAffected(block.id)) {
        return
      }

      const below = { ...position, y: position.y - 1 }
      const blockBelow = yield* world.getBlock(below)

      // 下に空間があるかチェック
      if (!blockBelow || blockBelow.id === "minecraft:air" || isFluid(blockBelow.id)) {
        // 落下エンティティを作成
        yield* createFallingBlock(position, block)
        yield* world.setBlock(position, "minecraft:air" as BlockId)
      }
    })

  const simulateFluidFlow = (position: WorldPosition, fluidType: "water" | "lava") =>
    Effect.gen(function* () {
      const currentBlock = yield* world.getBlock(position)

      // 流体レベルを取得
      const currentLevel = getFluidLevel(currentBlock)

      // 隣接ブロックへの流れをシミュレート
      const neighbors = yield* getNeighborPositions(position)

      for (const neighborPos of neighbors) {
        const neighbor = yield* world.getBlock(neighborPos)

        // 流れる条件をチェック
        if (canFluidFlowTo(currentBlock, neighbor, fluidType)) {
          const targetLevel = calculateFlowLevel(currentLevel, neighbor)

          // 新しい流体ブロックを配置
          yield* placeFluidBlock(neighborPos, fluidType, targetLevel)

          // 下向きの流れを優先
          if (neighborPos.y < position.y) {
            yield* scheduleFluidUpdate(neighborPos, 2) // 2tick後
          } else {
            yield* scheduleFluidUpdate(neighborPos, 5) // 5tick後
          }
        }
      }

      // 流体の更新を継続するかチェック
      if (shouldContinueFlow(currentLevel)) {
        yield* scheduleFluidUpdate(position, getFluidTickRate(fluidType))
      }
    })

  const handleExplosion = (center: WorldPosition, power: number, createFire: boolean) =>
    Effect.gen(function* () {
      const affectedPositions = calculateExplosionSphere(center, power)

      for (const pos of affectedPositions) {
        const distance = calculateDistance(center, pos)
        const intensity = calculateExplosionIntensity(power, distance)

        const block = yield* world.getBlock(pos)

        // ブロックの爆発耐性チェック
        if (block.properties.resistance < intensity) {
          // ブロックを破壊
          yield* world.setBlock(pos, "minecraft:air" as BlockId)

          // ドロップアイテムを生成（確率的）
          const dropChance = 1.0 / power // 爆発力に反比例
          if (Math.random() < dropChance) {
            yield* spawnBlockDrops(pos, block)
          }

          // 火を設置（TNT等）
          if (createFire && Math.random() < 0.3) {
            yield* maybeSetFire(pos)
          }

          // 爆発パーティクルを生成
          yield* particle.spawn({
            type: "explosion",
            position: pos,
            velocity: calculateExplosionVelocity(center, pos, intensity),
            lifetime: 30
          })
        }
      }

      // 爆発音の再生
      yield* playExplosionSound(center, power)
    })

  const processBlockFalling = (position: WorldPosition) =>
    Effect.gen(function* () {
      const block = yield* world.getBlock(position)

      // 落下ブロック（砂、砂利等）の処理
      const fallDistance = yield* calculateFallDistance(position)

      if (fallDistance > 0) {
        const landingPos = { ...position, y: position.y - fallDistance }

        // 着地処理
        const landingBlock = yield* world.getBlock(landingPos)

        if (landingBlock.id === "minecraft:air") {
          // 通常の着地
          yield* world.setBlock(landingPos, block.id)
          yield* world.setBlock(position, "minecraft:air" as BlockId)
        } else if (isBreakableByFalling(landingBlock.id)) {
          // 既存ブロックを破壊して着地
          const drops = yield* calculateBlockDrops(landingPos, landingBlock)
          yield* spawnItems(landingPos, drops)
          yield* world.setBlock(landingPos, block.id)
          yield* world.setBlock(position, "minecraft:air" as BlockId)
        }

        // 落下音を再生
        yield* playSoundEffect(landingPos, "block.sand.fall")
      }
    })

  return BlockPhysicsService.of({
    processGravity,
    simulateFluidFlow,
    handleExplosion,
    processBlockFalling
  })
})

// 重力の影響を受けるブロック判定
const isGravityAffected = (blockId: BlockId): boolean =>
  Match.value(blockId).pipe(
    Match.when("minecraft:sand", () => true),
    Match.when("minecraft:gravel", () => true),
    Match.when("minecraft:anvil", () => true),
    Match.when("minecraft:concrete_powder", () => true),
    Match.orElse(() => false)
  )

// 流体レベル計算
const calculateFlowLevel = (sourceLevel: number, targetBlock: BlockDefinition): number => {
  if (targetBlock.id === "minecraft:air") {
    return Math.max(0, sourceLevel - 1)
  }
  return 0
}

// 爆発範囲計算（球体）
const calculateExplosionSphere = (center: WorldPosition, radius: number): WorldPosition[] => {
  const positions: WorldPosition[] = []
  const radiusSquared = radius * radius

  for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
      for (let z = -radius; z <= radius; z++) {
        const distanceSquared = x * x + y * y + z * z

        if (distanceSquared <= radiusSquared) {
          positions.push({
            x: center.x + x,
            y: center.y + y,
            z: center.z + z
          })
        }
      }
    }
  }

  return positions
}

// Live Layer
export const BlockPhysicsServiceLive = Layer.effect(
  BlockPhysicsService,
  makeBlockPhysicsService
)
```

## レッドストーンシステム基盤

### レッドストーン信号処理

```typescript
// レッドストーン信号システム
interface RedstoneServiceInterface {
  readonly calculatePower: (
    position: WorldPosition
  ) => Effect.Effect<number, never>

  readonly propagatePower: (
    source: WorldPosition,
    power: number
  ) => Effect.Effect<void, never>

  readonly updateNetwork: (
    position: WorldPosition
  ) => Effect.Effect<void, never>

  readonly isRedstoneComponent: (
    blockId: BlockId
  ) => boolean

  readonly isPowered: (
    position: WorldPosition
  ) => Effect.Effect<boolean, never>
}

// Context Tag（最新パターン）
export const RedstoneService = Context.GenericTag<RedstoneServiceInterface>("@app/RedstoneService")

// Live実装
const makeRedstoneService = Effect.gen(function* () {
  const world = yield* WorldService
  const powerCache = yield* Ref.make(new Map<string, number>())

  const calculatePower = (position: WorldPosition) =>
    Effect.gen(function* () {
      const posKey = positionToKey(position)
      const cached = yield* Ref.get(powerCache)

      // キャッシュから取得
      if (cached.has(posKey)) {
        return cached.get(posKey)!
      }

      const block = yield* world.getBlock(position)
      let maxPower = 0

      // ダイレクト電源チェック（レッドストーントーチ、レバー等）
      if (isDirectPowerSource(block.id)) {
        maxPower = getDirectPowerLevel(block)
      } else {
        // 隣接ブロックからの電力を計算
        const neighbors = getNeighborPositions(position)

        for (const neighborPos of neighbors) {
          const neighbor = yield* world.getBlock(neighborPos)

          if (isRedstoneComponent(neighbor.id)) {
            const neighborPower = yield* calculateNeighborPower(neighborPos, neighbor)
            maxPower = Math.max(maxPower, neighborPower - 1)
          }
        }
      }

      // 最大15に制限
      maxPower = Math.min(15, Math.max(0, maxPower))

      // キャッシュに保存
      yield* Ref.update(powerCache, cache =>
        new Map(cache).set(posKey, maxPower)
      )

      return maxPower
    })

  const propagatePower = (source: WorldPosition, power: number) =>
    Effect.gen(function* () {
      const visited = new Set<string>()
      const queue = [{ position: source, power }]

      while (queue.length > 0) {
        const current = queue.shift()!
        const posKey = positionToKey(current.position)

        if (visited.has(posKey) || current.power <= 0) {
          continue
        }

        visited.add(posKey)

        const neighbors = getRedstoneNeighbors(current.position)

        for (const neighborPos of neighbors) {
          const neighbor = yield* world.getBlock(neighborPos)

          if (canTransmitPower(neighbor.id)) {
            const newPower = current.power - 1

            if (newPower > 0) {
              queue.push({ position: neighborPos, power: newPower })

              // レッドストーン機器の状態更新
              yield* updateRedstoneDevice(neighborPos, newPower)
            }
          }
        }
      }
    })

  const updateNetwork = (position: WorldPosition) =>
    Effect.gen(function* () {
      // キャッシュをクリア
      yield* Ref.set(powerCache, new Map())

      const block = yield* world.getBlock(position)

      // レッドストーン機器の動作判定
      const power = yield* calculatePower(position)
      const wasPowered = block.state.powered || false
      const nowPowered = power > 0

      // 状態変化があった場合のみ更新
      if (wasPowered !== nowPowered) {
        yield* world.updateBlockState(position, { powered: nowPowered })

        // 機器固有の処理
        yield* handleRedstoneDeviceUpdate(position, block.id, nowPowered)

        // 隣接ブロックに更新を伝播
        const neighbors = getNeighborPositions(position)
        for (const neighborPos of neighbors) {
          yield* BlockUpdateService.neighborChanged(neighborPos, position)
        }
      }
    })

  const isRedstoneComponent = (blockId: BlockId): boolean =>
    Match.value(blockId).pipe(
      Match.when("minecraft:redstone_wire", () => true),
      Match.when("minecraft:redstone_torch", () => true),
      Match.when("minecraft:lever", () => true),
      Match.when("minecraft:button", () => true),
      Match.when("minecraft:pressure_plate", () => true),
      Match.when("minecraft:tripwire_hook", () => true),
      Match.when("minecraft:observer", () => true),
      Match.when("minecraft:dispenser", () => true),
      Match.when("minecraft:dropper", () => true),
      Match.when("minecraft:piston", () => true),
      Match.orElse(() => false)
    )

  const isPowered = (position: WorldPosition) =>
    Effect.gen(function* () {
      const power = yield* calculatePower(position)
      return power > 0
    })

  // レッドストーン機器の状態更新
  const handleRedstoneDeviceUpdate = (
    position: WorldPosition,
    blockId: BlockId,
    powered: boolean
  ) =>
    Match.value(blockId).pipe(
      Match.when("minecraft:piston", () =>
        powered ? extendPiston(position) : retractPiston(position)
      ),
      Match.when("minecraft:dispenser", () =>
        powered ? activateDispenser(position) : Effect.unit
      ),
      Match.when("minecraft:redstone_lamp", () =>
        setLampState(position, powered)
      ),
      Match.orElse(() => Effect.unit)
    )

  return RedstoneService.of({
    calculatePower,
    propagatePower,
    updateNetwork,
    isRedstoneComponent,
    isPowered
  })
})

// ヘルパー関数
const positionToKey = (pos: WorldPosition): string => `${pos.x},${pos.y},${pos.z}`

const isDirectPowerSource = (blockId: BlockId): boolean =>
  Match.value(blockId).pipe(
    Match.when("minecraft:redstone_torch", () => true),
    Match.when("minecraft:lever", () => true),
    Match.when("minecraft:button", () => true),
    Match.orElse(() => false)
  )

const getDirectPowerLevel = (block: BlockDefinition): number =>
  Match.value(block.id).pipe(
    Match.when("minecraft:redstone_torch", () => 15),
    Match.when("minecraft:lever", () => block.state.powered ? 15 : 0),
    Match.when("minecraft:button", () => block.state.powered ? 15 : 0),
    Match.orElse(() => 0)
  )

// Live Layer
export const RedstoneServiceLive = Layer.effect(
  RedstoneService,
  makeRedstoneService
)
```

## ブロックレンダリング最適化

### 高度なメッシュ生成

```typescript
// 高度なメッシュ生成最適化
interface BlockRenderingServiceInterface {
  readonly generateOptimizedMesh: (
    chunk: Chunk
  ) => Effect.Effect<OptimizedMesh, never>

  readonly applyCulling: (
    block: BlockDefinition,
    neighbors: NeighborBlocks
  ) => CullingResult

  readonly generateLODMesh: (
    chunk: Chunk,
    distance: number
  ) => Effect.Effect<LODMesh, never>

  readonly batchMeshGeneration: (
    chunks: ReadonlyArray<Chunk>
  ) => Effect.Effect<ReadonlyArray<OptimizedMesh>, never>
}

// Context Tag（最新パターン）
export const BlockRenderingService = Context.GenericTag<BlockRenderingServiceInterface>("@app/BlockRenderingService")

// 最適化されたメッシュ生成
const makeBlockRenderingService = Effect.gen(function* () {
  const generateOptimizedMesh = (chunk: Chunk) =>
    Effect.gen(function* () {
      // グリーディメッシング最適化
      const greedyMesh = yield* greedyMeshing(chunk)

      // 面結合最適化
      const mergedMesh = yield* mergeFaces(greedyMesh)

      // バーテックス最適化
      const optimizedVertices = yield* optimizeVertices(mergedMesh)

      // インデックス生成
      const indices = generateIndices(optimizedVertices)

      return {
        vertices: optimizedVertices,
        indices,
        materialGroups: extractMaterialGroups(optimizedVertices),
        boundingBox: calculateBoundingBox(optimizedVertices)
      }
    })

  const applyCulling = (block: BlockDefinition, neighbors: NeighborBlocks): CullingResult => {
    const visibleFaces: BlockFace[] = []

    // 各面の可視性判定
    if (!neighbors.top || neighbors.top.isTransparent) visibleFaces.push("top")
    if (!neighbors.bottom || neighbors.bottom.isTransparent) visibleFaces.push("bottom")
    if (!neighbors.north || neighbors.north.isTransparent) visibleFaces.push("north")
    if (!neighbors.south || neighbors.south.isTransparent) visibleFaces.push("south")
    if (!neighbors.east || neighbors.east.isTransparent) visibleFaces.push("east")
    if (!neighbors.west || neighbors.west.isTransparent) visibleFaces.push("west")

    return {
      visibleFaces,
      shouldRender: visibleFaces.length > 0,
      isCompletelyHidden: visibleFaces.length === 0
    }
  }

  const generateLODMesh = (chunk: Chunk, distance: number) =>
    Effect.gen(function* () {
      // 距離に基づくLODレベル決定
      const lodLevel = calculateLODLevel(distance)

      switch (lodLevel) {
        case 0: // 高詳細（近距離）
          return yield* generateOptimizedMesh(chunk)

        case 1: // 中詳細
          const simplifiedChunk = yield* simplifyChunk(chunk, 0.7)
          return yield* generateOptimizedMesh(simplifiedChunk)

        case 2: // 低詳細（遠距離）
          const verySimplifiedChunk = yield* simplifyChunk(chunk, 0.4)
          return yield* generateOptimizedMesh(verySimplifiedChunk)

        default:
          // 非常に遠距離 - インポスター使用
          return yield* generateImpostor(chunk)
      }
    })

  const batchMeshGeneration = (chunks: ReadonlyArray<Chunk>) =>
    Effect.gen(function* () {
      // パラレル処理でメッシュ生成
      return yield* Effect.all(
        chunks.map(chunk => generateOptimizedMesh(chunk)),
        { concurrency: 4 } // CPU コア数に応じて調整
      )
    })

  return BlockRenderingService.of({
    generateOptimizedMesh,
    applyCulling,
    generateLODMesh,
    batchMeshGeneration
  })
})

// グリーディメッシング実装
const greedyMeshing = (chunk: Chunk): Effect.Effect<GreedyMesh, never> =>
  Effect.gen(function* () {
    const faces: Face[] = []
    const processed = new Set<string>()

    // X軸方向のスライス
    for (let x = 0; x <= 16; x++) {
      const mask = new Array<BlockType | null>(16 * 16).fill(null)

      for (let y = 0; y < 16; y++) {
        for (let z = 0; z < 16; z++) {
          const pos1 = { x: x - 1, y, z }
          const pos2 = { x, y, z }

          const block1 = x > 0 ? chunk.getBlock(pos1) : null
          const block2 = x < 16 ? chunk.getBlock(pos2) : null

          if (shouldCreateFace(block1, block2)) {
            mask[y * 16 + z] = block1 || block2
          }
        }
      }

      // マスクから面を生成
      const generatedFaces = yield* generateFacesFromMask(mask, "x", x)
      faces.push(...generatedFaces)
    }

    // Y軸、Z軸方向も同様に処理...

    return { faces, vertexCount: faces.length * 4 }
  })

// 頂点最適化
const optimizeVertices = (mesh: GreedyMesh): Effect.Effect<Float32Array, never> =>
  Effect.gen(function* () {
    const vertices: number[] = []
    const vertexMap = new Map<string, number>()

    for (const face of mesh.faces) {
      for (const vertex of face.vertices) {
        const key = `${vertex.x},${vertex.y},${vertex.z}`

        if (!vertexMap.has(key)) {
          vertexMap.set(key, vertices.length / 3)
          vertices.push(vertex.x, vertex.y, vertex.z)
        }
      }
    }

    return new Float32Array(vertices)
  })

// Live Layer
export const BlockRenderingServiceLive = Layer.effect(
  BlockRenderingService,
  makeBlockRenderingService
)
```

## パフォーマンス最適化 & メモリ管理

### メモリ効率の良いブロック管理

```typescript
// パフォーマンス最適化とメモリ管理
interface BlockPerformanceServiceInterface {
  readonly optimizeMemoryUsage: () => Effect.Effect<MemoryStats, never>
  readonly preloadBlocks: (region: WorldRegion) => Effect.Effect<void, never>
  readonly unloadUnusedBlocks: () => Effect.Effect<number, never>
  readonly getPerformanceMetrics: () => Effect.Effect<PerformanceMetrics, never>
  readonly enableCaching: (cacheSize: number) => Effect.Effect<void, never>
}

// Context Tag（最新パターン）
export const BlockPerformanceService = Context.GenericTag<BlockPerformanceServiceInterface>("@app/BlockPerformanceService")

// 高性能実装
const makeBlockPerformanceService = Effect.gen(function* () {
  // Structure of Arrays (SoA) による最適化
  const blockIds = yield* Ref.make(new Uint16Array(16 * 16 * 16 * 1000)) // 1000チャンク分
  const blockStates = yield* Ref.make(new Uint8Array(16 * 16 * 16 * 1000))
  const lightLevels = yield* Ref.make(new Uint8Array(16 * 16 * 16 * 1000))

  // LRU キャッシュ
  const meshCache = yield* Ref.make(new Map<string, CachedMesh>())
  const blockDataCache = yield* Ref.make(new Map<string, BlockData>())

  // パフォーマンス計測
  const performanceMetrics = yield* Ref.make({
    meshGenerationTime: 0,
    blockUpdateTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    renderTime: 0
  })

  const optimizeMemoryUsage = () =>
    Effect.gen(function* () {
      // ガベージコレクション実行
      yield* forceGarbageCollection()

      // 未使用メッシュキャッシュの削除
      yield* cleanupMeshCache()

      // ブロックデータの圧縮
      const compressedSize = yield* compressBlockData()

      // メモリ使用量計測
      const memoryUsage = yield* measureMemoryUsage()

      return {
        totalMemory: memoryUsage.total,
        usedMemory: memoryUsage.used,
        blockMemory: compressedSize,
        cacheMemory: yield* calculateCacheMemory(),
        meshMemory: yield* calculateMeshMemory()
      }
    })

  const preloadBlocks = (region: WorldRegion) =>
    Effect.gen(function* () {
      const chunks = getChunksInRegion(region)

      // 並列でブロックデータをプリロード
      yield* Effect.all(
        chunks.map(chunkPos =>
          Effect.gen(function* () {
            const chunk = yield* ChunkManager.getChunk(chunkPos)
            const mesh = yield* BlockRenderingService.generateOptimizedMesh(chunk)

            // キャッシュに保存
            const cacheKey = chunkPositionToKey(chunkPos)
            yield* Ref.update(meshCache, cache =>
              new Map(cache).set(cacheKey, {
                mesh,
                lastAccessed: Date.now(),
                accessCount: 1
              })
            )
          })
        ),
        { concurrency: 8 }
      )
    })

  const unloadUnusedBlocks = () =>
    Effect.gen(function* () {
      const currentTime = Date.now()
      const unloadThreshold = 5 * 60 * 1000 // 5分間未使用

      let unloadedCount = 0

      // メッシュキャッシュのクリーンアップ
      yield* Ref.update(meshCache, cache => {
        const newCache = new Map<string, CachedMesh>()

        for (const [key, cachedMesh] of cache.entries()) {
          if (currentTime - cachedMesh.lastAccessed < unloadThreshold) {
            newCache.set(key, cachedMesh)
          } else {
            unloadedCount++
          }
        }

        return newCache
      })

      // ブロックデータキャッシュのクリーンアップ
      yield* Ref.update(blockDataCache, cache => {
        const newCache = new Map<string, BlockData>()

        for (const [key, blockData] of cache.entries()) {
          if (currentTime - blockData.lastAccessed < unloadThreshold) {
            newCache.set(key, blockData)
          } else {
            unloadedCount++
          }
        }

        return newCache
      })

      return unloadedCount
    })

  const getPerformanceMetrics = () =>
    Effect.gen(function* () {
      const metrics = yield* Ref.get(performanceMetrics)
      const memoryStats = yield* optimizeMemoryUsage()
      const cacheStats = yield* calculateCacheStats()

      return {
        ...metrics,
        memoryStats,
        cacheStats,
        timestamp: Date.now()
      }
    })

  const enableCaching = (cacheSize: number) =>
    Effect.gen(function* () {
      // キャッシュサイズの設定
      yield* Ref.set(meshCache, new Map())
      yield* Ref.set(blockDataCache, new Map())

      // バックグラウンドでキャッシュクリーンアップを実行
      yield* Effect.forkDaemon(
        Effect.gen(function* () {
          yield* Effect.forever(
            Effect.gen(function* () {
              yield* Effect.sleep(Duration.seconds(30))
              yield* cleanupCacheIfNeeded(cacheSize)
            })
          )
        })
      )
    })

  // バッチ処理による高速化
  const batchBlockUpdates = (updates: BlockUpdate[]) =>
    Effect.gen(function* () {
      const startTime = performance.now()

      // 更新を種類別にグループ化
      const groupedUpdates = groupUpdatesByType(updates)

      // 各グループを並列処理
      yield* Effect.all([
        processMeshUpdates(groupedUpdates.mesh || []),
        processPhysicsUpdates(groupedUpdates.physics || []),
        processRedstoneUpdates(groupedUpdates.redstone || [])
      ])

      const endTime = performance.now()

      // パフォーマンス指標更新
      yield* Ref.update(performanceMetrics, metrics => ({
        ...metrics,
        blockUpdateTime: endTime - startTime
      }))
    })

  // SIMD最適化（TypedArray使用）
  const optimizedBlockProcessing = (blockData: Uint16Array) =>
    Effect.gen(function* () {
      // 16要素ずつ処理してSIMD最適化を活用
      const batchSize = 16
      const results = new Uint16Array(blockData.length)

      for (let i = 0; i < blockData.length; i += batchSize) {
        const batch = blockData.slice(i, Math.min(i + batchSize, blockData.length))
        const processed = processBatchOptimized(batch)
        results.set(processed, i)
      }

      return results
    })

  return BlockPerformanceService.of({
    optimizeMemoryUsage,
    preloadBlocks,
    unloadUnusedBlocks,
    getPerformanceMetrics,
    enableCaching
  })
})

// ヘルパー関数
const forceGarbageCollection = (): Effect.Effect<void, never> =>
  Effect.sync(() => {
    // WebWorkerでGCを促進
    if (typeof window !== "undefined" && window.gc) {
      window.gc()
    }
  })

const compressBlockData = (): Effect.Effect<number, never> =>
  Effect.sync(() => {
    // ブロックデータの圧縮実装
    // Run-Length Encoding等を使用
    return 0 // 圧縮後のサイズを返す
  })

const calculateCacheStats = (): Effect.Effect<CacheStats, never> =>
  Effect.sync(() => ({
    hitRate: 0.85,
    missRate: 0.15,
    totalRequests: 10000,
    cacheSize: 256 * 1024 * 1024 // 256MB
  }))

// Live Layer
export const BlockPerformanceServiceLive = Layer.effect(
  BlockPerformanceService,
  makeBlockPerformanceService
)

// 完全なBlock System Layer（拡張版）
export const CompleteBlockSystemLayer = Layer.mergeAll(
  BlockRegistryLive,
  BlockUpdateServiceLive,
  BlockInteractionServiceLive,
  BlockMeshServiceLive,
  BlockPhysicsServiceLive,
  RedstoneServiceLive,
  BlockRenderingServiceLive,
  BlockPerformanceServiceLive
).pipe(
  Layer.provide(WorldServiceLive),
  Layer.provide(PhysicsServiceLive),
  Layer.provide(EventBusLive),
  Layer.provide(InventoryServiceLive),
  Layer.provide(ChunkManagerLive),
  Layer.provide(RenderingServiceLive),
  Layer.provide(EntityServiceLive),
  Layer.provide(ParticleServiceLive)
)
