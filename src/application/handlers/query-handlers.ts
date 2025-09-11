import { Effect, Layer } from "effect"
import { WorldDomainService } from "../../domain/services/world-domain.service"
import { EntityDomainService } from "../../domain/services/entity-domain.service"
import { PhysicsDomainService } from "../../domain/services/physics-domain.service"

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

import { Context } from "effect"

export class QueryHandlers extends Context.Tag("QueryHandlers")<
  QueryHandlers,
  {
    readonly getPlayerState: (query: PlayerQuery) => Effect.Effect<PlayerQueryResult, Error>
    readonly getChunkState: (query: ChunkQuery) => Effect.Effect<ChunkQueryResult, Error>
    readonly getWorldState: (query: WorldStateQuery) => Effect.Effect<WorldStateQueryResult, Error>
    readonly findEntities: (query: EntityQuery) => Effect.Effect<PlayerQueryResult[], Error>
    readonly getLoadedChunks: () => Effect.Effect<ChunkQueryResult[], Error>
    readonly getNearbyEntities: (
      position: { x: number; y: number; z: number },
      radius: number
    ) => Effect.Effect<PlayerQueryResult[], Error>
  }
>() {}

export const QueryHandlersLive = Layer.succeed(
  QueryHandlers,
  {
    getPlayerState: (query) =>
      Effect.gen(function* (_) {
        const entityService = yield* _(EntityDomainService)
        const physicsService = yield* _(PhysicsDomainService)
        
        // Validate query
        yield* _(validatePlayerQuery(query))
        
        // Get entity data
        const entity = yield* _(entityService.getEntity(query.entityId))
        const position = yield* _(entityService.getEntityPosition(query.entityId))
        const velocity = yield* _(physicsService.getEntityVelocity(query.entityId))
        const isGrounded = yield* _(physicsService.isEntityGrounded(query.entityId))
        
        // Build result
        const result: PlayerQueryResult = {
          entityId: query.entityId,
          position,
          velocity,
          isGrounded,
          health: entity.health || 100,
          inventory: entity.inventory || []
        }
        
        yield* _(Effect.log(`Player state query executed for entity ${query.entityId}`))
        return result
      }),

    getChunkState: (query) =>
      Effect.gen(function* (_) {
        const worldService = yield* _(WorldDomainService)
        
        // Validate query
        yield* _(validateChunkQuery(query))
        
        // Get chunk data
        const isLoaded = yield* _(worldService.isChunkLoaded(query.chunkX, query.chunkZ))
        const chunk = isLoaded ? 
          yield* _(worldService.getChunk(query.chunkX, query.chunkZ)) : null
        
        // Build result
        const result: ChunkQueryResult = {
          chunkX: query.chunkX,
          chunkZ: query.chunkZ,
          isLoaded,
          blocks: chunk?.blocks,
          entities: chunk?.entities,
          lastModified: chunk?.lastModified || 0
        }
        
        yield* _(Effect.log(`Chunk state query executed for chunk ${query.chunkX}, ${query.chunkZ}`))
        return result
      }),

    getWorldState: (query) =>
      Effect.gen(function* (_) {
        const worldService = yield* _(WorldDomainService)
        const entityService = yield* _(EntityDomainService)
        const physicsService = yield* _(PhysicsDomainService)
        
        // Validate query
        yield* _(validateWorldStateQuery(query))
        
        let chunks: ChunkQueryResult[] | undefined
        let entities: PlayerQueryResult[] | undefined
        let physicsObjects: any[] | undefined
        
        // Get chunks if requested
        if (query.includeChunks) {
          const loadedChunks = yield* _(worldService.getLoadedChunks())
          chunks = yield* _(
            Effect.forEach(
              loadedChunks,
              (chunk) => QueryHandlers.getChunkState({ 
                chunkX: chunk.chunkX, 
                chunkZ: chunk.chunkZ 
              }),
              { concurrency: 4 }
            )
          )
        }
        
        // Get entities if requested
        if (query.includeEntities) {
          const allEntities = yield* _(entityService.getAllEntities())
          entities = yield* _(
            Effect.forEach(
              allEntities,
              (entity) => QueryHandlers.getPlayerState({ entityId: entity.id }),
              { concurrency: 4 }
            )
          )
        }
        
        // Get physics objects if requested
        if (query.includePhysics) {
          physicsObjects = yield* _(physicsService.getAllPhysicsObjects())
        }
        
        // Build result
        const result: WorldStateQueryResult = {
          chunks,
          entities,
          physicsObjects,
          timestamp: Date.now()
        }
        
        yield* _(Effect.log("World state query executed"))
        return result
      }),

    findEntities: (query) =>
      Effect.gen(function* (_) {
        const entityService = yield* _(EntityDomainService)
        
        // Validate query
        yield* _(validateEntityQuery(query))
        
        // Find entities based on criteria
        let entities: any[]
        
        if (query.entityId) {
          const entity = yield* _(entityService.getEntity(query.entityId))
          entities = [entity]
        } else if (query.entityType) {
          entities = yield* _(entityService.getEntitiesByType(query.entityType))
        } else if (query.position) {
          entities = yield* _(entityService.getEntitiesInRadius(
            query.position,
            query.position.radius
          ))
        } else {
          entities = yield* _(entityService.getAllEntities())
        }
        
        // Convert to query results
        const results = yield* _(
          Effect.forEach(
            entities,
            (entity) => QueryHandlers.getPlayerState({ entityId: entity.id }),
            { concurrency: 4 }
          )
        )
        
        yield* _(Effect.log(`Entity query executed, found ${results.length} entities`))
        return results
      }),

    getLoadedChunks: () =>
      Effect.gen(function* (_) {
        const worldService = yield* _(WorldDomainService)
        
        const loadedChunks = yield* _(worldService.getLoadedChunks())
        const results = yield* _(
          Effect.forEach(
            loadedChunks,
            (chunk) => QueryHandlers.getChunkState({ 
              chunkX: chunk.chunkX, 
              chunkZ: chunk.chunkZ 
            }),
            { concurrency: 4 }
          )
        )
        
        yield* _(Effect.log(`Loaded chunks query executed, found ${results.length} chunks`))
        return results
      }),

    getNearbyEntities: (position, radius) =>
      Effect.gen(function* (_) {
        const entityService = yield* _(EntityDomainService)
        
        const entities = yield* _(entityService.getEntitiesInRadius(position, radius))
        const results = yield* _(
          Effect.forEach(
            entities,
            (entity) => QueryHandlers.getPlayerState({ entityId: entity.id }),
            { concurrency: 4 }
          )
        )
        
        yield* _(Effect.log(`Nearby entities query executed, found ${results.length} entities`))
        return results
      })
  }
)

// Query validation functions
const validatePlayerQuery = (query: PlayerQuery) =>
  Effect.gen(function* (_) {
    if (!query.entityId) {
      return yield* _(Effect.fail(new Error("Entity ID is required")))
    }
  })

const validateChunkQuery = (query: ChunkQuery) =>
  Effect.gen(function* (_) {
    if (typeof query.chunkX !== 'number' || typeof query.chunkZ !== 'number') {
      return yield* _(Effect.fail(new Error("Valid chunk coordinates are required")))
    }
  })

const validateWorldStateQuery = (query: WorldStateQuery) =>
  Effect.gen(function* (_) {
    // World state query is always valid as all fields are optional
    yield* _(Effect.succeed(undefined))
  })

const validateEntityQuery = (query: EntityQuery) =>
  Effect.gen(function* (_) {
    if (query.position && typeof query.position.radius !== 'number') {
      return yield* _(Effect.fail(new Error("Radius is required when position is specified")))
    }
  })

// Layer dependencies will be provided by the main Application layer