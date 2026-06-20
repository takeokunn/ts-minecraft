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

    if (postPhysicsContactState.inWater) {
      const swimUp = !frameContext.frameMotionState.flying && (yield* deps.inputService.isKeyPressed(KeyMappings.JUMP))
      yield* applyWaterDrag(deps.physicsService, playerBodyId, physVel, swimUp, frameContext.frameMotionState.sneaking, waterHorizontalDrag)
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
