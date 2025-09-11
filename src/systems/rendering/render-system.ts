/**
 * Render System - Next-Generation Rendering Pipeline
 * 
 * Features:
 * - Frustum culling optimization
 * - Instanced rendering for performance
 * - Level-of-detail (LOD) management
 * - Batch rendering optimization
 * - GPU command queue management
 * - Asynchronous render preparation
 */

import { Effect, pipe, Array as EffArray, Queue, Duration, Chunk } from 'effect'
import { queries, createArchetypeQuery, trackPerformance } from '@/core/queries'
import { World, Renderer } from '@/runtime/services'
import { SystemFunction, SystemConfig, SystemContext } from '../core/scheduler'
import { Position, MeshComponent, MaterialComponent, CameraComponent, RenderableComponent } from '@/core/components'
import * as THREE from 'three'

/**
 * Render system configuration
 */
export interface RenderConfig {
  readonly enableFrustumCulling: boolean
  readonly enableLOD: boolean
  readonly enableInstancing: boolean
  readonly maxInstancesPerBatch: number
  readonly cullingDistance: number
  readonly lodLevels: readonly number[]
  readonly batchingThreshold: number
  readonly asyncRenderPrep: boolean
}

/**
 * Renderable entity data
 */
interface RenderableEntity {
  readonly entityId: number
  readonly position: Position
  readonly mesh: MeshComponent
  readonly material: MaterialComponent
  readonly renderable: RenderableComponent
  readonly distance: number
  readonly lodLevel: number
}

/**
 * Render batch for instanced rendering
 */
interface RenderBatch {
  readonly meshId: string
  readonly materialId: string
  readonly instances: readonly RenderableEntity[]
  readonly instanceMatrix: Float32Array
  readonly count: number
}

/**
 * Render command for GPU execution
 */
interface RenderCommand {
  readonly type: 'single' | 'instanced' | 'batch'
  readonly meshId: string
  readonly materialId: string
  readonly transforms: Float32Array
  readonly count: number
  readonly priority: number
}

/**
 * Camera frustum for culling
 */
interface CameraFrustum {
  readonly camera: CameraComponent
  readonly frustum: THREE.Frustum
  readonly position: Position
  readonly viewMatrix: THREE.Matrix4
  readonly projectionMatrix: THREE.Matrix4
}

/**
 * Default render configuration
 */
export const defaultRenderConfig: RenderConfig = {
  enableFrustumCulling: true,
  enableLOD: true,
  enableInstancing: true,
  maxInstancesPerBatch: 1000,
  cullingDistance: 500,
  lodLevels: [50, 100, 200, 400],
  batchingThreshold: 10,
  asyncRenderPrep: true,
}

/**
 * Advanced render processor
 */
class RenderProcessor {
  private renderQueue: RenderCommand[] = []
  private renderBatches: Map<string, RenderBatch> = new Map()
  
  constructor(private config: RenderConfig) {}

  /**
   * Process all renderable entities
   */
  async processRenderables(
    renderables: RenderableEntity[],
    cameras: CameraFrustum[]
  ): Promise<RenderCommand[]> {
    const commands: RenderCommand[] = []

    if (cameras.length === 0) return commands

    const mainCamera = cameras[0] // Use first camera as main camera

    // Frustum culling
    const visibleEntities = this.config.enableFrustumCulling
      ? this.performFrustumCulling(renderables, mainCamera)
      : renderables

    // LOD calculation
    const lodEntities = this.config.enableLOD
      ? this.calculateLOD(visibleEntities, mainCamera.position)
      : visibleEntities

    // Group by mesh and material for instancing/batching
    const renderGroups = this.groupForRendering(lodEntities)

    // Generate render commands
    for (const [groupKey, entities] of renderGroups.entries()) {
      if (entities.length === 0) continue

      if (this.config.enableInstancing && entities.length >= this.config.batchingThreshold) {
        commands.push(...this.createInstancedCommands(entities))
      } else {
        commands.push(...this.createSingleCommands(entities))
      }
    }

    // Sort commands by priority and state changes
    return this.sortRenderCommands(commands)
  }

  /**
   * Perform frustum culling
   */
  private performFrustumCulling(
    renderables: RenderableEntity[],
    camera: CameraFrustum
  ): RenderableEntity[] {
    return renderables.filter(entity => {
      // Simple sphere-frustum test
      const position = new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z)
      const radius = Math.max(
        entity.mesh.boundingBox?.width || 1,
        entity.mesh.boundingBox?.height || 1,
        entity.mesh.boundingBox?.depth || 1
      ) / 2

      return camera.frustum.intersectsSphere(new THREE.Sphere(position, radius))
    })
  }

  /**
   * Calculate LOD levels
   */
  private calculateLOD(
    renderables: RenderableEntity[],
    cameraPosition: Position
  ): RenderableEntity[] {
    return renderables.map(entity => {
      const distance = this.calculateDistance(entity.position, cameraPosition)
      const lodLevel = this.getLODLevel(distance)

      return {
        ...entity,
        distance,
        lodLevel,
      }
    })
  }

  /**
   * Calculate distance between two positions
   */
  private calculateDistance(pos1: Position, pos2: Position): number {
    const dx = pos1.x - pos2.x
    const dy = pos1.y - pos2.y
    const dz = pos1.z - pos2.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  /**
   * Get LOD level based on distance
   */
  private getLODLevel(distance: number): number {
    for (let i = 0; i < this.config.lodLevels.length; i++) {
      if (distance <= this.config.lodLevels[i]) {
        return i
      }
    }
    return this.config.lodLevels.length - 1
  }

  /**
   * Group renderables for optimal rendering
   */
  private groupForRendering(
    renderables: RenderableEntity[]
  ): Map<string, RenderableEntity[]> {
    const groups = new Map<string, RenderableEntity[]>()

    for (const entity of renderables) {
      // Group by mesh + material + LOD level
      const key = `${entity.mesh.id}_${entity.material.id}_${entity.lodLevel}`
      
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      
      groups.get(key)!.push(entity)
    }

    return groups
  }

  /**
   * Create instanced render commands
   */
  private createInstancedCommands(entities: RenderableEntity[]): RenderCommand[] {
    const commands: RenderCommand[] = []
    
    // Split into batches if needed
    const batches = this.splitIntoBatches(entities, this.config.maxInstancesPerBatch)
    
    for (const batch of batches) {
      const instanceMatrix = new Float32Array(batch.length * 16) // 4x4 matrix per instance
      
      batch.forEach((entity, index) => {
        const matrix = new THREE.Matrix4()
        matrix.setPosition(entity.position.x, entity.position.y, entity.position.z)
        matrix.toArray(instanceMatrix, index * 16)
      })

      commands.push({
        type: 'instanced',
        meshId: batch[0].mesh.id,
        materialId: batch[0].material.id,
        transforms: instanceMatrix,
        count: batch.length,
        priority: this.calculateRenderPriority(batch[0]),
      })
    }

    return commands
  }

  /**
   * Create single render commands
   */
  private createSingleCommands(entities: RenderableEntity[]): RenderCommand[] {
    return entities.map(entity => {
      const transform = new Float32Array(16)
      const matrix = new THREE.Matrix4()
      matrix.setPosition(entity.position.x, entity.position.y, entity.position.z)
      matrix.toArray(transform)

      return {
        type: 'single',
        meshId: entity.mesh.id,
        materialId: entity.material.id,
        transforms: transform,
        count: 1,
        priority: this.calculateRenderPriority(entity),
      }
    })
  }

  /**
   * Split entities into batches
   */
  private splitIntoBatches(
    entities: RenderableEntity[],
    maxBatchSize: number
  ): RenderableEntity[][] {
    const batches: RenderableEntity[][] = []
    
    for (let i = 0; i < entities.length; i += maxBatchSize) {
      batches.push(entities.slice(i, i + maxBatchSize))
    }
    
    return batches
  }

  /**
   * Calculate render priority based on distance and material
   */
  private calculateRenderPriority(entity: RenderableEntity): number {
    // Closer objects have higher priority
    // Transparent materials have lower priority
    let priority = 1000 - entity.distance

    if (entity.material.transparent) {
      priority -= 500 // Render transparent objects later
    }

    return priority
  }

  /**
   * Sort render commands for optimal GPU performance
   */
  private sortRenderCommands(commands: RenderCommand[]): RenderCommand[] {
    return commands.sort((a, b) => {
      // First by priority
      if (a.priority !== b.priority) {
        return b.priority - a.priority // Higher priority first
      }

      // Then by type (instanced first for better GPU utilization)
      if (a.type !== b.type) {
        const typeOrder = { instanced: 0, batch: 1, single: 2 }
        return typeOrder[a.type] - typeOrder[b.type]
      }

      // Then by material to minimize state changes
      if (a.materialId !== b.materialId) {
        return a.materialId.localeCompare(b.materialId)
      }

      // Finally by mesh
      return a.meshId.localeCompare(b.meshId)
    })
  }
}

/**
 * Create optimized render system
 */
export const createRenderSystem = (
  config: Partial<RenderConfig> = {}
): SystemFunction => {
  const renderConfig = { ...defaultRenderConfig, ...config }
  const processor = new RenderProcessor(renderConfig)

  return (context: SystemContext) => Effect.gen(function* ($) {
    const world = yield* $(World)
    const renderer = yield* $(Renderer)
    
    const startTime = Date.now()

    // Get all renderable entities
    const renderableQuery = createArchetypeQuery()
      .with('position', 'mesh', 'material', 'renderable')
      .execute()

    // Get camera entities
    const cameraQuery = createArchetypeQuery()
      .with('camera', 'position')
      .execute()

    // Extract renderable data
    const renderableEntities: RenderableEntity[] = renderableQuery.entities.map(entityId => {
      const position = renderableQuery.getComponent<Position>(entityId, 'position')
      const mesh = renderableQuery.getComponent<MeshComponent>(entityId, 'mesh')
      const material = renderableQuery.getComponent<MaterialComponent>(entityId, 'material')
      const renderable = renderableQuery.getComponent<RenderableComponent>(entityId, 'renderable')

      // Only include entities with all required components
      if (position._tag === 'Some' && mesh._tag === 'Some' && 
          material._tag === 'Some' && renderable._tag === 'Some') {
        return {
          entityId,
          position: (position as any).value,
          mesh: (mesh as any).value,
          material: (material as any).value,
          renderable: (renderable as any).value,
          distance: 0, // Will be calculated during processing
          lodLevel: 0, // Will be calculated during processing
        }
      }
      return null
    }).filter(entity => entity !== null) as RenderableEntity[]

    // Extract camera data
    const cameraFrustums: CameraFrustum[] = cameraQuery.entities.map(entityId => {
      const camera = cameraQuery.getComponent<CameraComponent>(entityId, 'camera')
      const position = cameraQuery.getComponent<Position>(entityId, 'position')

      if (camera._tag === 'Some' && position._tag === 'Some') {
        const cameraComp = (camera as any).value
        const positionComp = (position as any).value

        // Create frustum from camera
        const frustum = new THREE.Frustum()
        const viewMatrix = new THREE.Matrix4()
        const projectionMatrix = new THREE.Matrix4()

        // Set up projection matrix
        projectionMatrix.makePerspective(
          cameraComp.fov * Math.PI / 180,
          cameraComp.aspect,
          cameraComp.near,
          cameraComp.far
        )

        // Set up view matrix
        viewMatrix.lookAt(
          new THREE.Vector3(positionComp.x, positionComp.y, positionComp.z),
          new THREE.Vector3(
            positionComp.x + cameraComp.direction.x,
            positionComp.y + cameraComp.direction.y,
            positionComp.z + cameraComp.direction.z
          ),
          new THREE.Vector3(cameraComp.up.x, cameraComp.up.y, cameraComp.up.z)
        )

        frustum.setFromProjectionMatrix(
          new THREE.Matrix4().multiplyMatrices(projectionMatrix, viewMatrix)
        )

        return {
          camera: cameraComp,
          frustum,
          position: positionComp,
          viewMatrix,
          projectionMatrix,
        }
      }
      return null
    }).filter(frustum => frustum !== null) as CameraFrustum[]

    // Process renderables asynchronously if enabled
    const renderCommands = renderConfig.asyncRenderPrep
      ? yield* $(Effect.promise(() => processor.processRenderables(renderableEntities, cameraFrustums)))
      : processor.processRenderables(renderableEntities, cameraFrustums)

    // Submit render commands to renderer
    yield* $(
      Effect.forEach(
        renderCommands,
        (command) => Effect.gen(function* ($) {
          // Convert to renderer-specific commands
          switch (command.type) {
            case 'single':
              yield* $(Queue.offer(renderer.renderQueue, {
                type: 'ADD_CHUNK', // This would be adapted for entity rendering
                chunkX: 0, // These would be entity-specific parameters
                chunkZ: 0,
                positions: new Float32Array(), // Would contain mesh data
                normals: new Float32Array(),
                uvs: new Float32Array(),
                indices: new Uint32Array(),
              }))
              break

            case 'instanced':
              // Handle instanced rendering commands
              break

            case 'batch':
              // Handle batch rendering commands
              break
          }
        }),
        { concurrency: 'inherit', discard: true }
      )
    )

    // Performance tracking
    const endTime = Date.now()
    const executionTime = endTime - startTime
    trackPerformance('render', 'read', executionTime)

    // Debug logging
    if (context.frameId % 60 === 0) {
      console.debug(`Render System - Processed ${renderableEntities.length} renderables, ${renderCommands.length} commands in ${executionTime}ms`)
    }
  })
}

/**
 * System configuration for rendering
 */
export const renderSystemConfig: SystemConfig = {
  id: 'render',
  name: 'Render System',
  priority: 'high',
  phase: 'render',
  dependencies: ['physics', 'collision'],
  conflicts: [],
  maxExecutionTime: Duration.millis(10), // Allow more time for complex rendering
  enableProfiling: true,
}

/**
 * Default render system instance
 */
export const renderSystem = createRenderSystem()

/**
 * Render system variants for different quality levels
 */
export const renderSystemVariants = {
  /**
   * Low-quality rendering for performance
   */
  lowQuality: createRenderSystem({
    enableLOD: true,
    enableFrustumCulling: true,
    enableInstancing: false,
    lodLevels: [25, 50, 100],
    cullingDistance: 200,
  }),

  /**
   * High-quality rendering with all features
   */
  highQuality: createRenderSystem({
    enableLOD: true,
    enableFrustumCulling: true,
    enableInstancing: true,
    lodLevels: [100, 200, 400, 800],
    cullingDistance: 1000,
    maxInstancesPerBatch: 2000,
  }),

  /**
   * Debug rendering with extended visibility
   */
  debug: createRenderSystem({
    enableFrustumCulling: false,
    enableLOD: false,
    cullingDistance: 2000,
    asyncRenderPrep: false, // Synchronous for debugging
  }),
}

/**
 * Render system utilities
 */
export const RenderUtils = {
  /**
   * Create render system with quality preset
   */
  withQuality: (quality: 'low' | 'medium' | 'high' | 'ultra') => {
    const configs = {
      low: {
        enableLOD: true,
        enableFrustumCulling: true,
        enableInstancing: false,
        lodLevels: [25, 50],
        cullingDistance: 100,
      },
      medium: {
        enableLOD: true,
        enableFrustumCulling: true,
        enableInstancing: true,
        lodLevels: [50, 100, 200],
        cullingDistance: 300,
      },
      high: {
        enableLOD: true,
        enableFrustumCulling: true,
        enableInstancing: true,
        lodLevels: [100, 200, 400],
        cullingDistance: 500,
      },
      ultra: {
        enableLOD: false,
        enableFrustumCulling: true,
        enableInstancing: true,
        lodLevels: [200, 400, 800],
        cullingDistance: 1000,
      },
    }
    
    return createRenderSystem(configs[quality])
  },

  /**
   * Create render system optimized for specific entity counts
   */
  forEntityCount: (entityCount: number) => {
    if (entityCount < 100) {
      return renderSystemVariants.debug
    } else if (entityCount < 1000) {
      return renderSystemVariants.lowQuality
    } else {
      return renderSystemVariants.highQuality
    }
  },
}