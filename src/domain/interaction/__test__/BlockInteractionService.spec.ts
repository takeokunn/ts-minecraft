import { describe, it, expect } from 'vitest'
import { Effect, Schema } from 'effect'
import { BlockInteractionService, BlockInteractionServiceLive, INTERACTION_CONSTANTS } from '../index'
import type { Vector3, BlockFace, ToolType } from '../InteractionTypes'
import type { BlockId, BlockPosition, PlayerId } from '../../../shared/types/branded'
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
  describe('performRaycast', () => {
    it('should perform raycast with valid parameters', async () => {
      const program = Effect.gen(function* () {
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

        return result
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(BlockInteractionServiceLive)))

      expect(result).toBeDefined()
    })

    it('should fail with negative max distance', async () => {
      const program = Effect.gen(function* () {
        const service = yield* BlockInteractionService
        return yield* service.performRaycast(testOrigin, testDirection, -1)
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(BlockInteractionServiceLive)))

      expect(result._tag).toBe('Failure')
    })

    it('should fail with excessively large max distance', async () => {
      const program = Effect.gen(function* () {
        const service = yield* BlockInteractionService
        return yield* service.performRaycast(testOrigin, testDirection, 200)
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(BlockInteractionServiceLive)))

      expect(result._tag).toBe('Failure')
    })
  })

  describe('startBlockBreaking', () => {
    it('should start block breaking session', async () => {
      const program = Effect.gen(function* () {
        const service = yield* BlockInteractionService

        const session = yield* service.startBlockBreaking(testPlayerId, testBlockPosition, 'pickaxe' as ToolType)

        expect(session.playerId).toBe(testPlayerId)
        expect(session.blockPosition).toEqual(testBlockPosition)
        expect(session.toolType).toBe('pickaxe')
        expect(session.progress).toBe(0)
        expect(session.totalBreakTime).toBeGreaterThan(0)
        expect(typeof session.sessionId).toBe('string')

        return session
      })

      const session = await Effect.runPromise(program.pipe(Effect.provide(BlockInteractionServiceLive)))

      expect(session).toBeDefined()
    })

    it('should prevent multiple breaking sessions for same player', async () => {
      const program = Effect.gen(function* () {
        const service = yield* BlockInteractionService

        // 最初のセッション開始
        yield* service.startBlockBreaking(testPlayerId, testBlockPosition, 'pickaxe' as ToolType)

        // 同じプレイヤーで2回目のセッション開始（失敗する想定）
        return yield* service.startBlockBreaking(
          testPlayerId,
          { x: 6, y: 64, z: 0 } as BlockPosition,
          'hand' as ToolType
        )
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(BlockInteractionServiceLive)))

      expect(result._tag).toBe('Failure')
    })
  })

  describe('updateBlockBreaking', () => {
    it('should update breaking progress', async () => {
      const program = Effect.gen(function* () {
        const service = yield* BlockInteractionService

        // セッション開始
        const session = yield* service.startBlockBreaking(testPlayerId, testBlockPosition, 'pickaxe' as ToolType)

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

        return progress
      })

      const progress = await Effect.runPromise(program.pipe(Effect.provide(BlockInteractionServiceLive)))

      expect(progress).toBeDefined()
    })

    it('should fail with negative delta time', async () => {
      const program = Effect.gen(function* () {
        const service = yield* BlockInteractionService

        const session = yield* service.startBlockBreaking(testPlayerId, testBlockPosition, 'hand' as ToolType)

        return yield* service.updateBlockBreaking(session.sessionId, -0.1)
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(BlockInteractionServiceLive)))

      expect(result._tag).toBe('Failure')
    })
  })

  describe('placeBlock', () => {
    it('should place block at valid position', async () => {
      const program = Effect.gen(function* () {
        const service = yield* BlockInteractionService

        const result = yield* service.placeBlock(
          testPlayerId,
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

        return result
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(BlockInteractionServiceLive)))

      expect(result).toBeDefined()
    })
  })

  describe('getInteractableBlocks', () => {
    it('should return interactable blocks in range', async () => {
      const program = Effect.gen(function* () {
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

        return blocks
      })

      const blocks = await Effect.runPromise(program.pipe(Effect.provide(BlockInteractionServiceLive)))

      expect(blocks).toBeDefined()
    })

    it('should fail with invalid range', async () => {
      const program = Effect.gen(function* () {
        const service = yield* BlockInteractionService
        return yield* service.getInteractableBlocks(testOrigin, -1)
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(BlockInteractionServiceLive)))

      expect(result._tag).toBe('Failure')
    })

    it('should fail with range too large', async () => {
      const program = Effect.gen(function* () {
        const service = yield* BlockInteractionService
        return yield* service.getInteractableBlocks(testOrigin, 50)
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(BlockInteractionServiceLive)))

      expect(result._tag).toBe('Failure')
    })
  })

  describe('calculateBreakTime', () => {
    it('should calculate break time for stone with pickaxe', async () => {
      const program = Effect.gen(function* () {
        const service = yield* BlockInteractionService
        return yield* service.calculateBreakTime('stone' as BlockId, 'pickaxe' as ToolType)
      })

      const breakTime = await Effect.runPromise(program.pipe(Effect.provide(BlockInteractionServiceLive)))

      expect(typeof breakTime).toBe('number')
      expect(breakTime).toBeGreaterThan(0)
      expect(breakTime).toBeLessThanOrEqual(INTERACTION_CONSTANTS.MAX_BREAK_TIME)
    })

    it('should calculate break time for stone with hand', async () => {
      const program = Effect.gen(function* () {
        const service = yield* BlockInteractionService
        return yield* service.calculateBreakTime('stone' as BlockId, 'hand' as ToolType)
      })

      const breakTime = await Effect.runPromise(program.pipe(Effect.provide(BlockInteractionServiceLive)))

      expect(typeof breakTime).toBe('number')
      expect(breakTime).toBeGreaterThan(0)
    })

    it('should return infinity for unbreakable blocks', async () => {
      const program = Effect.gen(function* () {
        const service = yield* BlockInteractionService
        return yield* service.calculateBreakTime('bedrock' as BlockId, 'pickaxe' as ToolType)
      })

      const breakTime = await Effect.runPromise(program.pipe(Effect.provide(BlockInteractionServiceLive)))

      expect(breakTime).toBe(Infinity)
    })
  })

  describe('session management', () => {
    it('should manage breaking sessions', async () => {
      const program = Effect.gen(function* () {
        const service = yield* BlockInteractionService

        // セッション開始
        const session = yield* service.startBlockBreaking(testPlayerId, testBlockPosition, 'pickaxe' as ToolType)

        // セッション取得
        const retrievedSession = yield* service.getBreakingSession(session.sessionId)
        expect(retrievedSession).toEqual(session)

        // プレイヤーセッション取得
        const playerSession = yield* service.getPlayerBreakingSession(testPlayerId)
        expect(playerSession).toEqual(session)

        // 全セッション取得
        const allSessions = yield* service.getAllBreakingSessions()
        expect(allSessions).toContain(session)

        // セッションキャンセル
        yield* service.cancelBreakingSession(session.sessionId)

        // キャンセル後は取得できない
        const cancelledSession = yield* service.getBreakingSession(session.sessionId)
        expect(cancelledSession).toBeNull()

        return true
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(BlockInteractionServiceLive)))

      expect(result).toBe(true)
    })
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('BlockInteractionService Integration', () => {
  it('should perform complete interaction workflow', async () => {
    const program = Effect.gen(function* () {
      const service = yield* BlockInteractionService

      // 1. レイキャストでブロックを発見
      const raycast = yield* service.performRaycast(testOrigin, testDirection, 10)

      // 2. ブロックが見つかった場合、破壊を開始
      if (raycast.hit && raycast.blockPosition) {
        const session = yield* service.startBlockBreaking(
          testPlayerId,
          raycast.blockPosition as BlockPosition,
          'pickaxe' as ToolType
        )

        // 3. 破壊進捗を更新
        const progress = yield* service.updateBlockBreaking(
          session.sessionId,
          0.5 // 0.5秒経過
        )

        expect(progress.progress).toBeGreaterThan(0)

        // 4. 新しい位置にブロック設置
        const placementPosition = {
          x: raycast.blockPosition.x + 1,
          y: raycast.blockPosition.y,
          z: raycast.blockPosition.z,
        } as BlockPosition

        const placement = yield* service.placeBlock(
          testPlayerId,
          placementPosition,
          'dirt' as BlockId,
          'west' as BlockFace
        )

        return {
          raycast,
          session,
          progress,
          placement,
        }
      }

      return { raycast }
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(BlockInteractionServiceLive)))

    expect(result.raycast).toBeDefined()
  })
})
