# Domain-Driven Design Principles in TypeScript Minecraft

## Overview

This document outlines how Domain-Driven Design (DDD) principles are applied in the TypeScript Minecraft project, integrated with Effect-TS for functional programming patterns. Our implementation demonstrates a practical application of DDD concepts in a game engine context.

## Core DDD Concepts Applied

### 1. Ubiquitous Language

We've established a consistent vocabulary that spans from business requirements to code implementation:

#### Game Domain Terms

| Term | Definition | Code Representation |
|------|------------|-------------------|
| **Entity** | A unique game object with identity | `EntityId` branded type |
| **Player** | The player character in the game | `Player` entity class |
| **Chunk** | A 16x16x256 block section of the world | `Chunk` aggregate |
| **Block** | A single voxel unit in the world | `Block` value object |
| **World** | The complete game environment | `World` aggregate root |
| **Position** | 3D coordinates in the world | `Position` value object |
| **Archetype** | Template for entity creation | ECS archetype pattern |

#### Technical Domain Terms

| Term | Definition | Code Representation |
|------|------------|-------------------|
| **Query** | ECS data selection pattern | `Query` system |
| **System** | Game logic processor | Effect-based systems |
| **Component** | Data attached to entities | Schema-validated structs |
| **Service** | Domain operation provider | Context.Tag services |

```typescript
// Example: Ubiquitous language in code
export const generateTerrain = (
  chunkCoordinate: ChunkCoordinate,
  worldSeed: WorldSeed
): Effect.Effect<TerrainData, TerrainGenerationError> =>
  Effect.gen(function* () {
    // Business logic uses domain vocabulary
    const heightMap = yield* generateHeightMap(chunkCoordinate, worldSeed)
    const blockDistribution = yield* calculateBlockDistribution(heightMap)
    const terrainFeatures = yield* placeTerrainFeatures(blockDistribution)
    
    return new TerrainData({
      coordinate: chunkCoordinate,
      heightMap,
      blocks: blockDistribution,
      features: terrainFeatures
    })
  })
```

### 2. Bounded Contexts

The codebase is organized into distinct bounded contexts with clear boundaries:

#### World Management Context (`src/domain/services/world-*`)

**Responsibility**: Managing world state, chunk loading, and terrain generation

```typescript
// World bounded context
export interface WorldDomainService {
  readonly generateChunk: (
    coordinate: ChunkCoordinate
  ) => Effect.Effect<Chunk, ChunkGenerationError>
  
  readonly loadChunk: (
    coordinate: ChunkCoordinate
  ) => Effect.Effect<Chunk, ChunkLoadError>
  
  readonly unloadChunk: (
    coordinate: ChunkCoordinate
  ) => Effect.Effect<void, ChunkUnloadError>
}
```

#### Entity Management Context (`src/domain/services/entity-*`)

**Responsibility**: Entity lifecycle, component management, and ECS operations

```typescript
// Entity bounded context
export interface EntityDomainService {
  readonly createEntity: (
    archetype: Archetype
  ) => Effect.Effect<EntityId, EntityCreationError>
  
  readonly addComponent: <C extends ComponentName>(
    entityId: EntityId,
    componentName: C,
    component: ComponentOfName<C>
  ) => Effect.Effect<void, ComponentError>
  
  readonly removeEntity: (
    entityId: EntityId
  ) => Effect.Effect<void, EntityRemovalError>
}
```

#### Physics Context (`src/domain/services/physics-*`)

**Responsibility**: Physics simulation, collision detection, and movement

```typescript
// Physics bounded context
export interface PhysicsDomainService {
  readonly simulateMotion: (
    entity: MovableEntity,
    deltaTime: number
  ) => Effect.Effect<PhysicsState, PhysicsError>
  
  readonly detectCollisions: (
    entities: readonly EntityId[]
  ) => Effect.Effect<readonly Collision[], CollisionError>
}
```

#### Rendering Context (`src/domain/ports/render.port.ts`)

**Responsibility**: Visual representation and graphics (defined as port in domain)

```typescript
// Rendering bounded context (port)
export interface RenderPort {
  readonly createMesh: (
    geometry: GeometryData,
    material: MaterialData
  ) => Effect.Effect<MeshId, RenderError>
  
  readonly updateMesh: (
    meshId: MeshId,
    updates: MeshUpdates
  ) => Effect.Effect<void, RenderError>
}
```

### 3. Aggregates and Aggregate Roots

We've identified key aggregates that maintain consistency boundaries:

#### World Aggregate

**Aggregate Root**: `World`
**Entities**: `Chunk`, `TerrainFeature`
**Value Objects**: `ChunkCoordinate`, `WorldSeed`

```typescript
export class World extends Data.Class<{
  readonly seed: WorldSeed
  readonly loadedChunks: ReadonlyMap<string, Chunk>
  readonly activeEntities: ReadonlySet<EntityId>
}> {
  static readonly schema = S.Struct({
    seed: WorldSeedSchema,
    loadedChunks: S.Record(S.String, ChunkSchema),
    activeEntities: S.Array(EntityIdSchema)
  })
  
  // Aggregate maintains consistency
  loadChunk(coordinate: ChunkCoordinate): Effect.Effect<World, ChunkLoadError> {
    return Effect.gen(function* () {
      const chunk = yield* generateOrLoadChunk(coordinate, this.seed)
      const newLoadedChunks = new Map(this.loadedChunks).set(
        coordinate.toString(),
        chunk
      )
      
      return new World({
        ...this,
        loadedChunks: newLoadedChunks
      })
    })
  }
  
  // Aggregate enforces business rules
  canPlaceBlock(position: Position, blockType: BlockType): boolean {
    const chunkCoord = ChunkCoordinate.fromPosition(position)
    const chunk = this.loadedChunks.get(chunkCoord.toString())
    
    if (!chunk) return false
    
    // Business rule: Can't place blocks in bedrock layer
    if (position.y === 0) return false
    
    // Business rule: Can't place blocks in water
    const currentBlock = chunk.getBlockAt(position)
    if (currentBlock.type === BlockType.Water) return false
    
    return true
  }
}
```

#### Chunk Aggregate

**Aggregate Root**: `Chunk`
**Entities**: `Block` (when dynamic)
**Value Objects**: `Position`, `BlockType`, `TerrainData`

```typescript
export class Chunk extends Data.Class<{
  readonly coordinate: ChunkCoordinate
  readonly blocks: Uint8Array
  readonly heightMap: Uint8Array
  readonly entities: ReadonlySet<EntityId>
  readonly lastModified: Date
}> {
  // Aggregate ensures chunk integrity
  setBlock(
    localPosition: Position,
    blockType: BlockType
  ): Effect.Effect<Chunk, InvalidPositionError> {
    return Effect.gen(function* () {
      // Validate position is within chunk bounds
      yield* validateLocalPosition(localPosition)
      
      const index = this.getBlockIndex(localPosition)
      const newBlocks = new Uint8Array(this.blocks)
      newBlocks[index] = blockType.id
      
      return new Chunk({
        ...this,
        blocks: newBlocks,
        lastModified: new Date()
      })
    })
  }
  
  private getBlockIndex(position: Position): number {
    return position.x + 
           position.z * CHUNK_SIZE + 
           position.y * CHUNK_SIZE * CHUNK_SIZE
  }
}
```

### 4. Domain Services

Domain services encapsulate business logic that doesn't naturally fit in entities or value objects:

#### Terrain Generation Service

```typescript
export interface TerrainGenerationDomainService {
  readonly generateTerrain: (
    coordinate: ChunkCoordinate,
    seed: WorldSeed,
    biome: BiomeType
  ) => Effect.Effect<TerrainData, TerrainGenerationError>
}

export const terrainGenerationDomainServiceLive = Layer.effect(
  TerrainGenerationDomainService,
  Effect.gen(function* () {
    return TerrainGenerationDomainService.of({
      generateTerrain: (coordinate, seed, biome) =>
        Effect.gen(function* () {
          // Complex terrain generation logic
          const heightMap = yield* generateHeightMap(coordinate, seed)
          const caveSystem = yield* generateCaves(coordinate, seed)
          const oreDistribution = yield* generateOres(coordinate, seed, biome)
          
          const blocks = yield* combineLayers(
            heightMap,
            caveSystem,
            oreDistribution,
            biome
          )
          
          return new TerrainData({
            coordinate,
            heightMap,
            blocks,
            caves: caveSystem,
            ores: oreDistribution
          })
        })
    })
  })
)
```

#### Entity Creation Service

```typescript
export interface EntityCreationDomainService {
  readonly createPlayer: (
    name: string,
    spawnPosition: Position
  ) => Effect.Effect<EntityId, PlayerCreationError>
  
  readonly createBlock: (
    position: Position,
    blockType: BlockType
  ) => Effect.Effect<EntityId, BlockCreationError>
}

export const entityCreationDomainServiceLive = Layer.effect(
  EntityCreationDomainService,
  Effect.gen(function* () {
    const entityService = yield* EntityDomainService
    
    return EntityCreationDomainService.of({
      createPlayer: (name, spawnPosition) =>
        Effect.gen(function* () {
          // Validate player name
          yield* validatePlayerName(name)
          
          // Validate spawn position
          yield* validateSpawnPosition(spawnPosition)
          
          // Create entity with player components
          const entityId = yield* entityService.createEntity(PLAYER_ARCHETYPE)
          
          yield* entityService.addComponent(
            entityId,
            'position',
            new Position(spawnPosition)
          )
          
          yield* entityService.addComponent(
            entityId,
            'player',
            new Player({ name, health: 100, inventory: [] })
          )
          
          return entityId
        }),
        
      createBlock: (position, blockType) =>
        Effect.gen(function* () {
          // Validate block placement rules
          yield* validateBlockPlacement(position, blockType)
          
          const entityId = yield* entityService.createEntity(BLOCK_ARCHETYPE)
          
          yield* entityService.addComponent(
            entityId,
            'position',
            new Position(position)
          )
          
          yield* entityService.addComponent(
            entityId,
            'block',
            new Block({ type: blockType })
          )
          
          return entityId
        })
    })
  })
)
```

### 5. Value Objects

Value objects represent concepts with no identity - they are defined by their attributes:

#### Position Value Object

```typescript
export class Position extends Data.Class<{
  readonly x: number
  readonly y: number
  readonly z: number
}> {
  static readonly schema = S.Struct({
    x: S.Number.pipe(S.finite()),
    y: S.Number.pipe(S.between(0, 255)),
    z: S.Number.pipe(S.finite())
  })
  
  // Value objects can contain business logic
  translate(dx: number, dy: number, dz: number): Position {
    return new Position({
      x: this.x + dx,
      y: this.y + dy,
      z: this.z + dz
    })
  }
  
  distanceTo(other: Position): number {
    const dx = this.x - other.x
    const dy = this.y - other.y
    const dz = this.z - other.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }
  
  isWithinChunk(chunkCoord: ChunkCoordinate): boolean {
    const chunkX = Math.floor(this.x / CHUNK_SIZE)
    const chunkZ = Math.floor(this.z / CHUNK_SIZE)
    return chunkX === chunkCoord.x && chunkZ === chunkCoord.z
  }
  
  toChunkCoordinate(): ChunkCoordinate {
    return new ChunkCoordinate({
      x: Math.floor(this.x / CHUNK_SIZE),
      z: Math.floor(this.z / CHUNK_SIZE)
    })
  }
}
```

#### Velocity Value Object

```typescript
export class Velocity extends Data.Class<{
  readonly dx: number
  readonly dy: number
  readonly dz: number
}> {
  static readonly schema = S.Struct({
    dx: S.Number.pipe(S.finite()),
    dy: S.Number.pipe(S.finite()),
    dz: S.Number.pipe(S.finite())
  })
  
  static readonly ZERO = new Velocity({ dx: 0, dy: 0, dz: 0 })
  
  magnitude(): number {
    return Math.sqrt(this.dx * this.dx + this.dy * this.dy + this.dz * this.dz)
  }
  
  normalize(): Velocity {
    const mag = this.magnitude()
    if (mag === 0) return Velocity.ZERO
    
    return new Velocity({
      dx: this.dx / mag,
      dy: this.dy / mag,
      dz: this.dz / mag
    })
  }
  
  scale(factor: number): Velocity {
    return new Velocity({
      dx: this.dx * factor,
      dy: this.dy * factor,
      dz: this.dz * factor
    })
  }
  
  add(other: Velocity): Velocity {
    return new Velocity({
      dx: this.dx + other.dx,
      dy: this.dy + other.dy,
      dz: this.dz + other.dz
    })
  }
}
```

### 6. Domain Events

Domain events capture important business happenings:

```typescript
// Domain events
export class ChunkLoadedEvent extends Data.Class<{
  readonly chunkCoordinate: ChunkCoordinate
  readonly timestamp: Date
  readonly loadTime: number
}> {
  static readonly schema = S.Struct({
    chunkCoordinate: ChunkCoordinateSchema,
    timestamp: S.Date,
    loadTime: S.Number.pipe(S.positive())
  })
}

export class PlayerMovedEvent extends Data.Class<{
  readonly playerId: EntityId
  readonly fromPosition: Position
  readonly toPosition: Position
  readonly timestamp: Date
}> {
  static readonly schema = S.Struct({
    playerId: EntityIdSchema,
    fromPosition: PositionSchema,
    toPosition: PositionSchema,
    timestamp: S.Date
  })
}

export class BlockPlacedEvent extends Data.Class<{
  readonly playerId: EntityId
  readonly position: Position
  readonly blockType: BlockType
  readonly timestamp: Date
}> {
  static readonly schema = S.Struct({
    playerId: EntityIdSchema,
    position: PositionSchema,
    blockType: BlockTypeSchema,
    timestamp: S.Date
  })
}

// Event handling service
export interface DomainEventService {
  readonly publish: <E extends DomainEvent>(
    event: E
  ) => Effect.Effect<void, EventPublishError>
  
  readonly subscribe: <E extends DomainEvent>(
    eventType: string,
    handler: (event: E) => Effect.Effect<void, EventHandlerError>
  ) => Effect.Effect<void, SubscriptionError>
}
```

### 7. Repositories (as Ports)

Repositories are defined as domain ports and implemented in infrastructure:

```typescript
// Domain port
export interface ChunkRepository {
  readonly find: (
    coordinate: ChunkCoordinate
  ) => Effect.Effect<Option.Option<Chunk>, never>
  
  readonly save: (
    chunk: Chunk
  ) => Effect.Effect<void, ChunkSaveError>
  
  readonly findByRegion: (
    centerCoord: ChunkCoordinate,
    radius: number
  ) => Effect.Effect<readonly Chunk[], never>
  
  readonly delete: (
    coordinate: ChunkCoordinate
  ) => Effect.Effect<void, ChunkDeleteError>
}

export const ChunkRepository = Context.GenericTag<ChunkRepository>('ChunkRepository')
```

### 8. Specification Pattern

We use specifications for complex business rules:

```typescript
// Block placement specifications
export interface BlockPlacementSpecification {
  readonly isSatisfiedBy: (
    position: Position,
    blockType: BlockType,
    world: World
  ) => Effect.Effect<boolean, ValidationError>
}

export const validHeightSpecification: BlockPlacementSpecification = {
  isSatisfiedBy: (position, blockType, world) =>
    Effect.succeed(position.y >= 0 && position.y <= 255)
}

export const notInWaterSpecification: BlockPlacementSpecification = {
  isSatisfiedBy: (position, blockType, world) =>
    Effect.gen(function* () {
      const chunkCoord = position.toChunkCoordinate()
      const chunk = yield* world.getChunk(chunkCoord)
      const currentBlock = chunk.getBlockAt(position)
      return currentBlock.type !== BlockType.Water
    })
}

export const playerOwnershipSpecification: BlockPlacementSpecification = {
  isSatisfiedBy: (position, blockType, world) =>
    Effect.gen(function* () {
      // Business rule: Players can only place blocks in their territory
      const territory = yield* world.getTerritoryAt(position)
      const currentPlayer = yield* world.getCurrentPlayer()
      return territory.ownerId === currentPlayer.id
    })
}

// Composite specification
export const blockPlacementSpecification = andSpecification([
  validHeightSpecification,
  notInWaterSpecification,
  playerOwnershipSpecification
])
```

## Architectural Patterns

### 1. Hexagonal Architecture (Ports and Adapters)

The domain defines ports (interfaces) that are implemented by adapters in the infrastructure layer:

```typescript
// Domain port
export interface TerrainGeneratorPort {
  readonly generateHeightMap: (
    coordinate: ChunkCoordinate,
    seed: number
  ) => Effect.Effect<Float32Array, TerrainGenerationError>
}

// Infrastructure adapter
export const simplexNoiseTerrainAdapter: TerrainGeneratorPort = {
  generateHeightMap: (coordinate, seed) =>
    Effect.gen(function* () {
      const noise = new SimplexNoise(seed)
      const heightMap = new Float32Array(CHUNK_SIZE * CHUNK_SIZE)
      
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const worldX = coordinate.x * CHUNK_SIZE + x
          const worldZ = coordinate.z * CHUNK_SIZE + z
          
          const height = noise.noise2D(worldX * 0.01, worldZ * 0.01) * 50 + 128
          heightMap[x + z * CHUNK_SIZE] = Math.max(0, Math.min(255, height))
        }
      }
      
      return heightMap
    })
}
```

### 2. CQRS (Command Query Responsibility Segregation)

Commands and queries are separated with different models:

```typescript
// Commands (write side)
export interface PlaceBlockCommand {
  readonly playerId: EntityId
  readonly position: Position
  readonly blockType: BlockType
}

export const placeBlockHandler = (
  command: PlaceBlockCommand
): Effect.Effect<void, BlockPlacementError, WorldService | ValidationService> =>
  Effect.gen(function* () {
    const world = yield* WorldService
    const validation = yield* ValidationService
    
    // Validate command
    yield* validation.validateBlockPlacement(
      command.position,
      command.blockType
    )
    
    // Execute command
    yield* world.placeBlock(command.position, command.blockType)
    
    // Publish event
    yield* publishDomainEvent(new BlockPlacedEvent({
      playerId: command.playerId,
      position: command.position,
      blockType: command.blockType,
      timestamp: new Date()
    }))
  })

// Queries (read side)
export interface GetChunkQuery {
  readonly coordinate: ChunkCoordinate
}

export const getChunkHandler = (
  query: GetChunkQuery
): Effect.Effect<ChunkView, ChunkNotFoundError, ChunkQueryService> =>
  Effect.gen(function* () {
    const queryService = yield* ChunkQueryService
    const chunk = yield* queryService.getChunk(query.coordinate)
    
    return new ChunkView({
      coordinate: chunk.coordinate,
      blockCount: chunk.blocks.length,
      entityCount: chunk.entities.size,
      lastModified: chunk.lastModified
    })
  })
```

### 3. Event Sourcing (Limited Application)

For critical entities, we maintain an event log:

```typescript
export class PlayerEventStore {
  readonly events: readonly PlayerEvent[]
  
  static fromEvents(events: readonly PlayerEvent[]): Player {
    return events.reduce(
      (player, event) => this.applyEvent(player, event),
      Player.initial()
    )
  }
  
  private static applyEvent(player: Player, event: PlayerEvent): Player {
    return Match.value(event).pipe(
      Match.when(PlayerCreatedEvent, (e) =>
        new Player({
          id: e.playerId,
          name: e.name,
          position: e.spawnPosition,
          health: 100,
          inventory: []
        })
      ),
      Match.when(PlayerMovedEvent, (e) =>
        new Player({
          ...player,
          position: e.toPosition
        })
      ),
      Match.when(PlayerHealthChangedEvent, (e) =>
        new Player({
          ...player,
          health: e.newHealth
        })
      ),
      Match.orElse(() => player)
    )
  }
}
```

## Effect-TS Integration with DDD

### 1. Domain Services as Effect Services

```typescript
export const worldDomainServiceLive = Layer.effect(
  WorldDomainService,
  Effect.gen(function* () {
    const chunkRepo = yield* ChunkRepository
    const terrainGen = yield* TerrainGeneratorPort
    const eventBus = yield* DomainEventService
    
    return WorldDomainService.of({
      loadChunk: (coordinate) =>
        Effect.gen(function* () {
          // Try to load from repository
          const existing = yield* chunkRepo.find(coordinate)
          
          if (Option.isSome(existing)) {
            return existing.value
          }
          
          // Generate new chunk
          const terrainData = yield* terrainGen.generateTerrain(coordinate)
          const chunk = Chunk.fromTerrain(coordinate, terrainData)
          
          // Save and publish event
          yield* chunkRepo.save(chunk)
          yield* eventBus.publish(new ChunkLoadedEvent({
            chunkCoordinate: coordinate,
            timestamp: new Date(),
            loadTime: Date.now() - startTime
          }))
          
          return chunk
        })
    })
  })
)
```

### 2. Aggregate Error Handling

```typescript
export class World extends Data.Class<{...}> {
  placeBlock(
    position: Position,
    blockType: BlockType
  ): Effect.Effect<World, WorldError> {
    return Effect.gen(function* () {
      // Domain validation
      const canPlace = this.canPlaceBlock(position, blockType)
      if (!canPlace) {
        return yield* Effect.fail(
          new InvalidBlockPlacementError({
            position,
            blockType,
            reason: 'Block placement violates game rules'
          })
        )
      }
      
      // Get chunk
      const chunkCoord = position.toChunkCoordinate()
      const chunk = this.loadedChunks.get(chunkCoord.toString())
      
      if (!chunk) {
        return yield* Effect.fail(
          new ChunkNotLoadedError({
            coordinate: chunkCoord,
            operation: 'placeBlock'
          })
        )
      }
      
      // Update chunk
      const updatedChunk = yield* chunk.setBlock(position, blockType)
      const newLoadedChunks = new Map(this.loadedChunks).set(
        chunkCoord.toString(),
        updatedChunk
      )
      
      return new World({
        ...this,
        loadedChunks: newLoadedChunks
      })
    })
  }
}
```

## Testing DDD Components

### 1. Domain Logic Testing

```typescript
describe('World Domain Logic', () => {
  it.effect('should prevent block placement in bedrock layer', () =>
    Effect.gen(function* () {
      const world = createTestWorld()
      const bedrockPosition = new Position({ x: 10, y: 0, z: 10 })
      
      const result = yield* world.placeBlock(
        bedrockPosition,
        BlockType.Stone
      ).pipe(Effect.either)
      
      expect(result._tag).toBe('Left')
      expect(result.left).toBeInstanceOf(InvalidBlockPlacementError)
    })
  )
  
  it.effect('should allow valid block placement', () =>
    Effect.gen(function* () {
      const world = createTestWorld()
      const validPosition = new Position({ x: 10, y: 64, z: 10 })
      
      const updatedWorld = yield* world.placeBlock(
        validPosition,
        BlockType.Stone
      )
      
      expect(updatedWorld).toBeInstanceOf(World)
      expect(updatedWorld.getBlockAt(validPosition).type).toBe(BlockType.Stone)
    })
  )
})
```

### 2. Integration Testing

```typescript
describe('Chunk Loading Integration', () => {
  it.effect('should load chunk with all dependencies', () =>
    Effect.gen(function* () {
      const worldService = yield* WorldDomainService
      const coordinate = new ChunkCoordinate({ x: 0, z: 0 })
      
      const chunk = yield* worldService.loadChunk(coordinate)
      
      expect(chunk.coordinate).toEqual(coordinate)
      expect(chunk.blocks).toHaveLength(CHUNK_SIZE ** 3)
      expect(chunk.heightMap).toHaveLength(CHUNK_SIZE ** 2)
    }).pipe(
      Effect.provide(TestWorldLayer)
    )
  )
})
```

## Benefits Achieved

### 1. Clear Separation of Concerns

- **Domain Logic**: Pure business rules without technical dependencies
- **Application Logic**: Use case orchestration
- **Infrastructure**: Technical implementations
- **Presentation**: User interface concerns

### 2. Testability

- Pure functions enable easy unit testing
- Clear dependency injection through Effect Context
- Mock services for isolated testing

### 3. Maintainability

- Consistent patterns across the codebase
- Clear boundaries between components
- Self-documenting code through ubiquitous language

### 4. Performance

- Structure of Arrays for ECS performance
- Lazy loading and efficient caching
- Worker-based computation offloading

### 5. Type Safety

- Comprehensive Effect-TS type system
- Runtime validation with schemas
- Branded types for domain safety

## Common Pitfalls and Solutions

### 1. Anemic Domain Model

**Problem**: Domain entities with no behavior, all logic in services

```typescript
// ❌ Anemic model
export class Position extends Data.Class<{
  readonly x: number
  readonly y: number
  readonly z: number
}> {}

export class PositionService {
  distanceBetween(pos1: Position, pos2: Position): number {
    return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2)
  }
}
```

**Solution**: Rich domain model with behavior

```typescript
// ✅ Rich domain model
export class Position extends Data.Class<{
  readonly x: number
  readonly y: number
  readonly z: number
}> {
  distanceTo(other: Position): number {
    return Math.sqrt(
      (this.x - other.x) ** 2 + 
      (this.y - other.y) ** 2 + 
      (this.z - other.z) ** 2
    )
  }
  
  isAdjacentTo(other: Position): boolean {
    return this.distanceTo(other) === 1
  }
}
```

### 2. Leaky Abstractions

**Problem**: Domain layer depending on infrastructure concerns

```typescript
// ❌ Infrastructure leakage
import * as THREE from 'three'

export class Position extends Data.Class<{...}> {
  toThreeVector(): THREE.Vector3 {  // Infrastructure dependency!
    return new THREE.Vector3(this.x, this.y, this.z)
  }
}
```

**Solution**: Port/Adapter pattern

```typescript
// ✅ Clean abstraction
export interface Vector3Port {
  readonly x: number
  readonly y: number
  readonly z: number
}

export class Position extends Data.Class<{...}> {
  toVector3(): Vector3Port {
    return { x: this.x, y: this.y, z: this.z }
  }
}

// Infrastructure adapter
export const toThreeVector = (vector: Vector3Port): THREE.Vector3 =>
  new THREE.Vector3(vector.x, vector.y, vector.z)
```

### 3. God Objects

**Problem**: Aggregates that try to do too much

**Solution**: Split into bounded contexts with clear responsibilities

## Future Enhancements

### 1. Advanced Domain Patterns

- **Saga Pattern**: For complex multi-aggregate transactions
- **Domain Event Sourcing**: For audit trails and temporal queries
- **Strategic Design**: Identifying additional bounded contexts

### 2. Performance Optimizations

- **Aggregate Snapshots**: For large aggregates
- **Read Models**: Optimized query projections
- **Event Replay**: For debugging and testing

### 3. Distributed Concerns

- **Context Mapping**: For microservices boundaries
- **Anti-Corruption Layers**: For external system integration
- **Shared Kernels**: For common domain concepts

---

This DDD implementation in TypeScript Minecraft demonstrates how functional programming with Effect-TS can be combined with domain-driven design to create a maintainable, testable, and performant game engine architecture.