/**
 * @fileoverview CANNON.Body Schema定義
 *
 * CANNON.Bodyオブジェクトの型安全なラッパー。
 * Effect-TS Schemaを使用してCANNON.Bodyの型変換を提供する。
 */

import * as CANNON from 'cannon-es'
import { Schema } from 'effect'
import { unsafeCoerce } from 'effect/Function'

/**
 * CANNON.Body Brand型
 *
 * CANNON.Bodyは外部ライブラリの複雑なオブジェクトのため、
 * Schema.Unknownをベースにしつつ、型安全性を提供する。
 */
export const CannonBodySchema = Schema.Unknown.pipe(Schema.brand('CannonBody'))

export type CannonBody = Schema.Schema.Type<typeof CannonBodySchema>

/**
 * CANNON.BodyをCannonBody型に安全に変換
 *
 * @param body - CANNON.Bodyオブジェクト
 * @returns CannonBody Brand型
 */
export const makeCannonBodyUnsafe = (body: CANNON.Body): CannonBody => unsafeCoerce<CANNON.Body, CannonBody>(body)

/**
 * CannonBodyを元のCANNON.Bodyに変換
 *
 * @param body - CannonBody Brand型
 * @returns CANNON.Bodyオブジェクト
 */
export const toCannonBody = (body: CannonBody): CANNON.Body => unsafeCoerce<CannonBody, CANNON.Body>(body)

/**
 * 型安全性に関する注記:
 *
 * CANNON.Bodyは以下の理由でSchema.Unknownを使用:
 *
 * 1. CANNON.jsは外部ライブラリで複雑な内部状態を持つ
 * 2. プロパティが多数あり、全てをSchemaで定義すると保守性が低下
 * 3. 物理エンジンの内部実装に依存する構造
 *
 * Brand型を使用することで、型安全性を維持しつつ柔軟性を確保。
 */
