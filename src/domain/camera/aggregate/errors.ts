/**
 * @fileoverview Camera Aggregate Errors
 *
 * カメラAggregateの操作で発生する可能性のあるエラー型定義
 */

import { Schema } from 'effect'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'

/**
 * 未知のカメラタイプエラー
 *
 * Match.exhaustiveでカバーされていないカメラタイプが渡された場合に発生
 * 通常は起こりえないが、型システムの安全性のために定義
 */
export const UnknownCameraTypeErrorSchema = Schema.TaggedError('UnknownCameraTypeError', {
  aggregateType: Schema.String,
  message: Schema.String,
})

export type UnknownCameraTypeError = Schema.Schema.Type<typeof UnknownCameraTypeErrorSchema>

export const UnknownCameraTypeError = makeErrorFactory(UnknownCameraTypeErrorSchema)
