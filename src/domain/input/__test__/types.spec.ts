import { describe, it, expect } from 'vitest'
import { Schema } from '@effect/schema'
import {
  MouseButton,
  MouseDelta,
  InputState,
  InputEventType,
  InputEvent,
  InputHandler,
  InputError,
  MOUSE_BUTTON,
} from '../types'

describe('Input Types', () => {
  describe('MouseButton', () => {
    it('有効なマウスボタン値を受け入れる', () => {
      const validButtons = [0, 1, 2]
      validButtons.forEach((button) => {
        expect(() => Schema.decodeUnknownSync(MouseButton)(button)).not.toThrow()
      })
    })

    it('無効なマウスボタン値を拒否する', () => {
      const invalidButtons = [-1, 3, 4, 'left', null, undefined]
      invalidButtons.forEach((button) => {
        expect(() => Schema.decodeUnknownSync(MouseButton)(button)).toThrow()
      })
    })

    it('定数が正しく定義されている', () => {
      expect(MOUSE_BUTTON.LEFT).toBe(0)
      expect(MOUSE_BUTTON.MIDDLE).toBe(1)
      expect(MOUSE_BUTTON.RIGHT).toBe(2)
    })
  })

  describe('MouseDelta', () => {
    it('有効なマウスデルタを受け入れる', () => {
      const delta = { x: 10, y: -5 }
      const decoded = Schema.decodeUnknownSync(MouseDelta)(delta)
      expect(decoded).toEqual(delta)
    })

    it('必須フィールドがない場合エラーを発生させる', () => {
      expect(() => Schema.decodeUnknownSync(MouseDelta)({ x: 10 })).toThrow()
      expect(() => Schema.decodeUnknownSync(MouseDelta)({ y: 5 })).toThrow()
      expect(() => Schema.decodeUnknownSync(MouseDelta)({})).toThrow()
    })

    it('シリアライズ可能である', () => {
      const delta = { x: 100, y: -50 }
      const decoded = Schema.decodeUnknownSync(MouseDelta)(delta)
      const serialized = JSON.stringify(decoded)
      const deserialized = JSON.parse(serialized)
      expect(Schema.decodeUnknownSync(MouseDelta)(deserialized)).toEqual(delta)
    })
  })

  describe('InputState', () => {
    it('有効な入力状態を受け入れる', () => {
      const state = {
        keys: { a: true, b: false },
        mouseButtons: { '0': true, '1': false },
        mouseDelta: { x: 0, y: 0 },
      }
      const decoded = Schema.decodeUnknownSync(InputState)(state)
      expect(decoded).toEqual(state)
    })

    it('空の状態を受け入れる', () => {
      const emptyState = {
        keys: {},
        mouseButtons: {},
        mouseDelta: { x: 0, y: 0 },
      }
      const decoded = Schema.decodeUnknownSync(InputState)(emptyState)
      expect(decoded).toEqual(emptyState)
    })

    it('必須フィールドがない場合エラーを発生させる', () => {
      expect(() =>
        Schema.decodeUnknownSync(InputState)({
          keys: {},
          mouseButtons: {},
        })
      ).toThrow()
    })
  })

  describe('InputEventType', () => {
    it('有効なイベントタイプを受け入れる', () => {
      const validTypes = ['keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove']
      validTypes.forEach((type) => {
        expect(() => Schema.decodeUnknownSync(InputEventType)(type)).not.toThrow()
      })
    })

    it('無効なイベントタイプを拒否する', () => {
      const invalidTypes = ['click', 'touch', 'scroll', 123, null]
      invalidTypes.forEach((type) => {
        expect(() => Schema.decodeUnknownSync(InputEventType)(type)).toThrow()
      })
    })
  })

  describe('InputEvent', () => {
    it('キーイベントを受け入れる', () => {
      const keyEvent = {
        type: 'keydown',
        key: 'a',
        timestamp: Date.now(),
      }
      const decoded = Schema.decodeUnknownSync(InputEvent)(keyEvent)
      expect(decoded).toEqual(keyEvent)
    })

    it('マウスボタンイベントを受け入れる', () => {
      const mouseEvent = {
        type: 'mousedown',
        button: 0,
        timestamp: Date.now(),
      }
      const decoded = Schema.decodeUnknownSync(InputEvent)(mouseEvent)
      expect(decoded).toEqual(mouseEvent)
    })

    it('マウス移動イベントを受け入れる', () => {
      const mouseMoveEvent = {
        type: 'mousemove',
        delta: { x: 10, y: 5 },
        timestamp: Date.now(),
      }
      const decoded = Schema.decodeUnknownSync(InputEvent)(mouseMoveEvent)
      expect(decoded).toEqual(mouseMoveEvent)
    })

    it('必須フィールドがない場合エラーを発生させる', () => {
      expect(() =>
        Schema.decodeUnknownSync(InputEvent)({
          type: 'keydown',
        })
      ).toThrow()
    })
  })

  describe('InputHandler', () => {
    it('有効なハンドラーを受け入れる', () => {
      const handler = {
        id: 'test-handler',
        priority: 10,
        handle: () => {},
      }
      const decoded = Schema.decodeUnknownSync(InputHandler)(handler)
      expect(decoded.id).toBe(handler.id)
      expect(decoded.priority).toBe(handler.priority)
    })

    it('必須フィールドがない場合エラーを発生させる', () => {
      expect(() =>
        Schema.decodeUnknownSync(InputHandler)({
          id: 'test',
          // priorityがない
        })
      ).toThrow()
    })
  })

  describe('InputError', () => {
    it('エラーインスタンスを作成できる', () => {
      const error = new InputError({ reason: 'Test error' })
      expect(error).toBeInstanceOf(InputError)
      expect(error.reason).toBe('Test error')
    })

    it('エラーメッセージを持つ', () => {
      const error = new InputError({ reason: 'Handler not found' })
      expect(error.message).toBeDefined()
      expect(error.reason).toBe('Handler not found')
    })
  })
})
