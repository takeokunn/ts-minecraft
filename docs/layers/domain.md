# Domain Layer - ビジネスロジック・コアドメイン

Domain層は、ビジネスルールとドメインロジックを表現するアプリケーションの中核部分です。Effect-TSを活用した関数型プログラミングにより、不変性と型安全性を保証しながら純粋なビジネスロジックを実装しています。

## ディレクトリ構成

```
src/domain/
├── entities/          # エンティティ（ビジネスオブジェクト）
│   ├── components/    # ECSコンポーネント
│   ├── world.entity.ts
│   ├── player.entity.ts
│   ├── chunk.entity.ts
│   └── block.entity.ts
├── value-objects/     # 値オブジェクト（不変オブジェクト）
│   ├── coordinates/   # 座標系
│   ├── math/          # 数学的値
│   └── physics/       # 物理系
├── services/          # ドメインサービス
├── ports/            # インターフェース定義（依存性逆転）
├── errors/           # ドメイン固有のエラー定義
├── constants/        # ドメイン定数
├── utils/           # ドメインユーティリティ
└── __tests__/       # ドメインテスト

## 1. エンティティ（Entities）

ゲーム世界のビジネスオブジェクトを表現するエンティティ群。

### 主要エンティティ

#### World Entity
```typescript
// src/domain/entities/world.entity.ts
import { Schema, Effect, Match } from "effect"
import type { ValidationError } from "../errors/unified-errors"

// WorldStateスキーマ定義
export const WorldState = Schema.Struct({
  difficulty: Schema.Literal("peaceful", "easy", "normal", "hard"),
  weather: Schema.Struct({
    type: Schema.Literal("clear", "rain", "storm"),
    intensity: Schema.Number.pipe(Schema.between(0, 1)),
    duration: Schema.Number.pipe(Schema.nonNegative())
  }),
  gameRules: Schema.Map({
    key: Schema.String,
    value: Schema.Union(
      Schema.Boolean,
      Schema.Number,
      Schema.String
    )
  }),
  seed: Schema.Number.pipe(Schema.brand("WorldSeed")),
  spawnPoint: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  time: Schema.Number.pipe(Schema.nonNegative(), Schema.brand("WorldTime")),
  dayTime: Schema.Number.pipe(Schema.between(0, 24000)),
  worldAge: Schema.Number.pipe(Schema.nonNegative())
})

export type WorldState = Schema.Schema.Type<typeof WorldState>

// WorldState作成関数（早期リターンパターン）
export const createWorldState = (config: {
  difficulty?: WorldState["difficulty"]
  seed: number
  spawnPoint: WorldState["spawnPoint"]
}): Effect.Effect<WorldState, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: シード値検証
    if (config.seed < 0) {
      return yield* Effect.fail(createValidationError("Seed must be non-negative"))
    }

    // 早期リターン: スポーンポイント検証
    if (!isValidSpawnPoint(config.spawnPoint)) {
      return yield* Effect.fail(createValidationError("Invalid spawn point coordinates"))
    }

    const worldState: WorldState = {
      difficulty: config.difficulty ?? "normal",
      weather: createDefaultWeather(),
      gameRules: createDefaultGameRules(),
      seed: config.seed as WorldState["seed"],
      spawnPoint: config.spawnPoint,
      time: 0 as WorldState["time"],
      dayTime: 6000, // 朝
      worldAge: 0
    }

    return worldState
  })

// 単一責務の補助関数群
const createDefaultWeather = (): WorldState["weather"] => ({
  type: "clear",
  intensity: 0,
  duration: 0
})

const createDefaultGameRules = (): WorldState["gameRules"] =>
  new Map([
    ["doDaylightCycle", true],
    ["doWeatherCycle", true],
    ["keepInventory", false],
    ["mobGriefing", true],
    ["naturalRegeneration", true]
  ])

const isValidSpawnPoint = (point: WorldState["spawnPoint"]): boolean =>
  point.y >= 0 && point.y <= 256 &&
  Number.isFinite(point.x) && Number.isFinite(point.z)

const createValidationError = (message: string, field?: string): ValidationError => ({
  _tag: "ValidationError",
  message,
  field,
  timestamp: Date.now()
})

// WorldState操作関数群（純粋関数・PBTテスト対応）
export const setDifficulty = (world: WorldState, difficulty: WorldState["difficulty"]): Effect.Effect<WorldState, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: 難易度検証
    if (!isValidDifficulty(difficulty)) {
      return yield* Effect.fail(createValidationError(`Invalid difficulty: ${difficulty}`))
    }

    return { ...world, difficulty }
  })

export const setWeather = (world: WorldState, weather: WorldState["weather"]): Effect.Effect<WorldState, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: 天候データ検証
    if (!isValidWeather(weather)) {
      return yield* Effect.fail(createValidationError("Invalid weather configuration"))
    }

    return { ...world, weather }
  })

export const updateTime = (world: WorldState, deltaTime: number): Effect.Effect<WorldState, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: デルタ時間検証
    if (deltaTime < 0) {
      return yield* Effect.fail(createValidationError("Delta time must be non-negative"))
    }

    const newTime = calculateNewTime(world.time, deltaTime)
    const newDayTime = calculateDayTime(world.dayTime, deltaTime)
    const newWorldAge = world.worldAge + deltaTime

    return {
      ...world,
      time: newTime,
      dayTime: newDayTime,
      worldAge: newWorldAge
    }
  })

export const setGameRule = (world: WorldState, rule: string, value: boolean | number | string): Effect.Effect<WorldState, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: ルール名検証
    if (!isValidGameRule(rule)) {
      return yield* Effect.fail(createValidationError(`Invalid game rule: ${rule}`))
    }

    const newGameRules = new Map(world.gameRules).set(rule, value)
    return { ...world, gameRules: newGameRules }
  })

// 純粋関数群（PBTテスト対応）
const isValidDifficulty = (difficulty: string): difficulty is WorldState["difficulty"] =>
  ["peaceful", "easy", "normal", "hard"].includes(difficulty)

const isValidWeather = (weather: WorldState["weather"]): boolean =>
  weather.intensity >= 0 && weather.intensity <= 1 &&
  weather.duration >= 0 &&
  ["clear", "rain", "storm"].includes(weather.type)

const calculateNewTime = (currentTime: number, deltaTime: number): WorldState["time"] =>
  (currentTime + deltaTime) as WorldState["time"]

const calculateDayTime = (currentDayTime: number, deltaTime: number): number =>
  (currentDayTime + deltaTime) % 24000

const isValidGameRule = (rule: string): boolean =>
  ["doDaylightCycle", "doWeatherCycle", "keepInventory", "mobGriefing", "naturalRegeneration"].includes(rule)
```

**機能:**
- ゲーム世界の不変状態管理
- 難易度設定（Peaceful, Easy, Normal, Hard）
- 天候システム（Clear, Rain, Storm）
- ゲームルール管理
- スポーンポイント・時間管理

#### Player Entity
```typescript
// src/domain/entities/player.entity.ts
import { Schema, Effect, Match } from "effect"
import type { ValidationError } from "../errors/unified-errors"

// Playerスキーマ定義
export const Player = Schema.Struct({
  id: Schema.UUID.pipe(Schema.brand("EntityId")),
  name: Schema.String.pipe(
    Schema.minLength(3),
    Schema.maxLength(16),
    Schema.pattern(/^[a-zA-Z0-9_]+$/),
    Schema.brand("PlayerName")
  ),
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  rotation: Schema.Struct({
    yaw: Schema.Number.pipe(Schema.between(-180, 180)),
    pitch: Schema.Number.pipe(Schema.between(-90, 90))
  }),
  velocity: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  inventory: Schema.Struct({
    slots: Schema.Array(
      Schema.Union(
        Schema.Struct({
          itemId: Schema.String.pipe(Schema.brand("ItemId")),
          count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
          damage: Schema.Number.pipe(Schema.int(), Schema.between(0, 1000)),
          enchantments: Schema.Array(Schema.Struct({
            id: Schema.String,
            level: Schema.Number.pipe(Schema.int(), Schema.between(1, 5))
          }))
        }),
        Schema.Null
      )
    ).pipe(Schema.itemsCount(36)),
    hotbar: Schema.Array(
      Schema.Union(
        Schema.Struct({
          itemId: Schema.String.pipe(Schema.brand("ItemId")),
          count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
          damage: Schema.Number.pipe(Schema.int(), Schema.between(0, 1000)),
          enchantments: Schema.Array(Schema.Struct({
            id: Schema.String,
            level: Schema.Number.pipe(Schema.int(), Schema.between(1, 5))
          }))
        }),
        Schema.Null
      )
    ).pipe(Schema.itemsCount(9)),
    selectedSlot: Schema.Number.pipe(Schema.int(), Schema.between(0, 8))
  }),
  gameMode: Schema.Literal("survival", "creative", "adventure", "spectator"),
  stats: Schema.Struct({
    health: Schema.Number.pipe(Schema.between(0, 20), Schema.brand("Health")),
    hunger: Schema.Number.pipe(Schema.between(0, 20), Schema.brand("Hunger")),
    saturation: Schema.Number.pipe(Schema.between(0, 20), Schema.brand("Saturation")),
    experience: Schema.Number.pipe(Schema.nonNegative(), Schema.brand("Experience")),
    level: Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand("Level")),
    armor: Schema.Number.pipe(Schema.between(0, 20), Schema.brand("Armor"))
  }),
  abilities: Schema.Struct({
    canFly: Schema.Boolean,
    isFlying: Schema.Boolean,
    canBreakBlocks: Schema.Boolean,
    canPlaceBlocks: Schema.Boolean,
    invulnerable: Schema.Boolean,
    walkSpeed: Schema.Number.pipe(Schema.between(0, 1)),
    flySpeed: Schema.Number.pipe(Schema.between(0, 1))
  }),
  createdAt: Schema.DateTimeUtc,
  lastLogin: Schema.DateTimeUtc
})

export type Player = Schema.Schema.Type<typeof Player>

// Player作成関数（早期リターン・単一責務パターン）
export const createPlayer = (
  name: string,
  position: Player["position"],
  gameMode: Player["gameMode"] = "survival"
): Effect.Effect<Player, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: 名前検証
    if (!isValidPlayerName(name)) {
      return yield* Effect.fail(createValidationError("Invalid player name"))
    }

    // 早期リターン: ポジション検証
    if (!isValidPosition(position)) {
      return yield* Effect.fail(createValidationError("Invalid player position"))
    }

    const now = new Date()
    const playerId = yield* generatePlayerId()

    const player: Player = {
      id: playerId,
      name: name as Player["name"],
      position,
      rotation: createDefaultRotation(),
      velocity: createDefaultVelocity(),
      inventory: createDefaultInventory(),
      gameMode,
      stats: createDefaultStats(),
      abilities: createAbilitiesForGameMode(gameMode),
      createdAt: now,
      lastLogin: now
    }

    return player
  })

// 単一責務の補助関数群（PBTテスト対応）
const isValidPlayerName = (name: string): boolean =>
  name.length >= 3 && name.length <= 16 && /^[a-zA-Z0-9_]+$/.test(name)

const isValidPosition = (position: Player["position"]): boolean =>
  Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z) &&
  position.y >= -64 && position.y <= 320

const generatePlayerId = (): Effect.Effect<Player["id"], never> =>
  Effect.sync(() => crypto.randomUUID() as Player["id"])

const createDefaultRotation = (): Player["rotation"] => ({ yaw: 0, pitch: 0 })

const createDefaultVelocity = (): Player["velocity"] => ({ x: 0, y: 0, z: 0 })

const createDefaultInventory = (): Player["inventory"] => ({
  slots: Array(36).fill(null),
  hotbar: Array(9).fill(null),
  selectedSlot: 0
})

const createDefaultStats = (): Player["stats"] => ({
  health: 20 as Player["stats"]["health"],
  hunger: 20 as Player["stats"]["hunger"],
  saturation: 5 as Player["stats"]["saturation"],
  experience: 0 as Player["stats"]["experience"],
  level: 0 as Player["stats"]["level"],
  armor: 0 as Player["stats"]["armor"]
})

const createAbilitiesForGameMode = (gameMode: Player["gameMode"]): Player["abilities"] =>
  Match.value(gameMode).pipe(
    Match.when("creative", () => ({
      canFly: true,
      isFlying: false,
      canBreakBlocks: true,
      canPlaceBlocks: true,
      invulnerable: true,
      walkSpeed: 0.1,
      flySpeed: 0.05
    })),
    Match.when("spectator", () => ({
      canFly: true,
      isFlying: true,
      canBreakBlocks: false,
      canPlaceBlocks: false,
      invulnerable: true,
      walkSpeed: 0.1,
      flySpeed: 0.1
    })),
    Match.orElse(() => ({
      canFly: false,
      isFlying: false,
      canBreakBlocks: true,
      canPlaceBlocks: true,
      invulnerable: false,
      walkSpeed: 0.1,
      flySpeed: 0.05
    }))
  )

// Player操作関数群（純粋関数・Effect包装）
export const movePlayer = (player: Player, position: Player["position"]): Effect.Effect<Player, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: ポジション検証
    if (!isValidPosition(position)) {
      return yield* Effect.fail(createValidationError("Invalid movement position"))
    }

    return { ...player, position, lastLogin: new Date() }
  })

export const setPlayerHealth = (player: Player, health: number): Effect.Effect<Player, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: 体力値検証
    if (health < 0 || health > 20) {
      return yield* Effect.fail(createValidationError("Health must be between 0 and 20"))
    }

    const clampedHealth = Math.max(0, Math.min(20, health)) as Player["stats"]["health"]

    return {
      ...player,
      stats: { ...player.stats, health: clampedHealth }
    }
  })

export const setGameMode = (player: Player, gameMode: Player["gameMode"]): Effect.Effect<Player, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: ゲームモード検証
    if (!isValidGameMode(gameMode)) {
      return yield* Effect.fail(createValidationError(`Invalid game mode: ${gameMode}`))
    }

    const newAbilities = createAbilitiesForGameMode(gameMode)

    return {
      ...player,
      gameMode,
      abilities: {
        ...newAbilities,
        isFlying: gameMode === "spectator" ? true : player.abilities.isFlying,
        walkSpeed: player.abilities.walkSpeed,
        flySpeed: player.abilities.flySpeed
      }
    }
  })

export const addExperience = (player: Player, amount: number): Effect.Effect<Player, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: 経験値量検証
    if (amount < 0) {
      return yield* Effect.fail(createValidationError("Experience amount must be non-negative"))
    }

    const newExperience = calculateNewExperience(player.stats.experience, amount)
    const newLevel = calculateLevel(newExperience)

    return {
      ...player,
      stats: {
        ...player.stats,
        experience: newExperience,
        level: newLevel
      }
    }
  })

// 純粋関数群（PBTテスト対応）
const isValidGameMode = (gameMode: string): gameMode is Player["gameMode"] =>
  ["survival", "creative", "adventure", "spectator"].includes(gameMode)

const calculateNewExperience = (current: number, amount: number): Player["stats"]["experience"] =>
  (current + amount) as Player["stats"]["experience"]

const calculateLevel = (experience: number): Player["stats"]["level"] =>
  Math.floor(Math.sqrt(experience / 100)) as Player["stats"]["level"]
```

**機能:**
- プレイヤーの不変状態管理
- インベントリ管理（アイテム保持）
- ゲームモード（Creative, Survival, Adventure）
- 体力・経験値システム

#### Chunk Entity
```typescript
// src/domain/entities/chunk.entity.ts
import { Schema, Effect, Match } from "effect"
import type { ValidationError } from "../errors/unified-errors"

// ChunkDataスキーマ定義
export const ChunkData = Schema.Struct({
  coordinate: Schema.Struct({
    x: Schema.Number.pipe(Schema.int(), Schema.brand("ChunkX")),
    z: Schema.Number.pipe(Schema.int(), Schema.brand("ChunkZ"))
  }),
  // パフォーマンスのためフラット配列で格納
  blocks: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.between(0, 65535))).pipe(
    Schema.itemsCount(16 * 256 * 16) // 16x256x16 blocks
  ),
  biome: Schema.Literal("plains", "forest", "desert", "ocean", "mountains", "jungle", "tundra"),
  heightMap: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.between(0, 255))).pipe(
    Schema.itemsCount(16 * 16) // 16x16 height values
  ),
  lightMap: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.between(0, 15))).pipe(
    Schema.itemsCount(16 * 256 * 16) // 16x256x16 light values
  ),
  entities: Schema.Array(Schema.UUID.pipe(Schema.brand("EntityId"))),
  tileEntities: Schema.Array(
    Schema.Struct({
      id: Schema.UUID.pipe(Schema.brand("TileEntityId")),
      type: Schema.String,
      position: Schema.Struct({
        x: Schema.Number.pipe(Schema.int(), Schema.between(0, 15)),
        y: Schema.Number.pipe(Schema.int(), Schema.between(0, 255)),
        z: Schema.Number.pipe(Schema.int(), Schema.between(0, 15))
      }),
      data: Schema.Record({ key: Schema.String, value: Schema.Unknown })
    })
  ),
  isGenerated: Schema.Boolean,
  isLoaded: Schema.Boolean,
  isDirty: Schema.Boolean,
  lastModified: Schema.DateTimeUtc,
  generationStep: Schema.Literal("empty", "terrain", "biome", "features", "lighting", "complete")
})

export type ChunkData = Schema.Schema.Type<typeof ChunkData>

// Chunk作成関数（早期リターン・単一責務パターン）
export const createChunk = (coordinate: ChunkData["coordinate"]): Effect.Effect<ChunkData, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: 座標検証
    if (!isValidChunkCoordinate(coordinate)) {
      return yield* Effect.fail(createValidationError("Invalid chunk coordinate"))
    }

    const chunk: ChunkData = {
      coordinate,
      blocks: createEmptyBlocks(),
      biome: "plains",
      heightMap: createSeaLevelHeightMap(),
      lightMap: createFullLightMap(),
      entities: [],
      tileEntities: [],
      isGenerated: false,
      isLoaded: false,
      isDirty: false,
      lastModified: new Date(),
      generationStep: "empty"
    }

    return chunk
  })

// 単一責務の補助関数群（PBTテスト対応）
const isValidChunkCoordinate = (coord: ChunkData["coordinate"]): boolean =>
  Number.isInteger(coord.x) && Number.isInteger(coord.z) &&
  coord.x >= -30000000 && coord.x <= 30000000 &&
  coord.z >= -30000000 && coord.z <= 30000000

const createEmptyBlocks = (): ChunkData["blocks"] =>
  Array(16 * 256 * 16).fill(0)

const createSeaLevelHeightMap = (): ChunkData["heightMap"] =>
  Array(16 * 16).fill(64)

const createFullLightMap = (): ChunkData["lightMap"] =>
  Array(16 * 256 * 16).fill(15)

// Block操作関数
export const getBlockIndex = (x: number, y: number, z: number): number => {
  return y * 16 * 16 + z * 16 + x
}

export const getBlock = (chunk: ChunkData, x: number, y: number, z: number): number => {
  const index = getBlockIndex(x, y, z)
  return chunk.blocks[index] ?? 0
}

export const setBlock = (chunk: ChunkData, x: number, y: number, z: number, blockId: number): ChunkData => {
  const index = getBlockIndex(x, y, z)
  const newBlocks = [...chunk.blocks]
  newBlocks[index] = blockId

  return {
    ...chunk,
    blocks: newBlocks,
    isDirty: true,
    lastModified: new Date()
  }
}

// Light操作関数
export const getLightLevel = (chunk: ChunkData, x: number, y: number, z: number): number => {
  const index = getBlockIndex(x, y, z)
  return chunk.lightMap[index] ?? 0
}

export const setLightLevel = (chunk: ChunkData, x: number, y: number, z: number, lightLevel: number): ChunkData => {
  const index = getBlockIndex(x, y, z)
  const newLightMap = [...chunk.lightMap]
  newLightMap[index] = Math.max(0, Math.min(15, lightLevel))

  return {
    ...chunk,
    lightMap: newLightMap,
    isDirty: true,
    lastModified: new Date()
  }
}

// エンティティ操作関数
export const addEntity = (chunk: ChunkData, entityId: ChunkData["entities"][number]): ChunkData => ({
  ...chunk,
  entities: [...chunk.entities, entityId],
  isDirty: true,
  lastModified: new Date()
})

export const removeEntity = (chunk: ChunkData, entityId: ChunkData["entities"][number]): ChunkData => ({
  ...chunk,
  entities: chunk.entities.filter(id => id !== entityId),
  isDirty: true,
  lastModified: new Date()
})

// Generation関数
export const setGenerationStep = (chunk: ChunkData, step: ChunkData["generationStep"]): ChunkData => ({
  ...chunk,
  generationStep: step,
  isGenerated: step === "complete",
  isDirty: true,
  lastModified: new Date()
})
```

**機能:**
- チャンク（16x16x256ブロック）管理
- ブロックデータの不変格納
- エンティティ管理
- 生成・読み込み状態管理

#### Block Entity
```typescript
// src/domain/entities/block.entity.ts
import { Schema, Effect, Match } from "effect"
import type { ValidationError } from "../errors/unified-errors"

// Blockスキーマ定義
export const Block = Schema.Struct({
  id: Schema.String.pipe(
    Schema.pattern(/^[a-z]+:[a-z_]+$/),
    Schema.brand("BlockId")
  ),
  position: Schema.Struct({
    x: Schema.Number.pipe(Schema.int()),
    y: Schema.Number.pipe(Schema.int(), Schema.between(0, 255)),
    z: Schema.Number.pipe(Schema.int())
  }),
  state: Schema.Struct({
    facing: Schema.optional(
      Schema.Literal("north", "south", "east", "west", "up", "down")
    ),
    powered: Schema.optional(Schema.Boolean),
    waterlogged: Schema.optional(Schema.Boolean),
    lit: Schema.optional(Schema.Boolean),
    open: Schema.optional(Schema.Boolean),
    half: Schema.optional(Schema.Literal("top", "bottom")),
    axis: Schema.optional(Schema.Literal("x", "y", "z")),
    age: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 15))),
    stage: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 7)))
  }),
  properties: Schema.Struct({
    hardness: Schema.Number.pipe(Schema.nonNegative()),
    resistance: Schema.Number.pipe(Schema.nonNegative()),
    luminance: Schema.Number.pipe(Schema.int(), Schema.between(0, 15)),
    opacity: Schema.Number.pipe(Schema.int(), Schema.between(0, 15)),
    isSolid: Schema.Boolean,
    isTransparent: Schema.Boolean,
    isFlammable: Schema.Boolean,
    isReplaceable: Schema.Boolean,
    material: Schema.Literal(
      "air", "stone", "wood", "metal", "earth", "water", "lava",
      "glass", "ice", "plant", "wool", "sand", "snow"
    )
  }),
  lightLevel: Schema.Struct({
    sky: Schema.Number.pipe(Schema.int(), Schema.between(0, 15)),
    block: Schema.Number.pipe(Schema.int(), Schema.between(0, 15))
  }),
  nbt: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
})

export type Block = Schema.Schema.Type<typeof Block>

// Block作成関数（早期リターン・単一責務パターン）
export const createBlock = (
  id: string,
  position: Block["position"],
  state: Partial<Block["state"]> = {}
): Effect.Effect<Block, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: ID検証
    if (!isValidBlockId(id)) {
      return yield* Effect.fail(createValidationError("Invalid block ID format", "id"))
    }

    // 早期リターン: 位置検証
    if (!isValidBlockPosition(position)) {
      return yield* Effect.fail(createValidationError("Invalid block position", "position"))
    }

    const blockId = id as Block["id"]
    const block: Block = {
      id: blockId,
      position,
      state: {
        facing: state.facing,
        powered: state.powered,
        waterlogged: state.waterlogged,
        lit: state.lit,
        open: state.open,
        half: state.half,
        axis: state.axis,
        age: state.age,
        stage: state.stage
      },
      properties: getBlockProperties(blockId),
      lightLevel: {
        sky: 15,
        block: 0
      },
      nbt: undefined
    }

    return block
  })

// 単一責務の補助関数群（PBTテスト対応）
const isValidBlockId = (id: string): boolean =>
  /^[a-z]+:[a-z_]+$/.test(id)

const isValidBlockPosition = (position: Block["position"]): boolean =>
  Number.isInteger(position.x) &&
  Number.isInteger(position.y) &&
  Number.isInteger(position.z) &&
  position.y >= 0 && position.y <= 255

// ブロックプロパティ取得関数（Match.valueパターン）
export const getBlockProperties = (blockId: Block["id"]): Block["properties"] =>
  Match.value(blockId).pipe(
    Match.when("minecraft:air", () => createBlockProperties({
      hardness: 0,
      resistance: 0,
      luminance: 0,
      opacity: 0,
      isSolid: false,
      isTransparent: true,
      isFlammable: false,
      isReplaceable: true,
      material: "air"
    })),
    Match.when("minecraft:stone", () => createBlockProperties({
      hardness: 1.5,
      resistance: 6,
      luminance: 0,
      opacity: 15,
      isSolid: true,
      isTransparent: false,
      isFlammable: false,
      isReplaceable: false,
      material: "stone"
    })),
    Match.when("minecraft:water", () => createBlockProperties({
      hardness: 100,
      resistance: 100,
      luminance: 0,
      opacity: 3,
      isSolid: false,
      isTransparent: true,
      isFlammable: false,
      isReplaceable: true,
      material: "water"
    })),
    Match.when("minecraft:grass_block", () => createBlockProperties({
      hardness: 0.6,
      resistance: 0.6,
      luminance: 0,
      opacity: 15,
      isSolid: true,
      isTransparent: false,
      isFlammable: false,
      isReplaceable: false,
      material: "earth"
    })),
    Match.orElse(() => createDefaultBlockProperties())
  )

// 単一責務の補助関数群（PBTテスト対応）
const createBlockProperties = (props: Block["properties"]): Block["properties"] => props

const createDefaultBlockProperties = (): Block["properties"] => ({
  hardness: 1,
  resistance: 1,
  luminance: 0,
  opacity: 15,
  isSolid: true,
  isTransparent: false,
  isFlammable: false,
  isReplaceable: false,
  material: "stone"
})

// Block操作関数
export const setBlockState = (block: Block, newState: Partial<Block["state"]>): Block => ({
  ...block,
  state: {
    ...block.state,
    ...newState
  }
})

export const setLightLevels = (block: Block, sky: number, blockLight: number): Block => ({
  ...block,
  lightLevel: {
    sky: Math.max(0, Math.min(15, sky)),
    block: Math.max(0, Math.min(15, blockLight))
  }
})

export const isTransparent = (block: Block): boolean => block.properties.isTransparent

export const isSolid = (block: Block): boolean => block.properties.isSolid

export const canReplace = (block: Block): boolean => block.properties.isReplaceable

export const getLuminance = (block: Block): number => block.properties.luminance

export const getOpacity = (block: Block): number => block.properties.opacity
```

**機能:**
- 個別ブロックの不変管理
- ブロックタイプ分類
- メタデータ管理（向き、状態等）
- 照明レベル管理

### コンポーネントシステム

ECSアーキテクチャに基づくコンポーネント群：

```typescript
// src/domain/entities/components/
├── world/            # ワールド関連コンポーネント
│   ├── chunk.ts
│   ├── terrain-block.ts
│   └── component-utils.ts
├── physics/          # 物理演算コンポーネント
│   ├── physics-components.ts
│   ├── physics-utils.ts
│   └── physics-factories.ts
├── rendering/        # レンダリング関連
│   ├── rendering-components.ts
│   ├── rendering-utils.ts
│   └── rendering-factories.ts
└── gameplay/         # ゲームプレイ要素
    ├── gameplay-components.ts
    ├── gameplay-utils.ts
    └── gameplay-factories.ts
```

## 2. Value Objects（値オブジェクト）

不変オブジェクトとして定義される値型群。

### 座標系 Value Objects

#### Position（3D座標）
```typescript
// src/domain/value-objects/coordinates/position.value-object.ts
import { Schema, Effect } from "effect"
import type { ValidationError } from "../../errors/unified-errors"

export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

export type Position = Schema.Schema.Type<typeof Position>

// 純粋関数・PBTテスト対応
export const makePosition = (x: number, y: number, z: number): Effect.Effect<Position, ValidationError> =>
  Effect.gen(function* () {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return yield* Effect.fail(createValidationError("Position coordinates must be finite"))
    }

    return { x, y, z }
  })

export const isValidPosition = (position: Position): boolean =>
  Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z)
```

#### ChunkCoordinate（チャンク座標）
```typescript  
// src/domain/value-objects/coordinates/chunk-coordinate.value-object.ts
export interface ChunkCoordinate {
  readonly x: ChunkX
  readonly z: ChunkZ
}

export const ChunkCoordinateSchema = S.Struct({
  x: ChunkXSchema,
  z: ChunkZSchema
})
```

### 数学系 Value Objects

#### Vector3（3Dベクトル）
```typescript
// src/domain/value-objects/math/vector3.value-object.ts
export interface Vector3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

// 数学的操作
export const magnitude = (v: Vector3): number
export const normalize = (v: Vector3): Vector3
export const multiply = (v: Vector3, scalar: number): Vector3
```

#### Quaternion（四元数）
```typescript
// src/domain/value-objects/math/quaternion.value-object.ts
export interface Quaternion {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly w: number
}
```

### 物理演算 Value Objects

#### AABB（軸並行境界ボックス）
```typescript
// src/domain/value-objects/physics/aabb.value-object.ts
export interface AABB {
  readonly min: Vector3
  readonly max: Vector3
}
```

#### Velocity（速度）
```typescript
// src/domain/value-objects/physics/velocity.value-object.ts
export interface Velocity {
  readonly x: number
  readonly y: number
  readonly z: number
}
```

## 3. Domain Services（ドメインサービス）

複数のエンティティを扱う複雑なビジネスロジックを実装。

### ECSシステム

#### Component Service
```typescript
// src/domain/services/ecs/component.service.ts
- コンポーネント管理システム
- 型安全なコンポーネント操作
- パフォーマンス最適化
```

#### Query Builder Service
```typescript
// src/domain/services/ecs/query-builder.service.ts
- エンティティクエリ構築
- 高性能なクエリ実行
- 複雑な条件指定
```

#### Archetype Query Service  
```typescript
// src/domain/services/ecs/archetype-query.service.ts
- アーキタイプベースクエリ
- コンポーネント組み合わせ検索
- メモリ効率的な実装
```

### ワールド管理サービス

#### World Management Service
```typescript
// src/domain/services/world-management.domain-service.ts
import { Context, Effect, Layer } from "effect"
import type { WorldState } from "../entities/world.entity"
import type { ChunkData } from "../entities/chunk.entity"
import type { ValidationError } from "../errors/unified-errors"

// サービス インターフェース定義
interface WorldManagementServiceInterface {
  readonly createWorld: (config: WorldConfig) => Effect.Effect<WorldState, ValidationError>
  readonly loadChunk: (coordinate: ChunkCoordinate) => Effect.Effect<ChunkData, ValidationError>
  readonly unloadChunk: (coordinate: ChunkCoordinate) => Effect.Effect<void, ValidationError>
  readonly getWorldState: () => Effect.Effect<WorldState, ValidationError>
}

// Context.GenericTag パターン
export const WorldManagementService = Context.GenericTag<WorldManagementServiceInterface>(
  "@app/WorldManagementService"
)

// Live実装
export const makeWorldManagementServiceLive = Effect.gen(function* () {
  const chunkStorage = yield* ChunkStorage

  return WorldManagementService.of({
    createWorld: (config) => Effect.gen(function* () {
      const world = yield* createWorldState(config)
      return world
    }),

    loadChunk: (coordinate) => Effect.gen(function* () {
      const chunk = yield* createChunk(coordinate)
      yield* chunkStorage.store(coordinate, chunk)
      return chunk
    }),

    unloadChunk: (coordinate) => chunkStorage.remove(coordinate),

    getWorldState: () => Effect.succeed(currentWorldState)
  })
})

// Layer定義
export const WorldManagementServiceLive = Layer.effect(
  WorldManagementService,
  makeWorldManagementServiceLive
)
```

#### Chunk Loading Service
```typescript
// src/domain/services/chunk-loading.service.ts
- チャンク読み込み制御
- 遅延読み込み戦略
- メモリ管理
```

### 物理演算サービス

#### Physics Domain Service
```typescript
// src/domain/services/physics.domain-service.ts
- 物理シミュレーション
- 衝突検出・応答
- 重力・摩擦計算
```

#### Collision System Service
```typescript
// src/domain/services/collision-system.service.ts  
- 衝突判定システム
- AABB衝突検出
- 精密衝突応答
```

### 地形生成サービス

#### Terrain Generation Service
```typescript
// src/domain/services/terrain-generation.domain-service.ts
- 地形生成アルゴリズム
- ノイズベース生成
- バイオーム管理
```

#### Mesh Generation Service
```typescript
// src/domain/services/mesh-generation.domain-service.ts
- メッシュ生成ロジック
- 頂点・面データ作成
- 最適化アルゴリズム
```

## 4. Ports（ポート定義）

依存性逆転の原則に基づくインターフェース定義。

### インフラストラクチャポート

#### World Repository Port
```typescript
// src/domain/ports/world-repository.port.ts
export interface IWorldRepositoryPort {
  saveWorld(world: WorldState): Effect.Effect<void, WorldSaveError>
  loadWorld(id: string): Effect.Effect<WorldState, WorldLoadError>
  queryEntities<T>(query: Query): Effect.Effect<T[], QueryError>
}
```

#### Terrain Generator Port  
```typescript
// src/domain/ports/terrain-generator.port.ts
export interface ITerrainGeneratorPort {
  generateChunk(coord: ChunkCoordinate): Effect.Effect<ChunkData, TerrainGenError>
  generateNoise(settings: NoiseSettings): Effect.Effect<number[], NoiseError>
}
```

#### Mesh Generator Port
```typescript
// src/domain/ports/mesh-generator.port.ts
export interface IMeshGeneratorPort {
  generateMesh(chunk: ChunkData): Effect.Effect<MeshData, MeshGenError>
  optimizeMesh(mesh: MeshData): Effect.Effect<MeshData, OptimizationError>
}
```

### システムポート

#### Input Port
```typescript
// src/domain/ports/input.port.ts
export interface IInputPort {
  getKeyState(key: KeyCode): Effect.Effect<KeyState>
  getMousePosition(): Effect.Effect<Position>
  onKeyPress(callback: (key: KeyCode) => void): Effect.Effect<void>
}
```

#### Render Port
```typescript
// src/domain/ports/render.port.ts
export interface IRenderPort {
  renderChunk(mesh: MeshData): Effect.Effect<void, RenderError>
  updateCamera(camera: CameraState): Effect.Effect<void>
  setViewport(config: ViewportConfig): Effect.Effect<void>
}
```

## 5. エラー定義

ドメイン固有のエラー型定義。

### 統一エラーシステム（Schema定義）

```typescript
// src/domain/errors/unified-errors.ts
import { Schema } from "effect"

// ベースエラースキーマ
export const DomainError = Schema.Struct({
  _tag: Schema.Literal("DomainError"),
  message: Schema.String,
  code: Schema.optional(Schema.String),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
})

// 各種エラー型の定義
export const ValidationError = Schema.Struct({
  _tag: Schema.Literal("ValidationError"),
  message: Schema.String,
  field: Schema.optional(Schema.String),
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
})

export const BusinessRuleViolation = Schema.Struct({
  _tag: Schema.Literal("BusinessRuleViolation"),
  message: Schema.String,
  rule: Schema.String,
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
})

export const ResourceNotFound = Schema.Struct({
  _tag: Schema.Literal("ResourceNotFound"),
  message: Schema.String,
  resourceType: Schema.String,
  resourceId: Schema.String,
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
})

// 型エクスポート
export type DomainError = Schema.Schema.Type<typeof DomainError>
export type ValidationError = Schema.Schema.Type<typeof ValidationError>
export type BusinessRuleViolation = Schema.Schema.Type<typeof BusinessRuleViolation>
export type ResourceNotFound = Schema.Schema.Type<typeof ResourceNotFound>

// エラー作成関数群（純粋関数・PBTテスト対応）
export const createValidationError = (message: string, field?: string): ValidationError => ({
  _tag: "ValidationError",
  message,
  field,
  timestamp: Date.now()
})

export const createBusinessRuleViolation = (message: string, rule: string): BusinessRuleViolation => ({
  _tag: "BusinessRuleViolation",
  message,
  rule,
  timestamp: Date.now()
})

export const createResourceNotFound = (message: string, resourceType: string, resourceId: string): ResourceNotFound => ({
  _tag: "ResourceNotFound",
  message,
  resourceType,
  resourceId,
  timestamp: Date.now()
})
```

### ドメイン固有エラー
```typescript
// src/domain/errors/domain-specific-errors.ts
import { Schema } from "effect"

export const PositionValidationError = Schema.Struct({
  _tag: Schema.Literal("PositionValidationError"),
  message: Schema.String,
  position: Schema.optional(Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  })),
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
})

export const ChunkValidationError = Schema.Struct({
  _tag: Schema.Literal("ChunkValidationError"),
  message: Schema.String,
  chunkCoordinate: Schema.optional(Schema.Struct({
    x: Schema.Number,
    z: Schema.Number
  })),
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
})

export const BlockValidationError = Schema.Struct({
  _tag: Schema.Literal("BlockValidationError"),
  message: Schema.String,
  blockId: Schema.optional(Schema.String),
  position: Schema.optional(Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  })),
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
})

export type PositionValidationError = Schema.Schema.Type<typeof PositionValidationError>
export type ChunkValidationError = Schema.Schema.Type<typeof ChunkValidationError>
export type BlockValidationError = Schema.Schema.Type<typeof BlockValidationError>
```

## 6. 定数定義

ドメイン固有の定数群。

### ワールド定数
```typescript
// src/domain/constants/world-constants.ts
export const CHUNK_SIZE = 16
export const CHUNK_HEIGHT = 256
export const WORLD_BOTTOM = 0
export const WORLD_TOP = 256
export const MAX_BUILD_HEIGHT = 320
```

### ブロック定数  
```typescript
// src/domain/constants/block-types.ts
// Tagged Union型でブロック種別を定義
export const BlockType = {
  AIR: 0 as const,
  STONE: 1 as const,
  DIRT: 2 as const,
  GRASS: 3 as const,
  WATER: 8 as const,
  LAVA: 10 as const
} as const

export type BlockType = typeof BlockType[keyof typeof BlockType]

// 純粋関数によるブロック分類（PBTテスト対応）
export const isTransparentBlock = (blockType: BlockType): boolean =>
  blockType === BlockType.AIR || blockType === BlockType.WATER

export const isSolidBlock = (blockType: BlockType): boolean =>
  blockType === BlockType.STONE || blockType === BlockType.DIRT || blockType === BlockType.GRASS

export const isLiquidBlock = (blockType: BlockType): boolean =>
  blockType === BlockType.WATER || blockType === BlockType.LAVA

export const getBlockHardness = (blockType: BlockType): number =>
  Match.value(blockType).pipe(
    Match.when(BlockType.AIR, () => 0),
    Match.when(BlockType.STONE, () => 1.5),
    Match.when(BlockType.DIRT, () => 0.5),
    Match.when(BlockType.GRASS, () => 0.6),
    Match.when(BlockType.WATER, () => 100),
    Match.when(BlockType.LAVA, () => 100),
    Match.exhaustive
  )
```

## 7. 特徴的な実装パターン（2024年版）

### Effect-TS 最新パターンの活用
- **Effect.gen**: ジェネレーター構文による直感的な非同期処理
- **早期リターン**: バリデーション失敗時の即座な処理終了
- **型安全なエラーハンドリング**: Schema定義によるエラー型の統一
- **Match.value**: 関数型パターンマッチングによる条件分岐

### Schema-based Validation（最新版）
- **Schema.Struct**: `Data.struct`から`Schema.Struct`への移行完了
- **Schema.Map**: 新しいMapスキーマ構文による型安全なコレクション
- **ランタイム型検証**: `Schema.decodeUnknownEither`による安全なパース処理
- **Branded Types**: `Schema.brand`による型レベル安全性の強化
- **早期リターン**: Effect.gen内でのバリデーション失敗時即座終了

### 単一責務・純粋関数の徹底
- **PBTテスト対応**: Property-Based Testing可能な粒度での関数分割
- **純粋関数**: 副作用のない計算ロジックの分離
- **関数型コンビネーター**: 高階関数とコンビネーターの活用
- **Context.GenericTag**: クラスレスなサービス定義

### 現代的アーキテクチャパターン
- **interface + functions**: classを使わない関数型設計
- **Tagged Union Types**: discriminated unionによる型安全な状態表現
- **Effect包装**: すべての操作をEffect型で管理
- **Layer Pattern**: 依存性注入と設定管理の分離

### 変更されたパターンサマリー
1. **`Data.struct` → `Schema.Struct`**: すべてのデータ構造定義を移行完了
2. **`Data.TaggedError` → Schema定義エラー`**: 統一的なエラー型管理
3. **`class` → `interface + functions`**: クラスレス設計への完全移行
4. **`if/else/switch` → `Match.value`**: 関数型パターンマッチングの徹底
5. **即座return → `Effect.gen`内早期リターン**: パフォーマンス重視のバリデーション
6. **単一関数 → 小さな純粋関数群**: PBTテスト対応の粒度で関数分割
7. **`Context.GenericTag`**: 最新のサービス定義パターン採用
8. **`Schema.Record`**: オブジェクト型定義の標準化

Domain層は外部技術に依存しない純粋なビジネスロジックを提供し、Effect-TSの最新パターンを活用してテスタブルで保守性の高いコードを実現します。