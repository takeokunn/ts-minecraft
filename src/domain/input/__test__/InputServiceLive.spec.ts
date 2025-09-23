import { describe, expect, it as vitestIt } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'fast-check'
import { InputService } from '../InputService'
import { InputServiceLive } from '../InputServiceLive'

describe('InputServiceLive', () => {
  describe('Layer Creation', () => {
    it.effect('creates a valid InputService layer', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService

        // サービスオブジェクトが正しく作成されることを確認
        expect(inputService).toBeDefined()
        expect(typeof inputService.isKeyPressed).toBe('function')
        expect(typeof inputService.isMousePressed).toBe('function')
        expect(typeof inputService.getMouseDelta).toBe('function')
        expect(typeof inputService.registerHandler).toBe('function')
      }).pipe(Effect.provide(InputServiceLive))
    )
  })

  describe('Key State Management', () => {
    it.effect('returns false for unpressed keys by default', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService
        const isPressed = yield* inputService.isKeyPressed('w')

        expect(isPressed).toBe(false)
      }).pipe(Effect.provide(InputServiceLive))
    )

    it.effect('handles different key cases consistently', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService

        // Property-based testing: 任意のキーで一貫した動作を確認
        const keys = ['W', 'w', 'A', 'a', 'Space', 'Enter', 'Shift']
        for (const key of keys) {
          const result = yield* inputService.isKeyPressed(key)
          expect(result).toBe(false) // 仮実装は常にfalse
        }
      }).pipe(Effect.provide(InputServiceLive))
    )

    it.effect('handles special keys correctly', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService

        const specialKeys = ['Space', 'Shift', 'Control', 'Alt', 'Enter', 'Escape']

        for (const key of specialKeys) {
          const isPressed = yield* inputService.isKeyPressed(key)
          expect(isPressed).toBe(false)
        }
      }).pipe(Effect.provide(InputServiceLive))
    )
  })

  describe('Mouse State Management', () => {
    it.effect('returns false for unpressed mouse buttons by default', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService

        const leftButton = yield* inputService.isMousePressed(0)
        const rightButton = yield* inputService.isMousePressed(1)
        const middleButton = yield* inputService.isMousePressed(2)

        expect(leftButton).toBe(false)
        expect(rightButton).toBe(false)
        expect(middleButton).toBe(false)
      }).pipe(Effect.provide(InputServiceLive))
    )

    it.scoped('handles various mouse button indices (Property-based)', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService

        // 様々なマウスボタンインデックスでテスト
        const buttonIndices = [0, 1, 2, 3, 4, 5, 10, 15, 99]

        for (const buttonIndex of buttonIndices) {
          const isPressed = yield* inputService.isMousePressed(buttonIndex)
          expect(isPressed).toBe(false) // 仮実装は常にfalse
          expect(typeof isPressed).toBe('boolean')
        }
      }).pipe(Effect.provide(InputServiceLive))
    )
  })

  describe('Mouse Delta Management', () => {
    it.effect('returns valid mouse delta with zero movement by default', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService
        const delta = yield* inputService.getMouseDelta()

        expect(delta.deltaX).toBe(0)
        expect(delta.deltaY).toBe(0)
        expect(typeof delta.timestamp).toBe('number')
        expect(delta.timestamp).toBeGreaterThan(0)
      }).pipe(Effect.provide(InputServiceLive))
    )

    it.effect('generates fresh timestamps on each call', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService

        const delta1 = yield* inputService.getMouseDelta()
        const delta2 = yield* inputService.getMouseDelta()

        // タイムスタンプは同じか新しい値であることを確認（ミリ秒精度）
        expect(delta2.timestamp).toBeGreaterThanOrEqual(delta1.timestamp)
        // 両方とも有効なタイムスタンプ
        expect(delta1.timestamp).toBeGreaterThan(0)
        expect(delta2.timestamp).toBeGreaterThan(0)
      }).pipe(Effect.provide(InputServiceLive))
    )

    it.effect('maintains consistent delta structure', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService
        const delta = yield* inputService.getMouseDelta()

        // MouseDelta型のプロパティが全て存在することを確認
        expect(delta).toHaveProperty('deltaX')
        expect(delta).toHaveProperty('deltaY')
        expect(delta).toHaveProperty('timestamp')

        // 型が正しいことを確認
        expect(typeof delta.deltaX).toBe('number')
        expect(typeof delta.deltaY).toBe('number')
        expect(typeof delta.timestamp).toBe('number')
      }).pipe(Effect.provide(InputServiceLive))
    )
  })

  describe('Handler Registration', () => {
    it.effect('successfully registers input handlers', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService

        const mockHandler = {
          onKeyDown: () => Effect.void,
          onKeyUp: () => Effect.void,
          onMouseMove: () => Effect.void,
          onMouseDown: () => Effect.void,
          onMouseUp: () => Effect.void,
        }

        // 仮実装では例外なく完了することを確認
        yield* inputService.registerHandler(mockHandler)
      }).pipe(Effect.provide(InputServiceLive))
    )

    it.effect('handles partial handler objects', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService

        const partialHandler = {
          onKeyDown: () => Effect.void,
          // 他のハンドラーは省略
        }

        // 部分的なハンドラーでも正常に動作することを確認
        yield* inputService.registerHandler(partialHandler)
      }).pipe(Effect.provide(InputServiceLive))
    )

    it.effect('handles empty handler objects', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService

        const emptyHandler = {}

        // 空のハンドラーでも正常に動作することを確認
        yield* inputService.registerHandler(emptyHandler)
      }).pipe(Effect.provide(InputServiceLive))
    )
  })

  describe('Service Integration', () => {
    it.effect('maintains service state independently per instance', () =>
      Effect.gen(function* () {
        // 同じレイヤーから作成された2つのサービスインスタンスが
        // 同じ状態を共有することを確認（仮実装の動作）
        const inputService1 = yield* InputService
        const inputService2 = yield* InputService

        const key1Result = yield* inputService1.isKeyPressed('a')
        const key2Result = yield* inputService2.isKeyPressed('a')

        expect(key1Result).toBe(key2Result)
      }).pipe(Effect.provide(InputServiceLive))
    )

    it.effect('handles concurrent operations correctly', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService

        // 並列でいくつかの操作を実行
        const results = yield* Effect.all([
          inputService.isKeyPressed('w'),
          inputService.isMousePressed(0),
          inputService.getMouseDelta(),
        ], { concurrency: 'unbounded' })

        expect(results[0]).toBe(false) // key press
        expect(results[1]).toBe(false) // mouse press
        expect(results[2]).toHaveProperty('deltaX', 0) // mouse delta
      }).pipe(Effect.provide(InputServiceLive))
    )
  })

  describe('Performance and Resource Management', () => {
    it.effect('handles rapid successive calls efficiently', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService

        // 短時間に大量の呼び出しを行う
        const operations = Array.from({ length: 100 }, (_, i) =>
          inputService.isKeyPressed(`key${i}`)
        )

        const results = yield* Effect.all(operations, { concurrency: 'unbounded' })

        // 全ての結果がfalseであることを確認
        expect(results.every(result => result === false)).toBe(true)
      }).pipe(Effect.provide(InputServiceLive))
    )

    it.effect('maintains consistent performance characteristics', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService

        const startTime = Date.now()

        // 複数の操作を実行
        yield* Effect.all([
          inputService.isKeyPressed('test'),
          inputService.isMousePressed(0),
          inputService.getMouseDelta(),
          inputService.registerHandler({}),
        ])

        const endTime = Date.now()
        const duration = endTime - startTime

        // 仮実装は非常に高速であることを確認（100ms以下）
        expect(duration).toBeLessThan(100)
      }).pipe(Effect.provide(InputServiceLive))
    )
  })
})