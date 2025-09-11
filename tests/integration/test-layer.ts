/**
 * Test Layer Implementation
 *
 * This file provides comprehensive mock implementations for all ports
 * and services needed for integration testing. It ensures tests are
 * isolated and don't depend on external systems.
 */

import { Layer, Effect, Context, Ref, Queue } from 'effect'
import { MathPort, RenderPort, WorldRepositoryPort, TerrainGeneratorPort, SpatialGridPort } from '@domain/ports'
import { WorldDomainService, PhysicsDomainService, EntityDomainService } from '@infrastructure/layers'

// Mock implementations for all ports
const mockMathPortImpl = {
  vector3: {
    create: (x: number, y: number, z: number) => Effect.succeed({ x, y, z }),
    add: (a: any, b: any) => Effect.succeed({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
    subtract: (a: any, b: any) => Effect.succeed({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
    multiply: (v: any, s: number) => Effect.succeed({ x: v.x * s, y: v.y * s, z: v.z * s }),
    dot: (a: any, b: any) => Effect.succeed(a.x * b.x + a.y * b.y + a.z * b.z),
    cross: (a: any, b: any) => Effect.succeed({
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    }),
    magnitude: (v: any) => Effect.succeed(Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)),
    normalize: (v: any) => Effect.gen(function* () {
      const mag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
      return mag > 0 ? { x: v.x / mag, y: v.y / mag, z: v.z / mag } : { x: 0, y: 0, z: 0 }
    }),
    distance: (a: any, b: any) => Effect.succeed(Math.sqrt(
      (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2
    )),
    lerp: (a: any, b: any, t: number) => Effect.succeed({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t
    })
  },
  quaternion: {
    create: (x: number, y: number, z: number, w: number) => Effect.succeed({ x, y, z, w }),
    identity: () => Effect.succeed({ x: 0, y: 0, z: 0, w: 1 }),
    multiply: (a: any, b: any) => Effect.succeed({
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y + a.y * b.w + a.z * b.x - a.x * b.z,
      z: a.w * b.z + a.z * b.w + a.x * b.y - a.y * b.x
    }),
    conjugate: (q: any) => Effect.succeed({ x: -q.x, y: -q.y, z: -q.z, w: q.w }),
    normalize: (q: any) => Effect.gen(function* () {
      const mag = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w)
      return mag > 0 ? { x: q.x / mag, y: q.y / mag, z: q.z / mag, w: q.w / mag } : { x: 0, y: 0, z: 0, w: 1 }
    }),
    fromAxisAngle: (axis: any, angle: number) => Effect.succeed({
      x: axis.x * Math.sin(angle / 2),
      y: axis.y * Math.sin(angle / 2),
      z: axis.z * Math.sin(angle / 2),
      w: Math.cos(angle / 2)
    }),
    fromEuler: (pitch: number, yaw: number, roll: number) => Effect.succeed({ x: 0, y: 0, z: 0, w: 1 }),
    toEuler: (q: any) => Effect.succeed({ pitch: 0, yaw: 0, roll: 0 }),
    rotateVector: (q: any, v: any) => Effect.succeed(v) // Simplified for testing
  },
  matrix4: {
    create: () => Effect.succeed({ elements: Array(16).fill(0).map((_, i) => i % 5 === 0 ? 1 : 0) as any }),
    identity: () => Effect.succeed({ elements: [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] as any }),
    fromArray: (elements: readonly number[]) => Effect.succeed({ elements: [...elements] as any }),
    multiply: (a: any, b: any) => Effect.succeed({ elements: Array(16).fill(0) as any }),
    multiplyVector3: (matrix: any, vector: any) => Effect.succeed(vector),
    transpose: (matrix: any) => Effect.succeed(matrix),
    invert: (matrix: any) => Effect.succeed(matrix),
    translate: (matrix: any, vector: any) => Effect.succeed(matrix),
    rotate: (matrix: any, axis: any, angle: number) => Effect.succeed(matrix),
    scale: (matrix: any, vector: any) => Effect.succeed(matrix),
    lookAt: (eye: any, center: any, up: any) => Effect.succeed({ elements: [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] as any }),
    perspective: (fov: number, aspect: number, near: number, far: number) => Effect.succeed({ elements: [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] as any })
  },
  ray: {
    create: (origin: any, direction: any) => Effect.succeed({ origin, direction }),
    at: (ray: any, distance: number) => Effect.succeed({
      x: ray.origin.x + ray.direction.x * distance,
      y: ray.origin.y + ray.direction.y * distance,
      z: ray.origin.z + ray.direction.z * distance
    }),
    intersectsSphere: (ray: any, center: any, radius: number) => Effect.succeed({ hit: false }),
    intersectsPlane: (ray: any, normal: any, distance: number) => Effect.succeed({ hit: false }),
    intersectsBox: (ray: any, min: any, max: any) => Effect.succeed({ hit: false })
  }
}

const mockRenderPortImpl = {
  createMesh: (id: string, data: any) => Effect.succeed(undefined as void),
  updateMesh: (id: string, data: any) => Effect.succeed(undefined as void),
  destroyMesh: (id: string) => Effect.succeed(undefined as void),
  setMeshPosition: (id: string, position: any) => Effect.succeed(undefined as void),
  setMeshRotation: (id: string, rotation: any) => Effect.succeed(undefined as void),
  setMeshScale: (id: string, scale: any) => Effect.succeed(undefined as void),
  setMeshVisible: (id: string, visible: boolean) => Effect.succeed(undefined as void),
  getMeshInfo: (id: string) => Effect.succeed({ 
    id, 
    position: { x: 0, y: 0, z: 0 }, 
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    visible: true 
  })
}

const mockWorldRepositoryPortImpl = {
  save: (world: any) => Effect.succeed(undefined as void),
  load: () => Effect.succeed({
    chunks: new Map(),
    entities: new Set(),
    timestamp: Date.now()
  }),
  exists: () => Effect.succeed(true),
  delete: () => Effect.succeed(undefined as void),
  backup: () => Effect.succeed(undefined as void),
  restore: (backupId: string) => Effect.succeed(undefined as void)
}

const mockTerrainGeneratorPortImpl = {
  generateChunk: (x: number, z: number) => Effect.succeed({
    coordinate: { x, z },
    blocks: new Map(),
    entities: new Set(),
    meshData: {
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: new Uint16Array([0, 1, 2]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1])
    },
    generated: true,
    lastModified: Date.now()
  }),
  generateTerrain: (minX: number, minZ: number, maxX: number, maxZ: number) => Effect.succeed({
    chunks: [],
    biomeData: new Map(),
    heightMap: new Map()
  }),
  getBiome: (x: number, z: number) => Effect.succeed('plains'),
  getHeight: (x: number, z: number) => Effect.succeed(64),
  setSeed: (seed: number) => Effect.succeed(undefined as void)
}

const mockSpatialGridPortImpl = {
  addEntity: (entityId: string, position: any) => Effect.succeed(undefined as void),
  removeEntity: (entityId: string) => Effect.succeed(undefined as void),
  updateEntity: (entityId: string, position: any) => Effect.succeed(undefined as void),
  getEntitiesInRadius: (center: any, radius: number) => Effect.succeed([]),
  getEntitiesInRegion: (min: any, max: any) => Effect.succeed([]),
  clear: () => Effect.succeed(undefined as void),
  getEntityPosition: (entityId: string) => Effect.succeed({ x: 0, y: 0, z: 0 }),
  getEntityCount: () => Effect.succeed(0)
}

// Layer implementations
const MockMathPortLive = Layer.succeed(MathPort, mockMathPortImpl)
const MockRenderPortLive = Layer.succeed(RenderPort, mockRenderPortImpl)
const MockWorldRepositoryPortLive = Layer.succeed(WorldRepositoryPort, mockWorldRepositoryPortImpl)
const MockTerrainGeneratorPortLive = Layer.succeed(TerrainGeneratorPort, mockTerrainGeneratorPortImpl)
const MockSpatialGridPortLive = Layer.succeed(SpatialGridPort, mockSpatialGridPortImpl)

// Enhanced domain service implementations with additional methods for testing
const mockWorldDomainServiceImpl = {
  validatePosition: (position: { x: number; y: number; z: number }) => 
    Effect.succeed(
      !isNaN(position.x) && !isNaN(position.y) && !isNaN(position.z) && 
      isFinite(position.x) && isFinite(position.y) && isFinite(position.z)
    ),
  isValidBlockPlacement: (position: any, blockType: string) => Effect.succeed(true),
  validateWorldState: (state: any) => Effect.succeed(true),
  addEntityToWorld: (entityId: string, entityData: any) => Effect.succeed(undefined as void),
  removeEntityFromWorld: (entityId: string) => Effect.succeed(undefined as void),
  addChunkToWorld: (chunk: any) => Effect.succeed(undefined as void),
  removeChunkFromWorld: (coordinate: any) => Effect.succeed(undefined as void),
  getChunk: (chunkX: number, chunkZ: number) => Effect.succeed({
    blocks: [],
    entities: [],
    lastUpdate: Date.now()
  }),
  getLoadedChunks: () => Effect.succeed([])
}

const mockPhysicsDomainServiceImpl = {
  calculateGravity: (position: { x: number; y: number; z: number }) => 
    Effect.succeed({ x: 0, y: -9.81, z: 0 }),
  simulatePhysics: (deltaTime: number) => Effect.succeed(undefined as void),
  detectCollisions: () => Effect.succeed([]),
  applyForces: (entityId: string, force: any) => Effect.succeed(undefined as void),
  updateRigidBody: (entityId: string, position: any, velocity: any) => Effect.succeed(undefined as void),
  getEntityVelocity: (entityId: string) => Effect.succeed({ dx: 0, dy: 0, dz: 0 }),
  isEntityGrounded: (entityId: string) => Effect.succeed(true),
  getAllPhysicsObjects: () => Effect.succeed([])
}

const mockEntityDomainServiceImpl = {
  createEntity: () => Effect.succeed('test-entity-id'),
  destroyEntity: (entityId: string) => Effect.succeed(undefined as void),
  hasEntity: (entityId: string) => Effect.succeed(true),
  getEntityCount: () => Effect.succeed(0),
  getEntity: (entityId: string) => Effect.succeed({
    id: entityId,
    health: 100,
    inventory: []
  }),
  getAllEntities: () => Effect.succeed([]),
  getEntitiesByType: (entityType: string) => Effect.succeed([]),
  getEntitiesInRadius: (center: any, radius: number) => Effect.succeed([])
}

const MockWorldDomainServiceLive = Layer.succeed(WorldDomainService, mockWorldDomainServiceImpl)
const MockPhysicsDomainServiceLive = Layer.succeed(PhysicsDomainService, mockPhysicsDomainServiceImpl)
const MockEntityDomainServiceLive = Layer.succeed(EntityDomainService, mockEntityDomainServiceImpl)

/**
 * Complete test layer with all mocks
 * This provides a fully isolated testing environment
 */
export const TestLayer = Layer.mergeAll(
  // Port mocks
  MockMathPortLive,
  MockRenderPortLive,
  MockWorldRepositoryPortLive,
  MockTerrainGeneratorPortLive,
  MockSpatialGridPortLive,
  
  // Domain service mocks
  MockWorldDomainServiceLive,
  MockPhysicsDomainServiceLive,
  MockEntityDomainServiceLive
)

/**
 * Minimal test layer with just essential services
 */
export const MinimalTestLayer = Layer.mergeAll(
  MockMathPortLive,
  MockWorldDomainServiceLive,
  MockPhysicsDomainServiceLive,
  MockEntityDomainServiceLive
)