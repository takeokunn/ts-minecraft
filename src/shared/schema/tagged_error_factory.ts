/**
 * Schema.TaggedError向けの簡易Factoryユーティリティ
 *
 * Schema.TaggedErrorが提供する`make`関数を扱いやすくするため、
 * シンプルなFactoryインターフェースを提供する。
 */
export const makeErrorFactory = <Input, Output>(schema: { readonly make: (input: Input) => Output }) =>
  ({
    make: (input: Input) => schema.make(input),
  }) as const

