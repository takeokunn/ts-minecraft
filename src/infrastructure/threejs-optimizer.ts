import { Effect, Layer, Ref } from 'effect'

import * as THREE from 'three'
import type { EntityId } from '@/core/entities/entity'
import { ObjectPool } from '@/core/performance/object-pool'

// --- Configuration ---

const CONFIG = {
  INSTANCING_ENABLED: true,
  LOD_ENABLED: true,
  FRUSTUM_CULLING_ENABLED: true,
  OCCLUSION_CULLING_ENABLED: false, // Future feature
  BATCH_RENDERING_ENABLED: true,
  MAX_INSTANCES_PER_TYPE: 65536,
  LOD_LEVELS: [
    { distance: 50, detail: 1.0 },   // Full detail
    { distance: 100, detail: 0.75 }, // High detail
    { distance: 200, detail: 0.5 },  // Medium detail
    { distance: 400, detail: 0.25 }, // Low detail
  ],
  CULLING_MARGIN: 10, // Extend frustum slightly
  BATCH_SIZE: 1000,   // Objects per batch
  GEOMETRY_MERGING: true,
  TEXTURE_STREAMING: true,
} as const

// --- Three.js Optimization Types ---

/**
 * Instanced render batch
 */
export interface InstancedRenderBatch {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  instances: THREE.InstancedMesh
  entityMap: Map<EntityId, number> // Entity to instance index mapping
  availableSlots: number[]
  maxInstances: number
  instanceCount: number
  isDirty: boolean
  lastUpdate: number
}

/**
 * LOD (Level of Detail) configuration
 */
export interface LODConfiguration {
  object: THREE.LOD
  distances: number[]
  geometries: THREE.BufferGeometry[]
  materials: THREE.Material[]
  currentLevel: number
}

/**
 * Frustum culling data
 */
export interface FrustumCullingData {
  frustum: THREE.Frustum
  culledObjects: Set<THREE.Object3D>
  visibleObjects: Set<THREE.Object3D>
  lastCull: number
  cullStats: {
    totalObjects: number
    culledObjects: number
    visibleObjects: number
  }
}

/**
 * Occlusion culling data (future)
 */
export interface OcclusionCullingData {
  occluders: THREE.Object3D[]
  occludees: THREE.Object3D[]
  occlusionQueries: Map<THREE.Object3D, boolean>
  lastOcclusionTest: number
}

/**
 * Rendering batch for geometry merging
 */
export interface GeometryBatch {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  objects: THREE.Object3D[]
  mergedGeometry: THREE.BufferGeometry
  needsUpdate: boolean
}

/**
 * Three.js optimizer state
 */
export interface ThreeJSOptimizerState {
  instancedBatches: Map<string, InstancedRenderBatch>
  lodObjects: Map<string, LODConfiguration>
  frustumCulling: FrustumCullingData
  occlusionCulling: OcclusionCullingData
  geometryBatches: Map<string, GeometryBatch>
  renderQueue: THREE.Object3D[]
  stats: {
    drawCalls: number
    triangles: number
    instances: number
    batchedObjects: number
    culledObjects: number
    memoryUsage: number
  }
}

// --- Memory Pools ---

const matrixPool = new ObjectPool<THREE.Matrix4>(
  () => new THREE.Matrix4(),
  (matrix: THREE.Matrix4) => matrix.identity(),
  10000
)

const vector3Pool = new ObjectPool<THREE.Vector3>(
  () => new THREE.Vector3(),
  (vector: THREE.Vector3) => vector.set(0, 0, 0),
  1000
)

const box3Pool = new ObjectPool<THREE.Box3>(
  () => new THREE.Box3(),
  (box) => box.makeEmpty(),
  500
)

// --- Instancing Utilities ---

/**
 * Create instanced render batch
 */
const createInstancedBatch = (
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  maxInstances: number = CONFIG.MAX_INSTANCES_PER_TYPE
): InstancedRenderBatch => {
  const instances = new THREE.InstancedMesh(geometry, material, maxInstances)
  instances.frustumCulled = false // We handle culling manually
  
  return {
    geometry,
    material,
    instances,
    entityMap: new Map(),
    availableSlots: Array.from({ length: maxInstances }, (_, i) => i),
    maxInstances,
    instanceCount: 0,
    isDirty: false,
    lastUpdate: 0,
  }
}

/**
 * Add instance to batch
 */
const addInstanceToBatch = (
  batch: InstancedRenderBatch,
  entityId: EntityId,
  matrix: THREE.Matrix4,
  color?: THREE.Color
): boolean => {
  if (batch.availableSlots.length === 0) {
    return false // Batch is full
  }
  
  const slotIndex = batch.availableSlots.pop()!
  batch.entityMap.set(entityId, slotIndex)
  
  batch.instances.setMatrixAt(slotIndex, matrix)
  
  if (color) {
    batch.instances.setColorAt(slotIndex, color)
  }
  
  batch.instanceCount++
  batch.isDirty = true
  batch.lastUpdate = Date.now()
  
  return true
}

/**
 * Remove instance from batch
 */
const removeInstanceFromBatch = (
  batch: InstancedRenderBatch,
  entityId: EntityId
): boolean => {
  const slotIndex = batch.entityMap.get(entityId)
  if (slotIndex === undefined) {
    return false
  }
  
  batch.entityMap.delete(entityId)
  batch.availableSlots.push(slotIndex)
  batch.instanceCount--
  batch.isDirty = true
  batch.lastUpdate = Date.now()
  
  // Clear the matrix at this slot
  const matrix = matrixPool.acquire()
  matrix.makeScale(0, 0, 0) // Make it invisible
  batch.instances.setMatrixAt(slotIndex, matrix)
  matrixPool.release(matrix)
  
  return true
}

/**
 * Update instanced batch
 */
const updateInstancedBatch = (batch: InstancedRenderBatch): void => {
  if (batch.isDirty) {
    batch.instances.instanceMatrix.needsUpdate = true
    if (batch.instances.instanceColor) {
      batch.instances.instanceColor.needsUpdate = true
    }
    batch.instances.count = batch.instanceCount
    batch.isDirty = false
  }
}

// --- LOD Utilities ---

/**
 * Create LOD object with multiple detail levels
 */
const createLODObject = (
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
  distances: number[]
): LODConfiguration => {
  const lod = new THREE.LOD()
  
  geometries.forEach((geometry, index) => {
    const mesh = new THREE.Mesh(geometry, materials[index] || materials[0])
    lod.addLevel(mesh, distances[index] || CONFIG.LOD_LEVELS[index]?.distance || index * 50)
  })
  
  return {
    object: lod,
    distances,
    geometries,
    materials,
    currentLevel: 0,
  }
}

/**
 * Update LOD based on camera distance
 */
const updateLODObjects = (
  lodObjects: Map<string, LODConfiguration>,
  camera: THREE.Camera
): void => {
  for (const [, lodConfig] of lodObjects) {
    lodConfig.object.update(camera)
  }
}

// --- Culling Utilities ---

/**
 * Perform frustum culling
 */
const performFrustumCulling = (
  objects: THREE.Object3D[],
  camera: THREE.Camera,
  frustum: THREE.Frustum
): FrustumCullingData => {
  const matrix = new THREE.Matrix4()
  matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  frustum.setFromProjectionMatrix(matrix)
  
  const culledObjects = new Set<THREE.Object3D>()
  const visibleObjects = new Set<THREE.Object3D>()
  
  for (const object of objects) {
    if (!object.visible) continue
    
    // Get object bounding sphere or box
    const geometry = (object as any).geometry as THREE.BufferGeometry
    if (geometry && geometry.boundingSphere) {
      geometry.computeBoundingSphere()
      const sphere = geometry.boundingSphere.clone()
      sphere.applyMatrix4(object.matrixWorld)
      
      if (frustum.intersectsSphere(sphere)) {
        visibleObjects.add(object)
        object.visible = true
      } else {
        culledObjects.add(object)
        object.visible = false
      }
    } else {
      // Fallback to always visible if no bounding data
      visibleObjects.add(object)
    }
  }
  
  return {
    frustum,
    culledObjects,
    visibleObjects,
    lastCull: Date.now(),
    cullStats: {
      totalObjects: objects.length,
      culledObjects: culledObjects.size,
      visibleObjects: visibleObjects.size,
    }
  }
}

/**
 * Merge geometries for batching
 */
const mergeGeometries = (geometries: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  if (geometries.length === 0) {
    return new THREE.BufferGeometry()
  }
  
  if (geometries.length === 1) {
    return geometries[0].clone()
  }
  
  // Use Three.js BufferGeometryUtils if available, otherwise merge manually
  const merged = new THREE.BufferGeometry()
  
  let totalVertices = 0
  let totalIndices = 0
  
  // Calculate total sizes
  for (const geometry of geometries) {
    const positionAttribute = geometry.getAttribute('position')
    if (positionAttribute) {
      totalVertices += positionAttribute.count
    }
    
    const indexAttribute = geometry.getIndex()
    if (indexAttribute) {
      totalIndices += indexAttribute.count
    }
  }
  
  // Allocate arrays
  const positions = new Float32Array(totalVertices * 3)
  const normals = new Float32Array(totalVertices * 3)
  const uvs = new Float32Array(totalVertices * 2)
  const indices = new Uint32Array(totalIndices)
  
  let positionOffset = 0
  let normalOffset = 0
  let uvOffset = 0
  let indexOffset = 0
  let vertexOffset = 0
  
  // Merge geometry data
  for (const geometry of geometries) {
    const positionAttribute = geometry.getAttribute('position')
    const normalAttribute = geometry.getAttribute('normal')
    const uvAttribute = geometry.getAttribute('uv')
    const indexAttribute = geometry.getIndex()
    
    if (positionAttribute) {
      positions.set(positionAttribute.array as Float32Array, positionOffset)
      positionOffset += positionAttribute.array.length
    }
    
    if (normalAttribute) {
      normals.set(normalAttribute.array as Float32Array, normalOffset)
      normalOffset += normalAttribute.array.length
    }
    
    if (uvAttribute) {
      uvs.set(uvAttribute.array as Float32Array, uvOffset)
      uvOffset += uvAttribute.array.length
    }
    
    if (indexAttribute) {
      const indexArray = indexAttribute.array
      for (let i = 0; i < indexArray.length; i++) {
        indices[indexOffset + i] = indexArray[i] + vertexOffset
      }
      indexOffset += indexArray.length
      vertexOffset += positionAttribute?.count || 0
    }
  }
  
  // Set attributes
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  merged.setIndex(new THREE.BufferAttribute(indices, 1))
  
  return merged
}

// --- Main Service ---

export interface ThreeJSOptimizerService {
  createInstancedBatch: (batchName: string, geometry: THREE.BufferGeometry, material: THREE.Material) => Effect.Effect<void, never, never>
  addToInstancedBatch: (batchName: string, entityId: EntityId, transform: THREE.Matrix4, color?: THREE.Color) => Effect.Effect<boolean, never, never>
  removeFromInstancedBatch: (batchName: string, entityId: EntityId) => Effect.Effect<boolean, never, never>
  updateInstances: () => Effect.Effect<void, never, never>
  createLODObject: (objectName: string, geometries: THREE.BufferGeometry[], materials: THREE.Material[], distances: number[]) => Effect.Effect<THREE.LOD, never, never>
  updateLOD: (camera: THREE.Camera) => Effect.Effect<void, never, never>
  performCulling: (objects: THREE.Object3D[], camera: THREE.Camera) => Effect.Effect<FrustumCullingData, never, never>
  mergeObjectGeometries: (batchName: string, objects: THREE.Object3D[]) => Effect.Effect<THREE.BufferGeometry, never, never>
  optimizeScene: (scene: THREE.Scene, camera: THREE.Camera) => Effect.Effect<void, never, never>
  getStats: () => Effect.Effect<ThreeJSOptimizerState['stats'], never, never>
  dispose: () => Effect.Effect<void, never, never>
}

export const ThreeJSOptimizerService = Effect.Tag<ThreeJSOptimizerService>('ThreeJSOptimizerService')

export const ThreeJSOptimizerLive = Layer.effect(
  ThreeJSOptimizerService,
  Effect.gen(function* (_) {
    const initialState: ThreeJSOptimizerState = {
      instancedBatches: new Map(),
      lodObjects: new Map(),
      frustumCulling: {
        frustum: new THREE.Frustum(),
        culledObjects: new Set(),
        visibleObjects: new Set(),
        lastCull: 0,
        cullStats: {
          totalObjects: 0,
          culledObjects: 0,
          visibleObjects: 0,
        }
      },
      occlusionCulling: {
        occluders: [],
        occludees: [],
        occlusionQueries: new Map(),
        lastOcclusionTest: 0,
      },
      geometryBatches: new Map(),
      renderQueue: [],
      stats: {
        drawCalls: 0,
        triangles: 0,
        instances: 0,
        batchedObjects: 0,
        culledObjects: 0,
        memoryUsage: 0,
      }
    }
    
    const stateRef = yield* _(Ref.make(initialState))
    
    return {
      createInstancedBatch: (batchName: string, geometry: THREE.BufferGeometry, material: THREE.Material) =>
        Effect.gen(function* () {
          const batch = createInstancedBatch(geometry, material)
          
          yield* _(Ref.update(stateRef, state => ({
            ...state,
            instancedBatches: new Map([...state.instancedBatches, [batchName, batch]])
          })))
        }),
      
      addToInstancedBatch: (batchName: string, entityId: EntityId, transform: THREE.Matrix4, color?: THREE.Color) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          const batch = state.instancedBatches.get(batchName)
          
          if (!batch) {
            return false
          }
          
          const success = addInstanceToBatch(batch, entityId, transform, color)
          
          if (success) {
            yield* _(Ref.update(stateRef, s => ({
              ...s,
              stats: {
                ...s.stats,
                instances: s.stats.instances + 1
              }
            })))
          }
          
          return success
        }),
      
      removeFromInstancedBatch: (batchName: string, entityId: EntityId) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          const batch = state.instancedBatches.get(batchName)
          
          if (!batch) {
            return false
          }
          
          const success = removeInstanceFromBatch(batch, entityId)
          
          if (success) {
            yield* _(Ref.update(stateRef, s => ({
              ...s,
              stats: {
                ...s.stats,
                instances: Math.max(0, s.stats.instances - 1)
              }
            })))
          }
          
          return success
        }),
      
      updateInstances: () =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          
          for (const batch of state.instancedBatches.values()) {
            updateInstancedBatch(batch)
          }
        }),
      
      createLODObject: (objectName: string, geometries: THREE.BufferGeometry[], materials: THREE.Material[], distances: number[]) =>
        Effect.gen(function* () {
          const lodConfig = createLODObject(geometries, materials, distances)
          
          yield* _(Ref.update(stateRef, state => ({
            ...state,
            lodObjects: new Map([...state.lodObjects, [objectName, lodConfig]])
          })))
          
          return lodConfig.object
        }),
      
      updateLOD: (camera: THREE.Camera) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          updateLODObjects(state.lodObjects, camera)
        }),
      
      performCulling: (objects: THREE.Object3D[], camera: THREE.Camera) =>
        Effect.gen(function* () {
          if (!CONFIG.FRUSTUM_CULLING_ENABLED) {
            return {
              frustum: new THREE.Frustum(),
              culledObjects: new Set(),
              visibleObjects: new Set(objects),
              lastCull: Date.now(),
              cullStats: {
                totalObjects: objects.length,
                culledObjects: 0,
                visibleObjects: objects.length,
              }
            }
          }
          
          const state = yield* _(Ref.get(stateRef))
          const frustumData = performFrustumCulling(objects, camera, state.frustumCulling.frustum)
          
          yield* _(Ref.update(stateRef, s => ({
            ...s,
            frustumCulling: frustumData,
            stats: {
              ...s.stats,
              culledObjects: frustumData.cullStats.culledObjects
            }
          })))
          
          return frustumData
        }),
      
      mergeObjectGeometries: (batchName: string, objects: THREE.Object3D[]) =>
        Effect.gen(function* () {
          const geometries: THREE.BufferGeometry[] = []
          
          for (const object of objects) {
            const mesh = object as THREE.Mesh
            if (mesh.geometry && mesh.geometry instanceof THREE.BufferGeometry) {
              const geometry = mesh.geometry.clone()
              geometry.applyMatrix4(mesh.matrixWorld)
              geometries.push(geometry)
            }
          }
          
          const mergedGeometry = mergeGeometries(geometries)
          
          // Store batch for future reference
          const batch: GeometryBatch = {
            geometry: mergedGeometry,
            material: (objects[0] as THREE.Mesh)?.material as THREE.Material || new THREE.MeshBasicMaterial(),
            objects,
            mergedGeometry,
            needsUpdate: false,
          }
          
          yield* _(Ref.update(stateRef, state => ({
            ...state,
            geometryBatches: new Map([...state.geometryBatches, [batchName, batch]]),
            stats: {
              ...state.stats,
              batchedObjects: state.stats.batchedObjects + objects.length
            }
          })))
          
          return mergedGeometry
        }),
      
      optimizeScene: (scene: THREE.Scene, camera: THREE.Camera) =>
        Effect.gen(function* () {
          // Collect all objects in scene
          const allObjects: THREE.Object3D[] = []
          scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              allObjects.push(object)
            }
          })
          
          // Perform frustum culling
          yield* _(Effect.serviceRef.performCulling(allObjects, camera))
          
          // Update LOD objects
          yield* _(Effect.serviceRef.updateLOD(camera))
          
          // Update instanced batches
          yield* _(Effect.serviceRef.updateInstances())
          
          // Update statistics
          yield* _(Ref.update(stateRef, state => {
            let drawCalls = 0
            let triangles = 0
            
            // Count draw calls from instanced batches
            for (const batch of state.instancedBatches.values()) {
              if (batch.instanceCount > 0) {
                drawCalls++
                const geometry = batch.geometry
                const indexCount = geometry.index ? geometry.index.count : 
                                 geometry.getAttribute('position')?.count || 0
                triangles += (indexCount / 3) * batch.instanceCount
              }
            }
            
            // Count draw calls from regular objects
            for (const object of state.frustumCulling.visibleObjects) {
              const mesh = object as THREE.Mesh
              if (mesh.geometry) {
                drawCalls++
                const geometry = mesh.geometry
                const indexCount = geometry.index ? geometry.index.count : 
                                 geometry.getAttribute('position')?.count || 0
                triangles += indexCount / 3
              }
            }
            
            return {
              ...state,
              stats: {
                ...state.stats,
                drawCalls,
                triangles
              }
            }
          }))
        }),
      
      getStats: () =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          
          // Calculate memory usage
          let memoryUsage = 0
          
          // Instanced batches
          for (const batch of state.instancedBatches.values()) {
            memoryUsage += batch.maxInstances * 16 * 4 // Matrix4 = 16 floats
            if (batch.instances.instanceColor) {
              memoryUsage += batch.maxInstances * 3 * 4 // Color = 3 floats
            }
          }
          
          // Geometry batches
          for (const batch of state.geometryBatches.values()) {
            const geometry = batch.mergedGeometry
            const positionAttr = geometry.getAttribute('position')
            if (positionAttr) {
              memoryUsage += positionAttr.array.byteLength
            }
            const indexAttr = geometry.getIndex()
            if (indexAttr) {
              memoryUsage += indexAttr.array.byteLength
            }
          }
          
          return {
            ...state.stats,
            memoryUsage
          }
        }),
      
      dispose: () =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          
          // Dispose instanced meshes
          for (const batch of state.instancedBatches.values()) {
            batch.instances.dispose()
            batch.geometry.dispose()
            if (batch.material && 'dispose' in batch.material) {
              (batch.material as any).dispose()
            }
          }
          
          // Dispose LOD objects
          for (const lodConfig of state.lodObjects.values()) {
            for (const geometry of lodConfig.geometries) {
              geometry.dispose()
            }
            for (const material of lodConfig.materials) {
              if ('dispose' in material) {
                (material as any).dispose()
              }
            }
          }
          
          // Dispose geometry batches
          for (const batch of state.geometryBatches.values()) {
            batch.geometry.dispose()
            batch.mergedGeometry.dispose()
            if ('dispose' in batch.material) {
              (batch.material as any).dispose()
            }
          }
          
          // Clear pools
          matrixPool.clear()
          vector3Pool.clear()
          box3Pool.clear()
          
          yield* _(Ref.set(stateRef, initialState))
        })
    }
  }),
)

// Export types and configuration
export type { 
  ThreeJSOptimizerState, 
  InstancedRenderBatch, 
  LODConfiguration, 
  FrustumCullingData, 
  OcclusionCullingData,
  GeometryBatch 
}
export { CONFIG as ThreeJSOptimizerConfig }