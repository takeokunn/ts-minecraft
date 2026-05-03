import { Effect, MutableRef, Option } from 'effect'
import { vi } from 'vitest'
import * as THREE from 'three'
import { RaycastingService, type RaycastHit } from '@ts-minecraft/rendering'

export const createMockRaycastingService = (
  hitResult: Option.Option<RaycastHit> = Option.none()
) => {
  return {
    createRaycaster: () =>
      Effect.sync(() => {
        const raycaster = new THREE.Raycaster()
        raycaster.far = 5
        return raycaster
      }),
    raycastFromCamera: vi.fn(() => Effect.sync(() => hitResult)),
    worldToBlock: vi.fn((worldPos: { x: number; y: number; z: number }) =>
      Effect.sync(() => ({
        x: Math.floor(worldPos.x),
        y: Math.floor(worldPos.y),
        z: Math.floor(worldPos.z),
      }))
    ),
  } as unknown as RaycastingService
}

export const createMockScene = () => {
  const children: THREE.Object3D[] = []
  return {
    scene: {
      add: vi.fn((obj: THREE.Object3D) => {
        children.push(obj)
      }),
      remove: vi.fn((obj: THREE.Object3D) => {
        const index = children.indexOf(obj)
        if (index > -1) {
          children.splice(index, 1)
        }
      }),
      children,
    } as unknown as THREE.Scene,
    getChildren: () => children,
  }
}

export const createMockCamera = () => {
  return new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
}

export { MutableRef, Option, THREE, RaycastingService }
