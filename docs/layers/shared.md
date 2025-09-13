# Shared層 - 共通ライブラリ・ユーティリティ

Shared層は、全てのレイヤーで共有される基盤的な機能を提供する層です。型定義、定数、ユーティリティ関数、エラーハンドリングなど、アプリケーション全体で一貫した実装パターンを保証します。

## アーキテクチャ構成

```
src/shared/
├── types/           # 型定義・スキーマ
├── constants/       # 共通定数・設定
└── utils/          # ユーティリティ関数群
```

## 1. Types（型定義・スキーマ）

TypeScriptの型安全性を活用した厳密な型定義群。

### 共通型定義

#### Common Types
```typescript
// src/shared/types/common.ts
// 基本的な型エイリアス
export type Maybe<T> = T | null
export type Optional<T> = T | undefined
export type Nullable<T> = T | null
export type NonEmptyArray<T> = [T, ...T[]]
export type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> }
export type DeepRequired<T> = { [P in keyof T]-?: DeepRequired<T[P]> }

// 関数型
export type EffectFn<A, R = void, E = never> = (arg: A) => Effect.Effect<R, E>
export type SyncFn<A, R = void> = (arg: A) => R
export type EventHandler<T = Event> = (event: T) => void
export type Callback<T = void> = (result: T) => void

// ID型（ブランド型）
export type EntityID = string & Brand.Brand<'EntityID'>
export type ComponentID = string & Brand.Brand<'ComponentID'>
export type SystemID = string & Brand.Brand<'SystemID'>

// 幾何学型
export interface Point2D {
  readonly x: number
  readonly y: number
}

export interface Point3D {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface Size2D {
  readonly width: number
  readonly height: number
}

export interface Box3D {
  readonly min: Point3D
  readonly max: Point3D
}

// 結果型
export type Result<T, E = Error> = Success<T> | Failure<E>
export interface Success<T> {
  readonly _tag: 'Success'
  readonly value: T
}
export interface Failure<E> {
  readonly _tag: 'Failure'
  readonly error: E
}
```

#### Schema定義（@effect/schema）
```typescript
// Schema-based validation
const Point2DSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number
})

const Point3DSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

const EntityIDSchema = Schema.String.pipe(Schema.brand("EntityID"))
const TimestampSchema = Schema.Number.pipe(Schema.brand("Timestamp"))

type Point2D = Schema.Schema.Type<typeof Point2DSchema>
type Point3D = Schema.Schema.Type<typeof Point3DSchema>
type EntityID = Schema.Schema.Type<typeof EntityIDSchema>
type Timestamp = Schema.Schema.Type<typeof TimestampSchema>

// 安全なデコード関数
const decodePoint2D = (input: unknown): Effect.Effect<Point2D, ValidationError> =>
  Schema.decodeUnknownEither(Point2DSchema)(input).pipe(
    Effect.mapError(error => createValidationError("Invalid Point2D", error))
  )

const decodePoint3D = (input: unknown): Effect.Effect<Point3D, ValidationError> =>
  Schema.decodeUnknownEither(Point3DSchema)(input).pipe(
    Effect.mapError(error => createValidationError("Invalid Point3D", error))
  )

// 純粋な型ガード関数
const isPoint2D = (value: unknown): value is Point2D =>
  Schema.is(Point2DSchema)(value)

const isPoint3D = (value: unknown): value is Point3D =>
  Schema.is(Point3DSchema)(value)

// 安全なコンストラクタ
const createEntityID = (id: string): Effect.Effect<EntityID, ValidationError> =>
  Schema.decodeUnknownEither(EntityIDSchema)(id).pipe(
    Effect.mapError(error => createValidationError("Invalid EntityID", error))
  )

const createTimestamp = (): Effect.Effect<Timestamp, never> =>
  Effect.sync(() => Date.now() as Timestamp)
```

### ゲーム固有型定義

#### Game Types
```typescript
// src/shared/types/game.ts
// ブロック関連
export type BlockType = 
  | 'AIR' 
  | 'STONE' 
  | 'DIRT' 
  | 'GRASS' 
  | 'WATER' 
  | 'LAVA'
  | 'SAND'
  | 'GRAVEL'

const BlockTypeSchema = Schema.Literal(
  'AIR', 'STONE', 'DIRT', 'GRASS', 'WATER', 'LAVA', 'SAND', 'GRAVEL'
)

type BlockType = Schema.Schema.Type<typeof BlockTypeSchema>

// 座標系のSchema定義
const WorldPositionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

const ChunkPositionSchema = Schema.Struct({
  x: Schema.Number,
  z: Schema.Number
})

const BlockPositionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  chunkX: Schema.Number,
  chunkZ: Schema.Number
})

type WorldPosition = Schema.Schema.Type<typeof WorldPositionSchema>
type ChunkPosition = Schema.Schema.Type<typeof ChunkPositionSchema>
type BlockPosition = Schema.Schema.Type<typeof BlockPositionSchema>

// 座標系のコンストラクタ関数（純粋関数）
const createWorldPosition = (x: number, y: number, z: number): WorldPosition => ({ x, y, z })
const createChunkPosition = (x: number, z: number): ChunkPosition => ({ x, z })
const createBlockPosition = (
  x: number,
  y: number,
  z: number,
  chunkX: number,
  chunkZ: number
): BlockPosition => ({ x, y, z, chunkX, chunkZ })

// ゲーム状態のSchema定義
const GameModeSchema = Schema.Literal('CREATIVE', 'SURVIVAL', 'ADVENTURE', 'SPECTATOR')
const DifficultySchema = Schema.Literal('PEACEFUL', 'EASY', 'NORMAL', 'HARD')
const WeatherSchema = Schema.Literal('CLEAR', 'RAIN', 'STORM', 'SNOW')

type GameMode = Schema.Schema.Type<typeof GameModeSchema>
type Difficulty = Schema.Schema.Type<typeof DifficultySchema>
type Weather = Schema.Schema.Type<typeof WeatherSchema>

// バイオーム
export type BiomeType = 
  | 'PLAINS' 
  | 'FOREST' 
  | 'DESERT' 
  | 'MOUNTAINS' 
  | 'OCEAN' 
  | 'SWAMP'
  | 'TAIGA'
  | 'TUNDRA'

// アイテム・インベントリ
export interface ItemStack {
  readonly type: ItemType
  readonly count: number
  readonly durability?: number
  readonly enchantments?: Record<string, number>
}

export interface InventorySlot {
  readonly index: number
  readonly item: ItemStack | null
}

export interface Inventory {
  readonly slots: InventorySlot[]
  readonly hotbar: ItemStack[]
  readonly selectedSlot: number
}

// メッシュデータ
export interface MeshData {
  readonly vertices: Float32Array
  readonly indices: Uint32Array
  readonly normals: Float32Array
  readonly uvs: Float32Array
  readonly materials: string[]
}

// ゲーム状態
export interface GameState {
  readonly mode: GameMode
  readonly difficulty: Difficulty
  readonly weather: Weather
  readonly time: number
  readonly player: {
    readonly position: WorldPosition
    readonly health: number
    readonly inventory: Inventory
  }
  readonly world: {
    readonly seed: number
    readonly spawn: WorldPosition
    readonly loadedChunks: ChunkPosition[]
  }
  readonly performance: {
    readonly fps: number
    readonly frameTime: number
    readonly memoryUsage: number
  }
}
```

### 外部ライブラリ型定義

```typescript
// src/shared/types/external.d.ts
// Three.js拡張
declare module 'three' {
  interface BufferGeometry {
    boundingBox: Box3 | null
    boundingSphere: Sphere | null
  }
}

// Effect-TS拡張
declare module '@effect/schema' {
  interface Schema<A, I, R> {
    readonly _A: A
    readonly _I: I
    readonly _R: R
  }
}

// Web Workers
interface WorkerGlobalScope {
  importScripts(...urls: string[]): void
}
```

## 2. Constants（定数定義）

アプリケーション全体で使用される設定値・定数群。

### パフォーマンス定数

```typescript
// src/shared/constants/performance.ts
// フレームレート設定
export const TARGET_FPS = 60
export const MIN_FPS_THRESHOLD = 30
export const MAX_FRAME_TIME_MS = 33.33

// メモリ管理
export const MAX_MEMORY_USAGE_MB = 512
export const GC_THRESHOLD_MB = 100
export const MEMORY_CHECK_INTERVAL_MS = 5000

// レンダリングパフォーマンス
export const MAX_DRAW_CALLS_PER_FRAME = 100
export const MAX_VERTICES_PER_FRAME = 100000
export const FRUSTUM_CULLING_ENABLED = true

// プロファイリング
export const PROFILING_ENABLED = true
export const PROFILE_SAMPLE_INTERVAL_MS = 1000

// スキーマ定義
export const PerformanceConfigSchema = S.Struct({
  targetFPS: S.Number,
  minFPSThreshold: S.Number,
  maxMemoryUsageMB: S.Number,
  profilingEnabled: S.Boolean
})

export type PerformanceConfig = S.Schema.Type<typeof PerformanceConfigSchema>

export const PERFORMANCE_CONFIG: PerformanceConfig = {
  targetFPS: TARGET_FPS,
  minFPSThreshold: MIN_FPS_THRESHOLD,
  maxMemoryUsageMB: MAX_MEMORY_USAGE_MB,
  profilingEnabled: PROFILING_ENABLED
}
```

### 物理演算定数

```typescript
// src/shared/constants/physics.ts
// プレイヤー移動
export const PLAYER_SPEED = 4.3
export const SPRINT_MULTIPLIER = 1.3
export const JUMP_FORCE = 7.0
export const TERMINAL_VELOCITY = -78.4

// 物理法則
export const GRAVITY = -32.0
export const FRICTION = 0.91
export const AIR_RESISTANCE = 0.98
export const DECELERATION = 0.85

// プレイヤーコリジョン
export const PLAYER_HEIGHT = 1.8
export const PLAYER_WIDTH = 0.6
export const PLAYER_DEPTH = 0.6

// 物理シミュレーション
export const PHYSICS_TIME_STEP = 1 / 60
export const MAX_PHYSICS_SUBSTEPS = 4
export const COLLISION_EPSILON = 0.001

// ブロック物理
export const BLOCK_SIZE = 1.0
export const BLOCK_HALF_SIZE = 0.5

// コリジョン形状
export interface SimpleCollider {
  readonly type: 'BOX' | 'SPHERE' | 'CAPSULE'
  readonly size: Point3D
  readonly offset: Point3D
}

export const PLAYER_COLLIDER: SimpleCollider = {
  type: 'CAPSULE',
  size: { x: PLAYER_WIDTH, y: PLAYER_HEIGHT, z: PLAYER_DEPTH },
  offset: { x: 0, y: PLAYER_HEIGHT / 2, z: 0 }
}

// スキーマ定義
export const PhysicsConfigSchema = S.Struct({
  gravity: S.Number,
  playerSpeed: S.Number,
  jumpForce: S.Number,
  friction: S.Number,
  timeStep: S.Number
})

export type PhysicsConfig = S.Schema.Type<typeof PhysicsConfigSchema>
```

### ワールド定数

```typescript
// src/shared/constants/world.ts
// チャンク設定
export const CHUNK_SIZE = 16
export const CHUNK_HEIGHT = 256
export const WATER_LEVEL = 64

// ワールド境界
export const MIN_WORLD_Y = 0
export const MAX_WORLD_Y = 256
export const WORLD_HEIGHT_RANGE = MAX_WORLD_Y - MIN_WORLD_Y

// 読み込み距離
export const RENDER_DISTANCE = 8
export const SIMULATION_DISTANCE = 6

// チャンク管理
export const CHUNK_UNLOAD_DELAY_MS = 30000
export const MAX_CHUNKS_PER_TICK = 2
export const CHUNK_CACHE_SIZE = 1000

// 地形生成
export const NOISE_SCALE = 0.01
export const TERRAIN_HEIGHT_MULTIPLIER = 100
export const CAVE_THRESHOLD = 0.3
export const ORE_DENSITY = 0.02

// 地層設定
export const STONE_LAYER_START = 5
export const BEDROCK_LAYER_START = 0

// バイオーム
export const TEMPERATURE_SCALE = 0.02
export const HUMIDITY_SCALE = 0.02
export const BIOME_TRANSITION_SMOOTHNESS = 0.1

// ワールド境界
export const WORLD_BORDER_SIZE = 30000000
export const WORLD_BORDER_WARNING_DISTANCE = 1000

// スキーマ定義
export const WorldConfigSchema = S.Struct({
  chunkSize: S.Number,
  renderDistance: S.Number,
  waterLevel: S.Number,
  noiseScale: S.Number,
  worldBorderSize: S.Number
})

export type WorldConfig = S.Schema.Type<typeof WorldConfigSchema>
```

### テクスチャ定数

```typescript
// src/shared/constants/texture.ts
// テクスチャアトラス
export const TEXTURE_TILE_SIZE = 16
export const ATLAS_WIDTH_IN_TILES = 32
export const ATLAS_HEIGHT_IN_TILES = 32
export const ATLAS_SIZE = ATLAS_WIDTH_IN_TILES * TEXTURE_TILE_SIZE
export const TOTAL_ATLAS_TILES = ATLAS_WIDTH_IN_TILES * ATLAS_HEIGHT_IN_TILES

// テクスチャ設定
export const TEXTURE_FORMAT = 'RGBA8'
export const MIPMAP_FILTER = 'LINEAR_MIPMAP_LINEAR'
export const MAX_MIPMAPS = 4
export const ANISOTROPY = 4

// 圧縮設定
export const COMPRESSION_ENABLED = true
export const COMPRESSION_FORMAT = 'DXT5'
export const ALPHA_CUTOFF = 0.5

// 読み込み戦略
export const LAZY_LOADING = true
export const PRELOAD_ESSENTIALS = true
export const CACHE_SIZE = 256
export const STREAMING_ENABLED = true
export const STREAMING_THRESHOLD_MB = 100
export const MAX_CONCURRENT_LOADS = 4

// 品質設定
export const TEXTURE_QUALITY_HIGH = 1.0
export const TEXTURE_QUALITY_MEDIUM = 0.75
export const TEXTURE_QUALITY_LOW = 0.5
export const DEFAULT_TEXTURE_QUALITY = TEXTURE_QUALITY_HIGH
```

## 3. Utils（ユーティリティ関数）

再利用可能な汎用機能群。

### 関数型プログラミングユーティリティ

```typescript
// src/shared/utils/functional.ts
// 配列操作
export const chunk = <T>(array: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  )

export const flatten = <T>(arrays: T[][]): T[] =>
  arrays.reduce((acc, arr) => acc.concat(arr), [])

export const unique = <T>(array: T[]): T[] =>
  Array.from(new Set(array))

export const groupBy = <T, K extends keyof any>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> =>
  array.reduce((acc, item) => {
    const key = keyFn(item)
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<K, T[]>)

// 安全な配列アクセス
export const safeHead = <T>(array: T[]): Maybe<T> =>
  array.length > 0 ? array[0] : null

export const safeLast = <T>(array: T[]): Maybe<T> =>
  array.length > 0 ? array[array.length - 1] : null

export const safeGet = <T>(array: T[], index: number): Maybe<T> =>
  index >= 0 && index < array.length ? array[index] : null

// 高階関数
export const compose = <A, B, C>(
  f: (b: B) => C,
  g: (a: A) => B
): ((a: A) => C) =>
  (a: A) => f(g(a))

export const memoize = <A, R>(fn: (arg: A) => R): ((arg: A) => R) => {
  const cache = new Map<A, R>()
  return (arg: A): R => {
    if (cache.has(arg)) {
      return cache.get(arg)!
    }
    const result = fn(arg)
    cache.set(arg, result)
    return result
  }
}

// 制御フロー
export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

export const throttle = <T extends (...args: any[]) => any>(
  fn: T,
  interval: number
): ((...args: Parameters<T>) => void) => {
  let lastCall = 0
  
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCall >= interval) {
      lastCall = now
      fn(...args)
    }
  }
}
```

### Effect-TS ユーティリティ

```typescript
// src/shared/utils/effect.ts
import { Match } from "effect"

const ErrorLogLevel = Schema.Literal("DEBUG", "INFO", "WARN", "ERROR")
type ErrorLogLevel = Schema.Schema.Type<typeof ErrorLogLevel>

// 早期リターン対応のエラーハンドリング
const withErrorLog = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  message?: string,
  level: ErrorLogLevel = "ERROR"
): Effect.Effect<A, E, R> =>
  Effect.tapError(effect, (error) =>
    Effect.gen(function* () {
      // 早期リターン: 無効なレベル
      if (!Schema.is(ErrorLogLevel)(level)) {
        return
      }

      const logMessage = message || 'Effect error:'

      yield* Match.value(level).pipe(
        Match.when("DEBUG", () => Effect.sync(() => console.debug(logMessage, error))),
        Match.when("INFO", () => Effect.sync(() => console.info(logMessage, error))),
        Match.when("WARN", () => Effect.sync(() => console.warn(logMessage, error))),
        Match.when("ERROR", () => Effect.sync(() => console.error(logMessage, error))),
        Match.exhaustive
      )
    })
  )

// パフォーマンス測定（純粋関数化）
const measureExecutionTime = (startTime: number, endTime: number): number =>
  Math.max(0, endTime - startTime)

const formatExecutionTime = (time: number): string =>
  `${time.toFixed(2)}ms`

const withTiming = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  label: string
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    // 早期リターン: ラベル検証
    if (!label || label.trim().length === 0) {
      return yield* effect
    }

    const start = yield* Effect.sync(() => performance.now())
    const result = yield* effect
    const end = yield* Effect.sync(() => performance.now())

    const executionTime = measureExecutionTime(start, end)
    const formattedTime = formatExecutionTime(executionTime)

    yield* Effect.sync(() => console.log(`${label.trim()}: ${formattedTime}`))

    return result
  })

// リトライ設定のバリデーション
const validateRetryConfig = (maxAttempts: number, baseDelay: number): boolean =>
  maxAttempts > 0 && maxAttempts <= 10 && baseDelay > 0 && baseDelay <= 60000

const retryWithBackoff = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  maxAttempts: number,
  baseDelay: number = 1000
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    // 早期リターン: パラメータ検証
    if (!validateRetryConfig(maxAttempts, baseDelay)) {
      return yield* effect
    }

    return yield* Effect.retry(
      effect,
      Schedule.exponential(`${baseDelay} millis`).pipe(
        Schedule.intersect(Schedule.recurs(maxAttempts - 1))
      )
    )
  })

// 並行処理
export const forEachWithConcurrency = <A, B, E, R>(
  array: A[],
  fn: (item: A) => Effect.Effect<B, E, R>,
  concurrency: number
): Effect.Effect<B[], E, R> =>
  Effect.forEach(array, fn, { concurrency })

// キャッシュ機能
export const cached = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  ttl: number = 300000 // 5分
): Effect.Effect<A, E, R> => {
  let cachedResult: A | null = null
  let cacheTime = 0
  
  return Effect.gen(function* () {
    const now = Date.now()
    
    if (cachedResult && (now - cacheTime) < ttl) {
      return cachedResult
    }
    
    const result = yield* effect
    cachedResult = result
    cacheTime = now
    
    return result
  })
}

// サーキットブレーカー
export interface CircuitBreakerState {
  failures: number
  lastFailure: number
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
}

export const createCircuitBreaker = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  threshold: number = 5,
  timeout: number = 60000
): Effect.Effect<A, E | Error, R> => {
  let state: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    state: 'CLOSED'
  }
  
  return Effect.gen(function* () {
    const now = Date.now()
    
    // OPEN状態のチェック
    if (state.state === 'OPEN') {
      if (now - state.lastFailure > timeout) {
        state.state = 'HALF_OPEN'
      } else {
        return yield* Effect.fail(new Error('Circuit breaker is OPEN'))
      }
    }
    
    try {
      const result = yield* effect
      
      // 成功時はリセット
      if (state.state === 'HALF_OPEN') {
        state = { failures: 0, lastFailure: 0, state: 'CLOSED' }
      }
      
      return result
    } catch (error) {
      state.failures++
      state.lastFailure = now
      
      if (state.failures >= threshold) {
        state.state = 'OPEN'
      }
      
      return yield* Effect.fail(error as E)
    }
  })
}
```

### 数学ユーティリティ

```typescript
// src/shared/utils/math.ts
// ブランド型による数値安全性
export type Float = number & Brand.Brand<'Float'>
export type Int = number & Brand.Brand<'Int'>

export const toFloat = (n: number): Float => n as Float
export const toInt = (n: number): Int => Math.floor(n) as Int

// 数学関数
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * clamp(t, 0, 1)

export const distance2D = (a: Point2D, b: Point2D): number =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)

export const distance3D = (a: Point3D, b: Point3D): number =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)

export const normalizeAngle = (angle: number): number => {
  while (angle > Math.PI) angle -= 2 * Math.PI
  while (angle < -Math.PI) angle += 2 * Math.PI
  return angle
}

export const degreesToRadians = (degrees: number): number =>
  degrees * (Math.PI / 180)

export const radiansToDegrees = (radians: number): number =>
  radians * (180 / Math.PI)

export const isPowerOfTwo = (n: number): boolean =>
  n > 0 && (n & (n - 1)) === 0

export const nextPowerOfTwo = (n: number): number => {
  if (n <= 0) return 1
  return Math.pow(2, Math.ceil(Math.log2(n)))
}

// ベクトル演算
export interface Vector3Float {
  readonly x: Float
  readonly y: Float
  readonly z: Float
}

export const Vector3FloatSchema = S.Struct({
  x: S.Number.pipe(S.transform(toFloat)),
  y: S.Number.pipe(S.transform(toFloat)),
  z: S.Number.pipe(S.transform(toFloat))
})
```

### エラーハンドリングユーティリティ

```typescript
// src/shared/utils/error.ts
// 統一エラーハンドリング
export interface ErrorContext {
  readonly component: string
  readonly operation: string
  readonly timestamp: Timestamp
  readonly metadata?: Record<string, JsonValue>
}

export interface RetryConfig {
  readonly maxAttempts: number
  readonly baseDelay: number
  readonly maxDelay: number
  readonly backoffFactor: number
}

export const withErrorHandling = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  context: ErrorContext,
  retryConfig?: RetryConfig
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const logError = (error: E) =>
      Effect.sync(() => {
        console.error('Error in', context.component, context.operation, {
          error,
          context,
          timestamp: context.timestamp
        })
      })
    
    const baseEffect = Effect.tapError(effect, logError)
    
    if (retryConfig) {
      return yield* retryWithBackoff(baseEffect, retryConfig.maxAttempts, retryConfig.baseDelay)
    }
    
    return yield* baseEffect
  })
```

## 4. 特徴的な実装パターン

### Schema-first Development
- @effect/schemaによる型安全なバリデーション
- ランタイム型検証とコンパイル時型安全性の両立
- 外部データの安全な取り込み

### Brand型による型安全性
- プリミティブ型の意味的区別
- ID型の混同防止
- 数値型の用途別区分

### Effect-TS統合ユーティリティ
- 副作用の明示的管理
- エラーハンドリングの統一
- 関数合成による複雑な処理の構築

### 設定駆動アーキテクチャ
- 環境別設定の柔軟な管理
- パフォーマンス調整の容易性
- Feature Flagによる機能制御

Shared層は、アプリケーション全体の一貫性と信頼性を保証する基盤レイヤーとして、型安全性、パフォーマンス、開発者体験の向上に重要な役割を果たします。