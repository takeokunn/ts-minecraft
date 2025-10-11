import { Schema } from 'effect'

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

/**
 * Schema.ParseErrorの詳細情報を読みやすい文字列配列に変換する
 *
 * @param error - Schema.ParseError
 * @returns エラー詳細の文字列配列
 */
export const formatParseIssues = (error: Schema.ParseError): string[] =>
  error.issues.map((issue) => {
    const path = issue.path?.join('.') || 'unknown'
    return `${path}: ${issue.message}`
  })
