import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { InputServiceLive } from '../InputServiceLive'
import type { InputService } from '../InputService'

describe('InputServiceLive', () => {
  describe('基本的な入力処理', () => {
  it.effect('サービスが正常に初期化される', () => Effect.gen(function* () {
    const inputService = yield* InputService
    expect(inputService).toBeDefined()
    expect(typeof inputService.processInput).toBe('function')
    expect(typeof inputService.getState).toBe('function')
}).pipe(Effect.provide(InputServiceLive))
    )
    it.effect('キーボード入力を処理できる', () => Effect.gen(function* () {
    const inputService = yield* InputService
    const keyEvent = {
    type: 'keydown' as const,
    key: 'w',
    code: 'KeyW',
    timestamp: Date.now()
    }
    yield* inputService.processInput(keyEvent)
    const state = yield* inputService.getState()
    expect(state.keyboard).toBeDefined()
    expect(state.keyboard.keys).toHaveProperty('w')
    }).pipe(Effect.provide(InputServiceLive))
    )
    it.effect('マウス入力を処理できる', () => Effect.gen(function* () {
    const inputService = yield* InputService
    const mouseEvent = {
    type: 'mousedown' as const,
    button: 0,
    x: 100,
    y: 150,
    timestamp: Date.now()
    }
    yield* inputService.processInput(mouseEvent)
    const state = yield* inputService.getState()
    expect(state.mouse).toBeDefined()
    expect(state.mouse.position.x).toBe(100)
    expect(state.mouse.position.y).toBe(150)
    expect(state.mouse.buttons[0]).toBe(true)
    }).pipe(Effect.provide(InputServiceLive))
    )
  }) {
    it.prop('キーボード入力の一貫性', [
      Schema.Struct({
        key: Schema.Union(
          Schema.Literal('w'), Schema.Literal('a'), Schema.Literal('s'), Schema.Literal('d'),
          Schema.Literal('space'), Schema.Literal('shift'), Schema.Literal('ctrl')
        ),
        pressed: Schema.Boolean
      })
    ], ({ struct: { key, pressed } })

      Effect.gen(function* () {
        const inputService = yield* InputService

        const keyEvent = {
          type: (pressed ? 'keydown' : 'keyup') as const,
          key,
          code: `Key${key.toUpperCase()}`,
          timestamp: Date.now()
        }

        yield* inputService.processInput(keyEvent)
        const state = yield* inputService.getState()

        expect(state.keyboard.keys[key]).toBe(pressed)
      }).pipe(Effect.provide(InputServiceLive))
    )

    it.prop('マウス座標の妥当性', [
      Schema.Struct({
        x: Schema.Int.pipe(Schema.between(0, 1920)),
        y: Schema.Int.pipe(Schema.between(0, 1080)),
        button: Schema.Int.pipe(Schema.between(0, 2))
      })
    ], ({ struct: { x, y, button } })

      Effect.gen(function* () {
        const inputService = yield* InputService

        const mouseEvent = {
          type: 'mousedown' as const,
          button,
          x,
          y,
          timestamp: Date.now()
        }

        yield* inputService.processInput(mouseEvent)
        const state = yield* inputService.getState()

        expect(state.mouse.position.x).toBe(x)
        expect(state.mouse.position.y).toBe(y)
        expect(state.mouse.buttons[button]).toBe(true)
      }).pipe(Effect.provide(InputServiceLive))
    )

    it.prop('複数キー同時押しの処理', [
      Schema.Array(
        Schema.Union(
          Schema.Literal('w'), Schema.Literal('a'), Schema.Literal('s'), Schema.Literal('d')
).pipe(Schema.minItems(1), Schema.maxItems(4))
    ], ({ array: keys })

      Effect.gen(function* () {
        const inputService = yield* InputService

        // 全キーを押下
        for (const key of keys) {
          const keyEvent = {
            type: 'keydown' as const,
            key,
            code: `Key${key.toUpperCase()}`,
            timestamp: Date.now()
          }
          yield* inputService.processInput(keyEvent)
        }

        const state = yield* inputService.getState()

        // 全ての押下されたキーが状態に反映されていることを確認
        keys.forEach(key => {
          expect(state.keyboard.keys[key]).toBe(true)
        })
      }).pipe(Effect.provide(InputServiceLive))
    )
  })

  describe('入力状態の管理', () => {
  it.effect('キーの押下と開放が正しく追跡される', () => Effect.gen(function* () {
    const inputService = yield* InputService
    // キー押下
    yield* inputService.processInput({
    type: 'keydown',
    key: 'w',
    code: 'KeyW',
    timestamp: Date.now()
})
).toBe(true)

    // キー開放
    yield* inputService.processInput({
    type: 'keyup',
    key: 'w',
    code: 'KeyW',
    timestamp: Date.now()
    })

    state = yield* inputService.getState()
    expect(state.keyboard.keys.w).toBe(false)
    }).pipe(Effect.provide(InputServiceLive))
    )

    it.effect('マウスボタンの状態が正しく管理される', () => Effect.gen(function* () {
    const inputService = yield* InputService
    // マウスボタン押下
    yield* inputService.processInput({
    type: 'mousedown',
    button: 0,
    x: 50,
    y: 60,
    timestamp: Date.now()
  })
).toBe(true)

    // マウスボタン開放
    yield* inputService.processInput({
    type: 'mouseup',
    button: 0,
    x: 50,
    y: 60,
    timestamp: Date.now()
    })

    state = yield* inputService.getState()
    expect(state.mouse.buttons[0]).toBe(false)
    }).pipe(Effect.provide(InputServiceLive))
    )

    it.effect('マウス移動が正しく追跡される', () => Effect.gen(function* () {
    const inputService = yield* InputService
    const positions = [
    { x: 0, y: 0 },
    { x: 100, y: 200 },
    { x: 500, y: 300 }
    ]
    for (
    yield* inputService.processInput({
    type: 'mousemove',
    x: pos.x,
    y: pos.y,
    timestamp: Date.now()
    ) {$2}
    const state = yield* inputService.getState()
    expect(state.mouse.position.x).toBe(pos.x)
    expect(state.mouse.position.y).toBe(pos.y)
    }
    }).pipe(Effect.provide(InputServiceLive))
    )
  }) {
    it.effect('無効な入力イベントを適切に処理する', () => Effect.gen(function* () {
    const inputService = yield* InputService
    const invalidEvents = [
    { type: 'unknown' as any, timestamp: Date.now() },
    { type: 'keydown', key: '', timestamp: Date.now() },
    { type: 'mousedown', button: -1, x: 0, y: 0, timestamp: Date.now() }
    ]
    for (const event of invalidEvents) {
    // エラーになっても処理が続行されることを確認
    const result = yield* Effect.either(inputService.processInput(event))
    // サービスは堅牢でエラーでも停止しないことを期待
    }
    // サービスが正常に動作し続けることを確認
    const state = yield* inputService.getState()
    expect(state).toBeDefined()
    }).pipe(Effect.provide(InputServiceLive))
    )
  }) {
    it.effect('大量の入力イベントを効率的に処理する', () => Effect.gen(function* () {
    const inputService = yield* InputService
    const start = Date.now()
    // 1000個の入力イベントを処理
    for (
    yield* inputService.processInput({
    type: 'mousemove',
    x: i % 100,
    y: (i * 2) % 100,
    timestamp: Date.now()
    ) {$2}
    }
    const elapsed = Date.now() - start
    const state = yield* inputService.getState()
    expect(state.mouse.position.x).toBe(999 % 100)
    expect(elapsed).toBeLessThan(1000) // 1秒以内に完了
    }).pipe(Effect.provide(InputServiceLive))
    )
  })
)