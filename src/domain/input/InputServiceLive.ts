import { Effect, Layer } from 'effect'
import { InputService } from './InputService'
import type { MouseDelta } from './types'

/**
 * InputServiceLive - 入力サービスの仮実装
 *
 * TODO: 本格的な入力処理実装が完了するまでの暫定実装
 * Issue #176のApplication Layer統合のために最小限の機能を提供
 */

const makeInputServiceLive = Effect.gen(function* () {
  // キーボード状態の管理（仮実装）
  const pressedKeys = new Set<string>()
  const pressedMouseButtons = new Set<number>()
  const mouseDelta = { deltaX: 0, deltaY: 0, timestamp: Date.now() }

  return InputService.of({
    isKeyPressed: (key: string) => Effect.succeed(pressedKeys.has(key.toLowerCase())),

    isMousePressed: (button: number) => Effect.succeed(pressedMouseButtons.has(button)),

    getMouseDelta: () => Effect.succeed({
        deltaX: mouseDelta.deltaX,
        deltaY: mouseDelta.deltaY,
        timestamp: Date.now(),
      } as MouseDelta),

    registerHandler: (_handler) =>
      Effect.gen(function* () {
        // 仮実装：何もしない
        yield* Effect.log('InputHandler registered (mock implementation)')
      }),
  })
})

/**
 * InputServiceLive Layer
 */
export const InputServiceLive = Layer.effect(InputService, makeInputServiceLive)
