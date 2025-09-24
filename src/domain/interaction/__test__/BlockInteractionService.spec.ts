import { describe, expect, beforeEach, afterEach } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Either, Option, Match, pipe, Exit, TestContext } from 'effect'
import { BlockInteractionService, BlockInteractionServiceLive, INTERACTION_CONSTANTS } from '../index'
import type { Vector3, BlockFace, ToolType } from '../InteractionTypes'
import type { BlockId, BlockPosition, PlayerId } from '../../../shared/types/branded'
import { clearAllBreakingSessions } from '../BlockBreaking'
// Use type assertions for test values (simpler approach)

// =============================================================================
// Test Setup
// =============================================================================

const testPlayerId = 'test-player-123' as PlayerId
const testBlockId = 'stone' as BlockId

const testOrigin: Vector3 = { x: 0, y: 64, z: 0 }
const testDirection: Vector3 = { x: 1, y: 0, z: 0 }
const testBlockPosition: BlockPosition = { x: 5, y: 64, z: 0 } as BlockPosition

// =============================================================================
// BlockInteractionService Tests
// =============================================================================

describe('BlockInteractionService', () => {
  // Clean up breaking sessions between tests to prevent state pollution
  beforeEach(() => {
    Effect.runSync(clearAllBreakingSessions())
  })

  afterEach(() => {
    Effect.runSync(clearAllBreakingSessions())
  })

  describe('performRaycast', () => {
    it.effect('should perform raycast with valid parameters', () =>
      Effect.gen(function* () {
        const service = yield* BlockInteractionService

        const result = yield* service.performRaycast(
          testOrigin,
          testDirection,
          INTERACTION_CONSTANTS.DEFAULT_REACH_DISTANCE
        )

        expect(typeof result.hit).toBe('boolean')
        expect(typeof result.distance).toBe('number')
        expect(result.point).toMatchObject({
          x: expect.any(Number),
          y: expect.any(Number),
          z: expect.any(Number),
        })
        expect(result).toBeDefined()
      }).pipe(Effect.provide(BlockInteractionServiceLive))
    )

    it.effect('should fail with negative max distance', () =>
      Effect.gen(function* () {
        const service = yield* BlockInteractionService
        const result = yield* Effect.either(service.performRaycast(testOrigin, testDirection, -1))

        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(BlockInteractionServiceLive))
    )

    it.effect('should fail with excessively large max distance', () =>
      Effect.gen(function* () {
        const service = yield* BlockInteractionService
        const result = yield* Effect.either(service.performRaycast(testOrigin, testDirection, 200))

        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(BlockInteractionServiceLive))
    )
  })

  describe('startBlockBreaking', () => {
    it.effect('should start block breaking session', () =>
      Effect.gen(function* () {
        const service = yield* BlockInteractionService

        // 異なるプレイヤーIDを使用してテストを隔離
        const uniquePlayerId = `test-player-${Date.now()}-${Math.random()}` as PlayerId

        const session = yield* service.startBlockBreaking(uniquePlayerId, testBlockPosition, 'pickaxe' as ToolType)

        expect(session.playerId).toBe(uniquePlayerId)
        expect(session.blockPosition).toEqual(testBlockPosition)
        expect(session.toolType).toBe('pickaxe')
        expect(session.progress).toBe(0)
        expect(session.totalBreakTime).toBeGreaterThan(0)
        expect(typeof session.sessionId).toBe('string')
        expect(session).toBeDefined()
      }).pipe(Effect.provide(BlockInteractionServiceLive))
    )

    it.effect('should prevent multiple breaking sessions for same player', () =>
      Effect.gen(function* () {
        const service = yield* BlockInteractionService

        // 異なるプレイヤーIDを使用してテストを隔離
        const uniquePlayerId = `test-player-${Date.now()}-${Math.random()}` as PlayerId

        // 最初のセッション開始
        yield* service.startBlockBreaking(uniquePlayerId, testBlockPosition, 'pickaxe' as ToolType)

        // 同じプレイヤーで2回目のセッション開始（失敗する想定）
        const result = yield* Effect.either(
          service.startBlockBreaking(uniquePlayerId, { x: 6, y: 64, z: 0 } as BlockPosition, 'hand' as ToolType)
        )

        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(BlockInteractionServiceLive))
    )
  })

  describe('updateBlockBreaking', () => {
    it.effect('should update breaking progress', () =>
      Effect.gen(function* () {
        const service = yield* BlockInteractionService

        // 異なるプレイヤーIDを使用してテストを隔離
        const uniquePlayerId = `test-player-${Date.now()}-${Math.random()}` as PlayerId

        // セッション開始
        const session = yield* service.startBlockBreaking(uniquePlayerId, testBlockPosition, 'pickaxe' as ToolType)

        // 進捗更新
        const progress = yield* service.updateBlockBreaking(
          session.sessionId,
          0.1 // 0.1秒経過
        )

        expect(progress.sessionId).toBe(session.sessionId)
        expect(progress.progress).toBeGreaterThanOrEqual(0)
        expect(progress.progress).toBeLessThanOrEqual(1)
        expect(typeof progress.isComplete).toBe('boolean')
        expect(progress.remainingTime).toBeGreaterThanOrEqual(0)
        expect(progress).toBeDefined()
      }).pipe(Effect.provide(BlockInteractionServiceLive))
    )

    it.effect('should fail with negative delta time', () =>
      Effect.gen(function* () {
        const service = yield* BlockInteractionService

        // 異なるプレイヤーIDを使用してテストを隔離
        const uniquePlayerId = `test-player-${Date.now()}-${Math.random()}` as PlayerId

        const session = yield* service.startBlockBreaking(uniquePlayerId, testBlockPosition, 'hand' as ToolType)

        const result = yield* Effect.either(service.updateBlockBreaking(session.sessionId, -0.1))

        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(BlockInteractionServiceLive))
    )
  })

  describe('placeBlock', () => {
    it.effect('should place block at valid position', () =>
      Effect.gen(function* () {
        const service = yield* BlockInteractionService

        // 異なるプレイヤーIDを使用してテストを隔離
        const uniquePlayerId = `test-player-${Date.now()}-${Math.random()}` as PlayerId

        const result = yield* service.placeBlock(
          uniquePlayerId,
          { x: 10, y: 65, z: 5 } as BlockPosition,
          testBlockId,
          'top' as BlockFace
        )

        expect(typeof result.success).toBe('boolean')

        if (result.success) {
          expect(result.placedPosition).toBeDefined()
        } else {
          expect(result.reason).toBeDefined()
        }

        expect(result).toBeDefined()
      }).pipe(Effect.provide(BlockInteractionServiceLive))
    )
  })

  describe('getInteractableBlocks', () => {
    it.effect('should return interactable blocks in range', () =>
      Effect.gen(function* () {
        const service = yield* BlockInteractionService

        const blocks = yield* service.getInteractableBlocks(
          testOrigin,
          5 // 5ブロック範囲
        )

        expect(Array.isArray(blocks)).toBe(true)

        for (const block of blocks) {
          expect(typeof block.blockId).toBe('string')
          expect(block.position).toMatchObject({
            x: expect.any(Number),
            y: expect.any(Number),
            z: expect.any(Number),
          })
          expect(typeof block.distance).toBe('number')
          expect(typeof block.canBreak).toBe('boolean')
          expect(typeof block.canInteract).toBe('boolean')
          expect(block.distance).toBeLessThanOrEqual(5)
        }

        expect(blocks).toBeDefined()
      }).pipe(Effect.provide(BlockInteractionServiceLive))
    )

    it.effect('should fail with invalid range', () =>
      Effect.gen(function* () {
        const service = yield* BlockInteractionService
        const result = yield* Effect.either(service.getInteractableBlocks(testOrigin, -1))

        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(BlockInteractionServiceLive))
    )

    it.effect('should fail with range too large', () =>
      Effect.gen(function* () {
        const service = yield* BlockInteractionService
        const result = yield* Effect.either(service.getInteractableBlocks(testOrigin, 50))

        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(BlockInteractionServiceLive))
    )
  })

  describe('calculateBreakTime', () => {
    it.effect('should calculate break time for stone with pickaxe', () =>
      Effect.gen(function* () {
        const service = yield* BlockInteractionService
        const breakTime = yield* service.calculateBreakTime('stone' as BlockId, 'pickaxe' as ToolType)

        expect(typeof breakTime).toBe('number')
        expect(breakTime).toBeGreaterThan(0)
        expect(breakTime).toBeLessThanOrEqual(INTERACTION_CONSTANTS.MAX_BREAK_TIME)
      }).pipe(Effect.provide(BlockInteractionServiceLive))
    )

    it.effect('should calculate break time for stone with hand', () =>
      Effect.gen(function* () {
        const service = yield* BlockInteractionService
        const breakTime = yield* service.calculateBreakTime('stone' as BlockId, 'hand' as ToolType)

        expect(typeof breakTime).toBe('number')
        expect(breakTime).toBeGreaterThan(0)
      }).pipe(Effect.provide(BlockInteractionServiceLive))
    )

    it.effect('should return infinity for unbreakable blocks', () =>
      Effect.gen(function* () {
        const service = yield* BlockInteractionService
        const breakTime = yield* service.calculateBreakTime('bedrock' as BlockId, 'pickaxe' as ToolType)

        expect(breakTime).toBe(Infinity)
      }).pipe(Effect.provide(BlockInteractionServiceLive))
    )
  })

  describe('session management', () => {
    it.effect('should manage breaking sessions', () =>
      Effect.gen(function* () {
        const service = yield* BlockInteractionService

        // 異なるプレイヤーIDを使用してテストを隔離
        const uniquePlayerId = `test-player-${Date.now()}-${Math.random()}` as PlayerId

        // セッション開始
        const session = yield* service.startBlockBreaking(uniquePlayerId, testBlockPosition, 'pickaxe' as ToolType)

        // セッション取得
        const retrievedSession = yield* service.getBreakingSession(session.sessionId)
        expect(retrievedSession).toEqual(session)

        // プレイヤーセッション取得
        const playerSession = yield* service.getPlayerBreakingSession(uniquePlayerId)
        expect(playerSession).toEqual(session)

        // 全セッション取得
        const allSessions = yield* service.getAllBreakingSessions()
        expect(allSessions).toContain(session)

        // セッションキャンセル
        yield* service.cancelBreakingSession(session.sessionId)

        // キャンセル後は取得できない
        const cancelledSession = yield* service.getBreakingSession(session.sessionId)
        expect(cancelledSession).toBeNull()
      }).pipe(Effect.provide(BlockInteractionServiceLive))
    )
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('BlockInteractionService Integration', () => {
  // Clean up breaking sessions between tests
  beforeEach(() => {
    Effect.runSync(clearAllBreakingSessions())
  })

  afterEach(() => {
    Effect.runSync(clearAllBreakingSessions())
  })

  it.effect('should perform complete interaction workflow', () =>
    Effect.gen(function* () {
      const service = yield* BlockInteractionService

      // 1. レイキャストでブロックを発見
      const raycast = yield* service.performRaycast(testOrigin, testDirection, 10)

      // 異なるプレイヤーIDを使用してテストを隔離
      const uniquePlayerId = `test-player-${Date.now()}-${Math.random()}` as PlayerId

      // 2. ブロックが見つかった場合、破壊を開始
      if (raycast.hit && raycast.blockPosition) {
        yield* Effect.gen(function* () {
          const session = yield* service.startBlockBreaking(
            uniquePlayerId,
            raycast.blockPosition as BlockPosition,
            'pickaxe' as ToolType
          )

          // 3. 破壊進捗を更新
          // updateBlockBreakingは実際の経過時間を使用するため、deltaTimeは使われない
          // 進捗は実時間に基づくため、すぐに呼ばれた場合はほぼ0になる
          const progress = yield* service.updateBlockBreaking(
            session.sessionId,
            1.0 // deltaTimeパラメータ（内部では実際の経過時間が使用される）
          )

          // 実時間ベースのため、即座の呼び出しでは進捗は非常に小さい
          expect(progress.progress).toBeGreaterThanOrEqual(0)
          expect(progress.progress).toBeLessThanOrEqual(1)

          // 4. 新しい位置にブロック設置
          const placementPosition = {
            x: raycast.blockPosition!.x + 1,
            y: raycast.blockPosition!.y,
            z: raycast.blockPosition!.z,
          } as BlockPosition

          const placement = yield* service.placeBlock(
            uniquePlayerId,
            placementPosition,
            'dirt' as BlockId,
            'west' as BlockFace
          )

          expect(raycast).toBeDefined()

          return {
            raycast,
            session,
            progress,
            placement,
          }
        })
      }
    }).pipe(Effect.provide(BlockInteractionServiceLive))
  )
})
