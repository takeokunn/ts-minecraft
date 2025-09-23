import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Either, pipe } from 'effect'
import {
  type NumberValue,
  type StringValue,
  type BooleanValue,
  type Result,
  type Option,
  type NonEmptyArray,
  type Predicate,
  type AsyncResult,
  type Callback,
  type AsyncCallback,
  type DeepReadonly,
  type DeepPartial,
} from '../common-types'

describe('common-types', () => {
  describe('基本的な型エイリアス', () => {
    it.effect('NumberValue型が正しく動作する', () => Effect.gen(function* () {
    const value: NumberValue = 42
    expect(typeof value).toBe('number')
    expect(value).toBe(42)
})
),
  Effect.gen(function* () {
    const value: StringValue = 'test'
    expect(typeof value).toBe('string')
    expect(value).toBe('test')
  })

    it.effect('BooleanValue型が正しく動作する', () => Effect.gen(function* () {
    const value: BooleanValue = true
    expect(typeof value).toBe('boolean')
    expect(value).toBe(true)
  })
)
  describe('Result型', () => {
  it.effect('成功ケースを正しく処理する', () => Effect.gen(function* () {
    const success: Result<string, Error> = Either.right('success')
    expect(Either.isRight(success)).toBe(true)
    if (Either.isRight(success)) {
    expect(success.right).toBe('success')
    }
})
),
  Effect.gen(function* () {
    const failure: Result<string, Error> = Either.left(new Error('test error'))
    expect(Either.isLeft(failure)).toBe(true)

    if (Either.isLeft(failure)) {
    expect(failure.left.message).toBe('test error')
    }
  })

    it.effect('Result型のパイプライン処理', () => Effect.gen(function* () {
    const result: Result<number, string> = Either.right(10)
    const doubled = pipe(
    result,
    Either.map(x => x * 2)
    )
    expect(Either.isRight(doubled)).toBe(true)
    if (Either.isRight(doubled)) {
    expect(doubled.right).toBe(20)
    }
  })
)
  describe('Option型', () => {
  it.effect('Some値を正しく処理する', () => Effect.gen(function* () {
    const some: Option<string> = { _tag: 'Some', value: 'test' }
    expect(some._tag).toBe('Some')
    expect(some.value).toBe('test')
})
),
  Effect.gen(function* () {
    const none: Option<string> = { _tag: 'None' }
    expect(none._tag).toBe('None')
  })

    it.effect('Option型のパターンマッチング', () => Effect.gen(function* () {
    const processOption = (opt: Option<number>): number => {
    switch (opt._tag) {
    case 'Some':
    return opt.value * 2
    case 'None':
    return 0
    }
    }
    const someResult = processOption({ _tag: 'Some', value: 5
  })
)
    expect(someResult).toBe(10)
    expect(noneResult).toBe(0)
  })

  })

  describe('NonEmptyArray型', () => {
  it.effect('非空配列を正しく処理する', () => Effect.gen(function* () {
    const arr: NonEmptyArray<number> = [1, 2, 3] as NonEmptyArray<number>
    expect(arr.length).toBeGreaterThan(0)
    expect(arr[0]).toBe(1)
})
),
  Effect.gen(function* () {
    const arr: NonEmptyArray<string> = ['single'] as NonEmptyArray<string>
    expect(arr.length).toBe(1)
    expect(arr[0]).toBe('single')
  })

  })

  describe('Predicate型', () => {
  it.effect('述語関数が正しく動作する', () => Effect.gen(function* () {
    const isEven: Predicate<number> = (x) => x % 2 === 0
    expect(isEven(2)).toBe(true)
    expect(isEven(3)).toBe(false)
    expect(isEven(0)).toBe(true)
})
),
  Effect.gen(function* () {
    const isPositive: Predicate<number> = (x) => x > 0
    const isEven: Predicate<number> = (x) => x % 2 === 0

    const isPositiveEven: Predicate<number> = (x) => isPositive(x) && isEven(x)

    expect(isPositiveEven(2)).toBe(true)
    expect(isPositiveEven(-2)).toBe(false)
    expect(isPositiveEven(3)).toBe(false)
  })

  })

  describe('AsyncResult型', () => {
  it.effect('非同期成功ケースを処理する', () => Effect.gen(function* () {
    const asyncSuccess: AsyncResult<string, Error> = Promise.resolve(Either.right('async success'))
    const result = yield* Effect.fromPromise(() => asyncSuccess)
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
    expect(result.right).toBe('async success')
    }
})
),
  Effect.gen(function* () {
    const asyncFailure: AsyncResult<string, Error> = Promise.resolve(Either.left(new Error('async error')))

    const result = yield* Effect.fromPromise(() => asyncFailure)
    expect(Either.isLeft(result)).toBe(true)

    if (Either.isLeft(result)) {
    expect(result.left.message).toBe('async error')
    }
  })

  })

  describe('Callback型', () => {
  it.effect('同期コールバックが正しく動作する', () => Effect.gen(function* () {
    let result = 0
    const callback: Callback<number> = (value) => {
    result = value * 2
    }
    callback(5)
    expect(result).toBe(10)
})
),
  Effect.gen(function* () {
    let receivedError: Error | null = null
    let receivedValue: string | null = null

    const callback: Callback<string> = (value, error) => {
    receivedValue = value
    receivedError = error || null
    }

    callback('test')
    expect(receivedValue).toBe('test')
    expect(receivedError).toBeNull()

    const testError = new Error('test error')
    callback('', testError)
    expect(receivedError).toBe(testError)
  })

  })

  describe('AsyncCallback型', () => {
  it.effect('非同期コールバックが正しく動作する', () => Effect.gen(function* () {
    let result: string | null = null
    const asyncCallback: AsyncCallback<string> = async (value) => {
    await new Promise(resolve => setTimeout(resolve, 1))
    result = value.toUpperCase()
    }
    yield* Effect.fromPromise(() => asyncCallback('test'))
    expect(result).toBe('TEST')
})
)
  describe('DeepReadonly型', () => {
  it.effect('深い読み取り専用オブジェクトを処理する', () => Effect.gen(function* () {
    interface TestObject {
    name: string
    nested: {
    value: number
    array: string[]
    }
    }
    const original: TestObject = {
    name: 'test',
    nested: {
    value: 42,
    array: ['a', 'b', 'c']
    }
    }
    const readonly: DeepReadonly<TestObject> = original
    // 型レベルでの読み取り専用性の確認（実行時チェック）
    expect(readonly.name).toBe('test')
    expect(readonly.nested.value).toBe(42)
    expect(readonly.nested.array[0]).toBe('a')
})
)
  describe('DeepPartial型', () => {
  it.effect('深い部分的オブジェクトを処理する', () => Effect.gen(function* () {
    interface CompleteObject {
    required: string
    nested: {
    value: number
    optional?: string
    }
    }
    const partial: DeepPartial<CompleteObject> = {
    nested: {
    value: 42
    // optional は省略可能
    }
    // required も省略可能
    }
    expect(partial.nested?.value).toBe(42)
    expect(partial.required).toBeUndefined()
})
),
  Effect.gen(function* () {
    interface Config {
    server: {
    port: number
    host: string
    }
    database: {
    url: string
    timeout: number
    }
    }

    const defaultConfig: Config = {
    server: { port: 3000, host: 'localhost' },
    database: { url: 'mongodb://localhost', timeout: 5000 }
    }

    const update: DeepPartial<Config> = {
    server: {
    port: 8080
    // host は更新しない
    }
    // database は更新しない
    }

    const mergeConfig = (base: Config, updates: DeepPartial<Config>): Config => {
    return {
    ...base,
    server: { ...base.server, ...updates.server },
    database: { ...base.database, ...updates.database }
    }
    }

    const newConfig = mergeConfig(defaultConfig, update)

    expect(newConfig.server.port).toBe(8080)
    expect(newConfig.server.host).toBe('localhost')
    expect(newConfig.database.url).toBe('mongodb://localhost')
  })

  })

  describe('型の統合テスト', () => {
  it.effect('複数の型を組み合わせて使用する', () => Effect.gen(function* () {
    // 複雑な型の組み合わせ
    type ProcessResult = Result<NonEmptyArray<NumberValue>, StringValue>
    const processNumbers = (input: number[]): ProcessResult => {
    if (input.length === 0) {
    return Either.left('Empty array provided')
    }
    return Either.right(input as NonEmptyArray<number>)
    }
    const validResult = processNumbers([1, 2, 3])
    const invalidResult = processNumbers([])
    expect(Either.isRight(validResult)).toBe(true)
    expect(Either.isLeft(invalidResult)).toBe(true)
    if (Either.isRight(validResult)) {
    expect(validResult.right.length).toBe(3)
    }
    if (Either.isLeft(invalidResult)) {
    expect(invalidResult.left).toBe('Empty array provided')
    }
})
),
  Effect.gen(function* () {
    // Effect-TSのパターンと共通型の組み合わせ
    const safeOperation = (value: NumberValue): Effect.Effect<NumberValue, StringValue> => {
    if (value < 0) {
    return Effect.fail('Negative value not allowed')
    }
    return Effect.succeed(value * 2)
    }

    const positiveResult = yield* Effect.either(safeOperation(5))
    const negativeResult = yield* Effect.either(safeOperation(-1))

    expect(Either.isRight(positiveResult)).toBe(true)
    expect(Either.isLeft(negativeResult)).toBe(true)

    if (Either.isRight(positiveResult)) {
    expect(positiveResult.right).toBe(10)
    }

    if (Either.isLeft(negativeResult)) {
    expect(negativeResult.left).toBe('Negative value not allowed')
    }
  })

  })
})