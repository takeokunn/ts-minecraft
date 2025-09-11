import { Effect, Array } from 'effect'
import { EntityId } from '@/core/entities/entity'
import { ComponentName, ComponentOfName } from '@/core/components'
import { EffectObjectPool, createEffectPool, PoolableObject } from '@/core/performance'
import { MemoryDetector, Profile } from '@/core/performance'

/**
 * Entity Pool for efficient entity lifecycle management
 */
export interface PoolableEntity extends PoolableObject {
  readonly id: EntityId
  readonly components: Set<ComponentName>
  readonly active: boolean
  
  activate(id: EntityId): this
  deactivate(): this
  addComponent(component: ComponentName): this
  removeComponent(component: ComponentName): this
  hasComponent(component: ComponentName): boolean
  getComponents(): ReadonlyArray<ComponentName>
}

export class ManagedEntity implements PoolableEntity {
  public id: EntityId = '' as EntityId
  public components: Set<ComponentName> = new Set()
  public active: boolean = false
  
  activate(id: EntityId): this {
    this.id = id
    this.active = true
    return this
  }
  
  deactivate(): this {
    this.active = false
    this.components.clear()
    return this
  }
  
  addComponent(component: ComponentName): this {
    this.components.add(component)
    return this
  }
  
  removeComponent(component: ComponentName): this {
    this.components.delete(component)
    return this
  }
  
  hasComponent(component: ComponentName): boolean {
    return this.components.has(component)
  }
  
  getComponents(): ReadonlyArray<ComponentName> {
    return Array.fromIterable(this.components)
  }
  
  reset(): void {
    this.id = '' as EntityId
    this.components.clear()
    this.active = false
  }
}

/**
 * Component Pool for efficient component lifecycle management
 */
export interface PoolableComponent<T extends ComponentName> extends PoolableObject {
  readonly name: T
  readonly entityId: EntityId
  
  initialize(entityId: EntityId, data: Partial<ComponentOfName<T>>): this
  getData(): ComponentOfName<T>
  setData(data: Partial<ComponentOfName<T>>): this
}

export class ManagedComponent<T extends ComponentName> implements PoolableComponent<T> {
  public name: T
  public entityId: EntityId = '' as EntityId
  private data: any = {}
  
  constructor(componentName: T, defaultData: ComponentOfName<T>) {
    this.name = componentName
    this.data = { ...defaultData }
  }
  
  initialize(entityId: EntityId, data: Partial<ComponentOfName<T>>): this {
    this.entityId = entityId
    this.data = { ...this.data, ...data, name: this.name }
    return this
  }
  
  getData(): ComponentOfName<T> {
    return { ...this.data }
  }
  
  setData(data: Partial<ComponentOfName<T>>): this {
    this.data = { ...this.data, ...data }
    return this
  }
  
  reset(): void {
    this.entityId = '' as EntityId
    // Keep the component structure but reset values to defaults
    const defaultComponent = { name: this.name } as ComponentOfName<T>
    this.data = { ...defaultComponent }
  }
}

/**
 * Particle System Pool for visual effects
 */
export interface PoolableParticle extends PoolableObject {
  readonly id: string
  
  initialize(
    id: string,
    position: { x: number; y: number; z: number },
    velocity: { x: number; y: number; z: number },
    life: number,
    type: string
  ): this
  
  update(deltaTime: number): boolean // returns false when particle should be removed
  getPosition(): { x: number; y: number; z: number }
  getVelocity(): { x: number; y: number; z: number }
  isAlive(): boolean
}

export class ManagedParticle implements PoolableParticle {
  public id: string = ''
  private position = { x: 0, y: 0, z: 0 }
  private velocity = { x: 0, y: 0, z: 0 }
  private life = 0
  private _maxLife = 0
  private _type = ''
  
  initialize(
    id: string,
    position: { x: number; y: number; z: number },
    velocity: { x: number; y: number; z: number },
    life: number,
    type: string
  ): this {
    this.id = id
    this.position = { ...position }
    this.velocity = { ...velocity }
    this.life = life
    this._maxLife = life
    this._type = type
    return this
  }
  
  update(deltaTime: number): boolean {
    this.position.x += this.velocity.x * deltaTime
    this.position.y += this.velocity.y * deltaTime
    this.position.z += this.velocity.z * deltaTime
    
    // Apply gravity
    this.velocity.y -= 9.81 * deltaTime
    
    this.life -= deltaTime
    return this.life > 0
  }
  
  getPosition(): { x: number; y: number; z: number } {
    return { ...this.position }
  }
  
  getVelocity(): { x: number; y: number; z: number } {
    return { ...this.velocity }
  }
  
  isAlive(): boolean {
    return this.life > 0
  }
  
  reset(): void {
    this.id = ''
    this.position = { x: 0, y: 0, z: 0 }
    this.velocity = { x: 0, y: 0, z: 0 }
    this.life = 0
    this.maxLife = 0
    this.type = ''
  }
}

/**
 * Chunk Data Pool for terrain management
 */
export interface PoolableChunkData extends PoolableObject {
  readonly chunkX: number
  readonly chunkZ: number
  
  initialize(
    chunkX: number, 
    chunkZ: number, 
    voxelData: Uint16Array,
    lightData?: Uint8Array
  ): this
  
  getVoxelData(): Uint16Array
  getLightData(): Uint8Array | undefined
  setVoxelData(data: Uint16Array): this
  setLightData(data: Uint8Array): this
}

export class ManagedChunkData implements PoolableChunkData {
  public chunkX: number = 0
  public chunkZ: number = 0
  private voxelData: Uint16Array = new Uint16Array(0)
  private lightData?: Uint8Array
  
  initialize(
    chunkX: number, 
    chunkZ: number, 
    voxelData: Uint16Array,
    lightData?: Uint8Array
  ): this {
    this.chunkX = chunkX
    this.chunkZ = chunkZ
    this.voxelData = new Uint16Array(voxelData)
    this.lightData = lightData ? new Uint8Array(lightData) : undefined
    return this
  }
  
  getVoxelData(): Uint16Array {
    return this.voxelData
  }
  
  getLightData(): Uint8Array | undefined {
    return this.lightData
  }
  
  setVoxelData(data: Uint16Array): this {
    this.voxelData = new Uint16Array(data)
    return this
  }
  
  setLightData(data: Uint8Array): this {
    this.lightData = new Uint8Array(data)
    return this
  }
  
  reset(): void {
    this.chunkX = 0
    this.chunkZ = 0
    this.voxelData = new Uint16Array(0)
    this.lightData = undefined
  }
}

/**
 * Memory Pool Manager - coordinates all pools
 */
export interface MemoryPoolManager {
  readonly entityPool: EffectObjectPool<PoolableEntity>
  readonly componentPools: Map<ComponentName, EffectObjectPool<PoolableComponent<any>>>
  readonly particlePool: EffectObjectPool<PoolableParticle>
  readonly chunkDataPool: EffectObjectPool<PoolableChunkData>
  
  // Entity management
  readonly acquireEntity: (id: EntityId) => Effect.Effect<PoolableEntity, never, never>
  readonly releaseEntity: (entity: PoolableEntity) => Effect.Effect<void, never, never>
  
  // Component management
  readonly acquireComponent: <T extends ComponentName>(
    componentName: T,
    entityId: EntityId,
    data: Partial<ComponentOfName<T>>
  ) => Effect.Effect<PoolableComponent<T, never, never>, never, never>
  readonly releaseComponent: <T extends ComponentName>(
    component: PoolableComponent<T>
  ) => Effect.Effect<void, never, never>
  
  // Particle management
  readonly acquireParticle: (
    id: string,
    position: { x: number; y: number; z: number },
    velocity: { x: number; y: number; z: number },
    life: number,
    type: string
  ) => Effect.Effect<PoolableParticle, never, never>
  readonly releaseParticle: (particle: PoolableParticle) => Effect.Effect<void, never, never>
  
  // Chunk data management
  readonly acquireChunkData: (
    chunkX: number,
    chunkZ: number,
    voxelData: Uint16Array,
    lightData?: Uint8Array
  ) => Effect.Effect<PoolableChunkData, never, never>
  readonly releaseChunkData: (chunkData: PoolableChunkData) => Effect.Effect<void, never, never>
  
  // Pool statistics and management
  readonly getPoolStats: () => Effect.Effect<{
    entities: { available: number; inUse: number; total: number }
    components: Map<ComponentName, { available: number; inUse: number; total: number }, never>
    particles: { available: number; inUse: number; total: number }
    chunkData: { available: number; inUse: number; total: number }
  }, never, never>
  
  readonly cleanup: () => Effect.Effect<void, never, never>
  readonly prewarm: () => Effect.Effect<void, never, never>
}

/**
 * Create the memory pool manager with optimized configurations
 */
export const createMemoryPoolManager = (): Effect.Effect<MemoryPoolManager, never, never> =>
  Effect.gen(function* () {
    // Create entity pool
    const entityPool = yield* createEffectPool(
      () => new ManagedEntity(),
      { initialSize: 1000, maxSize: 100000, growthFactor: 1.5 }
    )
    
    // Create component pools (will be created on-demand)
    const componentPools = new Map<ComponentName, EffectObjectPool<PoolableComponent<any>>>()
    
    // Create particle pool
    const particlePool = yield* createEffectPool(
      () => new ManagedParticle(),
      { initialSize: 500, maxSize: 50000, growthFactor: 2 }
    )
    
    // Create chunk data pool  
    const chunkDataPool = yield* createEffectPool(
      () => new ManagedChunkData(),
      { initialSize: 100, maxSize: 10000, growthFactor: 1.5 }
    )
    
    // Helper to get or create component pool
    const getComponentPool = <T extends ComponentName>(componentName: T) =>
      Effect.gen(function* () {
        if (!componentPools.has(componentName)) {
          const pool = yield* createEffectPool(
            () => new ManagedComponent(componentName, { name: componentName } as ComponentOfName<T>),
            { initialSize: 100, maxSize: 10000, growthFactor: 1.5 }
          )
          componentPools.set(componentName, pool)
        }
        return componentPools.get(componentName)!
      })
    
    return {
      entityPool,
      componentPools,
      particlePool,
      chunkDataPool,
      
      acquireEntity: (id: EntityId) =>
        Effect.gen(function* () {
          const entity = yield* entityPool.acquire
          entity.activate(id)
          
          // Track memory usage
          yield* MemoryDetector.trackObjects('entities', 1, 128) // Estimate 128 bytes per entity
          
          return entity
        }),
      
      releaseEntity: (entity: PoolableEntity) =>
        Effect.gen(function* () {
          entity.deactivate()
          yield* entityPool.release(entity)
          
          yield* MemoryDetector.trackObjects('entities', -1, -128)
        }),
      
      acquireComponent: <T extends ComponentName>(
        componentName: T,
        entityId: EntityId,
        data: Partial<ComponentOfName<T>>
      ) =>
        Effect.gen(function* () {
          const pool = yield* getComponentPool(componentName)
          const component = yield* pool.acquire
          component.initialize(entityId, data)
          
          yield* MemoryDetector.trackObjects(`components_${componentName}`, 1, 64)
          
          return component as PoolableComponent<T>
        }),
      
      releaseComponent: <T extends ComponentName>(component: PoolableComponent<T>) =>
        Effect.gen(function* () {
          const pool = yield* getComponentPool(component.name)
          yield* pool.release(component)
          
          yield* MemoryDetector.trackObjects(`components_${component.name}`, -1, -64)
        }),
      
      acquireParticle: (id, position, velocity, life, type) =>
        Effect.gen(function* () {
          const particle = yield* particlePool.acquire
          particle.initialize(id, position, velocity, life, type)
          
          yield* MemoryDetector.trackObjects('particles', 1, 96)
          
          return particle
        }),
      
      releaseParticle: (particle: PoolableParticle) =>
        Effect.gen(function* () {
          yield* particlePool.release(particle)
          yield* MemoryDetector.trackObjects('particles', -1, -96)
        }),
      
      acquireChunkData: (chunkX, chunkZ, voxelData, lightData) =>
        Effect.gen(function* () {
          const chunkData = yield* chunkDataPool.acquire
          chunkData.initialize(chunkX, chunkZ, voxelData, lightData)
          
          const size = voxelData.byteLength + (lightData?.byteLength || 0) + 64
          yield* MemoryDetector.trackObjects('chunk_data', 1, size)
          
          return chunkData
        }),
      
      releaseChunkData: (chunkData: PoolableChunkData) =>
        Effect.gen(function* () {
          yield* chunkDataPool.release(chunkData)
          
          const size = chunkData.getVoxelData().byteLength + 
                      (chunkData.getLightData()?.byteLength || 0) + 64
          yield* MemoryDetector.trackObjects('chunk_data', -1, -size)
        }),
      
      getPoolStats: () =>
        Effect.gen(function* () {
          const entityStats = yield* entityPool.getStats
          const particleStats = yield* particlePool.getStats
          const chunkDataStats = yield* chunkDataPool.getStats
          
          const componentStatsMap = new Map()
          for (const [name, pool] of componentPools) {
            const stats = yield* pool.getStats
            componentStatsMap.set(name, stats)
          }
          
          return {
            entities: entityStats,
            components: componentStatsMap,
            particles: particleStats,
            chunkData: chunkDataStats
          }
        }),
      
      cleanup: () =>
        Effect.gen(function* () {
          // Release all objects back to pools
          yield* entityPool.releaseAll
          yield* particlePool.releaseAll
          yield* chunkDataPool.releaseAll
          
          for (const [, pool] of componentPools) {
            yield* pool.releaseAll
          }
          
          yield* Effect.log('Memory pools cleaned up')
        }),
      
      prewarm: () =>
        Effect.gen(function* () {
          // Pre-warm all pools to their initial sizes
          yield* entityPool.grow
          yield* particlePool.grow  
          yield* chunkDataPool.grow
          
          yield* Effect.log('Memory pools pre-warmed')
        })
    }
  })

/**
 * Memory pool context tag
 */
export class MemoryPoolService extends Context.Tag('MemoryPoolService')<
  MemoryPoolService,
  MemoryPoolManager
>() {}

/**
 * Utility functions for pool management
 */
export const withPooledEntity = <R, E, A>(
  id: EntityId,
  fn: (entity: PoolableEntity) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | MemoryPoolService> =>
  Effect.gen(function* () {
    const poolManager = yield* MemoryPoolService
    return yield* Effect.acquireUseRelease(
      poolManager.acquireEntity(id),
      fn,
      (entity) => poolManager.releaseEntity(entity)
    )
  })

export const withPooledComponent = <T extends ComponentName, R, E, A>(
  componentName: T,
  entityId: EntityId,
  data: Partial<ComponentOfName<T>>,
  fn: (component: PoolableComponent<T>) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | MemoryPoolService> =>
  Effect.gen(function* () {
    const poolManager = yield* MemoryPoolService
    return yield* Effect.acquireUseRelease(
      poolManager.acquireComponent(componentName, entityId, data),
      fn,
      (component) => poolManager.releaseComponent(component)
    )
  })

export const withPooledParticle = <R, E, A>(
  id: string,
  position: { x: number; y: number; z: number },
  velocity: { x: number; y: number; z: number },
  life: number,
  type: string,
  fn: (particle: PoolableParticle) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | MemoryPoolService> =>
  Effect.gen(function* () {
    const poolManager = yield* MemoryPoolService
    return yield* Effect.acquireUseRelease(
      poolManager.acquireParticle(id, position, velocity, life, type),
      fn,
      (particle) => poolManager.releaseParticle(particle)
    )
  })

/**
 * Pool performance monitoring
 */
export const monitorPoolPerformance = (): Effect.Effect<void, never, MemoryPoolService> =>
  Effect.gen(function* () {
    const poolManager = yield* MemoryPoolService
    
    const stats = yield* poolManager.getPoolStats()
    
    yield* Profile.start('pool_monitoring')
    
    // Log pool utilization
    const entityUtilization = stats.entities.inUse / stats.entities.total
    const particleUtilization = stats.particles.inUse / stats.particles.total
    const chunkUtilization = stats.chunkData.inUse / stats.chunkData.total
    
    if (entityUtilization > 0.8) {
      yield* Effect.logWarning(`High entity pool utilization: ${(entityUtilization * 100).toFixed(1)}%`)
    }
    
    if (particleUtilization > 0.9) {
      yield* Effect.logWarning(`High particle pool utilization: ${(particleUtilization * 100).toFixed(1)}%`)
    }
    
    if (chunkUtilization > 0.7) {
      yield* Effect.logWarning(`High chunk data pool utilization: ${(chunkUtilization * 100).toFixed(1)}%`)
    }
    
    yield* Profile.end('pool_monitoring')
  }).pipe(
    Effect.repeat(Schedule.fixed(Duration.seconds(10)))
  )