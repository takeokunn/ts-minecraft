import { Context, Effect } from 'effect'

/**
 * WorldClock - ワールドドメイン向け時間サービス
 *
 * Effect-TSのClockサービスをベースに、現在時刻の数値および
 * Dateオブジェクト化を完全にEffectとして提供する。
 */
export interface WorldClock {
  readonly currentMillis: Effect.Effect<number>
  readonly currentDate: Effect.Effect<Date>
}

/**
 * WorldClockタグ。ワールドドメイン全体で共有する時間依存を解決する。
 */
export const WorldClock = Context.GenericTag<WorldClock>('@ts-minecraft/domain/world/WorldClock')

export type WorldClockTag = typeof WorldClock
