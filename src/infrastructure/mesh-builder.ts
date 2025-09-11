import { Effect, Layer } from 'effect'

import * as THREE from 'three'
import type { Chunk } from '@/core/components/world/chunk'
import { ObjectPool } from '@/core/performance/object-pool'
import { createTypedWorkerClient, WorkerClientConfig } from '@/workers/base/typed-worker'
import * as S from "@effect/schema/Schema"

// --- Configuration ---

const CONFIG = {
  INSTANCING_ENABLED: true,
  MAX_INSTANCES_PER_MESH: 65536, // WebGL limit
  WORKER_ENABLED: true,
  GEOMETRY_POOLING: true,
  FACE_CULLING_ENABLED: true,
  GREEDY_MESHING: true,
  LOD_LEVELS: 4,
  ATLAS_SIZE: 1024,
} as const

// --- Mesh Builder Types ---

/**
 * Block face visibility for culling
 */
export interface FaceVisibility {
  front: boolean
  back: boolean
  top: boolean
  bottom: boolean
  left: boolean
  right: boolean
}

/**
 * Optimized vertex data structure
 */
export interface VertexData {
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  colors: Float32Array
  indices: Uint32Array
  instanceMatrices?: Float32Array
  instanceColors?: Float32Array
}

/**
 * Mesh generation request for workers
 */
export interface MeshGenerationRequest {
  chunk: Chunk
  neighborChunks: {
    north?: Chunk
    south?: Chunk
    east?: Chunk
    west?: Chunk
  }
  lodLevel: number
  enableFaceCulling: boolean
  enableGreedyMeshing: boolean
}

/**
 * Mesh generation response from workers
 */
export interface MeshGenerationResponse {
  chunkKey: string
  vertexData: VertexData
  instancedData?: {
    [blockType: string]: {
      matrices: Float32Array
      colors: Float32Array
      count: number
    }
  }
  lodLevel: number
  boundingBox: THREE.Box3
  triangleCount: number
}

/**
 * Instanced mesh manager
 */
export interface InstancedMeshData {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  mesh: THREE.InstancedMesh
  instances: Map<string, number> // chunkKey -> instanceIndex
  availableSlots: number[]
  maxInstances: number
}

/**
 * LOD (Level of Detail) configuration
 */
export interface LODConfig {
  level: number
  maxDistance: number
  vertexReduction: number // 0-1, how much to reduce vertices
  textureResolution: number // texture atlas subdivision
}

// --- Geometry Generation ---

/**
 * Generate block geometry with face culling
 */
const generateBlockGeometry = (
  x: number,
  y: number,
  z: number,
  blockType: string,
  faceVisibility: FaceVisibility,
  atlasUVs: { [face: string]: { u: number, v: number, w: number, h: number } }
): VertexData => {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  let vertexIndex = 0

  // Block color based on type
  const blockColors = {
    grass: [0.4, 0.8, 0.2],
    dirt: [0.6, 0.4, 0.2],
    stone: [0.5, 0.5, 0.5],
    wood: [0.4, 0.2, 0.1],
    sand: [0.9, 0.8, 0.6],
    water: [0.2, 0.4, 0.8],
  }
  const color = blockColors[blockType as keyof typeof blockColors] || [1, 1, 1]

  // Face definitions: [position offsets, normal, uv coordinates]
  const faces = [
    // Front face
    {
      condition: faceVisibility.front,
      positions: [
        [x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]
      ],
      normal: [0, 0, 1],
      uvKey: 'front'
    },
    // Back face
    {
      condition: faceVisibility.back,
      positions: [
        [x + 1, y, z], [x, y, z], [x, y + 1, z], [x + 1, y + 1, z]
      ],
      normal: [0, 0, -1],
      uvKey: 'back'
    },
    // Top face
    {
      condition: faceVisibility.top,
      positions: [
        [x, y + 1, z], [x, y + 1, z + 1], [x + 1, y + 1, z + 1], [x + 1, y + 1, z]
      ],
      normal: [0, 1, 0],
      uvKey: 'top'
    },
    // Bottom face
    {
      condition: faceVisibility.bottom,
      positions: [
        [x, y, z + 1], [x, y, z], [x + 1, y, z], [x + 1, y, z + 1]
      ],
      normal: [0, -1, 0],
      uvKey: 'bottom'
    },
    // Left face
    {
      condition: faceVisibility.left,
      positions: [
        [x, y, z], [x, y, z + 1], [x, y + 1, z + 1], [x, y + 1, z]
      ],
      normal: [-1, 0, 0],
      uvKey: 'left'
    },
    // Right face
    {
      condition: faceVisibility.right,
      positions: [
        [x + 1, y, z + 1], [x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1]
      ],
      normal: [1, 0, 0],
      uvKey: 'right'
    },
  ]

  faces.forEach((face) => {
    if (!face.condition) return

    const startIndex = vertexIndex
    const uvData = atlasUVs[face.uvKey] || { u: 0, v: 0, w: 1, h: 1 }

    // Add vertices
    face.positions.forEach((pos, i) => {
      positions.push(...pos)
      normals.push(...face.normal)
      colors.push(...color)

      // UV mapping for texture atlas
      const u = uvData.u + (i % 2) * uvData.w
      const v = uvData.v + Math.floor(i / 2) * uvData.h
      uvs.push(u, v)
    })

    // Add indices (two triangles per face)
    indices.push(
      startIndex, startIndex + 1, startIndex + 2,
      startIndex + 2, startIndex + 3, startIndex
    )

    vertexIndex += 4
  })

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
  }
}

/**
 * Determine face visibility for a block
 */
const getFaceVisibility = (
  chunk: Chunk,
  neighborChunks: MeshGenerationRequest['neighborChunks'],
  x: number,
  y: number,
  z: number
): FaceVisibility => {
  const getBlockAt = (bx: number, by: number, bz: number): string => {
    if (by < 0 || by >= 256) return 'air'
    
    if (bx >= 0 && bx < 16 && bz >= 0 && bz < 16) {
      // Within current chunk
      const index = bx + bz * 16 + by * 16 * 16
      return chunk.blocks[index] || 'air'
    }
    
    // Check neighbor chunks
    let neighborChunk: Chunk | undefined
    let localX = bx
    let localZ = bz
    
    if (bx < 0 && neighborChunks.west) {
      neighborChunk = neighborChunks.west
      localX = 15
    } else if (bx >= 16 && neighborChunks.east) {
      neighborChunk = neighborChunks.east
      localX = 0
    } else if (bz < 0 && neighborChunks.south) {
      neighborChunk = neighborChunks.south
      localZ = 15
    } else if (bz >= 16 && neighborChunks.north) {
      neighborChunk = neighborChunks.north
      localZ = 0
    }
    
    if (neighborChunk && localX >= 0 && localX < 16 && localZ >= 0 && localZ < 16) {
      const index = localX + localZ * 16 + by * 16 * 16
      return neighborChunk.blocks[index] || 'air'
    }
    
    return 'air'
  }

  const isOpaque = (blockType: string): boolean => {
    return blockType !== 'air' && blockType !== 'water' && blockType !== 'glass'
  }

  return {
    front: !isOpaque(getBlockAt(x, y, z + 1)),
    back: !isOpaque(getBlockAt(x, y, z - 1)),
    top: !isOpaque(getBlockAt(x, y + 1, z)),
    bottom: !isOpaque(getBlockAt(x, y - 1, z)),
    left: !isOpaque(getBlockAt(x - 1, y, z)),
    right: !isOpaque(getBlockAt(x + 1, y, z)),
  }
}

/**
 * Greedy meshing algorithm for optimization
 */
const performGreedyMeshing = (chunk: Chunk, neighborChunks: MeshGenerationRequest['neighborChunks']): VertexData => {
  // Simplified greedy meshing - groups adjacent blocks of same type
  const groups: { [blockType: string]: Array<{ x: number, y: number, z: number, size: { x: number, y: number, z: number } }> } = {}
  const processed = new Set<string>()

  for (let y = 0; y < 256; y++) {
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const index = x + z * 16 + y * 16 * 16
        const blockType = chunk.blocks[index]
        const key = `${x},${y},${z}`

        if (blockType === 'air' || processed.has(key)) continue

        // Try to expand the group
        let sizeX = 1
        let sizeY = 1
        let sizeZ = 1

        // Expand in X direction
        while (x + sizeX < 16) {
          const nextIndex = (x + sizeX) + z * 16 + y * 16 * 16
          if (chunk.blocks[nextIndex] === blockType && !processed.has(`${x + sizeX},${y},${z}`)) {
            sizeX++
          } else {
            break
          }
        }

        // Mark as processed
        for (let dx = 0; dx < sizeX; dx++) {
          processed.add(`${x + dx},${y},${z}`)
        }

        if (!groups[blockType]) groups[blockType] = []
        groups[blockType].push({ x, y, z, size: { x: sizeX, y: sizeY, z: sizeZ } })
      }
    }
  }

  // Generate mesh data from groups
  const allPositions: number[] = []
  const allNormals: number[] = []
  const allUvs: number[] = []
  const allColors: number[] = []
  const allIndices: number[] = []
  let vertexOffset = 0

  Object.entries(groups).forEach(([blockType, blockGroups]) => {
    blockGroups.forEach((group) => {
      // Generate optimized geometry for the group
      const faceVisibility = getFaceVisibility(chunk, neighborChunks, group.x, group.y, group.z)
      const atlasUVs = {
        front: { u: 0, v: 0, w: 0.125, h: 0.125 },
        back: { u: 0.125, v: 0, w: 0.125, h: 0.125 },
        top: { u: 0.25, v: 0, w: 0.125, h: 0.125 },
        bottom: { u: 0.375, v: 0, w: 0.125, h: 0.125 },
        left: { u: 0.5, v: 0, w: 0.125, h: 0.125 },
        right: { u: 0.625, v: 0, w: 0.125, h: 0.125 },
      }

      const vertexData = generateBlockGeometry(group.x, group.y, group.z, blockType, faceVisibility, atlasUVs)

      allPositions.push(...vertexData.positions)
      allNormals.push(...vertexData.normals)
      allUvs.push(...vertexData.uvs)
      allColors.push(...vertexData.colors)

      // Adjust indices
      const adjustedIndices = Array.from(vertexData.indices).map(i => i + vertexOffset)
      allIndices.push(...adjustedIndices)

      vertexOffset += vertexData.positions.length / 3
    })
  })

  return {
    positions: new Float32Array(allPositions),
    normals: new Float32Array(allNormals),
    uvs: new Float32Array(allUvs),
    colors: new Float32Array(allColors),
    indices: new Uint32Array(allIndices),
  }
}

/**
 * Generate LOD mesh with reduced detail
 */
const generateLODMesh = (chunk: Chunk, lodLevel: number): VertexData => {
  const reduction = Math.pow(2, lodLevel) // 1, 2, 4, 8
  const simplifiedBlocks: string[] = []

  // Downsample blocks
  for (let y = 0; y < 256; y += reduction) {
    for (let z = 0; z < 16; z += reduction) {
      for (let x = 0; x < 16; x += reduction) {
        const index = x + z * 16 + y * 16 * 16
        const blockType = chunk.blocks[index] || 'air'
        
        // Use dominant block type in the reduced area
        let dominantBlock = blockType
        let maxCount = 1
        const blockCounts: { [key: string]: number } = { [blockType]: 1 }

        for (let dy = 0; dy < reduction && y + dy < 256; dy++) {
          for (let dz = 0; dz < reduction && z + dz < 16; dz++) {
            for (let dx = 0; dx < reduction && x + dx < 16; dx++) {
              const subIndex = (x + dx) + (z + dz) * 16 + (y + dy) * 16 * 16
              const subBlock = chunk.blocks[subIndex] || 'air'
              blockCounts[subBlock] = (blockCounts[subBlock] || 0) + 1
              
              if (blockCounts[subBlock] > maxCount) {
                maxCount = blockCounts[subBlock]
                dominantBlock = subBlock
              }
            }
          }
        }

        simplifiedBlocks.push(dominantBlock)
      }
    }
  }

  // Generate mesh from simplified blocks (implementation simplified)
  return {
    positions: new Float32Array(),
    normals: new Float32Array(),
    uvs: new Float32Array(),
    colors: new Float32Array(),
    indices: new Uint32Array(),
  }
}

// --- Memory Pools ---

const geometryPool = new ObjectPool<THREE.BufferGeometry>(
  () => new THREE.BufferGeometry(),
  (geometry: THREE.BufferGeometry) => {
    geometry.dispose()
    return new THREE.BufferGeometry()
  },
  256
)

const meshPool = new ObjectPool<THREE.Mesh>(
  () => new THREE.Mesh(),
  (mesh: THREE.Mesh) => {
    if (mesh.geometry) mesh.geometry.dispose()
    if (mesh.material && 'dispose' in mesh.material) {
      (mesh.material as THREE.Material).dispose()
    }
    mesh.geometry = new THREE.BufferGeometry()
    mesh.material = new THREE.MeshBasicMaterial()
    return mesh
  },
  256
)

// --- Worker Schemas ---

const MeshGenerationRequestSchema = S.Struct({
  chunk: S.Struct({
    chunkX: S.Number,
    chunkZ: S.Number,
    blocks: S.Array(S.String),
    entities: S.Array(S.Any),
    blockEntities: S.Array(S.Any),
    biome: S.String,
    isLoaded: S.Boolean,
    lightData: S.Optional(S.Any),
  }),
  neighborChunks: S.Struct({
    north: S.Optional(S.Any),
    south: S.Optional(S.Any),
    east: S.Optional(S.Any),
    west: S.Optional(S.Any),
  }),
  lodLevel: S.Number,
  enableFaceCulling: S.Boolean,
  enableGreedyMeshing: S.Boolean,
})

const MeshGenerationResponseSchema = S.Struct({
  chunkKey: S.String,
  vertexData: S.Struct({
    positions: S.Any, // Float32Array
    normals: S.Any,
    uvs: S.Any,
    colors: S.Any,
    indices: S.Any,
    instanceMatrices: S.Optional(S.Any),
    instanceColors: S.Optional(S.Any),
  }),
  instancedData: S.Optional(S.Record(S.String, S.Struct({
    matrices: S.Any,
    colors: S.Any,
    count: S.Number,
  }))),
  lodLevel: S.Number,
  boundingBox: S.Any, // THREE.Box3 serialized
  triangleCount: S.Number,
})

// --- Main Service ---

export interface MeshBuilderService {
  generateChunkMesh: (request: MeshGenerationRequest) => Effect.Effect<MeshGenerationResponse, never, never>
  createInstancedMesh: (blockType: string, maxInstances: number) => Effect.Effect<InstancedMeshData, never, never>
  updateInstancedMesh: (meshData: InstancedMeshData, chunkKey: string, instances: Float32Array) => Effect.Effect<void, never, never>
  generateLOD: (chunk: Chunk, lodLevel: number) => Effect.Effect<VertexData, never, never>
  optimizeMesh: (vertexData: VertexData) => Effect.Effect<VertexData, never, never>
  createGeometry: (vertexData: VertexData) => Effect.Effect<THREE.BufferGeometry, never, never>
  disposeMesh: (mesh: THREE.Mesh) => Effect.Effect<void, never, never>
}

export const MeshBuilderService = Effect.Tag<MeshBuilderService>('MeshBuilderService')

export const MeshBuilderLive = Layer.effect(
  MeshBuilderService,
  Effect.gen(function* (_) {
    // Worker client for mesh generation
    const workerClientConfig: WorkerClientConfig<MeshGenerationRequest, MeshGenerationResponse> = {
      inputSchema: MeshGenerationRequestSchema,
      outputSchema: MeshGenerationResponseSchema,
      timeout: 10000, // 10 seconds in milliseconds
      maxConcurrentRequests: 4,
    }

    const workerClient = CONFIG.WORKER_ENABLED 
      ? yield* _(createTypedWorkerClient(
          new Worker('/workers/mesh-generation.worker.js'), 
          workerClientConfig
        ))
      : null

    return {
      generateChunkMesh: (request: MeshGenerationRequest) =>
        Effect.gen(function* () {
          if (workerClient && CONFIG.WORKER_ENABLED) {
            // Use worker for mesh generation
            return yield* _(workerClient.sendRequest(request))
          } else {
            // Generate mesh on main thread
            const chunkKey = `${request.chunk.chunkX},${request.chunk.chunkZ}`
            const vertexData = request.enableGreedyMeshing
              ? performGreedyMeshing(request.chunk, request.neighborChunks)
              : generateBlockMeshData(request.chunk, request.neighborChunks)

            return {
              chunkKey,
              vertexData,
              lodLevel: request.lodLevel,
              boundingBox: new THREE.Box3(
                new THREE.Vector3(request.chunk.chunkX * 16, 0, request.chunk.chunkZ * 16),
                new THREE.Vector3((request.chunk.chunkX + 1) * 16, 256, (request.chunk.chunkZ + 1) * 16)
              ),
              triangleCount: vertexData.indices.length / 3,
            }
          }
        }),

      createInstancedMesh: (blockType: string, maxInstances: number) =>
        Effect.gen(function* () {
          const geometry = geometryPool.acquire()
          const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            transparent: blockType === 'water',
            opacity: blockType === 'water' ? 0.8 : 1.0,
          })

          // Create unit cube geometry for instancing
          const cubeGeometry = new THREE.BoxGeometry(1, 1, 1)
          geometry.copy(cubeGeometry)
          cubeGeometry.dispose()

          const mesh = new THREE.InstancedMesh(geometry, material, maxInstances)
          
          return {
            geometry,
            material,
            mesh,
            instances: new Map<string, number>(),
            availableSlots: Array.from({ length: maxInstances }, (_, i) => i),
            maxInstances,
          }
        }),

      updateInstancedMesh: (meshData: InstancedMeshData, chunkKey: string, instances: Float32Array) =>
        Effect.gen(function* () {
          const instanceCount = instances.length / 16 // 4x4 matrix = 16 floats per instance
          
          for (let i = 0; i < instanceCount; i++) {
            const slotIndex = meshData.availableSlots.pop()
            if (slotIndex !== undefined) {
              const matrix = new THREE.Matrix4()
              const offset = i * 16
              matrix.fromArray(instances, offset)
              meshData.mesh.setMatrixAt(slotIndex, matrix)
              meshData.instances.set(`${chunkKey}-${i}`, slotIndex)
            }
          }
          
          meshData.mesh.instanceMatrix.needsUpdate = true
        }),

      generateLOD: (chunk: Chunk, lodLevel: number) =>
        Effect.succeed(generateLODMesh(chunk, lodLevel)),

      optimizeMesh: (vertexData: VertexData) =>
        Effect.gen(function* () {
          // Perform vertex deduplication and optimization
          const positionMap = new Map<string, number>()
          const optimizedPositions: number[] = []
          const optimizedNormals: number[] = []
          const optimizedUvs: number[] = []
          const optimizedColors: number[] = []
          const optimizedIndices: number[] = []

          for (let i = 0; i < vertexData.indices.length; i++) {
            const originalIndex = vertexData.indices[i]
            const px = vertexData.positions[originalIndex * 3]
            const py = vertexData.positions[originalIndex * 3 + 1]
            const pz = vertexData.positions[originalIndex * 3 + 2]
            const key = `${px.toFixed(3)},${py.toFixed(3)},${pz.toFixed(3)}`

            if (!positionMap.has(key)) {
              const newIndex = optimizedPositions.length / 3
              positionMap.set(key, newIndex)
              
              optimizedPositions.push(px, py, pz)
              optimizedNormals.push(
                vertexData.normals[originalIndex * 3],
                vertexData.normals[originalIndex * 3 + 1],
                vertexData.normals[originalIndex * 3 + 2]
              )
              optimizedUvs.push(
                vertexData.uvs[originalIndex * 2],
                vertexData.uvs[originalIndex * 2 + 1]
              )
              optimizedColors.push(
                vertexData.colors[originalIndex * 3],
                vertexData.colors[originalIndex * 3 + 1],
                vertexData.colors[originalIndex * 3 + 2]
              )
              optimizedIndices.push(newIndex)
            } else {
              optimizedIndices.push(positionMap.get(key)!)
            }
          }

          return {
            positions: new Float32Array(optimizedPositions),
            normals: new Float32Array(optimizedNormals),
            uvs: new Float32Array(optimizedUvs),
            colors: new Float32Array(optimizedColors),
            indices: new Uint32Array(optimizedIndices),
          }
        }),

      createGeometry: (vertexData: VertexData) =>
        Effect.gen(function* () {
          const geometry = geometryPool.acquire()
          
          geometry.setAttribute('position', new THREE.BufferAttribute(vertexData.positions, 3))
          geometry.setAttribute('normal', new THREE.BufferAttribute(vertexData.normals, 3))
          geometry.setAttribute('uv', new THREE.BufferAttribute(vertexData.uvs, 2))
          geometry.setAttribute('color', new THREE.BufferAttribute(vertexData.colors, 3))
          geometry.setIndex(new THREE.BufferAttribute(vertexData.indices, 1))
          
          if (vertexData.instanceMatrices) {
            geometry.setAttribute('instanceMatrix', new THREE.InstancedBufferAttribute(vertexData.instanceMatrices, 16))
          }
          
          geometry.computeBoundingBox()
          geometry.computeBoundingSphere()
          
          return geometry
        }),

      disposeMesh: (mesh: THREE.Mesh) =>
        Effect.gen(function* () {
          if (mesh.geometry) {
            geometryPool.release(mesh.geometry)
          }
          
          if (mesh.material && 'dispose' in mesh.material) {
            (mesh.material as THREE.Material).dispose()
          }
          
          meshPool.release(mesh)
        }),
    }
  }),
)

// Helper function for generating block mesh data
const generateBlockMeshData = (chunk: Chunk, neighborChunks: MeshGenerationRequest['neighborChunks']): VertexData => {
  const allPositions: number[] = []
  const allNormals: number[] = []
  const allUvs: number[] = []
  const allColors: number[] = []
  const allIndices: number[] = []
  let vertexOffset = 0

  const atlasUVs = {
    front: { u: 0, v: 0, w: 0.125, h: 0.125 },
    back: { u: 0.125, v: 0, w: 0.125, h: 0.125 },
    top: { u: 0.25, v: 0, w: 0.125, h: 0.125 },
    bottom: { u: 0.375, v: 0, w: 0.125, h: 0.125 },
    left: { u: 0.5, v: 0, w: 0.125, h: 0.125 },
    right: { u: 0.625, v: 0, w: 0.125, h: 0.125 },
  }

  for (let y = 0; y < 256; y++) {
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const index = x + z * 16 + y * 16 * 16
        const blockType = chunk.blocks[index]
        
        if (blockType === 'air') continue

        const faceVisibility = getFaceVisibility(chunk, neighborChunks, x, y, z)
        const vertexData = generateBlockGeometry(x, y, z, blockType, faceVisibility, atlasUVs)

        allPositions.push(...vertexData.positions)
        allNormals.push(...vertexData.normals)
        allUvs.push(...vertexData.uvs)
        allColors.push(...vertexData.colors)

        // Adjust indices
        const adjustedIndices = Array.from(vertexData.indices).map(i => i + vertexOffset)
        allIndices.push(...adjustedIndices)

        vertexOffset += vertexData.positions.length / 3
      }
    }
  }

  return {
    positions: new Float32Array(allPositions),
    normals: new Float32Array(allNormals),
    uvs: new Float32Array(allUvs),
    colors: new Float32Array(allColors),
    indices: new Uint32Array(allIndices),
  }
}

// Export types and configuration
export type { VertexData, MeshGenerationRequest, MeshGenerationResponse, InstancedMeshData, LODConfig, FaceVisibility }
export { CONFIG as MeshBuilderConfig }