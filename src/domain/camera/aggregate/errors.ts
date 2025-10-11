/**
 * @fileoverview Camera Aggregate Errors
 *
 * カメラAggregateの操作で発生する可能性のあるエラー型定義
 */

import { Schema } from 'effect'

/**
 * 未知のカメラタイプエラー
 *
 * Match.exhaustiveでカバーされていないカメラタイプが渡された場合に発生
 * 通常は起こりえないが、型システムの安全性のために定義
 */
export class UnknownCameraTypeError extends Schema.TaggedError<UnknownCameraTypeError>()('UnknownCameraTypeError', {
  cameraAggregate: Schema.Unknown,
  message: Schema.String,
}) {}
