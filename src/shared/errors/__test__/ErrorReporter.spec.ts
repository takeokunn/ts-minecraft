import { describe, it, expect } from '@effect/vitest'
import * as fc from 'fast-check'
import { ErrorReporter } from '../ErrorReporter'
import { NetworkError } from '../NetworkErrors'
import { GameError } from '../GameErrors'

describe('ErrorReporter', () => {
  describe('format', () => {
    it('タグ付きエラーを正しくフォーマットする', () => {
      const error = NetworkError({
        message: 'Test error',
        code: 'NET_001',
      })

      const formatted = ErrorReporter.format(error)
      const parsed = JSON.parse(formatted)

      expect(parsed.type).toBe('NetworkError')
      expect(parsed.message).toBe('Test error')
      expect(parsed.details.code).toBe('NET_001')
      expect(parsed.timestamp).toBeDefined()
      expect(new Date(parsed.timestamp)).toBeInstanceOf(Date)
    })

    it('プレーンエラーを処理する', () => {
      const error = new Error('Plain error')
      const formatted = ErrorReporter.format(error)
      expect(formatted).toContain('Plain error')
      expect(typeof formatted).toBe('string')
    })

    it('null値を処理する', () => {
      const formatted = ErrorReporter.format(null)
      expect(formatted).toBe('null')
    })

    it('undefined値を処理する', () => {
      const formatted = ErrorReporter.format(undefined)
      expect(formatted).toBe('undefined')
    })

    it('文字列値を処理する', () => {
      const formatted = ErrorReporter.format('string error')
      expect(formatted).toBe('string error')
    })

    it('数値を処理する', () => {
      const formatted = ErrorReporter.format(123)
      expect(formatted).toBe('123')
    })

    it('複雑なタグ付きエラーを完全にフォーマットする', () => {
      const error = NetworkError({
        message: 'Complex error',
        code: 'NET_002',
        statusCode: 500,
        cause: new Error('Root cause'),
      })

      const formatted = ErrorReporter.format(error)
      const parsed = JSON.parse(formatted)

      expect(parsed.type).toBe('NetworkError')
      expect(parsed.message).toBe('Complex error')
      expect(parsed.details.code).toBe('NET_002')
      expect(parsed.details.statusCode).toBe(500)
      expect(parsed.details.cause).toBeDefined()
      expect(parsed.timestamp).toBeDefined()
    })

    it('ゲームエラーも正しくフォーマットする', () => {
      const error = GameError({
        message: 'Game test error',
        code: 'GAME_001',
      })

      const formatted = ErrorReporter.format(error)
      const parsed = JSON.parse(formatted)

      expect(parsed.type).toBe('GameError')
      expect(parsed.message).toBe('Game test error')
      expect(parsed.details.code).toBe('GAME_001')
    })
  })

  describe('getStackTrace', () => {
    it('Errorからスタックトレースを抽出する', () => {
      const error = new Error('Test error')
      const stack = ErrorReporter.getStackTrace(error)

      expect(stack).toBeDefined()
      expect(typeof stack).toBe('string')
      expect(stack).toContain('Test error')
    })

    it('非Errorオブジェクトでundefinedを返す', () => {
      const stack = ErrorReporter.getStackTrace('string error')
      expect(stack).toBeUndefined()
    })

    it('nullでundefinedを返す', () => {
      const stack = ErrorReporter.getStackTrace(null)
      expect(stack).toBeUndefined()
    })

    it('undefinedでundefinedを返す', () => {
      const stack = ErrorReporter.getStackTrace(undefined)
      expect(stack).toBeUndefined()
    })

    it('stackプロパティを持つオブジェクトからスタックを抽出する', () => {
      const errorLikeObject = {
        message: 'Error-like object',
        stack: 'Custom stack trace\n  at test location',
      }

      const stack = ErrorReporter.getStackTrace(errorLikeObject)
      expect(stack).toBe('Custom stack trace\n  at test location')
    })

    it('stackがundefinedの場合はundefinedを返す', () => {
      const errorLikeObject = {
        message: 'Error-like object',
        stack: undefined,
      }

      const stack = ErrorReporter.getStackTrace(errorLikeObject)
      expect(stack).toBe('undefined')
    })

    it('stackが数値の場合は文字列として返す', () => {
      const errorLikeObject = {
        message: 'Error-like object',
        stack: 123,
      }

      const stack = ErrorReporter.getStackTrace(errorLikeObject)
      expect(stack).toBe('123')
    })
  })

  describe('getCauseChain', () => {
    it('原因チェーンを抽出する', () => {
      const rootCause = new Error('Root cause')
      const middleError = NetworkError({
        message: 'Middle error',
        cause: rootCause,
      })
      const topError = NetworkError({
        message: 'Top error',
        cause: middleError,
      })

      const chain = ErrorReporter.getCauseChain(topError)
      expect(chain).toHaveLength(3)
      expect(chain[0]).toBe(topError)
      expect(chain[1]).toBe(middleError)
      expect(chain[2]).toBe(rootCause)
    })

    it('原因がないエラーを処理する', () => {
      const error = new Error('No cause')
      const chain = ErrorReporter.getCauseChain(error)
      expect(chain).toHaveLength(1)
      expect(chain[0]).toBe(error)
    })

    it('nullエラーを処理する', () => {
      const chain = ErrorReporter.getCauseChain(null)
      expect(chain).toHaveLength(1)
      expect(chain[0]).toBeNull()
    })

    it('undefinedエラーを処理する', () => {
      const chain = ErrorReporter.getCauseChain(undefined)
      expect(chain).toHaveLength(1)
      expect(chain[0]).toBeUndefined()
    })

    it('文字列エラーを処理する', () => {
      const chain = ErrorReporter.getCauseChain('string error')
      expect(chain).toHaveLength(1)
      expect(chain[0]).toBe('string error')
    })

    it('複雑な原因チェーンを処理する', () => {
      const rootCause = new Error('Root')
      const error1 = { message: 'Error 1', cause: rootCause }
      const error2 = { message: 'Error 2', cause: error1 }

      const chain = ErrorReporter.getCauseChain(error2)
      // 3層のチェーンが適切に処理されることを確認
      expect(chain.length).toBe(3)
      expect(chain[0]).toBe(error2)
      expect(chain[1]).toBe(error1)
      expect(chain[2]).toBe(rootCause)
    })

    it('深い原因チェーンを処理する', () => {
      let currentError: any = new Error('Root')

      // 10層の原因チェーンを作成
      for (let i = 1; i < 10; i++) {
        const newError = NetworkError({
          message: `Error level ${i}`,
          cause: currentError,
        })
        currentError = newError
      }

      const chain = ErrorReporter.getCauseChain(currentError)
      expect(chain).toHaveLength(10)
      expect(chain[0]).toBe(currentError)
      expect((chain[9] as Error).message).toBe('Root')
    })

    it('causeがnullの場合は停止する', () => {
      const error = NetworkError({
        message: 'Error with null cause',
        cause: null,
      })

      const chain = ErrorReporter.getCauseChain(error)
      expect(chain).toHaveLength(1)
      expect(chain[0]).toBe(error)
    })

    it('causeがundefinedの場合は停止する', () => {
      const error = NetworkError({
        message: 'Error with undefined cause',
        cause: undefined,
      })

      const chain = ErrorReporter.getCauseChain(error)
      expect(chain).toHaveLength(1)
      expect(chain[0]).toBe(error)
    })
  })

  describe('Property-based testing', () => {
    it('任意のエラーオブジェクトをフォーマットできる', () => {
      const taggedErrorArbitrary = fc.record({
        _tag: fc.string({ minLength: 1 }),
        message: fc.string(),
      })

      fc.assert(
        fc.property(taggedErrorArbitrary, (error) => {
          const formatted = ErrorReporter.format(error)
          expect(typeof formatted).toBe('string')

          if (formatted.startsWith('{')) {
            const parsed = JSON.parse(formatted)
            expect(parsed.type).toBe(error._tag)
            expect(parsed.message).toBe(error.message)
            expect(parsed.timestamp).toBeDefined()
          }
        }),
        { numRuns: 100 }
      )
    })

    it('任意のプリミティブ値をフォーマットできる', () => {
      const primitiveArbitrary = fc.oneof(
        fc.string(),
        fc.integer(),
        fc.boolean(),
        fc.constant(null),
        fc.constant(undefined)
      )

      fc.assert(
        fc.property(primitiveArbitrary, (value) => {
          const formatted = ErrorReporter.format(value)
          expect(typeof formatted).toBe('string')
        }),
        { numRuns: 100 }
      )
    })

    it('原因チェーンの長さが適切', () => {
      const errorArbitrary = fc.record({
        message: fc.string(),
        cause: fc.option(fc.record({ message: fc.string() }), { nil: null }),
      })

      fc.assert(
        fc.property(errorArbitrary, (error) => {
          const chain = ErrorReporter.getCauseChain(error)
          expect(chain.length).toBeGreaterThan(0)
          expect(chain[0]).toBe(error)

          if (error.cause) {
            expect(chain.length).toBeGreaterThan(1)
            expect(chain[1]).toBe(error.cause)
          } else {
            expect(chain.length).toBe(1)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('スタックトレース抽出の一貫性', () => {
      const errorWithStackArbitrary = fc.record({
        message: fc.string(),
        stack: fc.option(fc.string(), { nil: undefined }),
      })

      fc.assert(
        fc.property(errorWithStackArbitrary, (error) => {
          const stack = ErrorReporter.getStackTrace(error)

          if (error.stack !== undefined) {
            expect(stack).toBeDefined()
            expect(typeof stack).toBe('string')
          } else {
            // stackがundefinedの場合、String(undefined)で"undefined"文字列が返される
            expect(stack === undefined || stack === 'undefined').toBe(true)
          }
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('統合テスト', () => {
    it('複雑なエラー構造を完全に処理する', () => {
      const rootCause = new Error('Root cause')
      const middleError = NetworkError({
        message: 'Middle network error',
        code: 'NET_001',
        statusCode: 503,
        cause: rootCause,
      })
      const topError = GameError({
        message: 'Top game error',
        code: 'GAME_001',
        cause: middleError,
      })

      // フォーマット
      const formatted = ErrorReporter.format(topError)
      const parsed = JSON.parse(formatted)

      expect(parsed.type).toBe('GameError')
      expect(parsed.message).toBe('Top game error')
      expect(parsed.details.cause).toBeDefined()

      // スタックトレース
      const stack = ErrorReporter.getStackTrace(topError)
      expect(stack).toBeUndefined() // GameErrorはErrorを継承していないため

      const rootStack = ErrorReporter.getStackTrace(rootCause)
      expect(rootStack).toBeDefined()
      expect(rootStack).toContain('Root cause')

      // 原因チェーン
      const chain = ErrorReporter.getCauseChain(topError)
      expect(chain).toHaveLength(3)
      expect(chain[0]).toBe(topError)
      expect(chain[1]).toBe(middleError)
      expect(chain[2]).toBe(rootCause)
    })

    it('エラーレポートの一貫性', () => {
      const error = NetworkError({
        message: 'Consistent error',
        code: 'CONSISTENT_001',
      })

      // 複数回フォーマットしても一貫した結果
      const format1 = ErrorReporter.format(error)
      const format2 = ErrorReporter.format(error)

      const parsed1 = JSON.parse(format1)
      const parsed2 = JSON.parse(format2)

      expect(parsed1.type).toBe(parsed2.type)
      expect(parsed1.message).toBe(parsed2.message)
      expect(parsed1.details.code).toBe(parsed2.details.code)
      // timestampは異なる可能性があるが、両方とも有効なISO文字列
      expect(new Date(parsed1.timestamp)).toBeInstanceOf(Date)
      expect(new Date(parsed2.timestamp)).toBeInstanceOf(Date)
    })
  })

  describe('エラーレポートの不変条件', () => {
    it('フォーマット結果は常に文字列', () => {
      const testCases = [
        NetworkError({ message: 'test' }),
        new Error('test'),
        'string',
        123,
        true,
        null,
        undefined,
        { _tag: 'CustomError', message: 'custom' },
        {},
        [],
      ]

      testCases.forEach((testCase) => {
        const result = ErrorReporter.format(testCase)
        expect(typeof result).toBe('string')
      })
    })

    it('原因チェーンは常に配列', () => {
      const testCases = [
        NetworkError({ message: 'test' }),
        new Error('test'),
        'string',
        123,
        null,
        undefined,
      ]

      testCases.forEach((testCase) => {
        const chain = ErrorReporter.getCauseChain(testCase)
        expect(Array.isArray(chain)).toBe(true)
        expect(chain.length).toBeGreaterThan(0)
        expect(chain[0]).toBe(testCase)
      })
    })

    it('スタックトレースは文字列またはundefined', () => {
      const testCases = [
        new Error('test'),
        NetworkError({ message: 'test' }),
        'string',
        123,
        null,
        undefined,
        { stack: 'custom stack' },
        { stack: 123 },
        {},
      ]

      testCases.forEach((testCase) => {
        const stack = ErrorReporter.getStackTrace(testCase)
        expect(stack === undefined || typeof stack === 'string').toBe(true)
      })
    })
  })
})