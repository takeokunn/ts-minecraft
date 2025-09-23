---
title: 'Comprehensive Effect-TS Migration Guide'
description: 'Complete step-by-step guide for migrating existing TypeScript projects to Effect-TS with real-world examples, patterns, and troubleshooting'
category: 'migration'
difficulty: 'intermediate-advanced'
tags: ['effect-ts', 'migration', 'schema', 'brand-types', 'functional-programming', 'typescript']
prerequisites: ['typescript-advanced', 'functional-programming-basics', 'effect-ts-fundamentals']
estimated_reading_time: '45分'
related_docs:
  [
    '../development/effect-ts-migration-guide.md',
    '../../tutorials/effect-ts-fundamentals/effect-ts-basics.md',
    '../../reference/api/effect-ts-schema-api.md',
  ]
ai_context:
  primary_concepts:
    [
      'effect-ts-migration',
      'schema-conversion',
      'brand-type-migration',
      'error-handling-migration',
      'performance-optimization',
    ]
  complexity_level: 4
  learning_outcomes: ['Complete project migration', 'Performance optimization', 'Type safety enhancement', 'Error handling improvement']
machine_readable:
  confidence_score: 0.97
  api_maturity: 'stable'
  execution_time: 'long'
---

# Comprehensive Effect-TS Migration Guide

## 🎯 Migration Overview

**⏱️ 読了時間**: 45分 | **👤 対象**: TypeScript開発者（Effect-TS移行予定）

This guide provides a complete migration path from traditional TypeScript to Effect-TS, based on real-world experience from migrating a complex Minecraft clone project.

> 📍 **Migration Path**: **[Planning Phase]** → **[Core Migration]** → **[Optimization]** → **[Testing & Validation]**

## 1. Pre-Migration Planning

### 1.1 Project Assessment

Before starting the migration, evaluate your project's readiness:

```bash
# Project compatibility check
npx tsc --noEmit --strict  # Ensure strict TypeScript compliance
npm audit                  # Check for security vulnerabilities
npm outdated              # Identify outdated dependencies

# Measure current performance baseline
npm run test:coverage     # Document current test coverage
npm run build             # Record build times
npm run test:performance  # If available, benchmark performance
```

**Migration Readiness Checklist:**
- [ ] TypeScript 4.9+ with strict mode enabled
- [ ] Comprehensive test suite (>80% coverage recommended)
- [ ] Clear error handling patterns
- [ ] Minimal use of `any` types
- [ ] Team familiarity with functional programming concepts

### 1.2 Migration Strategy

Choose your migration approach:

**🔄 Incremental Migration (Recommended)**
- Migrate module by module
- Maintain compatibility during transition
- Lower risk, easier rollback
- Allows team to learn gradually

**⚡ Big Bang Migration**
- Migrate entire codebase at once
- Faster overall timeline
- Higher risk, requires more planning
- Better for smaller projects

## 2. Core Type System Migration

### 2.1 Interface to Schema.Struct Conversion

Transform TypeScript interfaces into Effect-TS schemas for runtime validation:

```typescript
// ❌ Before: Traditional TypeScript interface
interface Player {
  id: string
  name: string
  position: {
    x: number
    y: number
    z: number
  }
  health: number
  lastUpdate: Date
}

// ✅ After: Effect-TS Schema with validation
import { Schema } from 'effect'

export const PlayerSchema = Schema.Struct({
  id: Schema.String.pipe(
    Schema.nonEmpty(),
    Schema.brand('PlayerId')
  ),
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(50)
  ),
  position: Schema.Struct({
    x: Schema.Number.pipe(Schema.finite()),
    y: Schema.Number.pipe(Schema.finite()),
    z: Schema.Number.pipe(Schema.finite())
  }),
  health: Schema.Number.pipe(
    Schema.between(0, 100),
    Schema.brand('Health')
  ),
  lastUpdate: Schema.DateFromSelf
})

export type Player = Schema.Schema.Type<typeof PlayerSchema>
```

**Key Benefits:**
- Runtime validation automatically included
- Better error messages with context
- Automatic type inference
- Serialization/deserialization built-in

### 2.2 Primitive Types to Brand Types

Convert primitive types to branded types for enhanced type safety:

```typescript
// ❌ Before: Plain primitives (error-prone)
function movePlayer(playerId: string, x: number, y: number, z: number) {
  // Easy to mix up parameter order
  updatePosition(playerId, x, y, z)
}

// ✅ After: Branded types (type-safe)
import { Schema } from 'effect'

// Define branded types
export const PlayerId = Schema.String.pipe(
  Schema.nonEmpty(),
  Schema.brand('PlayerId')
)
export type PlayerId = Schema.Schema.Type<typeof PlayerId>

export const WorldCoordinate = Schema.Number.pipe(
  Schema.finite(),
  Schema.brand('WorldCoordinate')
)
export type WorldCoordinate = Schema.Schema.Type<typeof WorldCoordinate>

export const Vector3D = Schema.Struct({
  x: WorldCoordinate,
  y: WorldCoordinate,
  z: WorldCoordinate
}).pipe(Schema.brand('Vector3D'))
export type Vector3D = Schema.Schema.Type<typeof Vector3D>

// Type-safe function signature
function movePlayer(playerId: PlayerId, position: Vector3D): Effect.Effect<void, PlayerError> {
  // Impossible to mix up parameters now
  return updatePosition(playerId, position)
}

// Safe creation helpers
export const BrandedTypes = {
  createPlayerId: (id: string): PlayerId =>
    Schema.decodeSync(PlayerId)(id),

  createVector3D: (x: number, y: number, z: number): Vector3D =>
    Schema.decodeSync(Vector3D)({
      x: Schema.decodeSync(WorldCoordinate)(x),
      y: Schema.decodeSync(WorldCoordinate)(y),
      z: Schema.decodeSync(WorldCoordinate)(z)
    })
}
```

### 2.3 Arrays to ReadonlyArray and Collections

Migrate mutable arrays to immutable collections:

```typescript
// ❌ Before: Mutable arrays
class GameState {
  private players: Player[] = []
  private entities: Entity[] = []

  addPlayer(player: Player) {
    this.players.push(player) // Mutation can cause bugs
  }

  getPlayers(): Player[] {
    return this.players // Exposes internal state
  }
}

// ✅ After: Immutable collections with Effect-TS
import { Effect, ReadonlyArray, HashMap } from 'effect'

interface GameStateService {
  readonly players: ReadonlyArray<Player>
  readonly entitiesById: HashMap.HashMap<EntityId, Entity>

  readonly addPlayer: (player: Player) => Effect.Effect<void, GameStateError>
  readonly getPlayers: () => Effect.Effect<ReadonlyArray<Player>, never>
  readonly findPlayer: (id: PlayerId) => Effect.Effect<Option.Option<Player>, never>
}

// Implementation with immutable operations
const addPlayer = (player: Player) =>
  Effect.gen(function* () {
    const currentState = yield* getCurrentState
    const newPlayers = ReadonlyArray.append(currentState.players, player)
    yield* updateState({ ...currentState, players: newPlayers })
  })

const findPlayer = (id: PlayerId) =>
  Effect.gen(function* () {
    const players = yield* getPlayers()
    return ReadonlyArray.findFirst(players, p => p.id === id)
  })

// Functional array operations
const processAllPlayers = (processor: (player: Player) => Effect.Effect<ProcessedPlayer, ProcessingError>) =>
  Effect.gen(function* () {
    const players = yield* getPlayers()
    return yield* Effect.forEach(players, processor, { concurrency: 'unbounded' })
  })
```

### 2.4 Function Signatures Migration

Transform function signatures to use Effect types:

```typescript
// ❌ Before: Promise-based with limited error information
async function savePlayerData(player: Player): Promise<boolean> {
  try {
    await database.save(player)
    return true
  } catch (error) {
    console.error('Save failed:', error)
    return false // Lost error context
  }
}

async function loadPlayerData(id: string): Promise<Player | null> {
  try {
    const data = await database.findById(id)
    return data ? new Player(data) : null
  } catch (error) {
    console.error('Load failed:', error)
    return null // Lost error context
  }
}

// ✅ After: Effect-based with comprehensive error handling
import { Effect, Context } from 'effect'

// Define service dependencies
interface DatabaseService {
  readonly save: (player: Player) => Effect.Effect<void, DatabaseError>
  readonly findById: (id: PlayerId) => Effect.Effect<Option.Option<PlayerData>, DatabaseError>
}
const DatabaseService = Context.GenericTag<DatabaseService>('DatabaseService')

// Define comprehensive error types
export const PlayerError = Schema.TaggedError('PlayerError')({
  reason: Schema.Literal('NOT_FOUND', 'VALIDATION_FAILED', 'DATABASE_ERROR'),
  playerId: Schema.optional(PlayerId),
  details: Schema.String,
  cause: Schema.optional(Schema.Unknown)
})
export type PlayerError = Schema.Schema.Type<typeof PlayerError>

// Effect-based implementations with full error context
const savePlayerData = (player: Player) =>
  Effect.gen(function* () {
    // Validate player data
    const validatedPlayer = yield* Schema.decodeUnknown(PlayerSchema)(player)

    // Save to database
    const database = yield* DatabaseService
    yield* database.save(validatedPlayer)

    // Return success (void)
  }).pipe(
    Effect.mapError(error =>
      PlayerError({
        reason: 'DATABASE_ERROR',
        playerId: player.id,
        details: 'Failed to save player data',
        cause: error
      })
    )
  )

const loadPlayerData = (id: PlayerId) =>
  Effect.gen(function* () {
    const database = yield* DatabaseService

    const playerDataOption = yield* database.findById(id)

    if (Option.isNone(playerDataOption)) {
      return yield* Effect.fail(PlayerError({
        reason: 'NOT_FOUND',
        playerId: id,
        details: `Player with ID ${id} not found`
      }))
    }

    const playerData = playerDataOption.value
    const player = yield* Schema.decodeUnknown(PlayerSchema)(playerData)

    return player
  })

// Type signatures are now explicit about success and failure cases
// savePlayerData: (player: Player) => Effect.Effect<void, PlayerError, DatabaseService>
// loadPlayerData: (id: PlayerId) => Effect.Effect<Player, PlayerError, DatabaseService>
```

## 3. Common Migration Patterns

### 3.1 Configuration and Environment Variables

```typescript
// ❌ Before: Unsafe environment variable handling
const config = {
  port: parseInt(process.env.PORT || '3000'),
  dbUrl: process.env.DATABASE_URL || 'localhost',
  logLevel: process.env.LOG_LEVEL || 'info'
}

// ✅ After: Validated configuration with schemas
const ConfigSchema = Schema.Struct({
  port: Schema.Number.pipe(
    Schema.between(1, 65535),
    Schema.annotations({ description: 'Server port number' })
  ),
  dbUrl: Schema.String.pipe(
    Schema.nonEmpty(),
    Schema.annotations({ description: 'Database connection URL' })
  ),
  logLevel: Schema.Literal('debug', 'info', 'warn', 'error').pipe(
    Schema.annotations({ description: 'Logging level' })
  )
})
export type Config = Schema.Schema.Type<typeof ConfigSchema>

const loadConfig = Effect.gen(function* () {
  const rawConfig = {
    port: parseInt(process.env.PORT || '3000'),
    dbUrl: process.env.DATABASE_URL || '',
    logLevel: process.env.LOG_LEVEL || 'info'
  }

  const config = yield* Schema.decodeUnknown(ConfigSchema)(rawConfig)
  return config
}).pipe(
  Effect.mapError(error => new ConfigurationError({
    message: 'Invalid configuration',
    details: error.message
  }))
)

// Usage with dependency injection
const ConfigService = Context.GenericTag<Config>('Config')

const createServer = Effect.gen(function* () {
  const config = yield* ConfigService
  // Use validated config...
})
```

### 3.2 Error Handling Consolidation

```typescript
// ❌ Before: Inconsistent error handling
class PlayerService {
  async createPlayer(data: any): Promise<Player> {
    if (!data.name) {
      throw new Error('Name is required')
    }

    if (await this.playerExists(data.id)) {
      throw new PlayerExistsError('Player already exists')
    }

    try {
      return await this.database.create(data)
    } catch (dbError) {
      throw new Error('Database error: ' + dbError.message)
    }
  }
}

// ✅ After: Unified error handling with tagged errors
const PlayerServiceError = Schema.TaggedError('PlayerServiceError')({
  type: Schema.Literal('VALIDATION', 'ALREADY_EXISTS', 'DATABASE', 'NOT_FOUND'),
  message: Schema.String,
  playerId: Schema.optional(PlayerId),
  details: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
})
export type PlayerServiceError = Schema.Schema.Type<typeof PlayerServiceError>

const createPlayer = (data: unknown) =>
  Effect.gen(function* () {
    // Validate input data
    const playerData = yield* Schema.decodeUnknown(CreatePlayerSchema)(data)

    // Check if player exists
    const exists = yield* playerExists(playerData.id)
    if (exists) {
      return yield* Effect.fail(PlayerServiceError({
        type: 'ALREADY_EXISTS',
        message: 'Player already exists',
        playerId: playerData.id
      }))
    }

    // Create player
    const database = yield* DatabaseService
    const player = yield* database.create(playerData)

    return player
  }).pipe(
    Effect.mapError(error => {
      // Convert any unexpected errors to PlayerServiceError
      if (error._tag === 'PlayerServiceError') return error

      return PlayerServiceError({
        type: 'DATABASE',
        message: 'Failed to create player',
        details: { originalError: error }
      })
    })
  )

// Centralized error handling for HTTP endpoints
const handlePlayerServiceError = (error: PlayerServiceError) =>
  Match.value(error.type).pipe(
    Match.when('VALIDATION', () => ({ status: 400, body: { error: error.message } })),
    Match.when('ALREADY_EXISTS', () => ({ status: 409, body: { error: error.message } })),
    Match.when('NOT_FOUND', () => ({ status: 404, body: { error: error.message } })),
    Match.when('DATABASE', () => ({ status: 500, body: { error: 'Internal server error' } })),
    Match.exhaustive
  )
```

### 3.3 Async Operations and Resource Management

```typescript
// ❌ Before: Manual resource management
class DatabaseConnection {
  private connection: any

  async connect() {
    this.connection = await createConnection()
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.close()
    }
  }

  async query(sql: string) {
    if (!this.connection) {
      throw new Error('Not connected')
    }
    return this.connection.query(sql)
  }
}

// Manual cleanup (error-prone)
const processData = async () => {
  const db = new DatabaseConnection()
  try {
    await db.connect()
    const result = await db.query('SELECT * FROM players')
    return result
  } finally {
    await db.disconnect() // Easy to forget or fail
  }
}

// ✅ After: Automatic resource management with Effect
import { Effect, Layer, Scope } from 'effect'

interface DatabaseService {
  readonly query: (sql: string) => Effect.Effect<QueryResult, DatabaseError>
}
const DatabaseService = Context.GenericTag<DatabaseService>('DatabaseService')

// Automatic resource management with Scope
const makeDatabaseService = Effect.gen(function* () {
  const connection = yield* Effect.acquireRelease(
    // Acquire
    Effect.tryPromise({
      try: () => createConnection(),
      catch: (error) => new DatabaseError({ message: 'Connection failed', cause: error })
    }),
    // Release (automatically called on scope exit)
    (connection) => Effect.promise(() => connection.close())
  )

  return {
    query: (sql: string) =>
      Effect.tryPromise({
        try: () => connection.query(sql),
        catch: (error) => new DatabaseError({ message: 'Query failed', cause: error })
      })
  }
})

// Layer provides scoped service
const DatabaseServiceLive = Layer.scoped(DatabaseService, makeDatabaseService)

// Usage with automatic cleanup
const processData = Effect.gen(function* () {
  const database = yield* DatabaseService
  const result = yield* database.query('SELECT * FROM players')
  return result
  // Connection automatically closed when effect completes
}).pipe(Layer.provide(DatabaseServiceLive))
```

## 4. Performance Considerations

### 4.1 Schema Validation Optimization

```typescript
// Performance-optimized validation strategies
import { Duration } from 'effect'

// Strategy 1: Cached validation for hot paths
const createCachedValidator = <A, I>(schema: Schema.Schema<A, I>) => {
  const cache = new Map<string, { result: A; timestamp: number }>()
  const CACHE_TTL = 5000 // 5 seconds

  return {
    validate: (input: I, cacheKey?: string) =>
      Effect.gen(function* () {
        if (cacheKey) {
          const cached = cache.get(cacheKey)
          if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.result
          }
        }

        const result = yield* Schema.decodeUnknown(schema)(input)

        if (cacheKey) {
          cache.set(cacheKey, { result, timestamp: Date.now() })
        }

        return result
      }),

    clearCache: () => Effect.sync(() => cache.clear())
  }
}

// Strategy 2: Conditional validation based on environment
const createConditionalValidator = <A, I>(
  schema: Schema.Schema<A, I>,
  environment: 'development' | 'production' | 'test'
) => {
  const shouldValidate = environment !== 'production'

  return {
    validate: (input: I) =>
      shouldValidate
        ? Schema.decodeUnknown(schema)(input)
        : Effect.succeed(input as A) // Trust input in production
  }
}

// Strategy 3: Timeout-based validation for game loops
const createTimeoutValidator = <A, I>(
  schema: Schema.Schema<A, I>,
  timeoutMs: number = 16 // 60 FPS budget
) => ({
  validate: (input: I) =>
    Schema.decodeUnknown(schema)(input).pipe(
      Effect.timeout(Duration.millis(timeoutMs)),
      Effect.mapError(error =>
        error._tag === 'TimeoutException'
          ? new ValidationTimeoutError({ timeoutMs })
          : error
      )
    )
})

// Usage example: Game entity validation
const gameEntityValidator = createTimeoutValidator(PlayerPositionSchema, 5)

const updatePlayerPosition = (playerId: PlayerId, position: unknown) =>
  Effect.gen(function* () {
    // Fast validation with timeout
    const validPosition = yield* gameEntityValidator.validate(position)

    // Update position
    yield* setPlayerPosition(playerId, validPosition)
  })
```

### 4.2 Batch Operations

```typescript
// Efficient batch processing with Effect
const processBatchEfficiently = <A, B, E>(
  items: ReadonlyArray<A>,
  processor: (item: A) => Effect.Effect<B, E>,
  options: {
    concurrency?: number
    batchSize?: number
  } = {}
) => {
  const { concurrency = 10, batchSize = 100 } = options

  return Effect.gen(function* () {
    const batches = ReadonlyArray.chunksOf(items, batchSize)
    const results: B[] = []

    for (const batch of batches) {
      const batchResults = yield* Effect.forEach(
        batch,
        processor,
        { concurrency }
      )
      results.push(...batchResults)
    }

    return results
  })
}

// Example: Batch player validation
const validatePlayers = (playerData: ReadonlyArray<unknown>) =>
  processBatchEfficiently(
    playerData,
    (data) => Schema.decodeUnknown(PlayerSchema)(data),
    { concurrency: 20, batchSize: 50 }
  )
```

## 5. Troubleshooting Common Issues

### 5.1 Type Errors and Inference Issues

```typescript
// ❌ Problem: Complex type inference failures
const complexOperation = Effect.gen(function* () {
  const data = yield* someEffect // Type inference fails
  const processed = yield* processData(data) // Error: unknown type
  return processed
})

// ✅ Solution: Explicit type annotations
const complexOperation = Effect.gen(function* () {
  const data: ExpectedDataType = yield* someEffect
  const processed = yield* processData(data)
  return processed
})

// ✅ Alternative: Type assertion with validation
const complexOperation = Effect.gen(function* () {
  const data = yield* someEffect
  const validatedData = yield* Schema.decodeUnknown(ExpectedDataSchema)(data)
  const processed = yield* processData(validatedData)
  return processed
})
```

### 5.2 Error Handling Migrations

```typescript
// ❌ Problem: Mixing Promise and Effect error handling
const mixedErrorHandling = async () => {
  try {
    const result = await Effect.runPromise(someEffect)
    return result
  } catch (error) {
    // Lost Effect error information
    console.error('Something failed:', error)
    throw error
  }
}

// ✅ Solution: Consistent Effect error handling
const consistentErrorHandling = Effect.gen(function* () {
  const result = yield* someEffect
  return result
}).pipe(
  Effect.catchAll(error =>
    Effect.gen(function* () {
      yield* logError('Operation failed', error)
      return yield* Effect.fail(new OperationError({ cause: error }))
    })
  )
)

// Converting to Promise only at the boundary
const handleRequest = (req: Request, res: Response) => {
  const program = consistentErrorHandling.pipe(
    Effect.match({
      onFailure: (error) => ({ status: 500, body: { error: error.message } }),
      onSuccess: (data) => ({ status: 200, body: data })
    })
  )

  Effect.runPromise(program).then(response => {
    res.status(response.status).json(response.body)
  })
}
```

### 5.3 Performance Issues

```typescript
// ❌ Problem: Excessive validation in hot paths
const gameLoop = Effect.gen(function* () {
  for (let i = 0; i < 1000; i++) {
    const entity = entities[i]
    // Validating every frame = performance killer
    const validatedPosition = yield* Schema.decodeUnknown(PositionSchema)(entity.position)
    yield* updateEntityPosition(entity.id, validatedPosition)
  }
})

// ✅ Solution: Smart validation strategies
const optimizedGameLoop = Effect.gen(function* () {
  // Pre-validate once or use cached validation
  const validator = createCachedValidator(PositionSchema)

  yield* Effect.forEach(
    entities,
    (entity) => Effect.gen(function* () {
      // Use cached validation with entity ID as key
      const validatedPosition = yield* validator.validate(
        entity.position,
        `position_${entity.id}`
      )
      yield* updateEntityPosition(entity.id, validatedPosition)
    }),
    { concurrency: 'unbounded' } // Parallel processing
  )
})

// Alternative: Validation boundaries
const boundaryValidation = Effect.gen(function* () {
  // Validate only at service boundaries
  const trustedEntities = entities // Already validated at input

  yield* Effect.forEach(
    trustedEntities,
    (entity) => updateEntityPosition(entity.id, entity.position),
    { concurrency: 'unbounded' }
  )
})
```

### 5.4 Memory Management

```typescript
// ❌ Problem: Memory leaks from unbounded caches
const leakyCache = new Map<string, any>()

const cacheResult = (key: string, result: any) => {
  leakyCache.set(key, result) // Never cleared
}

// ✅ Solution: Bounded cache with TTL
const createBoundedCache = <K, V>(maxSize: number, ttlMs: number) => {
  const cache = new Map<K, { value: V; timestamp: number }>()

  const cleanup = () => {
    const now = Date.now()
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > ttlMs) {
        cache.delete(key)
      }
    }

    // If still too big, remove oldest entries
    if (cache.size > maxSize) {
      const entries = Array.from(cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)

      const toRemove = entries.slice(0, cache.size - maxSize)
      toRemove.forEach(([key]) => cache.delete(key))
    }
  }

  return {
    set: (key: K, value: V) => Effect.sync(() => {
      cache.set(key, { value, timestamp: Date.now() })
      cleanup()
    }),

    get: (key: K) => Effect.sync(() => {
      const entry = cache.get(key)
      if (!entry || Date.now() - entry.timestamp > ttlMs) {
        cache.delete(key)
        return Option.none()
      }
      return Option.some(entry.value)
    }),

    clear: () => Effect.sync(() => cache.clear())
  }
}
```

## 6. Real-World Migration Example

Based on the Minecraft clone project, here's a complete service migration:

```typescript
// ❌ Before: Traditional service
class PlayerService {
  private players = new Map<string, Player>()

  async createPlayer(data: any): Promise<Player> {
    if (!data.name || typeof data.name !== 'string') {
      throw new Error('Invalid name')
    }

    if (this.players.has(data.id)) {
      throw new Error('Player exists')
    }

    const player = new Player(data)
    this.players.set(player.id, player)

    await this.saveToDatabase(player)
    return player
  }

  async getPlayer(id: string): Promise<Player | null> {
    const player = this.players.get(id)
    if (!player) {
      try {
        const loaded = await this.loadFromDatabase(id)
        if (loaded) {
          this.players.set(id, loaded)
          return loaded
        }
      } catch (error) {
        console.error('Failed to load player:', error)
      }
    }
    return player || null
  }
}

// ✅ After: Effect-TS service
import { Effect, Context, Layer, ReadonlyRecord } from 'effect'

// Domain schemas (from real codebase)
export const PlayerSchema = Schema.Struct({
  id: Schema.String.pipe(
    Schema.nonEmpty(),
    Schema.brand('PlayerId')
  ),
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(50)
  ),
  position: Schema.Struct({
    x: Schema.Number.pipe(Schema.finite(), Schema.brand('WorldCoordinate')),
    y: Schema.Number.pipe(Schema.finite(), Schema.brand('WorldCoordinate')),
    z: Schema.Number.pipe(Schema.finite(), Schema.brand('WorldCoordinate'))
  }).pipe(Schema.brand('Vector3D')),
  health: Schema.Number.pipe(
    Schema.between(0, 100),
    Schema.brand('Health')
  ),
  isActive: Schema.Boolean,
  lastUpdate: Schema.DateFromSelf
})

export type Player = Schema.Schema.Type<typeof PlayerSchema>
export type PlayerId = Player['id']

// Error types
export const PlayerError = Schema.TaggedError('PlayerError')({
  reason: Schema.Literal(
    'PLAYER_NOT_FOUND',
    'PLAYER_ALREADY_EXISTS',
    'INVALID_DATA',
    'DATABASE_ERROR'
  ),
  message: Schema.String,
  playerId: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown)
})
export type PlayerError = Schema.Schema.Type<typeof PlayerError>

// Service interface
interface PlayerService {
  readonly createPlayer: (data: unknown) => Effect.Effect<Player, PlayerError>
  readonly getPlayer: (id: PlayerId) => Effect.Effect<Player, PlayerError>
  readonly updatePlayer: (id: PlayerId, updates: Partial<Player>) => Effect.Effect<Player, PlayerError>
  readonly deletePlayer: (id: PlayerId) => Effect.Effect<void, PlayerError>
  readonly getAllPlayers: () => Effect.Effect<ReadonlyArray<Player>, never>
}

const PlayerService = Context.GenericTag<PlayerService>('PlayerService')

// Dependencies
interface DatabaseService {
  readonly save: (player: Player) => Effect.Effect<void, DatabaseError>
  readonly load: (id: PlayerId) => Effect.Effect<Option.Option<Player>, DatabaseError>
  readonly delete: (id: PlayerId) => Effect.Effect<void, DatabaseError>
}
const DatabaseService = Context.GenericTag<DatabaseService>('DatabaseService')

// Implementation
const makePlayerService = Effect.gen(function* () {
  const database = yield* DatabaseService
  const players = new Map<PlayerId, Player>()

  const createPlayer = (data: unknown) =>
    Effect.gen(function* () {
      // Validate input
      const playerData = yield* Schema.decodeUnknown(PlayerSchema)(data).pipe(
        Effect.mapError(error => PlayerError({
          reason: 'INVALID_DATA',
          message: 'Invalid player data',
          cause: error
        }))
      )

      // Check if exists
      if (players.has(playerData.id)) {
        return yield* Effect.fail(PlayerError({
          reason: 'PLAYER_ALREADY_EXISTS',
          message: 'Player already exists',
          playerId: playerData.id
        }))
      }

      // Save to database
      yield* database.save(playerData).pipe(
        Effect.mapError(error => PlayerError({
          reason: 'DATABASE_ERROR',
          message: 'Failed to save player',
          playerId: playerData.id,
          cause: error
        }))
      )

      // Cache locally
      players.set(playerData.id, playerData)
      return playerData
    })

  const getPlayer = (id: PlayerId) =>
    Effect.gen(function* () {
      // Check cache first
      const cached = players.get(id)
      if (cached) {
        return cached
      }

      // Load from database
      const playerOption = yield* database.load(id).pipe(
        Effect.mapError(error => PlayerError({
          reason: 'DATABASE_ERROR',
          message: 'Failed to load player',
          playerId: id,
          cause: error
        }))
      )

      if (Option.isNone(playerOption)) {
        return yield* Effect.fail(PlayerError({
          reason: 'PLAYER_NOT_FOUND',
          message: 'Player not found',
          playerId: id
        }))
      }

      const player = playerOption.value
      players.set(id, player)
      return player
    })

  const updatePlayer = (id: PlayerId, updates: Partial<Player>) =>
    Effect.gen(function* () {
      const currentPlayer = yield* getPlayer(id)
      const updatedPlayer = { ...currentPlayer, ...updates }

      // Validate updated player
      const validatedPlayer = yield* Schema.decodeUnknown(PlayerSchema)(updatedPlayer).pipe(
        Effect.mapError(error => PlayerError({
          reason: 'INVALID_DATA',
          message: 'Invalid update data',
          playerId: id,
          cause: error
        }))
      )

      // Save to database
      yield* database.save(validatedPlayer).pipe(
        Effect.mapError(error => PlayerError({
          reason: 'DATABASE_ERROR',
          message: 'Failed to update player',
          playerId: id,
          cause: error
        }))
      )

      // Update cache
      players.set(id, validatedPlayer)
      return validatedPlayer
    })

  const deletePlayer = (id: PlayerId) =>
    Effect.gen(function* () {
      yield* database.delete(id).pipe(
        Effect.mapError(error => PlayerError({
          reason: 'DATABASE_ERROR',
          message: 'Failed to delete player',
          playerId: id,
          cause: error
        }))
      )

      players.delete(id)
    })

  const getAllPlayers = () =>
    Effect.succeed(Array.from(players.values()))

  return {
    createPlayer,
    getPlayer,
    updatePlayer,
    deletePlayer,
    getAllPlayers
  } satisfies PlayerService
})

// Service layer
export const PlayerServiceLive = Layer.effect(PlayerService, makePlayerService)

// Usage example
const createAndGetPlayer = Effect.gen(function* () {
  const playerService = yield* PlayerService

  const newPlayer = yield* playerService.createPlayer({
    id: 'player1',
    name: 'Steve',
    position: { x: 0, y: 64, z: 0 },
    health: 100,
    isActive: true,
    lastUpdate: new Date()
  })

  console.log('Created player:', newPlayer)

  const retrievedPlayer = yield* playerService.getPlayer(newPlayer.id)
  console.log('Retrieved player:', retrievedPlayer)

  return retrievedPlayer
}).pipe(
  Layer.provide(PlayerServiceLive),
  Layer.provide(DatabaseServiceLive) // Provide database implementation
)
```

## 7. Testing Migration

```typescript
// Effect-TS test patterns for migrated code
import { Effect, Layer, Context } from 'effect'
import { describe, it, expect } from 'vitest'

describe('PlayerService', () => {
  // Mock database service for testing
  const MockDatabaseService = Layer.succeed(DatabaseService, {
    save: () => Effect.succeed(void 0),
    load: (id) => Effect.succeed(Option.some(mockPlayer)),
    delete: () => Effect.succeed(void 0)
  })

  const TestRuntime = Layer.provide(PlayerServiceLive, MockDatabaseService)

  it('should create player successfully', async () => {
    const program = Effect.gen(function* () {
      const service = yield* PlayerService
      const player = yield* service.createPlayer({
        id: 'test-player',
        name: 'Test Player',
        position: { x: 0, y: 0, z: 0 },
        health: 100,
        isActive: true,
        lastUpdate: new Date()
      })

      expect(player.name).toBe('Test Player')
      return player
    })

    const result = await Effect.runPromise(program.pipe(Layer.provide(TestRuntime)))
    expect(result.id).toBe('test-player')
  })

  it('should handle invalid data', async () => {
    const program = Effect.gen(function* () {
      const service = yield* PlayerService
      return yield* service.createPlayer({
        id: '', // Invalid empty ID
        name: 'Test Player'
      })
    })

    const result = await Effect.runPromiseExit(program.pipe(Layer.provide(TestRuntime)))
    expect(Exit.isFailure(result)).toBe(true)

    if (Exit.isFailure(result)) {
      const error = result.error
      expect(error.reason).toBe('INVALID_DATA')
    }
  })
})
```

## 8. Migration Checklist

### Phase 1: Foundation (Week 1-2)
- [ ] Install Effect-TS dependencies (`effect`, `@effect/schema`, `@effect/platform`)
- [ ] Configure TypeScript strict mode
- [ ] Set up basic project structure for schemas and errors
- [ ] Create first few domain schemas (most important entities)
- [ ] Define core error types with TaggedError

### Phase 2: Core Domain (Week 3-4)
- [ ] Migrate all domain interfaces to Schema.Struct
- [ ] Convert primitive types to branded types
- [ ] Replace arrays with ReadonlyArray/HashMap where appropriate
- [ ] Update function signatures to return Effect types
- [ ] Implement basic service layer with Context

### Phase 3: Infrastructure (Week 5-6)
- [ ] Migrate database layer to Effect-based operations
- [ ] Implement resource management with Layer/Scope
- [ ] Add configuration validation
- [ ] Set up logging service with Effect integration
- [ ] Implement caching strategies

### Phase 4: Optimization & Testing (Week 7-8)
- [ ] Add performance monitoring for critical paths
- [ ] Implement validation strategies (caching, conditional, timeout)
- [ ] Write comprehensive test suite with Effect testing patterns
- [ ] Add error boundary handling for HTTP endpoints
- [ ] Performance tune hot paths (game loops, frequent operations)

### Phase 5: Production Readiness (Week 9-10)
- [ ] Add observability (tracing, metrics)
- [ ] Implement graceful error handling throughout
- [ ] Documentation and team training
- [ ] Gradual rollout strategy
- [ ] Monitor performance in production

## 9. Success Metrics

### Technical Metrics
- **Type Safety**: Zero TypeScript strict mode warnings
- **Runtime Safety**: All inputs validated at service boundaries
- **Error Handling**: 100% of errors are typed and trackable
- **Performance**: No regression in critical path performance
- **Test Coverage**: Maintain or improve existing coverage

### Development Experience
- **Compile-time Error Detection**: Earlier problem discovery
- **Refactoring Safety**: Confident large-scale changes
- **API Clarity**: Self-documenting function signatures
- **Debugging**: Comprehensive error context

## 10. Conclusion

Effect-TS migration transforms your TypeScript codebase into a more robust, type-safe, and maintainable system. The key to successful migration is:

1. **Incremental Approach**: Migrate piece by piece, maintaining functionality
2. **Schema First**: Start with data validation to catch issues early
3. **Error Handling**: Invest in comprehensive error types for better debugging
4. **Performance Monitoring**: Ensure migration doesn't impact critical performance
5. **Team Training**: Ensure team understands functional programming concepts

The migration effort pays dividends through improved reliability, easier testing, and better developer experience. The Minecraft clone project successfully migrated while maintaining 60FPS performance and adding comprehensive type safety.

## 11. Additional Resources

- **Effect-TS Official Documentation**: [https://effect.website/](https://effect.website/)
- **Schema API Reference**: [Effect-TS Schema Documentation](https://effect.website/docs/schema)
- **Project-Specific Patterns**: See `src/shared/types/` for real-world branded type examples
- **Performance Benchmarks**: See `src/shared/performance/__test__/migration-benchmarks.spec.ts`
- **Migration Examples**: Review existing services in `src/domain/` for patterns

---

*This guide is based on real-world migration experience from a complex TypeScript game engine to Effect-TS, maintaining performance while dramatically improving type safety and error handling.*