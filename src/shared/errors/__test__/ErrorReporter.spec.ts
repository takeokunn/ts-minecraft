import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Match, Option, pipe, Effect, Schema } from 'effect'
import { ErrorReporter } from '../ErrorReporter'
import { NetworkError } from '../NetworkErrors'
import { GameError } from '../GameErrors'

describe('ErrorReporter', () => {
  describe('format', () => {
  it.effect('タグ付きエラーを正しくフォーマットする', () => Effect.gen(function* () {
    const error = NetworkError({
    message: 'Test error',
    code: 'NET_001',
})
)
    expect(parsed.type).toBe('NetworkError')
    expect(parsed.message).toBe('Test error')
    expect(parsed.details.code).toBe('NET_001')
    expect(parsed.timestamp).toBeDefined()
    expect(new Date(parsed.timestamp)).toBeInstanceOf(Date)})

    it.effect('プレーンエラーを処理する', () => Effect.gen(function* () {
    const error = new Error('Plain error')
    const formatted = yield* ErrorReporter.format(error)
    expect(formatted).toContain('Plain error')
    expect(typeof formatted).toBe('string')
  })
),
    Effect.gen(function* () {
    const formatted = yield* ErrorReporter.format(null)
    expect(formatted).toBe('null')
    })
    it.effect('undefined値を処理する', () => Effect.gen(function* () {
    const formatted = yield* ErrorReporter.format(undefined)
    expect(formatted).toBe('undefined')
  })
),
    Effect.gen(function* () {
    const formatted = yield* ErrorReporter.format('String error')
    expect(formatted).toBe('String error')
    })
    it.effect('オブジェクトエラーを処理する', () => Effect.gen(function* () {
    const error = { message: 'Object error', code: 42 }
    const formatted = yield* ErrorReporter.format(error)
    const parsed = JSON.parse(formatted)
    expect(parsed.message).toBe('Object error')
    expect(parsed.code).toBe(42)
  })
)
    describe('reportError', () => {
  it.effect('エラーを正しく報告する', () => Effect.gen(function* () {
    const error = GameError({
    message: 'Test game error',
    code: 'GAME_001',
})
).toBe('ErrorReported')})

    it.effect('追加コンテキストと共にエラーを報告する', () => Effect.gen(function* () {
    const error = GameError({
    message: 'Test error with context',
    code: 'GAME_002',
    })
    const context = { userId: 'user123', action: 'login' }
    const result = yield* ErrorReporter.reportError(error, context)
    expect(result).toBe('ErrorReported')
  })
)
    describe('getReport', () => {
  it.effect('詳細なエラーレポートを取得する', () => Effect.gen(function* () {
    const error = NetworkError({
    message: 'Network failure',
    code: 'NET_002',
})
).toHaveProperty('error')
    expect(report).toHaveProperty('formatted')
    expect(report).toHaveProperty('timestamp')
    expect(report.error).toBe(error)
    expect(typeof report.formatted).toBe('string')
    expect(report.timestamp).toBeInstanceOf(Date)})

    it.effect('コンテキスト付きレポートを取得する', () => Effect.gen(function* () {
    const error = GameError({
    message: 'Context error',
    code: 'GAME_003',
    })
    const context = { sessionId: 'session456', route: '/game' }
    const report = yield* ErrorReporter.getReport(error, context)
    expect(report).toHaveProperty('context')
    expect(report.context).toEqual(context)
  })
)
    describe('Property-based testing', () => {
  it.prop('formatはすべての有効なエラータイプを処理できる', [
    Schema.Union(
    Schema.Struct({
    _tag: Schema.Literal('GameError'),
    message: Schema.String,
    code: Schema.String
}),
    Schema.Struct({
    _tag: Schema.Literal('NetworkError'),
    message: Schema.String,
    code: Schema.String})
    ], ({ union: error })

    Effect.gen(function* () {
    const formatted = yield* ErrorReporter.format(error)
    expect(typeof formatted).toBe('string')
    expect(formatted.length).toBeGreaterThan(0)

    // JSONとしてパース可能であることを確認
    const parsed = JSON.parse(formatted)
    expect(parsed).toHaveProperty('type')
    expect(parsed).toHaveProperty('message')
    expect(parsed).toHaveProperty('timestamp')
    })
    it.prop('reportErrorは常に成功する', [
    Schema.Union(
    Schema.Struct({
    _tag: Schema.Literal('GameError'),
    message: Schema.String,
    code: Schema.String
    }),
    Schema.Struct({
    _tag: Schema.Literal('NetworkError'),
    message: Schema.String,
    code: Schema.String
    })
    ], ({ union: error })

    Effect.gen(function* () {
    const result = yield* ErrorReporter.reportError(error)
    expect(result).toBe('ErrorReported')
    })
    it.prop('getReportは一貫した構造を返す', [
    Schema.Struct({
    _tag: Schema.Union(Schema.Literal('GameError'), Schema.Literal('NetworkError')),
    message: Schema.String.pipe(Schema.minLength(1)),
    code: Schema.String.pipe(Schema.minLength(1))
    })
    ], ({ struct: error })

    Effect.gen(function* () {
    const report = yield* ErrorReporter.getReport(error)

    // 必須フィールドの存在確認
    expect(report).toHaveProperty('error')
    expect(report).toHaveProperty('formatted')
    expect(report).toHaveProperty('timestamp')

    // 型の確認
    expect(typeof report.formatted).toBe('string')
    expect(report.timestamp).toBeInstanceOf(Date)
    expect(report.error).toEqual(error)
    })
    it.prop('異なるコンテキストで同一エラーの一貫性', [
    Schema.Struct({
    error: Schema.Struct({
    _tag: Schema.Literal('GameError'),
    message: Schema.String,
    code: Schema.String
    }),
    context1: Schema.Record({ key: Schema.String, value: Schema.String }),
    context2: Schema.Record({ key: Schema.String, value: Schema.String })
    })
    ], ({ struct: { error, context1, context2 } })

    Effect.gen(function* () {
    const report1 = yield* ErrorReporter.getReport(error, context1)
    const report2 = yield* ErrorReporter.getReport(error, context2)

    // エラー部分は同一であること
    expect(report1.error).toEqual(report2.error)

    // コンテキストは異なること
    if (Object.keys(context1).length > 0 && Object.keys(context2).length > 0) {
    expect(report1.context).toEqual(context1)
    expect(report2.context).toEqual(context2)
    }
    })
    })

    describe('エラー処理の堅牢性', () => {
  it.effect('循環参照を含むオブジェクトを処理する', () => Effect.gen(function* () {
    const obj: any = { message: 'Circular reference' }
    obj.self = obj
    const formatted = yield* ErrorReporter.format(obj)
    expect(typeof formatted).toBe('string')
    expect(formatted).toContain('message')
})
),
  Effect.gen(function* () {
        const largeMessage = 'x'.repeat(10000)
        const error = GameError({
          message: largeMessage,
          code: 'LARGE_001',
        })

        const formatted = yield* ErrorReporter.format(error)
        expect(typeof formatted).toBe('string')
        expect(formatted.length).toBeGreaterThan(0)
      })
    it.effect('特殊文字を含むメッセージを処理する', () => Effect.gen(function* () {
    const specialMessage = 'Error with special chars: \n\t\r\u0000\u001f'
    const error = NetworkError({
    message: specialMessage,
    code: 'SPECIAL_001',
  })
)
        expect(parsed.message).toBe(specialMessage)
      })
  })

  describe('Match.valueによるエラー処理', () => {
  it.effect('異なるエラータイプを適切に分類する', () => Effect.gen(function* () {
    const gameError = GameError({ message: 'Game error', code: 'GAME_001'
})
),
          Match.value(error._tag).pipe(
            Match.when('GameError', () => 'game'),
            Match.when('NetworkError', () => 'network'),
            Match.orElse(() => 'unknown')
          )

        expect(categorizeError(gameError)).toBe('game')
        expect(categorizeError(networkError)).toBe('network')})
  })
})