import { Effect, Option, pipe, Schema } from 'effect'
import * as Match from 'effect/Match'

/**
 * Network Information API Schema
 *
 * 実験的機能のため型定義が不安定
 * https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
 */

/**
 * 有効な接続タイプ
 */
export const NetworkConnectionSchema = Schema.Struct({
  effectiveType: Schema.Literal('slow-2g', '2g', '3g', '4g').pipe(
    Schema.annotations({ description: 'Effective connection type' })
  ),
  downlink: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.annotations({ description: 'Effective bandwidth estimate (Mbps)' })
  ).pipe(Schema.optional),
  rtt: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.annotations({ description: 'Round-trip time estimate (ms)' })
  ).pipe(Schema.optional),
  saveData: Schema.Boolean.pipe(Schema.annotations({ description: 'User agent data saver preference' })).pipe(
    Schema.optional
  ),
})

export type NetworkConnection = Schema.Schema.Type<typeof NetworkConnectionSchema>

/**
 * デフォルト値（接続情報取得不可時）
 */
const defaultNetworkConnection: NetworkConnection = {
  effectiveType: '4g',
}

/**
 * Navigatorにconnectionプロパティがあるかチェック
 */
const hasNetworkInformation = (): boolean => {
  return typeof navigator !== 'undefined' && 'connection' in navigator
}

/**
 * 型安全なNetworkConnection取得
 *
 * @returns NetworkConnectionのOption（取得不可時はnone）
 */
interface NetworkInformationLike {
  readonly effectiveType?: string
  readonly downlink?: number
  readonly rtt?: number
  readonly saveData?: boolean
}

export const getNetworkConnection = (): Effect.Effect<Option.Option<NetworkConnection>, never> =>
  Effect.sync(() => {
    return pipe(
      Match.value(hasNetworkInformation()),
      Match.when(false, () => Option.none<NetworkConnection>()),
      Match.orElse(() => {
        const nav = navigator as Navigator & { connection?: NetworkInformationLike }
        return Schema.decodeUnknownOption(NetworkConnectionSchema)(nav.connection)
      }),
      Match.exhaustive
    )
  })

/**
 * effectiveTypeのみ取得 - 同期版
 *
 * @returns 接続タイプ（取得不可時は'unknown'）
 */
export const getEffectiveConnectionTypeSync = (): 'slow-2g' | '2g' | '3g' | '4g' | 'unknown' =>
  pipe(
    Match.value(hasNetworkInformation()),
    Match.when(false, () => 'unknown' as const),
    Match.orElse(() => {
      const nav = navigator as Navigator & { connection?: NetworkInformationLike }
      const result = Schema.decodeUnknownOption(NetworkConnectionSchema)(nav.connection)
      return Option.match(result, {
        onNone: () => 'unknown' as const,
        onSome: (conn) => conn.effectiveType,
      })
    }),
    Match.exhaustive
  )

/**
 * effectiveTypeのみ取得
 *
 * @returns 接続タイプ（取得不可時は'unknown'）
 */
export const getEffectiveConnectionType = (): Effect.Effect<'slow-2g' | '2g' | '3g' | '4g' | 'unknown', never> =>
  pipe(
    getNetworkConnection(),
    Effect.map(
      Option.match({
        onNone: () => 'unknown' as const,
        onSome: (conn) => conn.effectiveType,
      })
    )
  )

/**
 * NetworkConnectionを確実に取得
 *
 * @returns NetworkConnection（取得不可時はデフォルト値）
 */
export const getNetworkConnectionOrDefault = (): Effect.Effect<NetworkConnection, never> =>
  pipe(
    getNetworkConnection(),
    Effect.map(
      Option.match({
        onNone: () => defaultNetworkConnection,
        onSome: (conn) => conn,
      })
    )
  )
