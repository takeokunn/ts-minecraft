import { Effect, MutableRef } from 'effect'
import * as THREE from 'three'
import type { Position } from '@ts-minecraft/core'
import type { PlayerCameraStateService } from '@ts-minecraft/entity/application/camera-state'
import type { EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager'
import type { BlockHighlightService } from '@ts-minecraft/presentation'
import type { StagedResourceBlock } from '@ts-minecraft/app/main/qa-api-types/staged'
import { projectBlockAhead } from '@ts-minecraft/app/main/qa-spatial'

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
    // three.js YXZ camera forward = (−cosP·sinYaw, sinP, −cosP·cosYaw), so the
    // yaw that faces (dx,dz) is atan2(−dx, −dz). The old atan2(dx, −dz) MIRRORED
    // every aim across the x-axis — unnoticed because the other aim helpers force
    // the highlight target anyway; aimNaturalForQA relies on the real raycast.
    const yaw = Math.atan2(-dx, -dz)
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

// Aims at an ARBITRARY world block by coordinate and forces the highlight
// target to it, so a subsequent right/left click resolves to that exact block.
// Unblocks live station-interaction tests (anvil rename/repair, enchanting
// table, chest, furnace) on real terrain, where the crosshair otherwise can't
// be reliably put on a placed block — aimAtBuildSpot only hits the fixed
// build spot, and aimNaturalForQA depends on the block being within raycast reach.
export const aimAtBlockForQA = (
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  playerCameraState: PlayerCameraStateService,
  blockHighlight: BlockHighlightService,
  x: number,
  y: number,
  z: number,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const setAimForQA = makeSetAimForQA(camera, scene, playerCameraState, blockHighlight)
    yield* setAimForQA({ x: x + 0.5, y: y + 0.5, z: z + 0.5 })
    yield* blockHighlight.setTargetForQA(
      { x, y, z },
      {
        point: { x: x + 0.5, y: y + 0.5, z: z + 0.5 },
        normal: { x: 0, y: 1, z: 0 },
        distance: Math.hypot(x + 0.5 - camera.position.x, y + 0.5 - camera.position.y, z + 0.5 - camera.position.z),
        blockX: x,
        blockY: y,
        blockZ: z,
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
    // MUST match stageBuildSupportBlock's projectBlockAhead(camera, 3) exactly —
    // this forces the highlight target, and any divergence (this used to inline
    // the projection at distance 4) points the break handler at an AIR cell
    // one block past the staged STONE, so hold-to-break never starts.
    const { x: wx, y: wy, z: wz } = projectBlockAhead(camera, 3)
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

// Aims the camera at a world position WITHOUT forcing a highlight override —
// the block target comes from the real per-frame raycast against the scene,
// exercising the same targeting path a mouse-driven player uses. This is the
// only QA aim that validates raycast block resolution (aimAtBuildSpot and
// aimAtStagedResource both force the target and bypass it).
export const aimNaturalForQA = (
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  playerCameraState: PlayerCameraStateService,
  blockHighlight: BlockHighlightService,
  target: Position,
) =>
  Effect.runPromise(Effect.gen(function* () {
    yield* blockHighlight.clearTargetForQA()
    const setAimForQA = makeSetAimForQA(camera, scene, playerCameraState, blockHighlight)
    yield* setAimForQA(target)
  }))

export const aimAtStagedZombie = (
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  playerCameraState: PlayerCameraStateService,
  blockHighlight: BlockHighlightService,
  stagedZombiePositionRef: MutableRef.MutableRef<Position | null>,
  entityManager: EntityManager,
) =>
  Effect.runPromise(Effect.gen(function* () {
    // Aim at the zombie's LIVE position, not the staged spawn point: the mob
    // falls/settles after spawning (it spawns at camera height), so a ray at
    // the stale coordinate passes over its head and real left-click melee
    // (attack cone = ray ± PLAYER_ATTACK_RADIUS) can never connect.
    const entities = yield* entityManager.getEntities()
    const liveZombie = entities.find((entity) => entity.type === 'Zombie') ?? null
    const target = liveZombie?.position ?? MutableRef.get(stagedZombiePositionRef)
    if (!target) return
    const setAimForQA = makeSetAimForQA(camera, scene, playerCameraState, blockHighlight)
    // +0.9 = ENTITY_CENTER_Y_OFFSET used by combat targeting.
    yield* setAimForQA({ x: target.x, y: target.y + 0.9, z: target.z })
    yield* blockHighlight.clearTargetForQA()
  }))

export const dispatchMouseClick = (button: 0 | 1 | 2) =>
  Effect.runPromise(Effect.sync(() => {
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button }))
    if (button === 2) {
      document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button }))
    }
  }))

// Holds or releases a mouse button through the REAL event path (mousedown
// without the paired mouseup), so InputService.isMouseDown reports held and
// the frame loop drives genuine hold-to-break progress — no handler bypass.
export const setMouseHeldForQA = (button: 0 | 1 | 2, held: boolean) =>
  Effect.runPromise(Effect.sync(() => {
    document.dispatchEvent(new MouseEvent(held ? 'mousedown' : 'mouseup', { bubbles: true, button }))
  }))
