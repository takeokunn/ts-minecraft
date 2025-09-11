import { Effect, Layer, Context } from 'effect'
import { WorldDomainService, EntityDomainService, PhysicsDomainService } from '@/domain/services'

// Query types
export interface PlayerQuery {
  readonly entityId: string
}

export interface ChunkQuery {
  readonly chunkX: number
  readonly chunkZ: number
}

export interface WorldStateQuery {
  readonly includeChunks?: boolean
  readonly includeEntities?: boolean
  readonly includePhysics?: boolean
}

export interface EntityQuery {
  readonly entityId?: string
  readonly entityType?: string
  readonly position?: { x: number; y: number; z: number; radius: number }
}

// Query result types
export interface PlayerQueryResult {
  readonly entityId: string
  readonly position: { x: number; y: number; z: number }
  readonly velocity: { dx: number; dy: number; dz: number }
  readonly isGrounded: boolean
  readonly health: number
  readonly inventory: any[]
}

export interface ChunkQueryResult {
  readonly chunkX: number
  readonly chunkZ: number
  readonly isLoaded: boolean
  readonly blocks?: any[]
  readonly entities?: string[]
  readonly lastModified: number
}

export interface WorldStateQueryResult {
  readonly chunks?: ChunkQueryResult[]
  readonly entities?: PlayerQueryResult[]
  readonly physicsObjects?: any[]
  readonly timestamp: number
}

// Service interface
interface QueryHandlersService {
  readonly getPlayerState: (query: PlayerQuery) => Effect.Effect<PlayerQueryResult, Error, WorldDomainService | EntityDomainService | PhysicsDomainService>
  readonly getChunkState: (query: ChunkQuery) => Effect.Effect<ChunkQueryResult, Error, WorldDomainService>
  readonly getWorldState: (query: WorldStateQuery) => Effect.Effect<WorldStateQueryResult, Error, WorldDomainService | EntityDomainService | PhysicsDomainService>
  readonly findEntities: (query: EntityQuery) => Effect.Effect<PlayerQueryResult[], Error, EntityDomainService>
  readonly getLoadedChunks: () => Effect.Effect<ChunkQueryResult[], Error, WorldDomainService>
  readonly getNearbyEntities: (position: { x: number; y: number; z: number }, radius: number) => Effect.Effect<PlayerQueryResult[], Error, EntityDomainService>
}

export class QueryHandlers extends Context.Tag('QueryHandlers')<QueryHandlers, QueryHandlersService>() {}

export const QueryHandlersLive = Layer.succeed(QueryHandlers, {
  getPlayerState: (query: PlayerQuery): Effect.Effect<PlayerQueryResult, Error, WorldDomainService | EntityDomainService | PhysicsDomainService> =>
    Effect.gen(function* () {
      const entityService = yield* EntityDomainService
      const physicsService = yield* PhysicsDomainService

      // Validate query
      yield* validatePlayerQuery(query)

      // Get entity data
      const entity = yield* entityService.getEntity(query.entityId)
      const position = yield* entityService.getEntityPosition(query.entityId)
      const velocity = yield* physicsService.getEntityVelocity(query.entityId)
      const isGrounded = yield* physicsService.isEntityGrounded(query.entityId)

      // Build result
      const result: PlayerQueryResult = {
        entityId: query.entityId,
        position,
        velocity,
        isGrounded,
        health: entity.health || 100,
        inventory: entity.inventory || [],
      }

      yield* Effect.log(`Player state query executed for entity ${query.entityId}`)
      return result
    }),

  getChunkState: (query: ChunkQuery): Effect.Effect<ChunkQueryResult, Error, WorldDomainService> =>
    Effect.gen(function* () {
      const worldService = yield* WorldDomainService

      // Validate query
      yield* validateChunkQuery(query)

      // Get chunk data
      const isLoaded = yield* worldService.isChunkLoaded(query.chunkX, query.chunkZ)
      const chunk = isLoaded ? yield* worldService.getChunk(query.chunkX, query.chunkZ) : null

      // Build result
      const result: ChunkQueryResult = {
        chunkX: query.chunkX,
        chunkZ: query.chunkZ,
        isLoaded,
        blocks: chunk?.blocks || [],
        entities: chunk?.entities || [],
        lastModified: chunk?.lastUpdate || 0,
      }

      yield* Effect.log(`Chunk state query executed for chunk ${query.chunkX}, ${query.chunkZ}`)
      return result
    }),

  getWorldState: (query: WorldStateQuery): Effect.Effect<WorldStateQueryResult, Error, WorldDomainService | EntityDomainService | PhysicsDomainService> =>
    Effect.gen(function* () {
      // Create self-reference for recursive calls
      const self = yield* QueryHandlers

      // Validate query
      yield* validateWorldStateQuery(query)

      let chunks: ChunkQueryResult[] | undefined
      let entities: PlayerQueryResult[] | undefined
      let physicsObjects: any[] | undefined

      // Get chunks if requested
      if (query.includeChunks) {
        const worldService = yield* WorldDomainService
        const loadedChunks = yield* worldService.getLoadedChunks()
        chunks = yield* Effect.forEach(
          loadedChunks,
          (chunk) =>
            self.getChunkState({
              chunkX: chunk.coordinate.x,
              chunkZ: chunk.coordinate.z,
            }),
          { concurrency: 4 },
        )
      }

      // Get entities if requested
      if (query.includeEntities) {
        const entityService = yield* EntityDomainService
        const allEntities = yield* entityService.getAllEntities()
        entities = yield* Effect.forEach(allEntities, (entity) => self.getPlayerState({ entityId: entity.id }), { concurrency: 4 })
      }

      // Get physics objects if requested
      if (query.includePhysics) {
        const physicsService = yield* PhysicsDomainService
        physicsObjects = yield* physicsService.getAllPhysicsObjects()
      }

      // Build result
      const result: WorldStateQueryResult = {
        chunks,
        entities,
        physicsObjects,
        timestamp: Date.now(),
      }

      yield* Effect.log('World state query executed')
      return result
    }),

  findEntities: (query: EntityQuery): Effect.Effect<PlayerQueryResult[], Error, EntityDomainService> =>
    Effect.gen(function* () {
      const entityService = yield* EntityDomainService
      const self = yield* QueryHandlers

      // Validate query
      yield* validateEntityQuery(query)

      // Find entities based on criteria
      let entities: any[]

      if (query.entityId) {
        const entity = yield* entityService.getEntity(query.entityId)
        entities = [entity]
      } else if (query.entityType) {
        entities = yield* entityService.getEntitiesByType(query.entityType)
      } else if (query.position) {
        entities = yield* entityService.getEntitiesInRadius(query.position, query.position.radius)
      } else {
        entities = yield* entityService.getAllEntities()
      }

      // Convert to query results
      const results = yield* Effect.forEach(entities, (entity) => self.getPlayerState({ entityId: entity.id }), { concurrency: 4 })

      yield* Effect.log(`Entity query executed, found ${results.length} entities`)
      return results
    }),

  getLoadedChunks: (): Effect.Effect<ChunkQueryResult[], Error, WorldDomainService> =>
    Effect.gen(function* () {
      const worldService = yield* WorldDomainService
      const self = yield* QueryHandlers

      const loadedChunks = yield* worldService.getLoadedChunks()
      const results = yield* Effect.forEach(
        loadedChunks,
        (chunk) =>
          self.getChunkState({
            chunkX: chunk.coordinate.x,
            chunkZ: chunk.coordinate.z,
          }),
        { concurrency: 4 },
      )

      yield* Effect.log(`Loaded chunks query executed, found ${results.length} chunks`)
      return results
    }),

  getNearbyEntities: (position: { x: number; y: number; z: number }, radius: number): Effect.Effect<PlayerQueryResult[], Error, EntityDomainService> =>
    Effect.gen(function* () {
      const entityService = yield* EntityDomainService
      const self = yield* QueryHandlers

      const entities = yield* entityService.getEntitiesInRadius(position, radius)
      const results = yield* Effect.forEach(entities, (entity) => self.getPlayerState({ entityId: entity.id }), { concurrency: 4 })

      yield* Effect.log(`Nearby entities query executed, found ${results.length} entities`)
      return results
    }),
})

// Query validation functions
const validatePlayerQuery = (query: PlayerQuery): Effect.Effect<void, Error, never> =>
  Effect.gen(function* () {
    if (!query.entityId) {
      return yield* Effect.fail(new Error('Entity ID is required'))
    }
  })

const validateChunkQuery = (query: ChunkQuery): Effect.Effect<void, Error, never> =>
  Effect.gen(function* () {
    if (typeof query.chunkX !== 'number' || typeof query.chunkZ !== 'number') {
      return yield* Effect.fail(new Error('Valid chunk coordinates are required'))
    }
  })

const validateWorldStateQuery = (query: WorldStateQuery): Effect.Effect<void, Error, never> =>
  Effect.gen(function* () {
    // World state query is always valid as all fields are optional
    yield* Effect.succeed(undefined)
  })

const validateEntityQuery = (query: EntityQuery): Effect.Effect<void, Error, never> =>
  Effect.gen(function* () {
    if (query.position && typeof query.position.radius !== 'number') {
      return yield* Effect.fail(new Error('Radius is required when position is specified'))
    }
  })

// Layer dependencies will be provided by the main Application layer
