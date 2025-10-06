/**
 * @fileoverview World Core Types
 * 世界ドメインの基本型定義
 */

import { Brand, Schema } from 'effect'
import { WORLD_CONSTANTS } from '../constants'

// === 基本識別子型 ===

/** 世界ID - 複数の世界を区別するための識別子 */
export type WorldId = string & Brand.Brand<'WorldId'>

export const WorldIdSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(255),
  Schema.pattern(/^[a-zA-Z0-9_-]+$/),
  Schema.brand('WorldId'),
  Schema.annotations({
    title: 'World ID',
    description: 'Unique identifier for a world instance',
    examples: ['world_main', 'creative_world', 'adventure_map'],
  })
)

/** 世界シード - 世界生成の決定的なランダムシード */
export type WorldSeed = number & Brand.Brand<'WorldSeed'>

export const WorldSeedSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(-2147483648, 2147483647),
  Schema.brand('WorldSeed'),
  Schema.annotations({
    title: 'World Seed',
    description: 'Deterministic random seed for world generation',
    examples: [12345, -9876543, 0],
  })
)

/** 次元ID - ワールド内の異なる次元を識別 */
export type DimensionId = string & Brand.Brand<'DimensionId'>

export const DimensionIdSchema = Schema.String.pipe(
  Schema.pattern(/^minecraft:[a-z_]+$/),
  Schema.brand('DimensionId'),
  Schema.annotations({
    title: 'Dimension ID',
    description: 'Identifier for different world dimensions',
    examples: ['minecraft:overworld', 'minecraft:nether', 'minecraft:the_end'],
  })
)

// === 座標システム型 ===

/** ワールド座標 - ワールド空間での絶対座標 */
export type WorldCoordinate = number & Brand.Brand<'WorldCoordinate'>

export const WorldCoordinateSchema = Schema.Number.pipe(
  Schema.between(WORLD_CONSTANTS.BORDER.MAX_SIZE * -0.5, WORLD_CONSTANTS.BORDER.MAX_SIZE * 0.5),
  Schema.brand('WorldCoordinate'),
  Schema.annotations({
    title: 'World Coordinate',
    description: 'Absolute coordinate in world space',
  })
)

/** チャンク座標 - チャンク単位での座標 */
export type ChunkCoordinate = number & Brand.Brand<'ChunkCoordinate'>

export const ChunkCoordinateSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(-30_000_000, 30_000_000),
  Schema.brand('ChunkCoordinate'),
  Schema.annotations({
    title: 'Chunk Coordinate',
    description: 'Coordinate in chunk units',
  })
)

/** セクション座標 - セクション単位での座標 */
export type SectionCoordinate = number & Brand.Brand<'SectionCoordinate'>

export const SectionCoordinateSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(-512, 511),
  Schema.brand('SectionCoordinate'),
  Schema.annotations({
    title: 'Section Coordinate',
    description: 'Coordinate in section units (16-block chunks)',
  })
)

/** 高度値 - Y軸の高度を表す */
export type Height = number & Brand.Brand<'Height'>

export const HeightSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(WORLD_CONSTANTS.HEIGHT.MIN, WORLD_CONSTANTS.HEIGHT.MAX),
  Schema.brand('Height'),
  Schema.annotations({
    title: 'Height',
    description: `World height value between ${WORLD_CONSTANTS.HEIGHT.MIN} and ${WORLD_CONSTANTS.HEIGHT.MAX}`,
  })
)

// === 位置ベクトル型 ===

/** 2次元位置ベクトル */
export interface Vector2D {
  readonly x: WorldCoordinate
  readonly z: WorldCoordinate
}

export const Vector2DSchema = Schema.Struct({
  x: WorldCoordinateSchema,
  z: WorldCoordinateSchema,
}).pipe(
  Schema.annotations({
    title: 'Vector2D',
    description: '2D position vector in world space',
  })
)

/** 3次元位置ベクトル */
export interface Vector3D {
  readonly x: WorldCoordinate
  readonly y: Height
  readonly z: WorldCoordinate
}

export const Vector3DSchema = Schema.Struct({
  x: WorldCoordinateSchema,
  y: HeightSchema,
  z: WorldCoordinateSchema,
}).pipe(
  Schema.annotations({
    title: 'Vector3D',
    description: '3D position vector in world space',
  })
)

/** チャンク位置 */
export interface ChunkPosition {
  readonly x: ChunkCoordinate
  readonly z: ChunkCoordinate
}

export const ChunkPositionSchema = Schema.Struct({
  x: ChunkCoordinateSchema,
  z: ChunkCoordinateSchema,
}).pipe(
  Schema.annotations({
    title: 'Chunk Position',
    description: 'Position of a chunk in chunk coordinates',
  })
)

/** セクション位置 */
export interface SectionPosition {
  readonly x: ChunkCoordinate
  readonly y: SectionCoordinate
  readonly z: ChunkCoordinate
}

export const SectionPositionSchema = Schema.Struct({
  x: ChunkCoordinateSchema,
  y: SectionCoordinateSchema,
  z: ChunkCoordinateSchema,
}).pipe(
  Schema.annotations({
    title: 'Section Position',
    description: 'Position of a section in section coordinates',
  })
)

// === 世界境界型 ===

/** 世界境界設定 */
export interface WorldBorder {
  readonly center: Vector2D
  readonly size: number
  readonly damageBuffer: number
  readonly damageAmount: number
  readonly warningTime: number
  readonly warningBlocks: number
}

export const WorldBorderSchema = Schema.Struct({
  center: Vector2DSchema,
  size: Schema.Number.pipe(Schema.between(WORLD_CONSTANTS.BORDER.MIN_SIZE, WORLD_CONSTANTS.BORDER.MAX_SIZE)),
  damageBuffer: Schema.Number.pipe(Schema.nonNegative()),
  damageAmount: Schema.Number.pipe(Schema.nonNegative()),
  warningTime: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  warningBlocks: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
}).pipe(
  Schema.annotations({
    title: 'World Border',
    description: 'Configuration for world boundary limits',
  })
)

// === 時間型 ===

/** ゲーム内時間 - tick単位 */
export type GameTime = number & Brand.Brand<'GameTime'>

export const GameTimeSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('GameTime'),
  Schema.annotations({
    title: 'Game Time',
    description: 'Game time in ticks (20 ticks = 1 second)',
  })
)

/** 世界年齢 - 世界が作成されてからの経過時間 */
export type WorldAge = number & Brand.Brand<'WorldAge'>

export const WorldAgeSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('WorldAge'),
  Schema.annotations({
    title: 'World Age',
    description: 'Total ticks since world creation',
  })
)

// === 難易度型 ===

/** ゲーム難易度 */
export type Difficulty = 'peaceful' | 'easy' | 'normal' | 'hard'

export const DifficultySchema = Schema.Literal('peaceful', 'easy', 'normal', 'hard').pipe(
  Schema.annotations({
    title: 'Difficulty',
    description: 'Game difficulty setting',
  })
)

// === ゲームモード型 ===

/** ゲームモード */
export type GameMode = 'survival' | 'creative' | 'adventure' | 'spectator'

export const GameModeSchema = Schema.Literal('survival', 'creative', 'adventure', 'spectator').pipe(
  Schema.annotations({
    title: 'Game Mode',
    description: 'Player game mode setting',
  })
)

// === ゲームルール型 ===

/** ゲームルール値の型 */
export type GameRuleValue = boolean | number | string

export const GameRuleValueSchema = Schema.Union(Schema.Boolean, Schema.Number, Schema.String).pipe(
  Schema.annotations({
    title: 'Game Rule Value',
    description: 'Value for a game rule (boolean, number, or string)',
  })
)

/** ゲームルール設定 */
export interface GameRules {
  readonly [key: string]: GameRuleValue
}

export const GameRulesSchema = Schema.Record({
  key: Schema.String,
  value: GameRuleValueSchema,
}).pipe(
  Schema.annotations({
    title: 'Game Rules',
    description: 'Collection of game rule settings',
  })
)

// === 世界設定型 ===

/** 世界設定の基本構造 */
export interface WorldSettings {
  readonly id: WorldId
  readonly name: string
  readonly seed: WorldSeed
  readonly difficulty: Difficulty
  readonly gameMode: GameMode
  readonly gameRules: GameRules
  readonly border: WorldBorder
  readonly spawnPoint: Vector3D
  readonly allowCommands: boolean
  readonly generateStructures: boolean
  readonly hardcore: boolean
  readonly allowCheats: boolean
}

export const WorldSettingsSchema = Schema.Struct({
  id: WorldIdSchema,
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255)),
  seed: WorldSeedSchema,
  difficulty: DifficultySchema,
  gameMode: GameModeSchema,
  gameRules: GameRulesSchema,
  border: WorldBorderSchema,
  spawnPoint: Vector3DSchema,
  allowCommands: Schema.Boolean,
  generateStructures: Schema.Boolean,
  hardcore: Schema.Boolean,
  allowCheats: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'World Settings',
    description: 'Complete configuration for a world instance',
  })
)

// === 天候型 ===

/** 天候タイプ */
export type WeatherType = 'clear' | 'rain' | 'thunderstorm'

export const WeatherTypeSchema = Schema.Literal('clear', 'rain', 'thunderstorm').pipe(
  Schema.annotations({
    title: 'Weather Type',
    description: 'Current weather condition',
  })
)

/** 天候状態 */
export interface WeatherState {
  readonly type: WeatherType
  readonly duration: GameTime
  readonly thundering: boolean
  readonly rainLevel: number
  readonly thunderLevel: number
}

export const WeatherStateSchema = Schema.Struct({
  type: WeatherTypeSchema,
  duration: GameTimeSchema,
  thundering: Schema.Boolean,
  rainLevel: Schema.Number.pipe(Schema.between(0, 1)),
  thunderLevel: Schema.Number.pipe(Schema.between(0, 1)),
}).pipe(
  Schema.annotations({
    title: 'Weather State',
    description: 'Current weather conditions and intensity',
  })
)

// === 世界状態型 ===

/** 世界の現在状態 */
export interface WorldState {
  readonly settings: WorldSettings
  readonly currentTime: GameTime
  readonly worldAge: WorldAge
  readonly weather: WeatherState
  readonly loadedChunks: number
  readonly activePlayerCount: number
  readonly lastSaved: Date
}

export const WorldStateSchema = Schema.Struct({
  settings: WorldSettingsSchema,
  currentTime: GameTimeSchema,
  worldAge: WorldAgeSchema,
  weather: WeatherStateSchema,
  loadedChunks: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  activePlayerCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  lastSaved: Schema.DateFromSelf,
}).pipe(
  Schema.annotations({
    title: 'World State',
    description: 'Current state of a world instance',
  })
)

// === ヘルパー関数型 ===

/** 座標変換のヘルパー型 */
export interface CoordinateHelpers {
  readonly worldToChunk: (worldCoord: WorldCoordinate) => ChunkCoordinate
  readonly chunkToWorld: (chunkCoord: ChunkCoordinate) => WorldCoordinate
  readonly worldToSection: (worldCoord: WorldCoordinate) => SectionCoordinate
  readonly sectionToWorld: (sectionCoord: SectionCoordinate) => WorldCoordinate
}

// === 作成ヘルパー関数 ===

/** Vector3D作成ヘルパー */
export const createVector3D = (x: number, y: number, z: number): Vector3D =>
  Schema.decodeSync(Vector3DSchema)({
    x: x as WorldCoordinate,
    y: y as Height,
    z: z as WorldCoordinate,
  })

/** ChunkPosition作成ヘルパー */
export const createChunkPosition = (x: number, z: number): ChunkPosition =>
  Schema.decodeSync(ChunkPositionSchema)({
    x: x as ChunkCoordinate,
    z: z as ChunkCoordinate,
  })

/** WorldId作成ヘルパー */
export const createWorldId = (id: string): WorldId => Schema.decodeSync(WorldIdSchema)(id)

/** WorldSeed作成ヘルパー */
export const createWorldSeed = (seed: number): WorldSeed => Schema.decodeSync(WorldSeedSchema)(seed)
