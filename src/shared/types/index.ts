/**
 * 共通型定義のエクスポート
 * プロジェクト全体で使用される型定義の単一エントリーポイント
 */

// GameError系は errors/ から提供されるため、config/effect からは EffectConfig のみをエクスポート
export { createGameError, EffectConfig, type GameResult } from '../config/effect'
export * from './branded'

/**
 * 基本的な数値型
 */
export type NumberValue = number

/**
 * 基本的な文字列型
 */
export type StringValue = string

/**
 * 基本的なブール型
 */
export type BooleanValue = boolean
