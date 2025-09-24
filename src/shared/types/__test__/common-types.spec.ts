import { describe, it, expect } from '@effect/vitest'
import { Effect, Either, pipe } from 'effect'
import * as fc from 'fast-check'
import {
  type NumberValue,
  type StringValue,
  type BooleanValue,
  type Result,
  type Option,
  type NonEmptyArray,
  type Predicate,
  type Callback,
  type AsyncCallback,
  type DeepReadonly,
  type DeepPartial,
} from '../common-types'

describe('common-types', () => {
  describe('基本的な型エイリアス', () => {
    it('NumberValue型が正しく動作する', () => {
      const value: NumberValue = 42
      expect(typeof value).toBe('number')
      expect(value).toBe(42)
    })

    it('StringValue型が正しく動作する', () => {
      const value: StringValue = 'test'
      expect(typeof value).toBe('string')
      expect(value).toBe('test')
    })

    it('BooleanValue型が正しく動作する', () => {
      const value: BooleanValue = true
      expect(typeof value).toBe('boolean')
      expect(value).toBe(true)
    })
  })

  describe('Result型', () => {
    it.effect('成功ケースを正しく表現する', () =>
      Effect.gen(function* () {
        const result: Result<string> = Effect.succeed('success')
        const value = yield* result
        expect(value).toBe('success')
      })
    )

    it.effect('失敗ケースを正しく表現する', () =>
      Effect.gen(function* () {
        const result: Result<string, Error> = Effect.fail(new Error('test error'))
        const either = yield* Effect.either(result)

        expect(either._tag).toBe('Left')
        pipe(
          either,
          Either.match({
            onLeft: (error) => {
              expect(error.message).toBe('test error')
            },
            onRight: () => {
              // 失敗ケースなので到達しない
            },
          })
        )
      })
    )
  })

  describe('Option型', () => {
    it('値が存在する場合を正しく表現する', () => {
      const value: Option<string> = 'exists'
      expect(value).toBe('exists')
    })

    it('null値を正しく表現する', () => {
      const value: Option<string> = null
      expect(value).toBeNull()
    })

    it('undefined値を正しく表現する', () => {
      const value: Option<string> = undefined
      expect(value).toBeUndefined()
    })
  })

  describe('NonEmptyArray型', () => {
    it('空でない配列を正しく表現する', () => {
      const arr: NonEmptyArray<number> = [1, 2, 3]
      expect(arr.length).toBeGreaterThan(0)
      expect(arr[0]).toBe(1)
    })

    it('単一要素の配列も正しく表現する', () => {
      const arr: NonEmptyArray<string> = ['single']
      expect(arr.length).toBe(1)
      expect(arr[0]).toBe('single')
    })
  })

  describe('Predicate型', () => {
    it('条件判定関数を正しく表現する', () => {
      const isEven: Predicate<number> = (n) => n % 2 === 0

      expect(isEven(4)).toBe(true)
      expect(isEven(3)).toBe(false)
    })

    it('複雑な条件も正しく表現する', () => {
      const isValidEmail: Predicate<string> = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('invalid-email')).toBe(false)
    })
  })

  describe('Callback型', () => {
    it('コールバック関数を正しく表現する', () => {
      let called = false
      const callback: Callback<string> = (value) => {
        called = true
        expect(value).toBe('test')
      }

      callback('test')
      expect(called).toBe(true)
    })

    it('void型のコールバックも正しく表現する', () => {
      let called = false
      const callback: Callback = () => {
        called = true
      }

      callback()
      expect(called).toBe(true)
    })
  })

  describe('AsyncCallback型', () => {
    it('非同期コールバック関数を正しく表現する', () => {
      let called = false
      const callback: AsyncCallback<string> = (value) =>
        Effect.gen(function* () {
          called = true
          expect(value).toBe('async-test')
        })

      Effect.runSync(callback('async-test'))
      expect(called).toBe(true)
    })
  })

  describe('DeepReadonly型', () => {
    it('深い読み取り専用型を正しく表現する', () => {
      interface TestType {
        prop1: string
        nested: {
          prop2: number
          deepNested: {
            prop3: boolean
          }
        }
      }

      const readonlyObj: DeepReadonly<TestType> = {
        prop1: 'test',
        nested: {
          prop2: 42,
          deepNested: {
            prop3: true,
          },
        },
      }

      // 型レベルでreadonly性を確認（コンパイル時チェック）
      expect(readonlyObj.prop1).toBe('test')
      expect(readonlyObj.nested.prop2).toBe(42)
      expect(readonlyObj.nested.deepNested.prop3).toBe(true)
    })
  })

  describe('DeepPartial型', () => {
    it('深い部分型を正しく表現する', () => {
      interface TestType {
        prop1: string
        nested: {
          prop2: number
          deepNested: {
            prop3: boolean
          }
        }
      }

      const partialObj: DeepPartial<TestType> = {
        nested: {
          deepNested: {
            prop3: true,
          },
        },
      }

      expect(partialObj.nested?.deepNested?.prop3).toBe(true)
    })

    it('完全に空のオブジェクトも許可する', () => {
      interface TestType {
        prop1: string
        nested: {
          prop2: number
        }
      }

      const emptyObj: DeepPartial<TestType> = {}
      expect(emptyObj).toEqual({})
    })
  })

  describe('Property-based testing', () => {
    it('NumberValue型のプロパティテスト', () => {
      fc.assert(
        fc.property(fc.float(), (value) => {
          const numberValue: NumberValue = value
          expect(typeof numberValue).toBe('number')
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('StringValue型のプロパティテスト', () => {
      fc.assert(
        fc.property(fc.string(), (value) => {
          const stringValue: StringValue = value
          expect(typeof stringValue).toBe('string')
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('BooleanValue型のプロパティテスト', () => {
      fc.assert(
        fc.property(fc.boolean(), (value) => {
          const booleanValue: BooleanValue = value
          expect(typeof booleanValue).toBe('boolean')
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('NonEmptyArray型のプロパティテスト', () => {
      fc.assert(
        fc.property(fc.array(fc.integer(), { minLength: 1 }), (array) => {
          // 配列が空でないことを型安全に確認
          if (array.length === 0) {
            return true // 空配列は除外
          }
          const nonEmptyArr: NonEmptyArray<number> = array as unknown as NonEmptyArray<number>
          expect(nonEmptyArr.length).toBeGreaterThan(0)
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('Predicate型のプロパティテスト', () => {
      const alwaysTrue: Predicate<number> = () => true
      const alwaysFalse: Predicate<number> = () => false

      fc.assert(
        fc.property(fc.integer(), (value) => {
          expect(alwaysTrue(value)).toBe(true)
          expect(alwaysFalse(value)).toBe(false)
          return true
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('型の合成テスト', () => {
    it('複合型が正しく動作する', () => {
      type ComplexType = {
        result: Result<string>
        optional: Option<number>
        items: NonEmptyArray<string>
        validator: Predicate<string>
      }

      const complexValue: ComplexType = {
        result: Effect.succeed('success'),
        optional: 42,
        items: ['item1', 'item2'],
        validator: (s) => s.length > 0,
      }

      expect(complexValue.optional).toBe(42)
      expect(complexValue.items.length).toBe(2)
      expect(complexValue.validator('test')).toBe(true)
    })
  })
})
