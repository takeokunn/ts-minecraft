import { Effect } from 'effect'
import * as THREE from 'three'
import { blockTypeToIndex } from '@ts-minecraft/core'
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
      return {
        chunkCoord: mesh.userData.chunkCoord,
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
  return {
    sceneChildren: scene.children.length,
    chunkMeshCount: chunkMeshes.length,
    visibleChunkMeshCount: chunkMeshes.filter((mesh) => mesh.visible).length,
    camera: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      near: camera.near,
      far: camera.far,
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

export const setTimeOfDayForQA = (timeService: TimeService, timeOfDay: number) =>
  Effect.runPromise(timeService.setTimeOfDay(timeOfDay))
