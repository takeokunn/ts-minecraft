import { Clock, Effect, Option, Ref } from 'effect'
import { DeltaTimeSecs, PhysicsBodyId, PLAYER_HALF_HEIGHT, PlayerId, Position } from '@ts-minecraft/core'
import { ChunkManagerService } from '@ts-minecraft/world/application/chunk-manager-service'
import { PlayerCameraStateService } from '@ts-minecraft/entity/application/camera-state'
import { MovementService } from '@ts-minecraft/entity/application/movement-service'
import { PlayerInputService } from '@ts-minecraft/entity/application/player-input-service'
import { PlayerService } from '@ts-minecraft/entity/application/player-service'
import { GameModeService } from './game-mode-service'
import { PhysicsService } from './physics-service'
import { GameStateError } from '../domain/errors'
import {
  getBlockCollisionShapeAt,
  getBlockFrictionAt,
  isBlockSolid,
  isInCobweb,
  isInLadder,
  isInWater,
  isOnPoweredRail,
  isOnRail,
} from '../domain/block-collision-predicates'
import { KeyMappings } from '@ts-minecraft/entity/domain/key-mappings'
import {
  ZERO_VEC3,
  applyWaterDrag,
  refreshChunkCache,
  type ChunkCache,
} from './game-state-support'
import { failMissingPhysicsBody, mapPhysicsServiceError, mapPlayerError } from './game-state-errors'
import {
  applyLadderVelocityInto,
  applyCobwebSlowdownInto,
  DEFAULT_WATER_HORIZONTAL_DRAG,
} from '../domain/player-physics'
import { blendFrameVelocityInto, resolveUpdateFrameContext, resolveUpdatePostPhysicsState } from '../domain/player-motion'
import { worldToChunkCoord } from '@ts-minecraft/world/domain/chunk-coord-utils'
import type { TimingState } from './game-state.types'

export type GameStateUpdateOrchestrationDeps = {
  readonly playerService: Pick<PlayerService, 'updatePosition' | 'updateVelocity'>
  readonly physicsService: Pick<PhysicsService, 'copyVelocityInto' | 'copyPositionInto' | 'setVelocity' | 'setPosition' | 'step'>
  readonly movementService: Pick<MovementService, 'update'>
  readonly cameraState: Pick<PlayerCameraStateService, 'getRotation'>
  readonly chunkManagerService: Pick<ChunkManagerService, 'getChunk'>
  readonly gameModeService: Pick<GameModeService, 'isCreative' | 'isSpectator'>
  readonly inputService: Pick<PlayerInputService, 'consumeKeyPress' | 'isKeyPressed'>
  readonly timingStateRef: Ref.Ref<TimingState>
  readonly playerBodyIdRef: Ref.Ref<Option.Option<PhysicsBodyId>>
  readonly isGroundedRef: Ref.Ref<boolean>
  readonly chunkCacheRef: Ref.Ref<ChunkCache>
  readonly lastChunkCoordRef: Ref.Ref<{ cx: number; cz: number }>
  readonly flyingRef: Ref.Ref<boolean>
  readonly boatingRef: Ref.Ref<boolean>
  readonly minecartingRef: Ref.Ref<boolean>
  readonly poweredRailBoostRef: Ref.Ref<boolean>
  readonly inventoryService: { readonly addBlock: (blockType: 'BOAT' | 'MINECART', count: number) => Effect.Effect<unknown, unknown> }
  readonly playerId: PlayerId
  readonly deltaTime: DeltaTimeSecs
  readonly waterHorizontalDrag?: number | undefined
}

// Module-scoped scratch objects reused across frames to avoid per-frame
// position/velocity allocation. The update pipeline reads and writes them
// synchronously inside a single Effect.gen scope.
const _scratchPosA = { x: 0, y: 0, z: 0 }
const _scratchPosB = { x: 0, y: 0, z: 0 }
const _scratchVel = { x: 0, y: 0, z: 0 }

// Vanilla boats travel ~8 b/s vs 4.317 walking; the multiplier applies to the
// post-step velocity, which is re-derived from input each frame (no compounding).
const BOAT_SPEED_MULTIPLIER = 1.85
const BOAT_SURFACE_RISE_SPEED = 3

// Vanilla minecarts cap at ~8 b/s vs 4.317 walking; the multiplier applies to
// the post-step velocity, re-derived from input each frame (no compounding).
const MINECART_SPEED_MULTIPLIER = 1.85
// Powered rails boost carts harder (vanilla powered rails push to full speed)
// — but only while REDSTONE-POWERED; an unpowered powered rail brakes the
// cart instead (vanilla parity). The app layer samples getPowerAt for the
// rail cell each frame and writes poweredRailBoostRef.
const POWERED_RAIL_SPEED_MULTIPLIER = 2.5
const UNPOWERED_POWERED_RAIL_BRAKE = 0.5

export const resolveMinecartMultiplier = (onPoweredRail: boolean, boostActive: boolean): number =>
  onPoweredRail
    ? (boostActive ? POWERED_RAIL_SPEED_MULTIPLIER : UNPOWERED_POWERED_RAIL_BRAKE)
    : MINECART_SPEED_MULTIPLIER

// Vertical offset subtracted from the body-center Y before sampling the vehicle
// support cell (rail). Deliberately samples MID-BODY, not the true feet: the
// feet (−PLAYER_HALF_HEIGHT = −0.9) sit exactly on the rail-cell floor boundary,
// where downward physics jitter flips floor(y) to the cell below and spuriously
// dismounts. Sampling the cell interior keeps mount and dismount consistent —
// minecart-mount.ts imports this so both predicates read the same cell.
export const VEHICLE_SURFACE_SAMPLE_OFFSET = 0.4

export const runGameStateUpdate = (
  deps: GameStateUpdateOrchestrationDeps,
): Effect.Effect<void, GameStateError> =>
  Effect.gen(function* () {
    const waterHorizontalDrag = deps.waterHorizontalDrag ?? DEFAULT_WATER_HORIZONTAL_DRAG
    const playerBodyId = Option.getOrNull(yield* Ref.get(deps.playerBodyIdRef))
    if (playerBodyId === null) return yield* failMissingPhysicsBody('update')

    const rotation = yield* deps.cameraState.getRotation()
    const isGrounded = yield* Ref.get(deps.isGroundedRef)
    const isCreative = yield* deps.gameModeService.isCreative()
    const isSpectator = yield* deps.gameModeService.isSpectator()

    const flightTogglePressed = yield* deps.inputService.consumeKeyPress(KeyMappings.TOGGLE_FLIGHT)
    const jumpPressed = yield* deps.inputService.isKeyPressed(KeyMappings.JUMP)
    const sneakPressed = yield* deps.inputService.isKeyPressed(KeyMappings.SNEAK)
    const currentVel = yield* deps.physicsService.copyVelocityInto(playerBodyId, _scratchVel)
    const inputVelocity = yield* deps.movementService.update(rotation.yaw, isGrounded)
    const currentFlying = yield* Ref.get(deps.flyingRef)
    const frameContext = resolveUpdateFrameContext({
      currentFlying,
      isCreative,
      isSpectator,
      flightTogglePressed,
      jumpPressed,
      sneakPressed,
      isGrounded,
      inputVelocity,
      currentVelocity: currentVel,
    })
    yield* Ref.set(deps.flyingRef, frameContext.frameMotionState.flying)

    let surfaceFriction: number | undefined
    if (isGrounded && !frameContext.frameMotionState.flying && !isSpectator) {
      const currentPos = yield* deps.physicsService.copyPositionInto(playerBodyId, _scratchPosA)
      const { x: surfaceCx, z: surfaceCz } = worldToChunkCoord(currentPos)
      const surfaceLastChunkCoord = yield* Ref.get(deps.lastChunkCoordRef)
      if (surfaceLastChunkCoord.cx !== surfaceCx || surfaceLastChunkCoord.cz !== surfaceCz) {
        yield* refreshChunkCache(deps.chunkManagerService, surfaceCx, surfaceCz, deps.chunkCacheRef, deps.lastChunkCoordRef)
      }
      const surfaceChunkCache = yield* Ref.get(deps.chunkCacheRef)
      surfaceFriction = getBlockFrictionAt(
        currentPos.x,
        currentPos.y - PLAYER_HALF_HEIGHT - 0.05,
        currentPos.z,
        surfaceChunkCache,
        surfaceCx,
        surfaceCz,
      )
    }

    yield* deps.physicsService.setVelocity(playerBodyId, blendFrameVelocityInto(_scratchVel, {
      currentFlying: frameContext.frameMotionState.flying,
      isCreative,
      isSpectator,
      flightTogglePressed,
      jumpPressed,
      sneakPressed,
      isGrounded,
      inputVelocity,
      currentVelocity: currentVel,
      surfaceFriction,
    }, frameContext.frameMotionState))

    if (frameContext.frameMotionState.jumped) yield* Ref.set(deps.isGroundedRef, false)

    const prePos: Position = frameContext.capturePrePos
      ? yield* deps.physicsService.copyPositionInto(playerBodyId, _scratchPosA)
      : (ZERO_VEC3 as Position)

    yield* deps.physicsService.step(deps.deltaTime)

    const physPos = yield* deps.physicsService.copyPositionInto(playerBodyId, _scratchPosB)
    const physVel = yield* deps.physicsService.copyVelocityInto(playerBodyId, _scratchVel)

    const { x: playerCx, z: playerCz } = worldToChunkCoord(physPos)
    const lastChunkCoord = yield* Ref.get(deps.lastChunkCoordRef)
    if (lastChunkCoord.cx !== playerCx || lastChunkCoord.cz !== playerCz) {
      yield* refreshChunkCache(deps.chunkManagerService, playerCx, playerCz, deps.chunkCacheRef, deps.lastChunkCoordRef)
    }
    const chunkCache = yield* Ref.get(deps.chunkCacheRef)

    const { contactState: postPhysicsContactState } = resolveUpdatePostPhysicsState({
      physPos,
      physVel,
      prePos,
      deltaTime: deps.deltaTime,
      frameMotionState: frameContext.frameMotionState,
      queries: {
        isSolid: (wx, wy, wz) => isBlockSolid(wx, wy, wz, chunkCache, playerCx, playerCz),
        getCollisionShape: (wx, wy, wz) => getBlockCollisionShapeAt(wx, wy, wz, chunkCache, playerCx, playerCz),
        isInLadder: (wx, wy, wz) => isInLadder(wx, wy, wz, chunkCache, playerCx, playerCz),
        isInCobweb: (wx, wy, wz) => isInCobweb(wx, wy, wz, chunkCache, playerCx, playerCz),
        isInWater: (wx, wy, wz) => isInWater(wx, wy, wz, chunkCache, playerCx, playerCz),
      },
      canApplyEnvironmentEffects: !isSpectator && !frameContext.frameMotionState.flying,
      sneaking: frameContext.frameMotionState.sneaking,
      wasGrounded: isGrounded,
      isSpectator,
    })

    if (postPhysicsContactState.onLadder) {
      const climbUp = yield* deps.inputService.isKeyPressed(KeyMappings.JUMP)
      applyLadderVelocityInto(physVel, physVel, { climbUp, climbDown: frameContext.frameMotionState.sneaking })
    }

    if (postPhysicsContactState.inCobweb) {
      applyCobwebSlowdownInto(physVel, physVel)
    }

    // Sequential: setPosition/setVelocity are synchronous state writes —
    // fiber parallelism adds overhead with no throughput gain.
    yield* deps.physicsService.setPosition(playerBodyId, physPos as Position).pipe(Effect.catchTag('PhysicsServiceError', () => Effect.void))
    yield* deps.physicsService.setVelocity(playerBodyId, physVel).pipe(Effect.catchTag('PhysicsServiceError', () => Effect.void))
    yield* Ref.set(deps.isGroundedRef, postPhysicsContactState.isGrounded)

    // Boat modality: while boating and in water the player rides the surface
    // at boat speed. Sneak or reaching land dismounts and refunds the item.
    const boating = yield* Ref.get(deps.boatingRef)
    if (boating && (frameContext.frameMotionState.sneaking || !postPhysicsContactState.inWater)) {
      // refund-before-dismount: a full inventory keeps the rider mounted rather than destroying the item
      const refunded = yield* deps.inventoryService.addBlock('BOAT', 1).pipe(Effect.as(true), Effect.catchAll(() => Effect.succeed(false)))
      if (refunded) yield* Ref.set(deps.boatingRef, false)
    }

    if (postPhysicsContactState.inWater) {
      const stillBoating = yield* Ref.get(deps.boatingRef)
      if (stillBoating) {
        // Surface-seeking float: rise while the head is submerged, otherwise
        // rest on the surface; horizontal speed boosted to vanilla boat pace.
        const headInWater = isInWater(physPos.x, physPos.y + 0.6, physPos.z, chunkCache, playerCx, playerCz)
        physVel.y = headInWater ? BOAT_SURFACE_RISE_SPEED : Math.max(0, physVel.y)
        physVel.x *= BOAT_SPEED_MULTIPLIER
        physVel.z *= BOAT_SPEED_MULTIPLIER
        yield* deps.physicsService.setVelocity(playerBodyId, physVel).pipe(Effect.catchTag('PhysicsServiceError', () => Effect.void))
      } else {
        const swimUp = !frameContext.frameMotionState.flying && (yield* deps.inputService.isKeyPressed(KeyMappings.JUMP))
        yield* applyWaterDrag(deps.physicsService, playerBodyId, physVel, swimUp, frameContext.frameMotionState.sneaking, waterHorizontalDrag)
      }
    }

    // Minecart modality: while minecarting and on a rail the player rides at
    // minecart speed. Sneak or leaving the rail dismounts and refunds the item.
    const minecarting = yield* Ref.get(deps.minecartingRef)
    if (minecarting) {
      // Sample the rail cell at mid-body (physPos.y is the body center): see
      // VEHICLE_SURFACE_SAMPLE_OFFSET — true feet sit on the cell boundary and
      // jitter out on downward noise, so we sample the cell interior instead.
      const onRail = isOnRail(physPos.x, physPos.y - VEHICLE_SURFACE_SAMPLE_OFFSET, physPos.z, chunkCache, playerCx, playerCz)
      if (frameContext.frameMotionState.sneaking || !onRail) {
        // refund-before-dismount: a full inventory keeps the rider mounted rather than destroying the item
        const refunded = yield* deps.inventoryService.addBlock('MINECART', 1).pipe(Effect.as(true), Effect.catchAll(() => Effect.succeed(false)))
        if (refunded) yield* Ref.set(deps.minecartingRef, false)
      } else {
        const onPoweredRail = isOnPoweredRail(physPos.x, physPos.y - VEHICLE_SURFACE_SAMPLE_OFFSET, physPos.z, chunkCache, playerCx, playerCz)
        const boostActive = yield* Ref.get(deps.poweredRailBoostRef)
        const boost = resolveMinecartMultiplier(onPoweredRail, boostActive)
        physVel.x *= boost
        physVel.z *= boost
        yield* deps.physicsService.setVelocity(playerBodyId, physVel).pipe(Effect.catchTag('PhysicsServiceError', () => Effect.void))
      }
    }

    // Sequential: updatePosition/updateVelocity are synchronous state writes
    yield* deps.playerService.updatePosition(deps.playerId, physPos as Position)
    yield* deps.playerService.updateVelocity(deps.playerId, physVel)

    const now = yield* Clock.currentTimeMillis
    yield* Ref.update(deps.timingStateRef, (state) => ({
      lastFrameTime: now,
      deltaTime: deps.deltaTime,
      frameCount: state.frameCount + 1,
    }))
  }).pipe(
    Effect.catchTag('PhysicsServiceError', mapPhysicsServiceError('update')),
    Effect.catchTag('PlayerError', mapPlayerError('update')),
  )
