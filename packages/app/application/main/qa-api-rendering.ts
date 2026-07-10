import { Effect } from 'effect'
import * as THREE from 'three'
import { Option } from 'effect'
import { blockTypeToIndex, decodeBlockType } from '@ts-minecraft/core'
import { worldToBlockIndex } from '@ts-minecraft/world'
import type { ChunkManagerService } from '@ts-minecraft/world'
import type { TimeService } from '@ts-minecraft/game'
import type { QaChunkCoord, QaChunkMeshSnapshot, QaRenderingSnapshot } from '@ts-minecraft/app/main/qa-api-types/rendering'
import { getUnknownProperty } from '@ts-minecraft/app/main/qa-api-env'

type ChunkMeshWithCoord = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]> & {
  readonly userData: { readonly chunkCoord: QaChunkCoord }
}

const isQaChunkCoord = (value: unknown): value is QaChunkCoord =>
  typeof value === 'object' &&
  value !== null &&
  typeof getUnknownProperty(value, 'x') === 'number' &&
  typeof getUnknownProperty(value, 'z') === 'number'

const isChunkMeshWithCoord = (child: THREE.Object3D): child is ChunkMeshWithCoord =>
  child instanceof THREE.Mesh && isQaChunkCoord(getUnknownProperty(child.userData, 'chunkCoord'))

const getMaterialType = (material: THREE.Material | readonly THREE.Material[]): string => {
  const firstMaterial = Array.isArray(material) ? material[0] : material
  return firstMaterial?.type ?? 'UnknownMaterial'
}

const isAtlasTextureLoaded = (material: THREE.Material | readonly THREE.Material[]): boolean => {
  const firstMaterial = Array.isArray(material) ? material[0] : material
  return firstMaterial instanceof THREE.MeshLambertMaterial && Boolean(firstMaterial.map?.image)
}

const getChunkMeshSnapshots = (scene: THREE.Scene): ReadonlyArray<QaChunkMeshSnapshot> =>
  scene.children
    .filter(isChunkMeshWithCoord)
    .map((mesh) => {
      const position = mesh.geometry.getAttribute('position')
      const uv = mesh.geometry.getAttribute('uv')
      const tileIndex = mesh.geometry.getAttribute('tileIndex')
      // Vertex-baked light stats (color G channel = sky-light factor). avg≈0 while the
      // authoritative chunk cache says sky=15 ⇒ the mesh was baked with stale light.
      const color = mesh.geometry.getAttribute('color')
      let skySum = 0
      let skyMax = 0
      if (color !== undefined) {
        for (let i = 0; i < color.count; i++) {
          const g = color.getY(i)
          skySum += g
          if (g > skyMax) skyMax = g
        }
      }
      return {
        chunkCoord: mesh.userData.chunkCoord,
        chunkMaxY: (mesh.userData as { chunkMaxY?: number }).chunkMaxY,
        avgSkyFactor: color !== undefined && color.count > 0 ? skySum / color.count : -1,
        maxSkyFactor: color !== undefined ? skyMax : -1,
        type: mesh.type,
        visible: mesh.visible,
        vertexCount: position?.count ?? 0,
        indexCount: mesh.geometry.index?.count ?? 0,
        hasUv: uv !== undefined,
        hasTileIndex: tileIndex !== undefined,
        tileIndexCount: tileIndex?.count ?? 0,
        materialType: getMaterialType(mesh.material),
        textureLoaded: isAtlasTextureLoaded(mesh.material),
      }
    })

export const getRenderingSnapshot = (camera: THREE.PerspectiveCamera, scene: THREE.Scene): QaRenderingSnapshot => {
  const chunkMeshes = getChunkMeshSnapshots(scene)
  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  return {
    sceneChildren: scene.children.length,
    chunkMeshCount: chunkMeshes.length,
    visibleChunkMeshCount: chunkMeshes.filter((mesh) => mesh.visible).length,
    camera: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      fov: camera.fov,
      near: camera.near,
      far: camera.far,
      forwardX: forward.x,
      forwardY: forward.y,
      forwardZ: forward.z,
      qx: camera.quaternion.x,
      qy: camera.quaternion.y,
      qz: camera.quaternion.z,
      qw: camera.quaternion.w,
    },
    chunks: chunkMeshes,
  }
}

export const getLoadedWaterBlockCount = (chunkManagerService: ChunkManagerService) =>
  Effect.runPromise(Effect.gen(function* () {
    const chunks = yield* chunkManagerService.getLoadedChunks()
    const waterBlockIndex = blockTypeToIndex('WATER')
    let count = 0
    for (const chunk of chunks) {
      for (const block of chunk.blocks) {
        if (block === waterBlockIndex) count += 1
      }
    }
    return count
  }))

// Reads the authoritative chunk-cache block at a world position — the same data
// the crafting-station proximity scan sees. Diagnostic surface for QA.
export const getBlockTypeAtForQA = (chunkManagerService: ChunkManagerService, x: number, y: number, z: number) =>
  Effect.runPromise(Effect.gen(function* () {
    const { chunkCoord, flatIdx } = worldToBlockIndex({ x, y, z })
    const chunkOpt = yield* chunkManagerService.getChunk(chunkCoord).pipe(Effect.option)
    return chunkOpt._tag === 'Some'
      ? Option.getOrNull(decodeBlockType(chunkOpt.value.blocks[flatIdx]))
      : null
  }))

// Reads the authoritative chunk-cache light levels at a world position.
// Diagnostic surface for QA (black-terrain triage: sky=0 at noon renders black).
// Light grids are 4-bit packed (2 voxels/byte): even voxel index = low nibble.
export const getLightAtForQA = (chunkManagerService: ChunkManagerService, x: number, y: number, z: number) =>
  Effect.runPromise(Effect.gen(function* () {
    const { chunkCoord, flatIdx } = worldToBlockIndex({ x, y, z })
    const chunkOpt = yield* chunkManagerService.getChunk(chunkCoord).pipe(Effect.option)
    if (chunkOpt._tag === 'None') return null
    const chunk = chunkOpt.value
    const unpack = (grid: Uint8Array | undefined): number => {
      if (grid === undefined) return -1
      const byte = grid[flatIdx >> 1] ?? 0
      return (flatIdx & 1) === 0 ? byte & 0x0f : (byte >> 4) & 0x0f
    }
    return {
      block: Option.getOrNull(decodeBlockType(chunk.blocks[flatIdx])),
      rawId: chunk.blocks[flatIdx] ?? -1,
      sky: unpack(chunk.skyLight),
      blockLight: unpack(chunk.blockLight),
      hasSkyGrid: chunk.skyLight !== undefined,
    }
  }))

export const setTimeOfDayForQA = (timeService: TimeService, timeOfDay: number) =>
  Effect.runPromise(timeService.setTimeOfDay(timeOfDay))
