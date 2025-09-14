---
title: "Data Modeling Patterns"
category: "Pattern Catalog"
complexity: "intermediate"
dependencies:
  - "@effect/schema"
  - "effect"
ai_tags:
  - "schema-design"
  - "data-validation"
  - "type-safety"
  - "branded-types"
  - "data-module"
implementation_time: "1-2 hours"
skill_level: "intermediate"
last_pattern_update: "2025-09-14"
---

# Data Modeling Patterns

Effect-TSのSchemaとDataモジュールを使用した最新データモデリングパターン集

## Pattern 1: Branded Types with Schema Definition

**使用場面**: ドメイン固有の型安全性を提供する基本データ構造

**実装**:
```typescript
import { Schema, Data, Brand } from "effect"

// ブランド型定義
export const CoordinateX = Schema.Number.pipe(
  Schema.brand("CoordinateX"),
  Schema.filter((x) => x >= -30000000 && x <= 30000000, {
    message: () => "X coordinate out of bounds"
  })
)
export type CoordinateX = typeof CoordinateX.Type

export const CoordinateY = Schema.Number.pipe(
  Schema.brand("CoordinateY"),
  Schema.filter((y) => y >= 0 && y <= 256, {
    message: () => "Y coordinate out of bounds"
  })
)
export type CoordinateY = typeof CoordinateY.Type

export const CoordinateZ = Schema.Number.pipe(
  Schema.brand("CoordinateZ"),
  Schema.filter((z) => z >= -30000000 && z <= 30000000, {
    message: () => "Z coordinate out of bounds"
  })
)
export type CoordinateZ = typeof CoordinateZ.Type

// Data.Classを使用した不変データ構造
export class BlockPosition extends Data.Class<{
  readonly x: CoordinateX
  readonly y: CoordinateY
  readonly z: CoordinateZ
}> {}

export const BlockPositionSchema = Schema.Struct({
  x: CoordinateX,
  y: CoordinateY,
  z: CoordinateZ
}).pipe(
  Schema.transform(
    Schema.instanceOf(BlockPosition),
    {
      decode: ({ x, y, z }) => new BlockPosition({ x, y, z }),
      encode: (position) => ({ x: position.x, y: position.y, z: position.z })
    }
  )
)

export type BlockPositionFromSchema = typeof BlockPositionSchema.Type

// ファクトリ関数
export const createBlockPosition = (
  x: number,
  y: number,
  z: number
) =>
  Effect.gen(function* () {
    const validX = yield* Schema.decodeUnknown(CoordinateX)(x)
    const validY = yield* Schema.decodeUnknown(CoordinateY)(y)
    const validZ = yield* Schema.decodeUnknown(CoordinateZ)(z)
    return new BlockPosition({ x: validX, y: validY, z: validZ })
  })
```

**ポイント**:
- ブランド型による型安全性の向上
- Data.Classによる不変データ構造
- バリデーション付きファクトリ関数
- 早期リターンパターンの適用

## Pattern 2: Immutable Nested Structures with Data.Class

**使用場面**: 複雑な階層データ構造の不変オブジェクト化

**実装**:
```typescript
import { Schema, Data, Effect, Option } from "effect"

// ブランド型定義
export const BlockId = Schema.String.pipe(Schema.brand("BlockId"))
export type BlockId = typeof BlockId.Type

export const Hardness = Schema.Number.pipe(
  Schema.brand("Hardness"),
  Schema.filter((h) => h >= 0 && h <= 100, {
    message: () => "Hardness must be between 0 and 100"
  })
)
export type Hardness = typeof Hardness.Type

export const Luminance = Schema.Number.pipe(
  Schema.brand("Luminance"),
  Schema.filter((l) => l >= 0 && l <= 15, {
    message: () => "Luminance must be between 0 and 15"
  })
)
export type Luminance = typeof Luminance.Type

// メタデータ用Data.Class
export class BlockMetadata extends Data.Class<{
  readonly hardness: Hardness
  readonly luminance: Luminance
  readonly transparency: boolean
}> {}

export const BlockMetadataSchema = Schema.Struct({
  hardness: Hardness,
  luminance: Luminance,
  transparency: Schema.Boolean
}).pipe(
  Schema.transform(
    Schema.instanceOf(BlockMetadata),
    {
      decode: ({ hardness, luminance, transparency }) =>
        new BlockMetadata({ hardness, luminance, transparency }),
      encode: (metadata) => ({
        hardness: metadata.hardness,
        luminance: metadata.luminance,
        transparency: metadata.transparency
      })
    }
  )
)

// マテリアル定義（判別可能ユニオン）
export const MaterialType = Schema.Literal("stone", "dirt", "grass", "water", "air")
export type MaterialType = typeof MaterialType.Type

// ブロック用Data.Class
export class Block extends Data.Class<{
  readonly id: BlockId
  readonly position: BlockPosition
  readonly material: MaterialType
  readonly metadata: BlockMetadata
}> {
  // ドメインロジックメソッド
  isSolid(): boolean {
    return this.material !== "air" && this.material !== "water"
  }

  canPass(): boolean {
    return !this.isSolid() || this.metadata.transparency
  }
}

export const BlockSchema = Schema.Struct({
  id: BlockId,
  position: BlockPositionSchema,
  material: MaterialType,
  metadata: BlockMetadataSchema
}).pipe(
  Schema.transform(
    Schema.instanceOf(Block),
    {
      decode: ({ id, position, material, metadata }) =>
        new Block({ id, position, material, metadata }),
      encode: (block) => ({
        id: block.id,
        position: block.position,
        material: block.material,
        metadata: block.metadata
      })
    }
  )
)

// ファクトリ関数
export const createBlock = (input: {
  id: string
  position: { x: number; y: number; z: number }
  material: string
  metadata: { hardness: number; luminance: number; transparency: boolean }
}) =>
  Effect.gen(function* () {
    const blockId = yield* Schema.decodeUnknown(BlockId)(input.id)
    const position = yield* createBlockPosition(
      input.position.x,
      input.position.y,
      input.position.z
    )
    const material = yield* Schema.decodeUnknown(MaterialType)(input.material)
    const metadata = yield* Schema.decodeUnknown(BlockMetadataSchema)(input.metadata)

    return new Block({ id: blockId, position, material, metadata })
  })
```

## Pattern 3: Data.TaggedEnum for Discriminated Unions

**使用場面**: 型安全で完全な判別可能ユニオン型

**実装**:
```typescript
import { Schema, Data, Effect, Match, Option } from "effect"

// エンティティID用ブランド型
export const PlayerId = Schema.String.pipe(Schema.brand("PlayerId"))
export type PlayerId = typeof PlayerId.Type

export const MobId = Schema.String.pipe(Schema.brand("MobId"))
export type MobId = typeof MobId.Type

export const ItemEntityId = Schema.String.pipe(Schema.brand("ItemEntityId"))
export type ItemEntityId = typeof ItemEntityId.Type

// Health用ブランド型（1-100の範囲制限）
export const Health = Schema.Number.pipe(
  Schema.brand("Health"),
  Schema.filter((h) => h >= 0 && h <= 100, {
    message: () => "Health must be between 0 and 100"
  })
)
export type Health = typeof Health.Type

export const Quantity = Schema.Number.pipe(
  Schema.brand("Quantity"),
  Schema.filter((q) => q > 0, {
    message: () => "Quantity must be positive"
  })
)
export type Quantity = typeof Quantity.Type

// Data.TaggedEnumを使用した判別可能ユニオン
export type Entity = Data.TaggedEnum<{
  Player: {
    readonly id: PlayerId
    readonly position: BlockPosition
    readonly health: Health
    readonly inventory: readonly string[]
  }
  Mob: {
    readonly id: MobId
    readonly position: BlockPosition
    readonly mobType: "zombie" | "skeleton" | "creeper"
    readonly health: Health
  }
  ItemEntity: {
    readonly id: ItemEntityId
    readonly position: BlockPosition
    readonly itemType: string
    readonly quantity: Quantity
  }
}>

// Data.TaggedEnumのコンストラクタ
export const Entity = Data.taggedEnum<Entity>()

// スキーマ定義
export const PlayerSchema = Schema.Struct({
  _tag: Schema.Literal("Player"),
  id: PlayerId,
  position: BlockPositionSchema,
  health: Health,
  inventory: Schema.Array(Schema.String)
})

export const MobSchema = Schema.Struct({
  _tag: Schema.Literal("Mob"),
  id: MobId,
  position: BlockPositionSchema,
  mobType: Schema.Literal("zombie", "skeleton", "creeper"),
  health: Health
})

export const ItemEntitySchema = Schema.Struct({
  _tag: Schema.Literal("ItemEntity"),
  id: ItemEntityId,
  position: BlockPositionSchema,
  itemType: Schema.String,
  quantity: Quantity
})

export const EntitySchema = Schema.Union(PlayerSchema, MobSchema, ItemEntitySchema)

// ファクトリ関数
export const createPlayer = (input: {
  id: string
  position: { x: number; y: number; z: number }
  health: number
  inventory: readonly string[]
}) =>
  Effect.gen(function* () {
    const playerId = yield* Schema.decodeUnknown(PlayerId)(input.id)
    const position = yield* createBlockPosition(
      input.position.x,
      input.position.y,
      input.position.z
    )
    const health = yield* Schema.decodeUnknown(Health)(input.health)

    return Entity.Player({
      id: playerId,
      position,
      health,
      inventory: input.inventory
    })
  })

export const createMob = (input: {
  id: string
  position: { x: number; y: number; z: number }
  mobType: "zombie" | "skeleton" | "creeper"
  health: number
}) =>
  Effect.gen(function* () {
    const mobId = yield* Schema.decodeUnknown(MobId)(input.id)
    const position = yield* createBlockPosition(
      input.position.x,
      input.position.y,
      input.position.z
    )
    const health = yield* Schema.decodeUnknown(Health)(input.health)

    return Entity.Mob({
      id: mobId,
      position,
      mobType: input.mobType,
      health
    })
  })

// パターンマッチング（完全網羅）
export const processEntity = (entity: Entity) =>
  Match.value(entity).pipe(
    Match.tag("Player", (player) =>
      Effect.log(`Processing player: ${player.id} at (${player.position.x}, ${player.position.y}, ${player.position.z})`)
    ),
    Match.tag("Mob", (mob) =>
      Effect.log(`Processing ${mob.mobType}: ${mob.id} with ${mob.health} health`)
    ),
    Match.tag("ItemEntity", (item) =>
      Effect.log(`Processing item: ${item.itemType} x${item.quantity}`)
    ),
    Match.exhaustive
  )

// タイプガード関数
export const isPlayer = (entity: Entity): entity is Extract<Entity, { _tag: "Player" }> =>
  entity._tag === "Player"

export const isMob = (entity: Entity): entity is Extract<Entity, { _tag: "Mob" }> =>
  entity._tag === "Mob"

// ドメインロジック例
export const canAttack = (entity: Entity): boolean =>
  Match.value(entity).pipe(
    Match.tag("Player", () => true),
    Match.tag("Mob", () => true),
    Match.tag("ItemEntity", () => false),
    Match.exhaustive
  )

export const getEntityHealth = (entity: Entity): Option.Option<Health> =>
  Match.value(entity).pipe(
    Match.tag("Player", (player) => Option.some(player.health)),
    Match.tag("Mob", (mob) => Option.some(mob.health)),
    Match.tag("ItemEntity", () => Option.none()),
    Match.exhaustive
  )
```

## Pattern 4: Option Types and Default Values with Branded Types

**使用場面**: オプショナルフィールドとデフォルト値を含む複雑なデータ構造

**実装**:
```typescript
import { Schema, Data, Effect, Option } from "effect"

// チャンク座標用ブランド型
export const ChunkX = Schema.Number.pipe(
  Schema.brand("ChunkX"),
  Schema.filter((x) => Number.isInteger(x), {
    message: () => "Chunk X must be an integer"
  })
)
export type ChunkX = typeof ChunkX.Type

export const ChunkZ = Schema.Number.pipe(
  Schema.brand("ChunkZ"),
  Schema.filter((z) => Number.isInteger(z), {
    message: () => "Chunk Z must be an integer"
  })
)
export type ChunkZ = typeof ChunkZ.Type

export const ChunkId = Schema.String.pipe(Schema.brand("ChunkId"))
export type ChunkId = typeof ChunkId.Type

// チャンク座標クラス
export class ChunkCoordinate extends Data.Class<{
  readonly x: ChunkX
  readonly z: ChunkZ
}> {
  // チャンクIDを生成するメソッド
  toChunkId(): ChunkId {
    return `chunk_${this.x}_${this.z}` as ChunkId
  }

  // 隣接チャンクの座標を取得
  getAdjacent(): readonly ChunkCoordinate[] {
    const adjacent = [
      new ChunkCoordinate({ x: (this.x + 1) as ChunkX, z: this.z }),
      new ChunkCoordinate({ x: (this.x - 1) as ChunkX, z: this.z }),
      new ChunkCoordinate({ x: this.x, z: (this.z + 1) as ChunkZ }),
      new ChunkCoordinate({ x: this.x, z: (this.z - 1) as ChunkZ })
    ]
    return adjacent
  }
}

export const ChunkCoordinateSchema = Schema.Struct({
  x: ChunkX,
  z: ChunkZ
}).pipe(
  Schema.transform(
    Schema.instanceOf(ChunkCoordinate),
    {
      decode: ({ x, z }) => new ChunkCoordinate({ x, z }),
      encode: (coord) => ({ x: coord.x, z: coord.z })
    }
  )
)

// チャンクデータクラス（Option型とデフォルト値を使用）
export class ChunkData extends Data.Class<{
  readonly id: ChunkId
  readonly coordinate: ChunkCoordinate
  readonly blocks: readonly Block[]
  readonly entities: Option.Option<readonly Entity[]>
  readonly lastModified: Option.Option<Date>
  readonly compressed: boolean
  readonly version: number
}> {
  // エンティティ取得（デフォルト値付き）
  getEntities(): readonly Entity[] {
    return Option.getOrElse(this.entities, () => [])
  }

  // 最終更新日時取得（現在時刻をデフォルト）
  getLastModified(): Date {
    return Option.getOrElse(this.lastModified, () => new Date())
  }

  // ブロック数取得
  getBlockCount(): number {
    return this.blocks.length
  }

  // エンティティ追加
  addEntity(entity: Entity): ChunkData {
    const currentEntities = this.getEntities()
    return new ChunkData({
      ...this,
      entities: Option.some([...currentEntities, entity])
    })
  }
}

export const ChunkDataSchema = Schema.Struct({
  id: ChunkId,
  coordinate: ChunkCoordinateSchema,
  blocks: Schema.Array(BlockSchema),
  entities: Schema.optional(Schema.Array(EntitySchema)),
  lastModified: Schema.optional(Schema.DateFromSelf),
  compressed: Schema.optional(Schema.Boolean, () => false),
  version: Schema.optional(Schema.Number, () => 1)
}).pipe(
  Schema.transform(
    Schema.instanceOf(ChunkData),
    {
      decode: ({ id, coordinate, blocks, entities, lastModified, compressed, version }) =>
        new ChunkData({
          id,
          coordinate,
          blocks,
          entities: entities ? Option.some(entities) : Option.none(),
          lastModified: lastModified ? Option.some(lastModified) : Option.none(),
          compressed: compressed ?? false,
          version: version ?? 1
        }),
      encode: (chunk) => ({
        id: chunk.id,
        coordinate: chunk.coordinate,
        blocks: chunk.blocks,
        entities: Option.isSome(chunk.entities) ? chunk.entities.value : undefined,
        lastModified: Option.isSome(chunk.lastModified) ? chunk.lastModified.value : undefined,
        compressed: chunk.compressed,
        version: chunk.version
      })
    }
  )
)

// ファクトリ関数
export const createChunkData = (input: {
  coordinate: { x: number; z: number }
  blocks?: readonly Block[]
  entities?: readonly Entity[]
  compressed?: boolean
}) =>
  Effect.gen(function* () {
    const chunkX = yield* Schema.decodeUnknown(ChunkX)(input.coordinate.x)
    const chunkZ = yield* Schema.decodeUnknown(ChunkZ)(input.coordinate.z)
    const coordinate = new ChunkCoordinate({ x: chunkX, z: chunkZ })
    const id = coordinate.toChunkId()

    return new ChunkData({
      id,
      coordinate,
      blocks: input.blocks ?? [],
      entities: input.entities ? Option.some(input.entities) : Option.none(),
      lastModified: Option.some(new Date()),
      compressed: input.compressed ?? false,
      version: 1
    })
  })

// Option型を使った安全なアクセス関数
export const findEntityById = (chunk: ChunkData, entityId: string): Option.Option<Entity> =>
  pipe(
    chunk.entities,
    Option.flatMap((entities) =>
      Option.fromNullable(
        entities.find((entity) =>
          Match.value(entity).pipe(
            Match.tag("Player", (p) => p.id === entityId),
            Match.tag("Mob", (m) => m.id === entityId),
            Match.tag("ItemEntity", (i) => i.id === entityId),
            Match.exhaustive
          )
        )
      )
    )
  )

// デフォルト値を使った変換関数
export const chunkToSummary = (chunk: ChunkData) => ({
  id: chunk.id,
  coordinate: `(${chunk.coordinate.x}, ${chunk.coordinate.z})`,
  blockCount: chunk.getBlockCount(),
  entityCount: chunk.getEntities().length,
  lastModified: chunk.getLastModified().toISOString(),
  compressed: chunk.compressed,
  version: chunk.version
})
```

## Pattern 5: Schema Transformation with Either and Validation Pipelines

**使用場面**: 複雑な変換とバリデーションパイプライン

**実装**:
```typescript
import { Schema, Data, Effect, Either, pipe, ParseResult } from "effect"

// 文字列座標の変換とバリデーション
export const CoordinateString = Schema.String.pipe(
  Schema.brand("CoordinateString"),
  Schema.filter((str) => /^-?\d+,-?\d+,-?\d+$/.test(str), {
    message: () => "Coordinate string must be in format 'x,y,z'"
  })
)
export type CoordinateString = typeof CoordinateString.Type

// 変換用のスキーマ（Either型を使用）
export const CoordinateFromString = Schema.transformOrFail(
  CoordinateString,
  BlockPositionSchema,
  {
    decode: (coordStr) =>
      pipe(
        Effect.try(() => {
          const parts = coordStr.split(",")
          if (parts.length !== 3) {
            throw new Error("Invalid coordinate format")
          }

          const [x, y, z] = parts.map(Number)
          if (parts.some(isNaN)) {
            throw new Error("Coordinate parts must be numbers")
          }

          return { x, y, z }
        }),
        Effect.flatMap((coords) => createBlockPosition(coords.x, coords.y, coords.z)),
        Effect.mapError((error) =>
          new ParseResult.Type(
            Schema.String.ast,
            coordStr,
            error instanceof Error ? error.message : "Unknown parsing error"
          )
        )
      ),
    encode: (position) =>
      Effect.succeed(`${position.x},${position.y},${position.z}` as CoordinateString)
  }
)

// バリデーション用のカスタムエラー
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string
  readonly value: unknown
  readonly constraint: string
}> {}

// 複合バリデーション
export const WorldBounds = {
  minX: -30000000,
  maxX: 30000000,
  minY: 0,
  maxY: 256,
  minZ: -30000000,
  maxZ: 30000000
} as const

export const validateWorldBounds = (position: BlockPosition): Either.Either<BlockPosition, ValidationError> => {
  if (position.x < WorldBounds.minX || position.x > WorldBounds.maxX) {
    return Either.left(new ValidationError({
      field: "x",
      value: position.x,
      constraint: `Must be between ${WorldBounds.minX} and ${WorldBounds.maxX}`
    }))
  }

  if (position.y < WorldBounds.minY || position.y > WorldBounds.maxY) {
    return Either.left(new ValidationError({
      field: "y",
      value: position.y,
      constraint: `Must be between ${WorldBounds.minY} and ${WorldBounds.maxY}`
    }))
  }

  if (position.z < WorldBounds.minZ || position.z > WorldBounds.maxZ) {
    return Either.left(new ValidationError({
      field: "z",
      value: position.z,
      constraint: `Must be between ${WorldBounds.minZ} and ${WorldBounds.maxZ}`
    }))
  }

  return Either.right(position)
}

// バリデーションパイプライン
export const parseAndValidateCoordinate = (input: string) =>
  Effect.gen(function* () {
    // 文字列形式の検証
    const coordStr = yield* Schema.decodeUnknown(CoordinateString)(input)

    // 座標オブジェクトへの変換
    const position = yield* Schema.decodeUnknown(CoordinateFromString)(coordStr)

    // ワールド境界の検証
    const validatedPosition = yield* Either.match(
      validateWorldBounds(position),
      {
        onLeft: (error) => Effect.fail(error),
        onRight: (pos) => Effect.succeed(pos)
      }
    )

    return validatedPosition
  })

// バッチ変換と検証
export const parseCoordinateList = (inputs: readonly string[]) =>
  Effect.gen(function* () {
    const results = yield* Effect.all(
      inputs.map((input) =>
        pipe(
          parseAndValidateCoordinate(input),
          Effect.either
        )
      ),
      { concurrency: 10 }
    )

    const successes: BlockPosition[] = []
    const failures: { input: string; error: unknown }[] = []

    results.forEach((result, index) => {
      if (Either.isRight(result)) {
        successes.push(result.right)
      } else {
        failures.push({ input: inputs[index], error: result.left })
      }
    })

    return { successes, failures }
  })

// カスタム変換スキーマ（JSON形式）
export const PositionFromJson = Schema.parseJson(
  Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  })
).pipe(
  Schema.transformOrFail(
    BlockPositionSchema,
    {
      decode: ({ x, y, z }) => createBlockPosition(x, y, z),
      encode: (position) =>
        Effect.succeed({
          x: position.x,
          y: position.y,
          z: position.z
        })
    }
  )
)

// 型安全な変換関数
export const transformToBlockPosition = <T>(
  input: T,
  transformer: (value: T) => Effect.Effect<BlockPosition, ValidationError>
): Effect.Effect<BlockPosition, ValidationError> =>
  Effect.gen(function* () {
    const position = yield* transformer(input)
    return yield* Either.match(
      validateWorldBounds(position),
      {
        onLeft: (error) => Effect.fail(error),
        onRight: (pos) => Effect.succeed(pos)
      }
    )
  })

// 使用例：複数形式からの変換
export const parseFromAnyFormat = (input: unknown) =>
  Effect.gen(function* () {
    // 文字列形式を試行
    const stringResult = yield* pipe(
      Effect.try(() => String(input)),
      Effect.flatMap((str) => parseAndValidateCoordinate(str)),
      Effect.either
    )

    if (Either.isRight(stringResult)) {
      return stringResult.right
    }

    // JSON形式を試行
    const jsonResult = yield* pipe(
      Effect.try(() => JSON.stringify(input)),
      Effect.flatMap((json) => Schema.decodeUnknown(PositionFromJson)(json)),
      Effect.either
    )

    if (Either.isRight(jsonResult)) {
      return jsonResult.right
    }

    // どちらも失敗した場合
    return yield* Effect.fail(new ValidationError({
      field: "input",
      value: input,
      constraint: "Must be a valid coordinate string or JSON object"
    }))
  })
```

## Pattern 6: Recursive Data Structures with Data.Class

**使用場面**: 再帰的な不変データ構造（ツリー、ディレクトリ構造など）

**実装**:
```typescript
import { Schema, Data, Effect, Option, Array as ReadonlyArray } from "effect"

// ファイルシステム階層構造用ブランド型
export const NodeName = Schema.String.pipe(
  Schema.brand("NodeName"),
  Schema.filter((name) => name.length > 0 && !/[<>:"/\\|?*]/.test(name), {
    message: () => "Invalid node name"
  })
)
export type NodeName = typeof NodeName.Type

export const NodeId = Schema.String.pipe(Schema.brand("NodeId"))
export type NodeId = typeof NodeId.Type

// ファイルサイズ用ブランド型
export const FileSize = Schema.Number.pipe(
  Schema.brand("FileSize"),
  Schema.filter((size) => size >= 0, {
    message: () => "File size must be non-negative"
  })
)
export type FileSize = typeof FileSize.Type

// ディレクトリエントリ用Data.TaggedEnum
export type FileSystemEntry = Data.TaggedEnum<{
  File: {
    readonly id: NodeId
    readonly name: NodeName
    readonly size: FileSize
    readonly lastModified: Date
  }
  Directory: {
    readonly id: NodeId
    readonly name: NodeName
    readonly children: readonly FileSystemEntry[]
    readonly lastModified: Date
  }
}>

export const FileSystemEntry = Data.taggedEnum<FileSystemEntry>()

// 再帰的スキーマ定義
export const FileSchema = Schema.Struct({
  _tag: Schema.Literal("File"),
  id: NodeId,
  name: NodeName,
  size: FileSize,
  lastModified: Schema.DateFromSelf
})

export const DirectorySchema: Schema.Schema<
  Extract<FileSystemEntry, { _tag: "Directory" }>,
  {
    _tag: "Directory"
    id: string
    name: string
    children: readonly unknown[]
    lastModified: Date
  }
> = Schema.Struct({
  _tag: Schema.Literal("Directory"),
  id: NodeId,
  name: NodeName,
  children: Schema.Array(Schema.suspend(() => FileSystemEntrySchema)),
  lastModified: Schema.DateFromSelf
})

export const FileSystemEntrySchema = Schema.Union(FileSchema, DirectorySchema)

// ファクトリ関数
export const createFile = (input: {
  id: string
  name: string
  size: number
  lastModified?: Date
}) =>
  Effect.gen(function* () {
    const nodeId = yield* Schema.decodeUnknown(NodeId)(input.id)
    const nodeName = yield* Schema.decodeUnknown(NodeName)(input.name)
    const fileSize = yield* Schema.decodeUnknown(FileSize)(input.size)

    return FileSystemEntry.File({
      id: nodeId,
      name: nodeName,
      size: fileSize,
      lastModified: input.lastModified ?? new Date()
    })
  })

export const createDirectory = (input: {
  id: string
  name: string
  children?: readonly FileSystemEntry[]
  lastModified?: Date
}) =>
  Effect.gen(function* () {
    const nodeId = yield* Schema.decodeUnknown(NodeId)(input.id)
    const nodeName = yield* Schema.decodeUnknown(NodeName)(input.name)

    return FileSystemEntry.Directory({
      id: nodeId,
      name: nodeName,
      children: input.children ?? [],
      lastModified: input.lastModified ?? new Date()
    })
  })

// 再帰的操作関数
export const calculateTotalSize = (entry: FileSystemEntry): FileSize => {
  return Match.value(entry).pipe(
    Match.tag("File", (file) => file.size),
    Match.tag("Directory", (dir) =>
      pipe(
        dir.children,
        ReadonlyArray.reduce(0 as FileSize, (acc, child) =>
          (acc + calculateTotalSize(child)) as FileSize
        )
      )
    ),
    Match.exhaustive
  )
}

export const findEntryByPath = (
  root: FileSystemEntry,
  path: readonly string[]
): Option.Option<FileSystemEntry> => {
  if (path.length === 0) {
    return Option.some(root)
  }

  return Match.value(root).pipe(
    Match.tag("File", () => Option.none()),
    Match.tag("Directory", (dir) => {
      const [head, ...tail] = path
      const child = dir.children.find((entry) =>
        Match.value(entry).pipe(
          Match.tag("File", (file) => file.name === head),
          Match.tag("Directory", (subdir) => subdir.name === head),
          Match.exhaustive
        )
      )

      return child
        ? findEntryByPath(child, tail)
        : Option.none()
    }),
    Match.exhaustive
  )
}

export const listAllFiles = (entry: FileSystemEntry): readonly FileSystemEntry[] => {
  return Match.value(entry).pipe(
    Match.tag("File", (file) => [file]),
    Match.tag("Directory", (dir) =>
      dir.children.flatMap(listAllFiles)
    ),
    Match.exhaustive
  )
}

// ディレクトリに新しいエントリを追加（不変性を保持）
export const addEntry = (
  directory: Extract<FileSystemEntry, { _tag: "Directory" }>,
  newEntry: FileSystemEntry
): Extract<FileSystemEntry, { _tag: "Directory" }> => {
  return FileSystemEntry.Directory({
    ...directory,
    children: [...directory.children, newEntry],
    lastModified: new Date()
  })
}

// パスに基づいた階層構造の構築
export const buildDirectoryTree = (paths: readonly string[]) =>
  Effect.gen(function* () {
    const root = yield* createDirectory({
      id: "root",
      name: "root"
    })

    let currentTree = root

    for (const path of paths) {
      const parts = path.split('/').filter(Boolean)
      let current = currentTree

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const isFile = i === parts.length - 1

        const existing = pipe(
          findEntryByPath(current, [part]),
          Option.filter((entry): entry is Extract<FileSystemEntry, { _tag: "Directory" }> =>
            entry._tag === "Directory"
          )
        )

        if (Option.isSome(existing)) {
          current = existing.value
        } else {
          const newEntry = isFile
            ? yield* createFile({ id: `file-${part}`, name: part, size: 0 })
            : yield* createDirectory({ id: `dir-${part}`, name: part })

          if (current._tag === "Directory") {
            current = addEntry(current, newEntry)
          }
        }
      }
    }

    return currentTree
  })

// 深度優先探索
export const depthFirstTraversal = (
  entry: FileSystemEntry,
  visitor: (entry: FileSystemEntry) => Effect.Effect<void>
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* visitor(entry)

    if (entry._tag === "Directory") {
      for (const child of entry.children) {
        yield* depthFirstTraversal(child, visitor)
      }
    }
  })

// 階層レベル制限
export const limitDepth = (entry: FileSystemEntry, maxDepth: number): FileSystemEntry => {
  if (maxDepth <= 0) {
    return Match.value(entry).pipe(
      Match.tag("File", (file) => file),
      Match.tag("Directory", (dir) =>
        FileSystemEntry.Directory({
          ...dir,
          children: []
        })
      ),
      Match.exhaustive
    )
  }

  return Match.value(entry).pipe(
    Match.tag("File", (file) => file),
    Match.tag("Directory", (dir) =>
      FileSystemEntry.Directory({
        ...dir,
        children: dir.children.map(child => limitDepth(child, maxDepth - 1))
      })
    ),
    Match.exhaustive
  )
}
```

## Pattern 7: Advanced Branded Types with Brand.refined

**使用場面**: 型安全性と実行時検証を組み合わせたドメイン型

**実装**:
```typescript
import { Schema, Data, Effect, Context, Option, Brand, pipe } from "effect"

// Brand.refinedを使用した高度なブランド型
export type UserId = string & Brand.Brand<"UserId">
export const UserId = Brand.refined<UserId>(
  (value): value is string => typeof value === "string" && value.length > 0,
  (value) => Brand.error(`Invalid UserId: ${value}`)
)

export type SessionId = string & Brand.Brand<"SessionId">
export const SessionId = Brand.refined<SessionId>(
  (value): value is string =>
    typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value),
  (value) => Brand.error(`Invalid SessionId format: ${value}`)
)

export type EmailAddress = string & Brand.Brand<"EmailAddress">
export const EmailAddress = Brand.refined<EmailAddress>(
  (value): value is string =>
    typeof value === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  (value) => Brand.error(`Invalid email format: ${value}`)
)

// 数値系ブランド型（範囲制限付き）
export type Score = number & Brand.Brand<"Score">
export const Score = Brand.refined<Score>(
  (value): value is number =>
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 100,
  (value) => Brand.error(`Score must be integer between 0-100, got: ${value}`)
)

export type Temperature = number & Brand.Brand<"Temperature">
export const Temperature = Brand.refined<Temperature>(
  (value): value is number =>
    typeof value === "number" &&
    value >= -273.15, // 絶対零度
  (value) => Brand.error(`Temperature cannot be below absolute zero: ${value}°C`)
)

// 複合ブランド型（複数の制約を組み合わせ）
export type PositiveInteger = number & Brand.Brand<"Positive"> & Brand.Brand<"Integer">
const Positive = Brand.refined<number & Brand.Brand<"Positive">>(
  (n): n is number => n > 0,
  (n) => Brand.error(`Expected positive number, got: ${n}`)
)
const Integer = Brand.refined<number & Brand.Brand<"Integer">>(
  (n): n is number => Number.isInteger(n),
  (n) => Brand.error(`Expected integer, got: ${n}`)
)
export const PositiveInteger = Brand.all(Positive, Integer)

// Schemaとブランド型の統合
export const UserIdSchema = Schema.String.pipe(Schema.brand("UserId"))
export const SessionIdSchema = Schema.String.pipe(Schema.brand("SessionId"))
export const EmailAddressSchema = Schema.String.pipe(Schema.brand("EmailAddress"))
export const ScoreSchema = Schema.Number.pipe(Schema.brand("Score"))

// ユーザー情報用Data.Class
export class UserInfo extends Data.Class<{
  readonly id: UserId
  readonly email: EmailAddress
  readonly sessionId: Option.Option<SessionId>
  readonly score: Score
  readonly createdAt: Date
}> {}

export const UserInfoSchema = Schema.Struct({
  id: UserIdSchema,
  email: EmailAddressSchema,
  sessionId: Schema.optional(SessionIdSchema),
  score: ScoreSchema,
  createdAt: Schema.DateFromSelf
}).pipe(
  Schema.transform(
    Schema.instanceOf(UserInfo),
    {
      decode: ({ id, email, sessionId, score, createdAt }) =>
        new UserInfo({
          id: id as UserId,
          email: email as EmailAddress,
          sessionId: sessionId ? Option.some(sessionId as SessionId) : Option.none(),
          score: score as Score,
          createdAt
        }),
      encode: (user) => ({
        id: user.id,
        email: user.email,
        sessionId: Option.isSome(user.sessionId) ? user.sessionId.value : undefined,
        score: user.score,
        createdAt: user.createdAt
      })
    }
  )
)

// サービス層での使用
export class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
  readonly userId: UserId
}> {}

export class InvalidScoreError extends Data.TaggedError("InvalidScoreError")<{
  readonly providedScore: number
  readonly userId: UserId
}> {}

export const UserService = Context.GenericTag<{
  readonly findUser: (id: UserId) => Effect.Effect<Option.Option<UserInfo>, UserNotFoundError>
  readonly updateScore: (id: UserId, score: Score) => Effect.Effect<UserInfo, UserNotFoundError | InvalidScoreError>
  readonly authenticateUser: (email: EmailAddress, sessionId: SessionId) => Effect.Effect<UserInfo, UserNotFoundError>
}>("@minecraft/UserService")

// 安全なファクトリ関数
export const createUser = (input: {
  id: string
  email: string
  sessionId?: string
  score: number
}) =>
  Effect.gen(function* () {
    // ブランド型での検証
    const userId = UserId(input.id)
    const email = EmailAddress(input.email)
    const sessionId = input.sessionId ? Option.some(SessionId(input.sessionId)) : Option.none()
    const score = Score(input.score)

    return new UserInfo({
      id: userId,
      email,
      sessionId,
      score,
      createdAt: new Date()
    })
  })

// 型安全なコンバーター関数
export const parseUserFromJson = (json: unknown) =>
  Effect.gen(function* () {
    const parsed = yield* Schema.decodeUnknown(UserInfoSchema)(json)
    return parsed
  })

// Either型を使った安全な変換
export const safeCreateUser = (input: {
  id: string
  email: string
  sessionId?: string
  score: number
}): Either.Either<UserInfo, Brand.BrandErrors> => {
  const userIdResult = UserId.either(input.id)
  const emailResult = EmailAddress.either(input.email)
  const scoreResult = Score.either(input.score)

  if (Either.isLeft(userIdResult)) return userIdResult
  if (Either.isLeft(emailResult)) return emailResult
  if (Either.isLeft(scoreResult)) return scoreResult

  const sessionId = input.sessionId
    ? pipe(
        SessionId.either(input.sessionId),
        Either.map(Option.some)
      )
    : Either.right(Option.none())

  if (Either.isLeft(sessionId)) return sessionId

  return Either.right(new UserInfo({
    id: userIdResult.right,
    email: emailResult.right,
    sessionId: sessionId.right,
    score: scoreResult.right,
    createdAt: new Date()
  }))
}

// バリデーション用ヘルパー
export const isValidUserId = (value: unknown): value is UserId =>
  UserId.is(Brand.unbranded(value))

export const isValidScore = (value: unknown): value is Score =>
  Score.is(Brand.unbranded(value))

// プロパティベーステスト対応
export const generateValidScore = (): Effect.Effect<Score> =>
  Effect.sync(() => Score(Math.floor(Math.random() * 101)))

export const generateValidUserId = (): Effect.Effect<UserId> =>
  Effect.sync(() => UserId(`user_${Math.random().toString(36).substring(2)}`))
```

## Anti-Patterns (避けるべき)

### ❌ Anti-Pattern 1: Plain Objects without Schema or Brand Types

```typescript
// 避けるべきパターン
interface Position {
  x: number
  y: number
  z: number
}

const createPosition = (x: number, y: number, z: number): Position => ({ x, y, z })

// 問題点：
// 1. 実行時バリデーションなし
// 2. 型安全性が不十分
// 3. ドメイン固有制約がない
// 4. 不変性が保証されない
```

### ❌ Anti-Pattern 2: Manual Validation and Type Casting

```typescript
// 避けるべきパターン
const validateAndCreateUser = (data: any): User | null => {
  if (typeof data.id !== 'string') return null
  if (typeof data.email !== 'string') return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return null
  if (typeof data.score !== 'number') return null
  if (data.score < 0 || data.score > 100) return null

  // 問題のある型キャスト
  return data as User
}

// 問題点：
// 1. 手動検証は漏れが発生しやすい
// 2. 型キャストは安全でない
// 3. エラー情報が不十分
// 4. 再利用性が低い
```

### ❌ Anti-Pattern 3: Mutable Data Structures

```typescript
// 避けるべきパターン
class MutablePosition {
  constructor(
    public x: number,
    public y: number,
    public z: number
  ) {}

  move(deltaX: number, deltaY: number, deltaZ: number): void {
    this.x += deltaX
    this.y += deltaY
    this.z += deltaZ
  }
}

// 問題点：
// 1. 状態の変更が予期しない副作用を引き起こす
// 2. 並行処理で競合状態が発生する可能性
// 3. テスタビリティが低い
// 4. 関数型プログラミングの利点を享受できない
```

### ❌ Anti-Pattern 4: Weak Error Handling

```typescript
// 避けるべきパターン
const parseCoordinate = (input: string): Position | null => {
  try {
    const [x, y, z] = input.split(',').map(Number)
    return { x, y, z }
  } catch {
    return null
  }
}

// 問題点：
// 1. エラー情報が失われる
// 2. デバッグが困難
// 3. エラーの種類が区別できない
// 4. 早期リターンパターンが使えない
```

### ❌ Anti-Pattern 5: No Discriminated Unions

```typescript
// 避けるべきパターン
interface Entity {
  id: string
  type: 'player' | 'mob' | 'item'
  // すべてのフィールドがoptional
  health?: number
  inventory?: string[]
  mobType?: string
  itemType?: string
  quantity?: number
}

// 問題点：
// 1. 型の不整合が発生しやすい
// 2. 不必要なoptionalフィールド
// 3. パターンマッチングができない
// 4. 型の絞り込みが困難
```

### ✅ 正しいパターン: Schema + Data.Class + Branded Types

```typescript
// 推奨パターン
export const CoordinateX = Schema.Number.pipe(
  Schema.brand("CoordinateX"),
  Schema.filter((x) => x >= -30000000 && x <= 30000000, {
    message: () => "X coordinate out of bounds"
  })
)

export class BlockPosition extends Data.Class<{
  readonly x: CoordinateX
  readonly y: CoordinateY
  readonly z: CoordinateZ
}> {}

export const BlockPositionSchema = Schema.Struct({
  x: CoordinateX,
  y: CoordinateY,
  z: CoordinateZ
}).pipe(
  Schema.transform(
    Schema.instanceOf(BlockPosition),
    {
      decode: ({ x, y, z }) => new BlockPosition({ x, y, z }),
      encode: (position) => ({ x: position.x, y: position.y, z: position.z })
    }
  )
)

export const createBlockPosition = (
  x: number,
  y: number,
  z: number
) =>
  Effect.gen(function* () {
    const validX = yield* Schema.decodeUnknown(CoordinateX)(x)
    const validY = yield* Schema.decodeUnknown(CoordinateY)(y)
    const validZ = yield* Schema.decodeUnknown(CoordinateZ)(z)
    return new BlockPosition({ x: validX, y: validY, z: validZ })
  })

// 利点：
// 1. 実行時バリデーションと型安全性の両立
// 2. ブランド型による意味のある型区別
// 3. 不変データ構造
// 4. 包括的なエラー情報
// 5. Effect型による早期リターン
```

## Performance Considerations

### 1. Schema Pre-compilation and Caching

```typescript
import { Schema, Effect, Context, Layer, Ref } from "effect"

// 頻繁に使用するスキーマは事前にコンパイル
const decodeBlockPosition = Schema.decodeUnknown(BlockPositionSchema)
const encodeBlockPosition = Schema.encodeUnknown(BlockPositionSchema)
const decodeEntity = Schema.decodeUnknown(EntitySchema)

// パフォーマンス最適化用のコンパイル済みスキーマサービス
export const CompiledSchemas = Context.GenericTag<{
  readonly decodeBlockPosition: (data: unknown) => Effect.Effect<BlockPosition, ParseResult.ParseError>
  readonly encodeBlockPosition: (position: BlockPosition) => Effect.Effect<unknown, ParseResult.ParseError>
  readonly decodeEntity: (data: unknown) => Effect.Effect<Entity, ParseResult.ParseError>
  readonly decodeChunkData: (data: unknown) => Effect.Effect<ChunkData, ParseResult.ParseError>
}>("@minecraft/CompiledSchemas")

export const CompiledSchemasLive = Layer.succeed(
  CompiledSchemas,
  CompiledSchemas.of({
    decodeBlockPosition,
    encodeBlockPosition,
    decodeEntity,
    decodeChunkData: Schema.decodeUnknown(ChunkDataSchema)
  })
)
```

### 2. Batch Processing with Concurrency Control

```typescript
// 大量データの並列処理
export const processBulkPositions = (data: readonly unknown[]) =>
  Effect.gen(function* () {
    const compiledSchemas = yield* CompiledSchemas

    // 並行度を制限して処理
    const results = yield* Effect.all(
      data.map((item) => compiledSchemas.decodeBlockPosition(item)),
      { concurrency: 10, batching: true }
    )

    return results
  })

// エラーレジリエントなバッチ処理
export const processBulkPositionsWithErrorHandling = (data: readonly unknown[]) =>
  Effect.gen(function* () {
    const compiledSchemas = yield* CompiledSchemas

    const results = yield* Effect.all(
      data.map((item, index) =>
        pipe(
          compiledSchemas.decodeBlockPosition(item),
          Effect.either,
          Effect.map((result) => ({ index, result }))
        )
      ),
      { concurrency: 10, batching: true }
    )

    const successes: Array<{ index: number; value: BlockPosition }> = []
    const failures: Array<{ index: number; error: ParseResult.ParseError }> = []

    results.forEach(({ index, result }) => {
      if (Either.isRight(result)) {
        successes.push({ index, value: result.right })
      } else {
        failures.push({ index, error: result.left })
      }
    })

    return { successes, failures }
  })
```

### 3. Schema Memoization and Caching

```typescript
// パース結果のキャッシングサービス
export const SchemaCacheService = Context.GenericTag<{
  readonly getOrParse: <A>(
    key: string,
    parser: () => Effect.Effect<A, ParseResult.ParseError>
  ) => Effect.Effect<A, ParseResult.ParseError>
  readonly invalidate: (key: string) => Effect.Effect<void>
  readonly clear: () => Effect.Effect<void>
}>("@minecraft/SchemaCacheService")

export const SchemaCacheServiceLive = Layer.effect(
  SchemaCacheService,
  Effect.gen(function* () {
    const cache = yield* Ref.make(new Map<string, unknown>())

    return SchemaCacheService.of({
      getOrParse: <A>(
        key: string,
        parser: () => Effect.Effect<A, ParseResult.ParseError>
      ) =>
        Effect.gen(function* () {
          const currentCache = yield* Ref.get(cache)

          if (currentCache.has(key)) {
            return currentCache.get(key) as A
          }

          const result = yield* parser()
          yield* Ref.update(cache, (c) => new Map(c).set(key, result))
          return result
        }),

      invalidate: (key: string) =>
        Ref.update(cache, (c) => {
          const newCache = new Map(c)
          newCache.delete(key)
          return newCache
        }),

      clear: () => Ref.set(cache, new Map())
    })
  })
)

// 使用例
export const getCachedBlockPosition = (key: string, data: unknown) =>
  Effect.gen(function* () {
    const cache = yield* SchemaCacheService
    return yield* cache.getOrParse(
      key,
      () => Schema.decodeUnknown(BlockPositionSchema)(data)
    )
  })
```

### 4. Lazy Schema Loading for Complex Structures

```typescript
// 大きな複合スキーマの遅延ロード
export const WorldDataSchema = Schema.suspend(() =>
  Schema.Struct({
    metadata: Schema.Struct({
      version: Schema.String,
      seed: Schema.Number,
      gameMode: Schema.Literal("survival", "creative", "adventure"),
      difficulty: Schema.Literal("peaceful", "easy", "normal", "hard")
    }),
    chunks: Schema.Array(ChunkDataSchema),
    players: Schema.Array(PlayerSchema),
    globalEntities: Schema.Array(EntitySchema),
    worldBorder: Schema.Struct({
      centerX: CoordinateX,
      centerZ: CoordinateZ,
      size: Schema.Number.pipe(Schema.brand("WorldBorderSize"))
    })
  })
)

// 条件付きスキーマローディング
export const loadSchemaByVersion = (version: string) =>
  Effect.gen(function* () {
    switch (version) {
      case "1.0":
        return yield* Effect.succeed(WorldDataSchema)
      case "2.0":
        // より複雑なスキーマ
        return yield* Effect.succeed(
          Schema.suspend(() =>
            Schema.extend(
              WorldDataSchema,
              Schema.Struct({
                newFeatures: Schema.Array(Schema.String)
              })
            )
          )
        )
      default:
        return yield* Effect.fail(new Error(`Unsupported version: ${version}`))
    }
  })
```

### 5. Memory-Efficient Data Structures

```typescript
// 大量データ用のストリーミング処理
export const processChunkStream = (
  chunks: Stream.Stream<unknown, ParseResult.ParseError>
) =>
  pipe(
    chunks,
    Stream.mapEffect((data) => Schema.decodeUnknown(ChunkDataSchema)(data)),
    Stream.buffer({ capacity: 100 }), // バッファサイズ制限
    Stream.grouped(10), // バッチ処理
    Stream.mapEffect((batch) =>
      Effect.all(
        batch.map((chunk) => processChunk(chunk)),
        { concurrency: 5 }
      )
    )
  )

// メモリ効率的な再帰構造の処理
export const processFileSystemEntryLazily = (
  entry: FileSystemEntry,
  maxDepth: number = 10
): Effect.Effect<number, never> =>
  Effect.gen(function* () {
    if (maxDepth <= 0) return 0

    return yield* Match.value(entry).pipe(
      Match.tag("File", () => Effect.succeed(1)),
      Match.tag("Directory", (dir) =>
        Effect.gen(function* () {
          // 子要素を並列処理（ただし制限付き）
          const childCounts = yield* Effect.all(
            dir.children.map((child) =>
              processFileSystemEntryLazily(child, maxDepth - 1)
            ),
            { concurrency: 5 }
          )

          return childCounts.reduce((sum, count) => sum + count, 1)
        })
      ),
      Match.exhaustive
    )
  })
```

### 6. Property-Based Testing Optimization

```typescript
// 効率的なテストデータ生成
export const generateTestBlockPositions = (count: number) =>
  Effect.gen(function* () {
    return yield* Effect.all(
      Array.from({ length: count }, () =>
        Effect.gen(function* () {
          const x = yield* generateValidCoordinateX()
          const y = yield* generateValidCoordinateY()
          const z = yield* generateValidCoordinateZ()
          return new BlockPosition({ x, y, z })
        })
      ),
      { concurrency: "unbounded" }
    )
  })

const generateValidCoordinateX = (): Effect.Effect<CoordinateX> =>
  Effect.sync(() => {
    const value = Math.floor(Math.random() * 60000000) - 30000000
    return value as CoordinateX
  })

// ベンチマーク用のパフォーマンス測定
export const benchmarkSchemaPerformance = () =>
  Effect.gen(function* () {
    const testData = yield* generateTestBlockPositions(1000)

    const startTime = Date.now()

    yield* Effect.all(
      testData.map((position) =>
        pipe(
          position,
          (pos) => Schema.encodeUnknown(BlockPositionSchema)(pos),
          Effect.flatMap((encoded) => Schema.decodeUnknown(BlockPositionSchema)(encoded))
        )
      ),
      { concurrency: 10 }
    )

    const endTime = Date.now()
    const duration = endTime - startTime

    yield* Effect.log(`Processed ${testData.length} positions in ${duration}ms`)
    yield* Effect.log(`Average: ${duration / testData.length}ms per position`)
  })
```

## 統合パターン

最新Effect-TSパターンを組み合わせた包括的な統合例：

```typescript
import { Schema, Data, Effect, Context, Layer, Stream, Option, Either, Match } from "effect"

// エラー定義（Data.TaggedErrorを使用）
export class BlockNotFoundError extends Data.TaggedError("BlockNotFoundError")<{
  readonly position: BlockPosition
  readonly timestamp: Date
}> {}

export class BlockUpdateError extends Data.TaggedError("BlockUpdateError")<{
  readonly position: BlockPosition
  readonly reason: string
}> {}

export class ChunkLoadError extends Data.TaggedError("ChunkLoadError")<{
  readonly chunkId: ChunkId
  readonly cause: string
}> {}

// サービス定義（Context.GenericTagを使用）
export const BlockService = Context.GenericTag<{
  readonly getBlock: (position: BlockPosition) => Effect.Effect<Option.Option<Block>, BlockNotFoundError>
  readonly setBlock: (position: BlockPosition, block: Block) => Effect.Effect<void, BlockUpdateError>
  readonly bulkUpdateBlocks: (updates: readonly { position: BlockPosition; block: Block }[]) => Effect.Effect<void, BlockUpdateError>
}>("@minecraft/BlockService")

export const ChunkService = Context.GenericTag<{
  readonly loadChunk: (id: ChunkId) => Effect.Effect<ChunkData, ChunkLoadError>
  readonly saveChunk: (chunk: ChunkData) => Effect.Effect<void, ChunkLoadError>
  readonly streamChunks: (ids: readonly ChunkId[]) => Stream.Stream<ChunkData, ChunkLoadError>
}>("@minecraft/ChunkService")

// レイヤー実装
export const BlockServiceLive = Layer.effect(
  BlockService,
  Effect.gen(function* () {
    const chunks = yield* ChunkService

    return BlockService.of({
      getBlock: (position) =>
        Effect.gen(function* () {
          const chunkId = getChunkIdFromPosition(position)
          const chunk = yield* chunks.loadChunk(chunkId)

          const block = chunk.blocks.find((b) =>
            b.position.x === position.x &&
            b.position.y === position.y &&
            b.position.z === position.z
          )

          return block ? Option.some(block) : Option.none()
        }),

      setBlock: (position, block) =>
        Effect.gen(function* () {
          const chunkId = getChunkIdFromPosition(position)
          const chunk = yield* chunks.loadChunk(chunkId)

          const updatedBlocks = chunk.blocks.map((existingBlock) =>
            existingBlock.position.x === position.x &&
            existingBlock.position.y === position.y &&
            existingBlock.position.z === position.z
              ? block
              : existingBlock
          )

          const updatedChunk = new ChunkData({
            ...chunk,
            blocks: updatedBlocks,
            lastModified: Option.some(new Date())
          })

          yield* chunks.saveChunk(updatedChunk)
        }),

      bulkUpdateBlocks: (updates) =>
        Effect.gen(function* () {
          // チャンクごとにグループ化
          const updatesByChunk = new Map<ChunkId, typeof updates>()

          updates.forEach((update) => {
            const chunkId = getChunkIdFromPosition(update.position)
            const existing = updatesByChunk.get(chunkId) ?? []
            updatesByChunk.set(chunkId, [...existing, update])
          })

          // 並列でチャンクを更新
          yield* Effect.all(
            Array.from(updatesByChunk.entries()).map(([chunkId, chunkUpdates]) =>
              Effect.gen(function* () {
                const chunk = yield* chunks.loadChunk(chunkId)
                let updatedBlocks = [...chunk.blocks]

                chunkUpdates.forEach(({ position, block }) => {
                  const index = updatedBlocks.findIndex((b) =>
                    b.position.x === position.x &&
                    b.position.y === position.y &&
                    b.position.z === position.z
                  )
                  if (index >= 0) {
                    updatedBlocks[index] = block
                  }
                })

                const updatedChunk = new ChunkData({
                  ...chunk,
                  blocks: updatedBlocks,
                  lastModified: Option.some(new Date())
                })

                yield* chunks.saveChunk(updatedChunk)
              })
            ),
            { concurrency: 5 }
          )
        })
    })
  })
)

// ドメインロジックの統合
export const updateBlockMaterial = (
  position: BlockPosition,
  newMaterial: MaterialType
) =>
  Effect.gen(function* () {
    const blockService = yield* BlockService

    const currentBlock = yield* blockService.getBlock(position)

    const block = yield* Match.value(currentBlock).pipe(
      Match.when(Option.isSome, ({ value }) => Effect.succeed(value)),
      Match.when(Option.isNone, () =>
        Effect.fail(new BlockNotFoundError({
          position,
          timestamp: new Date()
        }))
      ),
      Match.exhaustive
    )

    const updatedBlock = new Block({
      ...block,
      material: newMaterial
    })

    yield* blockService.setBlock(position, updatedBlock)

    yield* Effect.log(`Updated block at (${position.x}, ${position.y}, ${position.z}) to ${newMaterial}`)
  })

// ストリーミング処理の統合
export const processWorldRegion = (
  region: { minX: CoordinateX; maxX: CoordinateX; minZ: CoordinateZ; maxZ: CoordinateZ }
) =>
  Effect.gen(function* () {
    const chunkService = yield* ChunkService

    // 範囲内のチャンクIDを生成
    const chunkIds: ChunkId[] = []
    for (let x = Math.floor(region.minX / 16); x <= Math.floor(region.maxX / 16); x++) {
      for (let z = Math.floor(region.minZ / 16); z <= Math.floor(region.maxZ / 16); z++) {
        chunkIds.push(`chunk_${x}_${z}` as ChunkId)
      }
    }

    // チャンクをストリーミング処理
    const processedChunks = yield* pipe(
      chunkService.streamChunks(chunkIds),
      Stream.mapEffect((chunk) =>
        Effect.gen(function* () {
          // 領域内のブロックのみを処理
          const blocksInRegion = chunk.blocks.filter((block) =>
            block.position.x >= region.minX &&
            block.position.x <= region.maxX &&
            block.position.z >= region.minZ &&
            block.position.z <= region.maxZ
          )

          yield* Effect.log(`Processing chunk ${chunk.id} with ${blocksInRegion.length} blocks in region`)

          return {
            chunkId: chunk.id,
            blockCount: blocksInRegion.length,
            entityCount: chunk.getEntities().length
          }
        })
      ),
      Stream.runCollect
    )

    return {
      totalChunks: processedChunks.length,
      totalBlocks: processedChunks.reduce((sum, chunk) => sum + chunk.blockCount, 0),
      totalEntities: processedChunks.reduce((sum, chunk) => sum + chunk.entityCount, 0)
    }
  })

// アプリケーション全体の統合
export const MinecraftApp = Layer.mergeAll(
  CompiledSchemasLive,
  SchemaCacheServiceLive
).pipe(
  Layer.provide(BlockServiceLive),
  Layer.provide(ChunkServiceLive)
)

// 使用例
export const runMinecraftApplication = () =>
  Effect.gen(function* () {
    // ブロック更新
    const position = yield* createBlockPosition(10, 64, -5)
    yield* updateBlockMaterial(position, "stone")

    // 領域処理
    const regionStats = yield* processWorldRegion({
      minX: 0 as CoordinateX,
      maxX: 100 as CoordinateX,
      minZ: 0 as CoordinateZ,
      maxZ: 100 as CoordinateZ
    })

    yield* Effect.log(`Region stats: ${JSON.stringify(regionStats, null, 2)}`)
  }).pipe(
    Effect.provide(MinecraftApp),
    Effect.catchAllDefect((defect) =>
      Effect.gen(function* () {
        yield* Effect.logError(`Application defect: ${defect}`)
        return yield* Effect.fail(new Error("Application crashed"))
      })
    ),
    Effect.tapError((error) =>
      Effect.log(`Application error: ${error.message}`)
    )
  )

// ヘルパー関数
const getChunkIdFromPosition = (position: BlockPosition): ChunkId => {
  const chunkX = Math.floor(position.x / 16)
  const chunkZ = Math.floor(position.z / 16)
  return `chunk_${chunkX}_${chunkZ}` as ChunkId
}
```

この統合パターンの主な特徴：

1. **Data.Class**による不変データ構造
2. **Schema.brand**による型安全性
3. **Data.TaggedError**による構造化エラー
4. **Context.GenericTag**による依存性注入
5. **Effect.gen**による早期リターンパターン
6. **Stream**による効率的な大量データ処理
7. **Layer**による合成可能なアプリケーション構造
8. **Option/Either**による安全な値処理
9. **Match**による完全網羅パターンマッチング