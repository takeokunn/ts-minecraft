import { describe, expect} from 'vitest'
import { it } from '@effect/vitest'
import { Schema , Effect} from 'effect'
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
  it.effect('有効なアクションを受け入れる', () => Effect.gen(function* () {
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
    )
    it.effect('無効なアクションを拒否する', () => Effect.gen(function* () {
    const invalidActions = ['invalid', 'unknown', 123, null, undefined]
    invalidActions.forEach((action) => {
    expect(() => Schema.decodeUnknownSync(KeyAction)(action)).toThrow()
    )
    describe('KeyMappingConfig Schema', () => {
    it.effect('有効な設定を受け入れる', () => Effect.gen(function* () {
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
    const result = Schema.decodeUnknownSync(KeyMappingConfig)(validConfig)
    expect(result).toEqual(validConfig)
})
),
  Effect.gen(function* () {
        const incompleteConfig = {
        forward: 'W',
        backward: 'S',
        // 他のキーが不足
        expect(() => Schema.decodeUnknownSync(KeyMappingConfig)(incompleteConfig)).toThrow()

      })
    it.effect('追加のキーがある設定を許容する（Schema.Structのデフォルト動作）', () => Effect.gen(function* () {
    const extraConfig = {
    ...DefaultKeyMap,
    extraKey: 'X', // 余分なキー
    // Schema.Structはデフォルトで追加のキーを許容する
    const result = Schema.decodeUnknownSync(KeyMappingConfig)(extraConfig)
    expect(result).toEqual(DefaultKeyMap) // 余分なキーは無視される
  })
),
    Effect.gen(function* () {
    const emptyKeyConfig = {
    ...DefaultKeyMap,
    forward: '', // 空文字列
    // KeyMappingConfigは単純なString型なので空文字列も受け入れる
    // ビジネスロジックでバリデーションが必要
    const result = Schema.decodeUnknownSync(KeyMappingConfig)(emptyKeyConfig)
    expect(result.forward).toBe('')
    })
    })

    describe('DefaultKeyMap', () => {
  it.effect('すべての必要なアクションが定義されている', () => Effect.gen(function* () {
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
    )
    it.effect('デフォルトマッピングが期待値と一致する', () => Effect.gen(function* () {
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
    )
    it.effect('デフォルトマッピングに重複がない', () => Effect.gen(function* () {
    const values = Object.values(DefaultKeyMap)
    const uniqueValues = new Set(values)
    expect(values.length).toBe(uniqueValues.size)
    )
    it.effect('KeyMappingConfig Schemaに準拠している', () => Effect.gen(function* () {
    const result = Schema.decodeUnknownSync(KeyMappingConfig)(DefaultKeyMap)
    expect(result).toEqual(DefaultKeyMap)
    )
    describe('CustomKeyMapping Schema', () => {
    it.effect('有効なカスタムマッピングを受け入れる', () => Effect.gen(function* () {
    const customMapping = {
    config: DefaultKeyMap,
    createdAt: Date.now(),
    updatedAt: Date.now(
    }),
    const result = Schema.decodeUnknownSync(CustomKeyMapping)(customMapping)
    expect(result).toEqual(customMapping)
})
),
  Effect.gen(function* () {
        const invalidMapping = {
        config: DefaultKeyMap,
        createdAt: -1,
        updatedAt: Date.now(
    }),
    expect(() => Schema.decodeUnknownSync(CustomKeyMapping)(invalidMapping)).toThrow()

      })
    it.effect('ゼロのタイムスタンプを拒否する', () => Effect.gen(function* () {
    const invalidMapping = {
    config: DefaultKeyMap,
    createdAt: 0,
    updatedAt: Date.now(
    }),
    expect(() => Schema.decodeUnknownSync(CustomKeyMapping)(invalidMapping)).toThrow()
  })
),
    Effect.gen(function* () {
    const createdAt = Date.now()
    const updatedAt = createdAt + 1000
    const customMapping = {
    config: DefaultKeyMap,
    createdAt,
    updatedAt,
    const result = Schema.decodeUnknownSync(CustomKeyMapping)(customMapping)
    expect(result.updatedAt).toBeGreaterThanOrEqual(result.createdAt)
    })
    })

    describe('KeyMappingError', () => {
  it.effect('エラーオブジェクトを正しく作成する', () => Effect.gen(function* () {
    const error = KeyMappingError({
    message: 'テストエラー',
    action: 'forward',
    key: 'W',
    )
    expect(error._tag).toBe('KeyMappingError')
    expect(error.message).toBe('テストエラー')
    expect(error.action).toBe('forward')
    expect(error.key).toBe('W')
    it.effect('オプショナルなフィールドなしでエラーを作成できる', () => Effect.gen(function* () {
    const error = KeyMappingError({
    message: 'エラーメッセージ',
    )
    expect(error._tag).toBe('KeyMappingError')
    expect(error.message).toBe('エラーメッセージ')
    expect(error.action).toBeUndefined()
    expect(error.key).toBeUndefined()
    it.effect('KeyMappingErrorSchema に準拠している', () => Effect.gen(function* () {
    const error = KeyMappingError({
    message: 'スキーマテスト',
    action: 'jump',
    )
    const result = Schema.decodeUnknownSync(KeyMappingErrorSchema)(error)
    expect(result).toEqual(error)
    describe('キーマッピングのユースケース', () => {
    it.effect('アローキーを使用した代替マッピング', () => Effect.gen(function* () {
    const arrowKeyMapping: KeyMappingConfig = {
    ...DefaultKeyMap,
    forward: 'ArrowUp',
    backward: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    const result = Schema.decodeUnknownSync(KeyMappingConfig)(arrowKeyMapping)
    expect(result.forward).toBe('ArrowUp')
    expect(result.backward).toBe('ArrowDown')
    expect(result.left).toBe('ArrowLeft')
    expect(result.right).toBe('ArrowRight')
})
),
  Effect.gen(function* () {
        const numpadMapping: KeyMappingConfig = {
        ...DefaultKeyMap,
        forward: 'Numpad8',
        backward: 'Numpad2',
        left: 'Numpad4',
        right: 'Numpad6',
        jump: 'Numpad0',
        const result = Schema.decodeUnknownSync(KeyMappingConfig)(numpadMapping)
        expect(result.forward).toBe('Numpad8')
        expect(result.backward).toBe('Numpad2')

      })
    it.effect('左手専用マッピング', () => Effect.gen(function* () {
    const leftHandMapping: KeyMappingConfig = {
    ...DefaultKeyMap,
    forward: 'E',
    backward: 'D',
    left: 'S',
    right: 'F',
    jump: 'Space',
    crouch: 'A',
    sprint: 'W',
    const result = Schema.decodeUnknownSync(KeyMappingConfig)(leftHandMapping)
    expect(result).toEqual(leftHandMapping)
  })
)
    describe('キーマッピングの一貫性', () => {
  it.effect('すべてのキーが異なる値を持つ', () => Effect.gen(function* () {
    const checkDuplicates = (mapping: KeyMappingConfig) => {
    const values = Object.values(mapping)
    const uniqueValues = new Set(values)
    return values.length === uniqueValues.size
    expect(checkDuplicates(DefaultKeyMap)).toBe(true)
})
),
  Effect.gen(function* () {
        const isPrintableKey = (key: string) => {
        // 基本的なキーコードチェック
        return key.length > 0 && !key.includes('\0')
        Object.values(DefaultKeyMap).forEach((key) => {
        expect(isPrintableKey(key)).toBe(true)

      })
    it.effect('よく使われるゲームキーが含まれている', () => Effect.gen(function* () {
    const commonGameKeys = ['W', 'A', 'S', 'D', 'Space', 'Shift', 'Control', 'E']
    const mappingValues = Object.values(DefaultKeyMap)
    commonGameKeys.forEach((key) => {
    expect(mappingValues).toContain(key)
  })
)
  })
})
