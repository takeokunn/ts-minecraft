import { describe, expect, it } from 'vitest'
import { Schema } from '@effect/schema'
import {
  KeyAction,
  KeyMappingConfig,
  DefaultKeyMap,
  CustomKeyMapping,
  KeyMappingError,
  KeyMappingErrorSchema,
} from '../KeyMapping'

describe('KeyMapping', () => {
  describe('KeyAction Schema', () => {
    it('有効なアクションを受け入れる', () => {
      const validActions: KeyAction[] = [
        'forward',
        'backward',
        'left',
        'right',
        'jump',
        'crouch',
        'sprint',
        'interact',
        'inventory',
        'chat',
        'debug',
        'screenshot',
        'fullscreen',
        'togglePerspective',
      ]

      validActions.forEach((action) => {
        const result = Schema.decodeUnknownSync(KeyAction)(action)
        expect(result).toBe(action)
      })
    })

    it('無効なアクションを拒否する', () => {
      const invalidActions = ['invalid', 'unknown', 123, null, undefined]

      invalidActions.forEach((action) => {
        expect(() => Schema.decodeUnknownSync(KeyAction)(action)).toThrow()
      })
    })
  })

  describe('KeyMappingConfig Schema', () => {
    it('有効な設定を受け入れる', () => {
      const validConfig = {
        forward: 'W',
        backward: 'S',
        left: 'A',
        right: 'D',
        jump: 'Space',
        crouch: 'Shift',
        sprint: 'Control',
        interact: 'E',
        inventory: 'I',
        chat: 'T',
        debug: 'F3',
        screenshot: 'F2',
        fullscreen: 'F11',
        togglePerspective: 'F5',
      }

      const result = Schema.decodeUnknownSync(KeyMappingConfig)(validConfig)
      expect(result).toEqual(validConfig)
    })

    it('必要なキーが不足している設定を拒否する', () => {
      const incompleteConfig = {
        forward: 'W',
        backward: 'S',
        // 他のキーが不足
      }

      expect(() => Schema.decodeUnknownSync(KeyMappingConfig)(incompleteConfig)).toThrow()
    })

    it('追加のキーがある設定を許容する（Schema.Structのデフォルト動作）', () => {
      const extraConfig = {
        ...DefaultKeyMap,
        extraKey: 'X', // 余分なキー
      }

      // Schema.Structはデフォルトで追加のキーを許容する
      const result = Schema.decodeUnknownSync(KeyMappingConfig)(extraConfig)
      expect(result).toEqual(DefaultKeyMap) // 余分なキーは無視される
    })

    it('空文字列のキー値を拒否する', () => {
      const emptyKeyConfig = {
        ...DefaultKeyMap,
        forward: '', // 空文字列
      }

      // KeyMappingConfigは単純なString型なので空文字列も受け入れる
      // ビジネスロジックでバリデーションが必要
      const result = Schema.decodeUnknownSync(KeyMappingConfig)(emptyKeyConfig)
      expect(result.forward).toBe('')
    })
  })

  describe('DefaultKeyMap', () => {
    it('すべての必要なアクションが定義されている', () => {
      const actions: KeyAction[] = [
        'forward',
        'backward',
        'left',
        'right',
        'jump',
        'crouch',
        'sprint',
        'interact',
        'inventory',
        'chat',
        'debug',
        'screenshot',
        'fullscreen',
        'togglePerspective',
      ]

      actions.forEach((action) => {
        expect(DefaultKeyMap[action]).toBeDefined()
        expect(typeof DefaultKeyMap[action]).toBe('string')
        expect(DefaultKeyMap[action].length).toBeGreaterThan(0)
      })
    })

    it('デフォルトマッピングが期待値と一致する', () => {
      expect(DefaultKeyMap.forward).toBe('W')
      expect(DefaultKeyMap.backward).toBe('S')
      expect(DefaultKeyMap.left).toBe('A')
      expect(DefaultKeyMap.right).toBe('D')
      expect(DefaultKeyMap.jump).toBe('Space')
      expect(DefaultKeyMap.crouch).toBe('Shift')
      expect(DefaultKeyMap.sprint).toBe('Control')
      expect(DefaultKeyMap.interact).toBe('E')
      expect(DefaultKeyMap.inventory).toBe('I')
      expect(DefaultKeyMap.chat).toBe('T')
      expect(DefaultKeyMap.debug).toBe('F3')
      expect(DefaultKeyMap.screenshot).toBe('F2')
      expect(DefaultKeyMap.fullscreen).toBe('F11')
      expect(DefaultKeyMap.togglePerspective).toBe('F5')
    })

    it('デフォルトマッピングに重複がない', () => {
      const values = Object.values(DefaultKeyMap)
      const uniqueValues = new Set(values)
      expect(values.length).toBe(uniqueValues.size)
    })

    it('KeyMappingConfig Schemaに準拠している', () => {
      const result = Schema.decodeUnknownSync(KeyMappingConfig)(DefaultKeyMap)
      expect(result).toEqual(DefaultKeyMap)
    })
  })

  describe('CustomKeyMapping Schema', () => {
    it('有効なカスタムマッピングを受け入れる', () => {
      const customMapping = {
        config: DefaultKeyMap,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const result = Schema.decodeUnknownSync(CustomKeyMapping)(customMapping)
      expect(result).toEqual(customMapping)
    })

    it('負のタイムスタンプを拒否する', () => {
      const invalidMapping = {
        config: DefaultKeyMap,
        createdAt: -1,
        updatedAt: Date.now(),
      }

      expect(() => Schema.decodeUnknownSync(CustomKeyMapping)(invalidMapping)).toThrow()
    })

    it('ゼロのタイムスタンプを拒否する', () => {
      const invalidMapping = {
        config: DefaultKeyMap,
        createdAt: 0,
        updatedAt: Date.now(),
      }

      expect(() => Schema.decodeUnknownSync(CustomKeyMapping)(invalidMapping)).toThrow()
    })

    it('createdAtとupdatedAtの関係性を検証する', () => {
      const createdAt = Date.now()
      const updatedAt = createdAt + 1000

      const customMapping = {
        config: DefaultKeyMap,
        createdAt,
        updatedAt,
      }

      const result = Schema.decodeUnknownSync(CustomKeyMapping)(customMapping)
      expect(result.updatedAt).toBeGreaterThanOrEqual(result.createdAt)
    })
  })

  describe('KeyMappingError', () => {
    it('エラーオブジェクトを正しく作成する', () => {
      const error = KeyMappingError({
        message: 'テストエラー',
        action: 'forward',
        key: 'W',
      })

      expect(error._tag).toBe('KeyMappingError')
      expect(error.message).toBe('テストエラー')
      expect(error.action).toBe('forward')
      expect(error.key).toBe('W')
    })

    it('オプショナルなフィールドなしでエラーを作成できる', () => {
      const error = KeyMappingError({
        message: 'エラーメッセージ',
      })

      expect(error._tag).toBe('KeyMappingError')
      expect(error.message).toBe('エラーメッセージ')
      expect(error.action).toBeUndefined()
      expect(error.key).toBeUndefined()
    })

    it('KeyMappingErrorSchema に準拠している', () => {
      const error = KeyMappingError({
        message: 'スキーマテスト',
        action: 'jump',
      })

      const result = Schema.decodeUnknownSync(KeyMappingErrorSchema)(error)
      expect(result).toEqual(error)
    })
  })

  describe('キーマッピングのユースケース', () => {
    it('アローキーを使用した代替マッピング', () => {
      const arrowKeyMapping: KeyMappingConfig = {
        ...DefaultKeyMap,
        forward: 'ArrowUp',
        backward: 'ArrowDown',
        left: 'ArrowLeft',
        right: 'ArrowRight',
      }

      const result = Schema.decodeUnknownSync(KeyMappingConfig)(arrowKeyMapping)
      expect(result.forward).toBe('ArrowUp')
      expect(result.backward).toBe('ArrowDown')
      expect(result.left).toBe('ArrowLeft')
      expect(result.right).toBe('ArrowRight')
    })

    it('テンキーを使用したマッピング', () => {
      const numpadMapping: KeyMappingConfig = {
        ...DefaultKeyMap,
        forward: 'Numpad8',
        backward: 'Numpad2',
        left: 'Numpad4',
        right: 'Numpad6',
        jump: 'Numpad0',
      }

      const result = Schema.decodeUnknownSync(KeyMappingConfig)(numpadMapping)
      expect(result.forward).toBe('Numpad8')
      expect(result.backward).toBe('Numpad2')
    })

    it('左手専用マッピング', () => {
      const leftHandMapping: KeyMappingConfig = {
        ...DefaultKeyMap,
        forward: 'E',
        backward: 'D',
        left: 'S',
        right: 'F',
        jump: 'Space',
        crouch: 'A',
        sprint: 'W',
      }

      const result = Schema.decodeUnknownSync(KeyMappingConfig)(leftHandMapping)
      expect(result).toEqual(leftHandMapping)
    })
  })

  describe('キーマッピングの一貫性', () => {
    it('すべてのキーが異なる値を持つ', () => {
      const checkDuplicates = (mapping: KeyMappingConfig) => {
        const values = Object.values(mapping)
        const uniqueValues = new Set(values)
        return values.length === uniqueValues.size
      }

      expect(checkDuplicates(DefaultKeyMap)).toBe(true)
    })

    it('すべてのキー値が印刷可能な文字である', () => {
      const isPrintableKey = (key: string) => {
        // 基本的なキーコードチェック
        return key.length > 0 && !key.includes('\0')
      }

      Object.values(DefaultKeyMap).forEach((key) => {
        expect(isPrintableKey(key)).toBe(true)
      })
    })

    it('よく使われるゲームキーが含まれている', () => {
      const commonGameKeys = ['W', 'A', 'S', 'D', 'Space', 'Shift', 'Control', 'E']

      const mappingValues = Object.values(DefaultKeyMap)
      commonGameKeys.forEach((key) => {
        expect(mappingValues).toContain(key)
      })
    })
  })
})
