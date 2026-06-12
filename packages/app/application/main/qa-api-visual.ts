import { Effect, MutableRef } from 'effect'
import * as THREE from 'three'
import type { Position } from '@ts-minecraft/core'
import type { PlayerCameraStateService } from '@ts-minecraft/entity'
import type { BlockHighlightService } from '@ts-minecraft/presentation/highlight/block-highlight'
import type { StagedResourceBlock } from '@ts-minecraft/app/main/qa-api-types'

const makeSetAimForQA = (
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  playerCameraState: PlayerCameraStateService,
  blockHighlight: BlockHighlightService,
) => (target: Position): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const dx = target.x - camera.position.x
    const dy = target.y - camera.position.y
    const dz = target.z - camera.position.z
    const yaw = Math.atan2(dx, -dz)
    const pitch = Math.atan2(dy, Math.hypot(dx, dz))
    yield* playerCameraState.setYaw(yaw)
    yield* playerCameraState.setPitch(pitch)
    yield* Effect.sync(() => {
      camera.rotation.set(pitch, yaw, 0, 'YXZ')
      camera.updateMatrixWorld(true)
      scene.updateMatrixWorld(true)
    })
    yield* blockHighlight.invalidateCache()
    yield* blockHighlight.update(camera, scene)
  })

export const aimAtStagedResource = (
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  playerCameraState: PlayerCameraStateService,
  blockHighlight: BlockHighlightService,
  stagedResourceBlocksRef: MutableRef.MutableRef<Array<StagedResourceBlock>>,
  resourceIndex: number,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const target = MutableRef.get(stagedResourceBlocksRef)[resourceIndex]
    if (!target) return
    const setAimForQA = makeSetAimForQA(camera, scene, playerCameraState, blockHighlight)
    yield* setAimForQA({ x: target.pos.x + 0.5, y: target.pos.y + 0.5, z: target.pos.z + 0.5 })
    yield* blockHighlight.setTargetForQA(
      { x: target.pos.x, y: target.pos.y, z: target.pos.z },
      {
        point: { x: target.pos.x + 0.5, y: target.pos.y + 0.5, z: target.pos.z + 0.5 },
        normal: { x: 0, y: 0, z: 1 },
        distance: 4,
        blockX: target.pos.x,
        blockY: target.pos.y,
        blockZ: target.pos.z,
      },
    )
  }))

export const aimAtBuildSpot = (
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  playerCameraState: PlayerCameraStateService,
  blockHighlight: BlockHighlightService,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)
    direction.normalize()
    const wx = Math.floor(camera.position.x + direction.x * 4)
    const wy = Math.floor(camera.position.y)
    const wz = Math.floor(camera.position.z + direction.z * 4)
    const setAimForQA = makeSetAimForQA(camera, scene, playerCameraState, blockHighlight)
    yield* setAimForQA({ x: wx + 0.5, y: wy + 0.5, z: wz + 0.5 })
    yield* blockHighlight.setTargetForQA(
      { x: wx, y: wy, z: wz },
      {
        point: { x: wx + 0.5, y: wy + 0.5, z: wz + 0.5 },
        normal: { x: 0, y: 1, z: 0 },
        distance: 4,
        blockX: wx,
        blockY: wy,
        blockZ: wz,
      },
    )
  }))

export const aimAtStagedZombie = (
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  playerCameraState: PlayerCameraStateService,
  blockHighlight: BlockHighlightService,
  stagedZombiePositionRef: MutableRef.MutableRef<Position | null>,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const stagedZombiePosition = MutableRef.get(stagedZombiePositionRef)
    if (!stagedZombiePosition) return
    const setAimForQA = makeSetAimForQA(camera, scene, playerCameraState, blockHighlight)
    yield* setAimForQA({ x: stagedZombiePosition.x, y: stagedZombiePosition.y + 0.9, z: stagedZombiePosition.z })
    yield* blockHighlight.clearTargetForQA()
  }))

export const dispatchMouseClick = (button: 0 | 2) =>
  Effect.runPromise(Effect.sync(() => {
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button }))
    if (button === 2) {
      document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button }))
    }
  }))
