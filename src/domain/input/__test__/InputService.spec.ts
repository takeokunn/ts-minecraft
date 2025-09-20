import { describe, it, expect } from 'vitest'
import { Effect, Context } from 'effect'
import { InputService } from '../InputService'
import type { InputHandler, MouseDelta, InputState } from '../types'

describe('InputService', () => {
  // モックサービス実装
  const mockInputService: InputService = {
    isKeyPressed: (key: string) => Effect.succeed(key === 'a'),
    isMousePressed: (button: number) => Effect.succeed(button === 0),
    getMouseDelta: () => Effect.succeed({ x: 10, y: 5 } as MouseDelta),
    registerHandler: () => Effect.succeed(void 0),
    unregisterHandler: () => Effect.succeed(void 0),
    getState: () =>
      Effect.succeed({
        keys: { a: true },
        mouseButtons: { '0': true },
        mouseDelta: { x: 10, y: 5 },
      } as InputState),
    reset: () => Effect.succeed(void 0),
  }

  describe('インターフェース定義', () => {
    it('InputServiceタグが正しく定義されている', () => {
      expect(InputService).toBeDefined()
      expect(InputService.key).toBe('@services/InputService')
    })

    it('必要なメソッドがすべて定義されている', () => {
      expect(mockInputService.isKeyPressed).toBeDefined()
      expect(mockInputService.isMousePressed).toBeDefined()
      expect(mockInputService.getMouseDelta).toBeDefined()
      expect(mockInputService.registerHandler).toBeDefined()
      expect(mockInputService.unregisterHandler).toBeDefined()
      expect(mockInputService.getState).toBeDefined()
      expect(mockInputService.reset).toBeDefined()
    })
  })

  describe('サービス利用', () => {
    it('Contextを通じてサービスを利用できる', async () => {
      const program = Effect.gen(function* () {
        const input = yield* InputService
        const isPressed = yield* input.isKeyPressed('a')
        return isPressed
      })

      const result = await Effect.runPromise(program.pipe(Effect.provideService(InputService, mockInputService)))

      expect(result).toBe(true)
    })

    it('複数のメソッドを組み合わせて利用できる', async () => {
      const program = Effect.gen(function* () {
        const input = yield* InputService
        const keyPressed = yield* input.isKeyPressed('a')
        const mousePressed = yield* input.isMousePressed(0)
        const delta = yield* input.getMouseDelta()
        return { keyPressed, mousePressed, delta }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provideService(InputService, mockInputService)))

      expect(result).toEqual({
        keyPressed: true,
        mousePressed: true,
        delta: { x: 10, y: 5 },
      })
    })

    it('状態を取得できる', async () => {
      const program = Effect.gen(function* () {
        const input = yield* InputService
        return yield* input.getState()
      })

      const result = await Effect.runPromise(program.pipe(Effect.provideService(InputService, mockInputService)))

      expect(result).toEqual({
        keys: { a: true },
        mouseButtons: { '0': true },
        mouseDelta: { x: 10, y: 5 },
      })
    })

    it('ハンドラーを登録できる', async () => {
      const program = Effect.gen(function* () {
        const input = yield* InputService
        const handler: InputHandler = {
          id: 'test',
          priority: 10,
          handle: () => Effect.succeed(void 0),
        }
        yield* input.registerHandler(handler)
        return true
      })

      const result = await Effect.runPromise(program.pipe(Effect.provideService(InputService, mockInputService)))

      expect(result).toBe(true)
    })
  })
})
